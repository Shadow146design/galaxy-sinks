import * as THREE from 'three'

/**
 * A soft radial-gradient sprite (drawn on a canvas, not a hard-edged shape)
 * used as a glow halo behind the emblem — reads as intense ambient light
 * bleeding into the nebula, and gives the bloom pass something bright to
 * flare around so the logo genuinely glows.
 */
function createGlowTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0.0, 'rgba(150, 190, 255, 0.65)')
  gradient.addColorStop(0.3, 'rgba(110, 130, 240, 0.32)')
  gradient.addColorStop(0.6, 'rgba(80, 60, 200, 0.12)')
  gradient.addColorStop(1.0, 'rgba(40, 30, 120, 0.0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

/**
 * The crew emblem — the scene's centre of gravity. Built from THREE.Sprite
 * objects so it always billboards perfectly toward the camera (never seen
 * edge-on). The badge itself uses normal blending so its dark circular field
 * renders as a solid, well-textured emblem instead of washing out over the
 * nebula; a separate additive glow halo sits behind it for the bloom.
 */
export function createLogoWatermark() {
  const group = new THREE.Group()

  // --- Glow halo (additive → picked up strongly by the bloom pass) ---
  const glowMaterial = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glow = new THREE.Sprite(glowMaterial)
  // Just a touch larger than the badge — a halo around it, never a screen-
  // filling orb.
  glow.scale.set(16, 16, 1)
  glow.position.z = -0.6
  group.add(glow)

  // --- The badge itself ---
  const texture = new THREE.TextureLoader().load('/gs-logo.png')
  texture.colorSpace = THREE.SRGBColorSpace
  // Sharpest sampling the GPU allows at this size — keeps the emblem crisp.
  texture.anisotropy = 8

  const logoMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  const logo = new THREE.Sprite(logoMaterial)
  logo.scale.set(11, 11, 1)
  group.add(logo)

  // --- Orbital ring: a thin glowing annulus tilted around the emblem,
  // slowly rotating in 3D so it reads as a halo orbiting the badge. Additive
  // → the bloom flares it into a soft neon ring. ---
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: '#5fe0ff',
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(new THREE.RingGeometry(7.4, 7.7, 96), ringMaterial)
  ring.rotation.x = Math.PI * 0.42
  group.add(ring)

  const ring2Material = new THREE.MeshBasicMaterial({
    color: '#8a5bff',
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(8.4, 8.6, 96), ring2Material)
  ring2.rotation.x = Math.PI * 0.5
  ring2.rotation.y = Math.PI * 0.12
  group.add(ring2)

  group.position.set(0, 0.3, -3)
  const baseY = group.position.y

  // Gentle float + micro-sway — enough to feel alive, never a full spin, so
  // the "GS" and the star stay upright and legible at all times. The rings
  // orbit slowly on their own axes.
  function update(time) {
    group.position.y = baseY + Math.sin(time * 0.5) * 0.32
    logoMaterial.rotation = Math.sin(time * 0.3) * 0.035
    glowMaterial.opacity = 0.42 + Math.sin(time * 0.8) * 0.1
    ring.rotation.z = time * 0.25
    ring2.rotation.z = -time * 0.18
  }

  return { mesh: group, logoMaterial, glowMaterial, ringMaterial, ring2Material, update }
}
