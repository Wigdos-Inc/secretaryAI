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

    document.getElementById('achternaam').value = profile.lastname;
    document.getElementById('voornaam').value = profile.firstname;

    // New fields
    const phoneEl = document.getElementById('phone');
    const memberSinceEl = document.getElementById('memberSince');

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
    // accountType and savedProperties removed

    // Wire buttons
    const editBtn = document.getElementById('editProfileBtn');
    const changePwdBtn = document.getElementById('changePasswordBtn');
    const deleteBtn = document.getElementById('deleteAccountBtn');

    const popup_account_info = document.getElementById('popup_account_info');
    const popup_background = document.getElementById('popup_background');
    const popup_account_info_done = document.getElementById('popup_account_info_done');

    // Check if Done button on popup is pressed
    if (popup_account_info_done) {
      popup_account_info_done.addEventListener('click', async () => {
        popup_account_info.style.display = 'none';
        popup_background.style.display = 'none';

        const account_info_form = document.getElementById('account_info_form');
        const form_data = new FormData(account_info_form);
        const data = Object.fromEntries(form_data.entries());

        //const newFirst = prompt('First name', profile.firstname || '') || profile.firstname || '';
        //const newLast = prompt('Last name', profile.lastname || '') || profile.lastname || '';
        //const newPhone = prompt('Phone number', profile.phone || profile.phoneNumber || '') || profile.phone || '';

        const newFirst = data.voornaam;
        const newLast = data.achternaam;
        const newPhone = data.phoneNum;
        
        const uid = profile.uid || profile.id || '';
        const updated = await updateProfile(uid, {
          firstname: newFirst,
          lastname: newLast,
          phone: newPhone
        });
        if (updated) {
          const updatedWithUid = Object.assign({}, updated, { uid });
          localStorage.setItem('userData', JSON.stringify(updatedWithUid));
          alert('Profile updated');
          location.reload();
        }
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', async () => {
        popup_account_info.style.display = 'block';
        popup_background.style.display = 'block';
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

    // savedProperties removed — no clear button
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
