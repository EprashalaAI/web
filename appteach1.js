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
    } catch (err) { }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

function enforceFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        const docElm = document.documentElement;
        if (docElm.requestFullscreen) {
            docElm.requestFullscreen().catch(() => {});
        } else if (docElm.webkitRequestFullscreen) { 
            docElm.webkitRequestFullscreen().catch(() => {});
        } else if (docElm.msRequestFullscreen) { 
            docElm.msRequestFullscreen().catch(() => {});
        }
    }
}

['click', 'touchstart', 'touchend', 'keydown'].forEach(eventType => {
    window.addEventListener(eventType, enforceFullscreen, { capture: true, passive: true });
    document.addEventListener(eventType, enforceFullscreen, { capture: true, passive: true });
});

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
    btnStop: document.getElementById('btn-stop'),
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
    
    // Right Side Settings & History Modal
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
    ttsEngine: document.getElementById('tts-engine-selector'),
    welcome: document.getElementById('welcome-msg'),
    
    mainView: document.getElementById('settings-main-view'),
    historyView: document.getElementById('settings-history-view'),
    btnHistoryBack: document.getElementById('btn-history-back'),

    // Left Side Reading Settings
    leftAdvToggle: document.getElementById('left-adv-toggle'),
    leftSettingsModal: document.getElementById('left-settings-modal'),
    btnCloseLeftSet: document.getElementById('btn-close-left-settings'),
    btnSaveLeftSet: document.getElementById('btn-save-left-settings'),
    fontSizeSlider: document.getElementById('font-size-slider'),
    fontSizeVal: document.getElementById('font-size-val'),
    ttsSpeedSlider: document.getElementById('tts-speed-slider'),
    ttsSpeedVal: document.getElementById('tts-speed-val'),
    highlightCheckbox: document.getElementById('highlight-checkbox'),
    
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

// --- GLOBAL STATE ---
let chatHistory = [];
let recognition = null;
let isListening = false; 
let pendingImageData = null; 
let cropper = null;
let state = { isProcessing: false, isMuted: false, lastAIMessage: "" };
let inningsScore = 0; 
let currentAborter = null;

// History Vault State
let allSessions = []; 
const currentDateKey = new Date().toISOString().split('T')[0];
let currentSessionId = Date.now();

// Cloud/Native TTS & Highlight State
let ttsStatus = 'STOPPED';
let currentActiveBtn = null;
let currentAudio = new Audio(); 
let audioChunks = [];
let currentChunkIndex = 0;
let globalWordIndex = 0;
let highlightTimer = null;
let wordsArray = [];
let lastHighlightedSpan = null;
window.currentPlayingText = "";

const speechDataMap = {};
const rawTextMap = {};

// --- EDIT PENCIL MANAGER ---
function updateEditPencil() {
    document.querySelectorAll('.user-edit-btn').forEach(btn => btn.classList.add('hidden'));
    const allUserBtns = document.querySelectorAll('.user-edit-btn');
    if (allUserBtns.length > 0) {
        allUserBtns[allUserBtns.length - 1].classList.remove('hidden');
    }
}

window.triggerEditLastInput = (e) => {
    if(e) e.stopPropagation();

    if (state.isProcessing && currentAborter) currentAborter.abort();
    resetCurrentTTS();
    if (isListening && recognition) recognition.stop();
    
    resetMicUI();
    state.isProcessing = false;
    updateStopButtonVisibility(); 
    UI.status.style.backgroundColor = '#4b5563';

    if (chatHistory.length > 0) {
        let lastRole = chatHistory[chatHistory.length - 1].role;

        if (lastRole === 'model') {
            chatHistory.pop();
            if (UI.log.lastElementChild && UI.log.lastElementChild.classList.contains('msg-container')) {
                UI.log.removeChild(UI.log.lastElementChild);
            }
            lastRole = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].role : null;
        }

        if (lastRole === 'user') {
            const userMsg = chatHistory.pop();
            if (UI.log.lastElementChild && UI.log.lastElementChild.classList.contains('msg-container')) {
                UI.log.removeChild(UI.log.lastElementChild);
            }
            
            const textContent = userMsg.parts.find(p => p.text)?.text || "";
            UI.textIn.value = textContent;
            UI.textIn.focus();
        }
    }

    saveData();
    updateEditPencil();
};

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
    
    if (window.speechSynthesis) {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0; 
        window.speechSynthesis.speak(silent);
    }
    
    currentAudio.play().catch(()=>{});
    currentAudio.pause();
    currentAudio.src = "";
    
    UI.overlay.style.display = 'none';
    setupEventListeners(); 
    updateStopButtonVisibility();
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

function updateLeftSliderLabels() {
    if (!UI.fontSizeSlider) return;
    const fVal = UI.fontSizeSlider.value;
    UI.fontSizeVal.innerText = fVal + 'px';
    document.documentElement.style.setProperty('--chat-font-size', fVal + 'px');

    const sVal = UI.ttsSpeedSlider.value;
    UI.ttsSpeedVal.innerText = sVal + 'x';
    
    if (currentAudio && !currentAudio.paused) {
        currentAudio.playbackRate = parseFloat(sVal);
    }
}

// --- 4. DATA MANAGEMENT & VAULT ---
function loadData() {
    UI.role.value = localStorage.getItem('edu_role') || "Student";
    if(UI.role.value === 'Teacher') UI.ageContainer.style.display = 'none';

    UI.name.value = localStorage.getItem('edu_name') || "";
    UI.age.value = localStorage.getItem('edu_age') || "";
    UI.keyIn.value = localStorage.getItem('edu_api_key') || "";
    
    if (UI.ttsEngine && localStorage.getItem('edu_tts_engine')) {
        UI.ttsEngine.value = localStorage.getItem('edu_tts_engine');
    }
    
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

    if (UI.fontSizeSlider) {
        UI.fontSizeSlider.value = localStorage.getItem('edu_font_size') || "14";
        UI.ttsSpeedSlider.value = localStorage.getItem('edu_tts_speed') || "1.0";
        const savedHighlight = localStorage.getItem('edu_highlight');
        UI.highlightCheckbox.checked = savedHighlight !== 'false'; 
        updateLeftSliderLabels();
    }

    if (UI.remember.checked) {
        const savedHist = localStorage.getItem('edu_all_history');
        if (savedHist) {
            try {
                allSessions = JSON.parse(savedHist);
                const todaySession = allSessions.find(s => s.date === currentDateKey);
                if (todaySession) {
                    currentSessionId = todaySession.id;
                    chatHistory = todaySession.messages;
                    if (chatHistory.length > 0) {
                        UI.welcome.style.display = 'none';
                        chatHistory.forEach(msg => {
                            const textPart = msg.parts.find(p => p.text)?.text || "📷 [Image attached]";
                            renderMessage(msg.role === 'user' ? (UI.name.value || UI.role.value) : "Teacher", textPart, msg.role === 'model', false); 
                        });
                        updateEditPencil();
                    }
                }
            } catch (e) { console.warn("History parse error", e); }
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
    
    if (UI.ttsEngine) localStorage.setItem('edu_tts_engine', UI.ttsEngine.value);
    
    localStorage.setItem('edu_font_size', UI.fontSizeSlider.value);
    localStorage.setItem('edu_tts_speed', UI.ttsSpeedSlider.value);
    localStorage.setItem('edu_highlight', UI.highlightCheckbox.checked);
    
    if (UI.remember.checked && chatHistory.length > 0) {
        let sessionIndex = allSessions.findIndex(s => s.id === currentSessionId);
        
        if (sessionIndex > -1) {
            allSessions[sessionIndex].messages = chatHistory; 
        } else {
            let timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let displayTitle = `${currentDateKey} (${timeString})`;
            
            allSessions.push({ 
                id: currentSessionId, 
                date: currentDateKey, 
                title: displayTitle, 
                messages: chatHistory 
            });
        }
        localStorage.setItem('edu_all_history', JSON.stringify(allSessions));
    } else if (!UI.remember.checked) {
        localStorage.removeItem('edu_all_history');
    }
}

function clearData() {
    chatHistory = []; 
    state.lastAIMessage = ""; 
    currentSessionId = Date.now(); 
    inningsScore = 0; 
    UI.currentScore.innerText = "0";
    UI.scoreIcon.classList.add('grayscale', 'opacity-80');
    localStorage.setItem('edu_score', 0);
    UI.log.innerHTML = `<div class="text-gray-400 text-center mt-12 cinzel"><p class="text-sky-500 text-xl mb-2 font-bold">🧹 Board Cleared</p>Let's start a new lesson.</div>`;
    
    resetCurrentTTS();
    updateEditPencil();
}

// --- HISTORY VAULT LOGIC ---
function renderHistoryList() {
    const container = document.getElementById('history-list-container');
    container.innerHTML = '';
    
    if (allSessions.length === 0) {
        container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-500"><svg class="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg><p class="text-sm italic">No past records found.</p></div>';
        return;
    }

    const sorted = [...allSessions].sort((a, b) => b.id - a.id);

    sorted.forEach(session => {
        const card = document.createElement('div');
        card.className = "w-full text-left text-sm text-slate-300 bg-slate-800/80 hover:bg-slate-700 p-4 rounded-xl transition-colors border border-slate-700 hover:border-sky-500/50 flex flex-col gap-2 outline-none mb-2 shadow-sm cursor-pointer group";
        
        card.innerHTML = `
            <div class="flex justify-between items-center w-full">
                <div class="flex items-center gap-2 overflow-hidden flex-1">
                    <span class="font-bold tracking-wide text-sky-100 truncate">${session.title}</span>
                    <button class="rename-btn p-1 text-slate-500 hover:text-sky-400 transition-colors focus:outline-none" title="Rename Session">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                </div>
                <span class="text-[10px] text-sky-400 bg-sky-900/40 border border-sky-800/50 px-2 py-1 rounded-full font-bold uppercase ml-2 flex-shrink-0">${session.messages.length} msgs</span>
            </div>
            <div class="text-xs text-slate-500 truncate w-full pointer-events-none">
                ${session.messages.length > 0 ? (session.messages[0].parts.find(p => p.text)?.text || "📷 Image") : 'Empty'}
            </div>
        `;
        
        const renameBtn = card.querySelector('.rename-btn');
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            const newTitle = prompt("Enter a new name for this class:", session.title);
            if (newTitle && newTitle.trim() !== "") {
                session.title = newTitle.trim();
                localStorage.setItem('edu_all_history', JSON.stringify(allSessions));
                renderHistoryList(); 
                if (currentSessionId === session.id) {
                    const banner = document.getElementById('archive-notice-banner');
                    if (banner) banner.innerText = `Class: ${session.title}`;
                }
            }
        };

        card.onclick = (e) => {
            e.stopPropagation();
            loadSpecificSession(session.id); 
            UI.settingsModal.classList.add('hidden'); 
            setTimeout(() => {
                UI.historyView.classList.add('hidden');
                UI.historyView.classList.remove('flex');
                UI.mainView.classList.remove('hidden');
            }, 300);
        };
        
        container.appendChild(card);
    });
}

function loadSpecificSession(targetId) {
    resetCurrentTTS();
    UI.log.innerHTML = '';
    chatHistory = [];
    
    const targetSession = allSessions.find(s => s.id === targetId);
    if (targetSession) {
        currentSessionId = targetSession.id;
        chatHistory = targetSession.messages;
        
        if (UI.welcome) UI.welcome.style.display = 'none';
        
        const archiveNotice = document.createElement('div');
        archiveNotice.id = "archive-notice-banner"; 
        archiveNotice.className = "text-center text-xs text-sky-500 mb-6 font-bold border-b border-sky-900/50 pb-2 uppercase tracking-widest mt-4";
        archiveNotice.innerText = `Class: ${targetSession.title}`;
        UI.log.appendChild(archiveNotice);

        chatHistory.forEach(msg => {
            const textPart = msg.parts.find(p => p.text)?.text || "📷 [Image attached]";
            renderMessage(msg.role === 'user' ? (UI.name.value || UI.role.value) : "Teacher", textPart, msg.role === 'model', false); 
        });
        
        updateEditPencil();
    }
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
        updateStopButtonVisibility();
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
        setTimeout(updateStopButtonVisibility, 50);
    };
    recognition.onerror = (e) => {
        isListening = false; 
        resetMicUI();
        setTimeout(updateStopButtonVisibility, 50);
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

function updateStopButtonVisibility() {
    if (!UI.btnStop) return;
    
    if (state.isProcessing || ttsStatus !== 'STOPPED' || isListening) {
        UI.btnStop.classList.remove('opacity-30', 'cursor-not-allowed');
        UI.btnStop.classList.add('hover:bg-red-900/30', 'hover:text-red-400');
        UI.btnStop.disabled = false;
    } else {
        UI.btnStop.classList.add('opacity-30', 'cursor-not-allowed');
        UI.btnStop.classList.remove('hover:bg-red-900/30', 'hover:text-red-400');
        UI.btnStop.disabled = true;
    }
}

// --- 6. EVENT LISTENERS ---
function setupEventListeners() {
    UI.selMedium.addEventListener('change', saveData);
    UI.selStd.addEventListener('change', () => { updateSubjectsList(); saveData(); });
    UI.selSub.addEventListener('change', saveData);
    if (UI.ttsEngine) UI.ttsEngine.addEventListener('change', saveData);

    // Right Modal Events
    const openSettings = (e) => { e.stopPropagation(); UI.settingsModal.classList.remove('hidden'); };
    const closeSettings = (e) => { 
        e.stopPropagation(); 
        UI.settingsModal.classList.add('hidden'); 
        setTimeout(() => {
            if (UI.historyView && UI.mainView) {
                UI.historyView.classList.add('hidden');
                UI.historyView.classList.remove('flex');
                UI.mainView.classList.remove('hidden');
            }
        }, 300);
    };
// --- Entire Session PDF Listener ---
    if (UI.btnSharePdf) {
        UI.btnSharePdf.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.downloadEntireSessionPDF === 'function') {
                window.downloadEntireSessionPDF();
            }
        });
    }


    UI.advToggle.onclick = openSettings;
    UI.btnCloseSet.onclick = closeSettings;
    UI.btnSaveSet.onclick = (e) => { e.stopPropagation(); saveData(); closeSettings(e); };
    UI.settingsModal.addEventListener('click', e => e.stopPropagation());

    const btnViewHistory = document.getElementById('btn-view-history');
    if (btnViewHistory) {
        btnViewHistory.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.mainView.classList.add('hidden');
            UI.historyView.classList.remove('hidden');
            UI.historyView.classList.add('flex');
            renderHistoryList();
        });
    }

    if (UI.btnHistoryBack) {
        UI.btnHistoryBack.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.historyView.classList.add('hidden');
            UI.historyView.classList.remove('flex');
            UI.mainView.classList.remove('hidden');
        });
    }

    // Left Modal Events
    UI.fontSizeSlider.addEventListener('input', updateLeftSliderLabels);
    UI.ttsSpeedSlider.addEventListener('input', updateLeftSliderLabels);
    const openLeftSettings = (e) => { e.stopPropagation(); UI.leftSettingsModal.classList.remove('hidden'); };
    const closeLeftSettings = (e) => { e.stopPropagation(); UI.leftSettingsModal.classList.add('hidden'); };
    UI.leftAdvToggle.onclick = openLeftSettings;
    UI.btnCloseLeftSet.onclick = closeLeftSettings;
    UI.btnSaveLeftSet.onclick = (e) => { e.stopPropagation(); saveData(); closeLeftSettings(e); };
    UI.leftSettingsModal.addEventListener('click', e => e.stopPropagation());
    
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

    if (UI.btnStop) {
        UI.btnStop.onclick = (e) => {
            e.stopPropagation();
            if (UI.btnStop.disabled) return;
            
            resetCurrentTTS();
            if (isListening && recognition) recognition.stop();
            if (state.isProcessing && currentAborter) {
                currentAborter.abort(); 
            }
            setTimeout(updateStopButtonVisibility, 100); 
        };
    }

    UI.btnMute.onclick = (e) => { 
        e.stopPropagation(); state.isMuted = !state.isMuted; 
        if(state.isMuted) { 
            resetCurrentTTS();
            UI.iconVol.classList.add('hidden'); UI.iconMute.classList.remove('hidden'); 
        } else { 
            UI.iconVol.classList.remove('hidden'); UI.iconMute.classList.add('hidden'); 
        } 
    };
    
    // --- MANUAL QUIZ TRIGGER ---
    UI.btnQuizManual.addEventListener('click', (e) => {
        e.stopPropagation(); 
        enforceFullscreen();

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

    UI.btnSend.onclick = (e) => { e.stopPropagation(); enforceFullscreen(); processInput(UI.textIn.value); };
    
    UI.textIn.onkeypress = (e) => { 
        if(e.key === 'Enter') { e.stopPropagation(); enforceFullscreen(); processInput(UI.textIn.value); } 
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

    UI.textIn.value = '';
    UI.textIn.placeholder = "Teacher is thinking...";
    UI.btnCamera.classList.remove('text-sky-400');
    UI.btnCamera.classList.add('text-gray-400');
    UI.cameraInput.value = '';
    if (UI.welcome) UI.welcome.style.display = 'none';
    
    state.isProcessing = true;
    UI.status.style.backgroundColor = '#facc15'; 
    setMicThinkingState(true);
    updateStopButtonVisibility();

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
        let displayRes = res.trim();
        
        // --- SCORE INTERCEPTOR ---
        if (UI.role.value !== 'Teacher') {
            const scoreMatch = displayRes.match(/\[SCORE:(\d+)\]/);
            if (scoreMatch) {
                const runs = parseInt(scoreMatch[1], 10);
                updateScore(runs);
                displayRes = displayRes.replace(scoreMatch[0], '').trim();
            } else if (chatHistory.length > 2) {
                updateScore(1); 
            }
        }
        
        state.lastAIMessage = displayRes;
        chatHistory.push({ role: 'model', parts: [{ text: displayRes }] });
        
        const newMsgId = renderMessage("Teacher", displayRes, true); 
        saveData();
        
        if (!state.isMuted) {
            const btn = document.getElementById(`play-btn-${newMsgId}`);
            if (btn) window.toggleSingleMessagePlay(btn);
        }
        
        updateEditPencil();
        
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("Fetch aborted by user.");
            chatHistory.pop(); 
            if (UI.log.lastElementChild) UI.log.removeChild(UI.log.lastElementChild); 
            UI.textIn.value = userText; 
            UI.textIn.focus();
        } else {
            renderMessage("System", "⚠️ Network interrupted. Please try again.", true);
        }
    }

    state.isProcessing = false;
    resetMicUI();
    setTimeout(updateStopButtonVisibility, 100);
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
        4. FORMATTING: Use Markdown to format your response neatly (use **bold** for emphasis, bullet points for lists, and short paragraphs). Do NOT use complex LaTeX.
        5. MEDIA LINKS: At the very end of your response, provide EXACTLY two lines formatted like this for further visual exploration. The keywords must accurately reflect the specific topic, subject (${sub}), and standard (${std}) in the ${med} medium:
           YT_SEARCH: relevant_topic_keywords
           IMG_SEARCH: relevant_topic_keywords`;
    } else {
        const studentName = UI.name.value || "Child";
        const estimatedAge = parseInt(std) + 5;
        const finalAge = UI.age.value ? parseInt(UI.age.value) : estimatedAge;
        const isYoung = finalAge <= 11 || parseInt(std) <= 5;
        
        const toneInstruction = isYoung ? 
            "Use EXTREMELY simple words. Keep answers SHORT, highly nurturing. Talk to them like a loving primary school teacher." : 
            "Use clear, encouraging explanations appropriate for a teenager.";

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
           IMPORTANT: Do NOT explain the score or mention the tag to the user, just output the tag silently.
        7. MEDIA LINKS: At the very end of your response, provide EXACTLY two lines formatted like this for further visual exploration. The keywords must accurately reflect the specific topic, subject (${sub}), and standard (${std}) in the ${med} medium:
           YT_SEARCH: relevant_topic_keywords
           IMG_SEARCH: relevant_topic_keywords`; 
    }

    const payload = { 
        model: "gemini-3.1-flash", 
        contents: history.slice(-10), 
        systemInstruction: { parts: [{ text: prompt }] } 
    };

    currentAborter = new AbortController();

    const response = await fetch(PROXY_URL, { 
        method: 'POST', 
        headers: headers, 
        body: JSON.stringify(payload),
        signal: currentAborter.signal
    });
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// --- DUAL TTS ENGINE (CLOUD & NATIVE) ---

function prepareTextForTTSAndHighlighting(container, msgId) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            // Do not highlight or process text inside the video/image buttons
            if (node.parentNode && node.parentNode.closest('.external-link-btn')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    }, false);
    const textNodes = [];
    let node;
    
    while (node = walker.nextNode()) {
        if (node.nodeValue.trim() !== '') textNodes.push(node);
    }

    let wordCounter = 0;
    let finalSpeechText = [];

    textNodes.forEach(textNode => {
        const parts = textNode.nodeValue.split(/(\s+)/); 
        const fragment = document.createDocumentFragment();
        
        parts.forEach(part => {
            if (part.trim().length > 0) {
                const span = document.createElement('span');
                span.id = `tts-${msgId}-${wordCounter}`;
                span.className = 'transition-all duration-150'; 
                span.textContent = part;
                fragment.appendChild(span);
                finalSpeechText.push(part);
                wordCounter++;
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });
        textNode.parentNode.replaceChild(fragment, textNode);
    });

    return finalSpeechText.join(' ');
}

function highlightTTSWord(msgId, wordIndex) {
    clearTTSHighlight(); 
    const span = document.getElementById(`tts-${msgId}-${wordIndex}`);
    if (span) {
        if (UI.highlightCheckbox && UI.highlightCheckbox.checked) {
            span.classList.add('bg-sky-500/30', 'text-sky-300', 'font-bold', 'rounded-[3px]', 'px-[2px]', 'shadow-[0_0_8px_rgba(14,165,233,0.4)]');
            lastHighlightedSpan = span;
        }

        const logContainer = document.getElementById('conversation-log');
        const spanRect = span.getBoundingClientRect();
        const logRect = logContainer.getBoundingClientRect();
        
        if (spanRect.bottom > logRect.bottom - 40 || spanRect.top < logRect.top + 40) {
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function clearTTSHighlight() {
    if (lastHighlightedSpan) {
        lastHighlightedSpan.classList.remove('bg-sky-500/30', 'text-sky-300', 'font-bold', 'rounded-[3px]', 'px-[2px]', 'shadow-[0_0_8px_rgba(14,165,233,0.4)]');
        lastHighlightedSpan = null;
    }
}

function updatePlayBtnUI(btn, isPlaying) {
    if (!btn) return;
    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');
    
    if (isPlaying) {
        if (playIcon) playIcon.classList.add('hidden');
        if (pauseIcon) pauseIcon.classList.remove('hidden');
        btn.classList.add('text-green-400');
        btn.classList.remove('text-sky-400');
    } else {
        if (playIcon) playIcon.classList.remove('hidden');
        if (pauseIcon) pauseIcon.classList.add('hidden');
        btn.classList.remove('text-green-400');
        btn.classList.add('text-sky-400');
    }
}

function resetCurrentTTS() {
    if (currentActiveBtn) {
        updatePlayBtnUI(currentActiveBtn, false);
        currentActiveBtn = null;
    }
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
    }
    
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    if (highlightTimer) {
        clearTimeout(highlightTimer);
        highlightTimer = null;
    }

    clearTTSHighlight(); 
    ttsStatus = 'STOPPED';
    globalWordIndex = 0;
    window.currentPlayingText = "";
    setTimeout(updateStopButtonVisibility, 50); 
}

window.toggleSingleMessagePlay = (btnElem) => {
    if (state.isMuted) return;

    const msgId = btnElem.getAttribute('data-msg-id');
    const plainText = speechDataMap[msgId] || "";
    const activeEngine = UI.ttsEngine ? UI.ttsEngine.value : 'native';

    if (currentActiveBtn === btnElem && window.currentPlayingText === plainText) {
        if (ttsStatus === 'PAUSED') {
            ttsStatus = 'PLAYING';
            updatePlayBtnUI(btnElem, true);
            updateStopButtonVisibility(); 
            
            if (activeEngine === 'cloud') {
                if (currentAudio && currentAudio.src) currentAudio.play();
            } else {
                window.speechSynthesis.resume();
            }
            
            startHighlightTimer(msgId);
            return;
        } else if (ttsStatus === 'PLAYING') {
            ttsStatus = 'PAUSED';
            updatePlayBtnUI(btnElem, false);
            
            if (activeEngine === 'cloud') {
                if (currentAudio) currentAudio.pause();
            } else {
                window.speechSynthesis.pause();
            }
            
            if (highlightTimer) clearTimeout(highlightTimer);
            return;
        }
    }

    resetCurrentTTS();
    currentActiveBtn = btnElem;
    window.currentPlayingText = plainText;
    ttsStatus = 'PLAYING';
    updatePlayBtnUI(btnElem, true);
    updateStopButtonVisibility(); 

    if (activeEngine === 'cloud') {
        playCloudAudio(plainText, btnElem);
    } else {
        playNativeAudio(plainText, btnElem);
    }
};

// -- ENGINE 1: NATIVE OS TTS --
function playNativeAudio(fullText, btnElement) {
    const msgId = btnElement.getAttribute('data-msg-id');
    const langCode = UI.selMedium.value === 'Marathi' ? 'mr-IN' : 'en-IN';
    
    wordsArray = fullText.match(/\S+/g) || [];
    globalWordIndex = 0;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = langCode;
    utterance.rate = parseFloat(UI.ttsSpeedSlider ? UI.ttsSpeedSlider.value : 1.0);
    
    utterance.onstart = () => {
        startHighlightTimer(msgId);
    };

    utterance.onend = () => {
        resetCurrentTTS();
    };

    utterance.onerror = (e) => {
        console.warn("Native TTS Error:", e);
        resetCurrentTTS();
    };

    window.speechSynthesis.speak(utterance);
}

// -- ENGINE 2: CLOUD TTS --
function chunkText(text, maxLength = 180) {
    const regex = /[^.?!।,\n]+[.?!।,\n]*/g;
    let chunks = [];
    let currentChunk = "";
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        let sentence = match[0];
        if (currentChunk.length + sentence.length > maxLength) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    if (chunks.length === 0 && text.trim().length > 0) chunks.push(text.trim());
    return chunks;
}

function playCloudAudio(fullText, btnElement) {
    const msgId = btnElement.getAttribute('data-msg-id');
    const langCode = UI.selMedium.value === 'Marathi' ? 'mr' : 'en';
    
    wordsArray = fullText.match(/\S+/g) || [];
    globalWordIndex = 0;
    audioChunks = chunkText(fullText, 180);
    currentChunkIndex = 0;

    playNextChunk(langCode, msgId, btnElement);
}

function playNextChunk(langCode, msgId, btnElement) {
    if (currentChunkIndex >= audioChunks.length || ttsStatus !== 'PLAYING') {
        resetCurrentTTS();
        return;
    }

    const chunkText = audioChunks[currentChunkIndex];
    if (!chunkText || chunkText.trim() === '') {
        currentChunkIndex++;
        playNextChunk(langCode, msgId, btnElement);
        return;
    }

    const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${langCode}&q=${encodeURIComponent(chunkText)}`;
    const currentRate = parseFloat(UI.ttsSpeedSlider ? UI.ttsSpeedSlider.value : 1.0);

    currentAudio.src = url;
    currentAudio.playbackRate = currentRate; 
    currentAudio.preservesPitch = true;

    currentAudio.play().then(() => {
        if (currentChunkIndex === 0) startHighlightTimer(msgId);
    }).catch(err => {
        console.warn("Cloud TTS Blocked, skipping chunk.");
        setTimeout(() => {
            currentChunkIndex++;
            playNextChunk(langCode, msgId, btnElement);
        }, 300);
    });

    currentAudio.onended = () => {
        currentChunkIndex++;
        playNextChunk(langCode, msgId, btnElement);
    };
    currentAudio.onerror = () => {
        currentChunkIndex++;
        playNextChunk(langCode, msgId, btnElement);
    };
}

// -- MASTER HIGHLIGHTER (USED BY BOTH ENGINES) --
function startHighlightTimer(msgId) {
    if (highlightTimer) clearTimeout(highlightTimer);

    const BASE_DELAY = 150;  
    const CHAR_DELAY = 55;   
    const MAX_DELAY = 800;   

    const highlightNextWord = () => {
        if (ttsStatus !== 'PLAYING' || globalWordIndex >= wordsArray.length) return;

        highlightTTSWord(msgId, globalWordIndex);

        const currentWord = wordsArray[globalWordIndex] || "";
        const charCount = currentWord.length;
        const dynamicSpeechRate = parseFloat(UI.ttsSpeedSlider ? UI.ttsSpeedSlider.value : 1.0);

        let wordDuration = (BASE_DELAY + (charCount * CHAR_DELAY)) / dynamicSpeechRate; 
        if (wordDuration > (MAX_DELAY / dynamicSpeechRate)) wordDuration = (MAX_DELAY / dynamicSpeechRate);

        globalWordIndex++;
        highlightTimer = setTimeout(highlightNextWord, wordDuration);
    };

    highlightNextWord();
}

window.copySingleMessage = async (btnElem) => {
    const msgId = btnElem.getAttribute('data-msg-id');
    // Strip out the search tags before copying
    const text = (rawTextMap[msgId] || "")
        .replace(/YT_SEARCH:.*$/gm, '')
        .replace(/IMG_SEARCH:.*$/gm, '')
        .trim(); 
    try {
        await navigator.clipboard.writeText(text);
        const originalHtml = btnElem.innerHTML;
        btnElem.innerHTML = `<span class="text-green-400">Copied!</span>`;
        setTimeout(() => { btnElem.innerHTML = originalHtml; }, 1500);
    } catch(e) {}
};

window.downloadSinglePDF = (btnElem, senderName) => {
    if (typeof html2pdf === 'undefined') {
        alert("PDF engine is still loading. Please try again in a moment.");
        return;
    }

    const msgId = btnElem.getAttribute('data-msg-id');
    // Strip out the search tags for the PDF
    const rawText = (rawTextMap[msgId] || "")
        .replace(/YT_SEARCH:.*$/gm, '')
        .replace(/IMG_SEARCH:.*$/gm, '')
        .trim();

    const container = document.createElement('div');
    container.style.padding = '30px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.backgroundColor = '#FFFFFF'; 
    container.style.color = '#000000'; 

    const header = document.createElement('div');
    header.innerText = "ai.eprashala.com";
    header.style.textAlign = 'center';
    header.style.color = '#6b7280'; 
    header.style.fontSize = '14px'; 
    header.style.fontWeight = 'bold';
    header.style.letterSpacing = '2px';
    header.style.paddingBottom = '15px';
    header.style.marginBottom = '20px';
    header.style.borderBottom = '2px solid #e5e7eb';
    container.appendChild(header);

    const title = document.createElement('h3');
    const std = document.getElementById('std-selector').value;
    const sub = document.getElementById('subject-selector').value;
    title.innerText = `Std ${std} - ${sub}`;
    title.style.color = '#0284c7';
    title.style.marginBottom = '15px';
    container.appendChild(title);

    const content = document.createElement('div');
    content.innerHTML = marked.parse(rawText);
    content.style.lineHeight = '1.6';
    
    const allElements = content.querySelectorAll('*');
    allElements.forEach(el => { el.style.color = '#1e293b'; });

    container.appendChild(content);

    const opt = {
        margin:       0.5,
        filename:     `Eprashala_Note_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(container).save();
};


window.downloadEntireSessionPDF = () => {
    if (typeof html2pdf === 'undefined') {
        alert("PDF engine is still loading. Please try again in a moment.");
        return;
    }
    
    if (chatHistory.length === 0) {
        alert("The class is currently empty. Let's study something first!");
        return;
    }

    const container = document.createElement('div');
    container.style.padding = '30px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.backgroundColor = '#FFFFFF'; 
    container.style.color = '#000000'; 

    const header = document.createElement('div');
    header.innerText = "ai.eprashala.com - Class Session";
    header.style.textAlign = 'center';
    header.style.color = '#6b7280'; 
    header.style.fontSize = '14px'; 
    header.style.fontWeight = 'bold';
    header.style.letterSpacing = '2px';
    header.style.paddingBottom = '15px';
    header.style.marginBottom = '20px';
    header.style.borderBottom = '2px solid #e5e7eb';
    container.appendChild(header);
    
    const title = document.createElement('h3');
    const std = document.getElementById('std-selector').value || "Unknown Std";
    const sub = document.getElementById('subject-selector').value || "Unknown Subject";
    title.innerText = `Class Session: Std ${std} - ${sub}`;
    title.style.color = '#0284c7'; 
    title.style.marginBottom = '20px';
    container.appendChild(title);

    chatHistory.forEach(msg => {
        const isModel = msg.role === 'model';
        const senderName = isModel ? "Teacher" : (UI.name.value || UI.role.value);
        let rawText = msg.parts.find(p => p.text)?.text || "📷 [Image attached]";

        if (isModel) {
            // Strip media tags and score tags for the clean PDF
            rawText = rawText.replace(/YT_SEARCH:.*$/gm, '')
                             .replace(/IMG_SEARCH:.*$/gm, '')
                             .replace(/\[SCORE:\d+\]/g, '')
                             .trim();
        }

        const msgDiv = document.createElement('div');
        msgDiv.style.backgroundColor = isModel ? '#f8fafc' : '#f0f9ff'; 
        msgDiv.style.border = '1px solid #e2e8f0';
        msgDiv.style.marginBottom = '15px';
        msgDiv.style.padding = '15px';
        msgDiv.style.borderRadius = '8px';

        const senderDiv = document.createElement('div');
        senderDiv.innerText = senderName;
        senderDiv.style.fontSize = '10px';
        senderDiv.style.fontWeight = 'bold';
        senderDiv.style.textTransform = 'uppercase';
        senderDiv.style.color = isModel ? '#0284c7' : '#64748b';
        senderDiv.style.marginBottom = '5px';
        msgDiv.appendChild(senderDiv);

        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = isModel ? marked.parse(rawText) : rawText;
        contentDiv.style.fontSize = '14px';
        contentDiv.style.lineHeight = '1.6';
        
        // Force text colors so they don't render white-on-white
        const allElements = contentDiv.querySelectorAll('*');
        allElements.forEach(el => { el.style.color = '#0f172a'; });

        msgDiv.appendChild(contentDiv);
        container.appendChild(msgDiv);
    });

    const opt = {
        margin:       0.5,
        filename:     `Eprashala_Session_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(container).save();
};

// --- RENDER UI ---
function renderMessage(sender, text, isModel) {
    const msgId = 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const div = document.createElement('div');
    
    rawTextMap[msgId] = text; 
    div.className = `msg-container p-4 rounded-2xl ${isModel ? 'bg-[#0f172a]/90 border border-slate-700/50 shadow-lg ml-2 mr-8' : 'bg-sky-900/40 text-right mr-2 ml-8'} mb-4`;
    
    let parsedText = text;
    let mediaLinks = "";

    // Parse out the YT and IMG tags and build the HTML buttons
    if (isModel) {
        parsedText = parsedText.replace(/YT_SEARCH:\s*(.*)/g, (match, keyword) => {
            const q = encodeURIComponent(keyword.trim());
            mediaLinks += `<a href="https://www.youtube.com/results?search_query=${q}" target="_blank" class="external-link-btn inline-flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/40 hover:text-white rounded-lg transition-colors text-xs font-bold border border-red-500/30 shadow-sm mr-2 mb-2">🎥 Watch Video</a>`;
            return ""; 
        });
        parsedText = parsedText.replace(/IMG_SEARCH:\s*(.*)/g, (match, keyword) => {
            const q = encodeURIComponent(keyword.trim());
            mediaLinks += `<a href="https://www.google.com/search?tbm=isch&q=${q}" target="_blank" class="external-link-btn inline-flex items-center gap-1 px-3 py-1.5 bg-sky-600/20 text-sky-400 hover:bg-sky-600/40 hover:text-white rounded-lg transition-colors text-xs font-bold border border-sky-500/30 shadow-sm mb-2">🖼️ See Images</a>`;
            return "";
        });
    }

    parsedText = isModel ? marked.parse(parsedText) : parsedText;
    
    let htmlContent = `
        <div class="text-[10px] uppercase font-bold tracking-wider ${isModel ? 'text-sky-400 cinzel' : 'text-slate-300'} mb-1">${sender}</div>
        <div class="text-sm leading-relaxed text-gray-100 markdown-body" id="md-${msgId}">
            ${parsedText}
            ${mediaLinks ? `<div class="mt-4 pt-3 border-t border-slate-700/50 flex flex-wrap">${mediaLinks}</div>` : ''}
        </div>
    `;

    if (!isModel) {
        htmlContent += `
            <div class="flex justify-end mt-1.5 -mb-1">
                <button class="user-edit-btn text-slate-400 hover:text-sky-400 transition-colors focus:outline-none hidden" onclick="window.triggerEditLastInput(event)" title="Edit this input">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
            </div>
        `;
    }
    
	if (isModel) {
        htmlContent += `
            <div class="msg-action-bar mt-3 flex justify-end gap-2">
                <button class="msg-pdf-btn p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 hover:text-red-400 transition-colors shadow-sm focus:outline-none" onclick="window.downloadSinglePDF(this, '${sender}')" data-msg-id="${msgId}" title="Download Answer as PDF">
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </button>
                <button class="msg-copy-btn p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 hover:text-green-400 transition-colors shadow-sm focus:outline-none" onclick="window.copySingleMessage(this)" data-msg-id="${msgId}" title="Copy Answer">
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <button id="play-btn-${msgId}" class="msg-play-btn p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-sky-400 transition-colors shadow-sm focus:outline-none" onclick="window.toggleSingleMessagePlay(this)" data-msg-id="${msgId}" title="Play/Pause Audio">
                    <svg class="play-icon w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <svg class="pause-icon w-4 h-4 hidden pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
            </div>`;
    }

    div.innerHTML = htmlContent;
    UI.log.appendChild(div);

    if (isModel) {
        const mdBody = div.querySelector('.markdown-body');
        
        // Strip tags completely so the TTS engine doesn't read them out loud
        const cleanTextForTTS = text
            .replace(/YT_SEARCH:.*$/gm, '')
            .replace(/IMG_SEARCH:.*$/gm, '')
            .replace(/\[SCORE:\d+\]/g, '')
            .replace(/[*_#`~]/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/<[^>]+>/g, '')
            .trim();
            
        const speechText = prepareTextForTTSAndHighlighting(mdBody, msgId);
        speechDataMap[msgId] = cleanTextForTTS;
    }
    
    updateEditPencil();
    
    setTimeout(() => { UI.log.scrollTop = UI.log.scrollHeight; }, 50);

    return msgId;
}