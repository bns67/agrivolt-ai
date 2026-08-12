// The URL where the Python backend is running
const API_URL = "http://127.0.0.1:8000/api/chat";

// --- FEATURE 1: Open-Field & Greenhouse Dynamic Toggle ---
const envType = document.getElementById("envType");
const shadingContainer = document.getElementById("shadingContainer");
const shadingInput = document.getElementById("shading");

envType.addEventListener("change", (event) => {
    if (event.target.value === "open_field") {
        shadingContainer.classList.add("hidden");
        shadingInput.value = 0; 
        shadingInput.removeAttribute("required"); 
    } else {
        shadingContainer.classList.remove("hidden");
        if (shadingInput.value == 0) shadingInput.value = "";
        shadingInput.setAttribute("required", "true");
    }
});

// --- FEATURE 2: Micro-Farm Mode Toggle ---
const microFarmMode = document.getElementById("microFarmMode");
const areaContainer = document.getElementById("areaContainer");
const growingAreaInput = document.getElementById("growingArea");

microFarmMode.addEventListener("change", (event) => {
    if (event.target.checked) {
        areaContainer.classList.remove("hidden");
    } else {
        areaContainer.classList.add("hidden");
        growingAreaInput.value = 1; // Reset to 1 sqm default
    }
});

// --- CORE FUNCTION 1: THE YIELD PREDICTION ---
document.getElementById('predictionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Swap the UI
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');
    
    document.getElementById('justificationShort').innerText = "Analyzing microclimate data...";
    document.getElementById('suggestionsShort').innerText = "Calculating optimal parameters...";
    
    // NEW: Reset harvest time
    document.getElementById('harvestTimeValue').innerText = "...";
    
    // Hide detailed sections initially when a new prediction is requested
    document.getElementById('justificationDetail').classList.add('hidden');
    document.getElementById('suggestionsDetail').classList.add('hidden');
    document.getElementById('readMoreBtn').classList.add('hidden');

    // Grab elements to manipulate colors later
    const yieldBox = document.getElementById('yieldBox');
    const yieldLabel = document.getElementById('yieldLabel');
    const yieldText = document.getElementById('yieldValue');

    // Reset the box to neutral gray while loading
    yieldBox.className = "bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center min-w-[150px] transition-all duration-500 shadow-sm border border-transparent";
    yieldLabel.className = "text-sm text-gray-500 dark:text-gray-300 font-semibold uppercase transition-colors";
    yieldText.className = "text-3xl font-bold text-gray-800 dark:text-white transition-colors";

    // 2. Gather form data
    const farmData = getFormData();

    // 3. MACHINE LEARNING YIELD PREDICTION
    try {
        yieldText.innerText = "Calculating...";
        
        const predictResponse = await fetch("http://127.0.0.1:8000/api/predict", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(farmData)
        });

        const predictData = await predictResponse.json();
        
        if (predictData.error) {
            yieldText.innerText = "Error";
            console.error("ML Error:", predictData.error);
        } else {
            // Output the numerical text first (keep box gray for now)
            if (farmData.is_micro_farm) {
                const totalYield = (predictData.yield_kg_m2 * farmData.growing_area).toFixed(2);
                yieldText.innerText = `${totalYield} kg total`;
            } else {
                yieldText.innerText = `${predictData.yield_kg_m2} kg/m²`;
            }
        }
    } catch (error) {
        yieldText.innerText = "Offline";
        console.error("Failed to fetch prediction:", error);
    }

    // 4. GET AI DIAGNOSTICS & STATUS RATING FROM BACKEND
    const microFarmContext = farmData.is_micro_farm 
        ? "The user is operating a small-scale micro-farm or urban gardening setup. Restrict your advice to small-scale, low-budget, or container gardening techniques." 
        : "";

    // UPDATED PROMPT: Added Harvest Time
    const diagnosticPrompt = `Act as an automated diagnostic system. Based on the provided farm data, structure your response EXACTLY with these 6 headers:
    Status: [Green, Yellow, or Red]
    Harvest Time: [Estimated time to harvest in days, e.g., 55-65 Days]
    Short Justification: [1 concise sentence summarizing the core issue or success]
    Detailed Justification: [A 2-sentence detailed explanation of the microclimate performance]
    Short Suggestions: [1 concise sentence summarizing the main action to take]
    Detailed Suggestions: [2 highly specific, actionable bullet points to improve or maintain yield]
    
    ${microFarmContext} CRITICAL: Do not use any Markdown formatting (* or #). Use plain text only.`;

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
        const replyText = data.reply.trim();
        
        // FIX: Strip out Markdown bolding (*), headers (#), and bullet formatting before RegEx matching
        const cleanReplyText = replyText.replace(/[*#]/g, '');

        // Parse out the sections using Regex on cleanReplyText
        const statusMatch = cleanReplyText.match(/Status:\s*(Green|Yellow|Red)/i);
        const harvestMatch = cleanReplyText.match(/Harvest Time:\s*(.*?)(?=Short Justification:)/is);
        const shortJustMatch = cleanReplyText.match(/Short Justification:\s*(.*?)(?=Detailed Justification:)/is);
        const detailJustMatch = cleanReplyText.match(/Detailed Justification:\s*(.*?)(?=Short Suggestions:)/is);
        const shortSuggMatch = cleanReplyText.match(/Short Suggestions:\s*(.*?)(?=Detailed Suggestions:)/is);
        const detailSuggMatch = cleanReplyText.match(/Detailed Suggestions:\s*(.*)/is);

        // --- Handle Status Color ---
        let statusColor = statusMatch ? statusMatch[1].toLowerCase() : "gray";
        
        yieldBox.className = "p-4 rounded-lg text-center min-w-[150px] transition-all duration-500 shadow-md border";
        yieldLabel.className = "text-sm font-semibold uppercase transition-colors";
        yieldText.className = "text-3xl font-bold transition-colors";

        if (statusColor === "green") {
            yieldBox.classList.add("bg-gradient-to-br", "from-green-100", "to-green-300", "dark:from-green-900", "dark:to-green-700", "border-green-200", "dark:border-green-800");
            yieldLabel.classList.add("text-green-800", "dark:text-green-300");
            yieldText.classList.add("text-green-900", "dark:text-green-100");
        } else if (statusColor === "yellow") {
            yieldBox.classList.add("bg-gradient-to-br", "from-yellow-100", "to-yellow-300", "dark:from-yellow-900", "dark:to-yellow-700", "border-yellow-200", "dark:border-yellow-800");
            yieldLabel.classList.add("text-yellow-800", "dark:text-yellow-300");
            yieldText.classList.add("text-yellow-900", "dark:text-yellow-100");
        } else if (statusColor === "red") {
            yieldBox.classList.add("bg-gradient-to-br", "from-red-100", "to-red-300", "dark:from-red-900", "dark:to-red-700", "border-red-200", "dark:border-red-800");
            yieldLabel.classList.add("text-red-800", "dark:text-red-300");
            yieldText.classList.add("text-red-900", "dark:text-red-100");
        }

        // --- Inject the Text ---
        document.getElementById('harvestTimeValue').innerText = harvestMatch ? harvestMatch[1].trim() : "N/A";
        document.getElementById('justificationShort').innerText = shortJustMatch ? shortJustMatch[1].trim() : "Analysis complete.";
        document.getElementById('justificationDetail').innerText = detailJustMatch ? detailJustMatch[1].trim() : "Detailed analysis unavailable.";
        
        document.getElementById('suggestionsShort').innerText = shortSuggMatch ? shortSuggMatch[1].trim() : "Review parameters.";
        document.getElementById('suggestionsDetail').innerText = detailSuggMatch ? detailSuggMatch[1].trim() : "Detailed suggestions unavailable.";

        // Show the Read More button
        document.getElementById('readMoreBtn').classList.remove('hidden');
        
        // Reset button state on new search
        document.getElementById('readMoreBtn').innerText = "+ Read Detailed Analysis";
        document.getElementById('justificationDetail').classList.add('hidden');
        document.getElementById('suggestionsDetail').classList.add('hidden');

    } catch (error) {
        document.getElementById('justificationShort').innerText = "Error connecting to AI Backend.";
        document.getElementById('suggestionsShort').innerText = "Please ensure the FastAPI server is running.";
        console.error(error);
    }
});

// --- CORE FUNCTION 2: THE INTERACTIVE CHATBOT ---
document.getElementById('sendChatBtn').addEventListener('click', async () => {
    const chatInput = document.getElementById('chatMessage');
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    appendChatMessage("You", messageText, "bg-blue-100 text-blue-900 self-end ml-10");
    chatInput.value = ''; 

    const farmData = getFormData();
    
    // FEATURE 3: Show the loading indicator
    const chatLoader = document.getElementById('chatLoader');
    chatLoader.classList.remove('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...farmData,
                user_message: messageText
            })
        });

        const data = await response.json();
        
        // Hide the loading indicator now that we have the data
        chatLoader.classList.add('hidden');
        
        const cleanReply = data.reply.replace(/[*#]/g, '');
        appendChatMessage("AgriVolt AI", cleanReply, "bg-green-100 text-green-900 self-start mr-10");

    } catch (error) {
        // Hide the loading indicator if it fails
        chatLoader.classList.add('hidden');
        appendChatMessage("System Error", "Could not connect to the backend server. Is uvicorn running?", "bg-red-100 text-red-900");
    }
});

document.getElementById('chatMessage').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('sendChatBtn').click();
    }
});

// --- HELPER FUNCTIONS ---
function getFormData() {
    return {
        environment: document.getElementById('envType').value,
        crop_type: document.getElementById('cropType').value,
        shading_percent: parseFloat(document.getElementById('shading').value) || 0,
        temperature_c: parseFloat(document.getElementById('temperature').value),
        soil_moisture: parseFloat(document.getElementById('moisture').value),
        is_micro_farm: document.getElementById('microFarmMode').checked,
        growing_area: parseFloat(document.getElementById('growingArea').value) || 1
    };
}

function appendChatMessage(sender, text, classes) {
    const chatBox = document.getElementById('chatBox');
    const msgDiv = document.createElement('div');
    msgDiv.className = `p-3 rounded-lg w-fit max-w-[80%] ${classes}`;
    msgDiv.innerHTML = `<strong>${sender}:</strong> <p class="text-sm mt-1 whitespace-pre-wrap">${text}</p>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- FEATURE 4: READ MORE TOGGLE ---
document.getElementById('readMoreBtn').addEventListener('click', function() {
    const justDetail = document.getElementById('justificationDetail');
    const suggDetail = document.getElementById('suggestionsDetail');
    
    const isHidden = justDetail.classList.contains('hidden');
    
    if (isHidden) {
        justDetail.classList.remove('hidden');
        suggDetail.classList.remove('hidden');
        this.innerText = "- Show Less";
    } else {
        justDetail.classList.add('hidden');
        suggDetail.classList.add('hidden');
        this.innerText = "+ Read Detailed Analysis";
    }
});