(function () {
    // Local Firebase init for running the app without Firebase Hosting auto-generated /__/ files.
    // Replace the firebaseConfig object below with your project's values from the Firebase console.
    // If you want to connect to local emulators, append ?useEmulator=true to the URL.

    if (!window.firebase) {
        console.error('Firebase SDK not loaded (firebase-app-compat.js must be loaded before init).');
        return;
    }

    if (firebase.apps && firebase.apps.length) {
        // already initialized
        window.firebaseApp = firebase.app();
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSyBhL_F2rTYYGdoDfIHMx92Y4bs01BnO6mw",
        authDomain: "harvey-ai-consulting.firebaseapp.com",
        projectId: "harvey-ai-consulting",
        storageBucket: "harvey-ai-consulting.firebasestorage.app",
        messagingSenderId: "730850805772",
        appId: "1:730850805772:web:83233e50315192c5b8c629"
      };

    if (typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey.startsWith('<')) {
        console.warn('firebase/init.js: placeholder config detected. Replace firebaseConfig with real values or run Firebase Hosting which will provide /__/firebase/init.js automatically.');
    }

    try {
        window.firebaseApp = firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized (local init)');
    } catch (e) {
        console.error('Error initializing Firebase:', e);
        return;
    }

    // Optionally connect to emulators when ?useEmulator=true is present on the page URL
    // or on this script's own src query string (e.g. <script src="firebase/init.js?useEmulator=true"></script>)
    (function () {
        function scriptUseEmulator() {
            try {
                // check page URL first
                const pageParams = new URLSearchParams(location.search);
                if (pageParams.get('useEmulator') === 'true') return true;

                // fallback: inspect the script tag that loaded this file
                // document.currentScript is preferred, but fall back to searching scripts
                let scriptSrc = (document.currentScript && document.currentScript.src) || '';
                if (!scriptSrc) {
                    const scripts = document.getElementsByTagName('script');
                    for (let i = scripts.length - 1; i >= 0; i--) {
                        const s = scripts[i];
                        if (s.src && s.src.indexOf('firebase/init.js') !== -1) {
                            scriptSrc = s.src; break;
                        }
                    }
                }
                if (scriptSrc) {
                    const url = new URL(scriptSrc, location.href);
                    return url.searchParams.get('useEmulator') === 'true';
                }
            } catch (e) {
                // ignore
            }
            return false;
        }

        if (scriptUseEmulator()) {
            try {
                firebase.auth().useEmulator('http://localhost:9099');
            } catch (e) { /* ignore if not available */ }
            try {
                firebase.firestore().useEmulator('localhost', 8080);
            } catch (e) { /* ignore if not available */ }
            console.log('Connected Firebase SDK to local emulators (auth:9099, firestore:8080)');
        }
    })();

})();