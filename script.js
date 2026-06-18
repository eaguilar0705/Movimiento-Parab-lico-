const G = 9.81;

const state = {
  running: false,
  animationId: null,
  startTimestamp: 0,

  animationDurationMs: 1400,
  minAnimationDurationMs: 900,
  maxAnimationDurationMs: 1700,
  msPerPhysicalSecond: 520,

  projectileTrail: [],
  monkeyTrail: [],

  lastParams: null,
  lastScale: null
};

const ui = {
  form: document.getElementById("paramsForm"),

  velocityInput: document.getElementById("velocityInput"),
  distanceInput: document.getElementById("distanceInput"),
  targetHeightInput: document.getElementById("targetHeightInput"),
  launchHeightInput: document.getElementById("launchHeightInput"),

  angleStat: document.getElementById("angleStat"),
  impactTimeStat: document.getElementById("impactTimeStat"),
  currentTimeStat: document.getElementById("currentTimeStat"),
  projectileStat: document.getElementById("projectileStat"),
  monkeyStat: document.getElementById("monkeyStat"),
  statusBox: document.getElementById("statusBox"),

  resetBtn: document.getElementById("resetBtn"),

  world: document.getElementById("world"),
  svgLayer: document.getElementById("svgLayer"),
  krillin: document.getElementById("krillin"),
  ozaru: document.getElementById("ozaru"),
  kienzan: document.getElementById("kienzan"),
  impact: document.getElementById("impact"),
  groundLine: document.querySelector(".ground-line")
};

init();

function init() {
  setupImageFallbacks();

  ui.form.addEventListener("submit", launch);
  ui.resetBtn.addEventListener("click", reset);

  [
    ui.velocityInput,
    ui.distanceInput,
    ui.targetHeightInput,
    ui.launchHeightInput
  ].forEach((input) => {
    input.addEventListener("input", prepareScene);
    input.addEventListener("change", prepareScene);
  });

  window.addEventListener("resize", debounce(prepareScene, 120));

  prepareScene();
}

function setupImageFallbacks() {
  document.querySelectorAll("img[data-fallback]").forEach((img) => {
    img.addEventListener("error", () => {
      img.style.display = "none";

      const label = img.nextElementSibling;
      if (label) {
        label.style.display = "grid";
      }
    });
  });
}

function getParams() {
  const velocity = clampNumber(ui.velocityInput, 5, 80);
  const distance = clampNumber(ui.distanceInput, 15, 100);
  const targetHeight = clampNumber(ui.targetHeightInput, 8, 65);
  const launchHeight = clampNumber(ui.launchHeightInput, 0, 25);

  const dx = distance;
  const dy = targetHeight - launchHeight;

  /*
    Experimento del mono:
    El usuario NO controla el ángulo.
    Krillin apunta directamente a la posición inicial del Ozaru.
  */
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = radiansToDegrees(angleRad);

  const vx = velocity * Math.cos(angleRad);
  const vy = velocity * Math.sin(angleRad);

  /*
    Tiempo exacto para que el Kienzan llegue a la misma posición horizontal del Ozaru.
    En ese mismo tiempo, ambos caen lo mismo por gravedad.
  */
  const impactTime = distance / vx;

  const impactPoint = {
    x: distance,
    y: targetHeight - 0.5 * G * impactTime * impactTime
  };

  return {
    velocity,
    distance,
    targetHeight,
    launchHeight,
    angleRad,
    angleDeg,
    vx,
    vy,
    impactTime,
    impactPoint
  };
}

function projectilePosition(params, t) {
  return {
    x: params.vx * t,
    y: params.launchHeight + params.vy * t - 0.5 * G * t * t
  };
}

function monkeyPosition(params, t) {
  return {
    x: params.distance,
    y: params.targetHeight - 0.5 * G * t * t
  };
}

function createScale(params) {
  const rect = ui.world.getBoundingClientRect();

  /*
    Escala dinámica:
    Si el impacto ocurre más abajo, el plano se expande para mantener visible
    al Ozaru, el Kienzan y el punto de encuentro.
  */
  const minY = Math.min(0, params.impactPoint.y - 12);
  const maxY = Math.max(
    params.targetHeight,
    params.launchHeight,
    params.impactPoint.y
  ) + 14;

  return {
    width: rect.width,
    height: rect.height,

    paddingLeft: Math.max(70, rect.width * 0.075),
    paddingRight: Math.max(85, rect.width * 0.075),

    /*
      Espacio extra arriba/abajo para que el Ozaru no desaparezca
      cuando modificas alturas.
    */
    paddingTop: Math.max(130, rect.height * 0.19),
    paddingBottom: Math.max(135, rect.height * 0.19),

    maxX: params.distance * 1.18,
    minY,
    maxY
  };
}

function worldToScreen(point, scale) {
  const drawableWidth = scale.width - scale.paddingLeft - scale.paddingRight;
  const drawableHeight = scale.height - scale.paddingTop - scale.paddingBottom;

  const normalizedX = point.x / scale.maxX;
  const normalizedY = (point.y - scale.minY) / (scale.maxY - scale.minY);

  return {
    x: scale.paddingLeft + normalizedX * drawableWidth,
    y: scale.height - scale.paddingBottom - normalizedY * drawableHeight
  };
}

function prepareScene() {
  stopAnimation();

  const params = getParams();
  const scale = createScale(params);

  state.lastParams = params;
  state.lastScale = scale;
  state.projectileTrail = [];
  state.monkeyTrail = [];

  drawStaticScene(params, scale);
  positionEntities(params, scale, 0);

  updateStaticTelemetry(params);
  updateLiveTelemetry(
    0,
    projectilePosition(params, 0),
    monkeyPosition(params, 0)
  );

  ui.kienzan.classList.remove("active");
  ui.ozaru.classList.remove("falling");
  ui.impact.classList.remove("active");

  ui.statusBox.className = "status";
  ui.statusBox.textContent =
    "Listo. El ángulo fue calculado automáticamente para apuntar a la posición inicial del Ozaru.";
}

function drawStaticScene(params, scale) {
  ui.svgLayer.setAttribute("viewBox", `0 0 ${scale.width} ${scale.height}`);

  const launchScreen = worldToScreen(
    { x: 0, y: params.launchHeight },
    scale
  );

  const monkeyInitialScreen = worldToScreen(
    { x: params.distance, y: params.targetHeight },
    scale
  );

  const impactScreen = worldToScreen(
    params.impactPoint,
    scale
  );

  const groundScreen = worldToScreen(
    { x: 0, y: 0 },
    scale
  );

  ui.groundLine.style.top = `${groundScreen.y}px`;

  ui.svgLayer.innerHTML = `
    <line
      class="aim-line"
      x1="${launchScreen.x}"
      y1="${launchScreen.y}"
      x2="${monkeyInitialScreen.x}"
      y2="${monkeyInitialScreen.y}"
    ></line>

    <path
      id="projectilePath"
      class="projectile-path"
      d=""
    ></path>

    <path
      id="monkeyPath"
      class="monkey-path"
      d=""
    ></path>

    <circle
      class="initial-point"
      cx="${monkeyInitialScreen.x}"
      cy="${monkeyInitialScreen.y}"
      r="6"
    ></circle>

    <circle
      class="impact-point"
      cx="${impactScreen.x}"
      cy="${impactScreen.y}"
      r="6"
    ></circle>
  `;
}

function positionEntities(params, scale, t) {
  const launchScreen = worldToScreen(
    { x: 0, y: params.launchHeight },
    scale
  );

  const projectileScreen = worldToScreen(
    projectilePosition(params, t),
    scale
  );

  const monkeyScreen = worldToScreen(
    monkeyPosition(params, t),
    scale
  );

  /*
    Krillin queda anclado al punto de lanzamiento.
  */
  ui.krillin.style.left = `${launchScreen.x}px`;
  ui.krillin.style.top = `${launchScreen.y}px`;

  /*
    El Kienzan representa el centro físico del proyectil.
  */
  ui.kienzan.style.left = `${projectileScreen.x}px`;
  ui.kienzan.style.top = `${projectileScreen.y}px`;

  /*
    El Ozaru queda centrado en su posición física.
    Así el impacto se ve más realista.
  */
  ui.ozaru.style.left = `${monkeyScreen.x}px`;
  ui.ozaru.style.top = `${monkeyScreen.y}px`;
}

function launch(event) {
  event.preventDefault();

  stopAnimation();

  const params = getParams();
  const scale = createScale(params);

  state.lastParams = params;
  state.lastScale = scale;
  state.projectileTrail = [];
  state.monkeyTrail = [];
  state.running = true;
  state.startTimestamp = performance.now();
  state.animationDurationMs = getAnimationDurationMs(params);

  drawStaticScene(params, scale);
  positionEntities(params, scale, 0);
  updateStaticTelemetry(params);

  ui.kienzan.classList.add("active");
  ui.ozaru.classList.add("falling");
  ui.impact.classList.remove("active");

  ui.statusBox.className = "status";
  ui.statusBox.textContent =
    "Lanzamiento iniciado: el Ozaru cae justo cuando Krillin lanza el Kienzan.";

  state.animationId = requestAnimationFrame(animate);
}

function animate(timestamp) {
  if (!state.running) return;

  const params = state.lastParams;
  const scale = state.lastScale;

  const elapsedMs = timestamp - state.startTimestamp;
  const progress = Math.min(elapsedMs / state.animationDurationMs, 1);

  /*
    El tiempo físico simulado avanza desde 0 hasta el tiempo exacto de impacto.
    Ambos objetos usan el mismo t, por eso caen sincronizados.
  */
  const t = params.impactTime * progress;

  const projectileWorld = projectilePosition(params, t);
  const monkeyWorld = monkeyPosition(params, t);

  const projectileScreen = worldToScreen(projectileWorld, scale);
  const monkeyScreen = worldToScreen(monkeyWorld, scale);

  state.projectileTrail.push(projectileScreen);
  state.monkeyTrail.push(monkeyScreen);

  positionEntities(params, scale, t);
  drawLivePaths();
  updateLiveTelemetry(t, projectileWorld, monkeyWorld);

  /*
    Se finaliza exactamente en el tiempo matemático de impacto.
    Así siempre se encuentran.
  */
  if (progress >= 1) {
    finishImpactExact(params, scale);
    return;
  }

  state.animationId = requestAnimationFrame(animate);
}

function finishImpactExact(params, scale) {
  const exactProjectileWorld = projectilePosition(params, params.impactTime);
  const exactMonkeyWorld = monkeyPosition(params, params.impactTime);

  const exactProjectileScreen = worldToScreen(exactProjectileWorld, scale);
  const exactMonkeyScreen = worldToScreen(exactMonkeyWorld, scale);

  state.projectileTrail.push(exactProjectileScreen);
  state.monkeyTrail.push(exactMonkeyScreen);

  drawLivePaths();

  state.running = false;

  ui.kienzan.classList.remove("active");
  ui.ozaru.classList.remove("falling");

  positionEntities(params, scale, params.impactTime);

  ui.impact.style.left = `${exactMonkeyScreen.x}px`;
  ui.impact.style.top = `${exactMonkeyScreen.y}px`;

  ui.impact.classList.remove("active");
  void ui.impact.offsetWidth;
  ui.impact.classList.add("active");

  updateLiveTelemetry(
    params.impactTime,
    exactProjectileWorld,
    exactMonkeyWorld
  );

  const distance = distanceBetween(exactProjectileWorld, exactMonkeyWorld);

  ui.statusBox.className = "status success";
  ui.statusBox.textContent =
    `¡Impacto confirmado! Distancia entre centros: ${distance.toFixed(6)} m. ` +
    "El Kienzan y el Ozaru se tocaron porque ambos caen con la misma aceleración gravitatoria.";
}

function drawLivePaths() {
  const projectilePath = document.getElementById("projectilePath");
  const monkeyPath = document.getElementById("monkeyPath");

  if (projectilePath) {
    projectilePath.setAttribute("d", pointsToPath(state.projectileTrail));
  }

  if (monkeyPath) {
    monkeyPath.setAttribute("d", pointsToPath(state.monkeyTrail));
  }
}

function updateStaticTelemetry(params) {
  ui.angleStat.textContent = `${params.angleDeg.toFixed(2)}°`;
  ui.impactTimeStat.textContent = `${params.impactTime.toFixed(2)} s`;
}

function updateLiveTelemetry(t, projectile, monkey) {
  ui.currentTimeStat.textContent = `${t.toFixed(2)} s`;

  ui.projectileStat.textContent =
    `x: ${projectile.x.toFixed(1)} m | y: ${projectile.y.toFixed(1)} m`;

  ui.monkeyStat.textContent =
    `x: ${monkey.x.toFixed(1)} m | y: ${monkey.y.toFixed(1)} m`;
}

function reset() {
  stopAnimation();
  prepareScene();

  ui.statusBox.className = "status";
  ui.statusBox.textContent =
    "Simulación reiniciada. Puedes cambiar los parámetros y lanzar de nuevo.";
}

function stopAnimation() {
  state.running = false;

  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }
}

function getAnimationDurationMs(params) {
  /*
    Hace que el Ozaru y el Kienzan se muevan rápido y sincronizados.
    No altera la física, solo comprime el tiempo visual.
  */
  return clamp(
    params.impactTime * state.msPerPhysicalSecond,
    state.minAnimationDurationMs,
    state.maxAnimationDurationMs
  );
}

function clampNumber(input, min, max) {
  let value = Number(input.value);

  if (Number.isNaN(value)) {
    value = min;
  }

  value = Math.min(Math.max(value, min), max);
  input.value = value;

  return value;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function pointsToPath(points) {
  if (!points.length) return "";

  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function radiansToDegrees(radians) {
  return radians * (180 / Math.PI);
}

function debounce(callback, delay) {
  let timeoutId;

  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}