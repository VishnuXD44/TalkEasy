class ContentModerator {
    constructor() {
        this.moderationInterval = null;
        this.MODERATION_INTERVAL = 2000;
        this.MODERATION_SERVER = 'http://127.0.0.1:5500';
        this.isActive = false;
        this.consecutiveErrors = 0;
        this.MAX_CONSECUTIVE_ERRORS = 5;
    }

    async start() {
        if (this.isActive) return;
        
        try {
            console.log('Starting content moderation...');
            this.isActive = true;
            this.consecutiveErrors = 0;
            this.moderationInterval = setInterval(() => this.moderateStream(), this.MODERATION_INTERVAL);
        } catch (error) {
            console.error('Failed to start moderation:', error);
        }
    }

    stop() {
        if (this.moderationInterval) {
            clearInterval(this.moderationInterval);
            this.moderationInterval = null;
        }
        this.isActive = false;
        console.log('Content moderation stopped');
    }

    captureFrame(videoElement) {
        if (!videoElement || !videoElement.videoWidth) return null;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoElement, 0, 0);
            
            return canvas.toDataURL('image/jpeg', 0.8);
        } catch (error) {
            console.error('Frame capture error:', error);
            return null;
        }
    }

    async analyzeFrame(frame) {
        try {
            const response = await fetch(`${this.MODERATION_SERVER}/analyze-frame`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ frame })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.consecutiveErrors = 0;
            return result;
        } catch (error) {
            this.consecutiveErrors++;
            console.error('Frame analysis error:', error);
            
            if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
                this.stop();
                console.error('Moderation stopped due to repeated errors');
            }
            return null;
        }
    }

    async moderateStream() {
        if (!this.isActive) return;

        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');

        // Check local video
        const localFrame = this.captureFrame(localVideo);
        if (localFrame) {
            const localResult = await this.analyzeFrame(localFrame);
            if (localResult?.is_explicit) {
                console.log('Explicit content detected in local stream');
                this.handleViolation('local');
                return;
            }
        }

        // Check remote video
        const remoteFrame = this.captureFrame(remoteVideo);
        if (remoteFrame) {
            const remoteResult = await this.analyzeFrame(remoteFrame);
            if (remoteResult?.is_explicit) {
                console.log('Explicit content detected in remote stream');
                this.handleViolation('remote');
                return;
            }
        }
    }

    handleViolation(source) {
        this.stop();
        
        // Create warning screen
        const warningScreen = document.createElement('div');
        warningScreen.className = 'warning-screen';
        warningScreen.innerHTML = `
            <div class="warning-content">
                <h2>Session Terminated</h2>
                <p>This session has been terminated due to inappropriate content ${
                    source === 'local' ? 'from your camera' : 'from remote user'
                }.</p>
                <button onclick="window.location.href='/'">Return to Home</button>
            </div>
        `;
        document.body.appendChild(warningScreen);

        // Trigger disconnect in chat.js
        if (window.handleModerationViolation) {
            window.handleModerationViolation(source);
        } else {
            // Fallback if handler not available
            window.location.href = '/';
        }
    }
}

export const moderator = new ContentModerator();
