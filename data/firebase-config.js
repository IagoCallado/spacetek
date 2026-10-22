/* Configuracao publica do Firebase (projeto SpaceTek).
   Estes dados sao publicos por design (vao no cliente).
   Nao coloque aqui chaves privadas / serviceAccount. */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCXpR-KHkx-Pwd1whMVvPqbfaiVNELMFG8",
  authDomain: "spacetek-3bf38.firebaseapp.com",
  projectId: "spacetek-3bf38",
  storageBucket: "spacetek-3bf38.firebasestorage.app",
  messagingSenderId: "95411066854",
  appId: "1:95411066854:web:304f509bde726c2e96a827"
};

(function () {
  if (typeof firebase === "undefined") return;
  try {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    window.fbDb = firebase.firestore();
  } catch (e) {
    console.warn("Falha ao inicializar o Firebase:", e);
    return;
  }
  /* O SDK de Auth so e carregado na pagina do painel (admin/index.html).
     No site publico nao ha login: por isso o fbAuth e opcional. */
  try {
    if (typeof firebase.auth === "function") window.fbAuth = firebase.auth();
  } catch (e) {
    console.warn("Firebase Auth indisponivel:", e);
  }
})();
