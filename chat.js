import { auth, database } from './config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { ref, set, get, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// Global state
let localStream = null;
let peerConnection = null;
let currentUser = null;
let isCameraOn = true;
let isMicOn = true;

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

// Event Listeners
function setupEventListeners() {
    logoutBtn?.addEventListener('click', handleLogout);
    nextBtn?.addEventListener('click', handleNext);
    cameraBtn?.addEventListener('click', toggleCamera);
    micBtn?.addEventListener('click', toggleMic);
    window.addEventListener('beforeunload', cleanup);
}

// Authentication Functions
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
}

// Media Stream Functions
async function setupMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        alert("Unable to access camera or microphone. Please check permissions.");
    }
}

function stopMediaStream() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

function toggleCamera() {
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        isCameraOn = !isCameraOn;
        videoTrack.enabled = isCameraOn;
        cameraBtn.innerHTML = isCameraOn ? 
            '<i class="fas fa-video"></i>' : 
            '<i class="fas fa-video-slash"></i>';
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
    }
}

// Peer Connection Functions
function findPeer() {
    const waitingRef = ref(database, "waiting");

    get(waitingRef).then(async (snapshot) => {
        const waitingUser = snapshot.val();

        if (!waitingUser || waitingUser.uid === currentUser.uid) {
            await set(waitingRef, {
                uid: currentUser.uid,
                timestamp: serverTimestamp()
            });
            waitForPeer();
        } else {
            initiatePeerConnection(waitingUser.uid);
        }
    });
}

function waitForPeer() {
    const waitingRef = ref(database, "waiting");
    onValue(waitingRef, (snapshot) => {
        const waitingUser = snapshot.val();
        if (waitingUser && waitingUser.uid !== currentUser.uid) {
            initiatePeerConnection(waitingUser.uid);
        }
    });
}

function initiatePeerConnection(peerId) {
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

// Utility Functions
async function handleNext() {
    stopMediaStream();
    await setupMediaStream();
    findPeer();
}

function cleanup() {
    stopMediaStream();
    if (currentUser) {
        const waitingRef = ref(database, "waiting");
        set(waitingRef, null);
    }
}

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await setupMediaStream();
        findPeer();
    } else {
        window.location.href = 'index.html';
    }
});

// Initialize
setupEventListeners();
