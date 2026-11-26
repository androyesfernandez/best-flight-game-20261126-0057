// menu.js — title, pause and debrief overlays, the eight-button sortie
// list (all 8 playable by default, with best scores), save slots and
// the Fly / Free Flight buttons.

import { CONFIG } from './config.js';

export function createMenu(doc, callbacks) {
  const $ = (id) => doc.getElementById(id);
  const titleScreen = $('title-screen');
  const pauseScreen = $('pause-screen');
  const debriefScreen = $('debrief-screen');
  const sortieList = $('sortie-list');
  const slotsRow = $('save-slots');
  const debriefTitle = $('debrief-title');
  const debriefReason = $('debrief-reason');
  const debriefStats = $('debrief-stats');

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function buildSortieList(profile) {
    if (!sortieList) return;
    sortieList.innerHTML = '';
    for (const m of CONFIG.missions) {
      const best = profile.bests[m.id];
      const btn = doc.createElement('button');
      btn.className = 'sortie-btn';
      btn.dataset.mission = String(m.id);
      btn.innerHTML =
        `<span class="sortie-num">${m.id}</span>` +
        `<span class="sortie-name">${m.name}</span>` +
        `<span class="sortie-type">${m.type.toUpperCase()} · PAR ${fmtTime(m.par)} · $${m.reward}</span>` +
        `<span class="sortie-best">${best ? `BEST ${Math.round(best.score)} · ${fmtTime(best.time)}` : 'NOT FLOWN YET'}</span>`;
      btn.addEventListener('click', () => callbacks.onPickSortie(m.id));
      sortieList.appendChild(btn);
    }
  }

  function buildSlots(profile) {
    if (!slotsRow) return;
    slotsRow.innerHTML = '';
    profile.slots.forEach((slot, i) => {
      const btn = doc.createElement('button');
      btn.className = 'slot-btn';
      btn.textContent = `${slot.name} — ${Math.round(slot.totalScore || 0)} PTS`;
      btn.title = 'Click to load this slot; Shift-click to save into it';
      btn.addEventListener('click', (e) => {
        if (e.shiftKey) callbacks.onSaveSlot(i);
        else callbacks.onLoadSlot(i);
      });
      slotsRow.appendChild(btn);
    });
  }

  function refresh(profile) {
    buildSortieList(profile);
    buildSlots(profile);
  }

  function show(name) {
    // Hide the flight HUD behind the title screen so the menu is clean.
    doc.body.classList.toggle('on-title', name === 'title');
    for (const el of [titleScreen, pauseScreen, debriefScreen]) {
      if (el) el.classList.toggle('hidden', el !== { title: titleScreen, pause: pauseScreen, debrief: debriefScreen }[name]);
    }
    if (name === 'none') {
      for (const el of [titleScreen, pauseScreen, debriefScreen]) {
        if (el) el.classList.add('hidden');
      }
    }
  }

  function showDebrief(result) {
    if (debriefTitle) debriefTitle.textContent = result.complete ? 'SORTIE COMPLETE' : 'SORTIE FAILED';
    if (debriefReason) debriefReason.textContent = result.reason || '';
    if (debriefStats) {
      debriefStats.innerHTML = '';
      const boxes = [
        ['SCORE', `${Math.round(result.score)}`],
        ['TIME', fmtTime(result.time)],
        ['FUEL LEFT', `${Math.round(result.fuel)}%`],
        ['AIRCRAFT', `${Math.round(result.integrity)}%`],
      ];
      for (const [label, value] of boxes) {
        const div = doc.createElement('div');
        div.className = 'stat-box';
        div.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value">${value}</span>`;
        debriefStats.appendChild(div);
      }
    }
    show('debrief');
  }

  const flyBtn = $('btn-fly-1');
  if (flyBtn) flyBtn.addEventListener('click', () => callbacks.onPickSortie(1));
  const freeBtn = $('btn-free');
  if (freeBtn) freeBtn.addEventListener('click', () => callbacks.onFreeFlight());
  const resumeBtn = $('btn-resume');
  if (resumeBtn) resumeBtn.addEventListener('click', () => callbacks.onResume());
  const quitBtn = $('btn-quit');
  if (quitBtn) quitBtn.addEventListener('click', () => callbacks.onQuitToTitle());
  const againBtn = $('btn-again');
  if (againBtn) againBtn.addEventListener('click', () => callbacks.onAgain());
  const titleBtn = $('btn-to-title');
  if (titleBtn) titleBtn.addEventListener('click', () => callbacks.onQuitToTitle());

  return { show, showDebrief, refresh, buildSortieList, buildSlots };
}
