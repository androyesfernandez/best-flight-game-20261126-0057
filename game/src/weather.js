// weather.js — base wind from the west, a diagonal storm band across
// the north-east that strengthens and veers the wind, plus slow gusts
// that retarget every few seconds. Turbulence rises near the storm.

import { CONFIG, clamp } from './config.js';
import { mulberry32 } from './rng.js';

export function createWeather() {
  const rand = mulberry32(CONFIG.seed * 31 + 5);
  let gust = 0;               // current gust, m/s, signed
  let gustTarget = 0;
  let gustTimer = 0;
  let time = 0;

  // The storm band is a diagonal line across the north-east; the signed
  // distance from a point to it decides how stormy the air is there.
  // Band passes near (300, -300) with direction (1, 1) in (x, z).
  function stormProximity(x, z) {
    // Distance to the line through (300,-300) direction (0.707, 0.707).
    const dx = x - 300;
    const dz = z + 300;
    const along = dx * 0.707 + dz * 0.707;
    const across = Math.abs(dx * 0.707 - dz * 0.707);
    void along;
    return across; // 0 = on the band, grows away from it
  }

  function update(dt, x, z) {
    time += dt;
    gustTimer -= dt;
    if (gustTimer <= 0) {
      gustTarget = (rand() * 2 - 1) * 5;
      gustTimer = 2.5 + rand() * 3.5;
    }
    gust += (gustTarget - gust) * Math.min(1, dt * 0.8);

    const prox = stormProximity(x, z);
    const storminess = clamp(1 - prox / 700, 0, 1); // 1 on the band
    // Base wind 6-10 m/s from the west, stronger near the storm band.
    const windSpeed = 8 + storminess * 6 + Math.abs(gust) * 0.4;
    const windDir = 270 + storminess * 25 + gust * 1.2; // veers near storm
    const rad = (windDir * Math.PI) / 180;
    // Wind direction: the compass direction the wind comes FROM.
    const windX = -Math.sin(rad) * windSpeed;
    const windZ = Math.cos(rad) * windSpeed;
    const turbulence = storminess * 0.9 + Math.abs(gust) * 0.09;
    return { windDir, windSpeed, windX, windZ, gust, turbulence, storminess };
  }

  return { update, stormProximity };
}
