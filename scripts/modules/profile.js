import { getProfile, updateProfile, sendResetEmail } from './auth.js';

// Populate profile page fields and wire buttons
export async function initProfilePage() {
  try {
    const raw = localStorage.getItem('userData');
    const profile = raw ? JSON.parse(raw) : null;
    if (!profile) return;

    const nameEl = document.getElementById('name');
    const emailEl = document.getElementById('email');
    if (nameEl) nameEl.textContent = `${profile.firstname || ''} ${profile.lastname || ''}`.trim() || profile.email || 'User';
    if (emailEl) emailEl.textContent = profile.email || '';

    // New fields
    const phoneEl = document.getElementById('phone');
    const memberSinceEl = document.getElementById('memberSince');
    const accountTypeEl = document.getElementById('accountType');
    const savedPropsEl = document.getElementById('savedProperties');

    if (phoneEl) phoneEl.textContent = profile.phone || profile.phoneNumber || '—';
    if (memberSinceEl) {
      const created = profile.createdAt || profile.memberSince || null;
      // created may be a Firestore timestamp object; handle common formats
      let label = '—';
      if (created && typeof created === 'object' && created.toDate) label = created.toDate().toLocaleDateString();
      else if (typeof created === 'string') label = created;
      else if (typeof created === 'number') label = new Date(created).toLocaleDateString();
      memberSinceEl.textContent = label;
    }
    if (accountTypeEl) accountTypeEl.textContent = profile.payplanName || profile.accountType || (profile.payplan === 0 ? 'Free' : 'Premium');
    if (savedPropsEl) {
      const sp = profile.savedProperties || profile.saved_props || [];
      const count = Array.isArray(sp) ? sp.length : (typeof sp === 'number' ? sp : 0);
      savedPropsEl.textContent = `${count} Properties`;
    }

    // Wire buttons
    const editBtn = document.getElementById('editProfileBtn');
    const changePwdBtn = document.getElementById('changePasswordBtn');
    const deleteBtn = document.getElementById('deleteAccountBtn');

    if (editBtn) {
      editBtn.addEventListener('click', async () => {
        const newFirst = prompt('First name', profile.firstname || '') || profile.firstname || '';
        const newLast = prompt('Last name', profile.lastname || '') || profile.lastname || '';
        const newCompany = prompt('Company', profile.company || '') || profile.company || '';
        const newPhone = prompt('Phone number', profile.phone || profile.phoneNumber || '') || profile.phone || '';
        const newAccountType = prompt('Account type (Free/Premium)', profile.accountType || profile.payplanName || (profile.payplan === 0 ? 'Free' : 'Premium')) || profile.accountType || '';
        const uid = profile.uid || profile.id || '';
        const updated = await updateProfile(uid, {
          firstname: newFirst,
          lastname: newLast,
          company: newCompany,
          phone: newPhone,
          accountType: newAccountType
        });
        if (updated) {
          const updatedWithUid = Object.assign({}, updated, { uid });
          localStorage.setItem('userData', JSON.stringify(updatedWithUid));
          alert('Profile updated');
          location.reload();
        }
      });
    }

    if (changePwdBtn) {
      changePwdBtn.addEventListener('click', async () => {
        if (!profile || !profile.email) return alert('No email available');
        try {
          await sendResetEmail(profile.email);
          alert('Password reset email sent to ' + profile.email);
        } catch (e) {
          alert('Failed to send reset email: ' + (e.message || e));
        }
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        alert('Account deletion must be performed after re-authentication. Please contact support or implement re-auth flow.');
      });
    }

    const clearSavedBtn = document.getElementById('clearSavedBtn');
    if (clearSavedBtn) {
      clearSavedBtn.addEventListener('click', async () => {
        if (!confirm('Clear all saved properties for your account? This cannot be undone.')) return;
        const uid = profile.uid || profile.id || '';
        try {
          const updated = await updateProfile(uid, { savedProperties: [] });
          if (updated) {
            const updatedWithUid = Object.assign({}, updated, { uid });
            localStorage.setItem('userData', JSON.stringify(updatedWithUid));
            alert('Saved properties cleared');
            location.reload();
          }
        } catch (e) {
          alert('Failed to clear saved properties: ' + (e.message || e));
        }
      });
    }
  } catch (e) {
    console.error('Init profile page error', e);
  }
}

// Auto-init when loaded as module into page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}
