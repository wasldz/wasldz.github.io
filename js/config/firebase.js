// ============================================
// 🔥 إعداد Firebase
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyA-rNHBXHMRLS-0mF2529IbsNpRR9hf6Yc",
    authDomain: "faresmerrah.firebaseapp.com",
    databaseURL: "https://faresmerrah-default-rtdb.firebaseio.com",
    projectId: "faresmerrah",
    storageBucket: "faresmerrah.firebasestorage.app",
    messagingSenderId: "589540782949",
    appId: "1:589540782949:web:916186c0587f2b4a2c678c"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();
