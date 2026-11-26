// save.js — localStorage bests, unlocks and save slots under one
// versioned key. Storage is optional: if the host blocks it, scores
// last the visit only (in-memory fallback).

const KEY = 'stormwing-courier-v1';

function blankProfile() {
  return {
    bests: {},       // mission id -> { score, time }
    totalScore: 0,
    cash: 0,
    unlocked: [1, 2, 3, 4, 5, 6, 7, 8], // all 8 sorties playable by default
    slots: [
      { name: 'Slot 1', totalScore: 0, bests: {} },
      { name: 'Slot 2', totalScore: 0, bests: {} },
      { name: 'Slot 3', totalScore: 0, bests: {} },
    ],
  };
}

let memoryProfile = null;

export function loadSave() {
  if (memoryProfile) return memoryProfile;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const prof = blankProfile();
      Object.assign(prof, parsed);
      prof.bests = parsed.bests || {};
      prof.unlocked = [1, 2, 3, 4, 5, 6, 7, 8];
      prof.slots = parsed.slots && parsed.slots.length === 3 ? parsed.slots : prof.slots;
      memoryProfile = prof;
      return prof;
    }
  } catch (err) { /* storage blocked: in-memory only */ }
  memoryProfile = blankProfile();
  return memoryProfile;
}

export function persistSave(profile) {
  memoryProfile = profile;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch (err) { /* storage blocked */ }
}

export function recordBest(profile, missionId, score, time) {
  const prev = profile.bests[missionId];
  if (!prev || score > prev.score) {
    profile.bests[missionId] = { score: Math.round(score), time: Math.round(time) };
  } else if (time < prev.time && score === prev.score) {
    profile.bests[missionId].time = Math.round(time);
  }
  profile.totalScore += Math.round(score);
  profile.cash += Math.round(score * 1.5);
  persistSave(profile);
}

export function saveToSlot(profile, slotIndex) {
  const slot = profile.slots[slotIndex];
  if (!slot) return;
  slot.totalScore = profile.totalScore;
  slot.bests = { ...profile.bests };
  persistSave(profile);
}

export function loadFromSlot(profile, slotIndex) {
  const slot = profile.slots[slotIndex];
  if (!slot) return;
  profile.totalScore = slot.totalScore || 0;
  profile.bests = { ...(slot.bests || {}) };
  persistSave(profile);
}
