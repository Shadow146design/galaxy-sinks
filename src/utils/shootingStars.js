import * as THREE from 'three'

/**
 * A small pool of shooting stars. Each is a short additive line (a bright
 * head fading to a transparent tail) that fires from a random point at a
 * random interval, streaks across the field, then goes dormant and waits to
 * fire again. Cheap: two vertices per meteor, updated in place — no
 * per-frame allocation.
 */
const POOL_SIZE = 3
const HEAD_COLOR = new THREE.Color('#eafbff')
const TAIL_COLOR = new THREE.Color('#5fd8ff')

function randomRange(min, max) {
  return min + Math.random() * (max - min)
}

function makeMeteor() {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
  // Per-vertex colour so the head is bright and the tail fades out.
  const colors = new Float32Array([
    HEAD_COLOR.r, HEAD_COLOR.g, HEAD_COLOR.b,
    TAIL_COLOR.r, TAIL_COLOR.g, TAIL_COLOR.b,
  ])
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const line = new THREE.Line(geometry, material)
  line.frustumCulled = false

  return {
    line,
    material,
    geometry,
    cooldown: randomRange(1.5, 7),
    life: 0,
    duration: 1,
    pos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    length: 6,
  }
}

export function createShootingStars() {
  const group = new THREE.Group()
  const meteors = Array.from({ length: POOL_SIZE }, () => {
    const m = makeMeteor()
    group.add(m.line)
    return m
  })

  function launch(m) {
    // Start somewhere in the upper spread, aim down-and-across the field.
    m.pos.set(randomRange(-30, 30), randomRange(6, 26), randomRange(-40, -10))
    m.dir.set(randomRange(-1, 1), randomRange(-0.8, -0.3), randomRange(-0.3, 0.3)).normalize()
    m.length = randomRange(5, 10)
    m.duration = randomRange(0.7, 1.3)
    m.life = 0
  }

  function update(delta) {
    meteors.forEach((m) => {
      if (m.life <= 0) {
        m.cooldown -= delta
        if (m.cooldown <= 0) {
          m.cooldown = randomRange(3, 10)
          launch(m)
          m.life = 0.0001
        }
        return
      }

      m.life += delta
      const t = m.life / m.duration
      if (t >= 1) {
        m.life = 0
        m.material.opacity = 0
        return
      }

      // Travel fast across the field.
      const speed = 42
      m.pos.addScaledVector(m.dir, speed * delta)

      const arr = m.geometry.attributes.position.array
      arr[0] = m.pos.x
      arr[1] = m.pos.y
      arr[2] = m.pos.z
      arr[3] = m.pos.x - m.dir.x * m.length
      arr[4] = m.pos.y - m.dir.y * m.length
      arr[5] = m.pos.z - m.dir.z * m.length
      m.geometry.attributes.position.needsUpdate = true

      // Quick fade in, long fade out.
      m.material.opacity = Math.sin(t * Math.PI) * 0.9
    })
  }

  return { group, update }
}
