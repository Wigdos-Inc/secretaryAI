// Centralized authentication helpers (client-side)
import { auth, db } from "./firebaseInit.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Sign in with email/password and return the user object
export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Register a new user, create a profile document and send email verification
export async function register(fullName, company, email, password) {
  const [firstname, ...rest] = (fullName || '').trim().split(' ');
  const lastname = rest.join(' ');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await setDoc(doc(db, 'Users', uid), {
    email,
    firstname: firstname || '',
    lastname: lastname || '',
    company: company || '',
    payplan: 0,
    createdAt: serverTimestamp()
  });
  try { await sendEmailVerification(cred.user); } catch (e) { /* non-blocking */ }
  return cred.user;
}

export async function signOut() {
  return await fbSignOut(auth);
}

export async function sendResetEmail(email) {
  return await sendPasswordResetEmail(auth, email);
}

export async function getProfile(uid) {
  const d = await getDoc(doc(db, 'Users', uid));
  return d.exists() ? d.data() : null;
}

export async function updateProfile(uid, data) {
  const ref = doc(db, 'Users', uid);
  await updateDoc(ref, data);
  const d = await getDoc(ref);
  return d.exists() ? d.data() : null;
}

// Start auth listener and update localStorage; optional callback receives (user, profile|null)
export function startAuthListener(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
        const profile = await getProfile(user.uid);
        if (profile) {
          const profileWithUid = Object.assign({}, profile, { uid: user.uid });
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userData', JSON.stringify(profileWithUid));
        } else {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userData');
      }
        if (typeof callback === 'function') callback(user, profile ? Object.assign({}, profile, { uid: user.uid }) : null);
    } else {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userData');
      if (typeof callback === 'function') callback(null, null);
    }
  });
}

export default {
  signIn,
  register,
  signOut,
  sendResetEmail,
  getProfile,
  updateProfile,
  startAuthListener
};
