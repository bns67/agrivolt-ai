// Connects to Hani's local server
const API_BASE = "http://localhost:8000/api";
let currentYield = 0.0; // Store globally for the chatbot to use

async function runPrediction() {
    const cropType = document.getElementById("cropType").value;
    const shading = parseFloat(document.getElementById("shading").value) || 0;
    const temp = parseFloat(document.getElementById("temp").value) || 0;
    const moisture = parseFloat(document.getElementById("moisture").value) || 0;

    try {
        const response = await fetch(`${API_BASE}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                crop_type: cropType,
                shading_percent: shading,
                temperature_c: temp,
                soil_moisture: moisture
            })
        });

        const data = await response.json();
        currentYield = data.predicted_yield_kg;
        document.getElementById("yieldResult").innerText = currentYield;

    } catch (error) {
        console.error("Error connecting to backend:", error);
        document.getElementById("yieldResult").innerText = "Error - Check Server";
    }
}

async function askAI() {
    const question = document.getElementById("userQuestion").value;
    const cropType = document.getElementById("cropType").value;
    const shading = parseFloat(document.getElementById("shading").value) || 0;
    const chatWindow = document.getElementById("chatWindow");

    if (!question) return;

    // Display user question
    chatWindow.innerHTML += `<p><strong>You:</strong> ${question}</p>`;
    document.getElementById("userQuestion").value = "";

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                crop_type: cropType,
                shading_percent: shading,
                current_yield: currentYield,
                user_question: question
            })
        });

        const data = await response.json();
        
        // Display AI answer
        chatWindow.innerHTML += `<p class="text-blue-600"><strong>AI:</strong> ${data.reply}</p>`;
        chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll to bottom

    } catch (error) {
        console.error("Error connecting to AI:", error);
        chatWindow.innerHTML += `<p class="text-red-500"><strong>Error:</strong> Cannot reach AI Agronomist.</p>`;
    }
}