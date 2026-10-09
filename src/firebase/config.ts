// Firebase web config is public by design; access is guarded by firestore.rules.
// Replace with the values from Firebase console → Project settings → Your apps → Web app.
const realConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

export const firebaseConfig = useEmulator
  ? { apiKey: 'demo-key', authDomain: 'demo-r2g.firebaseapp.com', projectId: 'demo-r2g', appId: 'demo-app' }
  : realConfig;

export const isConfigured = useEmulator || realConfig.apiKey !== 'REPLACE_ME';
