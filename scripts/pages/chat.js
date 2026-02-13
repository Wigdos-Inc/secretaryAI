// Import DB & AI

import { prompt, aiTemplates } from "../modules/ai.js";
import * as DB from "../modules/db.js";



// Get User ID and Chat ID
const uid = JSON.parse(localStorage.getItem("userData"))?.uid ?? null;
let cid = new URLSearchParams(window.location.search).get("cid") ?? null;

// Prep DB Interaction
const dbPath = {
    l: () => [
        DB.COLLECTIONS.USERS,
        uid,
        DB.COLLECTIONS.USER_CHATS,
        cid
    ],
    s: () => [
        DB.COLLECTIONS.USERS,
        uid,
        DB.COLLECTIONS.USER_CHATS
    ]
}

// Get Chat Data
let chatData = (uid && cid) ? JSON.parse(localStorage.getItem(`chat_${cid}`)) ?? await DB.dbGetDoc(dbPath.l()) ?? null : null;



// Store & Create Page Elements
const e = {
    chatBox: document.getElementById("chatBox"),
    input: {
        field: document.getElementById("chatInput"),
        form : document.getElementById("promptForm"),
    },

    escapeHtml: function(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    },

    normalizeAiFormatting: function(value) {
        // Best-effort: if the model returns a single-line list, add line breaks.
        // Keep it conservative to avoid mangling normal prose.
        let text = String(value ?? "").replaceAll("\r\n", "\n");
        if (!text.includes("\n")) {
            const dashCount = (text.match(/-\s/g) ?? []).length;
            const looksLikeDashList = text.trimStart().startsWith("- ") || dashCount >= 2;
            if (looksLikeDashList) {
                text = text.replaceAll(" - ", "\n- ");
            }

            const looksLikeNumberedList = /\b1[\.|\)]\s/.test(text) && /\b2[\.|\)]\s/.test(text);
            if (looksLikeNumberedList) {
                text = text.replaceAll(/\s(\d+[\.|\)]\s)/g, "\n$1");
            }
        }
        return text;
    },

    toHtmlWithBreaks: function(value) {
        const normalized = String(value ?? "").replaceAll("\r\n", "\n");
        return this.escapeHtml(normalized).replaceAll("\n", "<br>");
    },

    chatItem: function(type, message) {

        const messageBox = this.chatBox.appendChild(document.createElement("div"));
        messageBox.classList.add("message", `${type === "user" ? "user-" : "bot-"}message`);

        const messageContent = messageBox.appendChild(document.createElement("div"));
        messageContent.classList.add("message-bubble");

        if (type === "ai") {
            const formatted = this.normalizeAiFormatting(message);
            messageContent.innerHTML = this.toHtmlWithBreaks(formatted);
        } else {
            // User: treat as plain text, but allow visual line breaks.
            messageContent.innerHTML = this.toHtmlWithBreaks(message);
        }
    },
}

// Load Chat History
e.chatItem("ai", aiTemplates.baseInstructions.opening);
if (chatData?.transcript?.length) {

    chatData.transcript.forEach((chat, index) => {

        // Display Messages (Skip Opening)
        if (index) {
            e.chatItem('user', chat.user);
            e.chatItem('ai', chat.ai);
        }
    });

}



// AI Prompting
e.input.form.onsubmit = async (event) => {

    // Prevent Page Reload
    event.preventDefault();

    // Get Input & Display
    const input = e.input.field.value;
    if (!input) return;

    e.chatItem('user', input);
    e.input.field.value = "";
    
    // Prompt AI & Display Response
    const output = await prompt(input, chatData ?? {});
    e.chatItem('ai', output.text);

    // Update ChatData
    chatData = output.data;
    if (!uid) return;

    // Update chat metadata for history list ordering
    try {
        if (!chatData.title) {
            const t = String(input || '').trim();
            chatData.title = t ? t.slice(0, 48) : '';
        }
        chatData.activity = new Date().toISOString();
    } catch {}

    // Create/Overwrite DB Chat Doc
    if (cid) await DB.dbSetDoc(dbPath.l(), chatData);
    else {

        cid = (await DB.dbAddDoc(dbPath.s(), chatData)).id;

        // Update URL for Reloads
        const url = new URL(window.location.href);
        url.searchParams.set("cid", cid);
        window.history.replaceState(null, "", url.toString());

        // Let the sidebar (and any listeners) know cid changed
        window.dispatchEvent(new Event('cidchange'));

    }

    // Store Chat in LocalStorage
    localStorage.setItem(`chat_${cid}`, JSON.stringify(chatData));

    // Let the sidebar refresh the recent chats list (best-effort)
    window.dispatchEvent(new Event('chatlistrefresh'));
}