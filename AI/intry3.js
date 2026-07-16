// --- GLOBAL SYSTEM STATE & VARIABLES (Safely initialized first) ---
let UI = {};
let chatHistory = [];
let recognition = null;
let isListening = false; 
let isManuallyPaused = false;
let selectedLibraryItem = "Bhagavad Gita|Bhagavad Gita";
let state = { isProcessing: false, isMuted: false, lastAIMessage: "", sessionActive: false };

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
        fileImport: document.getElementById('file-import-input')
    };

	if (UI.overlay) {
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

document.addEventListener('click', enforceFullScreen, { capture: true });
document.addEventListener('touchstart', enforceFullScreen, { capture: true, passive: true });

// --- 2. THE ANCIENT LIBRARY CONFIGURATION ---
const PROXY_URL = "https://eprashala-proxy-511804777001.asia-south1.run.app/api/chat";

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
}

function getSelectedConfig() {
    const [group, item] = selectedLibraryItem.split('|');
    return LIBRARY_CONFIG[group][item];
}

function getSelectedItemName() {
    return selectedLibraryItem.split('|')[1];
}

function getModelInfo(val) {
    val = parseInt(val);
    if(val === 20) return { name: "Flash-Lite", id: "gemini-3.1-flash-lite" };
    if(val === 40) return { name: "Flash", id: "gemini-2.5-flash" };
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
            UI.highlightCheckbox.checked = savedHighlight !== 'false'; 
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

	UI.btnMic.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.isProcessing) return;
        
        if (!recognition) {
            alert("⚠️ Speech Recognition is not supported by this browser.");
            return;
        }

        if (isListening) { recognition.stop(); } 
        else { recognition.lang = UI.lang.value; try { recognition.start(); } catch(err) {} }
    });
}

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
        console.error("Mic Error:", e.error);
        isListening = false; 
        resetMicUI(); 
        setTimeout(updateStopButtonVisibility, 50); 
        
        if (e.error === 'no-speech') {
            return; 
        } else if (e.error === 'network') {
            alert("⚠️ Network Error: Android's Google App cannot reach the speech servers.");
        } else if (e.error === 'not-allowed' || e.error === 'audio-capture') {
            alert("⚠️ Mic Blocked: Please ensure BOTH Google Chrome and the 'Google' app have microphone permissions in phone settings.");
        } else {
            alert("⚠️ Speech Engine Error: " + e.error);
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
        const greetingText = getDhwaniGreeting(UI.lang.value, config.persona, config.texts);
        
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
        const rawRes = await getAIResponse(chatHistory, config);
        
        state.lastAIMessage = rawRes;
        chatHistory.push({ role: 'model', parts: [{ text: rawRes }] });
        
        if (isFirstMessage && introMsgId) {
            // Appends to the existing greeting bubble
            appendToExistingMessage(introMsgId, rawRes);
        } else {
            // Renders standard separate bubble for all subsequent messages
            const newMsgId = renderMessage("Dhwani", rawRes, true); 
            if (!state.isMuted && ttsStatus !== 'PLAYING') {
                const btn = document.getElementById(`play-btn-${newMsgId}`);
                if (btn) window.toggleSingleMessagePlay(btn);
            }
        }
        
        saveData();
        updateEditPencil();
        
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

async function getAIResponse(history, config) {
    const customKey = (UI.keyIn.value.length > 10) ? UI.keyIn.value : null;
    const headers = { 'Content-Type': 'application/json' };

    let contextAddon = "";
    if (UI.age.value) contextAddon = ` The user is ${UI.age.value} years old. Adjust the complexity of your explanation accordingly.`;
    if (UI.name.value) contextAddon += ` Address them compassionately as ${UI.name.value}.`;

    const bookRatio = UI.ratioSlider.value;
    const aiRatio = 100 - bookRatio;
    const selectedModelInfo = getModelInfo(UI.modelSlider.value);

	   
	       
 const prompt = `You are Dhwani, an AI female interpreter and guide to ancient Indian texts. You are NOT the author and you are NOT a god. You are interpreting the text: "${config.texts}" which is associated with ${config.persona}.
    
    CRITICAL AND UNBREAKABLE RULES FOR YOUR RESPONSE:
    1. PERSONA: Your name is Dhwani. Address the user respectfully and affectionately using gender-neutral terms like "Vatsa" (child/seeker) or "Bhakta" (devotee). Do NOT pretend to be ${config.persona}. Act strictly as a humble interpreter sharing their wisdom. IMPORTANT: Do NOT begin your response with a greeting (e.g., Namaste, Pranam, Hello) as the user has already been greeted. Dive straight into the wisdom.
    2. EXCLUSIVE SOURCE MATERIAL: You MUST derive your entire answer, philosophy, and worldview EXCLUSIVELY from "${config.texts}". Do NOT mix in concepts, verses, or ideas from other texts.
    3. EXACT VERSE/QUOTE: You MUST select a real, highly relevant verse, sutra, shloka, or phrase from "${config.texts}" that directly addresses the user's query. If you cannot recall the exact verbatim words, paraphrase the concept accurately rather than fabricating a fake verse.
    4. THE REFERENCE (ANTI-HALLUCINATION GUARDRAIL): State the exact structural reference (e.g., Book, Chapter, Canto, Verse) ONLY if you are 100% certain. If there is even a slight ambiguity across different historical recensions/editions, DO NOT guess or invent numbers. Instead, omit the digits and use a phrase like: "In a celebrated section of the ${config.texts}..." or describe its conceptual placement. Never invent chapter/verse numbers.
    5. THE RECITATION: Recite the original verse accurately in the requested language.
    6. THE EXPLANATION: Explain the profound meaning of this specific verse strictly within the context of "${config.texts}" as an interpreter. Apply it directly to the user's question to provide actionable guidance.
    7. LANGUAGE: Speak strictly in the language code: ${UI.lang.value}.
    8. FORMATTING: Use rich Markdown formatting (bolding, headers, lists) to make the text beautiful and structured for the user to read.
    9. TONE & RATIO: Maintain an objective, knowledgeable, yet compassionate tone. Your answer must be exactly ${bookRatio}% strict traditional quotation/interpretation of "${config.texts}" and ${aiRatio}% compassionate contextualization for the modern user. ${contextAddon}
    10. MEDIA LINKS: At the very end of your response, provide EXACTLY two lines formatted like this for further exploration (translate the descriptive text to ${UI.lang.value}):
       YT_SEARCH: relevant_topic_keywords
       IMG_SEARCH: relevant_topic_keywords`;
    
   // Core payload format (without the model ID, which is handled in the URL for direct calls)
    const payload = { 
        contents: history.slice(-10), 
        systemInstruction: { parts: [{ text: prompt }] } 
    };

    let fetchUrl;

    // --- NEW ROUTING LOGIC ---
    if (customKey) {
        // Direct to Google AI Studio endpoint
        fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelInfo.id}:generateContent?key=${customKey}`;
    } else {
        // Route through your Cloud Run proxy
        fetchUrl = PROXY_URL;
        // The proxy likely expects the model name in the body payload
        payload.model = selectedModelInfo.id;
    }

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
        // Re-throw to allow processInput() to handle the UI reset
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
        if (textSpan) textSpan.innerText = "Play"; // Reset text
        
        // Snap the button back to its original place
        currentActiveBtn.classList.remove('is-floating');
        currentActiveBtn = null;
    }
    
    // Fallback cleanup: remove floating state from ALL play buttons
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
        highlightTimer = null;
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
            isManuallyPaused = false; // Reset the flag
            updatePlayBtnUI(btnElem, true);
            updateStopButtonVisibility(); 
            
            if (activeEngine === 'cloud') {
                if (currentAudio && currentAudio.src) currentAudio.play();
                startHighlightTimer(msgId);
            } else {
                // ANDROID NATIVE RESUME: Wait 50ms for engine to clear, then resume remaining text
                window.speechSynthesis.cancel();
                setTimeout(() => {
                    const remainingText = wordsArray.slice(globalWordIndex).join(" ");
                    if (remainingText.trim()) {
                        playNativeAudioSegment(remainingText, msgId, UI.lang ? UI.lang.value : 'hi-IN');
                    } else {
                        resetCurrentTTS();
                    }
                }, 50);
            }
            return;
        } else if (ttsStatus === 'PLAYING') {
            ttsStatus = 'PAUSED';
            isManuallyPaused = true; // Set the flag so onend/onerror ignores this!
            updatePlayBtnUI(btnElem, false);
            
            if (activeEngine === 'cloud') {
                if (currentAudio) currentAudio.pause();
            } else {
                window.speechSynthesis.cancel(); // Stop Android instantly
            }
            if (highlightTimer) clearTimeout(highlightTimer);
            return;
        }
    }

    resetCurrentTTS();
    currentActiveBtn = btnElem;
    window.currentPlayingText = plainText;
    ttsStatus = 'PLAYING';
    isManuallyPaused = false; // Ensure flag is clean on new playback
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

