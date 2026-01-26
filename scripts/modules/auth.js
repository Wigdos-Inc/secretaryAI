(function () {
    // Lightweight auth wrapper that exposes window.auth
    if (!window.firebase) {
        console.error('Firebase SDK not loaded. Make sure /__/firebase/init.js is available when hosted.');
        window.auth = {
            register: async () => { throw new Error('Firebase not initialized'); },
            login: async () => { throw new Error('Firebase not initialized'); },
            logout: async () => { throw new Error('Firebase not initialized'); },
            getProfile: async () => null,
            onAuthStateChanged: (cb) => { /* noop */ }
        };
        return;
    }

    const _auth = firebase.auth();
    const _db = firebase.firestore();

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

    // Keep localStorage in sync with Firebase Auth
    _auth.onAuthStateChanged(async (user) => {
        if (!user) {
            writeLocalUser(null);
            return;
        }

        try {
            const doc = await _db.collection('Users').doc(user.uid).get();
            const data = doc.exists ? doc.data() : null;
            const profile = data ? Object.assign({}, data) : { uid: user.uid, name: user.displayName || '', email: user.email || '' };
            // ensure uid present
            profile.uid = user.uid;
            writeLocalUser(profile);
        } catch (err) {
            console.error('Error fetching user profile:', err);
            writeLocalUser({ uid: user.uid, name: user.displayName || '', email: user.email || '' });
        }
    });

    window.auth = {
        register: async (name, company, email, password) => {
            const userCred = await _auth.createUserWithEmailAndPassword(email, password);
            const user = userCred.user;

            // split name into firstname / lastname
            const parts = (name || '').trim().split(/\s+/);
            const firstname = parts.length ? parts[0] : '';
            const lastname = parts.length > 1 ? parts.slice(1).join(' ') : '';

            // Save profile to Firestore under 'Users' (match existing collection)
            await _db.collection('Users').doc(user.uid).set({
                firstname: firstname,
                lastname: lastname,
                company: company || '',
                email: email,
                admin: false,
                payplan: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update displayName for convenience
            if (user.updateProfile) {
                try { await user.updateProfile({ displayName: name || '' }); } catch (e) { /* ignore */ }
            }
            // localStorage will be set by onAuthStateChanged
            return user;
        },

        login: async (email, password) => {
            const userCred = await _auth.signInWithEmailAndPassword(email, password);
            return userCred.user;
        },

        logout: async () => {
            await _auth.signOut();
            // localStorage will be cleared by onAuthStateChanged
        },

        getProfile: async () => {
            const user = _auth.currentUser;
            if (!user) return null;
            const doc = await _db.collection('Users').doc(user.uid).get();
            return doc.exists ? doc.data() : null;
        },

        onAuthStateChanged: (cb) => _auth.onAuthStateChanged(cb)
    };
})();