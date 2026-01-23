/**
 * @module scripts/modules/dataConvert.js
 * 
 * Module for all LLM API Functionality
 * 
 * ES6 Module Usage:
 * - Export: Add "export" before function/class declarations
 * - Import: import { functionName } from "../modules/dataConvert.js";
 * - HTML: Add type="module" to <script> tag
 */


// Import Gemini API
import { GoogleGenAI } from "@google/genai";

// Initialize AI
const ai = new GoogleGenAI({});

// API Class
class Message {

    constructor(history, instructions) {

        this.model = "gemini-1.5-flash";
        this.contents = history;
        this.config = {
            systemInstruction: instructions,
            temperature: 0.3
        }
    }
    
    async send() {

        const response = await ai.models.generateContent(this);
        return response.text;
    }
}



/* Templates */

const baseInstructions = {
    summary: "You are a...",
    assistant: "You are a..."
}

const emptyChat = {
    history: [],
    instructions: baseInstructions.assistant,
    summary: "",
    title: "",
    messageCount: 0,
    totalCount: 0,
    activity: "" // Chance with current timestamp (example: "January 23, 2026 at 12:06:51 PM UTC+1")
}



/* API Functionality */

export async function prompt(message, chatData = {}) {

    console.log("Received chat prompt.");

    // Check if chatData is Valid
    if (typeof chatData !== 'object' || !chatData) {
        console.error("Chat Data must be provided as an Object");
        return;
    }
    
    // Create new Chat if chatData is Empty (happens on fresh chats)
    if (!Object.keys(chatData).length) chatData = emptyChat;


    // Add prompt to history and check for summarization need
    chatData.history.concat([
        { role: "model", parts: [{ text: message.ai }] },
        { role: "user", parts: [{ text: message.user }] }
    ]);
    chatData.messageCount++;
    chatData.totalCount++;

    // Check to Summarize Chat History
    if (chatData.messageCount >= 15) chatData = await summarize(chatData);


    // Send Prompt

}

async function summarize(chatData) {

    // Seperate first 10 entries
    const toSummarize = chatData.history.splice(0, 10);

    // Prep Instructions
    let instructions = baseInstructions.summary;
    instructions += `OLD SUMMARY: ${chatData.summary}`

    // Create New Summary
    const message = new Message(toSummarize, instructions);
    chatData.summary = await message.send();
    return chatData;
}


/*

Rules:
- Minimum of 5 Chats should be fully loaded
- Maximum of 14 Chats should be fully loaded
- At 15, 10 chats should be put into the summary
- Summary will be worked into systemInstruction

*/