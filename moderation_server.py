from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import numpy as np
import cv2
from nudenet import NudeDetector
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize detector
detector = NudeDetector()

# Define ONLY explicit content categories and their thresholds
EXPLICIT_CATEGORIES = {
    'FEMALE_BREAST_EXPOSED': 0.6,
    'MALE_BREAST_EXPOSED': 0.6,
    'FEMALE_GENITALIA_EXPOSED': 0.6,
    'MALE_GENITALIA_EXPOSED': 0.6,
    'BUTTOCKS_EXPOSED': 0.6,
    'NUDITY': 0.7,
    'EXPLICIT_NUDITY': 0.6,
    'SEXUAL_ACTIVITY': 0.6
}

@app.route('/')
def home():
    return "Moderation Server Running"

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "detector": detector is not None})

@app.route('/analyze-frame', methods=['POST', 'OPTIONS'])
def analyze_frame():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        # Get base64 image from request
        image_data = request.json.get('frame')
        if not image_data:
            return jsonify({"error": "No frame data provided"}), 400

        # Decode base64 image
        try:
            if 'base64,' in image_data:
                image_data = image_data.split('base64,')[1]
            image_bytes = base64.b64decode(image_data)
        except Exception as e:
            logger.error(f"Base64 decode error: {str(e)}")
            return jsonify({"error": "Invalid image data"}), 400

        # Convert to image
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("Failed to decode image")

        except Exception as e:
            logger.error(f"Image processing error: {str(e)}")
            return jsonify({"error": "Failed to process image"}), 400

        # Analyze image
        try:
            result = detector.detect(image)
            
            # Check only explicit content
            violations = []
            is_explicit = False

            for pred in result:
                class_name = pred['class']
                score = pred['score']
                
                # Only check categories we've defined as explicit
                if class_name in EXPLICIT_CATEGORIES:
                    threshold = EXPLICIT_CATEGORIES[class_name]
                    
                    logger.info(f"Checking explicit content - Class: {class_name}, Score: {score}, Threshold: {threshold}")

                    if score > threshold:
                        violations.append({
                            'class': class_name,
                            'score': score,
                            'threshold': threshold
                        })
                        is_explicit = True

            response_data = {
                'is_explicit': is_explicit,
                'violations': violations
            }
            
            if is_explicit:
                logger.warning(f"Explicit content detected! Violations: {violations}")
            
            return jsonify(response_data)

        except Exception as e:
            logger.error(f"Analysis error: {str(e)}")
            return jsonify({"error": "Analysis failed"}), 500

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    logger.info("Starting moderation server on port 5500...")
    logger.info("Monitoring for the following explicit content:")
    for category, threshold in EXPLICIT_CATEGORIES.items():
        logger.info(f"- {category}: threshold > {threshold}")
    app.run(host='127.0.0.1', port=5500)
