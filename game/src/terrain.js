// terrain.js — island heightfield, sea, pines, Port Lumen town,
// lighthouse with sweeping beam, harbour boats. Owns heightAt(x, z),
// the one terrain function every other system uses.

import { CONFIG, clamp, smoothstep } from './config.js';
import { mulberry32, makeNoise } from './rng.js';

function stripLocal(strip, x, z) {
  const r = (strip.heading * Math.PI) / 180;
  const dx = x - strip.x;
  const dz = z - strip.z;
  // Strip direction (sin h, -cos h); across is perpendicular.
  const along = dx * Math.sin(r) + dz * -Math.cos(r);
  const across = dx * -Math.cos(r) * -1 + dz * Math.sin(r) * -1;
  // Simpler perpendicular: across = dx * cos(r) + dz * sin(r) with sign.
  return { along, across: dx * Math.cos(r) + dz * Math.sin(r) };
}

export function rawHeightAt(x, z, noise) {
  let h = 0;
  for (const isl of CONFIG.islands) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d2 = (dx * dx + dz * dz) / (isl.radius * isl.radius);
    h += isl.height * Math.exp(-2.0 * d2);
  }
  if (h < 1) return -3; // sea floor
  return h + noise(x * 0.012, z * 0.012) * 2.2;
}

export function heightAt(x, z, noise) {
  const raw = rawHeightAt(x, z, noise);
  let h = raw;
  for (const strip of CONFIG.strips) {
    const { along, across } = stripLocal(strip, x, z);
    const d = Math.max(
      Math.abs(across) - (strip.width / 2 + 30),
      Math.abs(along) - (strip.length / 2 + 30),
    );
    if (d <= 0) {
      h = strip.shelf;
    } else if (d < 120) {
      const t = smoothstep(d / 120);
      h = strip.shelf + (h - strip.shelf) * t;
    }
  }
  return h;
}

export function createTerrain(scene) {
  const rand = mulberry32(CONFIG.seed * 7 + 1);
  const noise = makeNoise(CONFIG.seed + 11);
  const H = (x, z) => heightAt(x, z, noise);

  // Island heightfield with height-based vertex colours (brightened greens).
  const geo = new THREE.PlaneGeometry(2600, 2600, 110, 110);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(CONFIG.colours.sand);
  const grass = new THREE.Color(CONFIG.colours.grassLight);
  const grassDeep = new THREE.Color(CONFIG.colours.grass);
  const rock = new THREE.Color(CONFIG.colours.rock);
  const pale = new THREE.Color(CONFIG.colours.rockPale);
  const seaFloor = new THREE.Color(0x4a5a52);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = H(x, z);
    pos.setY(i, y);
    if (y < 0.5) tmp.copy(seaFloor);
    else if (y < 3) tmp.copy(sand);
    else if (y < 14) tmp.copy(grassDeep).lerp(grass, (y - 3) / 11);
    else if (y < 26) tmp.copy(grass);
    else if (y < 55) tmp.copy(grass).lerp(rock, (y - 26) / 29);
    else tmp.copy(rock).lerp(pale, Math.min(1, (y - 55) / 25));
    // Slight noise variation so the slopes are not flat colour.
    const v = 0.94 + noise(x * 0.05, z * 0.05) * 0.06;
    colours[i * 3] = tmp.r * v;
    colours[i * 3 + 1] = tmp.g * v;
    colours[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  scene.add(terrain);

  // Sea: large plane with a painted wave texture, lightened steel blue.
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const c2 = cv.getContext('2d');
  c2.fillStyle = '#46667e';
  c2.fillRect(0, 0, 256, 256);
  const seaRand = mulberry32(99);
  for (let i = 0; i < 240; i++) {
    c2.strokeStyle = seaRand() > 0.5 ? 'rgba(210,225,235,0.20)' : 'rgba(20,40,60,0.25)';
    c2.lineWidth = 1 + seaRand() * 2;
    const y = seaRand() * 256;
    c2.beginPath();
    c2.moveTo(seaRand() * 256, y);
    c2.lineTo(seaRand() * 256, y + (seaRand() - 0.5) * 14);
    c2.stroke();
  }
  const seaTex = new THREE.CanvasTexture(cv);
  seaTex.wrapS = THREE.RepeatWrapping;
  seaTex.wrapT = THREE.RepeatWrapping;
  seaTex.repeat.set(10, 10);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(5200, 5200),
    new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.75, metalness: 0.05 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  scene.add(sea);

  // Pines: instanced cones on trunks, on high ground above 10 m.
  const pineSpots = [];
  let guard = 0;
  while (pineSpots.length < CONFIG.pines && guard++ < 20000) {
    const x = (rand() * 2 - 1) * 1200;
    const z = (rand() * 2 - 1) * 1200;
    const y = H(x, z);
    if (y < 10) continue;
    let onStrip = false;
    for (const s of CONFIG.strips) {
      const { along, across } = stripLocal(s, x, z);
      if (Math.abs(along) < s.length / 2 + 40 && Math.abs(across) < s.width / 2 + 40) onStrip = true;
    }
    if (onStrip) continue;
    pineSpots.push({ x, y, z, s: 0.8 + rand() * 0.9 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 });
  const coneGeo = new THREE.ConeGeometry(3.4, 11, 6);
  const coneMat = new THREE.MeshStandardMaterial({ color: CONFIG.colours.pine, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pineSpots.length);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, pineSpots.length);
  const m4 = new THREE.Matrix4();
  pineSpots.forEach((p, i) => {
    m4.makeScale(p.s, p.s, p.s);
    m4.setPosition(p.x, p.y + 2 * p.s, p.z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(p.s, p.s, p.s);
    m4.setPosition(p.x, p.y + (4 + 5.5) * p.s, p.z);
    cones.setMatrixAt(i, m4);
  });
  scene.add(trunks);
  scene.add(cones);

  // Port Lumen: 46 lit town boxes with warm emissive windows.
  const townMat = new THREE.MeshStandardMaterial({
    color: 0x4a4038, roughness: 0.9, emissive: 0xff9a40, emissiveIntensity: 0.55,
  });
  const townMat2 = new THREE.MeshStandardMaterial({
    color: 0x5a4a3c, roughness: 0.9, emissive: 0xffb060, emissiveIntensity: 0.45,
  });
  for (let i = 0; i < CONFIG.town.houses; i++) {
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * 110;
    const x = CONFIG.town.x + Math.cos(a) * r;
    const z = CONFIG.town.z + Math.sin(a) * r * 0.8;
    const y = H(x, z);
    if (y < 2) continue;
    const w = 7 + rand() * 7;
    const hgt = 5 + rand() * 7;
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, w), rand() > 0.5 ? townMat : townMat2);
    house.position.set(x, y + hgt / 2 - 0.5, z);
    house.rotation.y = rand() * Math.PI;
    scene.add(house);
  }

  // Lighthouse on Kestrel's north point, with a sweeping beam.
  const lh = CONFIG.lighthouse;
  const lhY = H(lh.x, lh.z);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.5, 26, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 }),
  );
  tower.position.set(lh.x, lhY + 13, lh.z);
  scene.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.8 }),
  );
  band.position.set(lh.x, lhY + 18, lh.z);
  scene.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffd060, emissiveIntensity: 1.4 }),
  );
  lamp.position.set(lh.x, lhY + 27, lh.z);
  scene.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(9, 150, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(lh.x, lhY + 27, lh.z);
  scene.add(beam);
  const beamPivot = new THREE.Group();
  beamPivot.position.set(lh.x, lhY + 27, lh.z);
  beamPivot.add(beam);
  beam.position.set(75, 0, 0);
  scene.add(beamPivot);

  // Seven fishing boats bobbing in the harbour near Port Lumen.
  const boats = [];
  const boatMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 });
  const boatMat2 = new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.9 });
  for (let i = 0; i < CONFIG.harbourBoats; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 3.4), i % 2 ? boatMat : boatMat2);
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9 }));
    cabin.position.set(-1, 2, 0);
    boat.add(cabin);
    boat.position.set(300 + rand() * 120, 0.6, 300 + rand() * 90);
    boat.rotation.y = rand() * Math.PI * 2;
    boat.userData.phase = rand() * Math.PI * 2;
    scene.add(boat);
    boats.push(boat);
  }

  return {
    heightAt: H,
    update(dt, t) {
      beamPivot.rotation.y = t * 0.5;
      for (const b of boats) {
        b.position.y = 0.6 + Math.sin(t * 0.9 + b.userData.phase) * 0.35;
        b.rotation.z = Math.sin(t * 0.7 + b.userData.phase) * 0.03;
      }
      void dt;
    },
  };
}
