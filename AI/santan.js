// =========================================================================================
// GLOBAL STATE & CONSTANTS
// =========================================================================================
let chatHistoryForAPI = []; 
let activeChatTtsBtn = null;
let rawAIResponse = "";
let currentMode = "conception";

// Chart Storage Objects
let husbandChartRaw = null;
let wifeChartRaw = null;
let motherChartRaw = null;
let currentModalTarget = ""; 

// Central Proxy URL Base
const PROXY_BASE_URL = "https://eprashala-proxy-511804777001.asia-south1.run.app";

// --- ABSOLUTE TRUTH VEDIC CONSTANTS ---
const VEDIC_RASHIS = [
    "Aries (Mesha)", "Taurus (Vrishabha)", "Gemini (Mithuna)", "Cancer (Karka)", 
    "Leo (Simha)", "Virgo (Kanya)", "Libra (Tula)", "Scorpio (Vrishchika)", 
    "Sagittarius (Dhanu)", "Capricorn (Makara)", "Aquarius (Kumbha)", "Pisces (Meena)"
];

const VEDIC_NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", 
    "Pushya", "Ashlesha", "Magha", "P.Phalguni", "U.Phalguni", "Hasta", "Chitra", 
    "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "P.Ashadha", "U.Ashadha", 
    "Shravana", "Dhanishta", "Shatabhisha", "P.Bhadrapada", "U.Bhadrapada", "Revati"
];

const VEDIC_TITHIS = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", 
    "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", 
    "Purnima", "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", 
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", 
    "Chaturdashi", "Amavasya"
];

// =========================================================================================
// CENTRAL ROUTING AI ENGINE
// =========================================================================================
async function fetchGeminiChat(payloadObject) {
    const userKey = localStorage.getItem('user_ai_api_key') || '';

    // TIER 1: User has their own key -> Talk directly to Google servers
    if (userKey && userKey.trim().length > 10) {
        try {
            console.log("Direct Route Active: Targeting gemini-flash-latest...");
            const primaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${userKey.trim()}`;
            const response = await fetch(primaryUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadObject)
            });
            
            if (!response.ok) throw new Error(`Primary model status: ${response.status}`);
            return response;

        } catch (error) {
            console.warn("Primary channel busy/unavailable. Re-routing to gemini-2.5-flash-lite fallback...", error);
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${userKey.trim()}`;
            return await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadObject)
            });
        }
    } 
    
    // TIER 2: No personal key provided -> Route to your centralized proxy gateway
    else {
        console.log("Proxy Route Active: Routing through centralized server infrastructure...");
        return await fetch(`${PROXY_BASE_URL}/api/chat`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadObject)
        });
    }
}

// ==========================================
// UI & FORM INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    toggleFormMode('conception');
});

function toggleFormMode(mode) {
    currentMode = mode;
    const coupleSection = document.getElementById('coupleDetails');
    const motherSection = document.getElementById('motherDetails');
    const hName = document.getElementById('husbandName');
    const hAge = document.getElementById('husbandAge');
    const wName = document.getElementById('wifeName');
    const wAge = document.getElementById('wifeAge');
    const mName = document.getElementById('motherName');
    const mAge = document.getElementById('motherAge');
    const lmp = document.getElementById('wifeLMP');

    if (mode === 'conception') {
        document.getElementById('dateLabel').innerText = "Target Month (For calculating transits):";
        document.getElementById('notesLabel').innerText = "Medical Notes / Questions for Conception:";
        document.getElementById('submitBtn').innerText = "Calculate Garbhadhana Muhurta";
        coupleSection.style.display = 'block';
        motherSection.style.display = 'none';
        
        hName.required = true; hAge.required = true; wName.required = true; wAge.required = true; lmp.required = true; 
        mName.required = false; mAge.required = false;
    } else {
        document.getElementById('dateLabel').innerText = "Doctor's Prescribed C-Section Date Range:";
        document.getElementById('notesLabel').innerText = "Provide exact dates the doctor has offered:";
        document.getElementById('submitBtn').innerText = "Calculate Janma Kundli Timings";
        coupleSection.style.display = 'none';
        motherSection.style.display = 'block';
        
        hName.required = false; hAge.required = false; wName.required = false; wAge.required = false; lmp.required = false; 
        mName.required = true; mAge.required = true;
    }
}

function configureAPIKey() {
    let currentKey = localStorage.getItem('user_ai_api_key') || '';
    let newKey = prompt("Enter your personal Gemini API Key (Leave blank to use default quota):", currentKey);
    if (newKey !== null) {
        if (newKey.trim() === '') {
            localStorage.removeItem('user_ai_api_key'); alert("API Key removed.");
        } else {
            localStorage.setItem('user_ai_api_key', newKey.trim()); alert("API Key saved securely.");
        }
    }
}

// ==========================================
// GEOLOCATION AUTOCOMPLETE
// ==========================================
function setupAutocomplete(inputID, listID, latID, lonID) {
    let timeout = null;
    const inputObj = document.getElementById(inputID);
    const listObj = document.getElementById(listID);

    inputObj.addEventListener('input', function() {
        clearTimeout(timeout);
        if (this.value.length < 3) { listObj.style.display = 'none'; return; }
        timeout = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.value)}`);
                const data = await response.json();
                listObj.innerHTML = '';
                if (data.length > 0) {
                    listObj.style.display = 'block';
                    data.forEach(place => {
                        const li = document.createElement('li'); 
                        li.textContent = place.display_name;
                        li.onclick = () => {
                            inputObj.value = place.name;
                            document.getElementById(latID).value = parseFloat(place.lat).toFixed(4);
                            document.getElementById(lonID).value = parseFloat(place.lon).toFixed(4);
                            listObj.style.display = 'none';
                        };
                        listObj.appendChild(li);
                    });
                } else { listObj.style.display = 'none'; }
            } catch (error) {}
        }, 600); 
    });
    document.addEventListener('click', e => { if (e.target !== inputObj) listObj.style.display = 'none'; });
}
setupAutocomplete('placeSearch', 'suggestions', 'calcLat', 'calcLon');
setupAutocomplete('modalPlaceSearch', 'modalSuggestions', 'modalLat', 'modalLon');

// ==========================================
// CHART CALCULATION MODAL
// ==========================================
function openAstroModal(target) {
    currentModalTarget = target;
    document.getElementById('modalTitle').innerText = `Calculate Details: ${target.charAt(0).toUpperCase() + target.slice(1)}`;
    document.getElementById('modalStatus').innerText = "";
    document.getElementById('astroModal').style.display = 'flex';
}
function closeAstroModal() { document.getElementById('astroModal').style.display = 'none'; }

async function calculateAndSaveChart() {
    const date = document.getElementById('modalDate').value;
    let time = document.getElementById('modalTime').value;
    const lat = document.getElementById('modalLat').value;
    const lon = document.getElementById('modalLon').value;
    const status = document.getElementById('modalStatus');

    if (!date || !time || !lat || !lon) {
        status.innerText = "Please fill all fields and select a valid city."; return;
    }
    if (time.split(':').length === 2) time += ":00"; 

    status.innerText = "Calculating precise chart data...";
    try {
        const response = await fetch(`${PROXY_BASE_URL}/calculate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ date: date, time: time, lat: lat, lon: lon })
        });
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.message);

        // Auto-calculate Age
        const birthDateObj = new Date(date);
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
        if (today.getMonth() < birthDateObj.getMonth() || (today.getMonth() === birthDateObj.getMonth() && today.getDate() < birthDateObj.getDate())) {
            calculatedAge--;
        }

        // Extract Flat Bodies
        let moonData = null;
        let flatBodies = [];
        data.houses.forEach(h => h.forEach(b => {
            if (b.name !== 'Earth') flatBodies.push(b);
            if (b.name === 'Chandra' || b.name === 'Moon') moonData = b;
        }));

        let lagnaName = VEDIC_RASHIS[data.asc_sign - 1] || data.asc_sign;
        let moonName = "Unknown";
        let nakName = "Unknown";

        if (moonData) {
            let moonDeg = parseFloat(moonData.abs_deg);
            let moonSignIndex = Math.floor(moonDeg / 30);
            moonName = VEDIC_RASHIS[moonSignIndex] || "Unknown";
            let nakIndex = Math.floor(moonDeg / (360/27));
            nakName = VEDIC_NAKSHATRAS[nakIndex] || "Unknown";
        }

        const chartString = `Lagna: ${lagnaName}, Moon: ${moonName}, Nakshatra: ${nakName}`;
        
        if (currentModalTarget === 'husband') {
            husbandChartRaw = flatBodies;
            document.getElementById('husbandAstroDisplay').value = "✅ Saved (" + chartString + ")";
            document.getElementById('husbandAge').value = calculatedAge;
        } else if (currentModalTarget === 'wife') {
            wifeChartRaw = flatBodies;
            document.getElementById('wifeAstroDisplay').value = "✅ Saved (" + chartString + ")";
            document.getElementById('wifeAge').value = calculatedAge;
        } else if (currentModalTarget === 'mother') {
            motherChartRaw = flatBodies;
            document.getElementById('motherAstroDisplay').value = "✅ Saved (" + chartString + ")";
            document.getElementById('motherAge').value = calculatedAge;
        }
        
        setTimeout(() => { closeAstroModal(); }, 800);

    } catch (error) { status.innerText = "Error calculating chart. Try again."; }
}

// ==========================================
// CORE AI FETCH & EPHEMERIS ENGINE
// ==========================================
document.getElementById('santanForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const bLat = document.getElementById('calcLat').value;
    const bLon = document.getElementById('calcLon').value;
    if (!bLat || !bLon) { alert("Please select your Current Location from the dropdown list."); return; }

    stopTTS(); 
    const btn = document.getElementById('submitBtn');
    const loader = document.getElementById('loader');
    const resultWrapper = document.getElementById('result-wrapper');
    const resultText = document.getElementById('result-text');
    const statusText = document.getElementById('statusText');
    
    btn.disabled = true; loader.style.display = 'block'; resultWrapper.style.display = 'none';
    
    const targetDate = document.getElementById('targetDate').value;
    const medicalNotes = document.getElementById('userMedicalNotes').value;
    const langDropdown = document.getElementById('langToggle');
    const selectedLanguageName = langDropdown.options[langDropdown.selectedIndex].text;

    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0];
    let userContextStr = "";
    const safeDeg = (val) => (val !== undefined && val !== null) ? parseFloat(val).toFixed(2) : "Unknown";

    if (currentMode === "conception") {
        userContextStr = `Wife's LMP: ${document.getElementById('wifeLMP').value}\n`;
        userContextStr += `Husband: ${document.getElementById('husbandName').value} (Age: ${document.getElementById('husbandAge').value}) - Astro: ${document.getElementById('husbandAstroDisplay').value}\n`;
        userContextStr += `Wife: ${document.getElementById('wifeName').value} (Age: ${document.getElementById('wifeAge').value}) - Astro: ${document.getElementById('wifeAstroDisplay').value}\n\n`;
    } else {
        userContextStr = `Mother's Name: ${document.getElementById('motherName').value} (Age: ${document.getElementById('motherAge').value}) - Astro: ${document.getElementById('motherAstroDisplay').value}\n\n`;
    }

    try {
        statusText.innerText = "Connecting to astronomical backend for transits...";
        const chartPayload = { date: targetDate, time: "12:00:00", lat: bLat, lon: bLon };
        const calcResponse = await fetch(`${PROXY_BASE_URL}/calculate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chartPayload)
        });
        
        const chartData = await calcResponse.json();
        if (chartData.status !== 'success') throw new Error(chartData.message); 

        statusText.innerText = `Calculating Math & Synastry via AI...`;

        let flatBodies = [];
        if (chartData.houses) { chartData.houses.forEach(h => h.forEach(b => { if (b.name !== 'Earth') flatBodies.push(b); })); }
        
        let sun = flatBodies.find(g => g.name === 'Sun' || g.name === 'Surya' || g.name === 'Ravi');
        let moon = flatBodies.find(g => g.name === 'Moon' || g.name === 'Chandra');
        
        let exactVedicData = "";
        if (sun && moon) {
            let sunDeg = parseFloat(sun.abs_deg);
            let moonDeg = parseFloat(moon.abs_deg);

            let diff = moonDeg - sunDeg;
            if (diff < 0) diff += 360;
            let tithiIndex = Math.floor(diff / 12);
            let paksha = tithiIndex < 15 ? 'Shukla Paksha' : 'Krishna Paksha';
            let tithiName = VEDIC_TITHIS[tithiIndex];

            let nakIndex = Math.floor(moonDeg / (360/27));
            let nakName = VEDIC_NAKSHATRAS[nakIndex];
            
            let moonSignName = VEDIC_RASHIS[Math.floor(moonDeg / 30)];
            let sunSignName = VEDIC_RASHIS[Math.floor(sunDeg / 30)];

            exactVedicData = `
### EXACT VEDIC EPHEMERIS FOR TARGET DATE (ABSOLUTE TRUTH):
- Tithi: ${paksha} ${tithiName} (Phase Index: ${tithiIndex + 1}/30)
- Moon Nakshatra: ${nakName}
- Moon Sign (Rashi): ${moonSignName}
- Sun Sign (Rashi): ${sunSignName}
`;
        }

        let promptHeader = `SYSTEM PROTOCOL: INCOGNITO MODE. Act as a highly compassionate expert in BPHS (Vedic Astrology), Charaka Samhita (Ayurveda), and modern Obstetrics/Biology.\n\n`;
        let promptContent = `System Current Date: ${todayStr}\nUser Context/Natal Data:\n${userContextStr}\nHospital/Location: Lat ${bLat}, Lon ${bLon}\nTarget/Due Date: ${targetDate}\nMedical Notes: "${medicalNotes}"\n\n`;
        
        promptContent += exactVedicData + `\n### TRANSITING PLANETARY POSITIONS:\n`;
        flatBodies.forEach(b => { promptContent += `- ${b.name}: Sign ${b.sign} (Degree: ${safeDeg(b.abs_deg)})\n`; });

        if (currentMode === "conception") {
            promptContent += `\nINSTRUCTIONS FOR GARBHADHANA ANALYSIS:
            1. STRICT FUTURE TIMING: Provide dates strictly in the future compared to System Current Date (${todayStr}).
            2. COUPLE'S AGE ANALYSIS: Deeply evaluate the provided ages and adjust biological advice.
            3. VEDIC FILTERING (CRITICAL): You MUST use the "EXACT VEDIC EPHEMERIS" block provided above to evaluate the starting date. Filter fertile days using strict BPHS rules (Favorable Tithis: 2,3,5,7,10,11,12,13, Purnima. Avoid Amavasya/Chaturthi). Do NOT attempt to calculate the Tithi yourself; rely ONLY on the provided Ephemeris block.
            4. ECLIPSE (GRAHAN) CHECK: If Sun, Moon, and Rahu/Ketu are within 15 degrees, warn against conception.
            5. SCIENTIFIC REASONING: Explain biological relevance for EVERY chosen date.
            6. MANDATORY PROTOCOL SECTION: You MUST include a section at the beginning of your response titled "🕉️ Universal Garbhadhana Protocol (BPHS & Charaka Samhita)". Translate this section perfectly into the requested language and include these exact points:
               - Advanced Sphuta Calculation: Explain that this tool utilizes mathematical Beeja and Kshetra Sphuta formulas to determine biological compatibility.
               - Brahmacharya (Celibacy): Strict physical and mental celibacy for at least 3-4 days prior. Scientific reason: Builds Ojas, reduces psychological stress, improves sperm count/motility.
               - Diet (Ritucharya): Sattvic diet. Husband: warm milk with Ashwagandha/Saffron. Wife: milk with Shatavari/Ghee. Scientific reason: Optimizes hormonal balance and creates an alkaline uterine environment.
               - Mantra Jaap: Husband chants "Om Namo Bhagavate Vasudevaya" (108 times). Wife chants Santan Gopal Mantra: "Om Devaki Sudha Govinda Vasudeva Jagatpathe Dehime Tanayam Krishna Twamaham Sharanam Gata" (108 times).`;
		} else {
            promptContent += `\nINSTRUCTIONS FOR C-SECTION (JANMA MUHURTA) ANALYSIS:
            1. STRICT FUTURE TIMING: Provide dates strictly in the future.
            2. MOTHER'S AGE ANALYSIS: Prioritize safety and recovery.
            3. MUHURTA SELECTION: Based on the Doctor's date range and the "EXACT VEDIC EPHEMERIS", find the absolute best Lagna window. Place benefics (Jupiter, Venus) in Kendras/Trikonas. 
            4. ECLIPSE CHECK: Warn fiercely if an eclipse is near the delivery date.
            5. SCIENTIFIC GROUNDING: Follow every time-frame suggested with a Medical/Scientific reason.
            6. AYURVEDIC LABOR MANIPULATION (Charaka & Sushruta Samhita): Include a section titled "🌿 Ayurvedic Guidance for Natural Timing". Explain how to subtly adjust the timing of natural labor by manipulating 'Apana Vata':
               - To PREPONE (Accelerate/Induce): Advise stimulating Apana Vata. Suggest consuming warm milk with a spoon of Castor Oil (Eranda Taila), eating warm/spicy foods, walking, squatting, and remaining physically active.
               - To POSTPONE (Delay/Sustain): Advise pacifying Apana Vata to prevent premature uterine contractions. Suggest strict bed rest, maintaining a cool physical environment, avoiding mental stress, and consuming cool, sweet liquids like milk with Ghee and Shatavari.
            7. STRICT MEDICAL DISCLAIMER: You MUST conclude with a fierce warning that manipulating the onset of labor carries immense biological risks to both mother and child, and these Ayurvedic methods must ONLY be discussed with and approved by their modern obstetrician.`;
        }

        promptContent += `\nCRITICAL REQUIREMENT: Provide the final answer entirely in ${selectedLanguageName}. Use markdown styling.`;

        const payloadObject = {
            contents: [
                {
                    parts: [
                        { text: promptHeader + promptContent }
                    ]
                }
            ]
        };

        // Execute unified routing function
        const aiResponse = await fetchGeminiChat(payloadObject);

        if (!aiResponse.ok) throw new Error(`AI HTTP Error ${aiResponse.status}`); 
        const aiData = await aiResponse.json();
        
        if (aiData.candidates && aiData.candidates[0].content && aiData.candidates[0].content.parts) {
            rawAIResponse = aiData.candidates[0].content.parts[0].text;
            chatHistoryForAPI = [
                { role: "user", parts: [{ text: promptHeader + promptContent }] },
                { role: "model", parts: [{ text: rawAIResponse }] }
            ];
            document.getElementById('chat-history').innerHTML = ""; 
        } else throw new Error("Invalid format from AI.");
        
        resultText.innerHTML = marked.parse(rawAIResponse);
        resultWrapper.style.display = 'block';

    } catch (error) {
        console.error(error); alert(`Analysis Halted.\n\nReason: ${error.message}`);
    } finally {
        btn.disabled = false; loader.style.display = 'none'; statusText.innerText = "";
    }
});

// ==========================================
// CHAT & TTS ENGINE
// ==========================================
async function sendChatMessage() {
    const inputField = document.getElementById('chatInput');
    const userMsg = inputField.value.trim();
    if (!userMsg) return;

    const sendBtn = document.getElementById('chatSendBtn');
    const chatHistoryUI = document.getElementById('chat-history');
    const langStr = document.getElementById('langToggle').options[document.getElementById('langToggle').selectedIndex].text;
    
    inputField.value = ""; inputField.disabled = true; sendBtn.disabled = true; sendBtn.innerText = "Thinking...";

    const userDiv = document.createElement('div');
    userDiv.style.cssText = "align-self: flex-end; background: #ffe4e6; color: #881337; padding: 10px 15px; border-radius: 12px 12px 0 12px; max-width: 85%; font-size: 14px;";
    userDiv.innerHTML = `<strong>You:</strong> ${userMsg}`;
    chatHistoryUI.appendChild(userDiv);
    
    try {
        const reinforcement = `(Consultation Rule: Answer strictly applying Vedic rules based on the Ephemeris provided earlier. Provide scientific reasoning. Provide the answer entirely in ${langStr}):\n`;
        const newApiMsg = { role: "user", parts: [{ text: reinforcement + userMsg }] };
        
        const payloadObject = { contents: [...chatHistoryForAPI, newApiMsg] };

        // Execute unified routing function
        const response = await fetchGeminiChat(payloadObject);

        if (!response.ok) throw new Error("API Error");
        const data = await response.json();
        const aiResponseText = data.candidates[0].content.parts[0].text;

        chatHistoryForAPI.push(newApiMsg);
        chatHistoryForAPI.push({ role: "model", parts: [{ text: aiResponseText }] });

        const msgId = 'msg-' + Date.now();
        const aiDiv = document.createElement('div');
        aiDiv.style.cssText = "align-self: flex-start; background: #fff5f6; border: 1px solid #fecdd3; padding: 12px 15px; border-radius: 12px 12px 12px 0; max-width: 95%; font-size: 14px; display: flex; flex-direction: column; gap: 8px;";
        
        const textDiv = document.createElement('div');
        textDiv.className = 'markdown-body';
        textDiv.innerHTML = marked.parse(aiResponseText);
        
        const hiddenText = document.createElement('textarea');
        hiddenText.id = msgId; hiddenText.style.display = 'none'; hiddenText.value = aiResponseText;

        const ttsBtn = document.createElement('button');
        ttsBtn.className = "icon-btn";
        ttsBtn.style.cssText = "align-self: flex-end; width: 30px; height: 30px; font-size: 14px; background: white;";
        ttsBtn.innerHTML = "▶️";
        ttsBtn.onclick = function() { toggleChatTTS(msgId, this); };

        aiDiv.appendChild(textDiv); aiDiv.appendChild(hiddenText); aiDiv.appendChild(ttsBtn);
        chatHistoryUI.appendChild(aiDiv);

    } catch (error) {
        const errDiv = document.createElement('div');
        errDiv.style.cssText = "color: #e11d48; font-size: 12px; text-align: center;";
        errDiv.innerText = "Connection lost. Please try asking again.";
        chatHistoryUI.appendChild(errDiv);
    } finally {
        inputField.disabled = false; sendBtn.disabled = false; sendBtn.innerText = "Ask AI"; inputField.focus();
    }
}

document.getElementById('chatInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });

function cleanTextForTTS(text) {
    return text.replace(/[*_#`~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[<>()\[\]{}]/g, ' ').replace(/-{2,}/g, ' ').trim();
}

let synth = window.speechSynthesis;
let isSpeaking = false;
let utterance = null;

function toggleTTS() {
    const ttsBtn = document.getElementById('ttsBtn');
    const targetLangStr = document.getElementById('langToggle').value;
    if (!rawAIResponse) return;

    if (synth.speaking && !synth.paused && isSpeaking) {
        synth.pause(); isSpeaking = false; ttsBtn.innerText = "▶️"; ttsBtn.classList.remove('active');
    } else if (synth.paused) {
        synth.resume(); isSpeaking = true; ttsBtn.innerText = "⏸️"; ttsBtn.classList.add('active');
    } else {
        utterance = new SpeechSynthesisUtterance(cleanTextForTTS(rawAIResponse));
        utterance.lang = targetLangStr || 'en-US';
        utterance.onend = () => { isSpeaking = false; ttsBtn.innerText = "▶️"; ttsBtn.classList.remove('active'); };
        synth.speak(utterance); isSpeaking = true; ttsBtn.innerText = "⏸️"; ttsBtn.classList.add('active');
    }
}
function stopTTS() {
    if (synth.speaking) synth.cancel();
    isSpeaking = false;
    const mainBtn = document.getElementById('ttsBtn');
    if(mainBtn) { mainBtn.innerText = "▶️"; mainBtn.classList.remove('active'); }
}

function toggleChatTTS(elementId, btnElement) {
    const text = document.getElementById(elementId).value;
    const targetLangStr = document.getElementById('langToggle').value;
    
    if (activeChatTtsBtn === btnElement) {
        if (synth.speaking && !synth.paused && isSpeaking) {
            synth.pause(); isSpeaking = false; btnElement.innerText = "▶️"; btnElement.classList.remove('active');
        } else if (synth.paused) {
            synth.resume(); isSpeaking = true; btnElement.innerText = "⏸️"; btnElement.classList.add('active');
        } else { playNew(text, targetLangStr, btnElement); }
    } else {
        stopTTS(); 
        if (activeChatTtsBtn) { activeChatTtsBtn.innerText = "▶️"; activeChatTtsBtn.classList.remove('active'); }
        playNew(text, targetLangStr, btnElement);
    }

    function playNew(txt, langStr, btn) {
        const utterance = new SpeechSynthesisUtterance(cleanTextForTTS(txt));
        utterance.lang = langStr || 'en-US';
        utterance.onend = () => { isSpeaking = false; activeChatTtsBtn = null; btn.innerText = "▶️"; btn.classList.remove('active'); };
        synth.speak(utterance); isSpeaking = true; btn.innerText = "⏸️"; btn.classList.add('active');
        activeChatTtsBtn = btn;
    }
}