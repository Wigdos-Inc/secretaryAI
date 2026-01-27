import { startAuthListener, signOut } from './modules/auth.js';

// Expose a global logout handler used by UI
window.handleLogout = async function () {
  try {
    await signOut();
  } catch (e) {
    console.error('Logout failed', e);
  }
};
// Note: UI modules should call `startAuthListener(callback)` to initialize and
// react to auth state changes. We avoid automatically starting multiple
// listeners here to prevent duplicate handlers.
