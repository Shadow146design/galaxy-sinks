import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'

/**
 * A large, dark reflective floor beneath the opening zones — synthetic-turf
 * dark rather than a literal mirror, real-time reflecting the neon
 * particles/bloom/set-pieces above it for genuine depth. Deliberately no
 * drawn grid or seam lines anywhere in this material — the "arena" read
 * comes entirely from what it reflects, not from painted geometry.
 */
export function createMirrorFloor(pixelRatio = 1) {
  const geometry = new THREE.PlaneGeometry(140, 260)
  // Capped rather than scaled straight up by devicePixelRatio — a reflection
  // render target is a full extra scene render every frame, and this stays
  // an ultra-dark, deliberately soft surface, so it doesn't need to be
  // sharp enough to justify the cost of a full-DPI buffer.
  const reflectionScale = Math.min(pixelRatio, 1.25)
  const reflector = new Reflector(geometry, {
    color: 0x0a0a12,
    textureWidth: Math.round(512 * reflectionScale),
    textureHeight: Math.round(1024 * reflectionScale),
    clipBias: 0.003,
  })
  reflector.rotation.x = -Math.PI / 2

  // The stock Reflector shader always outputs alpha 1 (no transparent/
  // opacity support, and no notion of the plane's own UV — only the
  // projective reflection UV) — patch in a uOpacity uniform plus a
  // rectangular edge fade so the floor dissolves into the fog at its
  // boundary instead of reading as a hard-edged geometric quad.
  const material = reflector.material
  material.transparent = true
  material.uniforms.uOpacity = { value: 0 }
  material.vertexShader = material.vertexShader
    .replace('varying vec4 vUv;', 'varying vec4 vUv;\n\t\tvarying vec2 vPlaneUv;')
    .replace('vUv = textureMatrix * vec4( position, 1.0 );', 'vUv = textureMatrix * vec4( position, 1.0 );\n\t\t\tvPlaneUv = uv;')
  material.fragmentShader = material.fragmentShader
    .replace('uniform vec3 color;', 'uniform vec3 color;\n\t\tuniform float uOpacity;')
    .replace('varying vec4 vUv;', 'varying vec4 vUv;\n\t\tvarying vec2 vPlaneUv;')
    .replace(
      'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
      `float edgeX = smoothstep( 0.0, 0.3, min( vPlaneUv.x, 1.0 - vPlaneUv.x ) );
			float edgeY = smoothstep( 0.0, 0.18, min( vPlaneUv.y, 1.0 - vPlaneUv.y ) );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), uOpacity * edgeX * edgeY );`,
    )
  material.needsUpdate = true

  return { mesh: reflector, uniforms: [material.uniforms.uOpacity] }
}
