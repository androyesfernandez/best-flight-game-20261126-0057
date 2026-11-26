// particles.js — rain band following the aircraft, touchdown smoke,
// falling supply crates with parachute canopies, drop-zone markers.

import { CONFIG } from './config.js';
import { mulberry32 } from './rng.js';

export function createParticles(scene, heightAt) {
  const rand = mulberry32(CONFIG.seed * 13 + 2);
  const group = new THREE.Group();
  scene.add(group);

  // 900 rain points in a band that follows the aircraft.
  const RAIN = 900;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) {
    rainPos[i * 3] = (rand() - 0.5) * 420;
    rainPos[i * 3 + 1] = rand() * 220;
    rainPos[i * 3 + 2] = (rand() - 0.5) * 420;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0xaac4de, size: 1.6, transparent: true, opacity: 0.5, sizeAttenuation: true,
  }));
  group.add(rain);

  const smokePuffs = [];
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xcfc8bd, transparent: true, opacity: 0.5, depthWrite: false,
  });
  const crates = [];

  // Drop-zone markers: amber ground rings with a light beam.
  let zoneMarkers = [];
  const zoneRingMat = new THREE.MeshBasicMaterial({
    color: 0xffb020, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
  });
  const zoneBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffb020, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  });

  function setZones(zones) {
    for (const zm of zoneMarkers) group.remove(zm);
    zoneMarkers = [];
    for (const z of zones) {
      const marker = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(22, 25, 32), zoneRingMat.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = heightAt(z.x, z.z) + 0.6;
      marker.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 160, 10, 1, true), zoneBeamMat.clone());
      beam.position.y = 80;
      marker.add(beam);
      marker.position.set(z.x, 0, z.z);
      marker.userData.zone = z;
      group.add(marker);
      zoneMarkers.push(marker);
    }
  }

  function dropCrate(plane) {
    const crate = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xb0702a, roughness: 0.85 }));
    crate.add(box);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xd23a2a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    canopy.position.y = 3.4;
    crate.add(canopy);
    crate.position.set(plane.x, plane.y - 2, plane.z);
    group.add(crate);
    const c = {
      mesh: crate, x: plane.x, y: plane.y - 2, z: plane.z,
      vx: Math.sin((plane.heading * Math.PI) / 180) * plane.speed * 0.6,
      vz: -Math.cos((plane.heading * Math.PI) / 180) * plane.speed * 0.6,
      vy: plane.vy * 0.5, state: 'falling', scored: false, t: 0,
    };
    crates.push(c);
    return c;
  }

  function smoke(x, y, z) {
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.6 + rand() * 1.4, 8, 6), smokeMat.clone());
      puff.position.set(x + (rand() - 0.5) * 4, y + rand() * 1.5, z + (rand() - 0.5) * 4);
      puff.userData.life = 1;
      group.add(puff);
      smokePuffs.push(puff);
    }
  }

  function update(dt, planePos, time) {
    // Rain follows the aircraft and falls.
    rain.position.set(planePos.x, planePos.y, planePos.z);
    const p = rainGeo.attributes.position;
    for (let i = 0; i < RAIN; i++) {
      let y = p.getY(i) - 95 * dt;
      if (y < -20) y = 200;
      p.setY(i, y);
    }
    p.needsUpdate = true;

    // Smoke puffs expand and fade.
    for (let i = smokePuffs.length - 1; i >= 0; i--) {
      const puff = smokePuffs[i];
      puff.userData.life -= dt * 0.8;
      if (puff.userData.life <= 0) {
        group.remove(puff);
        smokePuffs.splice(i, 1);
        continue;
      }
      puff.scale.multiplyScalar(1 + dt * 1.4);
      puff.material.opacity = 0.5 * puff.userData.life;
    }

    // Crates fall with drag; the canopy slows the descent.
    for (const c of crates) {
      if (c.state !== 'falling') continue;
      c.t += dt;
      c.vy = Math.max(-11, c.vy - 9.8 * dt * 0.55);
      c.vx *= 1 - 0.25 * dt;
      c.vz *= 1 - 0.25 * dt;
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      c.y += c.vy * dt;
      c.mesh.position.set(c.x, c.y, c.z);
      c.mesh.rotation.y += dt * 0.8;
      const ground = heightAt(c.x, c.z);
      if (c.y <= ground + 1.2) {
        c.y = ground + 1.2;
        c.mesh.position.y = c.y;
        c.state = 'landed';
      }
    }

    // Drop-zone rings pulse; hit zones turn green.
    for (const zm of zoneMarkers) {
      const z = zm.userData.zone;
      const pulse = 0.6 + Math.sin(time * 3) * 0.18;
      zm.children[0].material.opacity = z.hit ? 0.9 : pulse;
      if (z.hit) zm.children[0].material.color.setHex(0x37d67a);
    }
    void time;
  }

  return { update, smoke, dropCrate, setZones, crates };
}
