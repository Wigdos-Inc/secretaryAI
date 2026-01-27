// Handles registration with Firebase Auth and Firestore profile creation
import * as authLib from "./auth.js";

window.handleRegister = async function (event) {
  if (event && event.preventDefault) event.preventDefault();
  const name = (document.getElementById('registerName') || {}).value || '';
  const phone = (document.getElementById('registerPhone') || {}).value || '';
  const email = (document.getElementById('registerEmail') || {}).value || '';
  const password = (document.getElementById('registerPassword') || {}).value || '';
  const passwordConfirm = (document.getElementById('registerPasswordConfirm') || {}).value || '';

  if (password !== passwordConfirm) return alert('Passwords do not match.');
  if (!name || !email || !password) return alert('Please fill in all required fields.');

  try {
    const user = await authLib.register(name, '', email, password, phone);
    alert('Account created! A verification email was sent.');
    window.location.hash = '#login';
  } catch (error) {
    alert('Registration failed: ' + (error && error.message ? error.message : error));
  }
};

// Try to bind immediately (useful when injected dynamically). Also bind on DOMContentLoaded as fallback.
function bindRegisterForm() {
  const form = document.getElementById('registerForm');
  if (form) form.addEventListener('submit', window.handleRegister);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindRegisterForm);
} else {
  bindRegisterForm();
}
