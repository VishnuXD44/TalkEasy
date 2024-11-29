import { auth, database } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { ref, set, get, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";
import { moderator } from './moderation.js';

// Global state
let localStream = null;
let peerConnection = null;
let currentUser = null;
let isCameraOn = true;
let isMicOn = true;
let selectedLanguage = null;

// Language mapping
const languageNames = {
    'ja': '日本語 🇯🇵',
    'zh': '中文 🇨🇳',
    'ko': '한국어 🇰🇷',
    'es': 'Español 🇪🇸',
    'en': 'English 🇬🇧',
    'fr': 'Français 🇫🇷'
};

// WebRTC configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const nextBtn = document.getElementById('next-btn');
const cameraBtn = document.getElementById('camera-btn');
const micBtn = document.getElementById('mic-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const languageSelectScreen = document.getElementById('language-select-screen');
const currentLanguageDisplay = document.getElementById('current-language-display');
const waitingScreen = document.getElementById('waiting-screen');

// Language Selection Functions
function setupLanguageSelection() {
    console.log('Setting up language selection');
    const languageButtons = document.querySelectorAll('.language-item');
    
    languageButtons.forEach(button => {
        button.onclick = async () => {
            console.log('Language clicked:', button.dataset.lang);
            
            // Remove previous selections
            languageButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            
            selectedLanguage = button.dataset.lang;
            
            try {
                // Save language preference
                const userLangRef = ref(database, `users/${currentUser.uid}/language`);
                await set(userLangRef, selectedLanguage);
                console.log('Language saved to database');

                // Update UI
                updateCurrentLanguageDisplay(selectedLanguage);
                
                // Hide language select screen
                languageSelectScreen.style.display = 'none';
                
                // Show waiting screen
                waitingScreen.style.display = 'flex';
                waitingScreen.classList.remove('hidden');
                
                // Setup media stream and find peer
                await setupMediaStream();
                await findPeer();
                
            } catch (error) {
                console.error('Error in language selection:', error);
                button.classList.remove('selected');
                alert('Failed to set language. Please try again.');
            }
        };
    });
}

// UI Functions
function updateCurrentLanguageDisplay(langCode) {
    if (currentLanguageDisplay) {
        currentLanguageDisplay.textContent = languageNames[langCode] || 'Select Language';
    }
}

function showWaitingScreen() {
    if (waitingScreen) {
        waitingScreen.style.display = 'flex';
        waitingScreen.classList.remove('hidden');
    }
}

function hideWaitingScreen() {
    if (waitingScreen) {
        waitingScreen.style.display = 'none';
        waitingScreen.classList.add('hidden');
    }
}

// Media Stream Functions
async function setupMediaStream() {
    try {
        console.log('Setting up media stream');
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        localVideo.srcObject = localStream;
        moderator.start();
        console.log('Media stream setup complete');
    } catch (error) {
        console.error("Error accessing media devices:", error);
        alert("Unable to access camera or microphone. Please check permissions.");
        throw error;
    }
}

function stopMediaStream() {
    console.log('Stopping media stream');
    moderator.stop();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

// Control Functions
function toggleCamera() {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        isCameraOn = !isCameraOn;
        videoTrack.enabled = isCameraOn;
        cameraBtn.innerHTML = isCameraOn ? 
            '<i class="fas fa-video"></i>' : 
            '<i class="fas fa-video-slash"></i>';
        cameraBtn.classList.toggle('off', !isCameraOn);
    }
}

function toggleMic() {
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
        isMicOn = !isMicOn;
        audioTrack.enabled = isMicOn;
        micBtn.innerHTML = isMicOn ? 
            '<i class="fas fa-microphone"></i>' : 
            '<i class="fas fa-microphone-slash"></i>';
        micBtn.classList.toggle('off', !isMicOn);
    }
}

// Peer Connection Functions
async function findPeer() {
    if (!selectedLanguage) {
        console.log('No language selected');
        return;
    }

    console.log('Finding peer for language:', selectedLanguage);
    const waitingRef = ref(database, "waiting");
    
    try {
        const snapshot = await get(waitingRef);
        const waitingUsers = snapshot.val() || {};
        
        const matchingUser = Object.values(waitingUsers).find(user => 
            user.language === selectedLanguage && user.uid !== currentUser.uid
        );

        if (!matchingUser) {
            console.log('No matching user found, adding self to waiting list');
            await set(waitingRef, {
                uid: currentUser.uid,
                language: selectedLanguage,
                timestamp: serverTimestamp()
            });
            waitForPeer();
        } else {
            console.log('Found matching user');
            hideWaitingScreen();
            initiatePeerConnection(matchingUser.uid);
        }
    } catch (error) {
        console.error('Error finding peer:', error);
        hideWaitingScreen();
        alert('Error finding a conversation partner. Please try again.');
    }
}

function waitForPeer() {
    console.log('Waiting for peer');
    const waitingRef = ref(database, "waiting");
    
    onValue(waitingRef, (snapshot) => {
        const waitingUsers = snapshot.val();
        if (!waitingUsers) return;

        const matchingUser = Object.values(waitingUsers).find(user => 
            user.language === selectedLanguage && user.uid !== currentUser.uid
        );

        if (matchingUser) {
            console.log('Found matching peer while waiting');
            hideWaitingScreen();
            initiatePeerConnection(matchingUser.uid);
        }
    });
}

function initiatePeerConnection(peerId) {
    console.log('Initiating peer connection');
    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            const connectionRef = ref(database, `connections/${peerId}`);
            set(connectionRef, {
                type: "candidate",
                candidate: event.candidate
            });
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
        moderator.start();
    };

    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            const connectionRef = ref(database, `connections/${peerId}`);
            set(connectionRef, {
                type: "offer",
                offer: peerConnection.localDescription
            });
        });

    const userConnectionRef = ref(database, `connections/${currentUser.uid}`);
    onValue(userConnectionRef, (snapshot) => {
        const data = snapshot.val();
        if (data?.type === "answer") {
            peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
            );
        } else if (data?.type === "candidate") {
            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
}

// Event Handlers
async function handleLogout() {
    try {
        moderator.stop();
        stopMediaStream();
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
}

async function handleNext() {
    stopMediaStream();
    selectedLanguage = null;
    updateCurrentLanguageDisplay(null);
    languageSelectScreen.style.display = 'flex';
    languageSelectScreen.classList.remove('hidden');
}

// Setup Functions
function setupEventListeners() {
    logoutBtn?.addEventListener('click', handleLogout);
    nextBtn?.addEventListener('click', handleNext);
    cameraBtn?.addEventListener('click', toggleCamera);
    micBtn?.addEventListener('click', toggleMic);
}

// Cleanup Function
async function cleanup() {
    moderator.stop();
    stopMediaStream();
    
    if (currentUser) {
        const waitingRef = ref(database, "waiting");
        const connectionRef = ref(database, `connections/${currentUser.uid}`);
        await Promise.all([
            set(waitingRef, null),
            set(connectionRef, null)
        ]);
    }
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('User logged in:', user.uid);
        languageSelectScreen.style.display = 'flex';
        setupLanguageSelection();
    } else {
        cleanup();
        window.location.href = 'index.html';
    }
});

// Initialize
setupEventListeners();

// Export for moderation.js
window.handleModerationViolation = function(source) {
    cleanup();
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
    
    setTimeout(() => {
        window.location.href = '/';
    }, 3000);
};
