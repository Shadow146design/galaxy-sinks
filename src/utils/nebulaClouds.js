import * as THREE from 'three'

/**
 * A handful of large, very soft radial-gradient sprites in the brand colours
 * (green → cyan → violet, echoing the logo) scattered through the depth of
 * the field. Additive + low opacity so they read as faint coloured
 * atmosphere the stars swim through — never as hard shapes. Each drifts and
 * breathes slowly on its own phase.
 */
function createCloudTexture(inner) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

const CLOUDS = [
  { color: 'rgba(36, 150, 104, 0.32)', pos: [-22, 8, -34], scale: 46 }, // green
  { color: 'rgba(42, 128, 168, 0.32)', pos: [24, -6, -28], scale: 40 }, // cyan
  { color: 'rgba(96, 58, 172, 0.32)', pos: [6, 16, -46], scale: 52 }, // violet
  { color: 'rgba(78, 46, 152, 0.28)', pos: [-14, -14, -22], scale: 34 }, // indigo
]

export function createNebulaClouds() {
  const group = new THREE.Group()
  const sprites = []

  CLOUDS.forEach(({ color, pos, scale }, i) => {
    const material = new THREE.SpriteMaterial({
      map: createCloudTexture(color),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const sprite = new THREE.Sprite(material)
    sprite.position.set(pos[0], pos[1], pos[2])
    sprite.scale.set(scale, scale, 1)
    group.add(sprite)
    sprites.push({ sprite, material, baseScale: scale, baseOpacity: 0.3, phase: i * 1.7 })
  })

  function update(time) {
    sprites.forEach(({ sprite, material, baseScale, baseOpacity, phase }) => {
      const breathe = Math.sin(time * 0.12 + phase)
      sprite.scale.setScalar(baseScale * (1 + breathe * 0.06))
      material.opacity = baseOpacity * (0.75 + breathe * 0.25)
      sprite.material.rotation = time * 0.01 + phase
    })
  }

  return { group, update, materials: sprites.map((s) => s.material) }
}
