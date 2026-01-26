(function () {
    // Firestore-backed auth (client-side). WARNING: this loosens security compared to Firebase Auth.
    // It stores salted PBKDF2 password hashes in Firestore and performs verification in the client.
    // This is suitable for prototyping only. For production, handle auth server-side or use Firebase Auth.

    if (!window.firebase) {
        console.error('Firebase SDK not loaded. Firestore-based auth requires firebase.firestore()');
        window.auth = {
            register: async () => { throw new Error('Firebase not initialized'); },
            login: async () => { throw new Error('Firebase not initialized'); },
            logout: async () => { throw new Error('Firebase not initialized'); },
            getProfile: async () => null,
            onAuthStateChanged: (cb) => { /* noop */ }
        };
        return;
    }

    const _db = firebase.firestore();
    let _currentUser = null; // in-memory profile
    const _listeners = new Set();

    function toBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function fromBase64(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    async function derivePasswordHash(password, saltB64, iterations = 100000) {
        const enc = new TextEncoder();
        const pwKey = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        const salt = fromBase64(saltB64);
        const derived = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
            pwKey,
            256
        );
        return toBase64(derived);
    }

    function generateSalt(length = 16) {
        const arr = new Uint8Array(length);
        crypto.getRandomValues(arr);
        return toBase64(arr.buffer);
    }

    function writeLocalUser(profile) {
        if (profile) {
            const nameFromParts = (profile.firstname || profile.name || '') + (profile.lastname ? (' ' + profile.lastname) : '');
            const userData = {
                uid: profile.uid,
                name: profile.name || profile.displayName || nameFromParts || '',
                email: profile.email || '',
                company: profile.company || profile.companyName || ''
            };
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(userData));
        } else {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userData');
        }
    }

    function emitAuthState(user) {
        _currentUser = user;
        writeLocalUser(user);
        for (const cb of _listeners) {
            try { cb(user); } catch (e) { console.error('auth listener error', e); }
        }
    }

    async function register(name, company, email, password) {
        email = (email || '').toLowerCase().trim();
        if (!email || !password) throw new Error('Email and password required');

        // Check existing email
        const q = await _db.collection('Users').where('email', '==', email).limit(1).get();
        if (!q.empty) throw new Error('Email already in use');

        const salt = generateSalt(16);
        const hash = await derivePasswordHash(password, salt);

        // create a user document with a generated uid (doc id)
        const docRef = _db.collection('Users').doc();
        const uid = docRef.id;
        const parts = (name || '').trim().split(/\s+/);
        const firstname = parts.length ? parts[0] : '';
        const lastname = parts.length > 1 ? parts.slice(1).join(' ') : '';

        const profileDoc = {
            uid: uid,
            email: email,
            displayName: name || '',
            firstname: firstname,
            lastname: lastname,
            company: company || '',
            admin: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            // auth fields (stored as base64 strings)
            passwordSalt: salt,
            passwordHash: hash
        };

        await docRef.set(profileDoc);

        const publicProfile = Object.assign({}, profileDoc);
        delete publicProfile.passwordSalt;
        delete publicProfile.passwordHash;

        emitAuthState(publicProfile);
        return publicProfile;
    }

    async function login(email, password) {
        email = (email || '').toLowerCase().trim();
        if (!email || !password) throw new Error('Email and password required');

        const q = await _db.collection('Users').where('email', '==', email).limit(1).get();
        if (q.empty) throw new Error('User not found');
        const doc = q.docs[0];
        const data = doc.data();

        if (!data.passwordSalt || !data.passwordHash) throw new Error('Account does not support password login');

        const derived = await derivePasswordHash(password, data.passwordSalt);
        const match = derived === data.passwordHash;
        if (!match) throw new Error('Invalid credentials');

        const publicProfile = Object.assign({}, data);
        delete publicProfile.passwordSalt;
        delete publicProfile.passwordHash;

        emitAuthState(publicProfile);
        return publicProfile;
    }

    async function logout() {
        emitAuthState(null);
    }

    async function getProfile() {
        if (!_currentUser) return null;
        try {
            const doc = await _db.collection('Users').doc(_currentUser.uid).get();
            if (!doc.exists) return null;
            const data = doc.data();
            const publicProfile = Object.assign({}, data);
            delete publicProfile.passwordSalt;
            delete publicProfile.passwordHash;
            return publicProfile;
        } catch (e) {
            console.error('Error fetching profile', e);
            return null;
        }
    }

    function onAuthStateChanged(cb) {
        if (typeof cb !== 'function') return () => {};
        _listeners.add(cb);
        // invoke immediately with current state (from localStorage if present)
        if (_currentUser) cb(_currentUser);
        else {
            const raw = localStorage.getItem('userData');
            if (raw) {
                try { const parsed = JSON.parse(raw); cb(parsed); } catch (e) { /* ignore */ }
            }
        }
        return () => _listeners.delete(cb);
    }

    // expose API
    window.auth = {
        register,
        login,
        logout,
        getProfile,
        onAuthStateChanged
    };

})();