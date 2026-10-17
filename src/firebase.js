
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyA2Z6PUfJaPANXPuzmRRRRKeyjXQwbBFjk",
    authDomain: "hudumaconnect-8e2a5.firebaseapp.com",
    projectId: "hudumaconnect-8e2a5",
    storageBucket: "hudumaconnect-8e2a5.firebasestorage.app",
    messagingSenderId: "339568937163",
    appId: "1:339568937163:web:4fd489fad2defee2fef34e",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
