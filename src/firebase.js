import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase Web settings are public identifiers, not administrator credentials.
const firebaseConfig = {
  apiKey: 'AIzaSyCeWdUc_X7jLbQ99LV4xr-5hFCST0uA87c',
  authDomain: 'nexus-knowledge-library-63b9f.firebaseapp.com',
  projectId: 'nexus-knowledge-library-63b9f',
  storageBucket: 'nexus-knowledge-library-63b9f.firebasestorage.app',
  messagingSenderId: '423357224409',
  appId: '1:423357224409:web:8bf5bbbe497ab1dae9b5c8',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
