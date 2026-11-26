// runway.js — strip meshes, edge lights, windsocks, hangar; answers
// whether a point is on a strip (used by the flight model and missions).

import { CONFIG } from './config.js';

function stripFrame(strip) {
  const r = (strip.heading * Math.PI) / 180;
  return {
    dir: { x: Math.sin(r), z: -Math.cos(r) },
    perp: { x: Math.cos(r), z: Math.sin(r) },
  };
}

export function stripLocal(strip, x, z) {
  const f = stripFrame(strip);
  const dx = x - strip.x;
  const dz = z - strip.z;
  return {
    along: dx * f.dir.x + dz * f.dir.z,
    across: dx * f.perp.x + dz * f.perp.z,
  };
}

export function onStripAt(strip, x, z) {
  const { along, across } = stripLocal(strip, x, z);
  return Math.abs(along) <= strip.length / 2 && Math.abs(across) <= strip.width / 2;
}

export function createRunways(scene, heightAt) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2e2e33, roughness: 0.9 });
  const white = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
  const amberLight = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  const amberGlow = new THREE.MeshStandardMaterial({
    color: 0xff9a20, emissive: 0xff8a10, emissiveIntensity: 1.6,
  });

  for (const strip of CONFIG.strips) {
    const f = stripFrame(strip);
    const y = strip.shelf;
    const group = new THREE.Group();
    group.position.set(strip.x, y + 0.15, strip.z);
    group.rotation.y = (strip.heading * Math.PI) / 180;
    // In strip-local space the strip runs along -Z (heading convention).
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(strip.width, 0.3, strip.length), asphalt);
    group.add(ribbon);
    // White centreline dashes.
    const dashes = Math.floor(strip.length / 16);
    for (let i = 0; i < dashes; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 6), white);
      dash.position.set(0, 0.2, -strip.length / 2 + 8 + i * 16);
      group.add(dash);
    }
    // Threshold bars at both ends.
    for (const end of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(strip.width - 2, 0.1, 2.2), white);
      bar.position.set(0, 0.2, end * (strip.length / 2 - 4));
      group.add(bar);
    }
    // Warm amber edge lights every 22 m on both sides.
    const lights = Math.floor(strip.length / 22);
    for (let i = 0; i <= lights; i++) {
      for (const side of [-1, 1]) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), amberGlow);
        bulb.position.set(side * (strip.width / 2 + 1.2), 0.5, -strip.length / 2 + i * 22);
        group.add(bulb);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25),
          new THREE.MeshStandardMaterial({ color: 0x555555 }));
        post.position.set(side * (strip.width / 2 + 1.2), 0, -strip.length / 2 + i * 22);
        group.add(post);
      }
    }
    scene.add(group);

    // Windsock on a pole beside the strip.
    const sockX = strip.x + f.perp.x * (strip.width / 2 + 14);
    const sockZ = strip.z + f.perp.z * (strip.width / 2 + 14);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888 }),
    );
    pole.position.set(sockX, y + 4.5, sockZ);
    scene.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xff6a20, roughness: 0.8 }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(sockX + 2.4, y + 8.4, sockZ);
    scene.add(sock);

    // Hangar with a curved roof at Kestrel Field.
    if (strip.id === 'kestrel') {
      const hx = strip.x + f.perp.x * 34;
      const hz = strip.z + f.perp.z * 34;
      const hangar = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 20),
        new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.9 }));
      walls.position.y = 4.5;
      hangar.add(walls);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 26, 12, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.7 }));
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.y = 9;
      hangar.add(roof);
      hangar.position.set(hx, y, hz);
      hangar.rotation.y = (strip.heading * Math.PI) / 180;
      scene.add(hangar);
    }
    void amberLight;
  }

  return {
    strips: CONFIG.strips,
    // Returns the strip a point is over, or null.
    onStrip(x, z) {
      for (const s of CONFIG.strips) {
        if (onStripAt(s, x, z)) return s;
      }
      return null;
    },
    stripFrame,
    stripLocal,
  };
}
