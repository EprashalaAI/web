// --- GLOBAL SYSTEM STATE & VARIABLES (Safely initialized first) ---
let UI = {};
let chatHistory = [];
let recognition = null;
let isListening = false; 
let isManuallyPaused = false;
let selectedLibraryItem = "Bhagavad Gita|Bhagavad Gita";
let state = { isProcessing: false, isMuted: false, lastAIMessage: "", sessionActive: false };

let isMicHeld = false;
let isMicToggled = false;
let micPressStartTime = 0;
let finalMicTranscript = '';

let ttsStatus = 'STOPPED';
let currentActiveBtn = null;
let currentAudio = new Audio(); // Cloud audio singleton
let audioChunks = [];
let currentChunkIndex = 0;
let globalWordIndex = 0;
let highlightTimer = null;
let wordsArray = [];
let lastHighlightedSpan = null;
window.currentPlayingText = "";
let currentAborter = null;

let allSessions = []; 
const currentDateKey = new Date().toISOString().split('T')[0];
let currentSessionId = Date.now();
let currentSessionTitle = "";

const speechDataMap = {};
const rawTextMap = {};

// --- PERSISTENT INDEXEDDB DATABASE FOR HISTORY ---
const ChatDB = {
    db: null,
    init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open("EprashalaDB_Library", 1);
            req.onupgradeneeded = e => {
                if (!e.target.result.objectStoreNames.contains("sessions")) {
                    e.target.result.createObjectStore("sessions", { keyPath: "id" });
                }
            };
            req.onsuccess = e => {
                this.db = e.target.result;
                resolve();
            };
            req.onerror = e => {
                console.error("IndexedDB error", e);
                reject(e);
            };
        });
    },
    async saveSession(session) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("sessions", "readwrite");
            tx.objectStore("sessions").put(session);
            tx.oncomplete = () => resolve();
            tx.onerror = e => reject(e);
        });
    },
    async getAllSessions() {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("sessions", "readonly");
            const req = tx.objectStore("sessions").getAll();
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e);
        });
    }
};

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
            
            const textContent = userMsg.parts[0].text || "";
            UI.textIn.value = textContent;
            UI.textIn.focus();
        }
    }

    saveData();
    updateEditPencil();
};

// --- DISCLAIMER LOGIC ---
function closeDisclaimer() {
    const checkbox = document.getElementById('dontShowAgain');
    const modal = document.getElementById('disclaimerModal');
    if (checkbox && checkbox.checked) localStorage.setItem('hideLibraryDisclaimer', 'true');
    if (modal) modal.classList.add('hidden-modal');
}

function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const inputArea = document.getElementById('text-input');
    const sendBtn = document.getElementById('btn-send');
    const micBtn = document.getElementById('btn-mic');
    const statusIndicator = document.getElementById('status-indicator');

    if (!isOnline) {
        // Switch to Offline Mode
        statusIndicator.style.backgroundColor = '#ef4444'; // Red
        inputArea.placeholder = "Offline Mode: Viewing History Only";
        inputArea.disabled = true;
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
        micBtn.disabled = true;
        micBtn.classList.add('opacity-50', 'cursor-not-allowed');
        
        // Optional: Show a subtle banner
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'w-full bg-red-900/80 text-white text-xs text-center py-1 absolute top-0 z-[200]';
        banner.innerText = 'No internet connection. Viewing library archives.';
        document.body.prepend(banner);
    } else {
        // Restore Online Mode
        statusIndicator.style.backgroundColor = '#4b5563'; // Normal gray
        inputArea.placeholder = "Type your message...";
        inputArea.disabled = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        micBtn.disabled = false;
        micBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        
        const banner = document.getElementById('offline-banner');
        if (banner) banner.remove();
    }
}

// Listen for network changes
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

document.addEventListener("DOMContentLoaded", async () => {
    updateNetworkStatus();
    const modal = document.getElementById('disclaimerModal');
    if (modal && localStorage.getItem('hideLibraryDisclaimer') === 'true') {
        modal.classList.add('hidden-modal');
    }

    UI = {
        overlay: document.getElementById('start-overlay'),
        log: document.getElementById('conversation-log'),
        lang: document.getElementById('language-selector'),
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
        iconVol: document.getElementById('icon-vol'),
        iconMute: document.getElementById('icon-mute'),
        btnDownloadAllPdf: document.getElementById('btn-download-all-pdf'),
        advToggle: document.getElementById('adv-toggle'),
        settingsModal: document.getElementById('settings-modal'),
        btnCloseSet: document.getElementById('btn-close-settings'),
        btnSaveSet: document.getElementById('btn-save-settings'),
        name: document.getElementById('manual-name'),
        age: document.getElementById('manual-age'),
        remember: document.getElementById('remember-checkbox'),
        keyIn: document.getElementById('custom-api-key-input'),
        ttsEngine: document.getElementById('tts-engine-selector'),
        welcome: document.getElementById('welcome-msg'),
        ratioSlider: document.getElementById('ratio-slider'),
        modelSlider: document.getElementById('model-slider'),
        ratioVal: document.getElementById('ratio-val'),
        modelVal: document.getElementById('model-val'),

        mainView: document.getElementById('settings-main-view'),
        historyView: document.getElementById('settings-history-view'),
        btnHistoryBack: document.getElementById('btn-history-back'),

        leftAdvToggle: document.getElementById('left-adv-toggle'),
        leftSettingsModal: document.getElementById('left-settings-modal'),
        btnCloseLeftSet: document.getElementById('btn-close-left-settings'),
        btnSaveLeftSet: document.getElementById('btn-save-left-settings'),
        fontSizeSlider: document.getElementById('font-size-slider'),
        fontSizeVal: document.getElementById('font-size-val'),
        ttsSpeedSlider: document.getElementById('tts-speed-slider'),
        ttsSpeedVal: document.getElementById('tts-speed-val'),
        ttsPitchSlider: document.getElementById('tts-pitch-slider'),
        ttsPitchVal: document.getElementById('tts-pitch-val'),
        highlightCheckbox: document.getElementById('highlight-checkbox'),
        
        ddBtn: document.getElementById('dropdown-btn'),
        ddMenu: document.getElementById('dropdown-menu'),
        ddSearch: document.getElementById('dropdown-search'),
        ddList: document.getElementById('dropdown-list'),
        ddText: document.getElementById('dropdown-selected-text'),
        
		btnCloseApp: document.getElementById('btn-close-app'),
		btnExport: document.getElementById('btn-export-session'),
        btnImport: document.getElementById('btn-import-session'),
        fileImport: document.getElementById('file-import-input'),
		btnLibrary: document.getElementById('btn-open-library'),
        libraryModal: document.getElementById('library-modal'),
        btnCloseLibrary: document.getElementById('btn-close-library'),
        libraryContainer: document.getElementById('library-list-container'),
        headerTitle: document.getElementById('main-header-title'),
        btnImportBook: document.getElementById('btn-import-book'),
        importBookInput: document.getElementById('import-book-input')
    };

	if (UI.overlay) {
		const urlParams = new URLSearchParams(window.location.search);
        const urlBookId = urlParams.get('id');

        if (urlBookId) {
            const request = indexedDB.open("EprashalaRAG", 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("bookData")) return;
                const getReq = db.transaction("bookData", "readonly").objectStore("bookData").get(urlBookId);
                getReq.onsuccess = () => {
                    if (getReq.result) activateBookMode(getReq.result);
                };
            };
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        await ChatDB.init(); // Initialize robust database layer
        await loadLibraryConfig();
        if (UI.ddBtn) initCustomDropdown(); // Only call this ONCE, after the config loads!
        await loadData();
        initSpeechRecognition();
        setupEventListeners();

        UI.overlay.addEventListener('click', () => {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
            acquireWakeLock();
            
            if (window.speechSynthesis) {
                const silent = new SpeechSynthesisUtterance('');
                silent.volume = 0; window.speechSynthesis.speak(silent);
            }
            
            currentAudio.play().catch(()=>{});
            currentAudio.pause();
            currentAudio.src = "";
            
            UI.overlay.style.display = 'none';
        });
        
        updateStopButtonVisibility();
    }
});

// --- 1. SECURITY, KIOSK MODE & WAKE LOCK ---
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || (e.ctrlKey && e.key === 'U')) e.preventDefault();
});

let wakeLock = null;
async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
    }
}
async function releaseWakeLock() {
    if (wakeLock !== null) { await wakeLock.release(); wakeLock = null; }
}

function enforceFullScreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {});
    }
}

const safeFullScreen = (e) => {
    // Do not trigger fullscreen if the user is interacting with an input box
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
    }
    enforceFullScreen();
};

document.addEventListener('click', safeFullScreen, { capture: true });
document.addEventListener('touchstart', safeFullScreen, { capture: true, passive: true });

document.addEventListener('click', enforceFullScreen, { capture: true });
document.addEventListener('touchstart', enforceFullScreen, { capture: true, passive: true });

// --- 2. THE ANCIENT LIBRARY CONFIGURATION ---
const PROXY_URL = "https://eprashala.pythonanywhere.com";

let LIBRARY_CONFIG = {};
async function loadLibraryConfig() {
    try {
        const response = await fetch('library_config.json');
        if (!response.ok) throw new Error("Failed to load configuration file.");
        LIBRARY_CONFIG = await response.json();
    } catch (error) {
        console.error("Configuration Error:", error);
        alert("Failed to load the library catalog. Please check your connection or JSON syntax.");
    }
}


// --- EXPORT & IMPORT LOGIC (TEACHER/STUDENT SHARING & MIGRATION) ---

// 1. GLOBAL EXPORT: Full Database Backup
window.exportAllSessions = async () => {
    const allData = await ChatDB.getAllSessions();
    
    if (!allData || allData.length === 0) {
        alert("The library archive is empty. There is nothing to export.");
        return;
    }
    
    // Package the entire database
    const backupData = {
        type: "eprashala_full_backup",
        exportDate: new Date().toISOString(),
        sessions: allData
    };
    
    // Create a downloadable JSON file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `Eprashala_Full_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

// 2. SMART IMPORT: Handles both Single Lessons and Full Backups
window.importSessionData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // CASE A: FULL DATABASE MIGRATION (From Global Export)
            if (importedData.type === "eprashala_full_backup" && Array.isArray(importedData.sessions)) {
                let importedCount = 0;
                for (const session of importedData.sessions) {
                    // Generate a new ID to prevent overwriting existing local data
                    const newSession = {
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        date: session.date || new Date().toISOString().split('T')[0],
                        title: session.title.includes('[Imported]') ? session.title : `[Imported] ${session.title}`,
                        messages: session.messages
                    };
                    await ChatDB.saveSession(newSession);
                    importedCount++;
                    // Tiny delay to ensure IDs are unique
                    await new Promise(r => setTimeout(r, 2));
                }
                
                allSessions = await ChatDB.getAllSessions();
                
                if (UI.historyView && !UI.historyView.classList.contains('hidden')) {
                    renderHistoryList(); 
                }
                alert(`Migration Complete! Successfully imported ${importedCount} sessions into your archives.`);
            } 
            
            // CASE B: SINGLE LESSON IMPORT (Teacher sharing with Student)
            else if (importedData.messages && Array.isArray(importedData.messages)) {
                const newSessionId = Date.now();
                const newSession = {
                    id: newSessionId,
                    date: new Date().toISOString().split('T')[0],
                    title: `[Shared] ${importedData.title || 'Imported Lesson'}`,
                    messages: importedData.messages
                };

                await ChatDB.saveSession(newSession);
                allSessions = await ChatDB.getAllSessions();

                // Load it instantly into the UI
                loadSpecificSession(newSessionId);
                
                // Auto-switch to the correct book context if it exists in the file
                if (importedData.libraryItem && importedData.libraryItem.includes('|')) {
                    selectedLibraryItem = importedData.libraryItem;
                    if (UI.ddText) UI.ddText.innerText = selectedLibraryItem.split('|')[1];
                }

                if (UI.settingsModal) UI.settingsModal.classList.add('hidden');
                alert("Lesson imported successfully! You can now press Play to listen.");
            } 
            
            else {
                throw new Error("Unrecognized file structure");
            }
            
        } catch (err) {
            console.error(err);
            alert("Failed to import. Please make sure this is a valid Eprashala JSON file.");
        }
        event.target.value = ''; // Reset the input
    };
    reader.readAsText(file);
};

function initCustomDropdown() {
    renderDropdownList(); 

    UI.ddBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (UI.ddMenu.style.display === 'flex') {
            UI.ddMenu.style.display = 'none';
            UI.ddMenu.classList.add('hidden');
        } else {
            UI.ddMenu.style.display = 'flex';
            UI.ddMenu.classList.remove('hidden');
            UI.ddSearch.focus(); 
        }
    });

    UI.ddSearch.addEventListener('input', (e) => {
        renderDropdownList(e.target.value);
    });

    document.addEventListener('click', (e) => {
        if (UI.ddBtn && UI.ddMenu) {
            if (!UI.ddBtn.contains(e.target) && !UI.ddMenu.contains(e.target)) {
                UI.ddMenu.style.display = 'none';
                UI.ddMenu.classList.add('hidden');
            }
        }
    });
}

function renderDropdownList(filterText = "") {
    if (!UI.ddList) return;
    
    UI.ddList.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();

    for (const groupName in LIBRARY_CONFIG) {
        let hasVisibleItems = false;
        
        const groupDiv = document.createElement('div');
        groupDiv.innerHTML = `<div class="text-[10px] uppercase text-cyan-600 font-bold px-3 py-1.5 mt-1 bg-slate-900 sticky top-0 z-10 shadow-sm">${groupName}</div>`;
        
        for (const itemName in LIBRARY_CONFIG[groupName]) {
            const config = LIBRARY_CONFIG[groupName][itemName];
            const desc = config.desc || `Wisdom of ${config.persona}`;
            
            if (itemName.toLowerCase().includes(lowerFilter) || desc.toLowerCase().includes(lowerFilter) || config.persona.toLowerCase().includes(lowerFilter)) {
                hasVisibleItems = true;
                
                const itemDiv = document.createElement('div');
                itemDiv.className = "px-3 py-2 cursor-pointer hover:bg-slate-700 rounded-lg transition-colors flex flex-col mx-1 my-0.5";
                itemDiv.innerHTML = `
                    <span class="text-sm font-bold text-yellow-400 leading-tight">${itemName}</span>
                    <span class="text-[10px] text-slate-400 mt-0.5 leading-tight">${desc}</span>
                `;
                
                itemDiv.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectedLibraryItem = `${groupName}|${itemName}`;
                    UI.ddText.innerText = itemName;
                    
                    UI.ddMenu.style.display = 'none';
                    UI.ddMenu.classList.add('hidden');
                    
                    UI.ddSearch.value = ''; 
                    renderDropdownList();   
                };
                
                groupDiv.appendChild(itemDiv);
            }
        }
        
        if (hasVisibleItems) {
            UI.ddList.appendChild(groupDiv);
        }
    }

    // --- NEW: GLOBAL INTERNET ARCHIVE FALLBACK ---
    if (filterText.trim().length > 0) {
        const archiveDiv = document.createElement('div');
        archiveDiv.innerHTML = `<div class="text-[10px] uppercase text-orange-500 font-bold px-3 py-1.5 mt-1 bg-slate-900 sticky top-0 z-10 shadow-sm">Global Internet Archives</div>`;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = "px-3 py-2 cursor-pointer hover:bg-slate-700 rounded-lg transition-colors flex flex-col mx-1 my-0.5 border border-orange-500/30 bg-orange-900/20";
        itemDiv.innerHTML = `
            <span class="text-sm font-bold text-orange-400 leading-tight">Search for: "${filterText}"</span>
            <span class="text-[10px] text-slate-400 mt-0.5 leading-tight">Access modern & global books beyond the ancient library.</span>
        `;
        
        itemDiv.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Prefixing with "Archive|" tells our system how to handle this
            selectedLibraryItem = `Archive|${filterText.trim()}`;
            UI.ddText.innerText = `[Archive] ${filterText.trim()}`;
            
            UI.ddMenu.style.display = 'none';
            UI.ddMenu.classList.add('hidden');
            UI.ddSearch.value = ''; 
            renderDropdownList();   
        };
        
        archiveDiv.appendChild(itemDiv);
        UI.ddList.appendChild(archiveDiv);
    }
}

function getSelectedConfig() {
    const [group, item] = selectedLibraryItem.split('|');
    
    // Intercept Archive requests and generate a temporary virtual config
    if (group === 'Archive') {
        return {
            persona: "Global Archive AI",
            texts: item,
            greeting: "Namaste",
            desc: "Accessing the global internet archives."
        };
    }
    
    return LIBRARY_CONFIG[group][item];
}
function getSelectedItemName() {
    return selectedLibraryItem.split('|')[1];
}

function getModelInfo(val) {
    val = parseInt(val);
    if(val === 20) return { name: "Flash-Lite", id: "gemini-3.1-flash-lite" };
    if(val === 40) return { name: "Flash", id: "gemini-3-flash-preview" };
    if(val === 60) return { name: "Thinking", id: "gemini-3.5-flash" }; 
    if(val === 80) return { name: "Pro", id: "gemini-3.1-pro" };
    return { name: "Flash", id: "gemini-3.1-flash" };
}

function updateSliderLabels() {
    const rVal = UI.ratioSlider.value;
    UI.ratioVal.innerText = `${rVal}% Book / ${100 - rVal}% AI`;
    const mVal = UI.modelSlider.value;
    UI.modelVal.innerText = `${getModelInfo(mVal).name} (${mVal}%)`;
}

function updateLeftSliderLabels() {
    if (!UI.fontSizeSlider) return;
    const fVal = UI.fontSizeSlider.value;
    UI.fontSizeVal.innerText = fVal + 'px';
    document.documentElement.style.setProperty('--chat-font-size', fVal + 'px');

    const sVal = UI.ttsSpeedSlider.value;
    UI.ttsSpeedVal.innerText = sVal + 'x';

    const pVal = UI.ttsPitchSlider.value;
    UI.ttsPitchVal.innerText = pVal;
    
    if (currentAudio && !currentAudio.paused) {
        currentAudio.playbackRate = parseFloat(sVal);
    }
}

function updateSliderAvailability() {
    const hasKey = UI.keyIn.value.trim().length > 10;
    const container = document.getElementById('advanced-sliders-container');
    const warning = document.getElementById('api-key-warning');
    
    UI.ratioSlider.disabled = !hasKey;
    UI.modelSlider.disabled = !hasKey;
    
    if (hasKey) {
        container.style.opacity = "1";
        warning.style.display = "none";
        UI.ratioSlider.classList.remove('cursor-not-allowed');
        UI.ratioSlider.classList.add('cursor-pointer');
        UI.modelSlider.classList.remove('cursor-not-allowed');
        UI.modelSlider.classList.add('cursor-pointer');
    } else {
        container.style.opacity = "0.5";
        warning.style.display = "block";
        UI.ratioSlider.classList.add('cursor-not-allowed');
        UI.ratioSlider.classList.remove('cursor-pointer');
        UI.modelSlider.classList.add('cursor-not-allowed');
        UI.modelSlider.classList.remove('cursor-pointer');
        UI.ratioSlider.value = "80";
        UI.modelSlider.value = "40";
        updateSliderLabels();
    }
}

async function saveData() {
    try {
        localStorage.setItem('darshan_name', UI.name.value);
        localStorage.setItem('darshan_age', UI.age.value);
        localStorage.setItem('darshan_remember', UI.remember.checked);
        localStorage.setItem('darshan_ratio', UI.ratioSlider.value);
        localStorage.setItem('darshan_model', UI.modelSlider.value);
        localStorage.setItem('darshan_lang', UI.lang.value);
        localStorage.setItem('darshan_apikey', UI.keyIn.value); 
        
        if (UI.ttsEngine) localStorage.setItem('darshan_tts_engine', UI.ttsEngine.value);

        localStorage.setItem('darshan_font_size', UI.fontSizeSlider.value);
        localStorage.setItem('darshan_tts_speed', UI.ttsSpeedSlider.value);
        localStorage.setItem('darshan_tts_pitch', UI.ttsPitchSlider.value);
        localStorage.setItem('darshan_highlight', UI.highlightCheckbox.checked);
        
        if (UI.remember.checked && chatHistory.length > 0) {
            if (!currentSessionTitle) {
                let timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                currentSessionTitle = `${currentDateKey} (${timeString})`;
            }

            const session = { 
                id: currentSessionId, 
                date: currentDateKey, 
                title: currentSessionTitle, 
                messages: chatHistory 
            };
            
            await ChatDB.saveSession(session);
            allSessions = await ChatDB.getAllSessions();
        } 
    } catch (err) {}
}

async function loadData() {
    if(!UI.name) return;
    
    try {
        UI.name.value = localStorage.getItem('darshan_name') || "";
        UI.age.value = localStorage.getItem('darshan_age') || "";
        UI.remember.checked = localStorage.getItem('darshan_remember') === 'true';
		const savedRemember = localStorage.getItem('darshan_remember');
        UI.remember.checked = savedRemember !== null ? savedRemember === 'true' : true;
        
        UI.ratioSlider.value = localStorage.getItem('darshan_ratio') || "80";
        UI.modelSlider.value = localStorage.getItem('darshan_model') || "40";
        
        if (UI.keyIn) UI.keyIn.value = localStorage.getItem('darshan_apikey') || "";
        if (localStorage.getItem('darshan_lang')) UI.lang.value = localStorage.getItem('darshan_lang'); 
        if (UI.ttsEngine && localStorage.getItem('darshan_tts_engine')) UI.ttsEngine.value = localStorage.getItem('darshan_tts_engine');

        if (UI.fontSizeSlider) {
            UI.fontSizeSlider.value = localStorage.getItem('darshan_font_size') || "14";
            UI.ttsSpeedSlider.value = localStorage.getItem('darshan_tts_speed') || "0.9";
            UI.ttsPitchSlider.value = localStorage.getItem('darshan_tts_pitch') || "1.0";
            
            const savedHighlight = localStorage.getItem('darshan_highlight');
            UI.highlightCheckbox.checked = savedHighlight === 'true'; 
            updateLeftSliderLabels();
        }
        
        updateSliderLabels(); 
        
        if (UI.remember.checked) {
            allSessions = await ChatDB.getAllSessions();
            const todaySession = allSessions.find(s => s.date === currentDateKey);

            if (todaySession) {
                currentSessionId = todaySession.id;
                currentSessionTitle = todaySession.title;
                chatHistory = todaySession.messages;

                if (chatHistory.length > 0) {
                    UI.welcome.style.display = 'none';
                    chatHistory.forEach(msg => renderMessage(msg.role === 'user' ? (UI.name.value || "Bhakt") : getSelectedItemName(), msg.parts[0].text, msg.role === 'model'));
                    const lastModel = [...chatHistory].reverse().find(m => m.role === 'model');
                    if (lastModel) state.lastAIMessage = lastModel.parts[0].text;
                    updateEditPencil();
                }
            }
        }
    } catch (err) {}
    
    updateSliderAvailability();
}

function clearData() {
    chatHistory = []; 
    state.lastAIMessage = ""; 
    currentSessionId = Date.now(); 
    currentSessionTitle = "";
    
    UI.log.innerHTML = `<div class="text-gray-400 text-center mt-12 cinzel"><p class="text-yellow-500 text-xl mb-2">🙏 Memory Cleared 🙏</p>Begin anew.</div>`;
    resetCurrentTTS();
    updateEditPencil();
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

// --- HISTORY VIEW RENDERER ---
// --- HISTORY VIEW RENDERER ---
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
        card.className = "w-full text-left text-sm text-slate-300 bg-slate-800/80 hover:bg-slate-700 p-4 rounded-xl transition-colors border border-slate-700 hover:border-cyan-500/50 flex flex-col gap-2 outline-none mb-2 shadow-sm cursor-pointer group";
		const rawPreview = session.messages.length > 0 ? session.messages[0].parts[0].text : 'Empty session';
        const safePreview = rawPreview.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		
        card.innerHTML = `
            <div class="flex justify-between items-center w-full">
                <div class="flex items-center gap-2 overflow-hidden flex-1">
                    <span class="font-bold tracking-wide text-cyan-100 truncate">${session.title}</span>
                    
                    <button class="rename-btn p-1 text-slate-500 hover:text-cyan-400 transition-colors focus:outline-none" title="Rename Session">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    
                    <button class="share-btn p-1 text-slate-500 hover:text-yellow-400 transition-colors focus:outline-none" title="Export & Share this Lesson">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </button>
                    
                </div>
                <span class="text-[10px] text-cyan-400 bg-cyan-900/40 border border-cyan-800/50 px-2 py-1 rounded-full font-bold uppercase ml-2 flex-shrink-0">${session.messages.length} msgs</span>
            </div>
            <div class="text-xs text-slate-500 truncate w-full pointer-events-none">
                ${session.messages.length > 0 ? session.messages[0].parts[0].text : 'Empty session'}
            </div>
        `;
        
        // 1. Rename Logic
        const renameBtn = card.querySelector('.rename-btn');
        renameBtn.onclick = async (e) => {
            e.stopPropagation(); 
            const newTitle = prompt("Enter a new name for this consultation:", session.title);
            
            if (newTitle && newTitle.trim() !== "") {
                session.title = newTitle.trim();
                await ChatDB.saveSession(session);
                allSessions = await ChatDB.getAllSessions();
                renderHistoryList(); 
                
                if (currentSessionId === session.id) {
                    currentSessionTitle = session.title;
                    const banner = document.getElementById('archive-notice-banner');
                    if (banner) banner.innerText = `Session: ${session.title}`;
                }
            }
        };

        // 2. NEW: Share/Export Logic
        const shareBtn = card.querySelector('.share-btn');
        shareBtn.onclick = (e) => {
            e.stopPropagation(); // Stops the card from loading the chat in the background
            
            const sessionData = {
                title: session.title,
                messages: session.messages,
                libraryItem: selectedLibraryItem 
            };
            
            // Clean up the title to make a valid, pretty file name (e.g., "Lesson_Gravity.json")
            const safeTitle = session.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessionData));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `Lesson_${safeTitle}.json`);
            document.body.appendChild(downloadAnchorNode); 
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        };

        // 3. Load Session Logic
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
        currentSessionTitle = targetSession.title;
        chatHistory = targetSession.messages;
        
        if (UI.welcome) UI.welcome.style.display = 'none';
        
        const archiveNotice = document.createElement('div');
        archiveNotice.id = "archive-notice-banner";
        archiveNotice.className = "text-center text-xs text-cyan-500 mb-6 font-bold border-b border-cyan-900/50 pb-2 uppercase tracking-widest mt-4";
        archiveNotice.innerText = `Session: ${targetSession.title}`;
        UI.log.appendChild(archiveNotice);

        chatHistory.forEach(msg => {
            renderMessage(msg.role === 'user' ? (UI.name.value || "Bhakt") : getSelectedItemName(), msg.parts[0].text, msg.role === 'model');
        });
        
        updateEditPencil();
    }
}

function setupEventListeners() {
	
	// --- BOOK LIBRARY & IMPORT LISTENERS ---
    if (UI.btnLibrary) UI.btnLibrary.onclick = openLibraryModal;
    if (UI.btnCloseLibrary) UI.btnCloseLibrary.onclick = () => UI.libraryModal.classList.add('hidden');

    if (UI.btnImportBook && UI.importBookInput) {
        UI.btnImportBook.onclick = (e) => {
            e.stopPropagation();
            UI.importBookInput.value = '';
            UI.importBookInput.click();
        };

        UI.importBookInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    let importedBook = null;

                    if (Array.isArray(parsed)) {
                        const fallbackTitle = parsed[0].book_title || file.name.replace(/\.[^.]+$/, '');
                        importedBook = { id: 'book-' + Date.now(), title: fallbackTitle, dateAdded: new Date().toISOString(), chunks: parsed };
                    } else if (parsed && Array.isArray(parsed.chunks)) {
                        importedBook = { id: 'book-' + Date.now(), title: parsed.title || file.name, dateAdded: new Date().toISOString(), chunks: parsed.chunks };
                    } else {
                        alert("Invalid JSON format.");
                        return;
                    }

                    const request = indexedDB.open("EprashalaRAG", 1);
                    request.onsuccess = (ev) => {
                        const tx = ev.target.result.transaction("bookData", "readwrite");
                        tx.objectStore("bookData").put(importedBook, importedBook.id);
                        tx.oncomplete = () => { alert("Imported!"); renderBookLibrary(); };
                    };
                } catch (err) { alert("Could not parse JSON."); }
            };
            reader.readAsText(file);
        };
    }
	
    // 1. Chat Log Listener (Plays audio and single PDFs)
    UI.log.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.btn-play-msg');
        if (playBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.toggleSingleMessagePlay(playBtn);
            return;
        }

        const pdfBtn = e.target.closest('.btn-pdf-msg');
        if (pdfBtn) {
            e.preventDefault();
            e.stopPropagation();
            const sender = pdfBtn.getAttribute('data-sender');
            window.downloadSinglePDF(pdfBtn, sender);
            return;
        }
    });

    // 2. Entire Session PDF Listener (Moved OUTSIDE the log listener)
    if (UI.btnDownloadAllPdf) {
        UI.btnDownloadAllPdf.addEventListener('click', (e) => {
            e.stopPropagation();
            window.downloadEntireSessionPDF();
        });
    }
	

    if (UI.btnImport) {
        UI.btnImport.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.fileImport.click(); 
        });
    }

    if (UI.fileImport) {
        UI.fileImport.addEventListener('change', window.importSessionData);
    }
	
    UI.ratioSlider.addEventListener('input', updateSliderLabels);
    UI.modelSlider.addEventListener('input', updateSliderLabels);
    UI.keyIn.addEventListener('input', updateSliderAvailability);
    if (UI.ttsEngine) UI.ttsEngine.addEventListener('change', saveData);

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

    UI.fontSizeSlider.addEventListener('input', updateLeftSliderLabels);
    UI.ttsSpeedSlider.addEventListener('input', updateLeftSliderLabels);
    UI.ttsPitchSlider.addEventListener('input', updateLeftSliderLabels);
    const openLeftSettings = (e) => { e.stopPropagation(); UI.leftSettingsModal.classList.remove('hidden'); };
    const closeLeftSettings = (e) => { e.stopPropagation(); UI.leftSettingsModal.classList.add('hidden'); };
    UI.leftAdvToggle.onclick = openLeftSettings;
    UI.btnCloseLeftSet.onclick = closeLeftSettings;
    UI.btnSaveLeftSet.onclick = (e) => { e.stopPropagation(); saveData(); closeLeftSettings(e); };
    UI.leftSettingsModal.addEventListener('click', e => e.stopPropagation());
    
    const fabContainer = document.getElementById('mainFab');
    const fabToggle = document.getElementById('fabToggle');
    
    if (fabToggle) {
        fabToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            fabContainer.classList.toggle('active');
        });
    }

    UI.btnPasteKey.addEventListener('click', async (e) => {
        e.stopPropagation(); 
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                UI.keyIn.value = text;
                updateSliderAvailability(); 
                const originalText = UI.btnPasteKey.innerText;
                UI.btnPasteKey.innerText = "Pasted!";
                UI.btnPasteKey.classList.replace('bg-slate-700', 'bg-green-600');
                setTimeout(() => { 
                    UI.btnPasteKey.innerText = originalText; 
                    UI.btnPasteKey.classList.replace('bg-green-600', 'bg-slate-700');
                }, 1500);
            }
        } catch (err) {
            alert('Could not access clipboard.');
        }
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
        e.stopPropagation(); 
        state.isMuted = !state.isMuted; 
        if(state.isMuted) { 
            resetCurrentTTS(); 
            UI.iconVol.classList.add('hidden'); 
            UI.iconMute.classList.remove('hidden'); 
        } else { 
            UI.iconVol.classList.remove('hidden'); 
            UI.iconMute.classList.add('hidden'); 
        } 
    };
	
    UI.btnRestart.onclick = (e) => { e.stopPropagation(); clearData(); };

    if (UI.btnCloseApp) {
        UI.btnCloseApp.addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm("Are you sure you want to depart from the ancient library?")) {
                window.open('', '_self', ''); window.close();
                try { if (window.Android && window.Android.closeApp) window.Android.closeApp(); } catch(err) {}
                setTimeout(() => {
                    if (window.speechSynthesis) window.speechSynthesis.cancel();
                    resetCurrentTTS();
                    if (typeof recognition !== 'undefined' && recognition && isListening) recognition.stop();
                    document.body.innerHTML = `
                        <div style="height:100vh; width:100vw; display:flex; flex-direction:column; align-items:center; justify-content:center; background-color:#020617; color:#fbbf24; font-family:'Cinzel', serif; z-index:9999; position:fixed; top:0; left:0; text-align:center; padding: 20px;">
                            <div style="font-size: 4rem; margin-bottom: 10px; text-shadow: 0 0 20px rgba(251, 191, 36, 0.5);">ॐ</div>
                            <div style="font-size: 1.5rem; letter-spacing: 2px; margin-bottom: 15px;">Session Concluded.</div>
                            <div style="font-size: 0.9rem; color:#64748b; font-family:'Inter', sans-serif;">The library has been sealed.<br>You may safely close this browser tab.</div>
                        </div>`;
                }, 200); 
            }
        });
    }

    UI.btnSend.onclick = (e) => { e.stopPropagation(); processInput(UI.textIn.value); };
    UI.textIn.onkeypress = (e) => { e.stopPropagation(); if(e.key === 'Enter') processInput(UI.textIn.value); };

UI.textIn.addEventListener('focus', () => {
    setTimeout(() => {
        UI.textIn.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300);
});

// INSERT THIS HYBRID LISTENER BLOCK
// Change to async arrow function
const handleMicDown = async (e) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    enforceFullScreen(); 
    
    if (state.isProcessing || !recognition) {
        if (!recognition) alert("Speech recognition is not supported in this browser.");
        return;
    }
    
    if (isListening && isMicToggled) {
        isMicToggled = false;
        recognition.stop(); 
        return;
    }

    if (isMicHeld) return; 

    isMicHeld = true;
    isMicToggled = false;
    micPressStartTime = Date.now();
    finalMicTranscript = '';
    UI.textIn.value = '';
    
    recognition.lang = UI.lang.value; 

    // --- AUDIO ROUTING FIX START ---
    try {
        // Force the OS to switch to the Bluetooth/Wired headset profile
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true } 
            });
            // Immediately stop the tracks so the Web Speech API can take control of the mic
            stream.getTracks().forEach(track => track.stop());
        }
        
        // Now start the recognition engine
        recognition.start(); 
    } catch(err) { 
        console.error("Hardware routing failed:", err);
        // Fallback: Attempt to start anyway if permission was denied or stream failed
        try { recognition.start(); } catch(fallbackErr) { console.error(fallbackErr); }
    }
    // --- AUDIO ROUTING FIX END ---
};

    const handleMicUp = (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        if (!isMicHeld) return; 
        
        const holdDuration = Date.now() - micPressStartTime;
        
        if (holdDuration < 400) {
            // Short tap: Switch to normal toggle mode (keeps listening until silence)
            isMicHeld = false;
            isMicToggled = true; 
        } else {
            // Long press released: Stop and process immediately
            isMicHeld = false;
            if (recognition && isListening) recognition.stop();
        }
    };

    const handleMicLeave = (e) => {
        // If their finger slips off the button while holding, stop recording
        if (isMicHeld) {
            isMicHeld = false;
            if (recognition && isListening) recognition.stop();
        }
    };

    // Attach all necessary events for desktop and mobile
    UI.btnMic.addEventListener('mousedown', handleMicDown);
    UI.btnMic.addEventListener('touchstart', handleMicDown, { passive: false });
    
    UI.btnMic.addEventListener('mouseup', handleMicUp);
    UI.btnMic.addEventListener('touchend', handleMicUp);
    
    UI.btnMic.addEventListener('mouseleave', handleMicLeave);
	// --- HEADSET BUTTON (ANSWER CALL / PLAY-PAUSE) INTERCEPTOR ---
    const toggleMicFromHeadset = () => {
        if (state.isProcessing || !recognition) return;

        if (isListening) {
            // If already listening, stop it (mimics tapping to stop)
            isMicToggled = false;
            if (recognition) recognition.stop();
        } else {
            // If not listening, start it in "Toggle" mode
            // We create a dummy event to bypass preventDefault/stopPropagation errors
            const dummyEvent = { preventDefault: () => {}, stopPropagation: () => {} };
            
            // 1. Trigger the down action
            handleMicDown(dummyEvent);
            
            // 2. Trigger the up action immediately (100ms) to force it into "short tap" toggle mode
            setTimeout(() => {
                handleMicUp(dummyEvent);
            }, 100); 
        }
    };

    // 1. Media Session API (Captures Bluetooth & most modern wired headsets)
    if ('mediaSession' in navigator) {
        // Hijack the OS media controls so the headset button routes to our PWA
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Dhwani AI',
            artist: 'Active Session',
        });

        navigator.mediaSession.setActionHandler('play', toggleMicFromHeadset);
        navigator.mediaSession.setActionHandler('pause', toggleMicFromHeadset);
        navigator.mediaSession.setActionHandler('stop', () => {
            if (isListening && recognition) recognition.stop();
        });
    }

    // 2. Keyboard Fallback (Captures older wired headsets that send raw keycodes)
    document.addEventListener('keydown', (e) => {
        // 'MediaPlayPause' is the standard web keycode for the headset hook/call button
        if (e.key === 'MediaPlayPause' || e.key === 'Call') {
            e.preventDefault();
            toggleMicFromHeadset();
        }
    });
	
	// --- SMART BOOK SUGGESTIONS LOGIC ---
// --- SMART BOOK SUGGESTIONS LOGIC ---
    // Map everyday keywords to specific groups and books from your library
    const keywordMap = {
        // 1. Core Health & Wellness
        "health": { group: "Ayurveda", item: "Charaka Samhita", label: "Health (Charaka)" },
        "medicine": { group: "Ayurveda", item: "Sushruta Samhita", label: "Medicine (Sushruta)" },
        "surgery": { group: "Ayurveda", item: "Sushruta Samhita", label: "Surgery (Sushruta)" },
        "pregnancy": { group: "Ayurveda", item: "Garbha Sanskar", label: "Garbha Sanskar" },
        "women": { group: "Prominent Personalities", item: "Dr. Pihu Gynecology & Women's Health", label: "Women's Health" },
        "beauty": { group: "Prominent Personalities", item: "Dr. Rupali - Ayurvedic Cosmetology", label: "Beauty & Skin" },
        "addiction": { group: "Ayurveda", item: "Vedic & Ayurvedic De-Addiction Science", label: "De-Addiction" },
        "drugs": { group: "Ayurveda", item: "Vedic & Ayurvedic De-Addiction Science", label: "Mind Recovery" },
        
        // 2. Relationships & Mind
        "relationship": { group: "Shastra", item: "Kama Shastra", label: "Relationships" },
        "love": { group: "Shastra", item: "Kama Shastra", label: "Love & Aesthetics" },
        "mind": { group: "Philosophical Sutras", item: "Patanjali Yoga Sutras", label: "Yoga & Mind" },
        "yoga": { group: "Philosophical Sutras", item: "Patanjali Yoga Sutras", label: "Patanjali Yoga" },
        "meditation": { group: "Modern Spiritual", item: "Paramahansa Yogananda", label: "Kriya Yoga" },
        
        // 3. Ancient Sciences, Math & Engineering
        "science": { group: "Vedic Sciences", item: "Vedic Quantum Physics", label: "Quantum Science" },
        "physics": { group: "Vedic Sciences", item: "Vedic Quantum Physics", label: "Vedic Physics" },
        "astronomy": { group: "Jyotish", item: "Surya Siddhanta", label: "Astronomy" },
        "stars": { group: "Jyotish", item: "Brihat Parashara", label: "Astrology" },
        "math": { group: "Ancient Scientists & Mathematicians", item: "Aryabhata", label: "Mathematics" },
        "water": { group: "Shastra", item: "Jala Samrakshana & Engineering", label: "Water Conservation" },
        "aviation": { group: "Shastra", item: "Vaimanika Shastra", label: "Ancient Aviation" },
        "gems": { group: "Ratna Pariksha (Ancient Gemology)", item: "Ratnapariksha", label: "Gemology" },
        "diamond": { group: "Ratna Pariksha (Ancient Gemology)", item: "Ratnapariksha", label: "Gem Testing" },
        "animals": { group: "Shastra", item: "Pashu Ayurveda", label: "Veterinary Science" },
        "architecture": { group: "Shastra", item: "Vastu Shastra", label: "Vastu Shastra" },
        "vastu": { group: "Shastra", item: "Vastu Shastra", label: "Vastu" },
        "engineering": { group: "Shastra", item: "Shilpa Shastra", label: "Shilpa Shastra" },

        // 4. Modern Law, Governance & Tax
        "law": { group: "Laws In India", item: "Constitution", label: "Constitution of India" },
        "ancient law": { group: "Dharma Shastra", item: "Manusmriti", label: "Ancient Law" },
        "crime": { group: "Laws In India", item: "Substantive Criminal Law", label: "Criminal Law" },
        "police": { group: "Laws In India", item: "Central Police Framework", label: "Police Framework" },
        "tax": { group: "Laws In India", item: "Direct Taxes", label: "Taxation Laws" },
        "driving": { group: "Laws In India", item: "Road Safety & Violations", label: "Traffic Laws" },
        "politics": { group: "Dharma Shastra", item: "Arthashastra", label: "Chanakya's Politics" },

        // 5. Tech & Modern Influencers
        "computer": { group: "Real Influencers", item: "Linus Torvalds", label: "Linux & Computing" },
        "tech": { group: "Real Influencers", item: "Steve Jobs", label: "Tech Innovation" },
        "apple": { group: "Real Influencers", item: "Steve Jobs", label: "Apple History" },
        "iphone": { group: "Real Influencers", item: "Steve Jobs", label: "Apple History" },
        "google": { group: "Real Influencers", item: "Sundar Pichai", label: "Google Tech" },
        "ai": { group: "Real Influencers", item: "Sam Altman", label: "Artificial Intelligence" },
        "tesla": { group: "Real Influencers", item: "Elon Musk", label: "SpaceX & Tesla" },

        // 6. Business & Economy
        "business": { group: "Business Tycoons of India", item: "Ratan Naval Tata", label: "Tata Legacy" },
        "startup": { group: "Business Tycoons of India", item: "Sachin Bansal", label: "Startups (Flipkart)" },
        "invest": { group: "Business Tycoons of India", item: "Radhakishan Damani", label: "Investing (DMart)" },
        "stocks": { group: "Business Tycoons of India", item: "Nithin Kamath", label: "Retail Broking" },
        "reliance": { group: "Business Tycoons of India", item: "Dhirubhai Ambani", label: "Reliance Legacy" },

        // 7. Government Schemes & Agriculture
        "scheme": { group: "PMO schemes", item: "PMJAY", label: "Govt Health Schemes" },
        "farming": { group: "Prominent Personalities", item: "Baliraja - Agricultural Science", label: "Farming Science" },
        "agriculture": { group: "Prominent Personalities", item: "Baliraja - Agricultural Science", label: "Agricultural Wisdom" },
        "kisan": { group: "PMO schemes", item: "PM-KISAN", label: "PM-KISAN" },

        // 8. Sports Science
        "sports": { group: "Ancient Sports and Martial Arts", item: "Ancient Sports and Martial Arts", label: "Ancient Sports" },
        "cricket": { group: "Sports Science & Mindset", item: "Sachin Tendulkar", label: "Cricket Mindset" },
        "chess": { group: "Sports Science & Mindset", item: "Viswanathan Anand", label: "Chess Mastery" },
        "olympics": { group: "Sports Science & Mindset", item: "Abhinav Bindra", label: "Olympic Focus" },
        "boxing": { group: "Sports Science & Mindset", item: "Mary Kom", label: "Boxing Champion" },

        // 9. Arts, Music & Culture
        "music": { group: "Arts & Applied Sciences", item: "Sangita Ratnakara", label: "Classical Music" },
        "dance": { group: "Classical Literature", item: "Natyashastra", label: "Natyashastra" },
        "singing": { group: "Visionaries & Cultural Icons", item: "Lata Mangeshkar", label: "Indian Playback" },

        // 10. History, Heroes & Freedom
        "shivaji": { group: "Maratha Empire", item: "Chhatrapati Shivaji Maharaj", label: "Shivaji Maharaj" },
        "maratha": { group: "Maratha Empire", item: "Chhatrapati Sambhaji Maharaj", label: "Sambhaji Maharaj" },
        "freedom": { group: "Indian Freedom Fighters", item: "Mahatma Gandhi", label: "Freedom Struggle" },
        "revolution": { group: "Indian Freedom Fighters", item: "Bhagat Singh", label: "Bhagat Singh" },
        "space": { group: "Visionaries & Cultural Icons", item: "A.P.J. Abdul Kalam", label: "Space & Missiles" },
        
        // 11. Deep Spiritual & Epics
        "gita": { group: "Bhagavad Gita", item: "Bhagavad Gita", label: "Bhagavad Gita" },
        "ram": { group: "Gods", item: "Rama", label: "Lord Rama" },
        "ramayana": { group: "Epics", item: "Ramayana", label: "Ramayana Epic" },
        "krishna": { group: "Gods", item: "Krishna", label: "Lord Krishna" },
        "mahabharata": { group: "Epics", item: "Mahabharata", label: "Mahabharata" },
        "shiv": { group: "Gods", item: "Shiv", label: "Lord Shiva" },
        "buddha": { group: "Gods", item: "Gautam Buddha", label: "Lord Buddha" }
    };

    const suggestionsContainer = document.getElementById('book-suggestions');

    UI.textIn.addEventListener('input', (e) => {
        if (!suggestionsContainer) return;
        
        const text = e.target.value.toLowerCase();
        let matchedBooks = [];
        let matchedKeys = new Set(); // Prevent duplicate tabs if multiple keywords map to the same book

        // Check if any keyword matches the user's input
        for (const [key, data] of Object.entries(keywordMap)) {
            if (text.includes(key)) {
                const uniqueId = data.group + "|" + data.item;
                if (!matchedKeys.has(uniqueId)) {
                    matchedKeys.add(uniqueId);
                    matchedBooks.push(data);
                }
            }
        }

        // Display the tabs if matches are found
        if (matchedBooks.length > 0) {
            suggestionsContainer.classList.remove('hidden');
            suggestionsContainer.innerHTML = matchedBooks.map(book => 
                `<button type="button" 
                    onclick="window.selectSuggestedBook('${book.group}', '${book.item}')" 
                    class="whitespace-nowrap px-4 py-1.5 bg-cyan-900/60 hover:bg-cyan-700 text-cyan-200 border border-cyan-600/50 rounded-full text-xs font-bold transition-all shadow-md focus:outline-none">
                    Select: ${book.label}
                </button>`
            ).join('');
        } else {
            // Hide the tabs if no keywords are matched or text is cleared
            suggestionsContainer.classList.add('hidden');
            suggestionsContainer.innerHTML = '';
        }
    });

    // Global function to handle tab clicks
    window.selectSuggestedBook = (group, item) => {
        selectedLibraryItem = `${group}|${item}`;
        if (UI.ddText) UI.ddText.innerText = item;
        
        // Flash effect to show it was selected
        const container = document.getElementById('dropdown-btn');
        if (container) {
            container.classList.add('bg-cyan-900/50', 'border-cyan-400');
            setTimeout(() => {
                container.classList.remove('bg-cyan-900/50', 'border-cyan-400');
            }, 500);
        }

        // Hide suggestions after selection
        if (suggestionsContainer) {
            suggestionsContainer.classList.add('hidden');
            suggestionsContainer.innerHTML = '';
        }
    };
	
	
	
}

let isBookMode = false;
let activeBookChunks = [];
let activeBookTitle = "";

function openLibraryModal() {
    UI.libraryModal.classList.remove('hidden');
    renderBookLibrary();
}

function activateBookMode(bookObj) {
    isBookMode = true;
    activeBookChunks = bookObj.chunks;
    activeBookTitle = bookObj.title;

    // Hide the ancient library dropdown
    const ddContainer = document.getElementById('custom-dropdown-container');
    if (ddContainer) ddContainer.style.display = 'none';

    if (UI.headerTitle) {
        UI.headerTitle.innerHTML = `<span class="text-sky-400 text-xs">Conversing with Book:</span><br><span class="text-white text-lg font-normal break-words">${activeBookTitle}</span>`;
    }

    clearData();
    const initMsgId = renderMessage("System", `📚 <b>${activeBookTitle}</b> loaded securely from your phone's storage.<br><br>Tap the mic and ask me anything about this book!`, true);
    if (!state.isMuted) {
        const btn = document.getElementById(`play-btn-${initMsgId}`);
        if (btn) window.toggleSingleMessagePlay(btn);
    }
}

function retrieveRelevantChunks(query, topK = 8) {
    if (!activeBookChunks || activeBookChunks.length === 0) return [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (!queryTerms.length) return activeBookChunks.slice(0, topK);

    const scored = activeBookChunks.map(chunk => {
        let score = 0;
        const textLower = chunk.text.toLowerCase();
        queryTerms.forEach(term => {
            const matches = (textLower.match(new RegExp(term, 'g')) || []).length;
            score += matches * (1 + 10 / (chunk.char_count || 100)); 
        });
        return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.chunk);
}

function renderBookLibrary() {
    UI.libraryContainer.innerHTML = '<div class="text-center text-slate-500 text-sm mt-10">Loading library...</div>';
    
    const request = indexedDB.open("EprashalaRAG", 1);
    request.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("bookData")) {
            UI.libraryContainer.innerHTML = '<div class="text-center text-slate-500 text-sm mt-10">Library is empty.<br><br>Click the ➕📖 icon in the top right to scan a book, or Import a JSON.</div>';
            return;
        }
        
        const tx = db.transaction("bookData", "readonly");
        const getAllReq = tx.objectStore("bookData").getAll();

        getAllReq.onsuccess = () => {
            const books = getAllReq.result;
            if (!books || books.length === 0) {
                UI.libraryContainer.innerHTML = '<div class="text-center text-slate-500 text-sm mt-10">Library is empty.</div>';
                return;
            }

            UI.libraryContainer.innerHTML = '';
            books.sort((a,b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));

            books.forEach(book => {
                const card = document.createElement('div');
                card.className = "w-full text-left bg-slate-800/80 hover:bg-slate-700/80 p-3.5 rounded-xl transition-all border border-slate-700 hover:border-sky-500/50 flex flex-col gap-2.5 cursor-pointer shadow-sm group";
                
                const safeTitle = typeof book.title === 'string' ? book.title : 'book';
                const dateObj = new Date(book.dateAdded || Date.now());
                const chunkCount = Array.isArray(book.chunks) ? book.chunks.length : 0;

                card.innerHTML = `
                    <div class="flex justify-between items-start gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-sky-100 text-sm truncate book-title-display">${safeTitle}</div>
                            <div class="text-[11px] text-slate-400 mt-0.5">${chunkCount} chunks • ${dateObj.toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-700/50 mt-1">
                        <button class="edit-book-btn p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-600/50 rounded-lg transition-colors" title="Rename Book">✏️</button>
                        <button class="share-book-btn p-1.5 text-slate-400 hover:text-green-400 hover:bg-slate-600/50 rounded-lg transition-colors" title="Share Book JSON">📤</button>
                        <button class="delete-book-btn p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600/50 rounded-lg transition-colors" title="Delete Book">🗑️</button>
                    </div>
                `;

                card.onclick = (ev) => {
                    if (ev.target.closest('button')) return;
                    activateBookMode(book);
                    UI.libraryModal.classList.add('hidden');
                };

                card.querySelector('.edit-book-btn').onclick = (ev) => {
                    ev.stopPropagation();
                    const newTitle = prompt("Enter a new title:", safeTitle);
                    if (newTitle && newTitle.trim()) {
                        book.title = newTitle.trim();
                        const updateTx = db.transaction("bookData", "readwrite");
                        updateTx.objectStore("bookData").put(book, book.id);
                        updateTx.oncomplete = () => renderBookLibrary();
                    }
                };

                card.querySelector('.share-book-btn').onclick = async (ev) => {
                    ev.stopPropagation();
                    const cleanFileName = safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_rag.json';
                    const jsonString = JSON.stringify(book, null, 2);
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const file = new File([blob], cleanFileName, { type: 'application/json' });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        try { await navigator.share({ files: [file], title: safeTitle }); return; } catch (err) {}
                    }
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = cleanFileName;
                    a.click();
                };

                card.querySelector('.delete-book-btn').onclick = (ev) => {
                    ev.stopPropagation();
                    if (confirm(`Delete "${safeTitle}"?`)) {
                        const delTx = db.transaction("bookData", "readwrite");
                        delTx.objectStore("bookData").delete(book.id);
                        delTx.oncomplete = () => renderBookLibrary();
                    }
                };

                UI.libraryContainer.appendChild(card);
            });
        };
    };
}



			function initSpeechRecognition() {
				const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
				if (!SpeechRec) return;
				recognition = new SpeechRec();
				recognition.continuous = false; 
				recognition.interimResults = true; // Changed to true to accumulate text seamlessly
				
				recognition.onstart = () => {
					isListening = true;
					updateStopButtonVisibility();
					UI.btnMic.classList.add('mic-pulse');
					UI.status.style.backgroundColor = '#ef4444'; 
					UI.textIn.value = '';
					UI.textIn.placeholder = "Listening... Speak now.";
				};
				
				recognition.onresult = (e) => {
					let interimText = '';
					for (let i = e.resultIndex; i < e.results.length; ++i) {
						if (e.results[i].isFinal) {
							finalMicTranscript += e.results[i][0].transcript + " ";
						} else {
							interimText += e.results[i][0].transcript;
						}
					}
					UI.textIn.value = (finalMicTranscript + interimText).trim();
				};
				
				recognition.onend = () => {
					isListening = false;
					
					if (isMicHeld) {
						// The child is still holding the button, but the API paused. Restart instantly.
						try { recognition.start(); } catch(err) {}
					} else {
						// Button was released (Push-to-talk) OR the toggle timed out
						if (!state.isProcessing) resetMicUI();
						setTimeout(updateStopButtonVisibility, 50);
						
						const fullText = UI.textIn.value.trim();
						if (fullText) {
							processInput(fullText);
						}
						finalMicTranscript = ''; 
						isMicToggled = false;
					}
				};
				
				recognition.onerror = (e) => {
					isListening = false; 
					if (e.error !== 'no-speech') {
						resetMicUI();
						setTimeout(updateStopButtonVisibility, 50);
						isMicHeld = false;
						isMicToggled = false;
					}
				};
			}
			
function resetMicUI() {
    UI.btnMic.classList.remove('mic-pulse');
    UI.status.style.backgroundColor = '#4b5563'; 
    UI.textIn.placeholder = "Type your message...";
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

// --- DHWANI GREETING HELPER ---
function getDhwaniGreeting(langCode, author, book) {
    const lang = langCode.split('-')[0];

    switch (lang) {

				case 'mr':
			return `नमस्कार, मी ध्वनी. मी तुमची कृत्रिम बुद्धिमत्तेवर आधारित ज्ञानमार्गदर्शक आहे. कसे आहात तुम्ही? तुम्ही निवडलेल्या प्राचीन ग्रंथांतील ज्ञानाच्या आधारे मी तुमच्या प्रश्नांना शक्य तितकी अचूक आणि संदर्भाधारित उत्तरे देण्याचा प्रयत्न करेन. तुम्ही या ग्रंथांशी संबंधित कोणताही प्रश्न निःसंकोचपणे विचारू शकता.`;

		case 'hi':
			return `नमस्कार, मैं ध्वनि हूँ। मैं आपकी कृत्रिम बुद्धिमत्ता आधारित ज्ञान मार्गदर्शक हूँ। आप कैसे हैं? आपके द्वारा चुने गए प्राचीन ग्रंथों के ज्ञान के आधार पर मैं आपके प्रश्नों के यथासंभव सटीक और संदर्भ आधारित उत्तर देने का प्रयास करूँगी। आप इन ग्रंथों से संबंधित कोई भी प्रश्न निःसंकोच पूछ सकते हैं।`;

		case 'en':
			return `Hello, I am Dhwani. I am your AI Knowledge Guide. How are you? Using the wisdom contained in the ancient scriptures you have selected, I will do my best to provide accurate, context-aware, and meaningful answers to your questions. Please feel free to ask any question related to these scriptures.`;

		case 'bn':
			return `নমস্কার, আমি ধ্বনি। আমি আপনার কৃত্রিম বুদ্ধিমত্তাভিত্তিক জ্ঞান-সহায়ক। আপনি কেমন আছেন? আপনার নির্বাচিত প্রাচীন গ্রন্থগুলির জ্ঞানের ভিত্তিতে আমি আপনার প্রশ্নগুলির যথাসম্ভব সঠিক ও প্রাসঙ্গিক উত্তর দেওয়ার চেষ্টা করব। আপনি এই গ্রন্থগুলি সম্পর্কে নির্দ্বিধায় যেকোনো প্রশ্ন করতে পারেন।`;

		case 'te':
			return `నమస్కారం, నేను ధ్వని. నేను మీ కృత్రిమ మేధస్సు ఆధారిత జ్ఞాన మార్గదర్శిని. మీరు ఎలా ఉన్నారు? మీరు ఎంపిక చేసిన ప్రాచీన గ్రంథాలలోని జ్ఞానాన్ని ఆధారంగా తీసుకుని మీ ప్రశ్నలకు సాధ్యమైనంత ఖచ్చితమైన మరియు సందర్భానుసారమైన సమాధానాలను అందించడానికి నేను ప్రయత్నిస్తాను. ఈ గ్రంథాలకు సంబంధించిన ఏ ప్రశ్ననైనా సంకోచం లేకుండా అడగండి.`;

		case 'ta':
			return `வணக்கம், நான் த்வனி. நான் உங்கள் செயற்கை நுண்ணறிவு அறிவு வழிகாட்டி. நீங்கள் எப்படி இருக்கிறீர்கள்? நீங்கள் தேர்ந்தெடுத்த பண்டைய நூல்களில் உள்ள ஞானத்தின் அடிப்படையில் உங்கள் கேள்விகளுக்கு முடிந்தவரை துல்லியமான மற்றும் சூழலுக்கேற்ற பதில்களை வழங்க நான் முயற்சிப்பேன். இந்த நூல்கள் தொடர்பாக எந்தக் கேள்வியையும் தயக்கமின்றி கேளுங்கள்.`;

		case 'gu':
			return `નમસ્કાર, હું ધ્વનિ છું. હું તમારી કૃત્રિમ બુદ્ધિમત્તા આધારિત જ્ઞાન માર્ગદર્શિકા છું. તમે કેમ છો? તમે પસંદ કરેલા પ્રાચીન ગ્રંથોમાં રહેલા જ્ઞાનના આધારે હું તમારા પ્રશ્નોના શક્ય તેટલા સચોટ અને સંદર્ભ આધારિત જવાબ આપવા પ્રયત્ન કરીશ. આ ગ્રંથો સંબંધિત કોઈપણ પ્રશ્ન તમે નિઃસંકોચ પૂછી શકો છો.`;

		case 'kn':
			return `ನಮಸ್ಕಾರ, ನಾನು ಧ್ವನಿ. ನಾನು ನಿಮ್ಮ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಆಧಾರಿತ ಜ್ಞಾನ ಮಾರ್ಗದರ್ಶಿ. ನೀವು ಹೇಗಿದ್ದೀರಿ? ನೀವು ಆಯ್ಕೆ ಮಾಡಿದ ಪ್ರಾಚೀನ ಗ್ರಂಥಗಳಲ್ಲಿರುವ ಜ್ಞಾನದ ಆಧಾರದ ಮೇಲೆ ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳಿಗೆ ಸಾಧ್ಯವಾದಷ್ಟು ನಿಖರವಾದ ಮತ್ತು ಸಂದರ್ಭೋಚಿತ ಉತ್ತರಗಳನ್ನು ನೀಡಲು ನಾನು ಪ್ರಯತ್ನಿಸುತ್ತೇನೆ. ಈ ಗ್ರಂಥಗಳಿಗೆ ಸಂಬಂಧಿಸಿದ ಯಾವುದೇ ಪ್ರಶ್ನೆಯನ್ನು ಮುಕ್ತವಾಗಿ ಕೇಳಬಹುದು.`;

		case 'ml':
			return `നമസ്കാരം, ഞാൻ ധ്വനി. ഞാൻ നിങ്ങളുടെ കൃത്രിമ ബുദ്ധി അധിഷ്ഠിത വിജ്ഞാന മാർഗദർശിയാണ്. നിങ്ങൾക്ക് സുഖമാണോ? നിങ്ങൾ തിരഞ്ഞെടുത്ത പ്രാചീന ഗ്രന്ഥങ്ങളിലെ അറിവിന്റെ അടിസ്ഥാനത്തിൽ നിങ്ങളുടെ ചോദ്യങ്ങൾക്ക് കഴിയുന്നത്ര കൃത്യവും സന്ദർഭാനുസൃതവുമായ ഉത്തരങ്ങൾ നൽകാൻ ഞാൻ ശ്രമിക്കും. ഈ ഗ്രന്ഥങ്ങളെക്കുറിച്ച് നിങ്ങൾക്ക് ഏത് ചോദ്യവും മടിക്കാതെ ചോദിക്കാം.`;

		case 'pa':
			return `ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਧਵਨੀ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੀ ਕ੍ਰਿਤ੍ਰਿਮ ਬੁੱਧੀ ਆਧਾਰਿਤ ਗਿਆਨ ਮਾਰਗਦਰਸ਼ਕ ਹਾਂ। ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ? ਤੁਹਾਡੇ ਦੁਆਰਾ ਚੁਣੇ ਗਏ ਪ੍ਰਾਚੀਨ ਗ੍ਰੰਥਾਂ ਦੇ ਗਿਆਨ ਦੇ ਆਧਾਰ 'ਤੇ ਮੈਂ ਤੁਹਾਡੇ ਸਵਾਲਾਂ ਦੇ ਸੰਭਵ ਤੌਰ 'ਤੇ ਸਭ ਤੋਂ ਸਹੀ ਅਤੇ ਸੰਦਰਭ ਅਨੁਸਾਰ ਜਵਾਬ ਦੇਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰਾਂਗੀ। ਤੁਸੀਂ ਇਨ੍ਹਾਂ ਗ੍ਰੰਥਾਂ ਨਾਲ ਸੰਬੰਧਿਤ ਕੋਈ ਵੀ ਸਵਾਲ ਬੇਝਿਝਕ ਪੁੱਛ ਸਕਦੇ ਹੋ।`;

		case 'or':
			return `ନମସ୍କାର, ମୁଁ ଧ୍ୱନି। ମୁଁ ଆପଣଙ୍କ କୃତ୍ରିମ ବୁଦ୍ଧିମତ୍ତା ଆଧାରିତ ଜ୍ଞାନ ମାର୍ଗଦର୍ଶିକା। ଆପଣ କେମିତି ଅଛନ୍ତି? ଆପଣ ଚୟନ କରିଥିବା ପ୍ରାଚୀନ ଗ୍ରନ୍ଥମାନଙ୍କର ଜ୍ଞାନର ଆଧାରରେ ମୁଁ ଆପଣଙ୍କ ପ୍ରଶ୍ନଗୁଡ଼ିକର ସମ୍ଭବ ହେଉଅତିକି ସଠିକ୍ ଏବଂ ପ୍ରସଙ୍ଗଅନୁକୂଳ ଉତ୍ତର ଦେବାକୁ ଚେଷ୍ଟା କରିବି। ଏହି ଗ୍ରନ୍ଥଗୁଡ଼ିକ ସମ୍ପର୍କରେ ଆପଣ ନିର୍ବିକଳ୍ପରେ ଯେକୌଣସି ପ୍ରଶ୍ନ ପଚାରିପାରିବେ।`;

		default:
			return `Hello, I am Dhwani. I am your AI Knowledge Guide. How are you? Using the wisdom contained in the ancient scriptures you have selected, I will do my best to provide accurate, context-aware, and meaningful answers to your questions. Please feel free to ask any question related to these scriptures.`;
	
	}
}
// --- APPEND TEXT TO EXISTING BUBBLE ---
function appendToExistingMessage(msgId, newText) {
    const mdBody = document.getElementById(`md-${msgId}`);
    if (!mdBody) return;

    // Parse the new markdown text
    let parsedText = newText;
    let mediaLinks = "";
    parsedText = parsedText.replace(/YT_SEARCH:\s*(.*)/g, (match, keyword) => {
        const q = encodeURIComponent(keyword.trim());
        mediaLinks += `<a href="https://www.youtube.com/results?search_query=${q}" target="_blank" class="external-link-btn yt-btn">🎥 Watch Video</a>`;
        return ""; 
    });
    parsedText = parsedText.replace(/IMG_SEARCH:\s*(.*)/g, (match, keyword) => {
        const q = encodeURIComponent(keyword.trim());
        mediaLinks += `<a href="https://www.google.com/search?tbm=isch&q=${q}" target="_blank" class="external-link-btn img-btn">🖼️ See Images</a>`;
        return "";
    });

    const newHtml = marked.parse(parsedText) + (mediaLinks ? `<div class="mt-3 block border-t border-slate-700/50 pt-2 flex flex-wrap">${mediaLinks}</div>` : '');

    // Inject into the DOM
    const wrapper = document.createElement('div');
    wrapper.className = "mt-3 pt-3 border-t border-slate-700/50 opacity-0 transition-opacity duration-700";
    wrapper.innerHTML = newHtml;
    mdBody.appendChild(wrapper);
    
    // Fade-in effect
    setTimeout(() => wrapper.classList.remove('opacity-0'), 50);

    // Update Maps for Copy and PDF
    rawTextMap[msgId] += "\n\n" + newText;
    
    const cleanNewTextForTTS = newText
        .replace(/YT_SEARCH:.*$/gm, '')
        .replace(/IMG_SEARCH:.*$/gm, '')
        .replace(/[*_#`~]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/[<>()\[\]{}]/g, ' ')
        .trim();

    const existingWordCount = (speechDataMap[msgId].match(/\S+/g) || []).length;
    speechDataMap[msgId] += " " + cleanNewTextForTTS;

    // Prepare spans for highlighting
    const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (node.parentNode && node.parentNode.closest('.external-link-btn')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    }, false);
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.trim() !== '') textNodes.push(node);
    }

    let wordCounter = existingWordCount;
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
                wordCounter++;
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });
        textNode.parentNode.replaceChild(fragment, textNode);
    });

    // Auto-queue audio for the appended text
    if (!state.isMuted) {
        const btnElem = document.getElementById(`play-btn-${msgId}`);
        const activeEngine = UI.ttsEngine ? UI.ttsEngine.value : 'native';
        
        window.currentPlayingText = speechDataMap[msgId];
        const newWords = cleanNewTextForTTS.match(/\S+/g) || [];
        wordsArray.push(...newWords);

        if (activeEngine === 'cloud') {
            const newChunks = chunkText(cleanNewTextForTTS, 180);
            audioChunks.push(...newChunks);
            // Resume if the intro audio finished before the API returned
            if (ttsStatus === 'STOPPED') {
                ttsStatus = 'PLAYING';
                updatePlayBtnUI(btnElem, true);
                playNextChunk(UI.lang ? UI.lang.value.split('-')[0] : 'hi', msgId, btnElem);
            }
        } else {
            // Native Audio Engine Append
            if (ttsStatus === 'STOPPED') {
                ttsStatus = 'PLAYING';
                updatePlayBtnUI(btnElem, true);
                playNativeAudioSegment(cleanNewTextForTTS, msgId, UI.lang ? UI.lang.value : 'hi-IN');
            } else {
                // The onend handler in playNativeAudioSegment will automatically detect them and keep reading.
            }
        }
    }

    setTimeout(() => { UI.log.scrollTop = UI.log.scrollHeight; }, 100);
}


async function processInput(userText) {
    userText = userText.trim();
    if (!userText || state.isProcessing) return;

    UI.textIn.value = '';
    UI.textIn.placeholder = "Consulting ancient texts...";
    if (UI.welcome) UI.welcome.style.display = 'none';
    
    state.isProcessing = true;
    UI.status.style.backgroundColor = '#facc15'; 
    setMicThinkingState(true);
    updateStopButtonVisibility(); 

    const config = getSelectedConfig();
    const isFirstMessage = (chatHistory.length === 0);
    const userName = UI.name.value || "Bhakt";

    // 1. Render User Message First
    renderMessage(userName, userText, false);

    let introMsgId = null;

 
// 2. INSTANT GREETING: Catch the user gesture before it expires!
    if (isFirstMessage) {
        let greetingText = "";
        
        // Custom greeting if it's a global archive book
		if (selectedLibraryItem.startsWith('Archive|')) {
            greetingText = `Hello ${userName}. I am Dhwani, a interpreter of the book "${config.texts}". I am ready to break down its chapters, theories, and concepts for you.`;
        } else {
            // Standard ancient library greeting
            greetingText = getDhwaniGreeting(UI.lang.value, config.persona, config.texts);
        }
        
        chatHistory.push({ role: 'user', parts: [{ text: "Pranam." }] });
        chatHistory.push({ role: 'model', parts: [{ text: greetingText }] });
        
        introMsgId = renderMessage("Dhwani", greetingText, true);
        if (!state.isMuted) {
            const btn = document.getElementById(`play-btn-${introMsgId}`);
            if (btn) window.toggleSingleMessagePlay(btn); // Plays instantly
        }
    }

    // 3. NOW trigger the 2.5 second delay while the API prepares to fetch
    // await new Promise(resolve => setTimeout(resolve, 2500));

    chatHistory.push({ role: 'user', parts: [{ text: userText }] });
    saveData();


try {
        let rawRes = await getAIResponse(chatHistory, config);
        
        // 4. FIX: Trim FIRST! If the AI starts with a space/newline, the ^ anchor fails.
        rawRes = rawRes.trim();
        
        // 5. FIX: Expanded the filter to catch "verified records", "global library databases", and "I apologize"
        rawRes = rawRes.replace(/^.*?(global library records|verified digital entry|databases queried|digital lookup|public records|verified records|global library databases).*?(\n\n|\.\s+)/is, '');
        rawRes = rawRes.replace(/^(Although |Even though |I cannot locate |I am unable |While the |I apologize).*?\n\n/is, '');
        
        // Trim again to clean up any leftover whitespace
        rawRes = rawRes.trim();
        
        state.lastAIMessage = rawRes;
        chatHistory.push({ role: 'model', parts: [{ text: rawRes }] });
        
        if (isFirstMessage && introMsgId) {
            appendToExistingMessage(introMsgId, rawRes);
        } else {
            const newMsgId = renderMessage("Dhwani", rawRes, true); 
            if (!state.isMuted && ttsStatus !== 'PLAYING') {
                const btn = document.getElementById(`play-btn-${newMsgId}`);
                if (btn) window.toggleSingleMessagePlay(btn);
            }
        }
        
        saveData();
        updateEditPencil();
		logQAToSupabase(userText, rawRes);
        
    } catch (err) {
        if (err.name === 'AbortError') {
            chatHistory.pop(); 
            if (UI.log.lastElementChild) UI.log.removeChild(UI.log.lastElementChild); 
            UI.textIn.value = userText; 
            UI.textIn.focus();
        } else {
            renderMessage("System", "⚠️ Divine connection interrupted. Please try again.", true);
        }
    }

    state.isProcessing = false;
    resetMicUI();
    setTimeout(updateStopButtonVisibility, 100); 
}

// Universal metadata fetcher for the background LLM prompt
async function fetchGlobalBookMetadata(query) {
    try {
        // 1. Try Google Books API (General search, NO strict 'intitle:' filter)
        const gbResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&printType=books`);
        const gbData = await gbResponse.json();

        if (gbResponse.ok && gbData.items && gbData.items.length > 0) {
            const info = gbData.items[0].volumeInfo;
            return `--- GOOGLE BOOKS RECORD ---\nTitle: ${info.title || query}\nAuthor(s): ${info.authors ? info.authors.join(", ") : "Unknown"}\nSynopsis: ${info.description ? info.description.substring(0, 1200) : "No official synopsis available."}\n`;
        }
        
        // 2. FALLBACK: Open Library API (Bypasses Google API blocks)
        const olResponse = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`);
        const olData = await olResponse.json();
        
        if (olData.docs && olData.docs.length > 0) {
            const doc = olData.docs[0];
            return `--- OPEN LIBRARY RECORD ---\nTitle: ${doc.title || query}\nAuthor(s): ${doc.author_name ? doc.author_name.join(", ") : "Unknown"}\nFirst Published: ${doc.first_publish_year || 'Unknown'}\n`;
        }

        return null; // Both failed

    } catch (error) {
        console.error("Global Metadata Fetch Error:", error);
        return null;
    }
}

// Fetches public domain records, historical summaries, and alternate metadata
async function fetchArchiveOrgData(query) {
    try {
        const url = `https://archive.org/advancedsearch.php?q=title:(${encodeURIComponent(query)})&fl[]=identifier,title,creator,description,year&sort[]=downloads+desc&rows=1&output=json`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.response && data.response.docs.length > 0) {
            const doc = data.response.docs[0];
            return {
                title: doc.title || query,
                authors: doc.creator ? doc.creator.join(", ") : "Unknown",
                year: doc.year || "Unknown",
                // Strip raw HTML tags that often appear in Archive.org descriptions
                description: doc.description ? doc.description.toString().replace(/<[^>]*>?/gm, '').substring(0, 1200) : "No description available."
            };
        }
        return null;
    } catch (e) {
        console.error("Archive.org Fetch Error:", e);
        return null;
    }
}

async function getAIResponse(history, config) {
    const customKey = (UI.keyIn.value.length > 10) ? UI.keyIn.value : null;
    const headers = { 'Content-Type': 'application/json' };

    let contextAddon = "";
    if (UI.age.value) contextAddon = ` The user is ${UI.age.value} years old. Adjust the complexity of your explanation accordingly.`;
    if (UI.name.value) contextAddon += ` Address them compassionately as ${UI.name.value}.`;

    const bookRatio = UI.ratioSlider.value;
    const aiRatio = 100 - bookRatio;
    const selectedModelInfo = getModelInfo(UI.modelSlider.value);

    const [group, itemName] = selectedLibraryItem.split('|');
    const isArchive = (group === 'Archive');

    let prompt = "";
    let bookTitle = "";
    let bookAuthor = "";
    let bookOverview = "";
	
	if (isBookMode) {
        const userQuery = history[history.length - 1].parts[0].text || "";
        const topChunks = retrieveRelevantChunks(userQuery, 8);
        const contextText = topChunks.map(c => `[Page ${c.page_start}]: ${c.text}`).join('\n\n');

        prompt = `You are the interactive voice avatar of the book titled "${activeBookTitle}".
        Answer the user's questions based on the following retrieved book excerpts. 
        
        CRITICAL INSTRUCTION: If the exact specific word the user asked for is not found, intelligently scan the excerpts for related descriptive concepts and synthesize a helpful answer based on that broader context. 
        Always mention the relevant page number(s) in your answer. Keep your response highly conversational, clear, and direct so it sounds natural when spoken aloud by a TTS engine. Do NOT use complex LaTeX.
        
        RELEVANT BOOK EXCERPTS:
        ${contextText}`;
    }

    else if (isArchive) {
        // Use the metadata already loaded by the search UI
        const bookInfo = window.currentBookContext || { title: itemName, authors: "", snippet: "" };
        bookTitle = bookInfo.title || itemName;
        bookAuthor = (bookInfo.authors && bookInfo.authors !== "Unknown Author") ? ` by ${bookInfo.authors}` : "";
        bookOverview = (bookInfo.snippet && !bookInfo.snippet.includes("No description")) ? `Summary Context: ${bookInfo.snippet}` : "";

        // --- GLOBAL MASTER PROFESSOR PROMPT ---
        // 2. FIX: Added the CRITICAL RULES (Anti-apology) to the Archive prompt
        prompt = `You are Dhwani, an expert university professor and master tutor. You have complete, encyclopedic mastery of the book "${bookTitle}"${bookAuthor}.

${bookOverview}

CRITICAL RULES:
1. Master Authority: You MUST act as if you have the book right in front of you. NEVER mention "library records", "verified digital entry", "metadata", "databases", or state that you cannot locate the book. NEVER apologize for lack of records. If the specific edition is obscure, discuss the core themes of the primary text confidently.
2. Structure & Breadth: Immediately outline the primary volumes, units, or major theoretical sections of "${bookTitle}"${bookAuthor}, explaining how the concepts build on each other.
3. Proactive Engagement: Conclude by asking the student which specific chapter, theorem, formula, or problem they want to work through today.
4. Tone: Academic, rigorous, encouraging, and clear. Tailored for a ${UI.age.value || '25'}-year-old student. ${contextAddon}
5. Language: Strictly ${UI.lang.value}.
6. Formatting: Use clean Markdown with bold topic headers and bullet points.
7. Media Links: At the very end, provide EXACTLY two lines:
   YT_SEARCH: ${bookTitle} lectures
   IMG_SEARCH: ${bookTitle} diagram`;

    } else {
        // --- ANCIENT LIBRARY PROMPT ---
        // 3. FIX: Define the ancient library variables correctly here
        bookTitle = config.texts || itemName;
        bookAuthor = config.persona ? ` (Wisdom of ${config.persona})` : "";
        bookOverview = config.desc ? `Context: ${config.desc}` : "";

        prompt = `You are Dhwani, an expert university professor and master tutor. You have complete, encyclopedic mastery of the book "${bookTitle}"${bookAuthor}.

${bookOverview}

CRITICAL RULES:
1. Master Authority: You MUST act as if you are holding the book. NEVER mention "library records", "digital entry", "metadata", or "databases". NEVER apologize.
2. Structure & Breadth: Immediately outline the primary volumes, units, or major theoretical sections of "${bookTitle}"${bookAuthor}, explaining how the concepts build on each other.
3. Proactive Engagement: Conclude by asking the student which specific chapter, theorem, formula, or problem they want to work through today.
4. Tone: Academic, rigorous, encouraging, and clear. Tailored for a ${UI.age.value || '25'}-year-old student. ${contextAddon}
5. Language: Strictly ${UI.lang.value}.
6. Formatting: Use clean Markdown with bold topic headers and bullet points.
7. Media Links: At the very end, provide EXACTLY two lines:
   YT_SEARCH: ${bookTitle} lectures
   IMG_SEARCH: ${bookTitle} diagram`;
    }
    
    const payload = { 
        contents: history.slice(-10), 
        systemInstruction: { parts: [{ text: prompt }] }
    };

    let fetchUrl = customKey 
        ? `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelInfo.id}:generateContent?key=${customKey}` 
        : `${PROXY_URL}/api/chat`;

    if (!customKey) payload.model = selectedModelInfo.id;

    currentAborter = new AbortController();

    try {
        const response = await fetch(fetchUrl, { 
            method: 'POST', 
            headers: headers, 
            body: JSON.stringify(payload),
            signal: currentAborter.signal 
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error("API Error:", errData);
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;

    } catch (err) {
        throw err; 
    }
}




// --- DUAL TTS ENGINE (CLOUD & NATIVE) ---
function prepareTextForTTSAndHighlighting(container, msgId) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (node.parentNode && node.parentNode.closest('.external-link-btn')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    }, false);
    const textNodes = [];
    let node;
    
    while (node = walker.nextNode()) {
        if (node.nodeValue.trim() !== '') {
            textNodes.push(node);
        }
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
            span.classList.add('bg-yellow-500/30', 'text-yellow-300', 'font-bold', 'rounded-[3px]', 'px-[2px]', 'shadow-[0_0_8px_rgba(234,179,8,0.4)]');
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
        lastHighlightedSpan.classList.remove('bg-yellow-500/30', 'text-yellow-300', 'font-bold', 'rounded-[3px]', 'px-[2px]', 'shadow-[0_0_8px_rgba(234,179,8,0.4)]');
        lastHighlightedSpan = null;
    }
}

function updatePlayBtnUI(btn, isPlaying) {
    if (!btn) return;
    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');
    const textSpan = btn.querySelector('.play-text');

    if (isPlaying) {
        if (playIcon) playIcon.classList.add('hidden');
        if (pauseIcon) pauseIcon.classList.remove('hidden');
        if (textSpan) textSpan.innerText = "Pause";
        
        // Make the button float and turn green
        btn.classList.add('text-green-400', 'is-floating');
        btn.classList.remove('text-slate-400');
        
        // Ensure no other play buttons are floating
        document.querySelectorAll('.btn-play-msg.is-floating').forEach(el => {
            if (el !== btn) el.classList.remove('is-floating');
        });
        
    } else {
        if (playIcon) playIcon.classList.remove('hidden');
        if (pauseIcon) pauseIcon.classList.add('hidden');
        if (textSpan) textSpan.innerText = "Resume"; // If paused, it says resume
        
        btn.classList.remove('text-green-400');
        btn.classList.add('text-slate-400');
        // Note: We intentionally leave the 'is-floating' class active while PAUSED 
        // so the user doesn't have to scroll to find the resume button.
    }
}

function resetCurrentTTS() {
    if (currentActiveBtn) {
        updatePlayBtnUI(currentActiveBtn, false);
        const textSpan = currentActiveBtn.querySelector('.play-text');
        if (textSpan) textSpan.innerText = "Play";
        
        currentActiveBtn.classList.remove('is-floating');
        currentActiveBtn = null;
    }
    
    document.querySelectorAll('.btn-play-msg.is-floating').forEach(el => el.classList.remove('is-floating'));
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = "";
    }
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    if (highlightTimer) {
        clearTimeout(highlightTimer);
        highlightTimer = null; // Always reset to null
    }

    clearTTSHighlight(); 
    ttsStatus = 'STOPPED';
    globalWordIndex = 0;
    window.currentPlayingText = "";
    isManuallyPaused = false;

    setTimeout(updateStopButtonVisibility, 50); 
}

window.toggleSingleMessagePlay = (btnElem) => {
    if (state.isMuted) {
        alert("Audio is muted. Please tap the speaker icon at the bottom to unmute and enable voice features.");
        return;
    }

    const msgId = btnElem.getAttribute('data-msg-id');
    const plainText = speechDataMap[msgId] || "";
    const activeEngine = UI.ttsEngine ? UI.ttsEngine.value : 'native';

    if (currentActiveBtn === btnElem && window.currentPlayingText === plainText) {
        if (ttsStatus === 'PAUSED') {
            ttsStatus = 'PLAYING';
            updatePlayBtnUI(btnElem, true);
            updateStopButtonVisibility(); 
            
            if (activeEngine === 'cloud') {
                isManuallyPaused = false;
                if (currentAudio && currentAudio.src) currentAudio.play();
                startHighlightTimer(msgId);
            } else {
                // NATIVE RESUME FIX:
                // Keep isManuallyPaused = true until cancel() finishes processing
                window.speechSynthesis.cancel();
                
                setTimeout(() => {
                    isManuallyPaused = false; // Safely unlock after cancel finishes
                    
                    if (highlightTimer) {
                        clearTimeout(highlightTimer);
                        highlightTimer = null; // Clear timer reference for onstart
                    }

                    const remainingText = wordsArray.slice(globalWordIndex).join(" ");
                    if (remainingText.trim()) {
                        playNativeAudioSegment(remainingText, msgId, UI.lang ? UI.lang.value : 'hi-IN');
                    } else {
                        resetCurrentTTS();
                    }
                }, 100);
            }
            return;
        } else if (ttsStatus === 'PLAYING') {
            ttsStatus = 'PAUSED';
            isManuallyPaused = true; // Protect pause state from triggering reset handlers
            updatePlayBtnUI(btnElem, false);
            
            if (activeEngine === 'cloud') {
                if (currentAudio) currentAudio.pause();
            } else {
                window.speechSynthesis.cancel(); // Stop Android Native TTS
            }

            if (highlightTimer) {
                clearTimeout(highlightTimer);
                highlightTimer = null; // Reset reference to allow restart on resume
            }
            return;
        }
    }

    resetCurrentTTS();
    currentActiveBtn = btnElem;
    window.currentPlayingText = plainText;
    ttsStatus = 'PLAYING';
    isManuallyPaused = false; 
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
    const langCode = UI.lang ? UI.lang.value : 'hi-IN';
    
    wordsArray = fullText.match(/\S+/g) || [];
    globalWordIndex = 0;
    
    playNativeAudioSegment(fullText, msgId, langCode);
}

function playNativeAudioSegment(text, msgId, langCode) {
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = parseFloat(UI.ttsSpeedSlider ? UI.ttsSpeedSlider.value : 1.0);
    utterance.pitch = parseFloat(UI.ttsPitchSlider ? UI.ttsPitchSlider.value : 1.0);
    
    utterance.onstart = () => {
        if (!highlightTimer) startHighlightTimer(msgId);
    };

	utterance.onend = () => {
        if (isManuallyPaused) return; // Prevent Android from killing the session on pause!
        
        setTimeout(() => {
            if (isManuallyPaused) return; // Double check
            
            if (globalWordIndex >= wordsArray.length - 2) {
                resetCurrentTTS();
            } else if (ttsStatus === 'PLAYING') {
                const remainingText = wordsArray.slice(globalWordIndex).join(" ");
                playNativeAudioSegment(remainingText, msgId, langCode);
            }
        }, 150);
    };

    utterance.onerror = (e) => {
        if (isManuallyPaused) return; // Ignore errors thrown by our intentional cancel()
        if (e.error !== 'canceled' && e.error !== 'interrupted') resetCurrentTTS();
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
    const langCode = UI.lang ? UI.lang.value.split('-')[0] : 'hi';
    
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
    const text = (rawTextMap[msgId] || "").replace(/YT_SEARCH:.*$/gm, '').replace(/IMG_SEARCH:.*$/gm, '').trim(); 
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
    title.innerText = `Ancient Library: ${getSelectedItemName()}`;
    title.style.color = '#0891b2'; 
    title.style.marginBottom = '15px';
    container.appendChild(title);

    const content = document.createElement('div');
    content.innerHTML = marked.parse(rawText);
    content.style.lineHeight = '1.6';
    
    // Force text colors so they don't render white-on-white
    const allElements = content.querySelectorAll('*');
    allElements.forEach(el => { el.style.color = '#1e293b'; });

    container.appendChild(content);

    const opt = {
        margin:       0.5,
        filename:     `Ancient_Library_Note_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    // Exact logic from appteach1.js - direct from container to save
    html2pdf().set(opt).from(container).save();
};

window.downloadSinglePDF = (btnElem, senderName) => {
    if (typeof html2pdf === 'undefined') {
        alert("PDF engine is still loading. Please try again in a moment.");
        return;
    }

    // Now this will correctly grab the ID and the text!
    const msgId = btnElem.getAttribute('data-msg-id');
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
    title.innerText = `Ancient Library: ${getSelectedItemName()}`;
    title.style.color = '#0891b2'; 
    title.style.marginBottom = '15px';
    container.appendChild(title);

    const content = document.createElement('div');
    content.innerHTML = marked.parse(rawText);
    content.style.lineHeight = '1.6';
    
    // Force text colors so they don't render white-on-white
    const allElements = content.querySelectorAll('*');
    allElements.forEach(el => { el.style.color = '#1e293b'; });

    container.appendChild(content);

    const opt = {
        margin:       0.5,
        filename:     `Ancient_Library_Note_${new Date().toISOString().slice(0,10)}.pdf`,
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
        alert("The library is currently empty. Speak to a sage first.");
        return;
    }

    const container = document.createElement('div');
    container.style.padding = '30px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.backgroundColor = '#FFFFFF'; 
    container.style.color = '#000000'; 

    const header = document.createElement('div');
    header.innerText = "ai.eprashala.com - Ancient Library Session";
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
    title.innerText = currentSessionTitle || `Session: ${new Date().toLocaleDateString()}`;
    title.style.color = '#0891b2'; 
    title.style.marginBottom = '20px';
    container.appendChild(title);

    chatHistory.forEach(msg => {
        const isModel = msg.role === 'model';
        const senderName = isModel ? getSelectedItemName() : (UI.name.value || "Bhakt");
        let rawText = msg.parts[0].text || "";

        if (isModel) {
            rawText = rawText.replace(/YT_SEARCH:.*$/gm, '').replace(/IMG_SEARCH:.*$/gm, '').trim();
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
    
    div.className = `msg-container p-4 rounded-2xl ${isModel ? 'bg-[#0f172a]/90 border border-slate-700/50 shadow-lg ml-2 mr-8' : 'bg-cyan-900/40 text-right mr-2 ml-8'} mb-4`;
    
    let parsedText = text;
    let mediaLinks = "";

    if (isModel) {
        parsedText = parsedText.replace(/YT_SEARCH:\s*(.*)/g, (match, keyword) => {
            const q = encodeURIComponent(keyword.trim());
            mediaLinks += `<a href="https://www.youtube.com/results?search_query=${q}" target="_blank" class="external-link-btn yt-btn">🎥 Watch Video</a>`;
            return ""; 
        });
        parsedText = parsedText.replace(/IMG_SEARCH:\s*(.*)/g, (match, keyword) => {
            const q = encodeURIComponent(keyword.trim());
            mediaLinks += `<a href="https://www.google.com/search?tbm=isch&q=${q}" target="_blank" class="external-link-btn img-btn">🖼️ See Images</a>`;
            return "";
        });
    }

    const displayHtml = isModel ? marked.parse(parsedText) + (mediaLinks ? `<div class="mt-3 block border-t border-slate-700/50 pt-2 flex flex-wrap">${mediaLinks}</div>` : '') : text;
    
    let htmlContent = `
        <div class="text-[10px] uppercase font-bold tracking-wider ${isModel ? 'text-cyan-400 cinzel' : 'text-slate-300'} mb-1">${sender}</div>
        <div class="text-sm leading-relaxed text-gray-100 markdown-body" id="md-${msgId}">${displayHtml}</div>
    `;

    // Inject the edit pencil directly into the user's bubble
    if (!isModel) {
        htmlContent += `
            <div class="flex justify-end mt-1.5 -mb-1">
                <button class="user-edit-btn text-slate-400 hover:text-cyan-400 transition-colors focus:outline-none hidden" onclick="window.triggerEditLastInput(event)" title="Edit this input">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
            </div>
        `;
    }
    
    if (isModel) {
        htmlContent += `
				<div class="msg-action-bar mt-3 flex justify-end gap-2">
                <button class="btn-pdf-msg p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 hover:text-red-400 transition-colors shadow-sm focus:outline-none" data-sender="${sender}" data-msg-id="${msgId}" title="Download Answer as PDF">
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </button>
                <button class="btn-copy-msg p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 hover:text-green-400 transition-colors shadow-sm focus:outline-none" onclick="window.copySingleMessage(this)" data-msg-id="${msgId}" title="Copy Answer">
                    <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <button id="play-btn-${msgId}" class="btn-play-msg flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-400 transition-colors shadow-sm focus:outline-none" data-msg-id="${msgId}" title="Play/Pause Audio">
                    <svg class="play-icon w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <svg class="pause-icon w-4 h-4 hidden pointer-events-none" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    <span class="play-text text-[10px] font-bold uppercase tracking-wider pointer-events-none">Play</span>
                </button>
            </div>`;
    }

    div.innerHTML = htmlContent;
    UI.log.appendChild(div);

    if (isModel) {
        const mdBody = div.querySelector('.markdown-body');
        
        const cleanTextForTTS = text
            .replace(/YT_SEARCH:.*$/gm, '')
            .replace(/IMG_SEARCH:.*$/gm, '')
            .replace(/[*_#`~]/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/<[^>]+>/g, '')
			.replace(/[<>()\[\]{}]/g, ' ')
			.replace(/-{2,}/g, ' ')
            .trim();
            
        const speechText = prepareTextForTTSAndHighlighting(mdBody, msgId);
        speechDataMap[msgId] = cleanTextForTTS; 
    }
    
    updateEditPencil();
    
    setTimeout(() => { UI.log.scrollTop = UI.log.scrollHeight; }, 50);

    return msgId;
}

// --- APP UPDATE SYNC LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const btnUpdateApp = document.getElementById('btn-update-app');

    if (btnUpdateApp) {
        btnUpdateApp.addEventListener('click', async () => {
            const originalText = btnUpdateApp.innerHTML;
            btnUpdateApp.innerHTML = `
                <svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg> Syncing Latest Files...`;
            btnUpdateApp.disabled = true;

            try {
                let syncSuccessful = false;

                // 1. Send direct SYNC_NOW message to active Service Worker
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    const messageChannel = new MessageChannel();
                    
                    const messagePromise = new Promise((resolve) => {
                        // 8-second safety timeout for slower mobile networks
                        const timeout = setTimeout(() => resolve(false), 8000);

                        messageChannel.port1.onmessage = (event) => {
                            clearTimeout(timeout);
                            if (event.data && event.data.status === 'SUCCESS') {
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        };
                    });

                    navigator.serviceWorker.controller.postMessage(
                        { action: 'SYNC_NOW' },
                        [messageChannel.port2]
                    );

                    syncSuccessful = await messagePromise;
                }

                // 2. Fallback execution: Purge caches directly if SW isn't controlling page yet
                if (!syncSuccessful) {
                    console.warn('SW Message channel unavailable/timed out. Executing direct purge fallback...');
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                    }
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let reg of registrations) {
                            await reg.unregister();
                        }
                    }
                }

                // 3. Force hard reload with timestamp query to ensure full fresh render
                window.location.href = window.location.pathname + '?reload=' + Date.now();

            } catch (error) {
                console.error('Update App Error:', error);
                alert('Could not complete update. Please check your internet connection.');
                btnUpdateApp.innerHTML = originalText;
                btnUpdateApp.disabled = false;
            }
        });
    }
});


// --- GOOGLE BOOKS GLOBAL SEARCH ENGINE ---

document.addEventListener("DOMContentLoaded", () => {
    const globalModal = document.getElementById('global-search-modal');
    const btnOpenGlobal = document.getElementById('btn-open-global-search');
    const btnCloseGlobal = document.getElementById('btn-close-global-search');
    const searchInput = document.getElementById('global-search-input');
    const btnSearch = document.getElementById('btn-trigger-global-search');
    const resultsContainer = document.getElementById('global-search-results');

    if (!globalModal || !btnOpenGlobal) return;

    // Open/Close Modal
    btnOpenGlobal.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        globalModal.classList.remove('hidden');
        searchInput.focus();
    });

    btnCloseGlobal.addEventListener('click', () => {
        globalModal.classList.add('hidden');
    });

// Trigger Search
    const executeSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        resultsContainer.innerHTML = `<div class="text-center text-orange-400 mt-10 animate-pulse font-bold">Consulting global archives...</div>`;

        try {
            let booksData = [];
            
            // 1. Try Google Books API First (Best for plot descriptions)
            const gbResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books`);
            const gbData = await gbResponse.json();

		// If Google Books succeeds and isn't blocking us
            if (gbResponse.ok && gbData.items && gbData.items.length > 0) {
                booksData = gbData.items.map(book => {
                    // 1. Force HTTPS on Google Book Thumbnails to prevent Mixed Content blocking
                    let thumbUrl = 'https://via.placeholder.com/128x192.png?text=No+Cover';
                    if (book.volumeInfo.imageLinks) {
                        thumbUrl = book.volumeInfo.imageLinks.thumbnail || book.volumeInfo.imageLinks.smallThumbnail || thumbUrl;
                        thumbUrl = thumbUrl.replace(/^http:\/\//i, 'https://');
                    }
                    
                    return {
                        title: book.volumeInfo.title || "Unknown Title",
                        authors: book.volumeInfo.authors ? book.volumeInfo.authors.join(", ") : "Unknown Author",
                        thumbnail: thumbUrl,
                        snippet: book.volumeInfo.description ? book.volumeInfo.description.substring(0, 120) + "..." : "No description available."
                    };
                });
            } else {
                // 2. FALLBACK: Open Library API (100% free, ignores IP blocks, no API key needed)
                const olResponse = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`);
                const olData = await olResponse.json();
                
                if (olData.docs && olData.docs.length > 0) {
                    booksData = olData.docs.map(doc => ({
                        title: doc.title || "Unknown Title",
                        authors: doc.author_name ? doc.author_name.join(", ") : "Unknown Author",
                        thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : 'https://via.placeholder.com/128x192.png?text=No+Cover',
                        snippet: `First published in ${doc.first_publish_year || 'Unknown'}.`
                    }));
                }
            }

            resultsContainer.innerHTML = '';

            // If BOTH databases fail to find it
            if (booksData.length === 0) {
                resultsContainer.innerHTML = `<div class="text-center text-red-400 mt-10">No books found for "${query}".</div>`;
                return;
            }

            // Render Results
            booksData.forEach(book => {
                const card = document.createElement('div');
                card.className = "flex gap-4 p-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-xl cursor-pointer transition-colors shadow-md";
                card.innerHTML = `
                    <img src="${book.thumbnail}" class="w-16 h-24 object-cover rounded shadow-sm flex-shrink-0 bg-slate-900" alt="Cover">
                    <div class="flex flex-col flex-1 overflow-hidden">
                        <h3 class="text-sm font-bold text-orange-400 truncate">${book.title}</h3>
                        <p class="text-xs text-slate-300 font-semibold truncate mb-1">By: ${book.authors}</p>
                        <p class="text-[10px] text-slate-400 leading-tight">${book.snippet}</p>
                    </div>
                `;


// When user clicks a book, set it as the active entity in Dhwani
                card.onclick = () => {
                    // Cache the exact book data from the search result
                    window.currentBookContext = book;
                    selectedLibraryItem = `Archive|${book.title}`; 
                    
                    if (UI.ddText) {
                        UI.ddText.innerText = `[Global] ${book.title}`;
                    }
                    globalModal.classList.add('hidden');
                    
                    // 1. CRITICAL: Clear old contaminated chat history so prior apologies do not repeat
                    chatHistory = [];
                    UI.log.innerHTML = '';
                    if (UI.welcome) UI.welcome.style.display = 'none';
                    
                    let authorText = (book.authors && book.authors !== "Unknown Author") ? ` by ${book.authors}` : "";
                    
                    // 2. Direct, constructive initial prompt
                    const initialQuery = `Please provide an overview of "${book.title}"${authorText} and outline its core chapters or syllabus so we can begin.`;
                    
                    processInput(initialQuery);
                };

                resultsContainer.appendChild(card);
            });

        } catch (error) {
            console.error("Search Error:", error);
            resultsContainer.innerHTML = `<div class="text-center text-red-500 mt-10">Network error fetching books.</div>`;
        }
    };

    btnSearch.addEventListener('click', executeSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });
});

// =====================================================================
// SUPABASE ZERO-TOKEN FAQ & LOGGING ENGINE
// =====================================================================
const SUPABASE_URL = "https://yoybrfalvzutrwyhpoxp.supabase.co/rest/v1/qa_knowledge_base";
const SUPABASE_ANON_KEY = "sb_publishable_07dbWoR3gAQ52BeIYAasUA_81Ga14Sw";

// 1. SILENT LOGGING (Fires after Gemini answers)
function logQAToSupabase(userQuery, botReply) {
    const isLibrary = document.title.includes("Library");
    let contextStr = "General";
    
    if (isLibrary) {
        contextStr = typeof selectedLibraryItem !== 'undefined' ? selectedLibraryItem : "General";
    } else {
        const med = document.getElementById('medium-selector')?.value || "Unknown";
        const std = document.getElementById('std-selector')?.value || "Unknown";
        const sub = document.getElementById('subject-selector')?.value || "Unknown";
        contextStr = `${med}_Std${std}_${sub}`;
    }

    const payload = {
        app_source: isLibrary ? "library" : "teacher",
        context: contextStr,
        question: userQuery.trim(),
        answer: botReply.trim()
    };

    fetch(SUPABASE_URL, {
        method: "POST",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        body: JSON.stringify(payload)
    }).catch(err => console.debug("Supabase log failed:", err));
}

// 2. LIVE FAQ SEARCH (Fires as user types)
let faqSearchTimeout = null;

async function searchFAQs(inputText) {
    if (inputText.trim().length < 4) {
        hideFAQSuggestions();
        return;
    }

    const isLibrary = document.title.includes("Library");
    let contextStr = isLibrary 
        ? (typeof selectedLibraryItem !== 'undefined' ? selectedLibraryItem : "General")
        : `${document.getElementById('medium-selector')?.value}_Std${document.getElementById('std-selector')?.value}_${document.getElementById('subject-selector')?.value}`;

    // Query Supabase for approved FAQs matching the context and the typed keywords
    const queryUrl = `${SUPABASE_URL}?select=question,answer&is_approved=eq.true&context=eq.${encodeURIComponent(contextStr)}&question=ilike.*${encodeURIComponent(inputText.trim())}*&limit=5`;

    try {
        const response = await fetch(queryUrl, {
            method: "GET",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (response.ok) {
            const matches = await response.json();
            renderFAQSuggestions(matches);
        }
    } catch (err) {
        console.debug("FAQ search failed:", err);
    }
}

// Hook into the chat input box
document.addEventListener("DOMContentLoaded", () => {
    const textInput = document.getElementById('text-input');
    if (textInput) {
        textInput.addEventListener('input', (e) => {
            clearTimeout(faqSearchTimeout);
            faqSearchTimeout = setTimeout(() => {
                searchFAQs(e.target.value);
            }, 400); // 400ms debounce saves bandwidth
        });
    }
});

// 3. RENDER FAQ UI (Zero Token Delivery)
function renderFAQSuggestions(matches) {
    let container = document.getElementById('faq-suggestions-box');
    const inputWrapper = document.getElementById('text-input').closest('.relative') || document.getElementById('text-input').parentNode;
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'faq-suggestions-box';
        // Floats right above the chat input box
        container.className = 'absolute bottom-full left-0 w-full bg-slate-900/95 border border-cyan-500/50 rounded-t-2xl p-2 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] z-[150] max-h-60 overflow-y-auto backdrop-blur-md mb-2';
        inputWrapper.appendChild(container);
    }

    if (matches.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <div class="text-[10px] text-cyan-400 font-bold uppercase tracking-wider px-2 py-1 border-b border-slate-700/50 mb-1 flex justify-between items-center">
            <span>💡 Instant Answers (0 Tokens)</span>
            <button class="text-slate-400 hover:text-red-400 text-lg leading-none outline-none" onclick="hideFAQSuggestions()">&times;</button>
        </div>
    `;

    matches.forEach(item => {
        const row = document.createElement('div');
        row.className = 'px-3 py-2.5 hover:bg-slate-800 rounded-lg cursor-pointer text-sm text-yellow-300 font-medium transition-colors border-b border-slate-800/40';
        row.innerText = item.question;
        
        row.onclick = () => {
            hideFAQSuggestions();
            const textInput = document.getElementById('text-input');
            textInput.value = ''; 
            
            const isLibrary = document.title.includes("Library");
            const userName = document.getElementById('manual-name')?.value || (isLibrary ? "Bhakt" : (document.getElementById('user-role')?.value || "Student"));
            const botName = isLibrary ? (typeof getSelectedItemName === 'function' ? getSelectedItemName() : "Dhwani") : "Teacher";

            // 1. Render User Question
            renderMessage(userName, item.question, false);
            
            // 2. Render Cached Answer Instantly
            const msgId = renderMessage(botName, item.answer, true);
            
            // 3. Play Audio
            if (typeof state !== 'undefined' && !state.isMuted) {
                const playBtn = document.getElementById(`play-btn-${msgId}`);
                if (playBtn) window.toggleSingleMessagePlay(playBtn);
            }
            
            // 4. Save to Local Session History
            if (typeof chatHistory !== 'undefined') {
                chatHistory.push({ role: 'user', parts: [{ text: item.question }] });
                chatHistory.push({ role: 'model', parts: [{ text: item.answer }] });
                if (typeof saveData === 'function') saveData();
                if (typeof updateEditPencil === 'function') updateEditPencil();
            }
        };
        container.appendChild(row);
    });
}

window.hideFAQSuggestions = function() {
    const container = document.getElementById('faq-suggestions-box');
    if (container) container.style.display = 'none';
};