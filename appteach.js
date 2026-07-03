// --- 0. SECURITY, WAKE LOCK, VISIBILITY & FULLSCREEN ---
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) { e.preventDefault(); return false; }
    if (e.ctrlKey && ['U', 'S', 'P'].includes(e.key.toUpperCase())) { e.preventDefault(); return false; }
    if (e.ctrlKey && e.key.toUpperCase() === 'C' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); return false;
    }
});

let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log('Wake Lock Error:', err.message);
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    } else {
        if (ttsStatus === 'PLAYING') {
            ttsStatus = 'PAUSED';
            synth.cancel();
            if (window.currentPlayingBtn) {
                window.currentPlayingBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            }
        }
    }
});

// --- UPGRADED FULLSCREEN ENFORCER ---
function enforceFullscreen() {
    // Check if we are currently NOT in fullscreen
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        const docElm = document.documentElement;
        
        // Attempt to request fullscreen with cross-browser fallbacks
        if (docElm.requestFullscreen) {
            docElm.requestFullscreen().catch(() => {});
        } else if (docElm.webkitRequestFullscreen) { /* Safari & iOS */
            docElm.webkitRequestFullscreen().catch(() => {});
        } else if (docElm.msRequestFullscreen) { /* IE11/Edge Legacy */
            docElm.msRequestFullscreen().catch(() => {});
        }
    }
}

// Bind to the window and document to ensure EVERY interaction triggers it
['click', 'touchstart', 'touchend', 'keydown'].forEach(eventType => {
    window.addEventListener(eventType, enforceFullscreen, { capture: true, passive: true });
    document.addEventListener(eventType, enforceFullscreen, { capture: true, passive: true });
});


function unlockAudio() {
    const silent = new SpeechSynthesisUtterance('');
    silent.volume = 0;
    synth.speak(silent);
}

// --- 1. DATA STRUCTURES & CONFIG ---
const PROXY_URL = "https://eprashala.pythonanywhere.com/api/chat"; 

const MAHA_BOARD_SUBJECTS = {
    std1to2: ["Marathi (मराठी)", "English", "Mathematics (गणित)"],
    std3: ["Marathi (मराठी)", "English", "Mathematics (गणित)", "Environmental Studies (परिसर अभ्यास)"],
    std4to5: ["Marathi (मराठी)", "English", "Hindi (हिंदी)", "Mathematics (गणित)", "EVS Part 1 (परिसर अभ्यास १)", "EVS Part 2 (परिसर अभ्यास २ - शिवछत्रपती)"],
    std6to8: ["Marathi (मराठी)", "English", "Hindi (हिंदी)", "Mathematics (गणित)", "General Science (सामान्य विज्ञान)", "History & Civics (इतिहास व नागरिकशास्त्र)", "Geography (भूगोल)"],
    std9to10: ["Marathi (मराठी)", "English", "Hindi (हिंदी)", "Sanskrit (संस्कृत)", "Mathematics Part-I (Algebra / बीजगणित)", "Mathematics Part-II (Geometry / भूमिती)", "Science & Technology Part-1", "Science & Technology Part-2", "History & Political Science", "Geography (भूगोल)"],
    std11to12: [
        "English", "Marathi (मराठी)", "Hindi (हिंदी)", "Physics", "Chemistry", "Biology", 
        "Mathematics & Statistics", "Information Technology (IT)", "Economics (अर्थशास्त्र)", 
        "Book Keeping & Accountancy", "Organization of Commerce & Management (OCM)", 
        "Secretarial Practice (SP)", "History (इतिहास)", "Geography (भूगोल)", 
        "Political Science (राज्यशास्त्र)", "Sociology (समाजशास्त्र)", "Psychology (मानसशास्त्र)"
    ]
};

// --- 2. DOM & STATE ---
const UI = {
    overlay: document.getElementById('start-overlay'),
    log: document.getElementById('conversation-log'),
    status: document.getElementById('status-indicator'),
    textIn: document.getElementById('text-input'),
    btnSend: document.getElementById('btn-send'),
    btnMic: document.getElementById('btn-mic'),
    iconMicDefault: document.getElementById('icon-mic-default'),
    iconMicThinking: document.getElementById('icon-mic-thinking'),
    btnMute: document.getElementById('btn-mute'),
    btnRestart: document.getElementById('btn-restart'),
    btnPasteKey: document.getElementById('btn-paste-key'),
    btnSharePdf: document.getElementById('btn-share-pdf'),
    iconVol: document.getElementById('icon-vol'),
    iconMute: document.getElementById('icon-mute'),
    
    // Multimodal & Crop Additions
    btnQuizManual: document.getElementById('btn-quiz-manual'), 
    btnCamera: document.getElementById('btn-camera'),
    cameraInput: document.getElementById('camera-input'),
    cropModal: document.getElementById('crop-modal'),
    cropImage: document.getElementById('crop-image'),
    btnCropRetake: document.getElementById('btn-crop-retake'),
    btnCropDone: document.getElementById('btn-crop-done'),
    
    // Settings UI
    advToggle: document.getElementById('adv-toggle'),
    settingsModal: document.getElementById('settings-modal'),
    btnCloseSet: document.getElementById('btn-close-settings'),
    btnSaveSet: document.getElementById('btn-save-settings'),
    role: document.getElementById('user-role'),
    name: document.getElementById('manual-name'),
    age: document.getElementById('manual-age'),
    ageContainer: document.getElementById('age-container'),
    keyIn: document.getElementById('custom-api-key-input'),
    remember: document.getElementById('remember-checkbox'),
    welcome: document.getElementById('welcome-msg'),
    
    // Quiz UI
    quizModal: document.getElementById('quiz-modal'),
    btnQuizYes: document.getElementById('btn-quiz-yes'),
    btnQuizNo: document.getElementById('btn-quiz-no'),
    quizQCount: document.getElementById('quiz-q-count'),
	
	// Scoreboard Additions
    scoreContainer: document.getElementById('score-container'),
    currentScore: document.getElementById('current-score'),
    scoreIcon: document.getElementById('score-icon'),
    
    selMedium: document.getElementById('medium-selector'),
    selStd: document.getElementById('std-selector'),
    selSub: document.getElementById('subject-selector')
};

let chatHistory = [];
let recognition = null;
let synth = window.speechSynthesis;
let isListening = false; 
let pendingImageData = null; 
let cropper = null;
let state = { isProcessing: false, isMuted: false, lastAIMessage: "" };
let inningsScore = 0; // NEW: Track the current score

// TTS Tracking
let ttsStatus = 'STOPPED'; 
let lastSpokenIndex = 0;   
window.currentPlayingText = "";
window.currentPlayingBtn = null;

// --- TTS SANITIZER ---
// Removes Markdown and HTML so the Text-to-Speech engine doesn't read the symbols
function sanitizeForTTS(text) {
    return text
        .replace(/[*_#`~]/g, '') 
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') 
        .replace(/<[^>]+>/g, '') 
        .replace(/^[-*+]\s+/gm, '') 
        .trim();
}

// --- 3. INITIALIZATION ---
window.onload = () => {
    loadData();
    initSpeechRecognition(); 
    
    UI.role.addEventListener('change', (e) => {
        if(e.target.value === 'Teacher') UI.ageContainer.style.display = 'none';
        else UI.ageContainer.style.display = 'block';
    });
};

UI.overlay.addEventListener('click', () => {
    enforceFullscreen();
    requestWakeLock();
    unlockAudio(); 
    UI.overlay.style.display = 'none';
    setupEventListeners(); 
});

function updateSubjectsList() {
    const std = parseInt(UI.selStd.value);
    let subjects = [];
    
    if (std >= 1 && std <= 2) subjects = MAHA_BOARD_SUBJECTS.std1to2;
    else if (std === 3) subjects = MAHA_BOARD_SUBJECTS.std3;
    else if (std >= 4 && std <= 5) subjects = MAHA_BOARD_SUBJECTS.std4to5;
    else if (std >= 6 && std <= 8) subjects = MAHA_BOARD_SUBJECTS.std6to8;
    else if (std >= 9 && std <= 10) subjects = MAHA_BOARD_SUBJECTS.std9to10;
    else if (std >= 11 && std <= 12) subjects = MAHA_BOARD_SUBJECTS.std11to12;

    UI.selSub.innerHTML = '';
    subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.text = sub;
        UI.selSub.appendChild(opt);
    });
}

// --- 4. DATA MANAGEMENT ---
function loadData() {
    UI.role.value = localStorage.getItem('edu_role') || "Student";
    if(UI.role.value === 'Teacher') UI.ageContainer.style.display = 'none';

    UI.name.value = localStorage.getItem('edu_name') || "";
    UI.age.value = localStorage.getItem('edu_age') || "";
    UI.keyIn.value = localStorage.getItem('edu_api_key') || "";
    
    const savedMedium = localStorage.getItem('edu_medium');
    const savedStd = localStorage.getItem('edu_std');
    const savedSub = localStorage.getItem('edu_sub');
	inningsScore = parseInt(localStorage.getItem('edu_score')) || 0;
    UI.currentScore.innerText = inningsScore;
    if(inningsScore > 0) UI.scoreIcon.classList.remove('grayscale', 'opacity-80');
    
    UI.remember.checked = localStorage.getItem('edu_remember') !== 'false';

    if (savedMedium) UI.selMedium.value = savedMedium;
    if (savedStd) UI.selStd.value = savedStd;
    
    updateSubjectsList(); 
    if (savedSub && Array.from(UI.selSub.options).some(opt => opt.value === savedSub)) {
        UI.selSub.value = savedSub;
    }

    if (UI.remember.checked) {
        const savedHistory = localStorage.getItem('edu_history');
        if (savedHistory) {
            try {
                chatHistory = JSON.parse(savedHistory);
                if (chatHistory.length > 0) {
                    UI.welcome.style.display = 'none';
                    chatHistory.forEach(msg => {
                        const textPart = msg.parts.find(p => p.text)?.text || "📷 [Image attached]";
                        renderMessage(msg.role === 'user' ? (UI.name.value || UI.role.value) : "Teacher", textPart, msg.role === 'model', false); 
                    });
                    const lastModel = [...chatHistory].reverse().find(m => m.role === 'model');
                    if (lastModel) state.lastAIMessage = lastModel.parts.find(p => p.text)?.text || "";
                }
            } catch (e) {}
        }
    }
}

function saveData() {
    localStorage.setItem('edu_role', UI.role.value);
    localStorage.setItem('edu_name', UI.name.value);
    localStorage.setItem('edu_age', UI.age.value);
    localStorage.setItem('edu_api_key', UI.keyIn.value);
    localStorage.setItem('edu_medium', UI.selMedium.value);
    localStorage.setItem('edu_std', UI.selStd.value);
    localStorage.setItem('edu_sub', UI.selSub.value);
    localStorage.setItem('edu_remember', UI.remember.checked);
	localStorage.setItem('edu_score', inningsScore);
    
    if (UI.remember.checked && chatHistory.length > 0) {
        localStorage.setItem('edu_history', JSON.stringify(chatHistory));
    } else {
        localStorage.removeItem('edu_history');
    }
}

function clearData() {
    chatHistory = []; 
    state.lastAIMessage = ""; 
	inningsScore = 0; // Reset score on clear
    UI.currentScore.innerText = "0";
    UI.scoreIcon.classList.add('grayscale', 'opacity-80');
    localStorage.removeItem('edu_history');
    localStorage.setItem('edu_score', 0);
    UI.log.innerHTML = `<div class="text-gray-400 text-center mt-12 cinzel"><p class="text-sky-500 text-xl mb-2 font-bold">🧹 History Cleared</p>Let's start a new lesson.</div>`;
    synth.cancel();
    resetAllPlayButtons();
    ttsStatus = 'STOPPED';
    lastSpokenIndex = 0;
    window.currentPlayingText = "";
}

// --- 4.5 DYNAMIC APTITUDE QUIZ INTERCEPTOR ---
function calculateQuizQuestions() {
    const aiMessages = chatHistory.filter(m => m.role === 'model').length;
    if (aiMessages === 0) return 0;
    return Math.min(Math.max(aiMessages, 1), 5);
}

function triggerMilestoneQuiz(questionCount) {
    const hiddenQuizPrompt = `Let's play a knowledge check game! Act as a Quizmaster. Generate a multiple-choice quiz with exactly ${questionCount} questions based on our discussion today.
    
    CRITICAL RULES:
    1. Ask ONLY ONE question right now. Do not list them all.
    2. Wait for my reply.
    3. Grade my reply, tell me if I am right or wrong, then ask the next question.
    4. After the last question, give my final score. Praise me if I scored well, and thoroughly explain any mistakes so I can improve.`;
    
    processInput(hiddenQuizPrompt, true); 
}

// --- 5. SPEECH RECOGNITION ---
function initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    recognition = new SpeechRec();
    recognition.continuous = false; 
    recognition.interimResults = false; 
    
    recognition.onstart = () => {
        isListening = true;
        UI.btnMic.classList.add('mic-pulse');
        UI.status.style.backgroundColor = '#ef4444'; 
        UI.textIn.value = '';
        UI.textIn.placeholder = "Listening... Speak now.";
    };
    recognition.onresult = (e) => {
        const transcript = e.results[e.results.length - 1][0].transcript.trim();
        if (transcript) { UI.textIn.value = transcript; processInput(transcript); }
    };
    recognition.onend = () => {
        isListening = false;
        if (!state.isProcessing) resetMicUI();
    };
    recognition.onerror = (e) => {
        console.warn("Speech Recognition Error fired:", e.error);
        if (e.error === 'not-allowed') alert("Microphone access was blocked!");
        isListening = false; 
        resetMicUI();
    };
}

function resetMicUI() {
    UI.btnMic.classList.remove('mic-pulse');
    UI.status.style.backgroundColor = '#4b5563'; 
    UI.textIn.placeholder = pendingImageData ? "📷 Image attached! Add text or send..." : "Ask your question here...";
    setMicThinkingState(false);
}

function setMicThinkingState(isThinking) {
    if (isThinking) {
        UI.btnMic.classList.add('mic-thinking');
        UI.btnMic.classList.remove('mic-pulse');
        UI.iconMicDefault.classList.add('hidden');
        UI.iconMicThinking.classList.remove('hidden');
    } else {
        UI.btnMic.classList.remove('mic-thinking');
        UI.iconMicDefault.classList.remove('hidden');
        UI.iconMicThinking.classList.add('hidden');
    }
}

function updateScore(runs) {
    if (runs === 0) return;
    inningsScore += runs;
    UI.currentScore.innerText = inningsScore;
    
    // Visual celebration based on runs
    UI.scoreIcon.classList.remove('grayscale', 'opacity-80');
    UI.scoreContainer.classList.add('scale-110');
    
    if (runs >= 50) UI.scoreContainer.classList.add('bg-yellow-600/80', 'border-yellow-400');
    else if (runs >= 4) UI.scoreContainer.classList.add('bg-green-600/80', 'border-green-400');
    else UI.scoreContainer.classList.add('bg-sky-600/80', 'border-sky-400');

    setTimeout(() => {
        UI.scoreContainer.classList.remove('scale-110', 'bg-yellow-600/80', 'border-yellow-400', 'bg-green-600/80', 'border-green-400', 'bg-sky-600/80', 'border-sky-400');
    }, 500);
    saveData();
}

function exportChatToPDF() {
    if (chatHistory.length === 0) return alert("No chat history to export.");
    const container = document.createElement('div');
    container.style.padding = '30px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.backgroundColor = '#FFF';

    const title = document.createElement('h2');
    title.innerText = `Eprashala Notes: Std ${UI.selStd.value} - ${UI.selSub.value}`;
    title.style.borderBottom = '2px solid #ccc';
    title.style.paddingBottom = '15px';
    title.style.marginBottom = '20px';
    container.appendChild(title);

    chatHistory.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '20px';
        const sender = document.createElement('div');
        sender.innerText = msg.role === 'user' ? (UI.name.value || UI.role.value) : "Eprashala AI Teacher";
        sender.style.fontWeight = 'bold';
        sender.style.color = msg.role === 'user' ? '#0284c7' : '#16a34a';
        
        const textPart = msg.parts.find(p => p.text)?.text || "[Image Analyzed]";
        
        const content = document.createElement('div');
        content.innerHTML = msg.role === 'model' ? marked.parse(textPart) : textPart;
        content.style.marginTop = '5px';
        content.style.lineHeight = '1.5';
        
        msgDiv.appendChild(sender);
        msgDiv.appendChild(content);
        container.appendChild(msgDiv);
    });

    const opt = {
        margin: 0.5,
        filename: `Notes_Std${UI.selStd.value}_${UI.selSub.value.replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(container).save();
}

// --- 6. EVENT LISTENERS ---
function setupEventListeners() {
    UI.selMedium.addEventListener('change', saveData);
    UI.selStd.addEventListener('change', () => { updateSubjectsList(); saveData(); });
    UI.selSub.addEventListener('change', saveData);

    UI.advToggle.onclick = (e) => { e.stopPropagation(); UI.settingsModal.classList.remove('hidden'); };
    UI.btnCloseSet.onclick = (e) => { e.stopPropagation(); UI.settingsModal.classList.add('hidden'); };
    UI.btnSaveSet.onclick = (e) => { e.stopPropagation(); saveData(); UI.settingsModal.classList.add('hidden'); };
    UI.settingsModal.addEventListener('click', e => e.stopPropagation());
    
    // Crop Logic
    UI.btnCamera.addEventListener('click', (e) => {
        e.stopPropagation(); enforceFullscreen(); UI.cameraInput.click(); 
    });

    UI.cameraInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            UI.cropImage.src = e.target.result;
            UI.cropModal.classList.remove('hidden');
            if (cropper) cropper.destroy();
            cropper = new Cropper(UI.cropImage, {
                viewMode: 2, dragMode: 'move', autoCropArea: 0.9,
                restore: false, guides: true, center: true, highlight: false,
                cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
            });
        };
    });

    UI.btnCropRetake.addEventListener('click', (e) => {
        e.stopPropagation(); enforceFullscreen();
        if (cropper) cropper.destroy();
        UI.cropModal.classList.add('hidden');
        UI.cameraInput.value = ''; UI.cameraInput.click();
    });

    UI.btnCropDone.addEventListener('click', (e) => {
        e.stopPropagation(); enforceFullscreen();
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({ maxWidth: 800, maxHeight: 1200, fillColor: '#fff' });
        pendingImageData = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        cropper.destroy(); cropper = null;
        UI.cropModal.classList.add('hidden');
        UI.textIn.placeholder = "📷 Cropped image attached! Ask question...";
        UI.btnCamera.classList.remove('text-gray-400');
        UI.btnCamera.classList.add('text-sky-400');
    });

    UI.btnPasteKey.addEventListener('click', async (e) => {
        e.stopPropagation(); 
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                UI.keyIn.value = text;
                const originalText = UI.btnPasteKey.innerText;
                UI.btnPasteKey.innerText = "Pasted!";
                UI.btnPasteKey.classList.replace('bg-slate-700', 'bg-green-600');
                setTimeout(() => { 
                    UI.btnPasteKey.innerText = originalText; 
                    UI.btnPasteKey.classList.replace('bg-green-600', 'bg-slate-700');
                }, 1500);
            }
        } catch (err) { alert('Could not access clipboard.'); }
    });

    UI.btnMute.onclick = (e) => { 
        e.stopPropagation(); state.isMuted = !state.isMuted; 
        if(state.isMuted) { 
            synth.cancel(); ttsStatus = 'STOPPED'; resetAllPlayButtons(); window.currentPlayingText = "";
            UI.iconVol.classList.add('hidden'); UI.iconMute.classList.remove('hidden'); 
        } else { 
            UI.iconVol.classList.remove('hidden'); UI.iconMute.classList.add('hidden'); 
        } 
    };
    
    UI.btnSharePdf.onclick = (e) => { e.stopPropagation(); exportChatToPDF(); };

    // --- MANUAL QUIZ TRIGGER ---
    UI.btnQuizManual.addEventListener('click', (e) => {
        e.stopPropagation(); 
        enforceFullscreen();
        unlockAudio();

        const aiMessages = chatHistory.filter(m => m.role === 'model').length;
        if (aiMessages === 0) {
            alert("We need to chat a little bit first before I can create a quiz for you!");
            return;
        }

        const interactiveQuizPrompt = `Let's do a knowledge check! I want you to act as an interactive Quizmaster. 
        Generate a multiple-choice quiz with exactly 3 questions based ONLY on the educational topics we have discussed today.
        
        CRITICAL RULES:
        1. Ask ONLY ONE question right now (Question 1). Do NOT give me all the questions at once.
        2. Wait for my answer. 
        3. Once I answer, briefly tell me if I was right or wrong, and then immediately ask Question 2.
        4. Repeat this until all 3 questions are answered.
        5. After the final question, give me my total score. If I did well, praise me enthusiastically! If I got any wrong, please provide a detailed, easy-to-understand explanation of the correct answers so I can learn.`;

        processInput(interactiveQuizPrompt, true);
    });

    // --- QUIZ INTERCEPTION ---
    UI.btnRestart.onclick = (e) => { 
        e.stopPropagation(); 
        const qCount = calculateQuizQuestions();
        if (qCount > 0 && UI.role.value !== 'Teacher') { 
            UI.quizQCount.innerText = qCount;
            UI.quizModal.classList.remove('hidden');
        } else {
            clearData(); 
        }
    };

    UI.btnQuizNo.onclick = () => { UI.quizModal.classList.add('hidden'); clearData(); };
    UI.btnQuizYes.onclick = () => { 
        UI.quizModal.classList.add('hidden'); 
        const qCount = calculateQuizQuestions();
        triggerMilestoneQuiz(qCount); 
    };

    UI.btnSend.onclick = (e) => { e.stopPropagation(); enforceFullscreen(); unlockAudio(); processInput(UI.textIn.value); };
    
    UI.textIn.onkeypress = (e) => { 
        if(e.key === 'Enter') { e.stopPropagation(); enforceFullscreen(); unlockAudio(); processInput(UI.textIn.value); } 
    };

    UI.btnMic.addEventListener('click', (e) => {
        e.stopPropagation(); enforceFullscreen();
        if (state.isProcessing || !recognition) {
            if (!recognition) alert("Speech recognition is not supported in this browser.");
            return;
        }
        if (isListening) recognition.stop(); 
        else { 
            recognition.lang = UI.selMedium.value === 'Marathi' ? 'mr-IN' : 'en-IN'; 
            try { recognition.start(); } catch(err) { console.error(err); } 
        }
    });
}

// --- 7. AI LOGIC & PROCESSING ---
async function processInput(userText, isHiddenQuizTrigger = false) {
    userText = userText.trim();
    if (!userText && !pendingImageData) return; 

    // UI Resets
    UI.textIn.value = '';
    UI.textIn.placeholder = "Teacher is thinking...";
    UI.btnCamera.classList.remove('text-sky-400');
    UI.btnCamera.classList.add('text-gray-400');
    UI.cameraInput.value = '';
    if (UI.welcome) UI.welcome.style.display = 'none';
    
    state.isProcessing = true;
    UI.status.style.backgroundColor = '#facc15'; 
    setMicThinkingState(true);

    const userName = UI.name.value || UI.role.value;
    const displayMessage = userText || "📷 [Image attached for analysis]";
    
    if (!isHiddenQuizTrigger) {
        renderMessage(userName, displayMessage, false);
    }
    
    let messageParts = [];
    if (userText) messageParts.push({ text: userText });
    if (!userText && pendingImageData) messageParts.push({ text: "Please analyze this image." });
    if (pendingImageData) {
        messageParts.push({ inlineData: { mimeType: "image/jpeg", data: pendingImageData } });
    }

    chatHistory.push({ role: 'user', parts: messageParts });
    pendingImageData = null; 
    saveData();

	try {
        const res = await getAIResponse(chatHistory);
        // Rename to displayRes and use let so we can modify it
        let displayRes = res.trim();
        
        // --- SCORE INTERCEPTOR ---
        if (UI.role.value !== 'Teacher') {
            const scoreMatch = displayRes.match(/\[SCORE:(\d+)\]/);
            if (scoreMatch) {
                const runs = parseInt(scoreMatch[1], 10);
                updateScore(runs);
                // Strip the tag so the student doesn't see it
                displayRes = displayRes.replace(scoreMatch[0], '').trim();
            } else if (chatHistory.length > 2) {
                // Strike Rotation: 1 steady run for participating and moving the lesson forward
                updateScore(1); 
            }
        }
        
        // Ensure everything uses displayRes down here, NOT cleanRes
        state.lastAIMessage = displayRes;
        chatHistory.push({ role: 'model', parts: [{ text: displayRes }] });
        
        const playBtn = renderMessage("Teacher", displayRes, true, true);
        saveData();
        
        // Pass the SANITIZED version of the text to the audio engine
        if (!state.isMuted && playBtn) handleIndividualPlayPause(sanitizeForTTS(displayRes), playBtn);
    } catch (err) {
        renderMessage("System", "⚠️ Network interrupted. Please try again.", true);
    }

    state.isProcessing = false;
    resetMicUI();
}

async function getAIResponse(history) {
    const role = UI.role.value;
    const med = UI.selMedium.value;
    const std = UI.selStd.value;
    const sub = UI.selSub.value;
    const customKey = (UI.keyIn.value.trim().length > 10) ? UI.keyIn.value.trim() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (customKey) headers['X-Custom-Api-Key'] = customKey;

    let prompt = "";

    if (role === 'Teacher') {
        const teacherName = UI.name.value ? ` as ${UI.name.value}` : "";
        prompt = `You are an expert educational assistant helping a fellow teacher${teacherName}.
        Context: Maharashtra State Board (Balbharati), Standard ${std}, Subject: "${sub}", Medium: ${med}.
        CRITICAL RULES:
        1. Strictly adhere to the syllabus.
        2. Tone: Professional, helpful, collaborative.
        3. Language: Primary language is ${med}.
        4. FORMATTING: Use Markdown to format your response neatly (use **bold** for emphasis, bullet points for lists, and short paragraphs). Do NOT use complex LaTeX.`;
    } else {
        const studentName = UI.name.value || "Child";
        const estimatedAge = parseInt(std) + 5;
        const finalAge = UI.age.value ? parseInt(UI.age.value) : estimatedAge;
        const isYoung = finalAge <= 11 || parseInt(std) <= 5;
        
        const toneInstruction = isYoung ? 
            "Use EXTREMELY simple words. Keep answers SHORT, highly nurturing. Talk to them like a loving primary school teacher." : 
            "Use clear, encouraging explanations appropriate for a teenager.";

		const toneInstruction = isYoung ? 
            "Use EXTREMELY simple words. Keep answers strictly under 3 short sentences. Be highly nurturing, like a loving primary school teacher." : 
            "Use clear, encouraging explanations appropriate for a teenager. Limit your answers to 1 or 2 short paragraphs maximum.";

		prompt = `You are a highly polite, caring, and expert teacher.
        Context: You are teaching a student named ${studentName} (Age: ~${finalAge}), in Standard ${std}, Subject: "${sub}", Medium: ${med} (Maharashtra State Board).
        CRITICAL RULES:
        1. PERSONA: Answer in a gender-neutral, deeply caring way. Address them affectionately with respect.
        2. EXPERTISE: Draw explanations strictly from the textbook for this grade.
        3. COMPLEXITY & LENGTH: ${toneInstruction}
        4. Language: Primary language is ${med}.
        5. FORMATTING: Use Markdown to format your response neatly (use **bold** for emphasis, bullet points for lists, and short paragraphs). Do NOT use complex LaTeX.
        6. GAMIFICATION (CRICKET THEME): Act as an automated umpire to score the student's progress. Append a hidden tag exactly like [SCORE:X] at the very end of your response if they hit a milestone.
           - [SCORE:4] if they grasp a major topic (Boundary).
           - [SCORE:6] if they answer a quiz question perfectly (Sixer).
           - [SCORE:50] if they show 50% mastery of the current lesson (Fifty).
           - [SCORE:100] if they fully complete and master the chapter (Century).
           IMPORTANT: Do NOT explain the score or mention the tag to the user, just output the tag silently.`;
		   
    const payload = { 
        model: "gemini-3.1-flash", 
        contents: history.slice(-10), 
        systemInstruction: { parts: [{ text: prompt }] } 
    };

    const response = await fetch(PROXY_URL, { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// --- EXPERT DYNAMIC PLAY/PAUSE UI LOGIC ---
function resetAllPlayButtons() {
    document.querySelectorAll('.msg-play-btn').forEach(b => {
        b.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    });
}

function handleIndividualPlayPause(text, btnElement) {
    if (state.isMuted) return;

    const playIcon = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    const pauseIcon = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

    if (window.currentPlayingText === text) {
        if (ttsStatus === 'PAUSED') {
            ttsStatus = 'PLAYING';
            btnElement.innerHTML = pauseIcon; 
            synth.cancel(); 
            setTimeout(() => {
                const remainingText = text.substring(lastSpokenIndex);
                startNewUtterance(remainingText, text, btnElement, lastSpokenIndex);
            }, 50);
            return;
        } else if (ttsStatus === 'PLAYING') {
            ttsStatus = 'PAUSED';
            btnElement.innerHTML = playIcon; 
            synth.cancel(); 
            return;
        }
    }

    synth.cancel(); 
    resetAllPlayButtons();
    window.currentPlayingText = text;
    ttsStatus = 'PLAYING';
    lastSpokenIndex = 0;
    btnElement.innerHTML = pauseIcon; 

    setTimeout(() => { startNewUtterance(text, text, btnElement, 0); }, 50);
}

function startNewUtterance(textToSpeak, fullOriginalText, btnElement, offsetIndex) {
    if (!textToSpeak.trim()) {
        btnElement.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        ttsStatus = 'STOPPED'; return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    window.currentUtterance = utterance; 
    utterance.lang = UI.selMedium.value === 'Marathi' ? 'mr-IN' : 'en-IN';
    
    const isTeacher = UI.role.value === 'Teacher';
    const std = parseInt(UI.selStd.value);
    
    if (isTeacher) { utterance.rate = 1.0; utterance.pitch = 1.0; } 
    else if (std <= 5) { utterance.rate = 0.75; utterance.pitch = 1.15; } 
    else { utterance.rate = 0.9; utterance.pitch = 1.05; }
    
    utterance.onboundary = (event) => { lastSpokenIndex = offsetIndex + event.charIndex; };
    
    utterance.onend = () => {
        if (ttsStatus === 'PLAYING') {
            btnElement.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            ttsStatus = 'STOPPED'; window.currentPlayingText = ""; lastSpokenIndex = 0;
        }
    };
    utterance.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
            btnElement.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
            ttsStatus = 'STOPPED';
        }
    };

    synth.resume(); 
    synth.speak(utterance);
}

// --- RENDER UI ---
function renderMessage(sender, text, isModel, isNewMessage = true) {
    const div = document.createElement('div');
    div.className = `p-4 rounded-2xl ${isModel ? 'bg-[#0f172a]/90 border border-slate-700/50 shadow-lg ml-2 mr-8' : 'bg-sky-900/40 text-right mr-2 ml-8'} mb-4`;
    
    // NEW: Parse the markdown if it is from the AI, assign the markdown-body CSS class
    const parsedText = isModel ? marked.parse(text) : text;
    
    let htmlContent = `<div class="text-[10px] uppercase font-bold tracking-wider ${isModel ? 'text-sky-400 cinzel' : 'text-slate-300'} mb-1">${sender}</div>
                       <div class="text-sm leading-relaxed text-gray-100 markdown-body">${parsedText}</div>`;
    
    let playBtnElement = null;

    if (isModel) {
        htmlContent += `
            <div class="mt-3 flex justify-end gap-2">
                <button class="msg-pdf-btn p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 hover:text-red-400 transition-colors shadow-sm focus:outline-none" title="Download Answer as PDF">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </button>
                <button class="msg-copy-btn p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 hover:text-green-400 transition-colors shadow-sm focus:outline-none" title="Copy Answer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <button class="msg-play-btn p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-sky-400 transition-colors shadow-sm focus:outline-none" title="Play/Pause Audio">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
            </div>`;
    }

    div.innerHTML = htmlContent;

    if (isModel) {
        playBtnElement = div.querySelector('.msg-play-btn');
        div.querySelector('.msg-pdf-btn').addEventListener('click', (e) => { e.stopPropagation(); exportChatToPDF(); });
        
        // Pass the sanitized text to the play button
        playBtnElement.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            handleIndividualPlayPause(sanitizeForTTS(text), playBtnElement); 
        });
        
        div.querySelector('.msg-copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            // Copies the raw text, which is usually preferred over stripped text
            navigator.clipboard.writeText(text).then(() => {
                e.currentTarget.classList.replace('text-slate-400', 'text-green-400');
                setTimeout(() => { e.currentTarget.classList.replace('text-green-400', 'text-slate-400'); }, 1500);
            });
        });
    }

    UI.log.appendChild(div);
    setTimeout(() => { UI.log.scrollTop = UI.log.scrollHeight; }, 50);

    return playBtnElement;
}