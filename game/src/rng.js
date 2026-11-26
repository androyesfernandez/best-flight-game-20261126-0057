// rng.js — seeded mulberry-style random plus 2D value noise.
// Deterministic: the same seed always gives the same world and weather.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise on a grid, seeded. Returns a function f(x, z)
// in roughly [-1, 1]. Cheap and stable for terrain detail.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand() * 2 - 1;
  const at = (ix, iz) => grid[((iz % size + size) % size) * size + ((ix % size + size) % size)];
  const fade = (t) => t * t * (3 - 2 * t);
  return function noise(x, z) {
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    const tx = fade(x - fx);
    const tz = fade(z - fz);
    const a = at(fx, fz);
    const b = at(fx + 1, fz);
    const c = at(fx, fz + 1);
    const d = at(fx + 1, fz + 1);
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };
}
