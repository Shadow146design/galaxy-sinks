import * as THREE from 'three'
import { spaceFogVertexShader, spaceFogFragmentShader } from '../shaders/spaceFog.js'

/**
 * A huge inverted sphere with a GLSL gradient-plus-noise "volumetric fog"
 * shader, replacing a flat scene.background color — the logo, particles and
 * set-pieces now float inside an atmosphere with soft drifting variation
 * instead of sitting in front of a flat backdrop. uColorTop/uColorBottom are
 * meant to be pointed at the SAME THREE.Color instances the rest of the
 * scene's mood colors already animate (see main.js), so this shifts in sync
 * with every other per-zone color change for free, no extra wiring needed.
 */
export function createSpaceFogBackground(colorTop, colorBottom) {
  const geometry = new THREE.SphereGeometry(200, 32, 24)
  const material = new THREE.ShaderMaterial({
    vertexShader: spaceFogVertexShader,
    fragmentShader: spaceFogFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uColorTop: { value: colorTop },
      uColorBottom: { value: colorBottom },
      uTime: { value: 0 },
    },
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = -1

  function update(time) {
    material.uniforms.uTime.value = time
  }

  return { mesh, material, update }
}
