/**
 * Draws a polyline progressively: each vertex carries a fixed `aProgress`
 * (its position 0-1 along the line, set once at creation), and the
 * fragment shader discards anything past `uDrawProgress` — so animating
 * that one uniform from 0 to 1 "draws" the line, with a small bright flare
 * right at the growing tip. Positions themselves are still rewritten every
 * frame in JS (see orgChart.js) so the line can also bend toward the
 * cursor without touching this shader.
 */
export const OrgLineShader = {
  vertexShader: /* glsl */ `
    attribute float aProgress;
    varying float vProgress;
    void main() {
      vProgress = aProgress;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uDrawProgress;
    uniform float uOpacity;
    varying float vProgress;

    void main() {
      if (vProgress > uDrawProgress) discard;

      float tip = smoothstep(uDrawProgress - 0.08, uDrawProgress, vProgress);
      vec3 color = uColor + tip * 0.7;
      gl_FragColor = vec4(color, uOpacity);
    }
  `,
}
