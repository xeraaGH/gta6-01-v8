// Bahía Azul — people: the player on foot and the pedestrians who live here.
import { G, mulberry32, rand, randInt, choice, clamp, lerp, angleLerp } from './state.js';
import { collide } from './city.js';

const T = window.THREE;
const rng = mulberry32(4242);
const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xfd7e14, 0x1abc9c, 0xecf0f1, 0x34495e, 0xff8fab];
const PANTS = [0x2c3e50, 0x5d6d7e, 0x7e5109, 0x1a1a1a, 0x6c3483];

export function makeHuman(shirt, pants, skin) {
  const g = new T.Group();
  const shirtMat = new T.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsMat = new T.MeshStandardMaterial({ color: pants, roughness: 0.85 });
  const skinMat = new T.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const torso = new T.Mesh(new T.BoxGeometry(0.52, 0.62, 0.3), shirtMat);
  torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
  const head = new T.Mesh(new T.SphereGeometry(0.21, 12, 10), skinMat);
  head.position.y = 1.68; head.castShadow = true; g.add(head);
  const hair = new T.Mesh(new T.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new T.MeshStandardMaterial({ color: choice(rng, [0x1a1a1a, 0x4a2c0a, 0x8a8a8a, 0x2c1810]), roughness: 0.9 }));
  hair.position.y = 1.72; g.add(hair);
  const legL = new T.Mesh(new T.BoxGeometry(0.2, 0.62, 0.22), pantsMat);
  legL.position.set(-0.14, 0.62, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new T.Mesh(new T.BoxGeometry(0.15, 0.58, 0.17), shirtMat);
  armL.position.set(-0.34, 1.2, 0); armL.castShadow = true; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.34; g.add(armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

export function makePlayer() {
  const lead = G.leads[G.lead];
  const mesh = makeHuman(lead.color, 0x222831, 0xd9a066);
  // a jacket stripe in the lead's colour + a cap
  const stripe = new T.Mesh(new T.BoxGeometry(0.54, 0.1, 0.32),
    new T.MeshStandardMaterial({ color: lead.color, emissive: lead.color, emissiveIntensity: 0.35 }));
  stripe.position.y = 1.38; mesh.add(stripe);
  const cap = new T.Mesh(new T.CylinderGeometry(0.23, 0.23, 0.09, 12),
    new T.MeshStandardMaterial({ color: lead.color, roughness: 0.7 }));
  cap.position.y = 1.86; mesh.add(cap);
  const p = {
    mesh, x: 0, z: -120, heading: Math.PI,
    speed: 0, onFoot: true, car: null,
    weapon: 'pistol', ammo: { pistol: 48, smg: 96, rifle: 48 },
    health: 100, armor: 0,
    abilityCd: 0, abilityActive: false, abilityT: 0,
    walkPhase: 0, shooting: false, shootCd: 0,
    punchCd: 0,
  };
  mesh.position.set(p.x, 0, p.z);
  mesh.userData.player = p;
  G.scene.add(mesh);
  G.player = p;
  return p;
}

export function spawnPeds(n) {
  for (let i = 0; i < n; i++) {
    const mesh = makeHuman(choice(rng, SHIRTS), choice(rng, PANTS), choice(rng, [0xd9a066, 0xb87a4a, 0x8a5a30, 0xe8b88a]));
    const x = rand(rng, -230, 230), z = rand(rng, -230, 130);
    mesh.position.set(x, 0, z);
    const ped = {
      mesh, x, z, heading: rand(rng, 0, Math.PI * 2),
      speed: rand(rng, 1.1, 2.2), walkPhase: rand(rng, 0, 6),
      target: null, flee: false, state: 'walk', waitT: rand(rng, 0, 4),
    };
    mesh.userData.ped = ped;
    G.scene.add(mesh);
    G.peds.push(ped);
  }
}

function animateHuman(mesh, phase, speedF) {
  const u = mesh.userData;
  const s = Math.sin(phase) * 0.55 * speedF;
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8;
}

export function updatePlayer(dt, input) {
  const p = G.player;
  if (!p || !p.onFoot) return;
  const run = input.shift ? 1 : 0;
  const fwd = (input.w ? 1 : 0) - (input.s ? 1 : 0);
  const strafe = (input.d ? 1 : 0) - (input.a ? 1 : 0);
  const top = run ? 8.5 : 4.6;
  let mx = 0, mz = 0;
  if (fwd || strafe) {
    const h = p.heading;
    mx = Math.sin(h) * fwd + Math.cos(h) * strafe;
    mz = Math.cos(h) * fwd - Math.sin(h) * strafe;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    p.heading = Math.atan2(mx, mz);
  }
  p.speed = lerp(p.speed, (fwd || strafe) ? top : 0, Math.min(1, dt * 10));
  const nx = p.x + Math.sin(p.heading) * p.speed * dt;
  const nz = p.z + Math.cos(p.heading) * p.speed * dt;
  const fixed = collide(nx, nz, 0.7);
  p.x = fixed.x; p.z = fixed.z;
  p.walkPhase += dt * p.speed * 1.6;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  animateHuman(p.mesh, p.walkPhase, clamp(p.speed / 5, 0, 1));
  G.stats.distance += p.speed * dt;
  // ability cooldown
  if (p.abilityCd > 0) p.abilityCd -= dt;
  if (p.abilityActive) {
    p.abilityT -= dt;
    if (p.abilityT <= 0) p.abilityActive = false;
  }
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
}

export function updatePeds(dt) {
  for (const ped of G.peds) {
    // flee if a gunshot or a car is close and fast
    let threat = null;
    if (G.player && G.player.shooting) threat = G.player;
    for (const car of G.cars) {
      if (Math.abs(car.speed) > 8) {
        const d2 = (car.x - ped.x) ** 2 + (car.z - ped.z) ** 2;
        if (d2 < 100) threat = car;
      }
    }
    if (threat) {
      const dx = ped.x - threat.x, dz = ped.z - threat.z;
      const len = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(dx / len, dz / len);
      ped.speed = 5.2;
      ped.waitT = 0;
    } else if (ped.waitT > 0) {
      ped.waitT -= dt; ped.speed = lerp(ped.speed, 0, dt * 4);
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 3) {
        ped.target = { x: clamp(ped.x + rand(rng, -40, 40), -232, 232), z: clamp(ped.z + rand(rng, -40, 40), -232, 132) };
        if (rng() < 0.25) ped.waitT = rand(rng, 2, 6);
      }
      const want = Math.atan2(ped.target.x - ped.x, ped.target.z - ped.z);
      ped.heading = angleLerp(ped.heading, want, Math.min(1, dt * 3));
      ped.speed = lerp(ped.speed, 1.6, dt * 2);
    }
    const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
    const fixed = collide(nx, nz, 0.6);
    ped.x = fixed.x; ped.z = fixed.z;
    ped.walkPhase += dt * ped.speed * 1.8;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    animateHuman(ped.mesh, ped.walkPhase, clamp(ped.speed / 2.5, 0, 1));
  }
}

// A hit on a pedestrian: they fall and the wanted level rises.
export function hitPed(ped) {
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.3;
  ped.state = 'down';
  G.peds = G.peds.filter(p => p !== ped);
  setTimeout(() => { G.scene.remove(ped.mesh); }, 4000);
  G.wantedHeat = Math.min(100, G.wantedHeat + 22);
  G.stats.pedsHit++;
}
