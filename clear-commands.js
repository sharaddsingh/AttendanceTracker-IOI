/*
==================================================
FIREBASE DATA CLEARING COMMANDS
==================================================
Run these in browser console on your attendance app page
to quickly clear local data and sign out
==================================================
*/

// 1. Sign out current user
if (auth && auth.currentUser) {
    auth.signOut().then(() => {
        console.log('✅ User signed out successfully');
    }).catch(error => {
        console.error('❌ Sign out error:', error);
    });
} else {
    console.log('✅ No user currently signed in');
}

// 2. Clear local storage
const localItems = Object.keys(localStorage);
localStorage.clear();
console.log(`✅ Local storage cleared (${localItems.length} items removed)`);

// 3. Clear session storage  
const sessionItems = Object.keys(sessionStorage);
sessionStorage.clear();
console.log(`✅ Session storage cleared (${sessionItems.length} items removed)`);

// 4. Check current device ID (for debugging)
if (typeof generateDeviceId === 'function') {
    const currentDeviceId = generateDeviceId();
    console.log('📱 Current Device ID:', currentDeviceId);
} else {
    console.log('❌ Device ID functions not available');
}

// 5. Refresh page to complete reset
setTimeout(() => {
    console.log('🔄 Refreshing page in 2 seconds...');
    window.location.reload();
}, 2000);

console.log('🗑️ Local data clearing complete!');
console.log('⚠️  Don\'t forget to manually clear Firebase Authentication and Firestore collections in Firebase Console');
