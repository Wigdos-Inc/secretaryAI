/**
 * @module scripts/modules/ai.js
 * 
 * Module for all LLM API Functionality
 * 
 * ES6 Module Usage:
 * - Export: Add "export" before function/class declarations
 * - Import: import { functionName } from "../modules/dataConvert.js";
 * - HTML: Add type="module" to <script> tag
 */



// Load Gemini config from a local JSON (populated at build/deploy time via CI using GitHub secrets)
// or from a runtime global `window.__AI_CONFIG` set by the host. This avoids reading
// sensitive keys from Firestore each time.
let gemini = null;
try {
    if (typeof window !== 'undefined' && window.__AI_CONFIG && window.__AI_CONFIG.gemini) {
        gemini = window.__AI_CONFIG.gemini;
    }
} catch (e) {
    // ignore
}

if (!gemini) {
    try {
        const cfgResp = await fetch('/scripts/json/aiConfig.json');
        if (cfgResp && cfgResp.ok) {
            gemini = await cfgResp.json();
        }
    } catch (e) {
        // ignore
    }
}

if (!gemini) throw new Error("Failed to load Gemini config. Create /scripts/json/aiConfig.json via CI using GitHub secrets or set window.__AI_CONFIG.gemini.");

// Check if config has unexpanded variables (indicates secrets not set or local dev)
if (gemini.url && gemini.url.includes('${')) {
    throw new Error("Gemini config contains unexpanded variables. Ensure GitHub secrets are set (GEMINI_URL, GEMINI_KEY, GEMINI_MODEL) and CI has run, or create a local /scripts/json/aiConfig.json with actual values for development.");
}

// Import Gemini API (Dynamic Import for URL)
const { GoogleGenerativeAI } = await import(gemini.url);

const ai = new GoogleGenerativeAI(gemini.key) ?? null;
if (!ai) throw new Error("Gemini Initialization Failed");



// API Class
class Message {

    constructor(history, instructions) {

        this.model = ai.getGenerativeModel({
            model: gemini.model,
            systemInstruction: instructions,
            generationConfig: {
                temperature: 0.6
            }
        });

        this.chat = this.model.startChat({
            history: history
        });
    }
    
    async send(message) {

        console.log(`Sending Message: "${message}"`);
        try {
            const response = await this.chat.sendMessage(message);
            return response.response.text();
        }
        catch (err) {
            console.error("Failed to access Gemini API", err);
            return null;
        }
    }
}



// Import/Declare Templates
const jsonFetch = await fetch('/scripts/json/aiTemplates.json');
export const aiTemplates = await jsonFetch.json();

const emptyChat = {
    history: [],
    transcript: [{ ai: aiTemplates.baseInstructions.opening }],
    summary: "",
    title: "",
    messageCount: 0,
    totalCount: 0,
    activity: "" // Change with current timestamp (example: "January 23, 2026 at 12:06:51 PM UTC+1")
}



/* API Functionality */

export async function prompt(input, chatData = {}) {

    console.log("Received chat prompt.");

    // Check if chatData is Valid
    if (typeof chatData !== 'object' || !chatData) throw new Error("Input ChatData must be an Object");
    
    // Create new Chat if chatData is Empty (happens on fresh chats)
    if (!Object.keys(chatData).length) chatData = { ...emptyChat };


    // Check to Summarize Chat History
    if (chatData.messageCount >= 15) chatData = await summarize(chatData);

    // Create Instructions (with Summary)
    let instructions = aiTemplates.baseInstructions.assistant;
    if (chatData.summary) instructions += `\n\n\nCONVERSATION SUMMARY:\n\n${chatData.summary}`;
    

    console.log("Prompting AI");

    // Send Prompt
    const message = new Message(chatData.history, instructions);
    const response = await message.send(input);

    if (response === null) return "Error, see console for more details.";

    // Sanitize response for storage/display (keep as plain text; UI will render newlines)
    const responseText = response.replaceAll("*", "");
    

    // Add Message and Response to History and Transcript
    chatData.history = chatData.history.concat([
        { role: "user", parts: [{ text: input }] },
        { role: "model", parts: [{ text: responseText }] }
    ]);
    chatData.messageCount++;

    chatData.transcript.push({
        user: input,
        ai: responseText
    });
    chatData.totalCount++;

    // Return Response and Updated DB Data
    return { text: responseText, data: chatData }
}

async function summarize(chatData) {

    console.log("Chat Buffer Full. Updating Summary");

    // Seperate first 10 entries
    const toSummarize = chatData.history.splice(0, 20);
    chatData.messageCount = chatData.history.length/2;

    // Prep Instructions
    let instructions = aiTemplates.baseInstructions.summary;
    if (chatData.summary) instructions += `\n\n\nOLD SUMMARY:\n\n${chatData.summary}`;

    // Create New Summary
    const message = new Message(toSummarize, instructions);
    chatData.summary = (await message.send("Please summarize our conversation.")).replaceAll("*", "");

    return chatData;
}