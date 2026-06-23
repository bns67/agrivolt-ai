// The URL where the Python backend is running
const API_URL = "http://127.0.0.1:8000/api/chat";

// --- CORE FUNCTION 1: THE YIELD PREDICTION ---
document.getElementById('predictionForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop the page from refreshing

    // 1. Swap the UI from "Empty State" to "Results Mode"
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');
    
    // Set loading text
    document.getElementById('justificationText').innerText = "Analyzing microclimate data...";
    document.getElementById('suggestionsText').innerText = "Calculating optimal parameters...";

    // 2. Gather the current form data
    const farmData = getFormData();

    // 3. REAL MACHINE LEARNING INTEGRATION
    try {
        document.getElementById('yieldValue').innerText = "Calculating...";
        
        const predictResponse = await fetch("http://127.0.0.1:8000/api/predict", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(farmData)
        });

        const predictData = await predictResponse.json();
        
        if (predictData.error) {
            document.getElementById('yieldValue').innerText = "Error";
            console.error("ML Error:", predictData.error);
        } else {
            // Display the true prediction from the Random Forest model!
            document.getElementById('yieldValue').innerText = `${predictData.yield_kg_m2} kg/m²`;
        }
    } catch (error) {
        document.getElementById('yieldValue').innerText = "Offline";
        console.error("Failed to fetch prediction:", error);
    }

    // 4. GET REAL AI DIAGNOSTICS FROM BACKEND
    // Added prompt engineering to instruct the AI to avoid Markdown
    const diagnosticPrompt = `Act as an automated diagnostic system. Based on the provided farm data, provide a short 2-sentence justification for why the crop is performing this way. Then, create a section titled "Suggestions" and provide 2 highly specific, actionable bullet points to improve the yield. CRITICAL: Do not use any Markdown formatting, asterisks, or hashtags in your response. Use plain text only.`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...farmData,
                user_message: diagnosticPrompt
            })
        });

        const data = await response.json();
        
        // Split the AI's response into the Justification part and Suggestions part
        const responseParts = data.reply.split(/Suggestions/i);
        
        // Added JavaScript Regex sanitizer to guarantee a clean UI
        document.getElementById('justificationText').innerText = responseParts[0].replace(/[*#]/g, '').trim();
        
        const cleanSuggestions = responseParts.length > 1 ? responseParts[1].replace(/[*#]/g, '').trim() : "No specific suggestions provided.";
        document.getElementById('suggestionsText').innerText = cleanSuggestions;

    } catch (error) {
        document.getElementById('justificationText').innerText = "Error connecting to AI Backend.";
        document.getElementById('suggestionsText').innerText = "Please ensure the FastAPI server is running.";
        console.error(error);
    }
});

// --- CORE FUNCTION 2: THE INTERACTIVE CHATBOT ---
document.getElementById('sendChatBtn').addEventListener('click', async () => {
    const chatInput = document.getElementById('chatMessage');
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    // 1. Add User's message to the chat box
    appendChatMessage("You", messageText, "bg-blue-100 text-blue-900 self-end ml-10");
    chatInput.value = ''; // Clear the input

    // 2. Grab the current farm data so the AI knows the context
    const farmData = getFormData();

    try {
        // 3. Send to backend
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...farmData,
                user_message: messageText
            })
        });

        const data = await response.json();
        
        // 4. Add AI's response to the chat box (Sanitized for UI cleanliness)
        const cleanReply = data.reply.replace(/[*#]/g, '');
        appendChatMessage("AgriVolt AI", cleanReply, "bg-green-100 text-green-900 self-start mr-10");

    } catch (error) {
        appendChatMessage("System Error", "Could not connect to the backend server. Is uvicorn running?", "bg-red-100 text-red-900");
    }
});

// Allow pressing "Enter" to send a chat
document.getElementById('chatMessage').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('sendChatBtn').click();
    }
});

// --- HELPER FUNCTIONS ---
function getFormData() {
    return {
        crop_type: document.getElementById('cropType').value,
        shading_percent: parseFloat(document.getElementById('shading').value),
        temperature_c: parseFloat(document.getElementById('temperature').value),
        soil_moisture: parseFloat(document.getElementById('moisture').value)
    };
}

function appendChatMessage(sender, text, classes) {
    const chatBox = document.getElementById('chatBox');
    const msgDiv = document.createElement('div');
    msgDiv.className = `p-3 rounded-lg w-fit max-w-[80%] ${classes}`;
    msgDiv.innerHTML = `<strong>${sender}:</strong> <p class="text-sm mt-1 whitespace-pre-wrap">${text}</p>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
}