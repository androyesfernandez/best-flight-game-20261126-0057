// sky.js — gradient dawn dome, low eastern sun, brightened lights,
// small violet-grey storm clouds, rain shafts and lightning flashes.
// The clouds are kept high and off the cover/rings sightlines so they
// read as weather, not broken geometry, at contact-sheet size.

import { CONFIG } from './config.js';
import { mulberry32 } from './rng.js';

export function createSky(scene) {
  const rand = mulberry32(CONFIG.seed * 17 + 3);
  const group = new THREE.Group();
  scene.add(group);

  // Vertex-coloured gradient dome: indigo top, violet middle, ember horizon.
  const domeGeo = new THREE.SphereGeometry(1900, 24, 16);
  const top = new THREE.Color(CONFIG.colours.skyTop);
  const mid = new THREE.Color(CONFIG.colours.skyMid);
  const hor = new THREE.Color(CONFIG.colours.skyHorizon);
  const pos = domeGeo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 1900; // -1..1
    if (y > 0.25) tmp.copy(mid).lerp(top, (y - 0.25) / 0.75);
    else tmp.copy(hor).lerp(mid, (y + 0.12) / 0.37);
    colours[i * 3] = tmp.r;
    colours[i * 3 + 1] = tmp.g;
    colours[i * 3 + 2] = tmp.b;
  }
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const dome = new THREE.Mesh(
    domeGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  group.add(dome);

  // Pale sun disc low in the east, plus a warm glow sprite.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: CONFIG.colours.sun, fog: false }),
  );
  sun.position.set(1500, 130, -260);
  sun.lookAt(0, 130, 0);
  group.add(sun);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(190, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a55, transparent: true, opacity: 0.28, fog: false }),
  );
  glow.position.set(1500, 130, -260);
  glow.lookAt(0, 130, 0);
  group.add(glow);

  // Lights, raised ~20% over the first draft so islands read at small size.
  const hemi = new THREE.HemisphereLight(0x8a7fd0, 0x3a4a3a, 0.95);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffc890, 1.7);
  sunLight.position.set(900, 260, -300);
  scene.add(sunLight);
  const fill = new THREE.DirectionalLight(0x6a7fd0, 0.35);
  fill.position.set(-600, 400, 500);
  scene.add(fill);

  // Storm clouds: small flattened violet-grey icosahedrons with a warm
  // rim (lit from the east by the sun light). They drift slowly and sit
  // high (300-390 m), mostly over the north-east storm band, clear of
  // the direct cover/rings sightline (low, toward the east horizon),
  // so they read as weather, not black slabs, at contact-sheet size.
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0x7d7694, roughness: 1, metalness: 0,
    emissive: 0x4a3a55, emissiveIntensity: 0.9, flatShading: true,
  });
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const clump = new THREE.Group();
    const puffs = 2 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      const s = 18 + rand() * 24;
      puff.scale.set(s * (1.4 + rand() * 0.8), s * 0.32, s * (0.9 + rand() * 0.6));
      puff.position.set((rand() - 0.5) * 70, (rand() - 0.5) * 10, (rand() - 0.5) * 50);
      clump.add(puff);
    }
    // Bias the band to the north-east; keep the east-horizon sightline clear.
    const bandX = -300 + rand() * 1300;
    const bandZ = -750 + rand() * 900;
    clump.position.set(bandX, 300 + rand() * 90, bandZ);
    clump.userData.drift = 1.5 + rand() * 2.5;
    group.add(clump);
    clouds.push(clump);
  }

  // Eight translucent vertical rain shafts under the storm band.
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0x8fa8c8, transparent: true, opacity: 0.13, depthWrite: false,
  });
  const shafts = [];
  for (let i = 0; i < 8; i++) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(28, 40, 260, 10, 1, true), shaftMat);
    shaft.position.set(-200 + rand() * 1100, 130, -700 + rand() * 800);
    group.add(shaft);
    shafts.push(shaft);
  }

  // Lightning: a point light high over the storm band, flashing randomly.
  const flash = new THREE.PointLight(0xcfd8ff, 0, 1600, 1.2);
  flash.position.set(500, 420, -300);
  scene.add(flash);
  let flashTimer = 4 + rand() * 5;
  let flashLeft = 0;

  return {
    update(dt, t) {
      for (const c of clouds) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 1350) c.position.x = -1350;
      }
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flashLeft = 0.16;
        flashTimer = 5 + rand() * 7;
        flash.position.set(200 + rand() * 700, 420, -500 + rand() * 500);
      }
      if (flashLeft > 0) {
        flashLeft -= dt;
        flash.intensity = flashLeft > 0.08 ? 900 : 250;
      } else {
        flash.intensity = 0;
      }
      void t;
    },
  };
}
