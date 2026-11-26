// damage.js — integrity, landing quality costs, overspeed wear,
// crash, and strip repair.

import { CONFIG } from './config.js';

export function createDamage() {
  let integrity = CONFIG.damage.max;
  return {
    get integrity() { return integrity; },
    set integrity(v) { integrity = Math.max(0, Math.min(CONFIG.damage.max, v)); },
    reset() { integrity = CONFIG.damage.max; },
    applyLanding(quality) {
      if (quality === 'good') integrity -= CONFIG.damage.goodLanding;
      else if (quality === 'rough') integrity -= CONFIG.damage.roughLanding;
      integrity = Math.max(0, integrity);
      return integrity;
    },
    applyOverspeed(dt) {
      integrity = Math.max(0, integrity - CONFIG.damage.overspeedPerSec * dt);
    },
    crash() {
      integrity = 0;
    },
    repair(dt) {
      integrity = Math.min(CONFIG.damage.max, integrity + CONFIG.damage.repairRate * dt);
    },
  };
}
