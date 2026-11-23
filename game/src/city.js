// Bahía Azul — the city: ground, buildings, props, beach, pier, lighthouse, sky, water.
// Visual polish is the point: textured facades, varied rooflines, props, day/night light.
import { G, WORLD, DISTRICTS, districtAt, mulberry32, rand, randInt, choice, clamp } from './state.js';

const T = window.THREE;
export const colliders = [];   // {x0,z0,x1,z1} building/prop footprints
const rng = mulberry32(20261124);
let sunLight, hemi, skyMesh, waterMat, cloudGroup, lampMats = [], windowMats = [], beacon;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

// --- facade textures: stucco, pastel, brick, glass, tiled ---
const PALETTES = [
  { base: '#e8c9a0', trim: '#b98d5f', win: '#2e4a66' },
  { base: '#f2e3c8', trim: '#c9a06a', win: '#33506e' },
  { base: '#d9a08a', trim: '#a86a52', win: '#27435e' },
  { base: '#a8c8d8', trim: '#6a9ab0', win: '#1e3a52' },
  { base: '#c8b8d8', trim: '#8a6aa8', win: '#2c3a5e' },
  { base: '#b8d0a8', trim: '#7a9a68', win: '#2a4a3a' },
  { base: '#c07868', trim: '#8a4a3e', win: '#22384e' },
  { base: '#e8d8b0', trim: '#b09a68', win: '#3a5068' },
];
function facadeTexture(p, floors, lit) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = p.base; g.fillRect(0, 0, w, h);
    // subtle vertical grime gradient
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)'); grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // ground floor: shopfront / door + awning
    g.fillStyle = p.trim; g.fillRect(0, h - 34, w, 34);
    g.fillStyle = lit ? '#ffd98a' : '#3a2e22'; g.fillRect(10, h - 30, 34, 26);
    g.fillStyle = '#241a12'; g.fillRect(84, h - 30, 30, 26);
    g.fillStyle = '#e86a5a'; g.fillRect(6, h - 40, 116, 6); // awning stripe
    g.fillStyle = '#f2e3c8'; for (let x = 6; x < 122; x += 14) g.fillRect(x, h - 40, 7, 6);
    // window grid
    const rows = floors, cols = 4, ww = 22, wh = 26, gx = 14, gy = 14;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gx + c * (ww + 8), y = 12 + r * ((h - 60) / rows);
        const isLit = rng() < 0.28;
        g.fillStyle = '#20242c'; g.fillRect(x - 2, y - 2, ww + 4, wh + 4);
        g.fillStyle = isLit ? '#ffd98a' : p.win;
        g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, ww, 4);
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.strokeRect(x + 0.5, y + 0.5, ww, wh);
      }
    }
    // cornice
    g.fillStyle = p.trim; g.fillRect(0, 0, w, 8);
  });
}
function roofTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#7a6a58'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8a7a68';
    for (let i = 0; i < 40; i++) g.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), 3, 3);
  });
}

function groundTexture() {
  const S = 2048, s = S / WORLD.size;
  return canvasTex(S, S, (g) => {
    // base: warm asphalt-block ground
    g.fillStyle = '#8a8a7a'; g.fillRect(0, 0, S, S);
    // blocks (grass / plaza tones)
    for (let bx = 0; bx < 7; bx++) for (let bz = 0; bz < 7; bz++) {
      const x = (bx * 70 + 26) * s, z = (bz * 70 + 26) * s, w = 44 * s;
      const d = DISTRICTS.find(dd => (bx * 70 + 48) >= dd.x0 && (bx * 70 + 48) < dd.x1 && (bz * 70 + 48) >= dd.z0 && (bz * 70 + 48) < dd.z1);
      g.fillStyle = d ? '#' + d.color.toString(16).padStart(6, '0') : '#7a7a6a';
      g.fillRect(x, z, w, w);
      // sidewalk border
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3;
      g.strokeRect(x + 2, z + 2, w - 4, w - 4);
    }
    // roads
    g.fillStyle = '#33363e';
    for (let i = 0; i < 7; i++) {
      const p = (i * 70 + 13) * s, w = 26 * s;
      g.fillRect(p - w / 2, 0, w, S); g.fillRect(0, p - w / 2, S, w);
      // centre dashes
      g.fillStyle = '#e8d44d';
      for (let d = 0; d < S; d += 46) { g.fillRect(p - 2, d, 4, 22); g.fillRect(d, p - 2, 22, 4); }
      g.fillStyle = '#33363e';
    }
    // beach strip (south, z 140..240)
    const bz0 = (140 + 240) * s, bz1 = S;
    const sand = g.createLinearGradient(0, bz0, 0, bz1);
    sand.addColorStop(0, '#e8d5a0'); sand.addColorStop(1, '#d9c088');
    g.fillStyle = sand; g.fillRect(0, bz0, S, bz1 - bz0);
    // wet sand + foam line
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, bz1 - 14, S, 8);
    // plaza circle in La Plaza
    g.fillStyle = '#c9b896'; g.beginPath(); g.arc(0 * s + S / 2, (-150 + 240) * s, 30 * s, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a7a5a'; g.lineWidth = 4; g.beginPath(); g.arc(S / 2, 90 * s, 30 * s, 0, Math.PI * 2); g.stroke();
  });
}

function makeBuilding(x, z, w, d, hgt, floors) {
  const p = choice(rng, PALETTES);
  const tex = facadeTexture(p, floors, rng() < 0.5);
  const side = new T.MeshLambertMaterial({ map: tex });
  const roof = new T.MeshLambertMaterial({ map: roofTexture() });
  const geo = new T.BoxGeometry(w, hgt, d);
  const mesh = new T.Mesh(geo, [side, side, roof, roof, side, side]);
  mesh.position.set(x, hgt / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  // rooftop furniture: parapet + AC box / water tank, varied rooflines
  const par = new T.Mesh(new T.BoxGeometry(w + 0.6, 0.9, d + 0.6),
    new T.MeshLambertMaterial({ color: p.trim }));
  par.position.set(x, hgt + 0.45, z); par.castShadow = true;
  const group = new T.Group(); group.add(mesh, par);
  const r = rng();
  if (r < 0.4) {
    const ac = new T.Mesh(new T.BoxGeometry(2.4, 1.2, 2.4), new T.MeshLambertMaterial({ color: 0x9a9a92 }));
    ac.position.set(x + rand(rng, -w / 4, w / 4), hgt + 1.5, z + rand(rng, -d / 4, d / 4)); ac.castShadow = true; group.add(ac);
  } else if (r < 0.7) {
    const tank = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 2.6, 10), new T.MeshLambertMaterial({ color: 0x7a5a3a }));
    tank.position.set(x + rand(rng, -w / 4, w / 4), hgt + 2.2, z + rand(rng, -d / 4, d / 4)); tank.castShadow = true; group.add(tank);
  } else {
    const sign = new T.Mesh(new T.BoxGeometry(0.5, 3.2, 6), new T.MeshLambertMaterial({ color: 0x2e4a66, emissive: 0x223344 }));
    sign.position.set(x + w / 2 + 0.4, hgt - 2, z); group.add(sign);
  }
  colliders.push({ x0: x - w / 2 - 0.4, z0: z - d / 2 - 0.4, x1: x + w / 2 + 0.4, z1: z + d / 2 + 0.4 });
  return group;
}

function makePalm(x, z, s = 1) {
  const g = new T.Group();
  const trunk = new T.Mesh(new T.CylinderGeometry(0.22 * s, 0.34 * s, 5.4 * s, 7),
    new T.MeshLambertMaterial({ color: 0x8a6a44 }));
  trunk.position.y = 2.7 * s; trunk.rotation.z = rand(rng, -0.08, 0.08); trunk.castShadow = true; g.add(trunk);
  const frondMat = new T.MeshLambertMaterial({ color: 0x2e7d32, side: T.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const f = new T.Mesh(new T.ConeGeometry(0.55 * s, 3.4 * s, 4), frondMat);
    const a = (i / 7) * Math.PI * 2;
    f.position.set(Math.cos(a) * 1.1 * s, 5.6 * s, Math.sin(a) * 1.1 * s);
    f.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); f.castShadow = true; g.add(f);
  }
  const nuts = new T.Mesh(new T.SphereGeometry(0.3 * s, 8, 6), new T.MeshLambertMaterial({ color: 0x6a4a22 }));
  nuts.position.y = 5.2 * s; g.add(nuts);
  g.position.set(x, 0, z);
  return g;
}
function makeStreetlight(x, z) {
  const g = new T.Group();
  const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 6.4, 8), new T.MeshLambertMaterial({ color: 0x2c2f36 }));
  pole.position.y = 3.2; pole.castShadow = true; g.add(pole);
  const arm = new T.Mesh(new T.BoxGeometry(2.2, 0.12, 0.12), new T.MeshLambertMaterial({ color: 0x2c2f36 }));
  arm.position.set(1.0, 6.3, 0); g.add(arm);
  const lampMat = new T.MeshLambertMaterial({ color: 0x444444, emissive: 0xffd98a, emissiveIntensity: 0.2 });
  lampMats.push(lampMat);
  const lamp = new T.Mesh(new T.SphereGeometry(0.32, 10, 8), lampMat);
  lamp.position.set(2.1, 6.2, 0); g.add(lamp);
  const cone = new T.Mesh(new T.ConeGeometry(2.6, 6.2, 16, 1, true),
    new T.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.0, side: T.DoubleSide, depthWrite: false }));
  cone.position.set(2.1, 3.1, 0); cone.userData.isLightCone = true; g.add(cone);
  g.position.set(x, 0, z);
  return g;
}
function makeBillboard(x, z, ry, lines, bg) {
  const tex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#ffffff'; g.font = 'bold 34px Arial'; g.textAlign = 'center';
    lines.forEach((ln, i) => g.fillText(ln, w / 2, 52 + i * 38));
  });
  const g = new T.Group();
  const post = new T.Mesh(new T.BoxGeometry(0.6, 7, 0.6), new T.MeshLambertMaterial({ color: 0x3a3a3a }));
  post.position.y = 3.5; g.add(post);
  const board = new T.Mesh(new T.BoxGeometry(10, 5, 0.4),
    new T.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
  board.position.y = 9; board.castShadow = true; g.add(board);
  g.position.set(x, 0, z); g.rotation.y = ry;
  colliders.push({ x0: x - 0.6, z0: z - 0.6, x1: x + 0.6, z1: z + 0.6 });
  return g;
}

export function buildCity(scene) {
  G.scene = scene;
  scene.fog = new T.Fog(0xbfd9e8, 180, 700);
  // ground
  const ground = new T.Mesh(new T.PlaneGeometry(WORLD.size, WORLD.size),
    new T.MeshLambertMaterial({ map: groundTexture() }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // ocean (south + west, big, animated)
  waterMat = new T.MeshPhongMaterial({ color: 0x1e6f8e, shininess: 120, specular: 0x99ccff, transparent: true, opacity: 0.94 });
  const water = new T.Mesh(new T.PlaneGeometry(1400, 700), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.6, 560);
  scene.add(water);
  const waterW = new T.Mesh(new T.PlaneGeometry(700, 1400), waterMat.clone());
  waterW.rotation.x = -Math.PI / 2; waterW.position.set(-560, -0.6, 0);
  scene.add(waterW);
  // sky dome (gradient via vertex colors)
  const skyGeo = new T.SphereGeometry(900, 24, 12);
  const cols = [], pos = skyGeo.attributes.position;
  const top = new T.Color(0x3a7bd5), mid = new T.Color(0x9ec8e8), bot = new T.Color(0xf2c98a);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 900;
    const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(bot, 1 - (y + 0.1) / 0.35);
    cols.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  skyMesh = new T.Mesh(skyGeo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false }));
  scene.add(skyMesh);
  // sun + clouds
  const sun = new T.Mesh(new T.CircleGeometry(26, 24), new T.MeshBasicMaterial({ color: 0xfff2c8, fog: false }));
  sun.position.set(420, 320, -500); sun.lookAt(0, 0, 0); sun.name = 'sun'; scene.add(sun);
  cloudGroup = new T.Group();
  for (let i = 0; i < 14; i++) {
    const cl = new T.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new T.Mesh(new T.SphereGeometry(rand(rng, 8, 18), 10, 8),
        new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }));
      puff.position.set(rand(rng, -16, 16), rand(rng, -2, 2), rand(rng, -6, 6)); puff.scale.y = 0.45; cl.add(puff);
    }
    cl.position.set(rand(rng, -600, 600), rand(rng, 180, 320), rand(rng, -600, 400));
    cloudGroup.add(cl);
  }
  scene.add(cloudGroup);
  // lights
  hemi = new T.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.85); scene.add(hemi);
  sunLight = new T.DirectionalLight(0xffe8b8, 1.5);
  sunLight.position.set(180, 260, 120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260; sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260; sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 800; sunLight.shadow.bias = -0.0004;
  scene.add(sunLight); scene.add(sunLight.target);
  // buildings on every block
  for (let bx = 0; bx < 7; bx++) for (let bz = 0; bz < 6; bz++) {
    const cx = -240 + bx * 70 + 48, cz = -240 + bz * 70 + 48;
    const downtown = (bx >= 2 && bx <= 4 && bz >= 1 && bz <= 3);
    const n = downtown ? randInt(rng, 2, 3) : randInt(rng, 1, 2);
    for (let k = 0; k < n; k++) {
      const w = rand(rng, 14, 26), d = rand(rng, 14, 26);
      const x = cx + rand(rng, -10, 10), z = cz + rand(rng, -10, 10);
      const floors = downtown ? randInt(rng, 4, 8) : randInt(rng, 2, 5);
      scene.add(makeBuilding(x, z, w, d, floors * 3.4 + 2, floors));
    }
  }
  // beach props: palms, umbrellas, pier, lighthouse
  for (let i = 0; i < 26; i++) scene.add(makePalm(rand(rng, -230, 230), rand(rng, 150, 225), rand(rng, 0.8, 1.3)));
  for (let i = 0; i < 6; i++) {
    const ux = rand(rng, -200, 200), uz = rand(rng, 170, 215);
    const um = new T.Mesh(new T.ConeGeometry(3.2, 1.6, 10), new T.MeshLambertMaterial({ color: choice(rng, [0xff6a5a, 0x4da6ff, 0xffd24d, 0x7dd36a]) }));
    um.position.set(ux, 3.4, uz); um.castShadow = true; scene.add(um);
    const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 3.4, 6), new T.MeshLambertMaterial({ color: 0x8a6a44 }));
    pole.position.set(ux, 1.7, uz); scene.add(pole);
  }
  // pier (south, extends into the water)
  const pier = new T.Group();
  for (let i = 0; i < 22; i++) {
    const plank = new T.Mesh(new T.BoxGeometry(7, 0.5, 4.4), new T.MeshLambertMaterial({ color: 0x9a7a52 }));
    plank.position.set(0, 1.2, 242 + i * 4.4); plank.castShadow = true; plank.receiveShadow = true; pier.add(plank);
  }
  for (let i = 0; i < 12; i++) {
    const post = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 3.4, 8), new T.MeshLambertMaterial({ color: 0x6a4a2e }));
    post.position.set(i % 2 === 0 ? -3.4 : 3.4, 0.4, 242 + i * 8); pier.add(post);
  }
  scene.add(pier);
  // lighthouse (west end of the beach)
  const lh = new T.Group();
  const lhTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c03a2e'; g.fillRect(0, 18, w, 22); g.fillRect(0, 62, w, 22); g.fillRect(0, 106, w, 22);
  });
  const tower = new T.Mesh(new T.CylinderGeometry(3.2, 4.6, 26, 14), new T.MeshLambertMaterial({ map: lhTex }));
  tower.position.y = 13; tower.castShadow = true; lh.add(tower);
  const lampRoom = new T.Mesh(new T.CylinderGeometry(2.6, 2.6, 3.4, 12),
    new T.MeshLambertMaterial({ color: 0x222831, emissive: 0xffe9a8, emissiveIntensity: 0.7 }));
  lampRoom.position.y = 27.4; lh.add(lampRoom);
  const beamMat = new T.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false });
  beacon = new T.Mesh(new T.ConeGeometry(9, 60, 16, 1, true), beamMat);
  beacon.rotation.z = Math.PI / 2; beacon.position.set(30, 27.4, 0); lh.add(beacon);
  lh.position.set(-216, 0, 214); scene.add(lh);
  colliders.push({ x0: -221, z0: 209, x1: -211, z1: 219 });
  // streetlights along every road
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const rx = -240 + i * 70 + 13, rz = -240 + j * 70 + 13;
    if (rz > 120) continue;
    scene.add(makeStreetlight(rx + 12, rz - 2));
  }
  // billboards
  scene.add(makeBillboard(-60, -128, 0.4, ['BAHÍA AZUL', 'VISIT THE BAY'], '#1e6f8e'));
  scene.add(makeBillboard(150, 40, -0.9, ['CASINO', 'ESTRELLA'], '#7a2e5e'));
  scene.add(makeBillboard(-150, 90, 1.2, ['TACOS', 'EL FARO'], '#c05a1e'));
  // plaza fountain (La Plaza centre)
  const fountain = new T.Group();
  const basin = new T.Mesh(new T.CylinderGeometry(7, 7.6, 1.4, 20), new T.MeshLambertMaterial({ color: 0xb8a888 }));
  basin.position.y = 0.7; basin.castShadow = true; basin.receiveShadow = true; fountain.add(basin);
  const fwater = new T.Mesh(new T.CylinderGeometry(6.4, 6.4, 0.5, 20),
    new T.MeshPhongMaterial({ color: 0x3a9ac8, shininess: 140, transparent: true, opacity: 0.9 }));
  fwater.position.y = 1.3; fountain.add(fwater);
  const spout = new T.Mesh(new T.CylinderGeometry(0.5, 0.8, 3.2, 10), new T.MeshLambertMaterial({ color: 0x9a8a78 }));
  spout.position.y = 2.6; fountain.add(spout);
  fountain.position.set(0, 0, -150); scene.add(fountain);
  colliders.push({ x0: -8, z0: -158, x1: 8, z1: -142 });
  updateDayNight();
  return { update };
}

export function updateDayNight() {
  if (!sunLight) return;
  const t = (G.clock % 86400) / 86400; // 0..1
  const sunA = (t - 0.25) * Math.PI * 2; // sunrise 06:00, sunset 18:00
  const elev = Math.sin(sunA);
  const isDay = elev > -0.05;
  const dayF = clamp((elev + 0.12) / 0.5, 0, 1);
  sunLight.intensity = 0.25 + 1.35 * dayF;
  sunLight.color.setHSL(0.09, 0.55, 0.5 + 0.25 * dayF);
  sunLight.position.set(Math.cos(sunA) * 260, 60 + elev * 260, 140);
  hemi.intensity = 0.3 + 0.6 * dayF;
  const skyTop = new T.Color().setHSL(0.58, 0.6, isDay ? 0.55 : 0.08);
  const skyBot = new T.Color().setHSL(0.08, 0.7, isDay ? 0.75 : 0.12);
  if (skyMesh) {
    const pos = skyMesh.geometry.attributes.position, cols = skyMesh.geometry.attributes.color;
    const top = skyTop, mid = new T.Color().setHSL(0.55, 0.5, isDay ? 0.72 : 0.14), bot = skyBot;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 900;
      const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(bot, 1 - (y + 0.1) / 0.35);
      cols.setXYZ(i, c.r, c.g, c.b);
    }
    cols.needsUpdate = true;
  }
  G.scene.fog.color.setHSL(0.55, 0.4, isDay ? 0.78 : 0.1);
  const night = 1 - dayF;
  for (const m of lampMats) m.emissiveIntensity = 0.15 + night * 1.6;
  if (beacon) beacon.visible = night > 0.4;
}

export function update(dt) {
  G.clock = (G.clock + dt * 60) % 86400; // 1 real second = 1 game minute
  if (waterMat) { waterMat.map = null; }
  if (cloudGroup) cloudGroup.children.forEach((c, i) => { c.position.x += dt * (1 + (i % 3)); if (c.position.x > 700) c.position.x = -700; });
  if (beacon && beacon.visible) beacon.rotation.y += dt * 0.9;
  updateDayNight();
}

// Circle-vs-AABB push-out for the player and cars. Returns corrected {x,z}.
export function collide(x, z, r) {
  for (const c of colliders) {
    const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1);
    const dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-6) { x = c.x1 + r; continue; }
      const d = Math.sqrt(d2), push = (r - d) / d;
      x += dx * push; z += dz * push;
    }
  }
  return { x: clamp(x, -238, 238), z: clamp(z, -238, 238) };
}
