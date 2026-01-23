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


// Import Gemini API
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// Initialize AI
const ai = new GoogleGenerativeAI("AIzaSyA5Ph3TmsKERzTSD9CZLQsDPJl0pfgaAR4");

// API Class
class Message {

    constructor(history, instructions) {

        this.model = ai.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: instructions,
            generationConfig: {
                temperature: 0.3
            }
        });

        this.chat = this.model.startChat({
            history: history
        });
    }
    
    async send(message) {

        const output = await this.chat.sendMessage(message);
        return output.response.text;
    }
}



// Import/Declare Templates
const jsonFetch = await fetch('../json/aiTemplates.json');
const aiTemplates = await jsonFetch.json();

const emptyChat = {
    history: [],
    transcript: {},
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
    if (typeof chatData !== 'object' || !chatData) {
        console.error("Chat Data must be provided as an Object");
        return;
    }
    
    // Create new Chat if chatData is Empty (happens on fresh chats)
    if (!Object.keys(chatData).length) {
        chatData = { ...emptyChat };
        chatData.history.push(aiTemplates.baseInstructions.opening);
    }


    // Check to Summarize Chat History
    if (chatData.messageCount >= 15) chatData = await summarize(chatData);

    // Create Instructions (with Summary)
    let instructions = aiTemplates.baseInstructions.assistant;
    if (chatData.summary) instructions += `\n\n\nCONVERSATION SUMMARY:\n\n${chatData.summary}`;
    

    console.log("Prompting AI");

    // Send Prompt
    const message = new Message(chatData.history, instructions);
    const response = await message.send(input);
    
    // Add Message and Response to History
    chatData.history = chatData.history.concat([
        { role: "user", parts: [{ text: input }] },
        { role: "model", parts: [{ text: response }] }
    ]);
    chatData.messageCount++;
    chatData.totalCount++;

    return { output: response, chatData: chatData }
}

async function summarize(chatData) {

    console.log("Chat Buffer Full. Updating Summary");

    // Seperate first 10 entries
    const toSummarize = chatData.history.splice(0, 10);
    chatData.messageCount = Math.floor(chatData.history.length/2);

    // Prep Instructions
    let instructions = aiTemplates.baseInstructions.summary;
    if (chatData.summary) instructions += `\n\n\nOLD SUMMARY:\n\n${chatData.summary}`;

    // Create New Summary
    const message = new Message(toSummarize, instructions);
    chatData.summary = await message.send("Please summarize our conversation.");

    return chatData;
}


// Debugging
document.getElementById("ai").innerHTML = await prompt("What is the square root of 9?");