// Import DB & AI

import { prompt } from "../modules/ai.js";
import * as DB from "../modules/db.js";

// Get User ID and Chat ID
const uid = JSON.parse(localStorage.getItem("userData")).uid ?? null;
const cid = new URLSearchParams(window.location.search).get("cid") ?? null;

// Get Chat Data
const chatData = (async () => {

    return uid || cid ? await DB.dbGetDoc([DB.COLLECTIONS.USERS, uid, DB.COLLECTIONS.USER_CHATS, cid]) : null;
})();

const e = {
    chatBox: document.getElementById("chatBox"),
    input: {
        field: document.getElementById("chatInput"),
        btn  : document.getElementById("sendBtn"),
    },

    chatItem: function(type) {

        const messageBox = this.chatBox.appendChild(document.createElement("div"));
        messageBox.classList.add("message", `${type === "user" ? "user-" : "bot-"}message`);

        const messageContent = messageBox.appendChild(document.createElement("div"));
        messageContent.classList.add("message-bubble");

        return { box: messageBox, content: messageContent }
    },
}

// Event Listeners

e.input.btn.onclick = async () => {

    // Get Input
    const input = e.input.field.value;
    if (!input) return;
    
    // Prompt AI
    const output = await prompt(input, chatData);
}

