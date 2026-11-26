// minimap.js — radar minimap: a 220 px canvas, north up, bottom-left.
// Islands as green shapes, strips as amber dashes, gates as amber or
// green dots, drop zones as red or green rings, the waypoint as a white
// diamond, the storm front as a shaded band, the Petrel as a white wedge
// with a heading line.

import { CONFIG, bearingTo } from './config.js';

export function createMinimap(canvas, rings, missions) {
  const ctx = canvas.getContext('2d');
  const SIZE = 220;
  const WORLD = 2600;
  const scale = SIZE / WORLD;

  function toMap(x, z) {
    return [SIZE / 2 + x * scale, SIZE / 2 + z * scale];
  }

  function draw(snapshot) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Panel.
    ctx.fillStyle = 'rgba(8,12,24,0.72)';
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,200,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 3, 0, Math.PI * 2);
    ctx.clip();

    // Storm front as a shaded band (diagonal across the north-east).
    ctx.fillStyle = 'rgba(150,120,200,0.20)';
    ctx.beginPath();
    const [bx1, by1] = toMap(-200, -800);
    const [bx2, by2] = toMap(900, 300);
    ctx.moveTo(bx1 - 26, by1);
    ctx.lineTo(bx2 - 26, by2);
    ctx.lineTo(bx2 + 26, by2);
    ctx.lineTo(bx1 + 26, by1);
    ctx.closePath();
    ctx.fill();

    // Islands as green shapes.
    for (const isl of CONFIG.islands) {
      const [cx, cy] = toMap(isl.x, isl.z);
      ctx.fillStyle = 'rgba(90,180,110,0.75)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, isl.radius * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    // Strips as amber dashes.
    for (const s of CONFIG.strips) {
      const [sx, sy] = toMap(s.x, s.z);
      const [ex, ey] = toMap(
        s.x + Math.sin((s.heading * Math.PI) / 180) * s.length,
        s.z - Math.cos((s.heading * Math.PI) / 180) * s.length,
      );
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(sx - (ex - sx) / 2, sy - (ey - sy) / 2);
      ctx.lineTo(sx + (ex - sx) / 2, sy + (ey - sy) / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Ring gates as amber (next) or green (passed) dots.
    for (const g of rings.gates) {
      const [gx, gy] = toMap(g.x, g.z);
      const next = rings.nextGate();
      ctx.fillStyle = g.passed ? '#37d67a' : g === next ? '#ffb020' : '#5a8fd0';
      ctx.beginPath();
      ctx.arc(gx, gy, g === next ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Drop zones as red or green rings.
    const m = missions.active;
    if (m) {
      for (const z of m.zones || []) {
        const [zx, zy] = toMap(z.x, z.z);
        ctx.strokeStyle = z.hit ? '#37d67a' : '#ff5040';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(zx, zy, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Waypoint as a white diamond.
    const wp = snapshot.mission && snapshot.mission.waypoint;
    if (wp) {
      const [wx, wy] = toMap(wp.x, wp.z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(wx, wy - 6);
      ctx.lineTo(wx + 5, wy);
      ctx.lineTo(wx, wy + 6);
      ctx.lineTo(wx - 5, wy);
      ctx.closePath();
      ctx.fill();
    }
    // The Petrel as a white wedge with a heading line.
    const [px, py] = toMap(snapshot.planeX, snapshot.planeZ);
    const hdg = (snapshot.hdgDeg * Math.PI) / 180;
    const hx = Math.sin(hdg);
    const hz = -Math.cos(hdg);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + hx * 16, py + hz * 16);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(px + hx * 8, py + hz * 8);
    ctx.lineTo(px + hx * 4 - hz * 5, py + hz * 4 + hx * 5);
    ctx.lineTo(px + hx * 4 + hz * 5, py + hz * 4 - hx * 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // North marker.
    ctx.fillStyle = 'rgba(200,220,255,0.9)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', SIZE / 2, 14);
    void bearingTo;
  }

  return { draw, SIZE };
}
