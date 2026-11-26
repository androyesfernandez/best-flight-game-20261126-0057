// audio.js — procedural WebAudio only, created on first user gesture.
// Engine hum from two detuned oscillators through a low-pass filter,
// wind from looped noise through a band-pass filter, short chimes.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 62;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 93;
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.4;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(osc2Gain);
      osc2Gain.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc1.start();
      engineOsc2.start();

      // Looped noise for wind.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.7;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      noise.start();
      started = true;
    } catch (err) {
      ctx = null;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (err) { /* audio is best-effort */ }
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    get muted() { return muted; },
    // Called every frame while flying; pitch and gain follow throttle/speed.
    setEngine(throttle, speed, airborne) {
      if (!ctx || !engineGain) return;
      const t = ctx.currentTime;
      const rpm = 55 + throttle * 90 + speed * 0.35;
      engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.5, t, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
      const target = airborne || throttle > 0.05 ? 0.05 + throttle * 0.11 : 0.02;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, t, 0.1);
      if (windGain) {
        windGain.gain.setTargetAtTime(muted ? 0 : Math.min(0.16, speed * 0.0016), t, 0.15);
        windFilter.frequency.setTargetAtTime(320 + speed * 9, t, 0.15);
      }
    },
    chime(kind) {
      if (!ctx) return;
      if (kind === 'gate') { blip(880, 0.16, 'sine', 0.25); blip(1318, 0.22, 'sine', 0.2, 0.07); }
      else if (kind === 'drop') { blip(520, 0.12, 'triangle', 0.25); }
      else if (kind === 'complete') { blip(660, 0.18, 'sine', 0.25); blip(880, 0.18, 'sine', 0.25, 0.1); blip(1320, 0.3, 'sine', 0.22, 0.2); }
      else if (kind === 'fail') { blip(220, 0.4, 'sawtooth', 0.15); }
    },
    thunk() { blip(90, 0.18, 'sine', 0.4); },
    alarm() { blip(1240, 0.09, 'square', 0.12); blip(1240, 0.09, 'square', 0.12, 0.14); },
  };
}
