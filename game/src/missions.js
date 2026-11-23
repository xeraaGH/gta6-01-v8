// Bahía Azul — missions, street races, taxi fares, hidden packages, district standing.
import { G, MISSIONS, RACES, PACKAGES, DISTRICTS, mulberry32, rand, randInt, choice, clamp } from './state.js';
import { addHeat } from './police.js';

const T = window.THREE;
const rng = mulberry32(31337);
let markerMesh = null, ringMesh = null, enemyGroup = null;

export function districtStanding(name) { return G.standing[name] || 0; }
export function gainStanding(name, n) {
  G.standing[name] = clamp((G.standing[name] || 0) + n, 0, 100);
}

function makeMarker(x, z, color = 0xffd24d) {
  clearMarker();
  const g = new T.Group();
  const beam = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 30, 16, 1, true),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false }));
  beam.position.y = 15; g.add(beam);
  const ring = new T.Mesh(new T.RingGeometry(2.2, 3.1, 24),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  g.position.set(x, 0, z);
  G.scene.add(g);
  markerMesh = g;
  ringMesh = ring;
  return g;
}
function clearMarker() {
  if (markerMesh) { G.scene.remove(markerMesh); markerMesh = null; ringMesh = null; }
}
function missionSpot(district, i) {
  const d = DISTRICTS.find(dd => dd.name === district) || DISTRICTS[0];
  return { x: rand(rng, d.x0 + 20, d.x1 - 20), z: rand(rng, d.z0 + 20, Math.min(d.z1 - 20, 125)) };
}

export function startMission(id) {
  const def = MISSIONS.find(m => m.id === id);
  if (!def || G.missionsDone.includes(id) || G.mission) return false;
  const spot = missionSpot(def.district, id);
  const m = { def, step: 0, t: 0, target: spot, kills: 0, need: def.type === 'combat' ? (id >= 7 ? 6 : 5) : def.type === 'collect' ? (id === 2 ? 3 : 4) : 0, got: 0, crates: [] };
  if (def.type === 'collect') {
    for (let i = 0; i < m.need; i++) {
      const s = missionSpot(def.district, id * 10 + i);
      const crate = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 1.4),
        new T.MeshStandardMaterial({ color: 0xd4a017, emissive: 0x7a5a00, emissiveIntensity: 0.4 }));
      crate.position.set(s.x, 0.7, s.z); crate.castShadow = true;
      G.scene.add(crate);
      m.crates.push({ mesh: crate, x: s.x, z: s.z, got: false });
    }
    m.target = { x: m.crates[0].x, z: m.crates[0].z };
  }
  if (def.type === 'combat' || def.type === 'final') spawnEnemies(m, spot);
  makeMarker(m.target.x, m.target.z);
  G.mission = m;
  setObjective(`${def.name} — ${def.brief}`);
  return true;
}
function spawnEnemies(m, spot) {
  enemyGroup = new T.Group();
  const n = m.need;
  for (let i = 0; i < n; i++) {
    const e = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(0.56, 0.66, 0.32),
      new T.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.8 }));
    body.position.y = 1.18; body.castShadow = true; e.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.21, 10, 8),
      new T.MeshStandardMaterial({ color: 0xc98a5a }));
    head.position.y = 1.68; e.add(head);
    const gun = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 0.7),
      new T.MeshStandardMaterial({ color: 0x111111 }));
    gun.position.set(0.2, 1.25, 0.4); e.add(gun);
    const x = spot.x + rand(rng, -16, 16), z = spot.z + rand(rng, -16, 16);
    e.position.set(x, 0, z);
    e.userData = { hp: 100, x, z, shootCd: rand(rng, 0.5, 1.5), alive: true };
    enemyGroup.add(e);
    m.enemies = m.enemies || [];
    m.enemies.push(e);
  }
  G.scene.add(enemyGroup);
  G.enemies = m.enemies;
}

export function updateMission(dt) {
  const m = G.mission;
  if (!m) return;
  m.t += dt;
  if (ringMesh) ringMesh.scale.setScalar(1 + Math.sin(G.time * 4) * 0.12);
  const p = G.player;
  const d = Math.hypot(p.x - m.target.x, p.z - m.target.z);
  if (m.def.type === 'drive' || m.def.type === 'final') {
    if (d < 5) completeMission();
  } else if (m.def.type === 'collect') {
    for (const c of m.crates) {
      if (!c.got && Math.hypot(p.x - c.x, p.z - c.z) < 3.2) {
        c.got = true; m.got++;
        G.scene.remove(c.mesh);
        setObjective(`${m.def.name} — ${m.got}/${m.need} crates secured`);
        const next = m.crates.find(cc => !cc.got);
        if (next) { m.target = { x: next.x, z: next.z }; makeMarker(next.x, next.z); }
        else completeMission();
      }
    }
  } else if (m.def.type === 'combat' || m.def.type === 'final') {
    // enemies shoot back
    for (const e of m.enemies || []) {
      const u = e.userData;
      if (!u.alive) continue;
      const ed = Math.hypot(p.x - u.x, p.z - u.z);
      e.lookAt(p.x, 1.2, p.z);
      u.shootCd -= dt;
      if (ed < 46 && u.shootCd <= 0) {
        u.shootCd = rand(rng, 0.9, 1.8);
        if (rng() < 0.4) {
          p.health -= 6;
          flashDamage();
        }
        tracer(e.position, p);
      }
      // enemies advance slowly
      if (ed > 14) {
        const a = Math.atan2(p.x - u.x, p.z - u.z);
        u.x += Math.sin(a) * 2.2 * dt; u.z += Math.cos(a) * 2.2 * dt;
        e.position.set(u.x, 0, u.z);
      }
    }
    if (m.kills >= m.need) completeMission();
  }
}
function tracer(from, p) {
  const geo = new T.BufferGeometry().setFromPoints([
    new T.Vector3(from.x, 1.3, from.z), new T.Vector3(p.x, 1.2, p.z)]);
  const line = new T.Line(geo, new T.LineBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  setTimeout(() => G.scene.remove(line), 120);
}
function flashDamage() {
  const el = document.getElementById('damage-flash');
  if (el) { el.style.opacity = '0.45'; setTimeout(() => { el.style.opacity = '0'; }, 140); }
}

export function damageEnemy(enemy, dmg) {
  const u = enemy.userData;
  if (!u.alive) return;
  u.hp -= dmg;
  enemy.children[0].material.emissive = new T.Color(0x881111);
  setTimeout(() => { if (enemy.children[0]) enemy.children[0].material.emissive = new T.Color(0x000000); }, 90);
  if (u.hp <= 0) {
    u.alive = false;
    enemy.rotation.x = -Math.PI / 2; enemy.position.y = 0.3;
    if (G.mission) { G.mission.kills++; setObjective(`${G.mission.def.name} — ${G.mission.kills}/${G.mission.need} Vipers down`); }
    addHeat(6);
    setTimeout(() => { G.scene.remove(enemy); }, 3000);
  }
}

function completeMission() {
  const m = G.mission;
  if (!m) return;
  G.cash += m.def.reward;
  G.missionsDone.push(m.def.id);
  gainStanding(m.def.district, 18);
  clearMarker();
  if (enemyGroup) { G.scene.remove(enemyGroup); enemyGroup = null; G.enemies = []; }
  for (const c of m.crates || []) if (!c.got) G.scene.remove(c.mesh);
  setObjective(`✓ ${m.def.name} complete — $${m.def.reward} earned. ${nextMissionHint()}`);
  G.mission = null;
  G.mode = 'missionEnd';
  setTimeout(() => { if (G.mode === 'missionEnd') G.mode = 'playing'; }, 2600);
  saveGame();
}
function nextMissionHint() {
  const next = MISSIONS.find(mm => !G.missionsDone.includes(mm.id));
  return next ? `Next: ${next.name} (press M).` : 'All missions done — Bahía Azul is yours.';
}
export function startNextMission() {
  const next = MISSIONS.find(mm => !G.missionsDone.includes(mm.id));
  if (next) startMission(next.id);
}

// --- street races ---
export function startRace(i) {
  const def = RACES[i];
  if (!def || G.race) return false;
  const d = DISTRICTS.find(dd => dd.name === def.district);
  const pts = [];
  for (let k = 0; k < 5; k++) pts.push({ x: rand(rng, d.x0 + 20, d.x1 - 20), z: rand(rng, d.z0 + 20, Math.min(d.z1 - 20, 125)) });
  G.race = { def, pts, idx: 0, t: 0, laps: 0 };
  makeMarker(pts[0].x, pts[0].z, 0x4da6ff);
  setObjective(`Race: ${def.name} — hit every checkpoint, ${def.laps} lap(s), $${def.reward}`);
  return true;
}
export function updateRace(dt) {
  const r = G.race;
  if (!r) return;
  r.t += dt;
  const p = G.player;
  const pt = r.pts[r.idx];
  if (Math.hypot(p.x - pt.x, p.z - pt.z) < 6) {
    r.idx++;
    if (r.idx >= r.pts.length) {
      r.idx = 0; r.laps++;
      if (r.laps >= r.def.laps) {
        G.cash += r.def.reward;
        gainStanding(r.def.district, 8);
        setObjective(`✓ ${r.def.name} won — $${r.def.reward} in ${r.t.toFixed(1)}s`);
        clearMarker(); G.race = null; saveGame();
        return;
      }
    }
    makeMarker(r.pts[r.idx].x, r.pts[r.idx].z, 0x4da6ff);
    setObjective(`Race: ${r.def.name} — checkpoint ${r.idx + 1}/${r.pts.length}, lap ${r.laps + 1}/${r.def.laps}`);
  }
}

// --- taxi fares ---
export function startTaxi() {
  const p = G.player;
  if (!p.car || G.taxi) return false;
  const d = DISTRICTS[randInt(rng, 0, 5)];
  const dest = { x: rand(rng, d.x0 + 20, d.x1 - 20), z: rand(rng, d.z0 + 20, Math.min(d.z1 - 20, 125)) };
  G.taxi = { dest, t: 0, fare: randInt(rng, 60, 160) };
  makeMarker(dest.x, dest.z, 0xf7dc6f);
  setObjective(`Taxi fare — drop the passenger in ${d.name} ($${G.taxi.fare})`);
  return true;
}
export function updateTaxi(dt) {
  const t = G.taxi;
  if (!t) return;
  t.t += dt;
  const p = G.player;
  if (!p.car) { setObjective('Taxi fare lost — you left the car.'); clearMarker(); G.taxi = null; return; }
  if (Math.hypot(p.x - t.dest.x, p.z - t.dest.z) < 6) {
    const tip = Math.max(0, 40 - Math.floor(t.t));
    G.cash += t.fare + tip;
    setObjective(`✓ Fare complete — $${t.fare + tip} (tip $${tip})`);
    clearMarker(); G.taxi = null; saveGame();
  }
}

// --- hidden packages ---
export function spawnPackages() {
  const spots = [];
  for (let i = 0; i < PACKAGES; i++) {
    const x = rand(rng, -225, 225), z = rand(rng, -225, 200);
    const pkg = new T.Mesh(new T.BoxGeometry(0.9, 0.9, 0.9),
      new T.MeshStandardMaterial({ color: 0x9b59b6, emissive: 0x6a1b8a, emissiveIntensity: 0.7 }));
    pkg.position.set(x, 0.8, z); pkg.rotation.y = rand(rng, 0, 3);
    G.scene.add(pkg);
    spots.push({ mesh: pkg, x, z, got: false });
  }
  G.pickups = spots;
}
export function updatePackages() {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.got) continue;
    pk.mesh.rotation.y += 0.02;
    if (Math.hypot(p.x - pk.x, p.z - pk.z) < 2.6) {
      pk.got = true; G.scene.remove(pk.mesh);
      G.packagesGot++; G.cash += 250;
      gainStanding('Old Harbor', 1);
      setObjective(`Hidden package ${G.packagesGot}/${PACKAGES} — +$250`);
    }
  }
}

export function setObjective(text) {
  const el = document.getElementById('objective');
  if (el) el.textContent = text;
}

// --- save ---
export function saveGame() {
  try {
    localStorage.setItem('bahia-azul-save', JSON.stringify({
      cash: G.cash, missionsDone: G.missionsDone, standing: G.standing,
      packagesGot: G.packagesGot, lead: G.lead,
    }));
  } catch (e) { /* storage unavailable in some sandboxes */ }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem('bahia-azul-save');
    if (!raw) return false;
    const s = JSON.parse(raw);
    G.cash = s.cash ?? 250; G.missionsDone = s.missionsDone || [];
    G.standing = s.standing || G.standing; G.packagesGot = s.packagesGot || 0;
    G.lead = s.lead ?? 0;
    return true;
  } catch (e) { return false; }
}
