import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

/**
 * A cheap "motion blur" stand-in: a feedback trail that blends each frame
 * with a persistent buffer holding the *previous* frame's already-blended
 * result, rather than true per-pixel velocity-based blur (which needs a
 * velocity buffer three.js's standard postprocessing stack doesn't provide
 * out of the box). setBlur(0) is a perfectly crisp frame; higher values
 * smear recent frames together into a trailing ghost — driven every frame
 * in main.js by scroll speed, so it's only visible while the visitor is
 * actually scrolling fast, not as a constant blur sitting over everything.
 */
class TrailPass extends Pass {
  constructor(width, height) {
    super()
    this.needsSwap = true

    this.uniforms = {
      tDiffuse: { value: null },
      tTrail: { value: null },
      uBlur: { value: 0 },
    }

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tTrail;
        uniform float uBlur;
        varying vec2 vUv;
        void main() {
          vec4 current = texture2D(tDiffuse, vUv);
          vec4 trail = texture2D(tTrail, vUv);
          gl_FragColor = mix(current, trail, uBlur);
        }
      `,
    })

    this.fsQuad = new FullScreenQuad(this.material)
    this.trailTarget = new THREE.WebGLRenderTarget(width, height)
  }

  setBlur(value) {
    this.uniforms.uBlur.value = value
  }

  setSize(width, height) {
    this.trailTarget.setSize(width, height)
  }

  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture
    this.uniforms.tTrail.value = this.trailTarget.texture

    if (this.renderToScreen) {
      renderer.setRenderTarget(null)
    } else {
      renderer.setRenderTarget(writeBuffer)
      if (this.clear) renderer.clear()
    }
    this.fsQuad.render(renderer)

    // Stash this frame's blended output as next frame's trail source — same
    // uniforms, same quad, just rendered again into the persistent buffer.
    renderer.setRenderTarget(this.trailTarget)
    this.fsQuad.render(renderer)
  }

  dispose() {
    this.material.dispose()
    this.fsQuad.dispose()
    this.trailTarget.dispose()
  }
}

export function createTrailPass(width, height) {
  return new TrailPass(width, height)
}
