// Bahía Azul — HUD: live minimap, readouts, menus, WebAudio engine + radio.
import { G, DISTRICTS, MISSIONS, RACES, districtAt } from './state.js';

let audioCtx = null, radioOn = false, radioStation = 0, radioTimer = null, engineNodes = null;
const STATIONS = [
  { name: 'Radio Azul 88.5', bpm: 112, root: 220 },
  { name: 'Onda Tropical 102.1', bpm: 96, root: 196 },
  { name: 'Neón FM 97.9', bpm: 126, root: 233 },
];
const SCALES = [0, 2, 3, 5, 7, 8, 10];

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
export function audioReady() { return ensureAudio(); }

function note(freq, t, dur, type, gain) {
  const ctx = ensureAudio(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
export function sfx(name) {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  if (name === 'shot') { note(880, t, 0.12, 'square', 0.25); note(220, t, 0.1, 'sawtooth', 0.2); }
  else if (name === 'punch') { note(120, t, 0.1, 'sine', 0.4); }
  else if (name === 'cash') { note(880, t, 0.12, 'sine', 0.2); note(1320, t + 0.09, 0.18, 'sine', 0.2); }
  else if (name === 'horn') { note(370, t, 0.3, 'sawtooth', 0.15); note(440, t, 0.3, 'sawtooth', 0.12); }
  else if (name === 'siren') { note(700, t, 0.4, 'sine', 0.12); note(950, t + 0.4, 0.4, 'sine', 0.12); }
  else if (name === 'pickup') { note(660, t, 0.1, 'triangle', 0.25); note(990, t + 0.08, 0.16, 'triangle', 0.25); }
}
export function toggleRadio() {
  const ctx = ensureAudio(); if (!ctx) return;
  radioOn = !radioOn;
  if (radioOn) startRadio(); else stopRadio();
  const el = document.getElementById('radio');
  if (el) el.textContent = radioOn ? `♫ ${STATIONS[radioStation].name}` : 'Radio off';
}
export function nextStation() {
  radioStation = (radioStation + 1) % STATIONS.length;
  if (radioOn) { stopRadio(); startRadio(); }
  const el = document.getElementById('radio');
  if (el) el.textContent = `♫ ${STATIONS[radioStation].name}`;
}
function startRadio() {
  const ctx = ensureAudio(); if (!ctx) return;
  const st = STATIONS[radioStation];
  const beat = 60 / st.bpm;
  let step = 0;
  radioTimer = setInterval(() => {
    const ctx2 = ensureAudio(); if (!ctx2) return;
    const t = ctx2.currentTime;
    const root = st.root;
    const scale = SCALES[step % 7];
    const f = root * Math.pow(2, scale / 12) * (step % 16 >= 8 ? 2 : 1);
    note(f, t, beat * 0.9, step % 4 === 0 ? 'triangle' : 'sine', 0.12);
    if (step % 4 === 0) note(root / 2, t, beat * 1.8, 'sine', 0.22);
    if (step % 8 === 4) note(root * Math.pow(2, 7 / 12), t, beat, 'sawtooth', 0.05);
    step++;
  }, beat * 1000);
}
function stopRadio() { if (radioTimer) { clearInterval(radioTimer); radioTimer = null; } }

export function startEngine() {
  const ctx = ensureAudio(); if (!ctx) return;
  if (engineNodes) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 60;
  g.gain.value = 0.0;
  o.connect(g); g.connect(ctx.destination); o.start();
  engineNodes = { o, g };
}
export function updateEngine(speed) {
  if (!engineNodes) return;
  engineNodes.o.frequency.value = 55 + Math.abs(speed) * 6;
  engineNodes.g.gain.value = Math.min(0.08, Math.abs(speed) * 0.002);
}
export function stopEngine() {
  if (!engineNodes) return;
  try { engineNodes.o.stop(); } catch (e) {}
  engineNodes = null;
}

// --- HUD readouts ---
const $ = id => document.getElementById(id);
export function updateHUD() {
  const p = G.player;
  const clock = $('clock'), cash = $('cash'), stars = $('stars'),
    health = $('health'), armor = $('armor'), speed = $('speed'),
    weapon = $('weapon'), district = $('district'), standing = $('standing'),
    mission = $('mission-count');
  if (clock) {
    const h = Math.floor(G.clock / 3600), m = Math.floor((G.clock % 3600) / 60);
    clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (cash) cash.textContent = '$' + G.cash.toLocaleString('en-US');
  if (stars) {
    stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.textContent = '★'; s.className = i < G.wanted ? 'star on' : 'star';
      stars.appendChild(s);
    }
  }
  if (health && p) {
    health.style.width = Math.max(0, p.health) + '%';
    health.className = 'bar-fill' + (p.health < 30 ? ' low' : '');
  }
  if (armor && p) armor.style.width = Math.max(0, p.armor) + '%';
  if (speed) speed.textContent = p && p.car ? Math.round(Math.abs(p.car.speed) * 2.24) + ' mph' : (p ? Math.round(p.speed * 2.24) + ' mph' : '0 mph');
  if (weapon && p) weapon.textContent = `${p.weapon.toUpperCase()} ${p.ammo[p.weapon] ?? '∞'}`;
  if (district && p) {
    const d = districtAt(p.x, p.z);
    district.textContent = d.name;
  }
  if (standing && p) {
    const d = districtAt(p.x, p.z);
    standing.textContent = `Standing ${G.standing[d.name] || 0}`;
  }
  if (mission) mission.textContent = `Missions ${G.missionsDone.length}/${MISSIONS.length} · Packages ${G.packagesGot}/20`;
}

// --- minimap ---
let mmCtx = null, mmCanvas = null;
export function initMinimap() {
  mmCanvas = $('minimap');
  if (mmCanvas) mmCtx = mmCanvas.getContext('2d');
}
export function drawMinimap() {
  if (!mmCtx || !G.player) return;
  const W = 220, s = W / 480;
  const ctx = mmCtx;
  ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, W, W);
  // districts
  for (const d of DISTRICTS) {
    ctx.fillStyle = '#' + d.color.toString(16).padStart(6, '0');
    ctx.globalAlpha = 0.5;
    ctx.fillRect((d.x0 + 240) * s, (d.z0 + 240) * s, (d.x1 - d.x0) * s, (d.z1 - d.z0) * s);
    ctx.globalAlpha = 1;
  }
  // roads
  ctx.strokeStyle = '#3a3f47'; ctx.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const p = (i * 70 + 13 + 240) * s;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
  }
  // beach + water
  ctx.fillStyle = '#e8d5a0'; ctx.fillRect(0, (140 + 240) * s, W, (100) * s);
  ctx.fillStyle = '#1e6f8e'; ctx.fillRect(0, (240 + 240) * s - W, 0, 0);
  ctx.fillStyle = '#1e6f8e'; ctx.fillRect(0, (240) * s, W, 8);
  // objective marker
  const marker = document.querySelector('#objective');
  // mission target: read from the marker mesh if present
  // (drawn via G.mission / G.race / G.taxi targets)
  const tgt = G.mission?.target || G.race?.pts?.[G.race.idx] || G.taxi?.dest;
  if (tgt) {
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc((tgt.x + 240) * s, (tgt.z + 240) * s, 5, 0, Math.PI * 2); ctx.fill();
  }
  // cops
  ctx.fillStyle = '#4da6ff';
  for (const c of G.cops) { ctx.fillRect((c.x + 240) * s - 2, (c.z + 240) * s - 2, 4, 4); }
  // heli
  if (G.heli) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc((G.heli.x + 240) * s, (G.heli.z + 240) * s, 4, 0, Math.PI * 2); ctx.fill(); }
  // player arrow (rotated)
  const p = G.player;
  ctx.save();
  ctx.translate((p.x + 240) * s, (p.z + 240) * s);
  ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// --- screens ---
export function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
  const el = $(id);
  if (el) el.classList.remove('hidden');
}
export function hideScreens() {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
}
