const fs = require('fs');
const path = require('path');

// Simple dotenv parser
const envPath = path.resolve(__dirname, '.env.local');
let apiKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            if (key === 'GEMINI_API_KEY') apiKey = val;
        }
    });
} catch (e) {
    console.error("Could not read .env.local");
    process.exit(1);
}

if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env.local");
    process.exit(1);
}

console.log("API Key found (length: " + apiKey.length + "). Checking models...");

// List models
async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("API Error Detail:", JSON.stringify(data.error, null, 2));
        } else if (data.models) {
            console.log("Successfully connected! Available Models:");
            const flashModels = data.models.filter(m => m.name.includes('flash'));
            if (flashModels.length > 0) {
                flashModels.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`));
            } else {
                console.log("No 'flash' models found. All models:");
                data.models.forEach(m => console.log(`- ${m.name}`));
            }
        } else {
            console.log("Unexpected response format:", data);
        }
    } catch (e) {
        console.error("Network Error:", e);
    }
}

listModels();
