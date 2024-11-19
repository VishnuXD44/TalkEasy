// Import required modules from Firebase
import { auth, database } from "./config.js";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { ref, set, get, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// Global variables
let localStream;
let peerConnection;
let currentUser;

const configuration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
    ],
};

// DOM Elements
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const nextBtn = document.getElementById("next-btn");
const authContainer = document.getElementById("auth-container");
const chatContainer = document.getElementById("chat-container");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");

// Login button event listener
loginBtn.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        console.log("User signed in successfully");
    } catch (error) {
        console.error("Error during sign-in:", error);
    }
});

// Logout button event listener
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        console.log("User signed out successfully");
    } catch (error) {
        console.error("Error during sign-out:", error);
    }
});

// Auth state change listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("User logged in:", user);

        // Show chat container, hide auth container
        authContainer.classList.add("hidden");
        chatContainer.classList.remove("hidden");

        // Set up media stream and find peer
        await setupMediaStream();
        findPeer();
    } else {
        currentUser = null;
        console.log("User logged out");

        // Show auth container, hide chat container
        authContainer.classList.remove("hidden");
        chatContainer.classList.add("hidden");

        stopMediaStream();
    }
});

// Set up local media stream
async function setupMediaStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error("Error accessing media devices:", error);
    }
}

// Stop media stream
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

// Find a peer to connect with
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

// Wait for peer to connect
function waitForPeer() {
    const waitingRef = ref(database, "waiting");
    onValue(waitingRef, (snapshot) => {
        const waitingUser = snapshot.val();
        if (waitingUser && waitingUser.uid !== currentUser.uid) {
            initiatePeerConnection(waitingUser.uid);
        }
    });
}

// Initialize WebRTC peer connection
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
        if (data.type === "answer") {
            peerConnection.setRemoteDescription(
                new RTCSessionDescription(data.answer)
            );
        } else if (data.type === "candidate") {
            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    });
}

// Handle "Next" button click
nextBtn.addEventListener("click", () => {
    stopMediaStream();
    setupMediaStream().then(() => findPeer());
});
