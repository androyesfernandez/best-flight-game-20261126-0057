// flight.js — the flight model step (throttle, attitude, lift, wind,
// ground contact, landing and crash calls). Gravity lives on the flight
// constants here, so the model never reads an undefined gravity while
// the aircraft sits on the ground.

import { CONFIG, clamp, wrapAngleDeg, headingToDir } from './config.js';

const F = CONFIG.flight;
const GRAV = CONFIG.world.gravity;

export function stepFlight(plane, dt, input, env) {
  const result = { landed: null, crashed: null };
  const rand = env.rand || Math.random;

  // Throttle: W/S at 0.55 per second.
  if (input.throttleUp) plane.throttle = clamp(plane.throttle + F.throttleRate * dt, 0, 1);
  if (input.throttleDown) plane.throttle = clamp(plane.throttle - F.throttleRate * dt, 0, 1);

  // Attitude targets from the controls.
  const pitchIn = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0);
  let rollIn = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0);
  if (input.mouseDown) rollIn = clamp((input.mouseX - 0.5) * 2.4, -1, 1);
  const yawIn = (input.yawRight ? 1 : 0) - (input.yawLeft ? 1 : 0);
  if (input.autopilot) {
    // Scripted autopilot (staged shots) overrides the stick.
    plane._apPitch = input.autopilot.pitch;
    plane._apRoll = input.autopilot.roll;
    plane.throttle = input.autopilot.throttle;
  }
  const targetPitch = input.autopilot ? input.autopilot.pitch : pitchIn * F.maxPitchDeg;
  const targetRoll = input.autopilot ? input.autopilot.roll : rollIn * F.maxRollDeg;
  plane.pitch += (targetPitch - plane.pitch) * Math.min(1, dt * 4);
  plane.roll += (targetRoll - plane.roll) * Math.min(1, dt * 3.5);

  // Flaps toggle is one-shot, handled by main.js; gear is automatic.
  if (plane.airborne && plane.speed > F.gearRetractSpeed) plane.gearDown = false;
  if (plane.speed < F.gearExtendSpeed) plane.gearDown = true;

  const pitchRad = (plane.pitch * Math.PI) / 180;
  const rollRad = (plane.roll * Math.PI) / 180;
  const groundH = env.heightAt(plane.x, plane.z);
  const strip = env.onStrip(plane.x, plane.z);

  if (plane.onGround) {
    // Rolling: engine thrust against drag and surface friction.
    let accel = plane.throttle * F.thrustAccel - plane.speed * F.dragCoeff;
    if (plane.throttle < 0.05) accel -= strip ? F.stripFriction : F.grassFriction;
    if (input.brake) accel -= 25;
    plane.speed = Math.max(0, plane.speed + accel * dt);
    // Steer on the ground with A/D, authority growing with speed.
    plane.heading -= yawIn * 40 * dt * clamp(plane.speed / 25, 0, 1);
    const dir = headingToDir(plane.heading);
    plane.x += dir.x * plane.speed * dt;
    plane.z += dir.z * plane.speed * dt;
    const newGround = env.heightAt(plane.x, plane.z);
    if (newGround + F.gearHeight < plane.y - 2.5) {
      // Rolled off a real drop (e.g. a shelf edge down to the shore):
      // now airborne, falling.
      plane.airborne = true;
      plane.onGround = false;
      plane.vy = 0;
    } else {
      plane.y = newGround + F.gearHeight;
      plane.vy = 0;
      // Takeoff: fast enough and pulling up.
      if (plane.speed >= F.takeoffSpeed && plane.pitch > 3) {
        plane.airborne = true;
        plane.onGround = false;
        plane.vy = plane.speed * Math.sin(pitchRad) * 0.5;
      }
    }
    return result;
  }

  // --- Airborne ---
  // Turn rate follows bank; banking right decreases heading here.
  const turnRate = (-GRAV * Math.tan(rollRad) / Math.max(plane.speed, 12)) * (180 / Math.PI);
  plane.heading += turnRate * dt;
  // Direct yaw from A/D (gentle).
  plane.heading -= yawIn * 18 * dt;

  // Turbulence jostles the nose.
  const turb = env.wind.turbulence || 0;
  plane.pitch += (rand() - 0.5) * turb * 9 * dt;
  plane.roll += (rand() - 0.5) * turb * 12 * dt;

  // Speed: thrust minus drag, climbing costs speed.
  const accel = plane.throttle * F.thrustAccel - plane.speed * F.dragCoeff
    - Math.sin(pitchRad) * GRAV * 0.45;
  plane.speed = Math.max(0, plane.speed + accel * dt);

  // Lift: above stall the wing flies the pitch; below it sinks.
  const stall = plane.flaps ? F.stallSpeedFlaps : F.stallSpeed;
  if (plane.speed >= stall) {
    const targetVy = plane.speed * Math.sin(pitchRad);
    plane.vy += (targetVy - plane.vy) * Math.min(1, dt * 3);
  } else {
    plane.vy = Math.max(-25, plane.vy - F.sinkAccel * dt);
  }

  // Move, with 60% wind drift.
  const dir = headingToDir(plane.heading);
  plane.x += (dir.x * plane.speed + env.wind.windX * F.windDrift) * dt;
  plane.z += (dir.z * plane.speed + env.wind.windZ * F.windDrift) * dt;
  plane.y += plane.vy * dt;

  // Soft world edge: gently turn back toward the centre.
  const distC = Math.hypot(plane.x, plane.z);
  if (distC > CONFIG.world.edge) {
    const bearingHome = Math.atan2(-plane.x, plane.z) * (180 / Math.PI);
    const turn = clamp(wrapAngleDeg(bearingHome - plane.heading), -45, 45);
    plane.heading += turn * dt;
  }
  // Altitude ceiling.
  if (plane.y > CONFIG.world.maxAltitude) {
    plane.y = CONFIG.world.maxAltitude;
    plane.vy = Math.min(plane.vy, 0);
  }

  // Ground / water contact.
  const gh = env.heightAt(plane.x, plane.z);
  if (plane.y <= gh + F.gearHeight) {
    const vs = -plane.vy;
    plane.y = gh + F.gearHeight;
    plane.vy = 0;
    if (gh < 0.5) {
      result.crashed = 'ditched in the sea';
    } else {
      const stripNow = env.onStrip(plane.x, plane.z);
      const wingsLevel = Math.abs(plane.roll) < F.maxLandingRollDeg;
      if (stripNow && plane.speed < F.maxLandingSpeed && wingsLevel) {
        let quality;
        if (vs < F.perfectVs) quality = 'perfect';
        else if (vs < F.maxLandingVs) quality = 'good';
        else if (vs < F.roughVs) quality = 'rough';
        else result.crashed = 'hard landing on the strip';
        if (!result.crashed) {
          result.landed = { quality, strip: stripNow };
          plane.onGround = true;
          plane.airborne = false;
          plane.speed *= 0.96;
          plane.pitch = 0;
          plane.roll *= 0.3;
        }
      } else {
        result.crashed = stripNow ? 'crashed on the strip' : 'crashed into terrain';
      }
    }
    if (result.crashed) {
      plane.onGround = true;
      plane.airborne = false;
      plane.speed = 0;
    }
  }
  return result;
}
