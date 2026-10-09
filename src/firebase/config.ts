// Firebase web config is public by design; access is guarded by firestore.rules.
// Values from Firebase console → Project settings → Your apps → Web app.
const realConfig = {
  apiKey: 'AIzaSyDONojmq7NByuGqo0S9p405PsqcY4CENZw',
  authDomain: 'responsible-2gether.firebaseapp.com',
  projectId: 'responsible-2gether',
  storageBucket: 'responsible-2gether.firebasestorage.app',
  messagingSenderId: '906990515761',
  appId: '1:906990515761:web:0f2257c0b010d3593b4710',
};

export const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

export const firebaseConfig = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'demo-r2g.firebaseapp.com', projectId: 'demo-r2g', appId: 'demo-app' }
  : realConfig;

export const isConfigured = useEmulator || realConfig.apiKey !== 'REPLACE_ME';
