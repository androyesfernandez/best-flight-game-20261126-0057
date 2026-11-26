// hud.js — all HUD DOM updates and the banner. The HUD is DOM, not
// canvas, so it stays crisp. The VERT sublabel is dynamic: CLIMB only
// when vertical speed is positive, DESCEND when negative, LEVEL near
// zero — never hardcoded.

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const els = {
    alt: $('hud-alt'), spd: $('hud-spd'), hdg: $('hud-hdg'),
    vsi: $('hud-vsi'), vsiLabel: $('hud-vsi-label'), compass: $('hud-compass'),
    score: $('hud-score'), cash: $('hud-cash'), rank: $('hud-rank'),
    rankFill: $('hud-rank-fill'), nextRank: $('hud-next-rank'),
    missionName: $('hud-mission-name'), missionStage: $('hud-mission-stage'),
    missionObjective: $('hud-mission-objective'), missionTimer: $('hud-mission-timer'),
    missionWaypoint: $('hud-mission-waypoint'),
    throttleFill: $('hud-throttle-fill'), throttlePct: $('hud-throttle-pct'),
    fuelFill: $('hud-fuel-fill'), fuelPct: $('hud-fuel-pct'),
    aircraftFill: $('hud-aircraft-fill'), aircraftPct: $('hud-aircraft-pct'),
    fuelRow: $('hud-fuel-row'), aircraftRow: $('hud-aircraft-row'),
    flaps: $('hud-chip-flaps'), gear: $('hud-chip-gear'),
    wind: $('hud-chip-wind'), camera: $('hud-chip-camera'),
    event: $('hud-event'), banner: $('hud-banner'),
  };
  let bannerTimer = null;
  let lastEvent = '';

  const CARDINALS = [
    [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
    [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'], [360, 'N'],
  ];
  function cardinal(deg) {
    let best = CARDINALS[0];
    let bestD = 999;
    for (const [d, label] of CARDINALS) {
      const diff = Math.abs(((deg - d + 540) % 360) - 180);
      if (diff < bestD) { bestD = diff; best = [d, label]; }
    }
    return best[1];
  }

  function compassStrip(hdg) {
    let parts = [];
    for (let off = -60; off <= 60; off += 15) {
      const deg = ((Math.round(hdg + off) % 360) + 360) % 360;
      const isCard = CARDINALS.some(([d]) => d === deg);
      const label = isCard ? cardinal(deg) : String(deg).padStart(3, '0');
      const mark = off === 0 ? '▾' : '·';
      parts.push(`${mark}${label}`);
    }
    return parts.join('  ');
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  return {
    update(s) {
      if (els.alt) els.alt.textContent = `${Math.round(s.altFt)} FT`;
      if (els.spd) els.spd.textContent = `${Math.round(s.spdKt)} KT`;
      if (els.hdg) els.hdg.textContent = `${String(Math.round(s.hdgDeg)).padStart(3, '0')}° ${cardinal(s.hdgDeg)}`;
      if (els.vsi) {
        const v = Math.round(s.vsiFpm);
        els.vsi.textContent = `${v >= 0 ? '+' : ''}${v} FPM`;
      }
      if (els.vsiLabel) {
        // Dynamic: climb / descend / level from the actual vertical speed.
        els.vsiLabel.textContent = s.vsiFpm > 40 ? 'CLIMB' : s.vsiFpm < -40 ? 'DESCEND' : 'LEVEL';
      }
      if (els.compass) els.compass.textContent = compassStrip(s.hdgDeg);
      if (els.score) els.score.textContent = `${Math.round(s.score)}`;
      if (els.cash) els.cash.textContent = `$${Math.round(s.cash)}`;
      if (els.rank) els.rank.textContent = s.rankName;
      if (els.rankFill) els.rankFill.style.width = `${Math.round(s.rankProgress * 100)}%`;
      if (els.nextRank) {
        els.nextRank.textContent = s.nextRankName
          ? `Next: ${s.nextRankName} (${Math.round(s.rankProgress * 100)}%)`
          : 'Top rank reached';
      }
      if (s.mission) {
        if (els.missionName) els.missionName.textContent = `SORTIE ${s.mission.id} — ${s.mission.name}`;
        if (els.missionStage) els.missionStage.textContent = s.mission.stage;
        if (els.missionObjective) els.missionObjective.textContent = s.mission.objective;
        if (els.missionTimer) els.missionTimer.textContent = `${fmtTime(s.mission.elapsed)} / ${fmtTime(s.mission.par)}`;
        if (els.missionWaypoint) {
          els.missionWaypoint.textContent = s.mission.waypoint
            ? `${s.mission.waypoint.label} — ${Math.round(s.mission.waypoint.dist)} m`
            : '—';
        }
      } else {
        if (els.missionName) els.missionName.textContent = 'FREE FLIGHT';
        if (els.missionStage) els.missionStage.textContent = 'Explore';
        if (els.missionObjective) els.missionObjective.textContent = 'Explore the Kestrel Isles. Land on any strip to refuel.';
        if (els.missionTimer) els.missionTimer.textContent = fmtTime(s.elapsed || 0);
        if (els.missionWaypoint) els.missionWaypoint.textContent = '—';
      }
      if (els.throttleFill) els.throttleFill.style.width = `${Math.round(s.throttlePct)}%`;
      if (els.throttlePct) els.throttlePct.textContent = `${Math.round(s.throttlePct)}%`;
      if (els.fuelFill) els.fuelFill.style.width = `${Math.round(s.fuelPct)}%`;
      if (els.fuelPct) els.fuelPct.textContent = `${Math.round(s.fuelPct)}%`;
      if (els.aircraftFill) els.aircraftFill.style.width = `${Math.round(s.integrityPct)}%`;
      if (els.aircraftPct) els.aircraftPct.textContent = `${Math.round(s.integrityPct)}%`;
      if (els.fuelRow) els.fuelRow.classList.toggle('low', s.fuelPct < 25);
      if (els.aircraftRow) els.aircraftRow.classList.toggle('low', s.integrityPct < 30);
      if (els.flaps) els.flaps.textContent = s.flaps ? 'FLAPS DOWN' : 'FLAPS UP';
      if (els.gear) els.gear.textContent = s.gearDown ? 'GEAR DOWN' : 'GEAR UP';
      if (els.wind) els.wind.textContent = `WIND ${String(Math.round(s.windDir)).padStart(3, '0')}° ${s.windSpeed.toFixed(0)} m/s`;
      if (els.camera) els.camera.textContent = s.cameraMode === 'cockpit' ? 'CAM COCKPIT' : 'CAM CHASE';
      if (els.event && s.eventLine && s.eventLine !== lastEvent) {
        els.event.textContent = s.eventLine;
        lastEvent = s.eventLine;
      }
    },
    banner(text, ms = 2600) {
      if (!els.banner) return;
      els.banner.textContent = text;
      els.banner.classList.add('show');
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => els.banner.classList.remove('show'), ms);
    },
    setEvent(text) {
      lastEvent = '';
      if (els.event) els.event.textContent = text;
    },
  };
}
