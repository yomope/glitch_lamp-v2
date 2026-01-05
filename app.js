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
    params: {
      intensity: { value: 0.35, min: 0, max: 1, step: 0.01 },
      offset: { value: 0.004, min: 0.001, max: 0.02, step: 0.001 }
    }
  },
  {
    id: "digitalNoise",
    name: "Bruit numérique",
    params: {
      intensity: { value: 0.3, min: 0, max: 1, step: 0.01 },
      grain: { value: 1.2, min: 0.2, max: 3, step: 0.1 }
    }
  },
  {
    id: "timeEcho",
    name: "Écho temporel",
    params: {
      mix: { value: 0.6, min: 0, max: 1, step: 0.01 }
    }
  },
  {
    id: "trail",
    name: "Traînées",
    params: {
      mix: { value: 0.55, min: 0, max: 1, step: 0.01 }
    }
  },
  {
    id: "colorShift",
    name: "Rotation de teinte",
    params: {
      hue: { value: 0.2, min: 0, max: 1, step: 0.01 },
      saturation: { value: 0.2, min: -1, max: 1, step: 0.01 }
    }
  },
  {
    id: "posterize",
    name: "Posterisation",
    params: {
      levels: { value: 6, min: 2, max: 12, step: 1 }
    }
  },
  {
    id: "solarize",
    name: "Solarisation",
    params: {
      threshold: { value: 0.55, min: 0, max: 1, step: 0.01 }
    }
  },
  {
    id: "blur",
    name: "Flou cinétique",
    params: {
      amount: { value: 0.6, min: 0, max: 2, step: 0.05 }
    }
  },
  {
    id: "sharpen",
    name: "Netteté",
    params: {
      amount: { value: 0.5, min: 0, max: 2, step: 0.05 }
    }
  },
  {
    id: "ascii",
    name: "Rendu ASCII",
    params: {
      scale: { value: 0.6, min: 0.2, max: 1, step: 0.05 }
    }
  },
  {
    id: "doubleExposure",
    name: "Double exposition",
    params: {
      mix: { value: 0.45, min: 0, max: 1, step: 0.01 }
    }
  },
  {
    id: "pixelate",
    name: "Artefacts de compression",
    params: {
      size: { value: 0.015, min: 0.005, max: 0.05, step: 0.001 },
      jitter: { value: 0.35, min: 0, max: 1, step: 0.01 }
    }
  }
];

const state = {
  chain: [
    makeEffect("rgbShift"),
    makeEffect("digitalNoise"),
    makeEffect("pixelate"),
    makeEffect("colorShift"),
    makeEffect("timeEcho")
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
  const params = Object.fromEntries(
    Object.entries(blueprint?.params ?? {}).map(([key, meta]) => [key, meta.value])
  );
  return {
    id: `${id}-${crypto.randomUUID()}`,
    type: id,
    name: blueprint?.name ?? id,
    params
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
    const meta = effectLibrary.find((item) => item.id === effect.type)?.params ?? {};
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
      const paramMeta = meta[key] ?? { min: 0, max: 1, step: 0.01 };
      const label = document.createElement("label");
      label.textContent = key;

      const input = document.createElement("input");
      input.type = "range";
      input.min = paramMeta.min;
      input.max = paramMeta.max;
      input.step = paramMeta.step;
      input.value = value;
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
    const meta = effectLibrary.find((item) => item.id === effect.type)?.params ?? {};
    Object.keys(effect.params).forEach((key) => {
      const paramMeta = meta[key];
      if (!paramMeta) {
        return;
      }
      const min = paramMeta.min ?? 0;
      const max = paramMeta.max ?? 1;
      const value = Math.random() * (max - min) + min;
      const stepped =
        paramMeta.step && paramMeta.step >= 1 ? Math.round(value) : Number(value.toFixed(2));
      effect.params[key] = stepped;
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
  applyModeForClip();
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x05060a, 1);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const video = document.createElement("video");
video.src = clips[state.currentClipIndex];
video.crossOrigin = "anonymous";
video.loop = false;
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
const historyTarget = new THREE.WebGLRenderTarget(1, 1);

const effectMaterials = new Map();

function resize() {
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  targetA.setSize(clientWidth, clientHeight);
  targetB.setSize(clientWidth, clientHeight);
  historyTarget.setSize(clientWidth, clientHeight);
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
  colorShift: `
    uniform sampler2D inputTexture;
    uniform float hue;
    uniform float saturation;
    varying vec2 vUv;
    mat3 hueRotation(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat3(
        vec3(0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928),
        vec3(0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283),
        vec3(0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072)
      );
    }
    void main() {
      vec3 color = texture2D(inputTexture, vUv).rgb;
      float angle = hue * 6.28318;
      color = hueRotation(angle) * color;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, 1.0 + saturation);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  blur: `
    uniform sampler2D inputTexture;
    uniform vec2 resolution;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 texel = vec2(1.0) / resolution;
      vec3 color = texture2D(inputTexture, vUv).rgb * 0.36;
      color += texture2D(inputTexture, vUv + texel * amount).rgb * 0.16;
      color += texture2D(inputTexture, vUv - texel * amount).rgb * 0.16;
      color += texture2D(inputTexture, vUv + vec2(texel.x, -texel.y) * amount).rgb * 0.16;
      color += texture2D(inputTexture, vUv + vec2(-texel.x, texel.y) * amount).rgb * 0.16;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  sharpen: `
    uniform sampler2D inputTexture;
    uniform vec2 resolution;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 texel = vec2(1.0) / resolution;
      vec3 color = texture2D(inputTexture, vUv).rgb * (1.0 + amount);
      color -= texture2D(inputTexture, vUv + vec2(texel.x, 0.0)).rgb * (amount * 0.25);
      color -= texture2D(inputTexture, vUv - vec2(texel.x, 0.0)).rgb * (amount * 0.25);
      color -= texture2D(inputTexture, vUv + vec2(0.0, texel.y)).rgb * (amount * 0.25);
      color -= texture2D(inputTexture, vUv - vec2(0.0, texel.y)).rgb * (amount * 0.25);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  trail: `
    uniform sampler2D inputTexture;
    uniform sampler2D historyTexture;
    uniform float mixAmount;
    varying vec2 vUv;
    void main() {
      vec4 current = texture2D(inputTexture, vUv);
      vec4 previous = texture2D(historyTexture, vUv);
      gl_FragColor = mix(current, previous, mixAmount);
    }
  `,
  timeEcho: `
    uniform sampler2D inputTexture;
    uniform sampler2D historyTexture;
    uniform float mixAmount;
    varying vec2 vUv;
    void main() {
      vec4 current = texture2D(inputTexture, vUv);
      vec4 delayed = texture2D(historyTexture, vUv);
      gl_FragColor = mix(current, delayed, mixAmount);
    }
  `,
  ascii: `
    uniform sampler2D inputTexture;
    uniform vec2 resolution;
    uniform float scale;
    varying vec2 vUv;
    void main() {
      float blocks = mix(20.0, 80.0, scale);
      vec2 grid = floor(vUv * blocks) / blocks;
      vec3 color = texture2D(inputTexture, grid).rgb;
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      float stepValue = step(0.5, luma);
      vec3 finalColor = mix(vec3(0.05), color, stepValue);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
  doubleExposure: `
    uniform sampler2D inputTexture;
    uniform sampler2D historyTexture;
    uniform float mixAmount;
    varying vec2 vUv;
    void main() {
      vec3 current = texture2D(inputTexture, vUv).rgb;
      vec3 ghost = texture2D(historyTexture, vUv).rgb;
      gl_FragColor = vec4(mix(current, ghost, mixAmount), 1.0);
    }
  `,
  pixelate: `
    uniform sampler2D inputTexture;
    uniform float size;
    uniform float jitter;
    uniform float time;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      float blockSize = mix(0.005, 0.06, size);
      vec2 grid = floor(vUv / blockSize) * blockSize;
      float noise = rand(grid + time);
      vec2 offset = vec2(noise * jitter * blockSize);
      vec3 color = texture2D(inputTexture, grid + offset).rgb;
      gl_FragColor = vec4(color, 1.0);
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
    historyTexture: { value: null },
    resolution: { value: new THREE.Vector2() },
    time: { value: 0 },
    intensity: { value: effect.params.intensity ?? 0.3 },
    offset: { value: effect.params.offset ?? 0.005 },
    grain: { value: effect.params.grain ?? 1 },
    levels: { value: effect.params.levels ?? 6 },
    threshold: { value: effect.params.threshold ?? 0.5 },
    mixAmount: { value: effect.params.mix ?? 0.5 },
    hue: { value: effect.params.hue ?? 0.2 },
    saturation: { value: effect.params.saturation ?? 0 },
    amount: { value: effect.params.amount ?? 0.5 },
    scale: { value: effect.params.scale ?? 0.6 },
    size: { value: effect.params.size ?? 0.015 },
    jitter: { value: effect.params.jitter ?? 0.35 }
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
  const historyTexture = historyTarget.texture;
  let renderTarget = targetA;
  let outputTarget = targetB;

  state.chain.forEach((effect) => {
    const material = getMaterial(effect);
    material.uniforms.inputTexture.value = inputTexture;
    material.uniforms.historyTexture.value = historyTexture;
    material.uniforms.resolution.value.set(targetA.width, targetA.height);
    material.uniforms.time.value = time * 0.001;
    material.uniforms.intensity.value = effect.params.intensity ?? 0.3;
    material.uniforms.offset.value = effect.params.offset ?? 0.004;
    material.uniforms.grain.value = effect.params.grain ?? 1.2;
    material.uniforms.levels.value = effect.params.levels ?? 6;
    material.uniforms.threshold.value = effect.params.threshold ?? 0.55;
    material.uniforms.mixAmount.value = effect.params.mix ?? 0.6;
    material.uniforms.hue.value = effect.params.hue ?? 0.2;
    material.uniforms.saturation.value = effect.params.saturation ?? 0;
    material.uniforms.amount.value = effect.params.amount ?? 0.5;
    material.uniforms.scale.value = effect.params.scale ?? 0.6;
    material.uniforms.size.value = effect.params.size ?? 0.015;
    material.uniforms.jitter.value = effect.params.jitter ?? 0.35;

    quad.material = material;
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    inputTexture = renderTarget.texture;
    [renderTarget, outputTarget] = [outputTarget, renderTarget];
  });

  quad.material = state.chain.length ? finalMaterial : baseMaterial;
  if (state.chain.length) {
    finalMaterial.map = inputTexture;
  }
  renderer.setRenderTarget(historyTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  requestAnimationFrame(renderFrame);
}

function updateStreamStatus(status) {
  streamStatus.textContent = status;
}

function applyModeForClip() {
  if (state.mode === "preset-random") {
    const presetNames = Object.keys(state.presets);
    if (presetNames.length) {
      const pick = presetNames[Math.floor(Math.random() * presetNames.length)];
      loadPreset(pick);
    }
  }
  if (state.mode === "freestyle") {
    randomizeChain();
  }
}

function nextClip() {
  state.currentClipIndex = (state.currentClipIndex + 1) % clips.length;
  video.src = clips[state.currentClipIndex];
  video.play();
  logMessage("Clip suivant chargé.");
  applyModeForClip();
}

function restartBatchTimer() {
  clearInterval(state.batchTimer);
  state.batchTimer = setInterval(nextClip, state.rotationInterval);
}

function startBatchRotation() {
  state.batchEnabled = true;
  batchStatus.textContent = "Actif";
  restartBatchTimer();
  logMessage("Rotation batch activée.");
}

function stopBatchRotation() {
  state.batchEnabled = false;
  batchStatus.textContent = "Désactivé";
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
      restartBatchTimer();
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
  nextClip();
  if (state.batchEnabled) {
    restartBatchTimer();
  }
});

video.addEventListener("stalled", () => updateStreamStatus("Réseau instable"));
video.addEventListener("waiting", () => updateStreamStatus("Mise en mémoire"));
video.addEventListener("playing", () => updateStreamStatus("En direct"));

resize();
requestAnimationFrame(renderFrame);
