/*
  Mini-proyecto: Movimiento Parabólico
  Escenario: Experimento del mono y el proyectil.

  Fórmulas usadas:

  1) Ángulo automático:
     θ = atan2(H - h0, D)

  2) Componentes de la velocidad:
     vx = v0 cos(θ)
     vy = v0 sin(θ)

  3) Posición del proyectil:
     xp(t) = vx · t
     yp(t) = h0 + vy · t - (1/2) · g · t²

  4) Posición del objetivo en caída:
     xm(t) = D
     ym(t) = H - (1/2) · g · t²

  5) Distancia entre objetos:
     d = √((xp - xm)² + (yp - ym)²)

  6) Choque:
     si d < 0.001 m, ocurre el choque.

  Donde:
     g  = 9.81 m/s²
     D  = distancia horizontal
     H  = altura inicial del objetivo
     h0 = altura inicial del cañón
     v0 = velocidad inicial
*/

const G = 9.81;
const COLLISION_THRESHOLD = 0.001;

const state = {
  running: false,
  stopped: false,
  animationId: null,
  startTimestamp: 0,
  projectileTrail: [],
  targetTrail: [],
  params: null,
  scale: null
};

const ui = {
  form: document.getElementById("paramsForm"),

  velocityInput: document.getElementById("velocityInput"),
  distanceInput: document.getElementById("distanceInput"),
  targetHeightInput: document.getElementById("targetHeightInput"),
  launchHeightInput: document.getElementById("launchHeightInput"),
  visualSpeedInput: document.getElementById("visualSpeedInput"),

  angleStat: document.getElementById("angleStat"),
  timeStat: document.getElementById("timeStat"),
  impactTimeStat: document.getElementById("impactTimeStat"),
  projectilePositionStat: document.getElementById("projectilePositionStat"),
  targetPositionStat: document.getElementById("targetPositionStat"),
  distanceBetweenStat: document.getElementById("distanceBetweenStat"),
  statusBox: document.getElementById("statusBox"),

  stopBtn: document.getElementById("stopBtn"),
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

  ui.form.addEventListener("submit", startSimulation);
  ui.stopBtn.addEventListener("click", stopSimulation);
  ui.resetBtn.addEventListener("click", resetSimulation);

  [
    ui.velocityInput,
    ui.distanceInput,
    ui.targetHeightInput,
    ui.launchHeightInput,
    ui.visualSpeedInput
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

      const fallback = img.nextElementSibling;
      if (fallback) {
        fallback.style.display = "grid";
      }
    });
  });
}

function getParameters() {
  const velocity = clampNumber(ui.velocityInput, 5, 80);
  const distance = clampNumber(ui.distanceInput, 15, 100);
  const targetHeight = clampNumber(ui.targetHeightInput, 8, 65);
  const launchHeight = clampNumber(ui.launchHeightInput, 0, 25);
  const visualSpeed = clampNumber(ui.visualSpeedInput, 0.5, 3);

  const deltaX = distance;
  const deltaY = targetHeight - launchHeight;

  const angleRad = Math.atan2(deltaY, deltaX);
  const angleDeg = radiansToDegrees(angleRad);

  const vx = velocity * Math.cos(angleRad);
  const vy = velocity * Math.sin(angleRad);

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
    visualSpeed,
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

function targetPosition(params, t) {
  return {
    x: params.distance,
    y: params.targetHeight - 0.5 * G * t * t
  };
}

function createScale(params) {
  const rect = ui.world.getBoundingClientRect();

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
  stopFrame();

  const params = getParameters();
  const scale = createScale(params);

  state.running = false;
  state.stopped = false;
  state.projectileTrail = [];
  state.targetTrail = [];
  state.params = params;
  state.scale = scale;

  drawStaticScene(params, scale);
  positionObjects(params, scale, 0);
  updateStaticTelemetry(params);
  updateLiveTelemetry(0, projectilePosition(params, 0), targetPosition(params, 0));

  ui.kienzan.classList.remove("active");
  ui.ozaru.classList.remove("falling");
  ui.impact.classList.remove("active");

  ui.statusBox.className = "status";
  ui.statusBox.textContent =
    "Listo. Ajusta los parámetros y presiona iniciar.";
}

function drawStaticScene(params, scale) {
  ui.svgLayer.setAttribute("viewBox", `0 0 ${scale.width} ${scale.height}`);

  const launchScreen = worldToScreen(
    { x: 0, y: params.launchHeight },
    scale
  );

  const targetInitialScreen = worldToScreen(
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
      x2="${targetInitialScreen.x}"
      y2="${targetInitialScreen.y}"
    ></line>

    <path
      id="projectilePath"
      class="projectile-path"
      d=""
    ></path>

    <path
      id="targetPath"
      class="target-path"
      d=""
    ></path>

    <circle
      class="initial-point"
      cx="${targetInitialScreen.x}"
      cy="${targetInitialScreen.y}"
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

function positionObjects(params, scale, t) {
  const launchScreen = worldToScreen(
    { x: 0, y: params.launchHeight },
    scale
  );

  const projectileScreen = worldToScreen(
    projectilePosition(params, t),
    scale
  );

  const targetScreen = worldToScreen(
    targetPosition(params, t),
    scale
  );

  ui.krillin.style.left = `${launchScreen.x}px`;
  ui.krillin.style.top = `${launchScreen.y}px`;

  ui.kienzan.style.left = `${projectileScreen.x}px`;
  ui.kienzan.style.top = `${projectileScreen.y}px`;

  ui.ozaru.style.left = `${targetScreen.x}px`;
  ui.ozaru.style.top = `${targetScreen.y}px`;
}

function startSimulation(event) {
  event.preventDefault();

  stopFrame();

  const params = getParameters();
  const scale = createScale(params);

  state.running = true;
  state.stopped = false;
  state.projectileTrail = [];
  state.targetTrail = [];
  state.params = params;
  state.scale = scale;
  state.startTimestamp = performance.now();

  drawStaticScene(params, scale);
  positionObjects(params, scale, 0);
  updateStaticTelemetry(params);

  ui.kienzan.classList.add("active");
  ui.ozaru.classList.add("falling");
  ui.impact.classList.remove("active");

  ui.statusBox.className = "status";
  ui.statusBox.textContent =
    "Animación iniciada.";

  state.animationId = requestAnimationFrame(animate);
}

function animate(timestamp) {
  if (!state.running) return;

  const params = state.params;
  const scale = state.scale;

  const elapsedSeconds =
    ((timestamp - state.startTimestamp) / 1000) * params.visualSpeed;

  const t = Math.min(elapsedSeconds, params.impactTime);

  const projectile = projectilePosition(params, t);
  const target = targetPosition(params, t);
  const distance = distanceBetween(projectile, target);

  const projectileScreen = worldToScreen(projectile, scale);
  const targetScreen = worldToScreen(target, scale);

  state.projectileTrail.push(projectileScreen);
  state.targetTrail.push(targetScreen);

  positionObjects(params, scale, t);
  drawLivePaths();
  updateLiveTelemetry(t, projectile, target);

  if (distance < COLLISION_THRESHOLD || t >= params.impactTime) {
    finishCollision();
    return;
  }

  state.animationId = requestAnimationFrame(animate);
}

function finishCollision() {
  const params = state.params;
  const scale = state.scale;

  const projectile = projectilePosition(params, params.impactTime);
  const target = targetPosition(params, params.impactTime);
  const distance = distanceBetween(projectile, target);

  const projectileScreen = worldToScreen(projectile, scale);
  const targetScreen = worldToScreen(target, scale);

  state.projectileTrail.push(projectileScreen);
  state.targetTrail.push(targetScreen);

  drawLivePaths();
  positionObjects(params, scale, params.impactTime);
  updateLiveTelemetry(params.impactTime, projectile, target);

  state.running = false;
  state.stopped = false;
  stopFrame();

  ui.kienzan.classList.remove("active");
  ui.ozaru.classList.remove("falling");

  ui.impact.style.left = `${targetScreen.x}px`;
  ui.impact.style.top = `${targetScreen.y}px`;

  ui.impact.classList.remove("active");
  void ui.impact.offsetWidth;
  ui.impact.classList.add("active");

  ui.statusBox.className = "status success";

  if (distance < COLLISION_THRESHOLD) {
    ui.statusBox.textContent =
      `Choque detectado. Distancia: ${distance.toFixed(9)} m.`;
  } else {
    ui.statusBox.textContent =
      `Choque confirmado. Distancia: ${distance.toFixed(9)} m.`;
  }
}

function stopSimulation() {
  if (!state.running) {
    ui.statusBox.className = "status stopped";
    ui.statusBox.textContent =
      "La animación ya está detenida.";
    return;
  }

  state.running = false;
  state.stopped = true;

  stopFrame();

  ui.kienzan.classList.remove("active");
  ui.ozaru.classList.remove("falling");

  ui.statusBox.className = "status stopped";
  ui.statusBox.textContent =
    "Animación detenida.";
}

function resetSimulation() {
  prepareScene();

  ui.statusBox.className = "status";
  ui.statusBox.textContent =
    "Simulación reiniciada.";
}

function stopFrame() {
  if (state.animationId) {
    cancelAnimationFrame(state.animationId);
    state.animationId = null;
  }
}

function drawLivePaths() {
  const projectilePath = document.getElementById("projectilePath");
  const targetPath = document.getElementById("targetPath");

  if (projectilePath) {
    projectilePath.setAttribute("d", pointsToPath(state.projectileTrail));
  }

  if (targetPath) {
    targetPath.setAttribute("d", pointsToPath(state.targetTrail));
  }
}

function updateStaticTelemetry(params) {
  ui.angleStat.textContent = `${params.angleDeg.toFixed(3)}°`;
  ui.impactTimeStat.textContent = `${params.impactTime.toFixed(3)} s`;
}

function updateLiveTelemetry(t, projectile, target) {
  const distance = distanceBetween(projectile, target);

  ui.timeStat.textContent = `${t.toFixed(3)} s`;

  ui.projectilePositionStat.textContent =
    `x: ${projectile.x.toFixed(3)} m | y: ${projectile.y.toFixed(3)} m`;

  ui.targetPositionStat.textContent =
    `x: ${target.x.toFixed(3)} m | y: ${target.y.toFixed(3)} m`;

  ui.distanceBetweenStat.textContent =
    `${distance.toFixed(9)} m`;
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