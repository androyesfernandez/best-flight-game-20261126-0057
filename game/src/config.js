// config.js — every tuning number, rank, island, strip and mission.
// All other modules read from here so the whole game stays consistent.

export const CONFIG = {
  seed: 7,
  world: {
    size: 2600,          // map is size x size metres, centred on the origin
    edge: 1250,          // soft world edge: gently turns the pilot back
    maxAltitude: 420,
    seaLevel: 0,
    gravity: 9.8,
  },
  flight: {
    maxSpeed: 96,
    cruiseSpeed: 55,
    stallSpeed: 28,
    stallSpeedFlaps: 22,
    takeoffSpeed: 30,
    overspeed: 100,
    maxPitchDeg: 22,
    maxRollDeg: 62,
    throttleRate: 0.55,  // per second
    thrustAccel: 12,     // m/s^2 at full throttle
    dragCoeff: 0.125,    // speed approaches thrustAccel / dragCoeff
    sinkAccel: 4.9,      // below stall the wing sinks at about half gravity
    gearHeight: 1.2,
    stripFriction: 6,    // m/s^2 rolling on a strip
    grassFriction: 16,   // m/s^2 rolling on grass
    windDrift: 0.6,      // fraction of the wind applied to the aircraft
    maxLandingVs: 5.5,   // m/s descent for a landing
    maxLandingSpeed: 48,
    perfectVs: 2.5,
    roughVs: 8,          // harder than this on a strip is a crash
    maxLandingRollDeg: 15,
    gearRetractSpeed: 55,
    gearExtendSpeed: 50,
  },
  fuel: {
    capacity: 100,
    idleBurn: 0.16,      // per second
    fullBurn: 0.55,      // per second at full throttle
    refuelRate: 40,      // per second, landed on a strip at low speed
    warnBelow: 25,
    criticalBelow: 10,
  },
  damage: {
    max: 100,
    goodLanding: 6,
    roughLanding: 16,
    overspeedPerSec: 6,
    repairRate: 25,      // per second, landed on a strip at low speed
  },
  ranks: [
    { at: 0, name: 'Rookie' },
    { at: 1500, name: 'Courier' },
    { at: 4000, name: 'Storm Runner' },
    { at: 8000, name: 'Sky Courier' },
    { at: 14000, name: 'Stormwing Ace' },
  ],
  scoring: {
    ringGate: 250,
    surveyGate: 200,
    steadyBonus: 60,     // per gate, banked under 18 degrees
    dropBullseye: 400,   // under 12 m
    dropInZone: 200,
    dropNear: 80,
    dropZoneRadius: 25,
    dropNearRadius: 40,
    perfectLanding: 500,
    goodLanding: 300,
    roughLanding: 120,
    missionComplete: 600,
    timeBonusPerSec: 15, // per second under par
    smoothPerSec: 2,     // while airborne, banked under 20 deg, 30-90 m/s
    hardBankPerSec: 5,   // bank over 55 degrees
    overspeedPerSec: 10,
    cashPerScore: 1.5,
  },
  islands: [
    { name: 'Kestrel Rock', x: 0, z: 0, radius: 420, height: 62 },
    { name: 'Gull Point', x: -520, z: -520, radius: 260, height: 48 },
    { name: 'Heron Cay', x: 520, z: -520, radius: 210, height: 34 },
    { name: 'Stormbreak Isle', x: 0, z: 620, radius: 300, height: 88 },
  ],
  // Strips: heading in degrees (0 = north, 90 = east). Shelf height 14 m.
  strips: [
    { id: 'kestrel', name: 'Kestrel Field', island: 'Kestrel Rock', x: 0, z: 120, heading: 90, length: 260, width: 18, shelf: 14 },
    { id: 'gull', name: 'Gull Point Strip', island: 'Gull Point', x: -520, z: -520, heading: 70, length: 200, width: 16, shelf: 14 },
    { id: 'heron', name: 'Heron Cay Strip', island: 'Heron Cay', x: 520, z: -520, heading: 140, length: 170, width: 16, shelf: 14 },
  ],
  spawn: { x: -110, y: 16, z: 120, heading: 90 },
  town: { name: 'Port Lumen', x: 170, z: 190, houses: 46 },
  lighthouse: { x: 0, z: -400 },
  harbourBoats: 7,
  pines: 320,
  missions: [
    {
      id: 1, name: 'First Light Gates', type: 'rings', par: 150, reward: 500,
      blurb: 'Thread 6 dawn gates over Port Lumen.',
      gates: [
        { x: 60, y: 95, z: 120 }, { x: 150, y: 105, z: 240 }, { x: 280, y: 90, z: 190 },
        { x: 300, y: 110, z: 60 }, { x: 190, y: 100, z: -30 }, { x: 50, y: 85, z: -60 },
      ],
    },
    {
      id: 2, name: 'Medicine for Gull Point', type: 'drop', par: 240, reward: 800,
      blurb: 'Drop 2 crates onto the marked zones at Gullhaven.',
      zones: [{ x: -470, z: -470 }, { x: -570, z: -570 }],
    },
    {
      id: 3, name: 'Heron Cay Short Strip', type: 'landing', par: 200, reward: 700,
      blurb: 'Put the Petrel down on the 170 m Heron Cay strip.',
      strip: 'heron',
    },
    {
      id: 4, name: 'Stormbreak Photo Pass', type: 'survey', par: 210, reward: 800,
      blurb: 'Fly 4 low, steady photo gates over Stormbreak Isle.',
      gates: [
        { x: -230, y: 78, z: 620 }, { x: -60, y: 82, z: 830 }, { x: 170, y: 76, z: 780 },
        { x: 230, y: 84, z: 560 },
      ],
    },
    {
      id: 5, name: 'Storm Gate Slalom', type: 'rings', par: 190, reward: 900,
      blurb: 'Slalom 8 gates through the storm front.',
      gates: [
        { x: 100, y: 120, z: -380 }, { x: 260, y: 118, z: -260 }, { x: 400, y: 126, z: -140 },
        { x: 520, y: 122, z: -20 }, { x: 620, y: 128, z: 110 }, { x: 700, y: 120, z: 240 },
        { x: 750, y: 126, z: 370 }, { x: 780, y: 118, z: 500 },
      ],
    },
    {
      id: 6, name: 'Stormbreak Relief', type: 'drop', par: 300, reward: 1000,
      blurb: 'Drop 3 crates on Stormbreak in a crosswind.',
      zones: [{ x: -80, z: 560 }, { x: 80, z: 560 }, { x: 0, z: 700 }],
    },
    {
      id: 7, name: 'Dawn Return to Kestrel', type: 'landing', par: 180, reward: 800,
      blurb: 'Land on Kestrel Field inside the touchdown zone.',
      strip: 'kestrel',
    },
    {
      id: 8, name: 'Kestrel Grand Tour', type: 'mixed', par: 420, reward: 1500,
      blurb: '4 gates, 1 drop, then land at Gull Point.',
      gates: [
        { x: 60, y: 95, z: 120 }, { x: 150, y: 105, z: 240 }, { x: 280, y: 90, z: 190 },
        { x: 300, y: 110, z: 60 },
      ],
      zones: [{ x: -470, z: -470 }],
      strip: 'gull',
    },
  ],
  colours: {
    skyTop: 0x1b1440, skyMid: 0x4a2a63, skyHorizon: 0xff8a4d,
    sun: 0xffd9a0, sea: 0x3d5a6e, seaDeep: 0x2c4256,
    sand: 0xc2a878, grass: 0x5d8a4a, grassLight: 0x74a35c,
    rock: 0x6e6a66, rockPale: 0x9a938a, pine: 0x24402a,
    fuselage: 0xe8641c, cream: 0xf2e3c2, glass: 0x2fd4c8,
    amber: 0xffb020, cyan: 0x37e0d4, gateAmber: 0xffa018, gateBlue: 0x2f7bff,
    gateGreen: 0x37d67a, cloud: 0x5d5670, cloudRim: 0x8a6a72,
  },
  // Staged screenshot values: scores a real run could earn at that stage
  // and time — cover 1 gate x 250 + steady 60 + smooth 2/s x 64 s = 438;
  // rings 2 gates x 250 + 2 x steady 60 + smooth 2/s x 58 s = 736;
  // landing smooth 2/s x 132 s = 264. Never a four-figure score minutes
  // into stage one.
  shots: {
    cover: { mission: 5, steps: 186, elapsed: 64, score: 438, cash: 657, fuel: 62, integrity: 92 },
    rings: { mission: 1, steps: 204, elapsed: 58, score: 736, cash: 1104, fuel: 84, integrity: 100 },
    landing: { mission: 3, steps: 300, elapsed: 132, score: 264, cash: 396, fuel: 71, integrity: 100 },
    title: { mission: 0, steps: 0, elapsed: 0, score: 0, cash: 0, fuel: 100, integrity: 100 },
  },
};

export function rankFor(totalScore) {
  let current = CONFIG.ranks[0];
  let next = null;
  for (let i = 0; i < CONFIG.ranks.length; i++) {
    if (totalScore >= CONFIG.ranks[i].at) {
      current = CONFIG.ranks[i];
      next = CONFIG.ranks[i + 1] || null;
    }
  }
  const span = next ? next.at - current.at : 1;
  const progress = next ? Math.min(1, Math.max(0, (totalScore - current.at) / span)) : 1;
  return { current, next, progress };
}

export function stripById(id) {
  return CONFIG.strips.find((s) => s.id === id);
}

export function missionById(id) {
  return CONFIG.missions.find((m) => m.id === id);
}

// Heading (deg, 0 = north, 90 = east) -> unit direction in (x, z).
export function headingToDir(headingDeg) {
  const r = (headingDeg * Math.PI) / 180;
  return { x: Math.sin(r), z: -Math.cos(r) };
}

// Bearing (deg, same convention) from (x0,z0) toward (x1,z1).
export function bearingTo(x0, z0, x1, z1) {
  return (Math.atan2(x1 - x0, -(z1 - z0)) * 180) / Math.PI;
}

export function wrapAngleDeg(a) {
  let v = a % 360;
  if (v > 180) v -= 360;
  if (v < -180) v += 360;
  return v;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function smoothstep(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
