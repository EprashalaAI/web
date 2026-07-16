// --- 1. Security & UI Lockdown ---
// Disable right-click
document.addEventListener('contextmenu', event => event.preventDefault());

// Disable common save and inspect shortcuts
document.addEventListener('keydown', (e) => {
    // Prevent F12
    if (e.key === 'F12') {
        e.preventDefault();
    }
    // Prevent Ctrl+S (Save), Ctrl+U (View Source), Ctrl+P (Print - optional block if you want it, though you have a print button)
    if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
    }
    // Prevent Ctrl+Shift+I / Cmd+Option+I (DevTools) or Ctrl+Shift+C
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
    }
});

// --- 2. Application Logic & Central Routing ---
const PROXY_BASE_URL = "https://eprashala-proxy-511804777001.asia-south1.run.app";

async function fetchGeminiChat(payloadObject) {
    const userKey = localStorage.getItem('user_api_key') || '';

    // TIER 1: User has their own key -> Direct browser handoff to Google
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
            console.warn("Primary channel busy/unavailable. Re-routing to fallback...", error);
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${userKey.trim()}`;
            return await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadObject)
            });
        }
    } 
    
    // TIER 2: No personal key provided -> Route to your centralized Mumbai server
    else {
        console.log("Proxy Route Active: Routing through centralized server...");
        return await fetch(`${PROXY_BASE_URL}/api/chat`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadObject)
        });
    }
}

const langMap = { "English": "en-IN", "Hindi": "hi-IN", "Bengali": "bn-IN", "Telugu": "te-IN", "Marathi": "mr-IN", "Tamil": "ta-IN", "Gujarati": "gu-IN", "Kannada": "kn-IN", "Malayalam": "ml-IN", "Odia": "or-IN", "Punjabi": "pa-IN" };

let currentStream = null;
let activeImage = null;
let wakeLock = null;
let zoom = 1, offsetX = 0, offsetY = 0, isDragging = false, startX, startY;

let currentSynthUtterance = null;
let rawReportText = "";
let faceModelsLoaded = false;

const setupSection = document.getElementById('setupSection');
const mainWorkspace = document.getElementById('mainWorkspace');
const userAgeSelect = document.getElementById('userAge');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const zoomSlider = document.getElementById('zoomSlider');
const viewport = document.getElementById('viewport');
const scannerLine = document.getElementById('scannerLine');
const analyzeBtn = document.getElementById('analyzeBtn');
const audioBtn = document.getElementById('audioBtn');

const shareBtn = document.getElementById('shareBtn');

window.addEventListener('DOMContentLoaded', async () => {
    for (let i = 1; i <= 100; i++) {
        let option = document.createElement('option');
        option.value = i; option.text = i + " years old";
        if (i === 25) option.selected = true;
        userAgeSelect.appendChild(option);
    }
    if (localStorage.getItem('user_api_key')) {
        document.getElementById('apiKeyInput').value = localStorage.getItem('user_api_key');
    }
    setupInteractionListeners();

    // Paste Button Logic
    document.getElementById('pasteBtn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('apiKeyInput').value = text;
        } catch (err) {
            alert("Clipboard permission denied or unavailable. Please paste manually.");
        }
    });

      try {
        // Loading weights directly from the official repo for the TinyFaceDetector
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        faceModelsLoaded = true;
        console.log("Client-side face validation active.");
    } catch (err) {
        console.warn("Could not load face validation models. App will run without pre-validation.", err);
    }
});

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Screen Wake Lock activated.');
        }
    } catch (err) {
        console.warn(`Wake Lock Error: ${err.name}, ${err.message}`);
    }
}

function requestFullScreen() {
    const docEl = document.documentElement;
    if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) { docEl.requestFullscreen().catch(err => console.warn(err)); } 
        else if (docEl.webkitRequestFullscreen) { docEl.webkitRequestFullscreen().catch(err => console.warn(err)); }
        else if (docEl.msRequestFullscreen) { docEl.msRequestFullscreen().catch(err => console.warn(err)); }
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});

document.getElementById('initBtn').addEventListener('click', async () => {
    const name = document.getElementById('userName').value.trim();
    const sex = document.getElementById('userSex').value;
    
    if (!name || !sex) {
        alert("Please enter the subject's Name and Sex to proceed.");
        return;
    }

    requestFullScreen(); 
    await requestWakeLock(); 

    setupSection.style.display = 'none';
    mainWorkspace.style.display = 'flex';
    
    initCanvasDimensions();
    startCamera('user');
});

function initCanvasDimensions() {
    canvas.width = viewport.clientWidth * window.devicePixelRatio;
    canvas.height = viewport.clientHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

async function startCamera(mode) {
    if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); }
    activeImage = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    video.style.display = 'block';
    zoomSlider.disabled = true;

    try {
        const constraints = { video: { facingMode: mode, width: { ideal: 1080 }, height: { ideal: 1350 } } };
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
    } catch (err) { console.warn("Camera init failed:", err.message); }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    video.style.display = 'none';

    const reader = new FileReader();
    reader.onload = function(e) {
        activeImage = new Image();
        activeImage.onload = function() {
            zoom = 1; offsetX = 0; offsetY = 0;
            zoomSlider.value = 1; zoomSlider.disabled = false;
            renderCanvasTransformations();
        }
        activeImage.src = e.target.result;
    }
    reader.readAsDataURL(file);
    event.target.value = '';
}

function setupInteractionListeners() {
    zoomSlider.addEventListener('input', (e) => { zoom = parseFloat(e.target.value); renderCanvasTransformations(); });
    viewport.addEventListener('mousedown', (e) => {
        if (!activeImage) return;
        isDragging = true; startX = e.clientX - offsetX; startY = e.clientY - offsetY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        offsetX = e.clientX - startX; offsetY = e.clientY - startY; renderCanvasTransformations();
    });
    window.addEventListener('mouseup', () => isDragging = false);

    viewport.addEventListener('touchstart', (e) => {
        if (!activeImage || e.touches.length !== 1) return;
        isDragging = true; startX = e.touches[0].clientX - offsetX; startY = e.touches[0].clientY - offsetY;
    });
    viewport.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        offsetX = e.touches[0].clientX - startX; offsetY = e.touches[0].clientY - startY; renderCanvasTransformations();
    });
    viewport.addEventListener('touchend', () => isDragging = false);
}

function renderCanvasTransformations() {
    if (!activeImage) return;
    const viewW = canvas.width / window.devicePixelRatio;
    const viewH = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(viewW / 2 + offsetX, viewH / 2 + offsetY);
    ctx.scale(zoom, zoom);
    const imgRatio = activeImage.width / activeImage.height;
    const viewRatio = viewW / viewH;
    let drawW, drawH;

    if (imgRatio > viewRatio) { drawH = viewH; drawW = viewH * imgRatio; } 
    else { drawW = viewW; drawH = viewW / imgRatio; }

    ctx.drawImage(activeImage, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
}

function toggleModal(show) { document.getElementById('settingsModal').classList.toggle('active', show); }
function saveSettings() {
    const key = document.getElementById('apiKeyInput').value.trim();
    localStorage.setItem('user_api_key', key);
    toggleModal(false);
}

function captureFrameData() {
    const targetW = 600;
    const targetH = 750;
    const processCanvas = document.createElement('canvas');
    processCanvas.width = targetW; 
    processCanvas.height = targetH;
    const pCtx = processCanvas.getContext('2d');

    if (activeImage) {
        const viewW = canvas.width / window.devicePixelRatio;
        const viewH = canvas.height / window.devicePixelRatio;
        
        // Calculate the scale difference between the UI viewport and the final export canvas
        const exportScale = targetW / viewW;

        pCtx.imageSmoothingEnabled = true; 
        pCtx.imageSmoothingQuality = 'high';
        
        pCtx.save();
        
        // 1. Translate to the center of the export canvas PLUS the user's panned offsets scaled up
        pCtx.translate((targetW / 2) + (offsetX * exportScale), (targetH / 2) + (offsetY * exportScale));
        
        // 2. Apply both the user's zoom factor AND the viewport-to-export scale factor
        pCtx.scale(zoom * exportScale, zoom * exportScale);

        const imgRatio = activeImage.width / activeImage.height;
        const viewRatio = viewW / viewH;
        let drawW, drawH;
        
        if (imgRatio > viewRatio) { 
            drawH = viewH; 
            drawW = viewH * imgRatio; 
        } else { 
            drawW = viewW; 
            drawH = viewW / imgRatio; 
        }
        
        // 3. Draw the image with original calculated dimensions
        pCtx.drawImage(activeImage, -drawW / 2, -drawH / 2, drawW, drawH);
        pCtx.restore();
        
    } else if (currentStream && video.readyState === video.HAVE_ENOUGH_DATA) {
        const videoW = video.videoWidth;
        const videoH = video.videoHeight;
        const targetRatio = targetW / targetH;
        const videoRatio = videoW / videoH;
        
        let sourceX = 0, sourceY = 0, sourceW = videoW, sourceH = videoH;
        
        if (videoRatio > targetRatio) {
            sourceW = videoH * targetRatio;
            sourceX = (videoW - sourceW) / 2;
        } else {
            sourceH = videoW / targetRatio;
            sourceY = (videoH - sourceH) / 2;
        }
        pCtx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, targetW, targetH);
    } else { 
        return null; 
    }
    
    return processCanvas.toDataURL('image/jpeg', 0.85);
}

async function initiateScanSequence() {
    const base64Data = captureFrameData();
    if (!base64Data) {
        alert("Please ensure the camera is active or an image is uploaded and positioned.");
        return;
    }

    // --- NEW: Client-Side Face Validation ---
    if (faceModelsLoaded) {
        analyzeBtn.disabled = true;
        analyzeBtn.innerText = "Verifying Subject...";
        
        // Convert base64 to an Image element for face-api
        const img = new Image();
        img.src = base64Data;
        await new Promise(resolve => img.onload = resolve);
        
        // Run the TinyFaceDetector
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());
        
        if (detections.length === 0) {
            analyzeBtn.disabled = false;
            analyzeBtn.innerText = "Commence Deep Face Scan";
            alert("Scan Failed: No human face detected. The Samudrika matrix requires a clear facial geometry to proceed.");
            return; // Halt execution completely
        }
    }
    // -----------------------------------------

    window.speechSynthesis.cancel();
    audioBtn.style.display = 'none';
    shareBtn.style.display = 'none';
    document.getElementById('sharePdfBtn').style.display = 'none'; 

    analyzeBtn.disabled = true;
    analyzeBtn.innerText = "Scanning Elements...";
    
    scannerLine.style.display = 'block';
    scannerLine.style.animation = 'none';
    void scannerLine.offsetWidth; 
    scannerLine.style.animation = 'scanAnimation 1.2s linear 3';

    setTimeout(() => {
        scannerLine.style.display = 'none';
        analyzeBtn.innerText = "Commence Deep Face Scan";
        analyzeBtn.disabled = false;
        
        const capturedDisplay = document.getElementById('capturedDisplay');
        capturedDisplay.src = base64Data;
        capturedDisplay.style.display = 'block';
        
        runVedicAnalysis(base64Data);
    }, 3600); 
}

function toggleSpeech() {
    const synth = window.speechSynthesis;
    const targetLang = document.getElementById('userLang').value;
    
    if (synth.speaking) {
        if (synth.paused) { synth.resume(); audioBtn.innerHTML = "⏸️ Pause"; } 
        else { synth.pause(); audioBtn.innerHTML = "▶️ Resume"; }
        return;
    }
    
    synth.cancel();
    audioBtn.innerHTML = "⏸️ Pause";
    
    const plainText = rawReportText.replace(/<[^>]*>?/gm, '').trim(); 
    currentSynthUtterance = new SpeechSynthesisUtterance(plainText);
    currentSynthUtterance.lang = langMap[targetLang] || 'en-IN';
    
    currentSynthUtterance.onend = () => { audioBtn.innerHTML = "🔊 Listen"; };
    currentSynthUtterance.onerror = () => { audioBtn.innerHTML = "🔊 Listen"; };
    synth.speak(currentSynthUtterance);
}

audioBtn.addEventListener('click', toggleSpeech);

shareBtn.addEventListener('click', async () => {
    const name = document.getElementById('userName').value || 'Subject';
    const reportDiv = document.getElementById('reportTarget');
    const cleanText = `Vedic Face Reading Report for ${name}\n\n${reportDiv.innerText}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `Vedic Face Reading - ${name}`,
                text: cleanText
            });
        } catch (err) {
            if (err.name !== 'AbortError') { fallbackCopy(cleanText); }
        }
    } else {
        fallbackCopy(cleanText);
    }
});

document.getElementById('sharePdfBtn').addEventListener('click', () => {
    window.print();
});

function fallbackCopy(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Report copied to your clipboard!");
    }).catch(err => {
        alert("Failed to copy text.");
    });
}

async function runVedicAnalysis(base64Data) {
    const loader = document.getElementById('loader');
    const statusText = document.getElementById('statusText');
    const reportCard = document.getElementById('reportCard');
    const reportTarget = document.getElementById('reportTarget');
    
    const name = document.getElementById('userName').value;
    const age = document.getElementById('userAge').value;
    const sex = document.getElementById('userSex').value;
    const targetLang = document.getElementById('userLang').value;
    
    loader.style.display = 'block';
    statusText.style.display = 'block';
    statusText.innerText = "Mapping demographic baselines to 478 biometric points...";
    reportCard.classList.remove('active');

    const systemPrompt = `You are a master expert in Vedic Face Reading (Mukha Samudrika Shastra), deep Indian astrological mappings, and high-level physical feature analysis. This is a real, serious diagnostic tool meant to deliver the absolute, unfiltered truth. Do not flatter. Do not sugarcoat. Analyze with 100% honesty.

The subject is ${name}, a ${age}-year-old ${sex}. 
CRITICAL: Calibrate your karmic and psychological baseline based on the subject's age (${age}) and sex (${sex}). Address the report directly to ${name} or in the third person regarding them.

Perform a microscopic, exhaustive analysis of the facial geometry, examining every subtle feature according to ancient Samudrika principles. Leave no aspect unaddressed:

1. **Forehead & Hairline (Lalata & Kesha-Rekha):** Width, vertical lines, planetary mounts, and hairline shape. What is their real intellectual capacity, stubbornness, and karmic baggage?
2. **Eyebrows (Bhru):** Density, arch, thickness, and spacing. Reveal their true temperament, inherent logic, and relationship with anger or control. 
3. **Eyes & Pupils (Netra & Tara):** Size, depth, dilation, distance, and the state of the sclera. State clearly if they reflect a Sattvic (pure), Rajasic (restless/desirous), or Tamasic (cunning/lethargic) soul. 
4. **Eyelashes (Pakshma):** Density, direction, and curl. What do they reveal about vital energy and emotional guarding?
5. **Nose & Nostrils (Nasika & Nasa-Puta):** Ridge stability, apex sharpness, and nostril flare/exposure. Reveal the exact truth about their ego, wealth-retention capacity, and core vitality.
6. **Ears (Karna):** Structure, lobe attachment, and placement relative to the eyes. What is their true intuition level and capacity to listen?
7. **Mouth, Lips & Teeth (Ostha, Mukha & Danta):** Thickness, symmetry, and corner inclination. Reveal their speech traits—do they lie, manipulate, or speak harshly? 
8. **Jaw & Chin (Chibuka & Hanu):** Structural grit, width, and projection. Will they buckle under pressure or possess an unbreakable will?
9. **Complexion & Skin Texture (Chhavi & Twak):** The underlying luster (Ojas) or dullness. What does this say about empowering their internal health?
10. **Ayurvedic Prakriti:** Structural Dosha mapping (Vata, Pitta, Kapha).
11. **Sensuality & Desires (Kama Assessment):** Analyze the eyes, lips, and facial fleshiness to evaluate their sexual drive and sensual regulation (Indriya Nigraha). Do not hide anything. Be brutally honest. Do they possess a high, unregulated sex drive, perverse tendencies, or deviant appetites? Or are their senses controlled?

### THE QUANTITATIVE MATRIX (0-100%)
Based on the above information, provide exact, brutally honest percentage scores for the following traits. Format this beautifully in HTML.

**A. The Four Purusharthas (Life Pursuits)**
* Dharma (Righteousness/Duty): %
* Artha (Wealth/Material Purpose): %
* Kama (Desires/Passions): %
* Moksha (Detachment/Spiritual Liberation): %

**B. The Inner Enemies (Arishadvarga Vulnerabilities)**
* Kaam (Lust/Unregulated Desire): %
* Krodh (Anger/Rage): %
* Moha (Delusion/Attachment): %
* Maya/Mada (Arrogance/Ego): %
* Matsar (Jealousy/Envy): %

**C. Emotional and Social Integrity**
* Empathy (Understanding others): %
* Humility (Ego suppression): %
* Accountability (Taking ownership): %
* Respectfulness (Dignity to others): %

**D. Mental and Behavioral Resilience**
* Adaptability (Pivoting under stress): %
* Self-Regulation (Managing impulses): %
* Patience (Tolerating hardship): %

**E. Purpose and Execution**
* Consistency (Reliability over time): %
* Generosity (Selfless sharing): %
* Discretion (Keeping confidence/secrets): %

CRITICAL INSTRUCTION: Write your ENTIRE response exclusively in the ${targetLang} language. Deliver the response using cleanly structured HTML sections (using h3 elements, strong bullet lists, and readable spacing). Do not use markdown backticks around the HTML inside your payload response.`;

    const rawBase64 = base64Data.split(',')[1];
    const payload = {
        contents: [{ parts: [ { text: systemPrompt }, { inlineData: { mimeType: "image/jpeg", data: rawBase64 } } ] }]
    };

	try {
        // Hand the payload directly to the automated router
        const response = await fetchGeminiChat(payload);
        
        if (!response.ok) { throw new Error(`Server returned status: ${response.status}`); }

        const data = await response.json();
        
        if(data.candidates && data.candidates[0].content.parts[0].text) {
            let resultText = data.candidates[0].content.parts[0].text;
            resultText = resultText.replace(/```html/g, '').replace(/```/g, '').trim();
            
            rawReportText = resultText; 
            reportTarget.innerHTML = resultText;
            
            audioBtn.style.display = 'flex';
            audioBtn.innerHTML = "🔊 Listen";
            
            document.getElementById('sharePdfBtn').style.display = 'block'; 
            
        } else {
            throw new Error("Invalid payload format received from the matrix.");
        }
        
        reportCard.classList.add('active');
        reportCard.scrollIntoView({ behavior: 'smooth' });
        
    } catch (err) {
        alert("Processing Error: " + err.message + "\nCheck proxy server connectivity.");
    } finally {
        loader.style.display = 'none';
        statusText.style.display = 'none';
    }
}