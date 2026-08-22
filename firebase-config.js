// firebase-config.js

// 1. Aquí guardamos las llaves una sola vez
const firebaseConfig = {
        apiKey: "AIzaSyCDCilOCoyFf4E3hqKLudI5j8anSi2jV9k",
        authDomain: "appadultosmayores-71aac.firebaseapp.com",
        projectId: "appadultosmayores-71aac",
        storageBucket: "appadultosmayores-71aac.firebasestorage.app",
        messagingSenderId: "636027771154",
        appId: "1:636027771154:web:513f37aff52e78f69d3bcb"
};

// 2. Inicializamos Firebase
firebase.initializeApp(firebaseConfig);

// 3. Dejamos listas las herramientas para que los otros archivos las usen
const db = firebase.firestore();
const auth = firebase.auth();

// Variable global para saber quién está usando la app
let usuarioActual = null;