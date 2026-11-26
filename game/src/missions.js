// missions.js — mission roster, stage logic, drops, scoring, waypoint.
// Four mission types: rings, drops, landings, survey; mission 8 mixes
// all three in sequence. Scoring follows config.js exactly.

import { CONFIG, stripById, clamp } from './config.js';

export function createMissions(rings, particles, audio) {
  let m = null; // active mission runtime state, or null for free flight

  function event(text) {
    if (m) m.events.push(text);
  }

  function addScore(n, label) {
    if (!m) return;
    m.score += n;
    m.cash = Math.round(m.score * CONFIG.scoring.cashPerScore);
    if (label) event(`+${n} ${label}`);
  }

  function waypointFor() {
    if (!m) return null;
    if (m.phase === 'gates' || m.phase === 'survey') {
      const g = rings.nextGate();
      if (!g) return null;
      const total = m.def.gates.length;
      return {
        x: g.x, y: g.y, z: g.z,
        label: m.phase === 'survey'
          ? `PHOTO GATE ${g.index + 1}/${total}`
          : `GATE ${g.index + 1}/${total}`,
      };
    }
    if (m.phase === 'drop') {
      const z = m.zones.find((zz) => !zz.hit);
      if (!z) return null;
      return { x: z.x, y: 20, z: z.z, label: `DROP ZONE ${z.letter} — ${m.dropsHit}/${m.zones.length}` };
    }
    if (m.phase === 'landing') {
      const s = m.targetStrip;
      return { x: s.x, y: s.shelf + 4, z: s.z, label: `${s.name.toUpperCase()} — LAND` };
    }
    return null;
  }

  function objectiveFor() {
    if (!m) return 'Free flight — explore the Kestrel Isles.';
    const d = m.def;
    if (m.phase === 'gates') return `Thread gate ${rings.gates.filter((g) => g.passed).length + 1}/${d.gates.length} — ${d.blurb}`;
    if (m.phase === 'survey') return `Photo gate ${rings.gates.filter((g) => g.passed).length + 1}/${d.gates.length} — low and steady`;
    if (m.phase === 'drop') return `Drop a crate on Zone ${m.zones.find((z) => !z.hit)?.letter || ''} (${m.dropsHit}/${m.zones.length}) — press B`;
    if (m.phase === 'landing') return `Land on ${m.targetStrip.name}`;
    return d.blurb;
  }

  function complete() {
    const d = m.def;
    const under = Math.max(0, d.par - m.elapsed);
    const bonus = CONFIG.scoring.missionComplete + Math.round(CONFIG.scoring.timeBonusPerSec * under);
    m.score += bonus;
    m.cash = Math.round(m.score * CONFIG.scoring.cashPerScore);
    m.state = 'complete';
    m.completeBonus = bonus;
    audio.chime('complete');
    event(`MISSION COMPLETE +${bonus}`);
  }

  function fail(reason) {
    if (!m || m.state !== 'active') return;
    m.state = 'failed';
    m.failReason = reason;
    audio.chime('fail');
    event(`SORTIE FAILED — ${reason}`);
  }

  function advancePhase() {
    const d = m.def;
    if (d.type === 'mixed') {
      if (m.phase === 'gates') {
        m.phase = 'drop';
        particles.setZones(m.zones);
        event('Next: drop the relief crate');
      } else if (m.phase === 'drop') {
        m.phase = 'landing';
        event('Next: land at Gull Point');
      }
      return;
    }
    if (d.type === 'rings' || d.type === 'survey') complete();
  }

  return {
    get active() { return m; },
    start(def) {
      const zones = (def.zones || []).map((z, i) => ({
        ...z, hit: false, letter: String.fromCharCode(65 + i),
      }));
      m = {
        def,
        phase: def.type === 'mixed' ? 'gates' : def.type === 'landing' ? 'landing' : def.type === 'drop' ? 'drop' : def.type === 'survey' ? 'survey' : 'gates',
        elapsed: 0, score: 0, cash: 0,
        gatesPassed: 0, dropsHit: 0,
        state: 'active', failReason: null, completeBonus: 0,
        zones, targetStrip: def.strip ? stripById(def.strip) : null,
        events: [],
      };
      if (def.gates) rings.reset(def.gates, def.type);
      else rings.clear();
      particles.setZones(zones);
      event(`${def.name} — ${def.blurb}`);
      return m;
    },
    clear() {
      m = null;
      rings.clear();
      particles.setZones([]);
    },
    // B pressed: drop a crate from the aircraft.
    dropCrate(plane) {
      if (!m || m.state !== 'active') return false;
      if (m.phase !== 'drop') return false;
      if (!plane.airborne) return false;
      particles.dropCrate(plane);
      audio.chime('drop');
      event('Crate away!');
      return true;
    },
    // Called when the flight model reports a landing.
    onLanded(quality, strip, damage) {
      if (!m || m.state !== 'active') return;
      damage.applyLanding(quality);
      if (quality === 'perfect') addScore(CONFIG.scoring.perfectLanding, 'PERFECT LANDING');
      else if (quality === 'good') addScore(CONFIG.scoring.goodLanding, 'GOOD LANDING');
      else addScore(CONFIG.scoring.roughLanding, 'ROUGH LANDING');
      if (m.phase === 'landing' && m.targetStrip && strip.id === m.targetStrip.id) {
        complete();
      } else if (m.phase === 'landing') {
        event(`Landed on ${strip.name} — not the target strip`);
      }
    },
    update(dt, world) {
      if (!m || m.state !== 'active') return;
      const { plane, fuel, damage } = world;
      m.elapsed += dt;

      // Timeout: elapsed past 2.4x par fails the sortie.
      if (m.elapsed > m.def.par * 2.4) {
        fail('out of time');
        return;
      }
      // Fuel exhaustion while airborne fails the sortie.
      if (fuel.empty && plane.airborne) {
        fail('fuel exhausted');
        return;
      }

      // Ring / survey gate passes.
      if (m.phase === 'gates' || m.phase === 'survey') {
        const surveyMaxAlt = m.phase === 'survey' ? 120 : null;
        const passed = rings.update(dt, plane, world.time, surveyMaxAlt);
        if (passed) {
          m.gatesPassed++;
          const isSurvey = m.phase === 'survey';
          addScore(isSurvey ? CONFIG.scoring.surveyGate : CONFIG.scoring.ringGate,
            isSurvey ? 'PHOTO GATE' : 'GATE');
          if (Math.abs(plane.roll) < 18) addScore(CONFIG.scoring.steadyBonus, 'STEADY');
          audio.chime('gate');
          if (rings.nextGate() == null) advancePhase();
        }
      }

      // Dropped crates that have landed.
      for (const crate of particles.crates) {
        if (crate.scored || crate.state !== 'landed') continue;
        crate.scored = true;
        if (m.phase !== 'drop') continue;
        let best = null;
        let bestD = Infinity;
        for (const z of m.zones) {
          if (z.hit) continue;
          const d = Math.hypot(crate.x - z.x, crate.z - z.z);
          if (d < bestD) { bestD = d; best = z; }
        }
        if (!best) continue;
        const S = CONFIG.scoring;
        if (bestD < 12) { addScore(S.dropBullseye, 'BULLSEYE'); best.hit = true; m.dropsHit++; }
        else if (bestD < S.dropZoneRadius) { addScore(S.dropInZone, 'IN ZONE'); best.hit = true; m.dropsHit++; }
        else if (bestD < S.dropNearRadius) { addScore(S.dropNear, 'JUST OUTSIDE'); }
        else event(`Crate landed ${Math.round(bestD)} m from Zone ${best.letter}`);
        if (m.dropsHit >= m.zones.length) {
          if (m.def.type === 'mixed') advancePhase();
          else complete();
        }
      }

      // Smooth-flight bonus and penalties, per second.
      if (plane.airborne) {
        const bank = Math.abs(plane.roll);
        if (bank < 20 && plane.speed >= 30 && plane.speed <= 90) {
          m.score += CONFIG.scoring.smoothPerSec * dt;
          m.cash = Math.round(m.score * CONFIG.scoring.cashPerScore);
        }
        if (bank > 55) {
          m.score = Math.max(0, m.score - CONFIG.scoring.hardBankPerSec * dt);
          m.cash = Math.round(m.score * CONFIG.scoring.cashPerScore);
        }
        if (plane.speed > CONFIG.flight.overspeed) {
          m.score = Math.max(0, m.score - CONFIG.scoring.overspeedPerSec * dt);
          m.cash = Math.round(m.score * CONFIG.scoring.cashPerScore);
          damage.applyOverspeed(dt);
        }
      }
      void clamp;
    },
    fail,
    waypoint() { return waypointFor(); },
    objective() { return objectiveFor(); },
    takeEvents() {
      if (!m) return [];
      const ev = m.events;
      m.events = [];
      return ev;
    },
  };
}
