// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// Firebase configuration object
const firebaseConfig = {
 apiKey: "AIzaSyCFYoiwOS_2zZdYNso-AFvoRb3KunkvLaQ",
 authDomain: "talkeasy-42018.firebaseapp.com",
 projectId: "talkeasy-42018",
 storageBucket: "talkeasy-42018.firebasestorage.app",
 messagingSenderId: "282650585585",
 appId: "1:282650585585:web:39b9cf4dc9fbbae6e07c50",
 measurementId: "G-QPXSXVHNNC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Database instances
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database };
