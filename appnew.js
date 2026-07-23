// --- 1. Security & UI Lockdown ---
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') e.preventDefault();
    if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'c' || e.key === 'C')) e.preventDefault();
});

// --- 2. Application Logic & Central Routing ---
const PROXY_BASE_URL = "https://eprashala-proxy-511804777001.asia-south1.run.app";

async function fetchGeminiChat(payloadObject) {
    const userKey = localStorage.getItem('user_api_key') || '';

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
            console.warn("Primary channel busy. Re-routing to fallback...", error);
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${userKey.trim()}`;
            return await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadObject)
            });
        }
    } else {
        console.log("Proxy Route Active: Routing through centralized server...");
        return await fetch(`${PROXY_BASE_URL}/api/chat`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadObject)
        });
    }
}

// --- 3. Global State & DOM Element Holders ---
const langMap = { "English": "en-IN", "Hindi": "hi-IN", "Bengali": "bn-IN", "Telugu": "te-IN", "Marathi": "mr-IN", "Tamil": "ta-IN", "Gujarati": "gu-IN", "Kannada": "kn-IN", "Malayalam": "ml-IN", "Odia": "or-IN", "Punjabi": "pa-IN" };
let currentStream = null, activeImage = null, wakeLock = null;
let zoom = 1, offsetX = 0, offsetY = 0, isDragging = false, startX, startY;
let currentSynthUtterance = null, rawReportText = "";

// MediaPipe State Variables
let faceLandmarker = null;
let faceModelsLoaded = false;

// DOM Element Holders
let setupSection, mainWorkspace, userAgeSelect, video, canvas, ctx, zoomSlider, viewport, scannerLine, analyzeBtn, audioBtn, shareBtn;

// --- 4. Safe Application & MediaPipe Initialization ---
function initApp() {
    setupSection = document.getElementById('setupSection');
    mainWorkspace = document.getElementById('mainWorkspace');
    userAgeSelect = document.getElementById('userAge');
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    if (canvas) ctx = canvas.getContext('2d');
    zoomSlider = document.getElementById('zoomSlider');
    viewport = document.getElementById('viewport');
    scannerLine = document.getElementById('scannerLine');
    analyzeBtn = document.getElementById('analyzeBtn');
    audioBtn = document.getElementById('audioBtn');
    shareBtn = document.getElementById('shareBtn');

    // Populate Age Dropdown safely
    if (userAgeSelect && userAgeSelect.children.length === 0) {
        for (let i = 1; i <= 100; i++) {
            let option = document.createElement('option');
            option.value = i; option.text = i + " years old";
            if (i === 25) option.selected = true;
            userAgeSelect.appendChild(option);
        }
    }
    
    if (localStorage.getItem('user_api_key')) {
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) apiKeyInput.value = localStorage.getItem('user_api_key');
    }
    
    setupInteractionListeners();

    // Event Listeners for UI
    const pasteBtn = document.getElementById('pasteBtn');
    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                document.getElementById('apiKeyInput').value = text;
            } catch (err) { alert("Clipboard permission denied or unavailable. Please paste manually."); }
        });
    }

    const initBtn = document.getElementById('initBtn');
    if (initBtn) {
        initBtn.addEventListener('click', async () => {
            const name = document.getElementById('userName').value.trim();
            const sex = document.getElementById('userSex').value;
            if (!name || !sex) { alert("Please enter the subject's Name and Sex to proceed."); return; }
            requestFullScreen(); 
            await requestWakeLock(); 
            setupSection.style.display = 'none';
            mainWorkspace.style.display = 'flex';
            initCanvasDimensions();
            startCamera('user');
        });
    }

    if (audioBtn) audioBtn.addEventListener('click', toggleSpeech);
    
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const name = document.getElementById('userName').value || 'Subject';
            const reportDiv = document.getElementById('reportTarget');
            const cleanText = `Vedic Face Reading Report for ${name}\n\n${reportDiv.innerText}`;
            if (navigator.share) {
                try { await navigator.share({ title: `Vedic Face Reading - ${name}`, text: cleanText }); } 
                catch (err) { if (err.name !== 'AbortError') fallbackCopy(cleanText); }
            } else { fallbackCopy(cleanText); }
        });
    }

    const sharePdfBtn = document.getElementById('sharePdfBtn');
    if (sharePdfBtn) sharePdfBtn.addEventListener('click', () => window.print());

    // Init MediaPipe
    initMediaPipe();
}

async function initMediaPipe() {
    try {
        const visionPkg = window.vision || window;
        const { FaceLandmarker, FilesetResolver } = visionPkg;
        if (!FilesetResolver || !FaceLandmarker) {
            console.warn("MediaPipe Vision package not detected on window scope.");
            return;
        }
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: false,
            runningMode: "IMAGE",
            numFaces: 1
        });
        faceModelsLoaded = true;
        console.log("Client-side facial mesh calibrated and active.");
    } catch (err) { console.warn("Mesh calibration failed.", err); }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } 
else { initApp(); }

// --- 5. On-Device Samudrika Math Engine ---
function getEuclideanDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

function calculateSamudrikaMetrics(landmarks) {
    const p = (idx) => landmarks[idx];
    const IDX = { hairline: 10, glabella: 9, subnasale: 2, menton: 152, leftEyeOuter: 33, leftEyeInner: 133, rightEyeInner: 362, rightEyeOuter: 263, noseBridge: 6, noseTip: 1, noseLeft: 129, noseRight: 358, lipTop: 0, lipBottom: 17, cheekLeft: 234, cheekRight: 454 };

    const faceHeight = getEuclideanDistance(p(IDX.hairline), p(IDX.menton));
    const faceWidth = getEuclideanDistance(p(IDX.cheekLeft), p(IDX.cheekRight));
    
    const upperZone = getEuclideanDistance(p(IDX.hairline), p(IDX.glabella)) / faceHeight;
    const middleZone = getEuclideanDistance(p(IDX.glabella), p(IDX.subnasale)) / faceHeight;
    const lowerZone = getEuclideanDistance(p(IDX.subnasale), p(IDX.menton)) / faceHeight;

    const leftEyeW = getEuclideanDistance(p(IDX.leftEyeOuter), p(IDX.leftEyeInner));
    const rightEyeW = getEuclideanDistance(p(IDX.rightEyeOuter), p(IDX.rightEyeInner));
    const intercanthal = getEuclideanDistance(p(IDX.leftEyeInner), p(IDX.rightEyeInner));
    const eyeSpacingRatio = intercanthal / ((leftEyeW + rightEyeW) / 2);

    const noseRatio = getEuclideanDistance(p(IDX.noseBridge), p(IDX.noseTip)) / getEuclideanDistance(p(IDX.noseLeft), p(IDX.noseRight));
    const widthToHeightRatio = faceWidth / faceHeight;

    return {
        triBhaga: `Upper: ${(upperZone*100).toFixed(1)}%, Middle: ${(middleZone*100).toFixed(1)}%, Lower: ${(lowerZone*100).toFixed(1)}%`,
        eyeSpacing: `Ratio ${eyeSpacingRatio.toFixed(2)} (${eyeSpacingRatio > 1.15 ? 'Wide/Sattvic' : eyeSpacingRatio < 0.85 ? 'Close/Rajasic' : 'Balanced'})`,
        noseStructure: `Ratio ${noseRatio.toFixed(2)} (${noseRatio > 1.4 ? 'Elongated/Idealistic' : 'Broad/Grounded'})`,
        dosha: widthToHeightRatio > 0.85 ? "Kapha Base" : widthToHeightRatio < 0.72 ? "Vata Base" : "Pitta Base"
    };
}

// --- 6. Core Camera, UI, and File Upload Functions ---
async function requestWakeLock() {
    try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } 
    catch (err) { console.warn(`Wake Lock Error: ${err.message}`); }
}

function requestFullScreen() {
    const docEl = document.documentElement;
    if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) { docEl.requestFullscreen().catch(e => console.warn(e)); } 
        else if (docEl.webkitRequestFullscreen) { docEl.webkitRequestFullscreen().catch(e => console.warn(e)); }
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') await requestWakeLock();
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
    if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); video.srcObject = null; }
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
    if(!zoomSlider || !viewport) return;
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
    processCanvas.width = targetW; processCanvas.height = targetH;
    const pCtx = processCanvas.getContext('2d');

    if (activeImage) {
        const viewW = canvas.width / window.devicePixelRatio;
        const viewH = canvas.height / window.devicePixelRatio;
        const exportScale = targetW / viewW;
        pCtx.imageSmoothingEnabled = true; pCtx.imageSmoothingQuality = 'high';
        pCtx.save();
        pCtx.translate((targetW / 2) + (offsetX * exportScale), (targetH / 2) + (offsetY * exportScale));
        pCtx.scale(zoom * exportScale, zoom * exportScale);

        const imgRatio = activeImage.width / activeImage.height;
        const viewRatio = viewW / viewH;
        let drawW, drawH;
        if (imgRatio > viewRatio) { drawH = viewH; drawW = viewH * imgRatio; } 
        else { drawW = viewW; drawH = viewW / imgRatio; }
        
        pCtx.drawImage(activeImage, -drawW / 2, -drawH / 2, drawW, drawH);
        pCtx.restore();
    } else if (currentStream && video.readyState === video.HAVE_ENOUGH_DATA) {
        const targetRatio = targetW / targetH;
        const videoRatio = video.videoWidth / video.videoHeight;
        let sourceX = 0, sourceY = 0, sourceW = video.videoWidth, sourceH = video.videoHeight;
        if (videoRatio > targetRatio) { sourceW = video.videoHeight * targetRatio; sourceX = (video.videoWidth - sourceW) / 2; } 
        else { sourceH = video.videoWidth / targetRatio; sourceY = (video.videoHeight - sourceH) / 2; }
        pCtx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, targetW, targetH);
    } else { return null; }
    
    return processCanvas.toDataURL('image/jpeg', 0.85);
}

// --- 7. Scanning & Logic Sequence ---
async function initiateScanSequence() {
    const base64Data = captureFrameData();
    if (!base64Data) { alert("Please ensure the camera is active or an image is uploaded and positioned."); return; }

    let computedMetrics = null;

    if (faceModelsLoaded) {
        analyzeBtn.disabled = true; analyzeBtn.innerText = "Extracting Facial Coordinates...";
        const img = new Image(); img.src = base64Data;
        await new Promise(resolve => img.onload = resolve);
        
        const results = faceLandmarker.detect(img);
        if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
            analyzeBtn.disabled = false; analyzeBtn.innerText = "Commence Deep Face Scan";
            alert("Scan Failed: No human face detected. The Samudrika matrix requires a clear facial geometry to proceed.");
            return;
        }
        computedMetrics = calculateSamudrikaMetrics(results.faceLandmarks[0]);
    }

    window.speechSynthesis.cancel();
    if(audioBtn) audioBtn.style.display = 'none';
    if(shareBtn) shareBtn.style.display = 'none';
    const sharePdfBtn = document.getElementById('sharePdfBtn');
    if(sharePdfBtn) sharePdfBtn.style.display = 'none'; 

    analyzeBtn.disabled = true; analyzeBtn.innerText = "Scanning Elements...";
    scannerLine.style.display = 'block'; scannerLine.style.animation = 'none';
    void scannerLine.offsetWidth; 
    scannerLine.style.animation = 'scanAnimation 1.2s linear 3';

    setTimeout(() => {
        scannerLine.style.display = 'none';
        analyzeBtn.innerText = "Commence Deep Face Scan"; analyzeBtn.disabled = false;
        const capturedDisplay = document.getElementById('capturedDisplay');
        capturedDisplay.src = base64Data; capturedDisplay.style.display = 'block';
        runVedicAnalysis(base64Data, computedMetrics);
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
    
    synth.cancel(); audioBtn.innerHTML = "⏸️ Pause";
    const plainText = rawReportText.replace(/<[^>]*>?/gm, '').trim(); 
    currentSynthUtterance = new SpeechSynthesisUtterance(plainText);
    currentSynthUtterance.lang = langMap[targetLang] || 'en-IN';
    currentSynthUtterance.onend = () => { audioBtn.innerHTML = "🔊 Listen"; };
    currentSynthUtterance.onerror = () => { audioBtn.innerHTML = "🔊 Listen"; };
    synth.speak(currentSynthUtterance);
}

function fallbackCopy(text) {
    navigator.clipboard.writeText(text).then(() => { alert("Report copied to your clipboard!"); })
    .catch(err => { alert("Failed to copy text."); });
}

// --- 8. AI Routing & Analysis Generation ---
async function runVedicAnalysis(base64Data, computedMetrics) {
    const loader = document.getElementById('loader');
    const statusText = document.getElementById('statusText');
    const reportCard = document.getElementById('reportCard');
    const reportTarget = document.getElementById('reportTarget');
    
    const name = document.getElementById('userName').value;
    const age = document.getElementById('userAge').value;
    const sex = document.getElementById('userSex').value;
    const targetLang = document.getElementById('userLang').value;
    
    loader.style.display = 'block'; statusText.style.display = 'block';
    statusText.innerText = "Processing Samudrika matrices via AI router...";
    reportCard.classList.remove('active');

    const metricString = computedMetrics ? `
### PRE-COMPUTED BIOMETRIC MATRIX (EXACT 3D MESH DATA)
- **Tri-Bhaga (Three Zones) Proportions**: ${computedMetrics.triBhaga}
- **Netra (Eye) Geometry**: ${computedMetrics.eyeSpacing}
- **Nasika (Nose) Geometry**: ${computedMetrics.noseStructure}
- **Ayurvedic Facial Dosha Baseline**: ${computedMetrics.dosha}
` : "BIOMETRIC MATRIX UNAVAILABLE - RELY ON VISUAL ESTIMATION.";

    const systemPrompt = `You are a master expert in Vedic Face Reading (Mukha Samudrika Shastra).
The subject is ${name}, a ${age}-year-old ${sex}. 
Address the report directly to ${name} or in the third person regarding them.

${metricString}

CRITICAL INSTRUCTIONS:
1. Cross-reference the exact geometric proportions provided in the Biometric Matrix against classical Samudrika Shastra rules. Do not hallucinate physical dimensions; use the math provided.
2. Perform a microscopic, exhaustive analysis of the facial geometry, examining every subtle feature according to ancient principles.
3. Be brutally honest. Do not flatter.

Analyze:
1. Forehead & Hairline (Lalata & Kesha-Rekha)
2. Eyebrows & Eyes (Bhru & Netra)
3. Nose & Nostrils (Nasika)
4. Mouth, Lips & Teeth (Ostha & Danta)
5. Jaw, Chin & Structure (Chibuka & Tridosha)
6. Sensuality & Desires (Kama & Indriya Nigraha)

Provide the quantitative matrix (0-100%) for:
A. The Four Purusharthas (Dharma, Artha, Kama, Moksha)
B. The Inner Enemies (Kaam, Krodh, Moha, Maya, Matsar)
C. Emotional Integrity
D. Mental Resilience
E. Purpose and Execution

Write your ENTIRE response exclusively in ${targetLang}. Deliver using cleanly structured HTML sections (using h3 elements, strong bullet lists, and readable spacing). Do not use markdown backticks around the HTML.`;

    const rawBase64 = base64Data.split(',')[1];
    const payload = {
        contents: [{ parts: [ { text: systemPrompt }, { inlineData: { mimeType: "image/jpeg", data: rawBase64 } } ] }]
    };

    try {
        const response = await fetchGeminiChat(payload);
        if (!response.ok) { throw new Error(`Server returned status: ${response.status}`); }

        const data = await response.json();
        
        if(data.candidates && data.candidates[0].content.parts[0].text) {
            let resultText = data.candidates[0].content.parts[0].text;
            resultText = resultText.replace(/```html/g, '').replace(/```/g, '').trim();
            
            rawReportText = resultText; 
            reportTarget.innerHTML = resultText;
            
            if(audioBtn) { audioBtn.style.display = 'flex'; audioBtn.innerHTML = "🔊 Listen"; }
            const sharePdfBtn = document.getElementById('sharePdfBtn');
            if(sharePdfBtn) sharePdfBtn.style.display = 'block'; 
        } else {
            throw new Error("Invalid payload format received.");
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