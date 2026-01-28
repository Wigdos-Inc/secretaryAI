/**
 * @module scripts/modules/db.js
 *
 * Firestore helper module.
 *
 * Goal: provide small, reusable helpers to read/write/update documents and add
 * documents to (nested) collections from any page.
 *
 * Top-level collections in this app:
 * - Users
 * - Sellers
 * Nested collections:
 * - Users/{uid}/chats
 */

import { db } from "./firebaseInit.js";
import {
	doc,
	collection,
	getDoc,
	setDoc,
	addDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export const COLLECTIONS = Object.freeze({
	USERS: "Users",
	SELLERS: "Sellers",
	USER_CHATS: "chats",
});

// Build a safe Firestore path from segments.
// Example: pathFrom(COLLECTIONS.USERS, uid, COLLECTIONS.USER_CHATS)
function pathFrom(...segments) {
	return segments
		.flat()
		.filter((s) => s !== undefined && s !== null)
		.map((s) => String(s).trim())
		.filter(Boolean)
		.join("/");
}

// Returns a DocumentReference from a path string or path segments.
function dbDocRef(pathOrSegments, ...moreSegments) {
	const path = Array.isArray(pathOrSegments)
		? pathFrom(...pathOrSegments)
		: moreSegments.length
			? pathFrom(pathOrSegments, ...moreSegments)
			: String(pathOrSegments);
	return doc(db, path);
}

// Returns a CollectionReference from a path string or path segments.
function dbColRef(pathOrSegments, ...moreSegments) {
	const path = Array.isArray(pathOrSegments)
		? pathFrom(...pathOrSegments)
		: moreSegments.length
			? pathFrom(pathOrSegments, ...moreSegments)
			: String(pathOrSegments);
	return collection(db, path);
}

function logDbUsed(op, pathOrSegments, ...moreSegments) {
	const path = Array.isArray(pathOrSegments)
		? pathFrom(...pathOrSegments)
		: moreSegments.length
			? pathFrom(pathOrSegments, ...moreSegments)
			: String(pathOrSegments);
	console.log("DB Used", { op, path });
}

/**
 * Read a document.
 * @param {string|string[]} pathOrSegments Firestore doc path e.g. "Users/{uid}" or ["Users", uid]
 * @returns {Promise<object|null>}
 */
export async function dbGetDoc(pathOrSegments, ...moreSegments) {
	logDbUsed("getDoc", pathOrSegments, ...moreSegments);
	const snap = await getDoc(dbDocRef(pathOrSegments, ...moreSegments));
	return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Create/overwrite a document.
 *
 * Note: Firestore supports writing to nested collection docs via a full doc path,
 * e.g. dbSetDoc(["Users", uid, "chats", chatId], {...}).
 *
 * @param {string|string[]} pathOrSegments Firestore doc path
 * @param {object} data Data to write
 * @param {{merge?: boolean}} [options]
 */
export async function dbSetDoc(pathOrSegments, data, options = { merge: false }) {
	logDbUsed("setDoc", pathOrSegments);
	return setDoc(dbDocRef(pathOrSegments), data, options);
}

/**
 * Add a new document to a collection (supports nested collections).
 * Use this when you want Firestore to auto-generate an id.
 *
 * Example: dbAddDoc(["Users", uid, "chats"], { ... })
 */
export async function dbAddDoc(pathOrSegments, data, ...moreSegments) {
	logDbUsed("addDoc", pathOrSegments, ...moreSegments);
	const colRef = dbColRef(pathOrSegments, ...moreSegments);
	return addDoc(colRef, data);
}

// --- Backward compatible wrappers (keep existing call sites working) ---

// Write/update user profile (merge)
export async function dbWrite(uid, profileData) {
	// keep merge behavior for safety when callers pass partial user objects
	return dbSetDoc([COLLECTIONS.USERS, uid], profileData, { merge: true });
}

// Read user profile
export async function dbRead(uid) {
	const data = await dbGetDoc([COLLECTIONS.USERS, uid]);
	// return just the document data (legacy behavior)
	if (!data) return null;
	const { id, ...rest } = data;
	return rest;
}