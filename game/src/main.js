// main.js — boot, renderer, the fixed-step loop, screens, the snapshot
// the HUD reads, and the synchronous shot runner.

import { CONFIG, rankFor, missionById, wrapAngleDeg } from './config.js';
import { mulberry32 } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWeather } from './weather.js';
import { createSky } from './sky.js';
import { createTerrain } from './terrain.js';
import { createRunways } from './runway.js';
import { createAircraft } from './aircraft.js';
import { stepFlight } from './flight.js';
import { createRings } from './rings.js';
import { createMissions } from './missions.js';
import { createFuel } from './fuel.js';
import { createDamage } from './damage.js';
import { createParticles } from './particles.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createMenu } from './menu.js';
import { loadSave, persistSave, recordBest, saveToSlot, loadFromSlot } from './save.js';
import { parseShot, stageShot } from './shots.js';

const DT = 1 / 60;
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x2a2140, 500, 2000);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4200);

const terrain = createTerrain(scene);
const sky = createSky(scene);
const runways = createRunways(scene, terrain.heightAt);
const aircraft = createAircraft(scene);
const rings = createRings(scene);
const particles = createParticles(scene, terrain.heightAt);
const audio = createAudio();
const input = createInput();
const weather = createWeather();
const fuel = createFuel();
const damage = createDamage();
const missions = createMissions(rings, particles, audio);
const hud = createHud(document);
const minimap = createMinimap(document.getElementById('radar'), rings, missions);
const cameraCtl = createCamera(camera);
const profile = loadSave();
const flightRand = mulberry32(CONFIG.seed);

const plane = aircraft.state;
let screen = 'title'; // title | flying | paused | debrief
let cameraMode = 'chase';
let time = 0;
let freeElapsed = 0;
let eventLine = 'Welcome to the Kestrel Isles — pick a sortie and fly.';
let orbitAngle = 0.6;
let selectedMission = 1;
let finalCam = false;
let audioStarted = false;
let acc = 0;
let lastNow = performance.now();

const menu = createMenu(document, {
  onPickSortie(id) { selectedMission = id; startSortie(id); },
  onFreeFlight() { startFreeFlight(); },
  onResume() { resumeGame(); },
  onQuitToTitle() { quitToTitle(); },
  onAgain() { startSortie(selectedMission); },
  onSaveSlot(i) { saveToSlot(profile, i); menu.refresh(profile); hud.banner(`Saved to Slot ${i + 1}`); },
  onLoadSlot(i) { loadFromSlot(profile, i); menu.refresh(profile); hud.banner(`Loaded Slot ${i + 1}`); },
});

function liveInput() {
  return {
    throttleUp: input.throttleUp,
    throttleDown: input.throttleDown,
    pitchUp: input.pitchUp,
    pitchDown: input.pitchDown,
    rollLeft: input.rollLeft,
    rollRight: input.rollRight,
    yawLeft: input.yawLeft,
    yawRight: input.yawRight,
    brake: input.brake,
    mouseDown: input.mouseDown,
    mouseX: input.mouseX,
    autopilot: null,
  };
}

function stepWorld(dt, inputOverride) {
  time += dt;
  const wind = weather.update(dt, plane.x, plane.z);
  const inp = inputOverride || liveInput();
  const res = stepFlight(plane, dt, inp, {
    heightAt: terrain.heightAt,
    onStrip: (x, z) => runways.onStrip(x, z),
    wind,
    rand: flightRand,
  });
  fuel.burn(dt, plane.throttle);
  if (res.landed) {
    missions.onLanded(res.landed.quality, res.landed.strip, damage);
    particles.smoke(plane.x, plane.y, plane.z);
    audio.thunk();
    if (res.landed.quality === 'perfect') eventLine = 'Perfect landing!';
    else if (res.landed.quality === 'good') eventLine = 'Good landing.';
    else eventLine = 'Rough landing — check the airframe.';
  }
  if (res.crashed) {
    damage.crash();
    missions.fail(res.crashed);
    eventLine = `Crashed — ${res.crashed}.`;
  }
  missions.update(dt, { plane, fuel, damage, time });
  // Landed on a strip at low speed: refuel and repair.
  if (plane.onGround && !plane.airborne && plane.speed < 2) {
    if (runways.onStrip(plane.x, plane.z)) {
      fuel.refuel(dt);
      damage.repair(dt);
    }
  }
  for (const e of missions.takeEvents()) eventLine = e;
  // Low-fuel alarm, at most every 4 s.
  if (fuel.critical && plane.airborne && time - (stepWorld._alarm || 0) > 4) {
    stepWorld._alarm = time;
    audio.alarm();
    eventLine = 'FUEL CRITICAL — find a strip!';
  }
  if (screen === 'flying' && !missions.active) freeElapsed += dt;
  particles.update(dt, plane, time);
  sky.update(dt, time);
  terrain.update(dt, time);
  aircraft.update(dt, time);
  audio.setEngine(plane.throttle, plane.speed, plane.airborne);
  const m = missions.active;
  if (m && m.state !== 'active' && screen === 'flying') {
    endSortie(m.state === 'complete', m.state === 'complete' ? 'Mission complete.' : m.failReason);
  }
}

function startSortie(id) {
  const def = missionById(id);
  if (!def) return;
  selectedMission = id;
  audio.ensure();
  audioStarted = true;
  aircraft.reset();
  fuel.reset();
  damage.reset();
  missions.start(def);
  cameraMode = 'chase';
  cameraCtl.snap(plane);
  screen = 'flying';
  freeElapsed = 0;
  finalCam = false;
  menu.show('none');
  hud.banner(`SORTIE ${def.id} — ${def.name.toUpperCase()}`);
  eventLine = `${def.name} — ${def.blurb}`;
}

function startFreeFlight() {
  audio.ensure();
  audioStarted = true;
  aircraft.reset();
  fuel.reset();
  damage.reset();
  missions.clear();
  cameraMode = 'chase';
  cameraCtl.snap(plane);
  screen = 'flying';
  freeElapsed = 0;
  finalCam = false;
  menu.show('none');
  hud.banner('FREE FLIGHT');
  eventLine = 'Free flight — explore the Kestrel Isles.';
}

function endSortie(complete, reason) {
  const m = missions.active;
  const score = m ? m.score : 0;
  const elapsed = m ? m.elapsed : freeElapsed;
  if (complete && m) recordBest(profile, m.def.id, score, elapsed);
  else persistSave(profile);
  menu.showDebrief({
    complete,
    reason: complete ? `Sortie ${m ? m.def.id : ''} complete — bonus ${m ? m.completeBonus : 0} pts.` : (reason || 'Sortie failed.'),
    score, time: elapsed, fuel: fuel.level, integrity: damage.integrity,
  });
  screen = 'debrief';
}

function resumeGame() {
  if (screen !== 'paused') return;
  screen = 'flying';
  menu.show('none');
}

function quitToTitle() {
  aircraft.reset();
  fuel.reset();
  damage.reset();
  missions.clear();
  screen = 'title';
  menu.refresh(profile);
  menu.show('title');
}

function handleOneShots() {
  if (input.take('mute')) {
    audio.setMuted(!audio.muted);
    eventLine = audio.muted ? 'Sound muted.' : 'Sound on.';
  }
  if (screen === 'title') {
    const picked = input.takeSortie();
    if (picked) { selectedMission = picked; menu.refresh(profile); }
    if (input.take('start')) startSortie(selectedMission);
    return;
  }
  if (screen === 'debrief') {
    if (input.take('start')) quitToTitle();
    return;
  }
  if (input.take('pause')) {
    if (screen === 'flying') { screen = 'paused'; menu.show('pause'); }
    else if (screen === 'paused') resumeGame();
    return;
  }
  if (screen !== 'flying') return;
  if (input.take('flap')) {
    plane.flaps = !plane.flaps;
    eventLine = plane.flaps ? 'Flaps down.' : 'Flaps up.';
  }
  if (input.take('camera')) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    eventLine = cameraMode === 'cockpit' ? 'Cockpit camera.' : 'Chase camera.';
  }
  if (input.take('reset')) {
    aircraft.reset();
    fuel.reset();
    damage.reset();
    cameraCtl.snap(plane);
    hud.banner('RESET TO KESTREL FIELD');
    eventLine = 'Reset to Kestrel Field.';
  }
  if (input.take('drop')) missions.dropCrate(plane);
}

function snapshot() {
  const m = missions.active;
  const total = profile.totalScore + (m ? Math.round(m.score) : 0);
  const rank = rankFor(total);
  const wp = missions.waypoint();
  const wind = weather.update(0, plane.x, plane.z);
  const phaseNames = { gates: 'RING GATES', survey: 'PHOTO PASS', drop: 'SUPPLY DROP', landing: 'LANDING' };
  return {
    altFt: plane.y * 3.28084,
    spdKt: plane.speed * 1.94384,
    hdgDeg: ((plane.heading % 360) + 360) % 360,
    vsiFpm: plane.vy * 196.85,
    throttlePct: plane.throttle * 100,
    fuelPct: fuel.level,
    integrityPct: damage.integrity,
    score: m ? m.score : 0,
    cash: m ? m.cash : profile.cash,
    rankName: rank.current.name,
    nextRankName: rank.next ? rank.next.name : null,
    rankProgress: rank.progress,
    mission: m ? {
      id: m.def.id,
      name: m.def.name,
      stage: `${phaseNames[m.phase] || ''} · STAGE ${m.gatesPassed + m.dropsHit + 1}`,
      objective: missions.objective(),
      elapsed: m.elapsed,
      par: m.def.par,
      waypoint: wp ? { ...wp, dist: Math.hypot(wp.x - plane.x, wp.y - plane.y, wp.z - plane.z) } : null,
    } : null,
    flaps: plane.flaps,
    gearDown: plane.gearDown,
    windDir: wind.windDir,
    windSpeed: wind.windSpeed,
    cameraMode,
    eventLine,
    elapsed: freeElapsed,
    planeX: plane.x,
    planeZ: plane.z,
  };
}

function renderFrame() {
  hud.update(snapshot());
  minimap.draw(snapshot());
  if (screen === 'title') {
    camera.position.set(Math.cos(orbitAngle) * 480, 200, Math.sin(orbitAngle) * 480);
    camera.lookAt(0, 40, 0);
    camera.fov = 58;
    camera.updateProjectionMatrix();
  } else {
    cameraCtl.update(DT, plane, cameraMode, { final: finalCam });
  }
  renderer.render(scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  if (!audioStarted && input.gesture) { audio.ensure(); audioStarted = true; }
  handleOneShots();
  if (screen === 'flying' && !window.shotReady) {
    acc += dtReal;
    let guard = 0;
    while (acc >= DT && guard++ < 8) {
      stepWorld(DT);
      acc -= DT;
    }
    if (guard >= 8) acc = 0;
  } else if (screen === 'title') {
    time += dtReal;
    orbitAngle += dtReal * 0.02;
    sky.update(dtReal, time);
    terrain.update(dtReal, time);
    particles.update(dtReal, { x: 0, y: 120, z: 0 }, time);
    aircraft.update(dtReal, time);
  }
  renderFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- boot ----
menu.refresh(profile);
menu.show('title');
aircraft.update(0, 0);

// Deterministic staged screenshots: run the autopilot synchronously,
// render three frames, then signal readiness.
const shotMode = parseShot();
window.shotReady = false;
window.__game = {
  get screen() { return screen; },
  get plane() { return plane; },
  get fuel() { return fuel.level; },
  get damage() { return damage.integrity; },
  get mission() { return missions.active; },
  get cameraMode() { return cameraMode; },
  startSortie, startFreeFlight, quitToTitle,
};

if (shotMode && ['cover', 'rings', 'landing', 'title'].includes(shotMode.kind)) {
  try {
    if (shotMode.kind === 'title') {
      screen = 'title';
      menu.show('title');
      orbitAngle = 0.6;
    } else {
      screen = 'flying';
      menu.show('none');
      const staged = stageShot(
        {
          plane, missions, fuel, damage, weather, rings, particles,
          aircraft, camera: cameraCtl, stepWorld,
        },
        shotMode.kind,
      );
      finalCam = staged.finalMode;
      cameraCtl.snap(plane);
      aircraft.update(0, time);
    }
    renderFrame();
    renderFrame();
    renderFrame();
    window.shotReady = true;
  } catch (err) {
    window.shotError = String(err && err.message ? err.message : err);
    window.shotReady = false;
  }
}

requestAnimationFrame(frame);
void wrapAngleDeg;
