// Bahía Azul — shared game state, constants and utilities.
// Every module imports the live game state G from here; main.js fills it in.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function rand(rng, a, b) { return a + rng() * (b - a); }
export function randInt(rng, a, b) { return Math.floor(rand(rng, a, b + 1)); }
export function choice(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// The city: 6 districts on a 480 x 480 island, ocean on the south and west.
export const WORLD = { size: 480, half: 240, road: 26, block: 44 };
export const DISTRICTS = [
  { name: 'Old Harbor', x0: -240, z0: -240, x1: -80, z1: -60, color: 0x8a6f4d, accent: '#d9a05b' },
  { name: 'La Plaza', x0: -80, z0: -240, x1: 80, z1: -60, color: 0x7d8a5a, accent: '#e8c15a' },
  { name: 'North Beach', x0: 80, z0: -240, x1: 240, z1: -60, color: 0x5a8a8a, accent: '#6fd3d3' },
  { name: 'The Docks', x0: -240, z0: -60, x1: -80, z1: 120, color: 0x6a6a72, accent: '#ff9a4d' },
  { name: 'University Hill', x0: -80, z0: -60, x1: 80, z1: 120, color: 0x5a7d5a, accent: '#9ad36f' },
  { name: 'Palm Heights', x0: 80, z0: -60, x1: 240, z1: 120, color: 0x8a5a6a, accent: '#ff7d9e' },
];
export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return { name: 'Playa Azul', color: 0xc9a86a, accent: '#ffd27d' };
}

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, range: 60, spread: 0.02, mag: 12 },
  smg: { name: 'SMG', damage: 16, rate: 0.09, range: 48, spread: 0.06, mag: 32 },
  rifle: { name: 'Rifle', damage: 55, rate: 0.16, range: 110, spread: 0.008, mag: 24 },
};

// Ten story missions: take Bahía Azul back from the Vipers, district by district.
export const MISSIONS = [
  { id: 1, name: 'First Wheels', district: 'Old Harbor', type: 'drive', reward: 400, brief: 'Steal a car and bring it to the garage on Marina Row. The crew needs wheels.' },
  { id: 2, name: 'Harbor Lights', district: 'Old Harbor', type: 'collect', reward: 800, brief: 'Pick up 3 supply crates the Vipers hid around the harbor. Watch for their lookouts.' },
  { id: 3, name: 'Plaza Brawl', district: 'La Plaza', type: 'combat', reward: 1200, brief: 'Clear 5 Vipers out of La Plaza. They started it — finish it.' },
  { id: 4, name: 'Beach Run', district: 'North Beach', type: 'race', reward: 1000, brief: 'Beat the Viper courier down the beach road. First to the lighthouse wins.' },
  { id: 5, name: 'Dockside Debt', district: 'The Docks', type: 'drive', reward: 1400, brief: 'Drive the getaway car to the docks, then lose the cops. No scratches on the paint.' },
  { id: 6, name: 'Campus Courier', district: 'University Hill', type: 'collect', reward: 1100, brief: 'Grab 4 packages stashed around the campus before the Vipers find them.' },
  { id: 7, name: 'Heights Ambush', district: 'Palm Heights', type: 'combat', reward: 1800, brief: 'Ambush the Viper convoy in Palm Heights. Six of them. Make it count.' },
  { id: 8, name: 'Night Ferry', district: 'The Docks', type: 'drive', reward: 1600, brief: 'Smuggle the cargo from the docks to the lighthouse at night. Stay under 3 stars.' },
  { id: 9, name: 'The Informant', district: 'La Plaza', type: 'combat', reward: 2200, brief: 'Rescue the informant from the Viper safehouse, then get her to the garage alive.' },
  { id: 10, name: 'King of Bahía', district: 'Old Harbor', type: 'final', reward: 4300, brief: 'Salazar himself, at the harbor. End the Vipers tonight and the city is yours.' },
];
export const RACES = [
  { name: 'Beach Sprint', district: 'North Beach', reward: 600, laps: 1 },
  { name: 'Harbor Loop', district: 'Old Harbor', reward: 900, laps: 2 },
  { name: 'Heights Climb', district: 'Palm Heights', reward: 1200, laps: 2 },
];
export const PACKAGES = 20;

// The mutable game state. main.js creates it; every module reads it.
export const G = {
  time: 0,            // seconds since load
  clock: 8 * 3600,    // seconds of day (starts 08:00)
  weather: 'clear',   // clear | rain | fog
  cash: 250,
  health: 100, armor: 0,
  wanted: 0, wantedHeat: 0,
  lead: 0,            // 0 Lucia, 1 Marcus
  leads: [
    { name: 'Lucía Vega', callsign: 'Luz', ability: 'Focus', color: 0xff5a7a },
    { name: 'Marcus Kane', callsign: 'Mack', ability: 'Nitro', color: 0x3fa7ff },
  ],
  standing: {},       // district name -> 0..100
  missionsDone: [],   // mission ids completed
  mission: null,      // active mission runtime
  race: null,         // active race runtime
  taxi: null,         // active taxi fare runtime
  packagesGot: 0,
  player: null,       // { mesh, pos, heading, speed, onFoot, car, weapon, ammo, abilityCd }
  cars: [], peds: [], cops: [], heli: null, enemies: [],
  pickups: [], markers: [],
  scene: null, camera: null, renderer: null,
  input: {},          // key -> bool
  mode: 'title',      // title | playing | paused | busted | wasted | missionEnd
  paused: false,
  muted: false,
  radio: 0,           // station index
  save: null,
  shot: null,         // ?shot= mode
  shotReady: false,
  stats: { shotsFired: 0, carsStolen: 0, pedsHit: 0, distance: 0 },
};
export function resetStanding() {
  G.standing = {};
  for (const d of DISTRICTS) G.standing[d.name] = 0;
}
resetStanding();
