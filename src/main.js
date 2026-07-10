import './style.css'
import 'lenis/dist/lenis.css'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { vertexShader, fragmentShader } from './shaders/particles.js'
import { detectQualityTier, QUALITY_PRESETS } from './utils/quality.js'
import { setupTypewriterReveal } from './utils/textReveal.js'
import { createAmbientPad } from './utils/ambientAudio.js'
import { createLogoWatermark } from './utils/logoWatermark.js'
import { createSpaceFogBackground } from './utils/spaceFogBackground.js'
import { createNebulaClouds } from './utils/nebulaClouds.js'
import { createShootingStars } from './utils/shootingStars.js'

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  GALAXY SINKS — "Galaxie Minimaliste"
 *  Fond noir profond · nébuleuse subtile · champ d'étoiles 3D mobile ·
 *  logo GS lumineux au centre · inertie de caméra (feeling drone).
 *  Aucun décor 3D superflu, aucun panneau de debug/réglage.
 * ─────────────────────────────────────────────────────────────────────────
 */

gsap.registerPlugin(ScrollTrigger)

/**
 * Lenis drives the native scroll position with inertia instead of the
 * browser's instant wheel-scroll — this is the "gliding through space"
 * feel. Synced to GSAP's ticker so scroll and every scroll-driven effect
 * advance on the same frame.
 */
const lenis = new Lenis({ autoRaf: false })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
gsap.ticker.lagSmoothing(0)

/**
 * Ambient pad: a synthesized space drone (no audio files). It starts on the
 * first scroll — spin the wheel (or scroll on touch/keyboard) and the space
 * ambience fades in. No on-screen control; browsers just need one real user
 * gesture, and a scroll counts.
 */
const ambientPad = createAmbientPad()

function unlockAmbientPad() {
  ambientPad.start()
}
window.addEventListener('wheel', unlockAmbientPad, { once: true, passive: true })
window.addEventListener('touchstart', unlockAmbientPad, { once: true, passive: true })
window.addEventListener('keydown', unlockAmbientPad, { once: true, passive: true })

// Wait for the real fonts before measuring scroll positions / splitting text.
document.fonts?.ready.then(() => {
  ScrollTrigger.refresh()
  // NB : on ne découpe PLUS les titres (ni en lettres, ni en mots) — c'est ce
  // qui les faisait casser en plein mot ("Actualité"/"s"). Les titres portent
  // la classe .reveal et apparaissent d'un bloc en fondu. Seule la prose, en
  // paragraphes, garde l'apparition mot à mot (aucun risque de coupure là).
  setupTypewriterReveal('.timeline-text, .profile-bio', { type: 'words', stagger: 0.035, duration: 0.5, onTick: () => ambientPad.playTick() })
})

const canvas = document.querySelector('#app')
const loadingScreen = document.querySelector('#loading-screen')
const scrollFill = document.querySelector('.scroll-progress-fill')

// Scroll progress bar — driven by Lenis's own normalised progress.
lenis.on('scroll', ({ progress }) => {
  if (scrollFill) scrollFill.style.height = `${Math.min(Math.max(progress || 0, 0), 1) * 100}%`
})

const qualityTier = detectQualityTier()
const qualityPreset = QUALITY_PRESETS[qualityTier]

// Respect the OS "reduce motion" setting: keep the ambience, drop the big
// autonomous motion (field auto-spin, shooting stars, velocity bloom pulse).
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scene = new THREE.Scene()

// Deep, near-black space blue. Background + fog share one Color instance so
// they always stay in sync.
const bgColor = new THREE.Color('#03040f')
scene.background = bgColor

// Fog so distant stars sink into the black instead of stacking up. This
// also caps how much the additive star sprites can accumulate along the
// view — without enough fog, flying deep into the cloud saturates to white.
scene.fog = new THREE.FogExp2(0x000000, 0.02)
scene.fog.color = bgColor

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, qualityPreset.pixelRatioCap),
}

const camera = new THREE.PerspectiveCamera(70, sizes.width / sizes.height, 0.1, 400)
camera.position.set(0, 0, 14)
scene.add(camera)

// Camera rig: the real position/look each frame is eased toward these
// targets in tick() (damping / inertia), never set directly, so scroll
// scrubs them smoothly — the "drone" glide.
const cameraTarget = { x: 0, y: 0, z: 14 }
const cameraLookTarget = { x: 0, y: 0, z: -30 }
const cameraLook = { x: 0, y: 0, z: -30 }

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.95

/**
 * ── Star field ───────────────────────────────────────────────────────────
 * A large volume of drifting point-stars. Buffers always hold the full set;
 * only the drawn range scales with device tier / live FPS.
 */
const PARTICLE_COUNT = 160000
const FIELD_RADIUS = 60

const positions = new Float32Array(PARTICLE_COUNT * 3)
const scales = new Float32Array(PARTICLE_COUNT)

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const i3 = i * 3
  const radius = FIELD_RADIUS * Math.cbrt(Math.random())
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)

  positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
  positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
  positions[i3 + 2] = radius * Math.cos(phi)

  // Mostly fine dust with a sparse population of brighter "hero" stars for
  // the bloom to flare around.
  const isHero = Math.random() < 0.07
  scales[i] = isHero
    ? THREE.MathUtils.lerp(1.4, 2.6, Math.random())
    : THREE.MathUtils.lerp(0.12, 0.9, Math.random())
}

const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
// The particle shader still references aTargetPosition (used only when
// uProgress > 0). We never morph here, so point it at the same positions and
// keep uProgress pinned at 0 — the target term contributes nothing.
geometry.setAttribute('aTargetPosition', new THREE.BufferAttribute(positions, 3))
geometry.setDrawRange(0, qualityPreset.drawCount)

// Palette pulled straight from the logo: green → (cyan in the middle) →
// violet. Kept deliberately deep/dark so the field reads as distant space
// rather than a bright wash — the star shader blends A→B by noise.
const params = {
  colorA: '#0a5c42',
  colorB: '#3a2c82',
  speed: 0.06,
  noiseFrequency: 0.18,
  noiseAmplitude: 0.6,
  size: 34,
  bloomBaseStrength: 0.9,
}

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: true,
  uniforms: {
    uTime: { value: 0 },
    uSpeed: { value: params.speed },
    uSize: { value: params.size * sizes.pixelRatio },
    uNoiseFrequency: { value: params.noiseFrequency },
    uNoiseAmplitude: { value: params.noiseAmplitude },
    uColorA: { value: new THREE.Color(params.colorA) },
    uColorB: { value: new THREE.Color(params.colorB) },
    uProgress: { value: 0 },
    uOpacity: { value: 1 },
    fogColor: { value: new THREE.Color(0x000000) },
    fogDensity: { value: scene.fog.density },
  },
})

const particles = new THREE.Points(geometry, material)

// Outer rig for mouse parallax; the inner points also get a slow autonomous
// drift so the field is never fully static.
const particlesRig = new THREE.Group()
particlesRig.add(particles)
scene.add(particlesRig)

if (!reducedMotion) {
  gsap.to(particles.rotation, { y: Math.PI * 2, duration: 240, repeat: -1, ease: 'none' })
}

/**
 * ── Nebula ───────────────────────────────────────────────────────────────
 * A huge inverted sphere with a gradient + drifting-noise shader — the
 * subtle atmosphere the stars and logo float inside. Shares the same Color
 * instances as the star field so its mood stays in sync.
 */
const spaceFogBackground = createSpaceFogBackground(material.uniforms.uColorA.value, bgColor)
scene.add(spaceFogBackground.mesh)

// Faint coloured nebula clouds (green / cyan / violet) for depth and mood.
const nebulaClouds = createNebulaClouds()
scene.add(nebulaClouds.group)

// Occasional shooting stars streaking across the field.
const shootingStars = createShootingStars()
scene.add(shootingStars.group)

/**
 * ── Logo GS ──────────────────────────────────────────────────────────────
 * The centre of gravity: emblem + intense glow halo, floating in the nebula.
 */
const logoWatermark = createLogoWatermark()
scene.add(logoWatermark.mesh)

/**
 * ── Cursor light ─────────────────────────────────────────────────────────
 * A soft additive glow that follows the pointer, projected into the scene —
 * as if the visitor carries a light through the nebula. Picked up by the
 * bloom for a gentle interactive halo.
 */
const cursorGlowTexture = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(130, 210, 255, 0.5)')
  g.addColorStop(0.4, 'rgba(90, 150, 255, 0.16)')
  g.addColorStop(1, 'rgba(40, 30, 120, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()
const cursorGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: cursorGlowTexture,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
)
cursorGlow.scale.set(11, 11, 1)
scene.add(cursorGlow)

/**
 * ── Post-processing ──────────────────────────────────────────────────────
 * Just bloom (the intense "glow" on the logo and bright stars) + output.
 */
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloomPass = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 0.9, 0.7, 0.3)
composer.addPass(bloomPass)
composer.addPass(new OutputPass())

/**
 * ── Mouse parallax ───────────────────────────────────────────────────────
 */
const pointer = { x: 0, y: 0 }
window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = (event.clientY / window.innerHeight) * 2 - 1
})

// DOM glass panels: a cursor-tracked "reflection" highlight (CSS custom
// props), the DOM equivalent of a light gliding across the glass.
const glassPanels = document.querySelectorAll('.profile-card, .stat-tile, .match-panel')
window.addEventListener('pointermove', (event) => {
  glassPanels.forEach((panel) => {
    const rect = panel.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return
    panel.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    panel.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`)
  })
})

/**
 * ── Scroll → camera flight ───────────────────────────────────────────────
 * The whole page drives one continuous forward glide: the camera pushes
 * deeper into the star field as you scroll, rising slightly, always looking
 * ahead. Damping in tick() keeps it smooth across abrupt scroll jumps.
 */
// Brand palette stops the whole scene drifts through as you scroll — deep
// green → teal → violet, echoing the logo, kept dark so it never washes out.
const paletteA = [new THREE.Color('#0a5c42'), new THREE.Color('#0a4a5c'), new THREE.Color('#2a1f6e')]
const paletteB = [new THREE.Color('#3a2c82'), new THREE.Color('#2c5a82'), new THREE.Color('#0a5c52')]
const paletteBg = [new THREE.Color('#03040f'), new THREE.Color('#04060f'), new THREE.Color('#070512')]

ScrollTrigger.create({
  trigger: '.scroll-space',
  start: 'top top',
  end: 'bottom bottom',
  scrub: true,
  onUpdate: (self) => {
    const p = self.progress
    // Gentle forward drift only — the camera must NOT plunge into the dense
    // core of the star cloud, or the additive sprites stack up to white.
    cameraTarget.z = THREE.MathUtils.lerp(14, -6, p)
    cameraTarget.y = THREE.MathUtils.lerp(0, 4, p)
    cameraLookTarget.z = cameraTarget.z - 30
    cameraLookTarget.y = cameraTarget.y * 0.6

    // Drift the mood colours across the palette stops.
    const seg = p * (paletteA.length - 1)
    const i = Math.min(Math.floor(seg), paletteA.length - 2)
    const t = seg - i
    material.uniforms.uColorA.value.lerpColors(paletteA[i], paletteA[i + 1], t)
    material.uniforms.uColorB.value.lerpColors(paletteB[i], paletteB[i + 1], t)
    bgColor.lerpColors(paletteBg[i], paletteBg[i + 1], t)
  },
})

// The logo is the hero moment — fade it (and its glow) out as the first
// content section arrives so it never sits over the copy.
gsap.to([logoWatermark.logoMaterial, logoWatermark.glowMaterial, logoWatermark.ringMaterial, logoWatermark.ring2Material], {
  opacity: 0,
  ease: 'none',
  scrollTrigger: { trigger: '.phase-history', start: 'top bottom', end: 'top center', scrub: true },
})

// Dim the star field strongly once content begins so it reads as faint
// ambient texture behind the glass — and never accumulates into a bright
// wash behind the copy.
gsap.to(material.uniforms.uOpacity, {
  value: 0.12,
  ease: 'none',
  scrollTrigger: { trigger: '.phase-history', start: 'top bottom', end: 'top center', scrub: true },
})

/**
 * ── Reveal-on-scroll for the glass content panels ────────────────────────
 */
ScrollTrigger.batch('.reveal', {
  start: 'top 85%',
  onEnter: (batch) =>
    gsap.to(batch, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', stagger: 0.12, overwrite: true }),
  onLeaveBack: (batch) =>
    gsap.to(batch, { opacity: 0, y: 40, filter: 'blur(10px)', duration: 0.6, ease: 'power2.in', stagger: 0.08, overwrite: true }),
})

// Nav links route through Lenis so jumps are inertial like the rest.
document.querySelectorAll('.hud-nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault()
    lenis.scrollTo(link.getAttribute('href'), { offset: -70 })
  })
})

/**
 * ── Sons d'interaction ───────────────────────────────────────────────────
 * On réutilise la nappe synthé : un petit "blip" au survol, un "boost"
 * (whoosh façon Rocket League) au clic, et un whoosh à l'arrivée de chaque
 * section. Audible seulement après le premier scroll (déverrouillage audio).
 */
document.querySelectorAll('.hud-nav a, .hero-cta, .hero-ghost, .social-pill').forEach((el) => {
  el.addEventListener('pointerenter', () => ambientPad.playTick(), { passive: true })
})
document.querySelectorAll('.hud-nav a, .hero-cta, .hero-ghost, .social-pill, .shop-card').forEach((el) => {
  el.addEventListener('click', () => ambientPad.playBoost())
})

// Un whoosh discret quand chaque section entre à l'écran.
document.querySelectorAll('.content-section').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top center',
    onEnter: () => ambientPad.playBoost(),
    onEnterBack: () => ambientPad.playBoost(),
  })
})

/**
 * ── Resize ───────────────────────────────────────────────────────────────
 */
let resizeSettleTimeout
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  sizes.pixelRatio = Math.min(window.devicePixelRatio, qualityPreset.pixelRatioCap)

  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()

  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(sizes.pixelRatio)
  composer.setSize(sizes.width, sizes.height)
  composer.setPixelRatio(sizes.pixelRatio)

  material.uniforms.uSize.value = params.size * sizes.pixelRatio

  clearTimeout(resizeSettleTimeout)
  resizeSettleTimeout = setTimeout(() => ScrollTrigger.refresh(), 200)
})

// Fully stop rendering while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  renderer.setAnimationLoop(document.hidden ? null : tick)
})

/**
 * ── Animation loop + runtime quality adaptation ──────────────────────────
 */
const clock = new THREE.Clock()

const MIN_DRAW_COUNT = 20000
const DRAW_COUNT_STEP = 15000
let currentDrawCount = qualityPreset.drawCount
let fpsFrameCount = 0
let fpsElapsed = 0
let hasRenderedFirstFrame = false

function adaptQualityToFrameRate(delta) {
  if (delta > 0.3) return
  fpsFrameCount++
  fpsElapsed += delta
  if (fpsElapsed < 1) return

  const fps = fpsFrameCount / fpsElapsed
  fpsFrameCount = 0
  fpsElapsed = 0

  if (fps < 45 && currentDrawCount > MIN_DRAW_COUNT) {
    currentDrawCount = Math.max(MIN_DRAW_COUNT, currentDrawCount - DRAW_COUNT_STEP)
  } else if (fps > 58 && currentDrawCount < qualityPreset.drawCount) {
    currentDrawCount = Math.min(qualityPreset.drawCount, currentDrawCount + DRAW_COUNT_STEP)
  } else {
    return
  }
  geometry.setDrawRange(0, currentDrawCount)
}

function tick() {
  const delta = clock.getDelta()
  material.uniforms.uTime.value = clock.elapsedTime

  adaptQualityToFrameRate(delta)

  // Mouse parallax — the field tilts gently opposite the cursor.
  particlesRig.rotation.y += (-pointer.x * 0.12 - particlesRig.rotation.y) * 0.03
  particlesRig.rotation.x += (-pointer.y * 0.08 - particlesRig.rotation.x) * 0.03

  // Nebula parallax — the coloured clouds drift on a slower, deeper layer
  // than the stars, which reads as real depth, plus a constant slow swirl so
  // the background is never fully still.
  nebulaClouds.group.rotation.y += (-pointer.x * 0.05 - nebulaClouds.group.rotation.y) * 0.02
  nebulaClouds.group.rotation.x += (-pointer.y * 0.03 - nebulaClouds.group.rotation.x) * 0.02
  if (!reducedMotion) nebulaClouds.group.rotation.z += 0.0005

  // Warp: the star field's flow speeds up while scrolling fast, easing back
  // to rest — a subtle "gliding faster through space" cue.
  const warp = reducedMotion ? 0 : Math.min(Math.abs(lenis.velocity) * 0.02, 1.1)
  material.uniforms.uSpeed.value += (params.speed + warp * 0.12 - material.uniforms.uSpeed.value) * 0.1

  // Idle cinematic drift — comme un edit anime, la scène bouge en continu
  // même sans scroller : traveling lent gauche/droite, respiration
  // avant/arrière, léger bob vertical.
  const it = clock.elapsedTime
  const idleX = reducedMotion ? 0 : Math.sin(it * 0.13) * 1.9
  const idleY = reducedMotion ? 0 : Math.sin(it * 0.09 + 1.0) * 0.7
  const idleZ = reducedMotion ? 0 : Math.sin(it * 0.07) * 1.2

  // Camera damping (inertia) — ease toward the scroll-driven targets, plus a
  // live cursor parallax and the idle drift above.
  const parallaxX = pointer.x * 1.9
  const parallaxY = -pointer.y * 1.15
  camera.position.x += (cameraTarget.x + parallaxX + idleX - camera.position.x) * 0.045
  camera.position.y += (cameraTarget.y + parallaxY + idleY - camera.position.y) * 0.045
  camera.position.z += (cameraTarget.z + idleZ - camera.position.z) * 0.03

  cameraLook.x += (cameraLookTarget.x - cameraLook.x) * 0.05
  cameraLook.y += (cameraLookTarget.y - cameraLook.y) * 0.05
  cameraLook.z += (cameraLookTarget.z - cameraLook.z) * 0.05
  camera.lookAt(cameraLook.x, cameraLook.y, cameraLook.z)

  // Micro dutch-angle sway layered after lookAt — la petite inclinaison
  // "edit" qui donne du caractère au cadrage.
  if (!reducedMotion) camera.rotation.z += Math.sin(it * 0.11) * 0.014

  // Bloom breathes with scroll speed — glows a touch more the faster you glide.
  const velocityBoost = Math.min(Math.abs(lenis.velocity) * 0.04, 0.8)
  bloomPass.strength += (params.bloomBaseStrength + velocityBoost - bloomPass.strength) * 0.15
  ambientPad.setIntensity(lenis.velocity)

  // Place the cursor glow on a plane a fixed distance in front of the camera,
  // mapping the pointer's -1..1 range to that plane's visible size.
  const glowDepth = 12
  const glowH = 2 * Math.tan((camera.fov * Math.PI) / 360) * glowDepth
  const glowW = glowH * camera.aspect
  cursorGlow.position.set(
    camera.position.x + pointer.x * glowW * 0.5,
    camera.position.y - pointer.y * glowH * 0.5,
    camera.position.z - glowDepth,
  )

  logoWatermark.update(clock.elapsedTime)
  spaceFogBackground.update(clock.elapsedTime)
  nebulaClouds.update(clock.elapsedTime)
  if (!reducedMotion) shootingStars.update(delta)

  composer.render()

  if (!hasRenderedFirstFrame) {
    hasRenderedFirstFrame = true
    if (loadingScreen) {
      loadingScreen.classList.add('is-hidden')
      loadingScreen.addEventListener('transitionend', () => loadingScreen.remove(), { once: true })
    }
  }
}

renderer.compileAsync(scene, camera).then(() => {
  // Force the composer passes to compile now (hidden behind the loader) so
  // the first real frame doesn't stutter.
  composer.render()
}).finally(() => {
  renderer.setAnimationLoop(tick)
})
