// Handles login with Firebase Auth and loads user profile from Firestore
import * as authLib from "./auth.js";

window.handleLogin = async function (event) {
  if (event && event.preventDefault) event.preventDefault();
  const emailEl = document.getElementById('loginEmail');
  const passwordEl = document.getElementById('loginPassword');
  const email = emailEl ? emailEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';
  if (!email || !password) return alert('Please enter both email and password.');
  try {
    const user = await authLib.signIn(email, password);
    const profile = await authLib.getProfile(user.uid);
    if (profile) {
      // rely on auth listener to update UI; also set storage immediately for responsiveness
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userData', JSON.stringify(profile));
      window.location.hash = '#chatbox';
    } else {
      alert('Profile not found.');
    }
  } catch (error) {
    alert('Login failed: ' + (error && error.message ? error.message : error));
  }
};

// Try to bind immediately (useful when injected dynamically). Also bind on DOMContentLoaded as fallback.
function bindLoginForm() {
  const form = document.getElementById('loginForm');
  if (form) form.addEventListener('submit', window.handleLogin);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindLoginForm);
} else {
  bindLoginForm();
}
