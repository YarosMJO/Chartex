// Firebase конфігурація для Chrome розширення
const firebaseConfig = {
  apiKey: "AIzaSyAeWPZOm7CXCslgyn63ScMBcGK_wg8tUNA",
  authDomain: "chartex-2eae7.firebaseapp.com",
  projectId: "chartex-2eae7",
  storageBucket: "chartex-2eae7.firebasestorage.app",
  messagingSenderId: "264979508048",
  appId: "1:264979508048:web:c9501813cf613160a5da55",
  measurementId: "G-PGGLE2T3TD"
};

// Експорт для використання в інших файлах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
} else if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
} 