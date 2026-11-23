// Bahía Azul — bootstrap, game loop, camera, combat, garage, screens, shot modes.
import { G, WORLD, DISTRICTS, MISSIONS, RACES, PACKAGES, mulberry32, rand, randInt, choice, clamp, lerp, angleLerp } from './state.js';
import { buildCity, update, collide, colliders, updateDayNight } from './city.js';
import { spawnCar, spawnTraffic, updateCar, nearestCar } from './vehicles.js';
import { makePlayer, spawnPeds, updatePlayer, updatePeds, hitPed } from './people.js';
import { updateCops, addHeat, updateRoadblock, updateWanted } from './police.js';
import { startMission, updateMission, startNextMission, startRace, updateRace, startTaxi, updateTaxi, spawnPackages, updatePackages, saveGame, loadGame, setObjective, damageEnemy } from './missions.js';
import { updateHUD, drawMinimap, initMinimap, showScreen, hideScreens, sfx, toggleRadio, nextStation, audioReady, startEngine, updateEngine, stopEngine } from './hud.js';

const T = window.THREE;
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // cover | drive | mission | city
const rng = mulberry32(20261124);

let renderer, scene, camera, raycaster;
let camYaw = Math.PI, camPitch = 0.32, camDist = 9;
let shotCamDist = null;
let keys = {};
let dragging = false, lastX = 0, lastY = 0;
let clockLast = performance.now();
let bustedT = 0, minimapT = 0, hudT = 0;
let garage = null;

function init() {
  renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  document.getElementById('game').appendChild(renderer.domElement);
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
  raycaster = new T.Raycaster();
  G.scene = scene;
  buildCity(scene);
  makePlayer();
  spawnTraffic(12);
  spawnPeds(30);
  spawnPackages();
  loadGame();
  buildGarage();
  initMinimap();
  bindInput();
  // shot modes: jump straight into a staged scene
  if (SHOT) {
    G.mode = 'playing';
    hideScreens();
    stageShot(SHOT);
  } else {
    G.mode = 'title';
    showScreen('title-screen');
  }
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  requestAnimationFrame(loop);
}

function buildGarage() {
  // Pay 'n Spray in The Docks — repaint + lose the cops for $100.
  const g = new T.Group();
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e3a5e'; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = '#ffd24d'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center';
  ctx.fillText("PAY 'N SPRAY", 256, 62);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const box = new T.Mesh(new T.BoxGeometry(16, 6, 12), new T.MeshStandardMaterial({ color: 0x8a4a3e }));
  box.position.y = 3; box.castShadow = true; box.receiveShadow = true; g.add(box);
  const sign = new T.Mesh(new T.PlaneGeometry(12, 2.4), new T.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 }));
  sign.position.set(0, 5.2, 6.1); g.add(sign);
  const door = new T.Mesh(new T.PlaneGeometry(7, 4.4), new T.MeshStandardMaterial({ color: 0x2c2f36 }));
  door.position.set(0, 2.2, 6.06); g.add(door);
  g.position.set(-186, 0, 62);
  scene.add(g);
  colliders.push({ x0: -194, z0: 55, x1: -178, z1: 69 });
  garage = { x: -186, z: 62, mesh: g };
}

function stageShot(shot) {
  const p = G.player;
  // Roads run at x/z = -227, -157, -87, -17, 53, 123, 193 — stage ON a road, never in a block.
  if (shot === 'cover') {
    // golden-hour drive east along the beach boulevard, water on the right, city on the left
    G.clock = 17.5 * 3600;
    const car = spawnCar(-100, 193, Math.PI / 2, { player: true, model: { name: 'Deportivo', len: 4.2, wid: 2.0, sport: true }, color: 0xc0392b });
    enterCar(car);
    p.car.speed = 16;
    keys.KeyW = true; // keep driving for the shot
    camYaw = Math.PI / 2 + Math.PI; camPitch = 0.22; shotCamDist = 8;
    setObjective('Bahía Azul — drive the boulevard.');
  } else if (shot === 'drive') {
    G.clock = 10 * 3600;
    const car = spawnCar(-17, -100, 0, { player: true, model: { name: 'Deportivo', len: 4.2, wid: 2.0, sport: true }, color: 0x2e86c1 });
    enterCar(car);
    p.car.speed = 18;
    keys.KeyW = true;
    addHeat(30); // one star, a cruiser in pursuit
    camYaw = Math.PI; camPitch = 0.28; shotCamDist = 9;
    setObjective('Bahía Azul — lose the cruiser.');
  } else if (shot === 'mission') {
    G.clock = 15 * 3600;
    startMission(1);
    // stand at the Old Harbor intersection and face the mission marker
    p.x = -157; p.z = -157;
    const tgt = G.mission.target;
    const dx = tgt.x - p.x, dz = tgt.z - p.z;
    p.heading = Math.atan2(dx, dz);
    camYaw = Math.atan2(-dx, -dz); // camera looks toward the target
    camPitch = 0.18; shotCamDist = 9;
  } else if (shot === 'city') {
    G.clock = 12 * 3600;
    p.x = 0; p.z = -150;
    camYaw = 0; camPitch = 0.9; camDist = 90;
  }
  updateDayNight();
  updateHUD();
}

function enterCar(car) {
  const p = G.player;
  p.car = car; p.onFoot = false;
  car.isPlayer = true;
  G.scene.remove(p.mesh);
  G.playerCar = car;
  startEngine();
  sfx('horn');
}
function exitCar() {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.isPlayer = false;
  p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
  p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
  p.heading = car.heading;
  p.onFoot = true; p.car = null;
  p.mesh.position.set(p.x, 0, p.z);
  G.scene.add(p.mesh);
  stopEngine();
  // keep the car parked where it is (it stays in G.cars as traffic-like)
  car.targetSpeed = 0;
}

function bindInput() {
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyE' && G.mode === 'playing') {
      const p = G.player;
      if (p.onFoot) {
        const car = nearestCar(p.x, p.z, 4.5);
        if (car) { enterCar(car); sfx('pickup'); }
      } else exitCar();
    }
    if (e.code === 'KeyM' && G.mode === 'playing') startNextMission();
    if (e.code === 'KeyN' && G.mode === 'playing') {
      const i = G.missionsDone.length % RACES.length;
      startRace(i);
    }
    if (e.code === 'KeyT' && G.mode === 'playing') startTaxi();
    if (e.code === 'KeyQ' && G.mode === 'playing') switchLead();
    if (e.code === 'KeyG' && G.mode === 'playing') toggleRadio();
    if (e.code === 'KeyH' && G.mode === 'playing' && G.player.car) sfx('horn');
    if (e.code === 'Space' && G.mode === 'playing') { e.preventDefault(); useAbility(); }
    if (e.code === 'Digit1') G.player.weapon = 'pistol';
    if (e.code === 'Digit2') G.player.weapon = 'smg';
    if (e.code === 'Digit3') G.player.weapon = 'rifle';
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (G.mode === 'playing') { G.mode = 'paused'; showScreen('pause-screen'); }
      else if (G.mode === 'paused') { G.mode = 'playing'; hideScreens(); }
    }
    if (e.code === 'Enter' && G.mode === 'title') startGame();
    if (e.code === 'Enter' && (G.mode === 'wasted' || G.mode === 'busted')) respawn();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('mousedown', e => {
    if (e.target.closest('button') || e.target.closest('.screen')) return;
    if (G.mode !== 'playing') return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    shoot();
  });
  addEventListener('mousemove', e => {
    if (!dragging) return;
    camYaw -= (e.clientX - lastX) * 0.005;
    camPitch = clamp(camPitch + (e.clientY - lastY) * 0.004, 0.08, 1.1);
    lastX = e.clientX; lastY = e.clientY;
  });
  addEventListener('mouseup', () => { dragging = false; });
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.action;
      if (a === 'start') startGame();
      if (a === 'resume') { G.mode = 'playing'; hideScreens(); }
      if (a === 'respawn') respawn();
      if (a === 'restart') { location.reload(); }
    });
  });
}

function startGame() {
  audioReady();
  G.mode = 'playing';
  hideScreens();
  setObjective('Welcome to Bahía Azul — press M for your first job.');
  startRadioOnce();
}
let radioStarted = false;
function startRadioOnce() {
  if (radioStarted) return; radioStarted = true;
  toggleRadio();
}
function switchLead() {
  const p = G.player;
  if (p.abilityCd > 0) return;
  G.lead = (G.lead + 1) % 2;
  p.abilityCd = 2;
  setObjective(`Now playing ${G.leads[G.lead].name} — ${G.leads[G.lead].ability}.`);
  // recolour the player mesh stripe
  p.mesh.children.forEach(c => { if (c.geometry && c.geometry.type === 'CylinderGeometry') c.material.color.set(G.leads[G.lead].color); });
  sfx('pickup');
}
function useAbility() {
  const p = G.player;
  if (p.abilityCd > 0 || p.abilityActive) return;
  const lead = G.leads[G.lead];
  p.abilityActive = true;
  p.abilityT = lead.id === 'luz' ? 5 : 4;
  p.abilityCd = 18;
  if (lead.id === 'luz') {
    // Focus: slow motion for 5 seconds
    G.timeScale = 0.35;
    setTimeout(() => { G.timeScale = 1; }, 5000);
    setObjective('FOCUS — time slows. Make every shot count.');
  } else {
    // Nitro: burst of speed in the car
    if (p.car) p.car.speed = Math.min(p.car.speed + 14, p.car.maxSpeed * 1.6);
    setObjective('NITRO — full send!');
  }
  sfx('pickup');
}

function shoot() {
  const p = G.player;
  if (!p || !p.onFoot) return;
  if (p.shootCd > 0) return;
  const w = p.weapon;
  if (p.ammo[w] <= 0) { sfx('punch'); return; }
  p.ammo[w]--;
  p.shooting = true;
  p.shootCd = w === 'smg' ? 0.12 : w === 'rifle' ? 0.3 : 0.45;
  setTimeout(() => { p.shooting = false; }, 120);
  sfx('shot');
  addHeat(2);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = 70;
  const targets = [];
  for (const e of G.enemies || []) if (e.userData.alive) targets.push(e);
  for (const ped of G.peds) targets.push(ped.mesh);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.ped && !obj.userData.hp) obj = obj.parent;
    // find the group root
    let root = hits[0].object;
    while (root.parent && root.parent !== G.scene) root = root.parent;
    if (root.userData && root.userData.ped) hitPed(root.userData.ped);
    else if (root.userData && root.userData.hp !== undefined) damageEnemy(root, w === 'rifle' ? 60 : w === 'smg' ? 22 : 34);
  }
  // muzzle flash line
  const from = new T.Vector3(p.x, 1.4, p.z);
  const dir = new T.Vector3(); camera.getWorldDirection(dir);
  const to = from.clone().add(dir.multiplyScalar(30));
  const geo = new T.BufferGeometry().setFromPoints([from, to]);
  const line = new T.Line(geo, new T.LineBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0.85 }));
  scene.add(line);
  setTimeout(() => scene.remove(line), 80);
}
function punch() {
  const p = G.player;
  if (!p || p.punchCd > 0) return;
  p.punchCd = 0.6;
  sfx('punch');
  for (const e of G.enemies || []) {
    if (!e.userData.alive) continue;
    if (Math.hypot(e.userData.x - p.x, e.userData.z - p.z) < 2.4) damageEnemy(e, 45);
  }
  for (const ped of [...G.peds]) {
    if (Math.hypot(ped.x - p.x, ped.z - p.z) < 2.2) hitPed(ped);
  }
}

function respawn() {
  const p = G.player;
  p.health = 100; p.armor = 0;
  G.wantedHeat = 0; updateWanted();
  G.cash = Math.max(0, Math.floor(G.cash * 0.9));
  p.x = -186; p.z = 90; p.heading = 0;
  if (p.car) { p.car.isPlayer = false; p.car = null; }
  p.onFoot = true;
  p.mesh.position.set(p.x, 0, p.z);
  if (!G.scene.children.includes(p.mesh)) G.scene.add(p.mesh);
  G.mode = 'playing';
  hideScreens();
  setObjective('Back on your feet — the clinic patched you up. $10% lighter.');
}

function updateCamera(dt) {
  const p = G.player;
  if (G.mode === 'title') {
    const a = G.time * 0.04;
    camera.position.set(Math.sin(a) * 150, 70, Math.cos(a) * 150 - 40);
    camera.lookAt(0, 8, -40);
    return;
  }
  if (SHOT === 'city') {
    camera.position.set(0, 130, -260);
    camera.lookAt(0, 0, -40);
    return;
  }
  const focus = p.car ? p.car : p;
  const heading = p.car ? p.car.heading : camYaw;
  if (p.car) camYaw = angleLerp(camYaw, p.car.heading + Math.PI, Math.min(1, dt * 2.2));
  const dist = p.car ? (shotCamDist || 10.5) : (shotCamDist || 8);
  const h = p.car ? 4.2 : 3.4;
  const tx = focus.x + Math.sin(camYaw) * dist;
  const tz = focus.z + Math.cos(camYaw) * dist;
  camera.position.x = lerp(camera.position.x, tx, Math.min(1, dt * 6));
  camera.position.y = lerp(camera.position.y, h + Math.sin(camPitch) * 4, Math.min(1, dt * 6));
  camera.position.z = lerp(camera.position.z, tz, Math.min(1, dt * 6));
  camera.lookAt(focus.x - Math.sin(camYaw) * 4, 1.6, focus.z - Math.cos(camYaw) * 4);
}

function checkGarage(dt) {
  const p = G.player;
  if (!p.car || !garage) return;
  if (Math.hypot(p.car.x - garage.x, p.car.z - garage.z) < 8) {
    if (G.wanted > 0 && G.cash >= 100) {
      G.cash -= 100;
      G.wantedHeat = 0; updateWanted();
      p.car.mesh.children.forEach(c => {});
      // repaint: recolour the body materials
      const newColor = choice(rng, [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22]);
      p.car.mesh.traverse(o => { if (o.isMesh && o.material && o.material.metalness > 0.4 && o.material.color) o.material.color.set(newColor); });
      setObjective("Pay 'n Spray — fresh paint, clean slate. -$100");
      sfx('cash');
    } else if (G.wanted === 0) {
      setObjective("Pay 'n Spray — come back when the law is on you.");
    }
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - clockLast) / 1000);
  clockLast = now;
  G.time += dt;
  dt *= (G.timeScale || 1);
  if (G.mode === 'playing') {
    const input = {
      w: keys.KeyW || keys.ArrowUp, s: keys.KeyS || keys.ArrowDown,
      a: keys.KeyA || keys.ArrowLeft, d: keys.KeyD || keys.ArrowRight,
      shift: keys.ShiftLeft || keys.ShiftRight,
    };
    const p = G.player;
    if (p.onFoot) {
      // camera-relative movement
      const fwd = (input.w ? 1 : 0) - (input.s ? 1 : 0);
      const strafe = (input.d ? 1 : 0) - (input.a ? 1 : 0);
      if (fwd || strafe) {
        const mx = Math.sin(camYaw) * -fwd + Math.cos(camYaw) * -strafe * -1;
        // forward is away from the camera: -sin/-cos of camYaw
        const dx = -Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
        const dz = -Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
        const len = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / len, dz / len);
        p.speed = lerp(p.speed, input.shift ? 8.5 : 4.6, Math.min(1, dt * 10));
        const nx = p.x + Math.sin(p.heading) * p.speed * dt;
        const nz = p.z + Math.cos(p.heading) * p.speed * dt;
        const fixed = collide(nx, nz, 0.7);
        p.x = fixed.x; p.z = fixed.z;
        p.walkPhase += dt * p.speed * 1.6;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
        const u = p.mesh.userData;
        const s2 = Math.sin(p.walkPhase) * 0.55 * clamp(p.speed / 5, 0, 1);
        u.legL.rotation.x = s2; u.legR.rotation.x = -s2; u.armL.rotation.x = -s2 * 0.8; u.armR.rotation.x = s2 * 0.8;
        G.stats.distance += p.speed * dt;
      } else {
        p.speed = lerp(p.speed, 0, Math.min(1, dt * 10));
      }
      if (p.abilityCd > 0) p.abilityCd -= dt;
      if (p.abilityActive) { p.abilityT -= dt; if (p.abilityT <= 0) p.abilityActive = false; }
      if (p.shootCd > 0) p.shootCd -= dt;
      if (p.punchCd > 0) p.punchCd -= dt;
      if (keys.KeyV) punch();
    } else if (p.car) {
      updateCar(p.car, dt, input);
      p.x = p.car.x; p.z = p.car.z;
      updateEngine(p.car.speed);
      checkGarage(dt);
      if (keys.KeyV) punch();
    }
    // traffic + peds + police + missions
    for (const car of [...G.cars]) if (car.isTraffic) updateCar(car, dt, null);
    updatePeds(dt);
    updateCops(dt);
    updateRoadblock(dt);
    updateMission(dt);
    updateRace(dt);
    updateTaxi(dt);
    updatePackages();
    update(dt);
    // wasted / busted
    if (p.health <= 0 && G.mode === 'playing') { G.mode = 'wasted'; showScreen('wasted-screen'); sfx('siren'); }
    if (G.wanted >= 3 && p.onFoot) {
      let near = false;
      for (const cop of G.cops) if (Math.hypot(cop.x - p.x, cop.z - p.z) < 3.5) near = true;
      bustedT = near ? bustedT + dt : 0;
      if (bustedT > 3) { G.mode = 'busted'; showScreen('busted-screen'); }
    } else bustedT = 0;
    // HUD + minimap (throttled)
    hudT += dt; minimapT += dt;
    if (hudT > 0.12) { hudT = 0; updateHUD(); }
    if (minimapT > 0.15) { minimapT = 0; drawMinimap(); }
  } else if (G.mode === 'title') {
    update(dt);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  if (!window.__BAHIA_READY__ && G.mode === 'playing') window.__BAHIA_READY__ = true;
}

init();
