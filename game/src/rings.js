// rings.js — ring gate meshes, the amber beacon beam over the next
// gate, and pass detection (inside 90% of the radius).

import { CONFIG } from './config.js';

export function createRings(scene) {
  const group = new THREE.Group();
  scene.add(group);
  let gates = [];
  let beam = null;
  let beamLight = null;

  const amberMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colours.gateAmber, emissive: 0xff8a10, emissiveIntensity: 1.1,
    roughness: 0.4, transparent: true, opacity: 0.95,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colours.gateBlue, emissive: 0x1a5aff, emissiveIntensity: 0.7,
    roughness: 0.4, transparent: true, opacity: 0.85,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: CONFIG.colours.gateGreen, emissive: 0x1aff66, emissiveIntensity: 0.8,
    roughness: 0.4, transparent: true, opacity: 0.85,
  });

  function clear() {
    for (const g of gates) group.remove(g.mesh);
    gates = [];
    if (beam) { group.remove(beam); beam = null; }
    if (beamLight) { group.remove(beamLight); beamLight = null; }
  }

  function reset(gateDefs, kind) {
    clear();
    gates = gateDefs.map((def, i) => {
      const radius = 16 + (i % 3);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.1, 10, 40), blueMat);
      mesh.position.set(def.x, def.y, def.z);
      // Face the gate toward the previous gate / start so the pilot
      // flies through it, not past its edge.
      const prev = i > 0 ? gateDefs[i - 1] : { x: CONFIG.spawn.x, y: def.y, z: CONFIG.spawn.z };
      mesh.lookAt(prev.x, def.y, prev.z);
      group.add(mesh);
      return { ...def, radius, passed: false, mesh, index: i };
    });
    // Translucent amber beacon beam rising from the next gate.
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3.4, 260, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffb020, transparent: true, opacity: 0.22,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    group.add(beam);
    beamLight = new THREE.PointLight(0xffa018, 60, 220, 1.5);
    group.add(beamLight);
    void kind;
  }

  function nextGate() {
    return gates.find((g) => !g.passed) || null;
  }

  // Returns the gate just passed, or null. Colours follow state:
  // amber = next, blue = later, green = passed.
  function update(dt, planePos, time, surveyMaxAlt) {
    const next = nextGate();
    for (const g of gates) {
      const pulse = 1 + Math.sin(time * 3 + g.index) * 0.06;
      g.mesh.scale.setScalar(pulse);
      g.mesh.material = g.passed ? greenMat : g === next ? amberMat : blueMat;
    }
    if (next) {
      beam.visible = true;
      beam.position.set(next.x, next.y + 130, next.z);
      beamLight.position.set(next.x, next.y + 6, next.z);
      const dx = planePos.x - next.x;
      const dy = planePos.y - next.y;
      const dz = planePos.z - next.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const lowEnough = surveyMaxAlt == null || planePos.y < surveyMaxAlt;
      if (dist < next.radius * 0.9 && lowEnough) {
        next.passed = true;
        return next;
      }
    } else if (beam) {
      beam.visible = false;
    }
    void dt;
    return null;
  }

  return { reset, clear, update, nextGate, get gates() { return gates; } };
}
