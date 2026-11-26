// shots.js — deterministic screenshot staging with autopilots.
// ?shot=cover|rings|landing|title&seed=7 runs a fixed number of
// 1/60 s steps with a scripted autopilot before the first rendered
// frames, so the shot never depends on requestAnimationFrame pacing
// under software rendering. The autopilot steers gently toward the
// current waypoint: bank is clamped to ~0.55 of full and is negative
// the bearing difference over 60 (banking right decreases heading in
// this world, and a waypoint at a higher bearing than the heading is
// to the left). The landing autopilot instead holds idle throttle, a
// slight descent and banks of at most 0.3 toward the strip.

import { CONFIG, bearingTo, wrapAngleDeg, clamp, headingToDir, missionById, stripById } from './config.js';

const DT = 1 / 60;

export function parseShot() {
  try {
    const q = new URLSearchParams(window.location.search);
    const shot = q.get('shot');
    if (!shot) return null;
    const seed = parseInt(q.get('seed') || '7', 10);
    return { kind: shot, seed: Number.isFinite(seed) ? seed : 7 };
  } catch (err) {
    return null;
  }
}

// Autopilot output for one step: { pitch, roll, throttle }.
export function autopilotInput(plane, target, opts) {
  const bearing = bearingTo(plane.x, plane.z, target.x, target.z);
  const diff = wrapAngleDeg(bearing - plane.heading);
  const bankFrac = clamp(-diff / 60, -opts.maxBank, opts.maxBank);
  const roll = bankFrac * CONFIG.flight.maxRollDeg;
  const pitch = opts.pitch != null
    ? opts.pitch
    : clamp((target.y - plane.y) * 0.06, -10, 10);
  return { pitch, roll, throttle: opts.throttle };
}

// Place the plane for a staged shot and run the synchronous autopilot.
// G is the main.js game bundle: { plane, missions, fuel, damage,
// weather, rings, particles, aircraft, camera, stepWorld }.
// stepWorld(dt, input) advances flight + missions + weather + particles.
export function stageShot(G, kind) {
  const spec = CONFIG.shots[kind];
  if (!spec) return { steps: 0, finalMode: false };
  const plane = G.plane;

  function pose(x, y, z, heading, speed, throttle, flaps) {
    plane.x = x; plane.y = y; plane.z = z;
    plane.heading = heading; plane.pitch = 0; plane.roll = 0;
    plane.speed = speed; plane.vy = 0; plane.throttle = throttle;
    plane.flaps = !!flaps; plane.gearDown = true;
    plane.airborne = true; plane.onGround = false;
  }

  if (kind === 'title') {
    G.missions.clear();
    G.fuel.level = 100;
    G.damage.integrity = 100;
    pose(CONFIG.spawn.x, CONFIG.spawn.y, CONFIG.spawn.z, CONFIG.spawn.heading, 0, 0, false);
    plane.airborne = false;
    plane.onGround = true;
    return { steps: 0, finalMode: false };
  }

  const def = missionById(spec.mission);
  G.missions.start(def);
  const m = G.missions.active;
  // Preset the mission clock BEFORE the synchronous run, so the timer
  // reads the staged time (e.g. 01:04) instead of 00:03.
  m.elapsed = spec.elapsed - spec.steps * DT;

  if (kind === 'cover') {
    // Sortie 5, gate 1. Start 200 m out, 15 m to the upwind side so the
    // autopilot banks gently into the ring; 186 steps carry the plane
    // through the amber torus with the beacon beam centred — the plane
    // ends at the ring's centre, unambiguously inside it.
    const g = def.gates[0];
    const dir = headingToDir(78);
    const perp = { x: Math.cos((78 * Math.PI) / 180), z: Math.sin((78 * Math.PI) / 180) };
    pose(g.x - dir.x * 200 + perp.x * -15, 118, g.z - dir.z * 200 + perp.z * -15, 78, 58, 0.6, false);
    runAutopilot(G, spec.steps, { maxBank: 0.55, throttle: 0.6 });
  } else if (kind === 'rings') {
    // Sortie 1: gate 1 already flown (preset passed), stage 200 m
    // before gate 2 on the gate 1 -> gate 2 line (heading 143), 15 m
    // to the upwind side; 204 steps thread the amber gate. Score then
    // matches 2 gates + steady + smooth flight.
    const g = def.gates[1];
    G.rings.gates[0].passed = true;
    G.missions.active.gatesPassed = 1; // gate 1 counts as flown, not just drawn passed
    const dir = headingToDir(143);
    const perp = { x: Math.cos((143 * Math.PI) / 180), z: Math.sin((143 * Math.PI) / 180) };
    pose(g.x - dir.x * 200 + perp.x * 15, g.y, g.z - dir.z * 200 + perp.z * 15, 143, 55, 0.55, false);
    runAutopilot(G, spec.steps, { maxBank: 0.55, throttle: 0.55 });
  } else if (kind === 'landing') {
    // Sortie 3, Heron Cay Short Strip: start on the strip axis 180 m
    // out at 40 m above the shelf, heading 140 (the strip heading),
    // flaps and gear down; the idle-throttle autopilot flies ~300
    // steps of final so the lit strip fills the frame dead ahead.
    const strip = stripById('heron');
    const dir = headingToDir(strip.heading);
    const threshold = {
      x: strip.x - dir.x * (strip.length / 2),
      z: strip.z - dir.z * (strip.length / 2),
    };
    pose(
      threshold.x - dir.x * 180, strip.shelf + 40, threshold.z - dir.z * 180,
      strip.heading, 38, 0.2, true,
    );
    runAutopilot(G, spec.steps, {
      maxBank: 0.3, throttle: 0.2, pitch: -4,
      target: { x: strip.x, y: strip.shelf + 2, z: strip.z },
    });
  }

  // Staged values are set AFTER the run: scores a real run could earn
  // at this stage and time (gate + steady + smooth-flight bonuses).
  m.score = spec.score;
  m.cash = spec.cash;
  m.elapsed = spec.elapsed;
  G.fuel.level = spec.fuel;
  G.damage.integrity = spec.integrity;
  return { steps: spec.steps, finalMode: kind === 'landing' };
}

function runAutopilot(G, steps, opts) {
  for (let i = 0; i < steps; i++) {
    const wp = G.missions.waypoint() || opts.target;
    const target = opts.target || (wp ? { x: wp.x, y: wp.y, z: wp.z } : null);
    if (!target) break;
    const input = autopilotInput(G.plane, target, opts);
    G.stepWorld(DT, { autopilot: input });
  }
}
