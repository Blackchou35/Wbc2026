/**
 * 2026 WBC Swing Sensor - Core Logic
 */

class SwingApp {
    constructor() {
        this.currentAccel = 0;
        this.maxAccel = 0;
        this.swingCount = 0;
        this.isMonitoring = false;
        this.threshold = 25.0; // m/s²
        this.coolDown = false; // 防止連續觸發

        // DOM Elements
        this.ui = {
            currentAccel: document.getElementById('current-accel'),
            maxAccel: document.getElementById('max-accel'),
            swingCount: document.getElementById('swing-count'),
            startBtn: document.getElementById('start-btn'),
            statusMsg: document.getElementById('status-msg'),
            accelBar: document.querySelector('.bar-fill'),
            mainStat: document.querySelector('.main-stat')
        };

        // Audio setup (using direct synthesis for "bat hit" to ensure it works offline/fast)
        this.audioCtx = null;

        this.initEventListeners();
    }

    initEventListeners() {
        this.ui.startBtn.addEventListener('click', () => this.handleStart());
    }

    async handleStart() {
        // Initialize Audio Context on user gesture
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        // 關鍵：在使用者點擊時明確 Resume AudioContext
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        // 先播放一個靜音音效預熱 (iOS 必要動作)
        this.playSilentBuffer();

        try {
            // Check for iOS Permission requirement
            if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.startMonitoring();
                } else {
                    this.ui.statusMsg.innerText = "權限未核准。請重新整理網頁並點擊允許。";
                    this.ui.statusMsg.style.color = '#ff4d4d';
                }
            } else if (window.DeviceMotionEvent) {
                // Android or non-iOS
                this.startMonitoring();
            } else {
                this.ui.statusMsg.innerText = "您的瀏覽器不支援加速度感測器。";
            }
        } catch (error) {
            console.error(error);
            this.ui.statusMsg.innerText = "初始化失敗：" + error.message;
        }
    }

    playSilentBuffer() {
        if (!this.audioCtx) return;
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const node = this.audioCtx.createBufferSource();
        node.buffer = buffer;
        node.connect(this.audioCtx.destination);
        node.start(0);
    }

    startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.ui.startBtn.style.display = 'none';
        this.ui.statusMsg.innerText = "正在監測感測器... 請嘗試揮棒！";

        window.addEventListener('devicemotion', (event) => {
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            // 計算向量總和: sqrt(x^2 + y^2 + z^2)
            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = acc.z || 0;
            const magnitude = Math.sqrt(x * x + y * y + z * z);

            this.updateUI(magnitude);
            this.checkSwing(magnitude);
        });
    }

    updateUI(magnitude) {
        this.currentAccel = magnitude.toFixed(1);
        this.ui.currentAccel.innerText = this.currentAccel;

        // Update bar (max visual 50 m/s2)
        const percentage = Math.min((magnitude / 50) * 100, 100);
        this.ui.accelBar.style.width = percentage + '%';

        if (magnitude > this.maxAccel) {
            this.maxAccel = magnitude;
            this.ui.maxAccel.innerText = magnitude.toFixed(1);
        }
    }

    checkSwing(magnitude) {
        if (magnitude > this.threshold && !this.coolDown) {
            this.triggerHit();
        }
    }

    triggerHit() {
        this.coolDown = true;
        this.swingCount++;
        this.ui.swingCount.innerText = this.swingCount;

        // 1. Vibrate (Note: iOS Safari 不支援此 Web API)
        if (navigator.vibrate) {
            navigator.vibrate([150]);
        }

        // 2. Play Sound (Synthesized "Crack of the bat")
        this.playHitSound();

        // 3. Visual Feedback (強烈閃爍)
        document.body.style.backgroundColor = 'var(--wbc-neon-yellow)';
        this.ui.mainStat.classList.add('hit-effect');

        setTimeout(() => {
            document.body.style.backgroundColor = 'var(--wbc-dark)';
            this.ui.mainStat.classList.remove('hit-effect');
        }, 200);

        this.ui.statusMsg.innerText = "擊出！力道：" + this.currentAccel;

        // Cool down for 0.8 second
        setTimeout(() => {
            this.coolDown = false;
        }, 800);
    }

    playHitSound() {
        if (!this.audioCtx) return;

        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.type = 'sine'; // 更清脆的聲音
        oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.2);

        gainNode.gain.setValueAtTime(0.8, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);

        const noiseBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.1, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.6, this.audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);

        oscillator.connect(gainNode);
        noiseSource.connect(noiseGain);

        gainNode.connect(this.audioCtx.destination);
        noiseGain.connect(this.audioCtx.destination);

        oscillator.start();
        noiseSource.start();
        oscillator.stop(this.audioCtx.currentTime + 0.4);
        noiseSource.stop(this.audioCtx.currentTime + 0.1);
    }
}

// Start the app
window.addEventListener('DOMContentLoaded', () => {
    window.app = new SwingApp();
});
