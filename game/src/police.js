// Bahía Azul — police: the wanted system, pursuit, PIT, roadblocks, helicopter.
import { G, mulberry32, rand, clamp, lerp, angleLerp } from './state.js';
import { spawnCar, updateCar } from './vehicles.js';
import { collide } from './city.js';

const T = window.THREE;
const rng = mulberry32(99);

export function addHeat(n) {
  G.wantedHeat = clamp(G.wantedHeat + n, 0, 100);
  updateWanted();
}
export function updateWanted() {
  const h = G.wantedHeat;
  const want = h < 8 ? 0 : h < 26 ? 1 : h < 48 ? 2 : h < 68 ? 3 : h < 88 ? 4 : 5;
  if (want !== G.wanted) {
    G.wanted = want;
    if (want > 0) ensureCops();
  }
}
function ensureCops() {
  const want = G.wanted;
  const target = want === 0 ? 0 : want <= 2 ? 2 : want === 3 ? 3 : 4;
  while (G.cops.length < target) spawnCop();
}
function spawnCop() {
  const p = G.player;
  const a = rand(rng, 0, Math.PI * 2);
  const d = rand(rng, 45, 70);
  const x = clamp(p.x + Math.cos(a) * d, -230, 230);
  const z = clamp(p.z + Math.sin(a) * d, -230, 130);
  const car = spawnCar(x, z, rand(rng, 0, Math.PI * 2), { police: true, model: { name: 'Cruiser', len: 4.6, wid: 2.0, sport: false } });
  car.maxSpeed = 30 + G.wanted * 1.5;
  car.targetSpeed = car.maxSpeed;
  G.cops.push(car);
  return car;
}

export function updateCops(dt) {
  const p = G.player;
  // decay heat when no cop can see the player
  let seen = false;
  for (const cop of G.cops) {
    const d2 = (cop.x - p.x) ** 2 + (cop.z - p.z) ** 2;
    if (d2 < 60 * 60) seen = true;
  }
  if (!seen && G.wanted > 0) {
    G.wantedHeat = Math.max(0, G.wantedHeat - dt * 4);
    updateWanted();
  }
  // remove cops when wanted clears
  if (G.wanted === 0) {
    for (const cop of G.cops.splice(0)) {
      G.scene.remove(cop.mesh);
      G.cars = G.cars.filter(c => c !== cop);
    }
    if (G.heli) { G.scene.remove(G.heli.mesh); G.heli = null; }
    return;
  }
  for (const cop of [...G.cops]) {
    const dx = p.x - cop.x, dz = p.z - cop.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    cop.heading = angleLerp(cop.heading, wantHeading, Math.min(1, dt * 1.6));
    // PIT: at close range and high wanted, shove the player's car sideways
    const targetSpeed = dist > 26 ? cop.maxSpeed : cop.maxSpeed * 0.85;
    cop.speed = lerp(cop.speed, targetSpeed, dt * 0.8);
    const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
    const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
    const fixed = collide(nx, nz, 2.1);
    cop.x = fixed.x; cop.z = fixed.z;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    for (const w of cop.mesh.userData.wheels) w.rotation.x += cop.speed * dt * 2.4;
    if (cop.mesh.userData.lightBar) {
      const ph = (G.time * 6) % 2;
      cop.mesh.userData.lightBar.children[0].material.emissiveIntensity = ph < 1 ? 2.2 : 0.15;
      cop.mesh.userData.lightBar.children[1].material.emissiveIntensity = ph < 1 ? 0.15 : 2.2;
    }
    // ram / bust the player
    if (dist < 3.2) {
      if (p.onFoot) {
        p.health -= 14 * dt;
        if (p.health <= 0) { p.health = 0; }
      } else if (p.car) {
        p.car.speed *= (1 - dt * 0.7);
        p.health -= 3 * dt;
      }
    }
  }
  // roadblocks at 3+ stars: a line of cop cars across the road ahead
  if (G.wanted >= 3 && !G.roadblock && G.time % 1 < dt) {
    placeRoadblock();
  }
  // helicopter at 4+ stars
  if (G.wanted >= 4 && !G.heli) spawnHeli();
  if (G.heli) updateHeli(dt);
}

let roadblockTimer = 0;
function placeRoadblock() {
  const p = G.player;
  const a = p.car ? p.car.heading : p.heading;
  const bx = p.x + Math.sin(a) * 46, bz = p.z + Math.cos(a) * 46;
  if (Math.abs(bx) > 225 || Math.abs(bz) > 125) return;
  const px = Math.cos(a), pz = -Math.sin(a);
  for (let i = -1; i <= 1; i++) {
    const car = spawnCar(bx + px * i * 5, bz + pz * i * 5, a + Math.PI / 2, { police: true, model: { name: 'Cruiser', len: 4.6, wid: 2.0, sport: false } });
    car.targetSpeed = 0; car.speed = 0;
    G.cops.push(car);
  }
  G.roadblock = { x: bx, z: bz, t: 0 };
  roadblockTimer = 14;
}
export function updateRoadblock(dt) {
  if (!G.roadblock) return;
  G.roadblock.t += dt;
  if (G.roadblock.t > 20) {
    G.roadblock = null;
  }
}

function spawnHeli() {
  const g = new T.Group();
  const bodyMat = new T.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.4 });
  const body = new T.Mesh(new T.BoxGeometry(3.2, 1.6, 6.4), bodyMat);
  body.castShadow = true; g.add(body);
  const glass = new T.Mesh(new T.BoxGeometry(2.8, 1.0, 2.2),
    new T.MeshStandardMaterial({ color: 0x1a2e3e, metalness: 0.9, roughness: 0.1 }));
  glass.position.set(0, 0.3, 2.2); g.add(glass);
  const tail = new T.Mesh(new T.BoxGeometry(0.7, 0.7, 5.4), bodyMat);
  tail.position.set(0, 0.3, -5.4); g.add(tail);
  const rotor = new T.Group();
  const blade = new T.Mesh(new T.BoxGeometry(11, 0.08, 0.5), new T.MeshStandardMaterial({ color: 0x222222 }));
  rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
  rotor.position.y = 1.3; g.add(rotor);
  const spotMat = new T.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false });
  const spot = new T.Mesh(new T.ConeGeometry(7, 42, 14, 1, true), spotMat);
  spot.position.y = -21; spot.rotation.x = Math.PI; g.add(spot);
  const light = new T.PointLight(0xfff2b8, 1.4, 60);
  light.position.y = -2; g.add(light);
  const p = G.player;
  g.position.set(p.x + 20, 42, p.z - 20);
  g.userData = { rotor, spot };
  G.scene.add(g);
  G.heli = { mesh: g, x: g.position.x, z: g.position.z, rotor };
}

function updateHeli(dt) {
  const h = G.heli, p = G.player;
  h.mesh.userData.rotor.rotation.y += dt * 22;
  const tx = p.x + Math.sin(G.time * 0.4) * 12, tz = p.z + Math.cos(G.time * 0.33) * 12;
  h.x = lerp(h.x, tx, dt * 0.7); h.z = lerp(h.z, tz, dt * 0.7);
  h.mesh.position.set(h.x, 42 + Math.sin(G.time * 1.3) * 1.5, h.z);
  h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
  // the spotlight pins the player: heat rises while it watches
  G.wantedHeat = clamp(G.wantedHeat + dt * 1.2, 0, 100);
}
