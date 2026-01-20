(function(){
const chatBody = document.getElementById('chatBody');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

function appendMessage(role, text) {
    const msg = document.createElement('div');
    msg.classList.add('chat-message', role, role == 'user' ? 'bgc-primary' : 'bgc-secondary', 'rounded-5', 'p-3', 'mb-3');

    const bubble = document.createElement('div');
    bubble.classList.add('chat-bubble', 'fw-bold', 'text-light', role === 'user' ? 'text-end' : 'text-start');
    bubble.textContent = text;

    msg.appendChild(bubble);
    chatBody.appendChild(msg);

    //chatBody.scrollTop = chatBody.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
}

sendBtn.addEventListener('click', async () => {
    document.getElementById('chat-message').classList.add('hidden');

    const text = userInput.value.trim();
    if (!text) {
        setTimeout(() => appendMessage('ai', 'AI: "' + 'You didn\'t enter any message!"'), 700);
        return;
    }

    appendMessage('user', text);
    userInput.value = '';
    const reply = await generateText(text, 50);
    setTimeout(() => appendMessage('ai', 'AI: "' + reply + '"'), 700);
});

userInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendBtn.click();
});

// Mock function to simulate AI text generation
let ai_json;
const getjson = async () => {
    const response = await fetch('scripts/proto/fake_ai_responses.json');
    ai_json = await response.json();
};
getjson();

function generateText(prompt, maxlength) {
    const input = prompt.toLowerCase();

    const response = ai_json[input];
    if (response) {
        return Promise.resolve(response);
    }

    return Promise.resolve('Could you please specify your question?');
}
})();
