/**
 * 2026 WBC Cheer Rhythm - Tap Version
 * Loads J3QJe2J8kB8.mp3 automatically from the repo
 */

class SwingApp {
    constructor() {
        this.score = 0;
        this.swingCount = 0; // 現在代表點擊次數
        this.combo = 0;
        this.isGameStarted = false;
        this.isMusicLoaded = false;

        // Rhythm Logic
        this.beats = [];
        this.musicStartTime = 0;
        this.nextBeatIndex = 0;
        this.audioBuffer = null;
        this.audioSource = null;
        this.musicUrl = 'J3QJe2J8kB8.mp3';

        // DOM Elements
        this.ui = {
            score: document.getElementById('max-accel'),
            swingCount: document.getElementById('swing-count'),
            combo: document.getElementById('combo-display'),
            judgment: document.getElementById('judgment-text'),
            startBtn: document.getElementById('start-btn'),
            statusMsg: document.getElementById('status-msg'),
            mainStat: document.querySelector('.main-stat'),
            beatRing: document.getElementById('beat-ring'),
            gameArea: document.querySelector('.rhythm-game-area')
        };

        this.audioCtx = null;
        this.init();
    }

    init() {
        this.ui.startBtn.addEventListener('click', () => this.handleStart());
        // 監聽點擊與觸控
        this.ui.gameArea.addEventListener('mousedown', (e) => this.handleTap(e));
        this.ui.gameArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTap(e);
        });
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
        const threshold = avgEnergy * 1.6; // 稍微提高閾值以抓取更精確的重音拍

        for (let i = 1; i < energyBuffer.length - 1; i++) {
            if (energyBuffer[i] > threshold && energyBuffer[i] > energyBuffer[i - 1] && energyBuffer[i] > energyBuffer[i + 1]) {
                const timeMs = (i * frameSize / sampleRate) * 1000;
                if (this.beats.length === 0 || (timeMs - this.beats[this.beats.length - 1] > 320)) {
                    this.beats.push(timeMs);
                }
            }
        }
    }

    async handleStart() {
        this.logDebug("正在初始化音訊...");

        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        // iOS Hack: 嘗試播放一個空的 HTML5 Audio 以強制切換 Audio Session 模式
        // 這通常能繞過實體靜音開關 (Mute Switch)
        this.unlockIOSAudio();

        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        this.logDebug(`AudioContext: ${this.audioCtx.state}`);

        // 播放測試音效 (Beep) 確認聲音路徑
        this.playTestTone();

        const success = await this.loadMusic();
        if (success) {
            this.startGame();
        }
    }

    unlockIOSAudio() {
        // 建立一個極短的靜音音檔 (base64 of a simple wav)
        const silentAudio = new Audio("data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==");
        silentAudio.volume = 0.1;
        silentAudio.play().then(() => {
            this.logDebug("iOS Audio Session Unlocked");
        }).catch(e => {
            this.logDebug("iOS Unlock Failed: " + e.message);
        });
    }

    playTestTone() {
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.frequency.value = 600;
            gain.gain.value = 0.1;
            osc.connect(gain).connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);
            this.logDebug("測試音效已發送");
        } catch (e) {
            this.logDebug("測試音效失敗: " + e.message);
        }
    }

    logDebug(msg) {
        console.log(msg);
        const el = document.getElementById('debug-log');
        if (el) el.innerText = msg;
    }

    startGame() {
        if (this.isGameStarted) return;
        this.isGameStarted = true;
        this.ui.startBtn.style.display = 'none';

        // 播放音樂
        this.audioSource = this.audioCtx.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.audioCtx.destination);

        this.musicStartTime = performance.now();
        this.audioSource.start(0);

        this.gameLoop();
    }

    gameLoop() {
        if (!this.isGameStarted) return;
        const elpased = performance.now() - this.musicStartTime;

        if (this.nextBeatIndex < this.beats.length) {
            const nextBeat = this.beats[this.nextBeatIndex];
            if (elpased > nextBeat - 1000) {
                this.triggerRing();
                this.nextBeatIndex++;
            }
        }
        requestAnimationFrame(() => this.gameLoop());
    }

    triggerRing() {
        this.ui.beatRing.classList.remove('ring-anim');
        void this.ui.beatRing.offsetWidth;
        this.ui.beatRing.classList.add('ring-anim');
    }

    handleTap(e) {
        if (!this.isGameStarted) return;

        this.swingCount++;
        this.ui.swingCount.innerText = this.swingCount;

        const tapTime = performance.now() - this.musicStartTime;

        let closestBeat = this.beats.reduce((prev, curr) => {
            return (Math.abs(curr - tapTime) < Math.abs(prev - tapTime) ? curr : prev);
        });

        const diff = Math.abs(tapTime - closestBeat);
        this.judge(diff);
    }

    judge(diff) {
        let result = "";

        // 點擊模式因為不需要物理揮動時間，縮小判定區間增加挑戰性
        if (diff < 150) {
            result = "PERFECT";
            this.combo++;
            this.score += 1000 * (1 + (this.combo * 0.1));
            this.ui.judgment.className = "judgment-text judgment-perfect";
            if (navigator.vibrate) navigator.vibrate([20]);
        } else if (diff < 350) {
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

        // 視覺特效
        this.ui.mainStat.classList.add('hit-effect');
        setTimeout(() => this.ui.mainStat.classList.remove('hit-effect'), 100);

        this.playHitSound(result === "PERFECT" ? 880 : 440);
    }

    playHitSound(freq) {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
        osc.connect(gain).connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
    }
}

window.addEventListener('DOMContentLoaded', () => { window.app = new SwingApp(); });
