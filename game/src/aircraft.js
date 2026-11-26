// aircraft.js — builds the Petrel twin-prop courier mesh and owns the
// flight state (position, attitude, speed, throttle, flaps, gear).
// The mesh is posed from the state every frame; the flight model lives
// in flight.js.

import { CONFIG } from './config.js';

export function createAircraft(scene) {
  const group = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: CONFIG.colours.fuselage, roughness: 0.6, flatShading: true });
  const cream = new THREE.MeshStandardMaterial({ color: CONFIG.colours.cream, roughness: 0.6, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7, flatShading: true });
  const glass = new THREE.MeshStandardMaterial({
    color: CONFIG.colours.glass, roughness: 0.2, metalness: 0.3,
    emissive: 0x1a8a80, emissiveIntensity: 0.5,
  });

  // Fuselage: orange body with a cream nose.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 11, 10), orange);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 10), cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -7;
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 10), orange);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = 6.6;
  group.add(tail);
  // Cockpit glass.
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.2), glass);
  cockpit.position.set(0, 1.15, -3.4);
  group.add(cockpit);
  // 15 m cream main wing, tailplane and fin.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(15, 0.35, 2.6), cream);
  wing.position.set(0, 0.15, -0.6);
  group.add(wing);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.28, 1.6), cream);
  tailplane.position.set(0, 0.5, 6.2);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 2.2), orange);
  fin.position.set(0, 1.5, 6.4);
  group.add(fin);

  // Two engine nacelles with three-blade spinning props and faint discs.
  const props = [];
  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.4, 8), dark);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(side * 3.4, -0.1, -1.2);
    group.add(nacelle);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 8), dark);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(side * 3.4, -0.1, -3.1);
    group.add(hub);
    const prop = new THREE.Group();
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.12), dark);
      const holder = new THREE.Group();
      holder.rotation.z = (b * Math.PI * 2) / 3;
      holder.add(blade);
      prop.add(holder);
    }
    prop.position.set(side * 3.4, -0.1, -3.4);
    group.add(prop);
    props.push(prop);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    disc.position.set(side * 3.4, -0.1, -3.4);
    group.add(disc);
  }

  // Three landing-gear legs with wheels.
  const gear = new THREE.Group();
  for (const [gx, gz] of [[-1.6, -2.2], [1.6, -2.2], [0, 4.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 6), dark);
    leg.position.set(gx, -1.6, gz);
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gx, -2.4, gz);
    gear.add(wheel);
  }
  group.add(gear);

  // Navigation lights: red port, green starboard, white tail.
  const navMat = (c) => new THREE.MeshBasicMaterial({ color: c });
  const portLight = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), navMat(0xff2222));
  portLight.position.set(-7.5, 0.15, -0.6);
  group.add(portLight);
  const stbdLight = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), navMat(0x22ff44));
  stbdLight.position.set(7.5, 0.15, -0.6);
  group.add(stbdLight);
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), navMat(0xffffff));
  tailLight.position.set(0, 0.6, 7.8);
  group.add(tailLight);

  scene.add(group);

  const spawn = CONFIG.spawn;
  const state = {
    x: spawn.x, y: spawn.y, z: spawn.z,
    heading: spawn.heading, pitch: 0, roll: 0,
    speed: 0, vy: 0, throttle: 0,
    flaps: false, gearDown: true, airborne: false, onGround: true,
  };

  return {
    group,
    state,
    reset() {
      state.x = spawn.x; state.y = spawn.y; state.z = spawn.z;
      state.heading = spawn.heading; state.pitch = 0; state.roll = 0;
      state.speed = 0; state.vy = 0; state.throttle = 0;
      state.flaps = false; state.gearDown = true; state.airborne = false; state.onGround = true;
    },
    // Pose the mesh from the state; spin the props with throttle/speed.
    update(dt, time) {
      group.position.set(state.x, state.y, state.z);
      // Model forward is -Z; heading 0 = north = -Z.
      group.rotation.order = 'YXZ';
      group.rotation.y = (-state.heading * Math.PI) / 180;
      group.rotation.x = (state.pitch * Math.PI) / 180;
      group.rotation.z = (-state.roll * Math.PI) / 180;
      const spin = (4 + state.throttle * 26 + state.speed * 0.35) * dt;
      for (const p of props) p.rotation.z += spin;
      gear.visible = state.gearDown;
      void time;
    },
  };
}
