// camera.js — chase and cockpit cameras with easing. The chase camera
// trails behind and above, easing toward its target so the view never
// fights the pilot; field of view widens with speed. On final approach
// (landing shots) the chase camera sits lower and centred.

import { CONFIG, headingToDir } from './config.js';

export function createCamera(camera) {
  let chasePos = null;
  let lookTarget = null;

  function update(dt, plane, mode, opts = {}) {
    const dir = headingToDir(plane.heading);
    if (mode === 'cockpit') {
      const cx = plane.x + dir.x * 2.2;
      const cz = plane.z + dir.z * 2.2;
      camera.position.set(cx, plane.y + 1.4, cz);
      camera.lookAt(
        plane.x + dir.x * 60,
        plane.y + Math.sin((plane.pitch * Math.PI) / 180) * 60,
        plane.z + dir.z * 60,
      );
      camera.fov = 72;
      camera.updateProjectionMatrix();
      return;
    }
    // Chase: ~30 m behind (growing slightly with speed), ~6 m above,
    // looking 70 m ahead so the plane sits low-centre and the next
    // gate stays centred and large instead of sliding off-frame.
    const finalMode = !!opts.final;
    const back = finalMode ? 26 : 30 + plane.speed * 0.06;
    const up = finalMode ? 4.5 : 6 + plane.speed * 0.02;
    const tx = plane.x - dir.x * back;
    const ty = plane.y + up;
    const tz = plane.z - dir.z * back;
    if (!chasePos) {
      chasePos = { x: tx, y: ty, z: tz };
      lookTarget = { x: plane.x, y: plane.y, z: plane.z };
    }
    const ease = Math.min(1, dt * (finalMode ? 6 : 3.2));
    chasePos.x += (tx - chasePos.x) * ease;
    chasePos.y += (ty - chasePos.y) * ease;
    chasePos.z += (tz - chasePos.z) * ease;
    camera.position.set(chasePos.x, chasePos.y, chasePos.z);
    const lx = plane.x + dir.x * (finalMode ? 40 : 70);
    const ly = plane.y + (finalMode ? -2 : -1) + Math.sin((plane.pitch * Math.PI) / 180) * 12;
    const lz = plane.z + dir.z * (finalMode ? 40 : 70);
    lookTarget.x += (lx - lookTarget.x) * Math.min(1, dt * 5);
    lookTarget.y += (ly - lookTarget.y) * Math.min(1, dt * 5);
    lookTarget.z += (lz - lookTarget.z) * Math.min(1, dt * 5);
    camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
    camera.fov = 62 + Math.min(16, plane.speed * 0.14);
    camera.updateProjectionMatrix();
    void CONFIG;
  }

  function snap(plane) {
    chasePos = null;
    lookTarget = null;
  }

  return { update, snap };
}
