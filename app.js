import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

const clips = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/bee.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/river.mp4"
];
const canvas = document.getElementById("glitch-canvas");
const effectsList = document.getElementById("effects-list");
const effectLibrarySelect = document.getElementById("effect-library");
const stats = document.getElementById("stats");
const statusPill = document.getElementById("status-pill");
const modeSelect = document.getElementById("mode-select");
const generationStatus = document.getElementById("generation-status");
const streamStatus = document.getElementById("stream-status");
const logs = document.getElementById("logs");
const presetSelect = document.getElementById("preset-select");
const speedSlider = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const batchToggle = document.getElementById("batch-toggle");
const batchStatus = document.getElementById("batch-status");
const batchInterval = document.getElementById("batch-interval");
const batchIntervalValue = document.getElementById("batch-interval-value");

const effectLibrary = [
  {
    id: "rgbShift",
    name: "Décalage RGB",
    params: { intensity: 0.35, offset: 0.004 }
  },
  {
    id: "digitalNoise",
    name: "Bruit numérique",
    params: { intensity: 0.3, grain: 1.2 }
  },
  {
    id: "posterize",
    name: "Posterisation",
    params: { levels: 6 }
  },
  {
    id: "solarize",
    name: "Solarisation",
    params: { threshold: 0.55 }
  },
  {
    id: "trail",
    name: "Traînées",
    params: { mix: 0.6 }
  }
];

const state = {
  chain: [
    makeEffect("rgbShift"),
    makeEffect("digitalNoise"),
    makeEffect("trail")
  ],
  mode: "manual",
  presets: loadPresets(),
  fps: 0,
  lastFrame: performance.now(),
  frameCount: 0,
  batchEnabled: false,
  batchTimer: null,
  rotationInterval: 30000,
  currentClipIndex: 0
};

function makeEffect(id) {
  const blueprint = effectLibrary.find((effect) => effect.id === id);
  return {
    id: `${id}-${crypto.randomUUID()}`,
    type: id,
    name: blueprint?.name ?? id,
    params: { ...blueprint?.params }
  };
}

function populateLibrary() {
  effectLibrary.forEach((effect) => {
    const option = document.createElement("option");
    option.value = effect.id;
    option.textContent = effect.name;
    effectLibrarySelect.append(option);
  });
}

function renderEffectsList() {
  effectsList.innerHTML = "";
  state.chain.forEach((effect, index) => {
    const card = document.createElement("div");
    card.className = "effect-card";

    const header = document.createElement("div");
    header.className = "effect-header";

    const title = document.createElement("h3");
    title.textContent = effect.name;

    const actions = document.createElement("div");
    actions.className = "effect-actions";

    const upButton = document.createElement("button");
    upButton.textContent = "↑";
    upButton.disabled = index === 0;
    upButton.addEventListener("click", () => moveEffect(index, -1));

    const downButton = document.createElement("button");
    downButton.textContent = "↓";
    downButton.disabled = index === state.chain.length - 1;
    downButton.addEventListener("click", () => moveEffect(index, 1));

    const duplicateButton = document.createElement("button");
    duplicateButton.textContent = "Dupliquer";
    duplicateButton.addEventListener("click", () => duplicateEffect(index));

    const removeButton = document.createElement("button");
    removeButton.textContent = "Supprimer";
    removeButton.addEventListener("click", () => removeEffect(index));

    actions.append(upButton, downButton, duplicateButton, removeButton);
    header.append(title, actions);

    const params = document.createElement("div");
    params.className = "effect-params";

    Object.entries(effect.params).forEach(([key, value]) => {
      const label = document.createElement("label");
      label.textContent = key;

      const input = document.createElement("input");
      input.type = "range";
      input.min = 0;
      input.max = 1;
      input.step = 0.01;
      input.value = value;
      if (key === "levels") {
        input.min = 2;
        input.max = 10;
        input.step = 1;
      }
      if (key === "grain") {
        input.min = 0.1;
        input.max = 2;
      }
      label.appendChild(input);
      input.addEventListener("input", () => {
        effect.params[key] = Number(input.value);
      });
      params.appendChild(label);
    });

    card.append(header, params);
    effectsList.appendChild(card);
  });

  updateNodeCanvas();
  updateStats();
}

function moveEffect(index, direction) {
  const target = index + direction;
  const next = [...state.chain];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  state.chain = next;
  renderEffectsList();
}

function duplicateEffect(index) {
  const clone = structuredClone(state.chain[index]);
  clone.id = `${clone.type}-${crypto.randomUUID()}`;
  state.chain.splice(index + 1, 0, clone);
  renderEffectsList();
}

function removeEffect(index) {
  state.chain.splice(index, 1);
  renderEffectsList();
}

function randomizeChain() {
  const count = Math.floor(Math.random() * 4) + 2;
  const shuffled = [...effectLibrary].sort(() => Math.random() - 0.5);
  state.chain = shuffled.slice(0, count).map((effect) => makeEffect(effect.id));
  state.chain.forEach((effect) => {
    Object.keys(effect.params).forEach((key) => {
      effect.params[key] = Number((Math.random() * 0.9 + 0.1).toFixed(2));
    });
  });
  logMessage("Nouvelle chaîne générée automatiquement.");
  renderEffectsList();
}

function updateNodeCanvas() {
  const canvas = document.getElementById("node-canvas");
  canvas.innerHTML = "";
  const width = canvas.clientWidth || 300;
  const height = canvas.clientHeight || 240;
  const gap = width / Math.max(state.chain.length, 1);

  state.chain.forEach((effect, index) => {
    const node = document.createElement("div");
    node.className = "node";
    node.textContent = effect.name;
    node.style.left = `${Math.max(12, index * gap + 12)}px`;
    node.style.top = `${height / 2 - 20}px`;
    canvas.appendChild(node);

    if (index > 0) {
      const connector = document.createElement("div");
      connector.className = "node-connector";
      connector.style.left = `${Math.max(12, (index - 1) * gap + 70)}px`;
      connector.style.top = `${height / 2}px`;
      connector.style.width = `${gap - 20}px`;
      canvas.appendChild(connector);
    }
  });
}

function switchTab(event) {
  const button = event.currentTarget;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
  button.classList.add("active");
  document.getElementById(`tab-${button.dataset.tab}`).classList.add("active");
}

function savePreset(name) {
  if (!name) {
    logMessage("Nom de preset requis.");
    return;
  }
  state.presets[name] = JSON.parse(JSON.stringify(state.chain));
  persistPresets();
  updatePresetSelect();
  logMessage(`Preset "${name}" sauvegardé.`);
}

function loadPreset(name) {
  const preset = state.presets[name];
  if (!preset) {
    return;
  }
  state.chain = preset.map((effect) => ({ ...effect, id: `${effect.type}-${crypto.randomUUID()}` }));
  renderEffectsList();
  logMessage(`Preset "${name}" chargé.`);
}

function deletePreset(name) {
  if (!state.presets[name]) {
    return;
  }
  delete state.presets[name];
  persistPresets();
  updatePresetSelect();
  logMessage(`Preset "${name}" supprimé.`);
}

function exportPreset() {
  const name = presetSelect.value;
  if (!name) {
    return;
  }
  const payload = JSON.stringify({ name, chain: state.presets[name] }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importPreset(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data?.name && data?.chain) {
        state.presets[data.name] = data.chain;
        persistPresets();
        updatePresetSelect();
        logMessage(`Preset "${data.name}" importé.`);
      }
    } catch (error) {
      logMessage("Import impossible : fichier invalide.");
    }
  };
  reader.readAsText(file);
}

function loadPresets() {
  const stored = localStorage.getItem("glitch-presets");
  return stored ? JSON.parse(stored) : {};
}

function persistPresets() {
  localStorage.setItem("glitch-presets", JSON.stringify(state.presets));
}

function updatePresetSelect() {
  presetSelect.innerHTML = "<option value=\"\">Sélectionner</option>";
  Object.keys(state.presets).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    presetSelect.appendChild(option);
  });
}

function logMessage(message) {
  const entry = document.createElement("div");
  entry.textContent = `${new Date().toLocaleTimeString()} • ${message}`;
  logs.prepend(entry);
}

function updateStats() {
  stats.textContent = `FPS: ${state.fps} | Effets: ${state.chain.length}`;
}

function updateMode(mode) {
  state.mode = mode;
  const label =
    mode === "manual" ? "Mode manuel" : mode === "preset-random" ? "Preset aléatoire" : "Freestyle";
  statusPill.textContent = `Flux en cours • ${label}`;
  generationStatus.textContent = mode === "manual" ? "En cours" : "Automatique";
}

function handleModeChange() {
  updateMode(modeSelect.value);
  if (modeSelect.value === "preset-random") {
    const presetNames = Object.keys(state.presets);
    if (presetNames.length) {
      const pick = presetNames[Math.floor(Math.random() * presetNames.length)];
      loadPreset(pick);
    }
  }
  if (modeSelect.value === "freestyle") {
    randomizeChain();
  }
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x05060a, 1);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const video = document.createElement("video");
video.src = clips[state.currentClipIndex];
video.crossOrigin = "anonymous";
video.loop = true;
video.muted = true;
video.playsInline = true;

const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;

const quadGeometry = new THREE.PlaneGeometry(2, 2);
const baseMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
const finalMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
const quad = new THREE.Mesh(quadGeometry, baseMaterial);
scene.add(quad);

const targetA = new THREE.WebGLRenderTarget(1, 1);
const targetB = new THREE.WebGLRenderTarget(1, 1);

const effectMaterials = new Map();

function resize() {
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  targetA.setSize(clientWidth, clientHeight);
  targetB.setSize(clientWidth, clientHeight);
  updateNodeCanvas();
}

const fragmentShaders = {
  rgbShift: `
    uniform sampler2D inputTexture;
    uniform vec2 resolution;
    uniform float intensity;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec2 shift = vec2(offset * intensity, 0.0);
      float r = texture2D(inputTexture, vUv + shift).r;
      float g = texture2D(inputTexture, vUv).g;
      float b = texture2D(inputTexture, vUv - shift).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
  digitalNoise: `
    uniform sampler2D inputTexture;
    uniform float time;
    uniform float intensity;
    uniform float grain;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 color = texture2D(inputTexture, vUv);
      float noise = rand(vUv * grain + time) * intensity;
      gl_FragColor = vec4(color.rgb + noise, 1.0);
    }
  `,
  posterize: `
    uniform sampler2D inputTexture;
    uniform float levels;
    varying vec2 vUv;
    void main() {
      vec3 color = texture2D(inputTexture, vUv).rgb;
      color = floor(color * levels) / levels;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  solarize: `
    uniform sampler2D inputTexture;
    uniform float threshold;
    varying vec2 vUv;
    void main() {
      vec3 color = texture2D(inputTexture, vUv).rgb;
      vec3 inverted = 1.0 - color;
      vec3 result = mix(color, inverted, step(threshold, color));
      gl_FragColor = vec4(result, 1.0);
    }
  `,
  trail: `
    uniform sampler2D inputTexture;
    uniform sampler2D feedbackTexture;
    uniform float mixAmount;
    varying vec2 vUv;
    void main() {
      vec4 current = texture2D(inputTexture, vUv);
      vec4 previous = texture2D(feedbackTexture, vUv);
      gl_FragColor = mix(current, previous, mixAmount);
    }
  `
};

function createEffectMaterial(effect) {
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const uniforms = {
    inputTexture: { value: null },
    feedbackTexture: { value: null },
    resolution: { value: new THREE.Vector2() },
    time: { value: 0 },
    intensity: { value: effect.params.intensity ?? 0.3 },
    offset: { value: effect.params.offset ?? 0.005 },
    grain: { value: effect.params.grain ?? 1 },
    levels: { value: effect.params.levels ?? 6 },
    threshold: { value: effect.params.threshold ?? 0.5 },
    mixAmount: { value: effect.params.mix ?? 0.5 }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: fragmentShaders[effect.type]
  });
}

function getMaterial(effect) {
  if (!effectMaterials.has(effect.id)) {
    effectMaterials.set(effect.id, createEffectMaterial(effect));
  }
  return effectMaterials.get(effect.id);
}

function renderFrame(time) {
  const delta = time - state.lastFrame;
  state.lastFrame = time;
  state.frameCount += 1;
  if (state.frameCount % 20 === 0) {
    state.fps = Math.round(1000 / delta);
    updateStats();
  }

  let inputTexture = videoTexture;
  let feedbackTexture = null;
  let renderTarget = targetA;
  let outputTarget = targetB;

  state.chain.forEach((effect) => {
    const material = getMaterial(effect);
    material.uniforms.inputTexture.value = inputTexture;
    material.uniforms.feedbackTexture.value = feedbackTexture ?? inputTexture;
    material.uniforms.resolution.value.set(targetA.width, targetA.height);
    material.uniforms.time.value = time * 0.001;
    material.uniforms.intensity.value = effect.params.intensity ?? 0.3;
    material.uniforms.offset.value = effect.params.offset ?? 0.004;
    material.uniforms.grain.value = effect.params.grain ?? 1.2;
    material.uniforms.levels.value = effect.params.levels ?? 6;
    material.uniforms.threshold.value = effect.params.threshold ?? 0.55;
    material.uniforms.mixAmount.value = effect.params.mix ?? 0.6;

    quad.material = material;
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    feedbackTexture = renderTarget.texture;
    inputTexture = renderTarget.texture;
    [renderTarget, outputTarget] = [outputTarget, renderTarget];
  });

  quad.material = state.chain.length ? finalMaterial : baseMaterial;
  if (state.chain.length) {
    finalMaterial.map = inputTexture;
  }
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  requestAnimationFrame(renderFrame);
}

function updateStreamStatus(status) {
  streamStatus.textContent = status;
}

function nextClip() {
  state.currentClipIndex = (state.currentClipIndex + 1) % clips.length;
  video.src = clips[state.currentClipIndex];
  video.play();
  logMessage("Clip suivant chargé.");
}

function startBatchRotation() {
  state.batchEnabled = true;
  batchStatus.textContent = "Actif";
  video.loop = false;
  clearInterval(state.batchTimer);
  state.batchTimer = setInterval(nextClip, state.rotationInterval);
  logMessage("Rotation batch activée.");
}

function stopBatchRotation() {
  state.batchEnabled = false;
  batchStatus.textContent = "Désactivé";
  video.loop = true;
  clearInterval(state.batchTimer);
  state.batchTimer = null;
  logMessage("Rotation batch désactivée.");
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", switchTab);
  });

  document.getElementById("add-effect").addEventListener("click", () => {
    state.chain.push(makeEffect(effectLibrarySelect.value));
    renderEffectsList();
  });

  document.getElementById("randomize-chain").addEventListener("click", randomizeChain);
  document.getElementById("reset-view").addEventListener("click", updateNodeCanvas);
  document.getElementById("duplicate-chain").addEventListener("click", () => {
    state.chain = state.chain.map((effect) => ({ ...effect, id: `${effect.type}-${crypto.randomUUID()}` }));
    renderEffectsList();
    logMessage("Chaîne dupliquée.");
  });

  document.getElementById("save-preset").addEventListener("click", () => {
    const name = document.getElementById("preset-name").value.trim();
    savePreset(name);
  });

  document.getElementById("load-preset").addEventListener("click", () => {
    loadPreset(presetSelect.value);
  });

  document.getElementById("delete-preset").addEventListener("click", () => {
    deletePreset(presetSelect.value);
  });

  document.getElementById("export-preset").addEventListener("click", exportPreset);

  document.getElementById("import-preset").addEventListener("click", () => {
    document.getElementById("import-input").click();
  });

  document.getElementById("import-input").addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      importPreset(file);
    }
  });

  modeSelect.addEventListener("change", handleModeChange);

  document.getElementById("toggle-play").addEventListener("click", (event) => {
    if (video.paused) {
      video.play();
      event.currentTarget.textContent = "Pause";
      generationStatus.textContent = "En cours";
    } else {
      video.pause();
      event.currentTarget.textContent = "Reprendre";
      generationStatus.textContent = "En pause";
    }
  });

  document.getElementById("sync").addEventListener("click", () => {
    video.currentTime = 0;
    logMessage("Synchronisation effectuée.");
  });

  speedSlider.addEventListener("input", () => {
    const value = Number(speedSlider.value);
    video.playbackRate = value;
    speedValue.textContent = `${value.toFixed(2)}x`;
  });

  batchToggle.addEventListener("change", () => {
    if (batchToggle.checked) {
      startBatchRotation();
    } else {
      stopBatchRotation();
    }
  });

  batchInterval.addEventListener("input", () => {
    const seconds = Number(batchInterval.value);
    state.rotationInterval = seconds * 1000;
    batchIntervalValue.textContent = `${seconds}s`;
    if (state.batchEnabled) {
      startBatchRotation();
    }
  });

  window.addEventListener("resize", resize);
}

populateLibrary();
renderEffectsList();
updatePresetSelect();
bindEvents();
updateMode(state.mode);
batchIntervalValue.textContent = `${Number(batchInterval.value)}s`;

video.addEventListener("canplay", () => {
  video.play();
  logMessage("Lecture automatique activée.");
});

video.addEventListener("ended", () => {
  if (state.batchEnabled) {
    nextClip();
  }
});

video.addEventListener("stalled", () => updateStreamStatus("Réseau instable"));
video.addEventListener("waiting", () => updateStreamStatus("Mise en mémoire"));
video.addEventListener("playing", () => updateStreamStatus("En direct"));

resize();
requestAnimationFrame(renderFrame);
