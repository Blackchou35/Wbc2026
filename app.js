/**
 * 2026 WBC Cheer Rhythm - Expert Logic v2.1
 * - AudioContext Clock (No drift)
 * - Lookahead Scheduler
 * - Mobile Optimize Interactions
 */

class SwingApp {
    constructor() {
        this.score = 0;
        this.swingCount = 0;
        this.combo = 0;
        this.isGameStarted = false;
        this.isMusicLoaded = false;

        // Rhythm Logic (Expert Mode)
        this.beats = [];
        this.audioStartTime = 0;
        this.nextBeatIndex = 0;
        this.audioBuffer = null;
        this.audioSource = null;
        this.musicUrl = 'J3QJe2J8kB8.mp3';

        // Calibration
        this.globalOffset = 0.0;
        this.lookahead = 0.1;
        this.scheduleAheadTime = 0.2;
        this.visualDelay = 1.5; // Scroll Speed: Note must spawn 1.5s before hitting target

        // DOM Elements
        this.ui = {
            score: document.getElementById('max-accel'),
            swingCount: document.getElementById('swing-count'),
            combo: document.getElementById('combo-display'),
            judgment: document.getElementById('judgment-text'),
            startBtn: document.getElementById('start-btn'),
            statusMsg: document.getElementById('status-msg'),
            mainStat: document.querySelector('.main-stat'),
            gameArea: document.querySelector('.rhythm-game-area')
        };

        this.audioCtx = null;
        this.init();
    }

    init() {
        this.ui.startBtn.addEventListener('click', () => this.handleStart());

        // Input Handling: Expert Mobile Optimization
        // Use 'touchstart' for 0ms latency on iOS/Android
        const handleInput = (e) => {
            // Prevent default zooming/scrolling behavior on the game area
            if (e.type === 'touchstart') e.preventDefault();
            this.handleTap(e);
        };

        // Add listener to the specific game area
        // Note: In style.css we will expand this area to be easier to hit
        this.ui.gameArea.addEventListener('touchstart', handleInput, { passive: false });
        this.ui.gameArea.addEventListener('mousedown', handleInput);
    }

    async loadMusic() {
        this.ui.statusMsg.innerText = "音樂載入中...";
        try {
            const response = await fetch(this.musicUrl);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            this.analyzeBeats();
            this.isMusicLoaded = true;
            this.ui.statusMsg.innerText = "音樂準備就緒！";
            return true;
        } catch (error) {
            console.error(error);
            this.ui.statusMsg.innerText = "載入音樂失敗，請確認檔案在 GitHub 上。";
            return false;
        }
    }

    analyzeBeats() {
        const sampleRate = this.audioBuffer.sampleRate;
        const channelData = this.audioBuffer.getChannelData(0);
        this.beats = [];
        const frameSize = 1024;
        const energyBuffer = [];

        for (let i = 0; i < channelData.length; i += frameSize) {
            let sum = 0;
            for (let j = 0; j < frameSize && (i + j) < channelData.length; j++) {
                sum += channelData[i + j] * channelData[i + j];
            }
            energyBuffer.push(Math.sqrt(sum / frameSize));
        }

        const avgEnergy = energyBuffer.reduce((a, b) => a + b, 0) / energyBuffer.length;
        const threshold = avgEnergy * 1.5;

        for (let i = 1; i < energyBuffer.length - 1; i++) {
            if (energyBuffer[i] > threshold && energyBuffer[i] > energyBuffer[i - 1] && energyBuffer[i] > energyBuffer[i + 1]) {
                const timeSec = (i * frameSize / sampleRate);
                if (this.beats.length === 0 || (timeSec - this.beats[this.beats.length - 1] > 0.35)) {
                    this.beats.push(timeSec);
                }
            }
        }
    }

    async handleStart() {
        this.logDebug("初始化核心...");

        // 檢查使用者是否開啟了「藍牙/簡易模式」
        const isBtMode = document.getElementById('bt-mode-toggle').checked;
        if (isBtMode) {
            this.globalOffset = 0.20; // 補償藍牙延遲 (約 200ms)
            this.logDebug("模式: 藍牙/簡易 (Offset +0.2s)");
        } else {
            this.globalOffset = 0.0;
        }

        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.unlockIOSAudio();

        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        const success = await this.loadMusic();
        if (success) {
            this.startGame();
        }
    }

    unlockIOSAudio() {
        // Silent Audio Hack for iOS
        const silentAudio = new Audio("data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==");
        silentAudio.volume = 0.1;
        silentAudio.play().catch(e => console.log("Unlock info: " + e.message));
    }

    startGame() {
        if (this.isGameStarted) return;
        this.isGameStarted = true;
        this.ui.startBtn.style.display = 'none';

        this.audioSource = this.audioCtx.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.audioCtx.destination);

        // Audio Clock Start
        this.audioStartTime = this.audioCtx.currentTime + 0.1;
        this.audioSource.start(this.audioStartTime);

        this.scheduler();
    }

    scheduler() {
        // Lookahead timing logic
        while (this.nextBeatIndex < this.beats.length &&
            this.beats[this.nextBeatIndex] < this.audioCtx.currentTime - this.audioStartTime + this.scheduleAheadTime + this.visualDelay) {

            const beatTime = this.beats[this.nextBeatIndex];
            const visualTime = beatTime - this.visualDelay;
            this.scheduleVisual(visualTime);
            this.nextBeatIndex++;
        }

        if (this.isGameStarted) {
            setTimeout(() => this.scheduler(), this.lookahead * 1000);
        }
    }

    scheduleVisual(visualTime) {
        const timeUntilTrigger = (this.audioStartTime + visualTime) - this.audioCtx.currentTime;
        if (timeUntilTrigger > 0) {
            setTimeout(() => this.spawnNote(), timeUntilTrigger * 1000);
        } else {
            this.spawnNote();
        }
    }

    // spawnNote is now used instead of triggerRing
    spawnNote() {
        const note = document.createElement('div');
        note.classList.add('beat-note', 'note-anim');
        this.ui.gameArea.appendChild(note);
        setTimeout(() => note.remove(), 2000);
    }

    handleTap(e) {
        if (!this.isGameStarted) return;

        this.swingCount++;
        this.ui.swingCount.innerText = this.swingCount;

        // Current Audio Time for Judgment
        const currentTime = this.audioCtx.currentTime - this.audioStartTime;

        // Find closest beat
        if (this.beats.length === 0) return;

        let closestBeat = this.beats.reduce((prev, curr) => {
            return (Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev);
        });

        const diff = Math.abs(currentTime - closestBeat - this.globalOffset);
        this.judge(diff);
    }

    judge(diffSec) {
        // Dynamic Difficulty based on Mode
        const isBtMode = document.getElementById('bt-mode-toggle').checked;

        // Easy Mode (Bluetooth): Very relaxed windows
        const PERFECT = isBtMode ? 0.15 : 0.08; // 150ms vs 80ms
        const GOOD = isBtMode ? 0.30 : 0.15;    // 300ms vs 150ms

        let result = "";

        if (diffSec < PERFECT) {
            result = "PERFECT";
            this.combo++;
            this.score += 1000 * (1 + (this.combo * 0.1));
            this.ui.judgment.className = "judgment-text judgment-perfect";
            if (navigator.vibrate) navigator.vibrate([20]);

            this.triggerFlash();

        } else if (diffSec < GOOD) {
            result = "GOOD";
            this.combo++;
            this.score += 500;
            this.ui.judgment.className = "judgment-text judgment-good";
        } else {
            result = "MISS";
            this.combo = 0;
            this.ui.judgment.className = "judgment-text judgment-miss";
        }

        this.ui.judgment.innerText = result;
        this.ui.combo.innerText = `COMBO ${this.combo}`;
        this.ui.score.innerText = Math.floor(this.score);

        this.playHitSound(result === "PERFECT" ? 880 : 440);
    }

    triggerFlash() {
        const flash = document.createElement('div');
        flash.className = 'screen-flash';
        document.body.appendChild(flash);
        requestAnimationFrame(() => {
            flash.style.opacity = '0';
        });
        setTimeout(() => flash.remove(), 200);
    }

    playHitSound(freq) {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.1);
        osc.connect(gain).connect(this.audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    logDebug(msg) {
        const el = document.getElementById('debug-log');
        if (el) el.innerText = msg;
    }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new SwingApp(); });
