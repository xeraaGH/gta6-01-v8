// Bahía Azul — vehicles: detailed car models, arcade driving, traffic AI.
import { G, mulberry32, rand, randInt, choice, clamp, lerp } from './state.js';
import { collide } from './city.js';

const T = window.THREE;
const rng = mulberry32(777);
const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x5dade2, 0xf1948a, 0x48c9b0, 0xaf7ac5];
const CAR_MODELS = [
  { name: 'Sedán', len: 4.4, wid: 1.9, sport: false },
  { name: 'Deportivo', len: 4.2, wid: 2.0, sport: true },
  { name: 'Camioneta', len: 5.0, wid: 2.1, sport: false },
  { name: 'Taxi', len: 4.4, wid: 1.9, sport: false, taxi: true },
  { name: 'Clásico', len: 4.6, wid: 1.9, sport: false },
];

export function makeCar(color, model, opts = {}) {
  const g = new T.Group();
  const paint = new T.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 });
  const dark = new T.MeshStandardMaterial({ color: 0x14181f, metalness: 0.2, roughness: 0.6 });
  const glass = new T.MeshStandardMaterial({ color: 0x1a2e3e, metalness: 0.9, roughness: 0.12 });
  const L = model.len, W = model.wid;
  // chassis: lower body + hood + trunk shaping
  const body = new T.Mesh(new T.BoxGeometry(W, 0.62, L), paint);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const nose = new T.Mesh(new T.BoxGeometry(W * 0.94, 0.34, 0.7), paint);
  nose.position.set(0, 0.42, L / 2 - 0.2); nose.castShadow = true; g.add(nose);
  const cabin = new T.Mesh(new T.BoxGeometry(W * 0.86, 0.58, L * 0.42), glass);
  cabin.position.set(0, 1.1, -L * 0.06); cabin.castShadow = true; g.add(cabin);
  const roof = new T.Mesh(new T.BoxGeometry(W * 0.8, 0.1, L * 0.36), paint);
  roof.position.set(0, 1.42, -L * 0.06); g.add(roof);
  // bumpers + grille + exhaust
  const bumpF = new T.Mesh(new T.BoxGeometry(W * 0.98, 0.22, 0.18), dark);
  bumpF.position.set(0, 0.34, L / 2 + 0.02); g.add(bumpF);
  const bumpR = bumpF.clone(); bumpR.position.z = -L / 2 - 0.02; g.add(bumpR);
  const grille = new T.Mesh(new T.BoxGeometry(W * 0.6, 0.16, 0.06), dark);
  grille.position.set(0, 0.62, L / 2 + 0.04); g.add(grille);
  // headlights (emissive) + taillights
  const hlMat = new T.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
  const tlMat = new T.MeshStandardMaterial({ color: 0xc02020, emissive: 0x800000, emissiveIntensity: 0.7 });
  for (const sx of [-1, 1]) {
    const hl = new T.Mesh(new T.BoxGeometry(0.42, 0.14, 0.06), hlMat);
    hl.position.set(sx * W * 0.32, 0.66, L / 2 + 0.05); g.add(hl);
    const tl = new T.Mesh(new T.BoxGeometry(0.42, 0.12, 0.06), tlMat);
    tl.position.set(sx * W * 0.32, 0.66, -L / 2 - 0.05); g.add(tl);
    // side mirrors
    const mir = new T.Mesh(new T.BoxGeometry(0.16, 0.1, 0.22), dark);
    mir.position.set(sx * (W / 2 + 0.08), 1.05, L * 0.18); g.add(mir);
  }
  if (model.sport) {
    const spoiler = new T.Mesh(new T.BoxGeometry(W * 0.9, 0.06, 0.5), dark);
    spoiler.position.set(0, 1.08, -L / 2 + 0.15); g.add(spoiler);
    const fin = new T.Mesh(new T.BoxGeometry(0.08, 0.3, 0.4), dark);
    fin.position.set(-W * 0.32, 0.92, -L / 2 + 0.15); g.add(fin);
    const fin2 = fin.clone(); fin2.position.x = W * 0.32; g.add(fin2);
  }
  if (model.taxi) {
    const sign = new T.Mesh(new T.BoxGeometry(0.9, 0.28, 0.4),
      new T.MeshStandardMaterial({ color: 0xf7dc6f, emissive: 0xd4ac0d, emissiveIntensity: 0.5 }));
    sign.position.set(0, 1.55, -L * 0.06); g.add(sign);
  }
  if (opts.police) {
    // black-and-white cruiser + light bar
    body.material = new T.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.4 });
    const door = new T.Mesh(new T.BoxGeometry(W * 0.92, 0.5, L * 0.4),
      new T.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.4, roughness: 0.4 }));
    door.position.set(0, 0.58, 0); g.add(door);
    const bar = new T.Group();
    const red = new T.Mesh(new T.BoxGeometry(0.5, 0.16, 0.3), new T.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 1.5 }));
    red.position.x = -0.3; bar.add(red);
    const blue = new T.Mesh(new T.BoxGeometry(0.5, 0.16, 0.3), new T.MeshStandardMaterial({ color: 0x2020ff, emissive: 0x0000ff, emissiveIntensity: 1.5 }));
    blue.position.x = 0.3; bar.add(blue);
    bar.position.set(0, 1.52, -L * 0.06); bar.userData.flash = true; g.add(bar);
    g.userData.lightBar = bar;
  }
  // wheels with hubs
  const wheels = [];
  const wheelGeo = new T.CylinderGeometry(0.36, 0.36, 0.28, 14);
  const hubGeo = new T.CylinderGeometry(0.18, 0.18, 0.3, 10);
  for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
    const wg = new T.Group();
    const tire = new T.Mesh(wheelGeo, new T.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 }));
    tire.rotation.z = Math.PI / 2; tire.castShadow = true; wg.add(tire);
    const hub = new T.Mesh(hubGeo, new T.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.3 }));
    hub.rotation.z = Math.PI / 2; wg.add(hub);
    wg.position.set(wx, 0.36, wz); g.add(wg); wheels.push(wg);
  }
  g.userData.wheels = wheels;
  g.userData.model = model;
  return g;
}

export function spawnCar(x, z, heading, opts = {}) {
  const model = opts.model || choice(rng, CAR_MODELS);
  const color = opts.color !== undefined ? opts.color : choice(rng, CAR_COLORS);
  const mesh = makeCar(color, model, opts);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  const car = {
    mesh, model, color,
    x, z, heading,
    speed: 0, steer: 0,
    maxSpeed: model.sport ? 34 : 26,
    accel: model.sport ? 16 : 11,
    brake: 26,
    isPlayer: !!opts.player,
    isCop: !!opts.police,
    isTraffic: !opts.player && !opts.police,
    driver: opts.driver || null,
    stuck: 0, targetSpeed: 0,
    health: 100,
  };
  mesh.userData.car = car;
  G.scene.add(mesh);
  G.cars.push(car);
  return car;
}

export function spawnTraffic(n) {
  const roads = [];
  for (let i = 0; i < 7; i++) { roads.push(-240 + i * 70 + 13); }
  for (let i = 0; i < n; i++) {
    const horizontal = rng() < 0.5;
    const road = choice(rng, roads);
    const t = rand(rng, -220, 220);
    const heading = horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = spawnCar(horizontal ? t : road + (rng() < 0.5 ? 5 : -5), horizontal ? road + (rng() < 0.5 ? 5 : -5) : t, heading);
    car.targetSpeed = rand(rng, 9, 15);
    car.speed = car.targetSpeed;
    car.road = road; car.horizontal = horizontal;
  }
}

function roadSnap(car) {
  // keep traffic on its road: steer back toward the road line
  const lane = car.road + (car.horizontal ? 0 : 0);
  const pos = car.horizontal ? car.z : car.x;
  const off = pos - lane;
  return clamp(-off * 0.12, -0.5, 0.5);
}

export function updateCar(car, dt, input) {
  const m = car.mesh;
  if (car.isPlayer && input) {
    const fwd = (input.w ? 1 : 0) - (input.s ? 1 : 0);
    const steerIn = (input.a ? 1 : 0) - (input.d ? 1 : 0);
    const nitro = G.lead === 1 && G.player && G.player.abilityActive;
    const top = car.maxSpeed * (nitro ? 1.55 : 1) * (G.player && G.player.abilityActive && G.lead === 0 ? 0.55 : 1);
    if (fwd > 0) car.speed = Math.min(car.speed + car.accel * dt, top);
    else if (fwd < 0) car.speed = Math.max(car.speed - car.brake * dt, -9);
    else car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - 9 * dt);
    const steerTarget = steerIn * 0.55 * Math.min(1, Math.abs(car.speed) / 8);
    car.steer = lerp(car.steer, steerTarget, Math.min(1, dt * 8));
    car.heading += car.steer * dt * Math.sign(car.speed || 1) * (car.speed >= 0 ? 1 : -1) * 1.4;
  } else if (car.isTraffic) {
    car.speed = lerp(car.speed, car.targetSpeed, dt * 0.5);
    // slow for the car ahead
    for (const o of G.cars) {
      if (o === car || !o.isTraffic) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const ahead = Math.cos(car.heading) * dx + Math.sin(car.heading) * dz;
      const side = Math.abs(-Math.sin(car.heading) * dx + Math.cos(car.heading) * dz);
      if (ahead > 0 && ahead < 9 && side < 2.4) { car.speed = Math.max(0, car.speed - 18 * dt); }
    }
    car.steer = roadSnap(car);
    car.heading += car.steer * dt;
    if (Math.abs(car.x) > 232 || Math.abs(car.z) > 232) {
      car.stuck += dt;
      if (car.stuck > 1) { car.heading += Math.PI; car.stuck = 0; }
    }
  }
  // integrate
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collide(nx, nz, 2.1);
  const hitWall = (fixed.x !== nx || fixed.z !== nz);
  if (hitWall && Math.abs(car.speed) > 6) {
    car.speed *= 0.45;
    if (car.isPlayer) { G.wantedHeat = Math.min(100, G.wantedHeat + 2); }
  }
  car.x = fixed.x; car.z = fixed.z;
  m.position.set(car.x, 0, car.z);
  m.rotation.y = car.heading;
  // wheel spin + body roll
  const spin = car.speed * dt * 2.4;
  for (const w of m.userData.wheels) w.rotation.x += spin;
  m.rotation.z = -car.steer * 0.06;
  if (m.userData.lightBar) {
    const ph = (G.time * 6) % 2;
    m.userData.lightBar.children[0].material.emissiveIntensity = ph < 1 ? 2.2 : 0.15;
    m.userData.lightBar.children[1].material.emissiveIntensity = ph < 1 ? 0.15 : 2.2;
  }
}

export function nearestCar(x, z, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of G.cars) {
    if (c.isCop) continue;
    const d2 = (c.x - x) ** 2 + (c.z - z) ** 2;
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}
