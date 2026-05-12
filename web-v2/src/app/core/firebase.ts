import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function ensure(): void {
  if (_app) return;
  _app = initializeApp(environment.firebase);
  _auth = getAuth(_app);
  _db = getFirestore(_app);
}

export function fbApp(): FirebaseApp { ensure(); return _app!; }
export function fbAuth(): Auth { ensure(); return _auth!; }
export function fbDb(): Firestore { ensure(); return _db!; }
