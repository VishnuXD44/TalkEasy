import { auth, provider } from './config.js';
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";

// DOM Elements
const loginBtn = document.getElementById('login-btn');

// Authentication Functions
async function handleLogin() {
    try {
        console.log("Login attempt starting...");
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login error:", error);
        alert(`Login failed: ${error.message}`);
    }
}

// Event Listeners
if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
}

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = 'chat.html';
    }
});
