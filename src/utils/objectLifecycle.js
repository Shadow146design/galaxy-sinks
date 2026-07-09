import gsap from 'gsap'
import * as THREE from 'three'

/**
 * Layers a camera-reactive "presence" on top of an object whose base
 * visibility is still gated by its own scroll-triggered section fade (see
 * main.js) — every showcase object in this scene sits close to the origin
 * while the camera orbits it at a roughly similar radius per section, so
 * raw camera distance alone can't tell *which* object should be showing;
 * the existing per-section opacity tween already does that correctly.
 * What this adds on top of that:
 *   - a back.out scale "bounce-in" the moment the object's own fade
 *     actually starts raising it out of invisibility, instead of a flat pop
 *   - a continuous slow exhibition spin + idle sine-wave float while it's up
 *     (skip via manageMotion:false for objects that already animate their
 *     own rotation/position — stacking both would fight over the same
 *     properties every frame)
 *   - a live proximity boost: subtly bigger the closer the camera currently
 *     is to it, layered on top of its entrance scale
 *   - resets on fade-out so the whole entrance replays if the visitor
 *     scrolls away and back
 */
export function createObjectLifecycle(
  object3D,
  {
    getOpacity,
    nearDistance = 6,
    farDistance = 11,
    proximityScaleBoost = 0.25,
    rotationSpeed = 0.12,
    floatAmplitude = 0.12,
    floatSpeed = 0.5,
    manageMotion = true,
  } = {},
) {
  const baseY = object3D.position.y
  const baseScale = object3D.scale.x || 1

  // Hysteresis between the enter and exit thresholds — without it, an
  // opacity value hovering right at one cutoff during a slow scroll would
  // flip hasEntered back and forth every frame, re-firing the bounce-in tween
  // in a rapid, flickering loop.
  const ENTER_THRESHOLD = 0.12
  const EXIT_THRESHOLD = 0.03

  let hasEntered = false
  let entering = false

  function update(camera, time, delta) {
    if (manageMotion) {
      object3D.rotation.y += rotationSpeed * delta
      object3D.position.y = baseY + Math.sin(time * floatSpeed) * floatAmplitude
    }

    const opacity = getOpacity()

    if (opacity > ENTER_THRESHOLD && !hasEntered) {
      hasEntered = true
      entering = true
      object3D.scale.setScalar(0.001)
      gsap.to(object3D.scale, {
        x: baseScale,
        y: baseScale,
        z: baseScale,
        duration: 1.3,
        ease: 'back.out(1.7)',
        overwrite: true,
        onComplete: () => {
          entering = false
        },
      })
    } else if (opacity < EXIT_THRESHOLD && hasEntered) {
      hasEntered = false
    }

    if (entering) return

    const distance = camera.position.distanceTo(object3D.position)
    const proximity = THREE.MathUtils.clamp(1 - (distance - nearDistance) / (farDistance - nearDistance), 0, 1)
    const targetScale = baseScale * (1 + proximity * proximityScaleBoost)
    object3D.scale.setScalar(object3D.scale.x + (targetScale - object3D.scale.x) * 0.05)
  }

  return { update }
}
