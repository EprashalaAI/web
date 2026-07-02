// --- 1. Security & UI Lockdown ---
document.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') e.preventDefault();
    if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'c' || e.key === 'C')) e.preventDefault();
});

// --- 2. Application Logic & Config ---
const langMap = { "English": "en-IN", "Hindi": "hi-IN", "Bengali": "bn-IN", "Telugu": "te-IN", "Marathi": "mr-IN", "Tamil": "ta-IN", "Gujarati": "gu-IN" };
const PROXY_SERVER_URL = "https://eprashala.pythonanywhere.com/api/chat";

// State Variables
let base64Audio = '';
let mimeType = '';
let audioDuration = 0;
let markIn = null;
let markOut = null;
let clippings = [];
let currentSynthUtterance = null;
let rawReportText = "";

// DOM Elements
const audioInput = document.getElementById('audioInput');
const audioPlayer = document.getElementById('audioPlayer');
const visualizerBox = document.getElementById('visualizerBox');
const markerInEl = document.getElementById('markerIn');
const markerOutEl = document.getElementById('markerOut');
const highlightRegion = document.getElementById('highlightRegion');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
const analyzeBtn = document.getElementById('analyzeBtn');
const audioBtn = document.getElementById('audioBtn');
const sharePdfBtn = document.getElementById('sharePdfBtn');

// --- Initialize Settings Modal ---
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('user_api_key')) {
        document.getElementById('apiKeyInput').value = localStorage.getItem('user_api_key');
    }
    
    document.getElementById('pasteBtn').addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('apiKeyInput').value = text;
        } catch (err) { alert("Clipboard permission denied. Paste manually."); }
    });
});

function toggleModal(show) { document.getElementById('settingsModal').classList.toggle('active', show); }
function saveSettings() {
    const key = document.getElementById('apiKeyInput').value.trim();
    localStorage.setItem('user_api_key', key);
    toggleModal(false);
}

audioInput.addEventListener('change', handleAudioUpload);

function formatTime(seconds) {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    mimeType = file.type;
    
    // MIME TYPE SANITIZATION
    if (mimeType.startsWith('video/')) {
        mimeType = mimeType.replace('video/', 'audio/');
    } else if (!mimeType) {
        mimeType = 'audio/mp3'; 
    }

    const url = URL.createObjectURL(file);
    audioPlayer.src = url;
    
    drawWaveform();

    audioPlayer.onloadedmetadata = () => { 
        audioDuration = audioPlayer.duration; 
        
        markIn = 0;
        markOut = audioDuration;
        
        document.getElementById('markInDisplay').innerText = formatTime(markIn);
        document.getElementById('markOutDisplay').innerText = formatTime(markOut);
        
        markerInEl.style.left = '0%';
        markerOutEl.style.left = '100%';
        markerInEl.style.display = 'block';
        markerOutEl.style.display = 'block';
        updateHighlight();
        
        analyzeBtn.disabled = false;
    };

    const reader = new FileReader();
    reader.onloadend = () => {
        base64Audio = reader.result.split(',')[1]; 
        document.getElementById('setupSection').style.display = 'none';
        document.getElementById('workspace').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

// --- Fenced Playback Restraints ---
audioPlayer.addEventListener('play', () => {
    if (markIn !== null && audioPlayer.currentTime < markIn) audioPlayer.currentTime = markIn;
    if (markOut !== null && audioPlayer.currentTime >= markOut) audioPlayer.currentTime = markIn;
});
audioPlayer.addEventListener('timeupdate', () => {
    if (markOut !== null && audioPlayer.currentTime >= markOut) {
        audioPlayer.pause();
        audioPlayer.currentTime = markIn; 
    }
});
audioPlayer.addEventListener('seeked', () => {
    if (markIn !== null && audioPlayer.currentTime < markIn) {
        audioPlayer.currentTime = markIn;
    } else if (markOut !== null && audioPlayer.currentTime > markOut) {
        audioPlayer.currentTime = markIn;
        audioPlayer.pause();
    }
});

// --- Visualizer Logic ---
function drawWaveform() {
    canvas.width = visualizerBox.clientWidth;
    canvas.height = visualizerBox.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#374151';
    
    for(let i = 0; i < canvas.width; i += 4) {
        let height = Math.random() * (canvas.height - 10) + 10;
        ctx.fillRect(i, (canvas.height - height) / 2, 2, height);
    }
}

function setMark(type) {
    if (!audioDuration) return;
    const time = audioPlayer.currentTime;
    const positionPercent = (time / audioDuration) * 100;

    if (type === 'in') {
        markIn = time;
        document.getElementById('markInDisplay').innerText = formatTime(markIn);
        markerInEl.style.left = `${positionPercent}%`;
        markerInEl.style.display = 'block';
    } else {
        markOut = time;
        document.getElementById('markOutDisplay').innerText = formatTime(markOut);
        markerOutEl.style.left = `${positionPercent}%`;
        markerOutEl.style.display = 'block';
    }
    updateHighlight();
}

function updateHighlight() {
    if (markIn !== null && markOut !== null && markOut > markIn) {
        const startPct = (markIn / audioDuration) * 100;
        const widthPct = ((markOut - markIn) / audioDuration) * 100;
        highlightRegion.style.left = `${startPct}%`;
        highlightRegion.style.width = `${widthPct}%`;
        highlightRegion.style.display = 'block';
    } else {
        highlightRegion.style.display = 'none';
    }
}

function addClipping() {
    if (markIn === null || markOut === null || markIn >= markOut) {
        alert("Invalid region. Ensure Mark Out is after Mark In.");
        return;
    }
    clippings.push({ in: markIn, out: markOut });
    updateClipList();
    
    markIn = null; markOut = null;
    markerInEl.style.display = 'none'; markerOutEl.style.display = 'none'; highlightRegion.style.display = 'none';
    document.getElementById('markInDisplay').innerText = "--:--";
    document.getElementById('markOutDisplay').innerText = "--:--";
    analyzeBtn.disabled = false;
}

function updateClipList() {
    const list = document.getElementById('clipList');
    list.innerHTML = '';
    clippings.forEach((clip, index) => {
        const li = document.createElement('li');
        li.className = 'clip-item';
        li.innerHTML = `<span>Clip [${formatTime(clip.in)} to ${formatTime(clip.out)}]</span> <span style="color:#ff4c4c;cursor:pointer;font-weight:bold;" onclick="removeClip(${index})">✕</span>`;
        list.appendChild(li);
    });
    if (clippings.length === 0) analyzeBtn.disabled = true;
}

function removeClip(index) {
    clippings.splice(index, 1);
    updateClipList();
}

analyzeBtn.addEventListener('click', async () => {
    const activeKey = localStorage.getItem('user_api_key') || ""; 

    analyzeBtn.style.display = 'none';
    document.getElementById('loader').style.display = 'block';
    document.getElementById('statusText').style.display = 'block';
    
    // UI Feedback: Show whether using Personal Key or Server Fallback
    document.getElementById('statusText').innerText = activeKey 
        ? `Connecting directly to Gemini AI...` 
        : `Connecting via Eprashala Proxy Server...`;    
        
    audioBtn.style.display = 'none';
    sharePdfBtn.style.display = 'none';

    const context = document.getElementById('analysisContext').value;
    const targetLang = document.getElementById('userLang').value;
 
    let timecodes = "";
    if (clippings.length > 0) {
        timecodes = clippings.map(c => `[${formatTime(c.in)} to ${formatTime(c.out)}]`).join(", ");
    } else {
        timecodes = `[${formatTime(markIn)} to ${formatTime(markOut)}]`;
    }

    const systemPrompt = `You are a Tier-1 Voice Stress Analyst (VSA), an expert in Linguistic Forensics, and a specialist in Deception Detection. You act as a brutal, unforgiving forensic truth-extraction tool.
    
    Context of Audio Evidence: ${context}
    Target Time Segments to Analyze: ${timecodes}
    
    CRITICAL INSTRUCTION 1: Your primary objective is to detect deception, fabricated narratives, and hidden psychological states. 
    
    CRITICAL INSTRUCTION 2 - MULTI-SPEAKER DIARIZATION: You MUST identify EVERY distinct speaker in the audio. If there are 2, 3, or more speakers, you MUST duplicate the entire "speaker-section" HTML block for EACH distinct speaker. DO NOT combine them into one block.
    
    You must format any identified speaker's name EXACTLY like this: 
    <span class="editable-speaker" data-speaker-id="speaker_1" contenteditable="true">Speaker 1</span> (increment ID for Speaker 2, Speaker 3, etc.)

    Structure your report in cleanly formatted HTML:

    <h3>1. Interrogation & Power Dynamics</h3>
    <p>Analyze the psychological baseline of the interaction. Who holds the authority? Is someone acting evasive or defensive?</p>

    <div class="speaker-section">
        <h2 class="speaker-header"><span class="editable-speaker" data-speaker-id="speaker_X" contenteditable="true">Speaker X</span></h2>
        
        <h3>A. Voice Stress & Deception Matrix (VSA)</h3>
        <ul>
            <li><strong>Cognitive Load Indicators:</strong> unnatural pauses or hesitation markers indicating they are calculating a lie?</li>
            <li><strong>Vocal Micro-Tremors (F0 Shifts):</strong> pitch spikes or autonomic fear responses?</li>
            <li><strong>Linguistic Distancing:</strong> avoiding direct ownership of statements?</li>
            <li><strong>Swara Diagnosis:</strong> irregular breathing patterns?</li>
        </ul>

        <h3>B. The Quantitative Truth Index</h3>
        <p>Provide an exact percentage score (0-100%) for these exact psychological states based purely on acoustic biometrics for <span class="editable-speaker" data-speaker-id="speaker_X" contenteditable="true">Speaker X</span>:</p>
        <ul>
            <li><strong>Probability of Deception (Lying):</strong> %</li>
            <li><strong>Hidden Stress / Autonomic Arousal:</strong> %</li>
            <li><strong>Fear of Detection:</strong> %</li>
            <li><strong>Anger / Defensive Aggression:</strong> %</li>
            <li><strong>Fabrication (Cognitive Overload):</strong> %</li>
            <li><strong>Authentic Truthfulness:</strong> %</li>
        </ul>
    </div>
    Write your ENTIRE response exclusively in the ${targetLang} language. Deliver the response using cleanly structured HTML. Do NOT wrap your output in markdown backticks.`;

    try {
        let endpoint = "";
        let fetchOptions = {};

        // Prepare Gemini Payload
        const apiPayload = {
            contents: [{
                parts: [
                    { text: systemPrompt + "\n\nAnalyze this audio evidence based strictly on the system instructions." },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Audio
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.2
            }
        };

        if (activeKey) {
            // Direct Gemini API Call
            endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`;
            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload)
            };
        } else {
            // Proxy Call
            endpoint = PROXY_SERVER_URL;
            fetchOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...apiPayload,
                    proxy_auth: "eprashala_request" 
                })
            };
        }

        const response = await fetch(endpoint, fetchOptions);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || data.error || "Server/API Error occurred.");
        }
        
        let extractedHTML = "";

        // Standardize response parsing (handles native Gemini format or proxy passthrough)
        if (data.candidates && data.candidates[0].content) {
            extractedHTML = data.candidates[0].content.parts[0].text;
        } else if (data.text || data.reply || data.choices) {
            // Fallback for custom proxy text returns
            extractedHTML = data.text || data.reply || data.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
            throw new Error("Unrecognized response format from AI Server.");
        }

        // FINAL DOM INJECTION
        extractedHTML = extractedHTML.replace(/```html/g, '').replace(/```/g, '').trim();
        rawReportText = extractedHTML;
        document.getElementById('reportTarget').innerHTML = extractedHTML;
        document.getElementById('reportSection').style.display = 'block';
        
        audioBtn.style.display = 'block';
        audioBtn.innerHTML = "🔊 Listen";
        sharePdfBtn.style.display = 'block';

    } catch (err) {
        alert("Forensic Extraction Failed.\n\nError: " + err.message);
        analyzeBtn.style.display = 'block';
    } finally {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('statusText').style.display = 'none';
    }
});

// --- Speech Synthesis ---
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
    
    const cleanText = document.getElementById('reportTarget').innerText; 
    
    currentSynthUtterance = new SpeechSynthesisUtterance(cleanText);
    currentSynthUtterance.lang = langMap[targetLang] || 'en-IN';
    
    currentSynthUtterance.onend = () => { audioBtn.innerHTML = "🔊 Listen"; };
    currentSynthUtterance.onerror = () => { audioBtn.innerHTML = "🔊 Listen"; };
    synth.speak(currentSynthUtterance);
}

// --- Live Synchronized Speaker Editing ---
document.getElementById('reportTarget').addEventListener('input', function(e) {
    if (e.target.classList.contains('editable-speaker')) {
        const speakerId = e.target.getAttribute('data-speaker-id');
        const newName = e.target.innerText;
        
        const identicalSpeakers = document.querySelectorAll(`.editable-speaker[data-speaker-id="${speakerId}"]`);
        
        identicalSpeakers.forEach(el => {
            if (el !== e.target && el.innerText !== newName) {
                el.innerText = newName;
            }
        });
    }
});
audioBtn.addEventListener('click', toggleSpeech);

sharePdfBtn.addEventListener('click', () => { window.print(); });