#!/usr/bin/env node

import { prompt } from './node_modules/glimpseui/src/glimpse.mjs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    message: { type: 'string', default: 'Confirm this action?' },
    mode:    { type: 'string', default: 'confirm' },  // confirm | select
    options: { type: 'string', default: '' },          // comma-separated options for select mode
    timeout: { type: 'string', default: '30000' },
  },
});

const confirmMessage = values.message;
const mode = values.mode;
const selectOptions = values.options ? values.options.split(',').map(s => s.trim()).slice(0, 5) : [];
const timeoutMs = parseInt(values.timeout, 10);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Build options list HTML for select mode
const optionsHtml = selectOptions.map((opt, i) =>
  `<div class="option" id="opt${i+1}"><span class="option-num">${i+1}</span> ${escapeHtml(opt)}</div>`
).join('');

const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #1a1a2e; color: #fff; overflow: hidden;
  }
  .header {
    padding: 12px 16px;
    background: rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    font-size: 14px; color: #ccc;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .camera-container {
    position: relative; width: 100%; height: 320px;
  }
  video {
    width: 100%; height: 100%; object-fit: cover;
    transform: scaleX(-1);
  }
  canvas {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    transform: scaleX(-1);
  }
  .status-bar {
    padding: 10px 16px; display: flex;
    justify-content: space-between; align-items: center;
    background: rgba(255,255,255,0.05);
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .gesture-label { font-size: 18px; font-weight: 600; }
  .progress-ring { width: 36px; height: 36px; }
  .progress-ring circle {
    fill: none; stroke-width: 3; stroke-linecap: round;
    transform: rotate(-90deg); transform-origin: 50% 50%;
  }
  .progress-bg { stroke: rgba(255,255,255,0.1); }
  .progress-fg {
    stroke: #4ade80; stroke-dasharray: 94.25; stroke-dashoffset: 94.25;
    transition: stroke-dashoffset 0.1s;
  }
  .progress-fg.deny { stroke: #f87171; }
  .progress-fg.select { stroke: #60a5fa; }
  .hint { font-size: 12px; color: #888; }
  .buttons { display: flex; gap: 8px; padding: 8px 16px; }
  .buttons button {
    flex: 1; padding: 8px; border: none; border-radius: 6px;
    font-size: 13px; cursor: pointer;
  }
  .btn-deny { background: #dc2626; color: white; }
  .btn-allow { background: #16a34a; color: white; }
  .btn-select { background: #2563eb; color: white; font-size: 12px; }
  .btn-select.active { background: #60a5fa; }
  .no-camera {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%; color: #888; font-size: 14px;
    flex-direction: column; gap: 8px;
  }
  .options-panel {
    padding: 8px 16px;
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .option {
    padding: 6px 12px; margin: 4px 0; border-radius: 6px;
    font-size: 13px; color: #ccc;
    background: rgba(255,255,255,0.05);
    transition: background 0.15s, color 0.15s;
  }
  .option.active {
    background: rgba(96,165,250,0.3); color: #fff;
  }
  .option-num {
    display: inline-block; width: 22px; height: 22px;
    line-height: 22px; text-align: center; border-radius: 50%;
    background: rgba(255,255,255,0.1); font-size: 12px; font-weight: 600;
    margin-right: 8px;
  }
  .option.active .option-num {
    background: #60a5fa; color: #fff;
  }
</style>
</head>
<body>
  <div class="header">${escapeHtml(confirmMessage)}</div>
  <div class="camera-container">
    <video id="video" autoplay playsinline></video>
    <canvas id="canvas"></canvas>
    <div id="noCam" class="no-camera" style="display:none;">
      <div>Camera unavailable</div>
      <div style="font-size:12px;">Use buttons below</div>
    </div>
  </div>
  <div class="status-bar">
    <div>
      <div class="gesture-label" id="gestureLabel">Waiting...</div>
      <div class="hint" id="hintText">${mode === 'select' ? 'Show 1-' + selectOptions.length + ' fingers to select' : 'Thumbs up to allow, fist to deny'}</div>
    </div>
    <svg class="progress-ring" viewBox="0 0 36 36">
      <circle class="progress-bg" cx="18" cy="18" r="15"/>
      <circle class="progress-fg" id="progressCircle" cx="18" cy="18" r="15"/>
    </svg>
  </div>
  ${mode === 'select' ? '<div class="options-panel" id="optionsPanel">' + optionsHtml + '</div>' : ''}
  <div class="buttons" id="buttonsBar">
    ${mode === 'confirm' ? `
      <button class="btn-deny" onclick="sendResult({decision:'deny'})">Deny (Esc)</button>
      <button class="btn-allow" onclick="sendResult({decision:'allow'})">Allow (Enter)</button>
    ` : selectOptions.map((opt, i) =>
      `<button class="btn-select" onclick="sendResult({selection:${i+1},label:'${escapeHtml(opt)}'})">${i+1}</button>`
    ).join('')}
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.min.js"><\/script>

  <script>
    const MODE = '${mode}';
    const OPTIONS = ${JSON.stringify(selectOptions)};
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const gestureLabel = document.getElementById('gestureLabel');
    const hintText = document.getElementById('hintText');
    const progressCircle = document.getElementById('progressCircle');
    const circumference = 2 * Math.PI * 15;

    let currentGesture = null;
    let gestureStart = 0;
    const HOLD_MS = 1500;
    let decided = false;

    function sendResult(data) {
      if (decided) return;
      decided = true;
      window.glimpse.send(data);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (MODE === 'confirm') {
        if (e.key === 'Enter') sendResult({ decision: 'allow' });
        if (e.key === 'Escape') sendResult({ decision: 'deny' });
      } else {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= OPTIONS.length) {
          sendResult({ selection: num, label: OPTIONS[num - 1] });
        }
        if (e.key === 'Escape') sendResult({ selection: 0, label: '' });
      }
    });

    // Finger detection
    function isFingerExtended(landmarks, tip, pip) {
      return landmarks[tip].y < landmarks[pip].y;
    }

    function isThumbExtended(landmarks, handedness) {
      const tipX = landmarks[4].x;
      const ipX = landmarks[3].x;
      if (handedness === 'Left') return tipX < ipX;
      return tipX > ipX;
    }

    function classifyGesture(landmarks, handedness) {
      const thumb = isThumbExtended(landmarks, handedness);
      const index = isFingerExtended(landmarks, 8, 6);
      const middle = isFingerExtended(landmarks, 12, 10);
      const ring = isFingerExtended(landmarks, 16, 14);
      const pinky = isFingerExtended(landmarks, 20, 18);
      const fingers = [index, middle, ring, pinky];
      const fingersUp = fingers.filter(Boolean).length;

      if (MODE === 'confirm') {
        if (thumb && fingersUp === 0) return 'thumbs_up';
        if (!thumb && fingersUp === 0) return 'fist';
        if (thumb && fingersUp === 4) return 'open_hand';
        return null;
      }

      // Select mode: count extended fingers (thumb not counted for 1-4, counted for 5)
      // 1 = index only, 2 = index+middle, 3 = index+middle+ring, 4 = all four fingers, 5 = all + thumb
      if (thumb && fingersUp === 4) return 'five';
      if (!thumb && fingersUp === 4) return 'four';
      if (index && middle && ring && !pinky) return 'three';
      if (index && middle && !ring && !pinky) return 'two';
      if (index && !middle && !ring && !pinky) return 'one';
      if (!thumb && fingersUp === 0) return 'fist';
      return null;
    }

    function highlightOption(num) {
      if (MODE !== 'select') return;
      document.querySelectorAll('.option').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.btn-select').forEach(el => el.classList.remove('active'));
      if (num >= 1 && num <= OPTIONS.length) {
        const opt = document.getElementById('opt' + num);
        if (opt) opt.classList.add('active');
        const btns = document.querySelectorAll('.btn-select');
        if (btns[num - 1]) btns[num - 1].classList.add('active');
      }
    }

    const fingerNames = { one: 1, two: 2, three: 3, four: 4, five: 5 };

    function updateProgress(gesture) {
      const now = Date.now();

      if (gesture !== currentGesture) {
        currentGesture = gesture;
        gestureStart = now;
      }

      const elapsed = now - gestureStart;
      const progress = Math.min(elapsed / HOLD_MS, 1);

      if (MODE === 'confirm') {
        if (gesture === 'thumbs_up') {
          gestureLabel.textContent = '\\u{1f44d} Thumbs Up \\u2014 Allow';
          gestureLabel.style.color = '#4ade80';
          progressCircle.classList.remove('deny', 'select');
          progressCircle.style.strokeDashoffset = circumference * (1 - progress);
          hintText.textContent = progress < 1 ? 'Hold steady...' : 'Confirmed!';
          if (progress >= 1) sendResult({ decision: 'allow' });
        } else if (gesture === 'fist') {
          gestureLabel.textContent = '\\u{270a} Fist \\u2014 Deny';
          gestureLabel.style.color = '#f87171';
          progressCircle.classList.add('deny');
          progressCircle.classList.remove('select');
          progressCircle.style.strokeDashoffset = circumference * (1 - progress);
          hintText.textContent = progress < 1 ? 'Hold steady...' : 'Denied!';
          if (progress >= 1) sendResult({ decision: 'deny' });
        } else {
          resetProgress(gesture);
        }
      } else {
        // Select mode
        const num = fingerNames[gesture];
        if (num && num <= OPTIONS.length) {
          highlightOption(num);
          gestureLabel.textContent = num + ' \\u2014 ' + OPTIONS[num - 1];
          gestureLabel.style.color = '#60a5fa';
          progressCircle.classList.remove('deny');
          progressCircle.classList.add('select');
          progressCircle.style.strokeDashoffset = circumference * (1 - progress);
          hintText.textContent = progress < 1 ? 'Hold steady...' : 'Selected!';
          if (progress >= 1) sendResult({ selection: num, label: OPTIONS[num - 1] });
        } else if (gesture === 'fist') {
          highlightOption(0);
          gestureLabel.textContent = '\\u{270a} Cancel';
          gestureLabel.style.color = '#f87171';
          progressCircle.classList.add('deny');
          progressCircle.classList.remove('select');
          progressCircle.style.strokeDashoffset = circumference * (1 - progress);
          hintText.textContent = progress < 1 ? 'Hold steady...' : 'Cancelled!';
          if (progress >= 1) sendResult({ selection: 0, label: '' });
        } else {
          highlightOption(0);
          resetProgress(gesture);
        }
      }
    }

    function resetProgress(gesture) {
      currentGesture = null;
      gestureLabel.textContent = 'Waiting...';
      gestureLabel.style.color = '#fff';
      progressCircle.style.strokeDashoffset = circumference;
      progressCircle.classList.remove('deny', 'select');
      if (MODE === 'confirm') {
        hintText.textContent = 'Thumbs up to allow, fist to deny';
      } else {
        hintText.textContent = 'Show 1-' + OPTIONS.length + ' fingers to select';
      }
    }

    // MediaPipe Hands
    const hands = new Hands({
      locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/' + file
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const handedness = results.multiHandedness[0].label;

        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: 'rgba(0,255,200,0.4)', lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: '#0ff', lineWidth: 1, radius: 3 });

        const gesture = classifyGesture(landmarks, handedness);
        updateProgress(gesture);
      } else {
        updateProgress(null);
      }
    });

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        video.srcObject = stream;
        await video.play();

        const cam = new Camera(video, {
          onFrame: async () => { await hands.send({ image: video }); },
          width: 640, height: 480,
        });
        cam.start();
      } catch (err) {
        console.error('Camera error:', err);
        document.getElementById('noCam').style.display = 'flex';
        video.style.display = 'none';
        canvas.style.display = 'none';
      }
    }

    startCamera();
  <\/script>
</body>
</html>
`;

const windowHeight = mode === 'select' ? 520 + selectOptions.length * 36 : 520;

const result = await prompt(html, {
  width: 640,
  height: windowHeight,
  title: mode === 'select' ? 'Gesture Select' : 'Gesture Confirm',
  timeout: timeoutMs,
});

if (result) {
  if (mode === 'confirm') {
    console.log(JSON.stringify({ permissionDecision: result.decision || 'deny' }));
  } else {
    console.log(JSON.stringify(result));
  }
} else {
  if (mode === 'confirm') {
    console.log(JSON.stringify({ permissionDecision: 'deny' }));
  } else {
    console.log(JSON.stringify({ selection: 0, label: '' }));
  }
}
