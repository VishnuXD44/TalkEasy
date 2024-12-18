import { auth, database, provider } from './config.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { ref, set, get, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

// Authentication Functions
async function handleLogin() {
    try {
        console.log("Login attempt starting..."); // Debug log
        const result = await signInWithPopup(auth, provider);
        console.log("Login successful", result.user); // Debug log
    } catch (error) {
        console.error("Login error:", error);
        alert(`Login failed: ${error.message}`);
    }
}

// Event Listeners
if (loginBtn) {
    console.log("Login button found"); // Debug log
    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log("Login button clicked"); // Debug log
        await handleLogin();
    });
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    console.log("Auth state changed:", user ? "logged in" : "logged out"); // Debug log
    if (user) {
        window.location.href = 'chat.html';
    }
});

// Rest of your app.js code...


// Login handler function
async function handleLogin() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        console.log("Login successful:", result.user.uid); // Debug log
    } catch (error) {
        console.error('Login error:', error);
        alert('Failed to login. Please try again.');
    }
}


// Media Stream Functions
async function setupMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
        alert("Unable to access camera or microphone. Please check permissions.");
    }
}

function stopMediaStream() {
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localVideo.srcObject = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

// Media Control Functions
function toggleCamera() {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isCameraOn = !isCameraOn;
        videoTrack.enabled = isCameraOn;
        cameraBtn.innerHTML = isCameraOn ? 
            '<i class="fas fa-video"></i>' : 
            '<i class="fas fa-video-slash"></i>';
    }
}

function toggleMic() {
    const audioTrack = localStream.getAudioTracks()[0];
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
            // No one waiting, add self to waiting list
            await set(waitingRef, {
                uid: currentUser.uid,
                timestamp: serverTimestamp(),
            });
            waitForPeer();
        } else {
            // Connect with waiting user
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

    // Add local stream
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            const connectionRef = ref(database, `connections/${peerId}`);
            set(connectionRef, {
                type: "candidate",
                candidate: event.candidate,
            });
        }
    };

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Create and send offer
    peerConnection
        .createOffer()
        .then((offer) => peerConnection.setLocalDescription(offer))
        .then(() => {
            const connectionRef = ref(database, `connections/${peerId}`);
            set(connectionRef, {
                type: "offer",
                offer: peerConnection.localDescription,
            });
        });

    // Listen for answer and ICE candidates
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

// Handle Next Button
async function handleNext() {
    stopMediaStream();
    await setupMediaStream();
    findPeer();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    stopMediaStream();
    if (currentUser) {
        const waitingRef = ref(database, "waiting");
        set(waitingRef, null);
    }
});
