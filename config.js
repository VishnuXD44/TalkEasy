import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFYoiwOS_2zZdYNso-AFvoRb3KunkvLaQ",
    authDomain: "talkeasy-42018.firebaseapp.com",
    projectId: "talkeasy-42018",
    storageBucket: "talkeasy-42018.firebasestorage.app",
    messagingSenderId: "282650585585",
    appId: "1:282650585585:web:39b9cf4dc9fbbae6e07c50",
    measurementId: "G-QPXSXVHNNC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const provider = new GoogleAuthProvider();

export { auth, database, provider };
