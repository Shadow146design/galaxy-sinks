import * as THREE from 'three'

/**
 * Rocket-League-flavored ambiance layered behind/around the particle cloud:
 * a huge wireframe polyhedron standing in for an arena boundary, slowly
 * rotating, plus a stream of fast line "boost" streaks crossing the scene
 * on a loop. Both use a deliberately more contrasted electric-blue/vivid-
 * orange pairing instead of the site's usual violet/cyan/pink brand
 * palette — scoped to just these two elements, not a site-wide rebrand.
 */
const STREAK_COUNT = 40
const STREAK_BOUNDS = 16
const STREAK_COLORS = [new THREE.Color('#0090ff'), new THREE.Color('#ff7a00')]

export function createArena() {
  const group = new THREE.Group()

  const arenaGeometry = new THREE.IcosahedronGeometry(14, 1)
  const arenaMaterial = new THREE.LineBasicMaterial({
    color: '#0090ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const arena = new THREE.LineSegments(new THREE.EdgesGeometry(arenaGeometry), arenaMaterial)
  group.add(arena)

  const streaks = Array.from({ length: STREAK_COUNT }, () => {
    const direction = Math.random() < 0.5 ? -1 : 1
    return {
      position: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(STREAK_BOUNDS),
        THREE.MathUtils.randFloatSpread(STREAK_BOUNDS * 0.6),
        THREE.MathUtils.randFloatSpread(STREAK_BOUNDS),
      ),
      speed: THREE.MathUtils.randFloat(8, 15) * direction,
      length: THREE.MathUtils.randFloat(0.8, 2.4),
    }
  })

  const streakPositions = new Float32Array(STREAK_COUNT * 2 * 3)
  const streakColors = new Float32Array(STREAK_COUNT * 2 * 3)
  streaks.forEach((streak, i) => {
    const color = STREAK_COLORS[i % STREAK_COLORS.length]
    for (let v = 0; v < 2; v++) {
      const base = (i * 2 + v) * 3
      streakColors[base] = color.r
      streakColors[base + 1] = color.g
      streakColors[base + 2] = color.b
    }
  })

  const streakGeometry = new THREE.BufferGeometry()
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3))
  streakGeometry.setAttribute('color', new THREE.BufferAttribute(streakColors, 3))

  const streakMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const streakLines = new THREE.LineSegments(streakGeometry, streakMaterial)
  group.add(streakLines)

  function update(delta) {
    arena.rotation.y += delta * 0.02
    arena.rotation.x += delta * 0.008

    const positionAttr = streakLines.geometry.attributes.position
    streaks.forEach((streak, i) => {
      streak.position.x += streak.speed * delta

      if (Math.abs(streak.position.x) > STREAK_BOUNDS) {
        streak.position.x = -Math.sign(streak.speed) * STREAK_BOUNDS
        streak.position.y = THREE.MathUtils.randFloatSpread(STREAK_BOUNDS * 0.6)
        streak.position.z = THREE.MathUtils.randFloatSpread(STREAK_BOUNDS)
      }

      const tailX = streak.position.x - Math.sign(streak.speed) * streak.length
      positionAttr.setXYZ(i * 2, tailX, streak.position.y, streak.position.z)
      positionAttr.setXYZ(i * 2 + 1, streak.position.x, streak.position.y, streak.position.z)
    })
    positionAttr.needsUpdate = true
  }

  return { group, update, materials: [arenaMaterial, streakMaterial] }
}
