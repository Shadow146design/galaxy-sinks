/**
 * Post-processing "spatial glitch" pass: a brief RGB channel split plus
 * scanline-slice displacement over the whole rendered frame, driven by
 * uStrength (1 = full glitch, 0 = clean). main.js spikes uStrength to ~1 and
 * lets it decay back to 0 on every section transition, so the 3D scene
 * itself — not just the DOM — visibly "blips" at the exact cut point.
 */
export const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uTime;
    varying vec2 vUv;

    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;

      if (uStrength > 0.001) {
        // Coarse horizontal slices, each jittered a different amount —
        // the classic "torn scanline" glitch silhouette.
        float slice = floor(uv.y * 24.0);
        float sliceJitter = hash(slice + floor(uTime * 40.0));
        uv.x += (sliceJitter - 0.5) * 0.06 * uStrength;
      }

      float caAmount = 0.008 * uStrength;
      float r = texture2D(tDiffuse, uv + vec2(caAmount, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(caAmount, 0.0)).b;
      float a = texture2D(tDiffuse, uv).a;

      gl_FragColor = vec4(r, g, b, a);
    }
  `,
}
