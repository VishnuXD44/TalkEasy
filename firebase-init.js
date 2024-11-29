// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// Fetch environment variables from server
const response = await fetch('/env-config');
const env = await response.json();

// Configure Firebase using env variables
const firebaseConfig = {
    apiKey: env.FIREBASE_API_KEY,
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    databaseURL: env.FIREBASE_DATABASE_URL, // Add this line
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
    appId: env.FIREBASE_APP_ID,
    measurementId: env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Prevent document.write warning
window.XMLHttpRequest.prototype.send = new Proxy(window.XMLHttpRequest.prototype.send, {
    apply: (target, thisArg, argumentsList) => {
        thisArg.withCredentials = true;
        return Reflect.apply(target, thisArg, argumentsList);
    }
});

export { auth, database };
