// fuel.js — tank level, throttle-squared burn, strip refuel.

import { CONFIG } from './config.js';

export function createFuel() {
  let level = CONFIG.fuel.capacity;
  return {
    get level() { return level; },
    set level(v) { level = Math.max(0, Math.min(CONFIG.fuel.capacity, v)); },
    reset() { level = CONFIG.fuel.capacity; },
    // Burn rises quadratically with throttle: 0.16/s idle to 0.55/s full.
    burn(dt, throttle) {
      const rate = CONFIG.fuel.idleBurn
        + (CONFIG.fuel.fullBurn - CONFIG.fuel.idleBurn) * throttle * throttle;
      level = Math.max(0, level - rate * dt);
      return level;
    },
    refuel(dt) {
      level = Math.min(CONFIG.fuel.capacity, level + CONFIG.fuel.refuelRate * dt);
    },
    get empty() { return level <= 0; },
    get warning() { return level < CONFIG.fuel.warnBelow; },
    get critical() { return level < CONFIG.fuel.criticalBelow; },
  };
}
