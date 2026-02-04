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

        try {
            // Check for iOS Permission requirement
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.startMonitoring();
                } else {
                    this.ui.statusMsg.innerText = "權限被拒絕，無法讀取感測器。";
                }
            } else {
                // Android or Desktop (already HTTPS)
                this.startMonitoring();
            }
        } catch (error) {
            this.ui.statusMsg.innerText = "授權失敗：" + error.message;
        }
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
        
        // 1. Vibrate
        if (navigator.vibrate) {
            navigator.vibrate([100]);
        }

        // 2. Play Sound (Synthesized "Crack of the bat")
        this.playHitSound();

        // 3. Visual Feedback
        this.ui.mainStat.classList.add('hit-effect');
        setTimeout(() => {
            this.ui.mainStat.classList.remove('hit-effect');
        }, 300);

        // Cool down for 1 second to avoid multi-trigger in one swing
        setTimeout(() => {
            this.coolDown = false;
        }, 1000);
    }

    playHitSound() {
        if (!this.audioCtx) return;

        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(300, this.audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(1, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);

        // Add some noise for "crack" effect
        const noiseBuffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate * 0.1, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);

        oscillator.connect(gainNode);
        noiseSource.connect(noiseGain);
        
        gainNode.connect(this.audioCtx.destination);
        noiseGain.connect(this.audioCtx.destination);

        oscillator.start();
        noiseSource.start();
        oscillator.stop(this.audioCtx.currentTime + 0.3);
        noiseSource.stop(this.audioCtx.currentTime + 0.1);
    }
}

// Start the app
window.addEventListener('DOMContentLoaded', () => {
    window.app = new SwingApp();
});
