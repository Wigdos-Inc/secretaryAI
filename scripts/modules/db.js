/**
 * @module scripts/modules/db.js
 * 
 * Module for all DB Interactions
 * 
 * ES6 Module Usage:
 * - Export: Add "export" before function/class declarations
 * - Import: import { functionName } from "../modules/db.js";
 * - HTML: Add type="module" to <script> tag
 */


import { db } from "./firebaseInit.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Collect all users (admin only, not for client use)
export async function dbCollect() {
	// Placeholder: implement admin-only logic if needed
}

// Sort data utility (not implemented)
function dbDataSort() {}

// Write/update user profile
export async function dbWrite(uid, profileData) {
	// profileData: {firstname, lastname, company, ...}
	return await setDoc(doc(db, 'Users', uid), profileData, { merge: true });
}

// Read user profile
export async function dbRead(uid) {
	const profileDoc = await getDoc(doc(db, 'Users', uid));
	return profileDoc.exists() ? profileDoc.data() : null;
}