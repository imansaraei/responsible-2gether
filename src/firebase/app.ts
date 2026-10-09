import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, useEmulator } from './config';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let signIn: Promise<void> | undefined;

function init() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export function getDb(): Firestore {
  init();
  return db!;
}

export function ensureSignedIn(): Promise<void> {
  init();
  signIn ??= (auth!.currentUser ? Promise.resolve() : signInAnonymously(auth!).then(() => undefined))
    .catch((e) => {
      signIn = undefined;
      throw e;
    });
  return signIn;
}
