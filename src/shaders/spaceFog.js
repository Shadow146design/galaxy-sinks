export const spaceFogVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// A cheap value-noise (not simplex — three octaves of this is plenty for a
// slow-drifting backdrop and far lighter than a full simplex implementation)
// gives the gradient soft, slowly-moving "volumetric" wisps instead of a
// flat two-color blend, so the logo/text read as floating in atmosphere
// rather than pinned to a flat backdrop.
export const spaceFogFragmentShader = /* glsl */ `
  uniform vec3 uColorTop;
  uniform vec3 uColorBottom;
  uniform float uTime;
  varying vec3 vWorldPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 gradient = mix(uColorBottom, uColorTop, h);

    float n = noise(dir * 2.2 + vec3(0.0, uTime * 0.015, uTime * 0.01));
    n += noise(dir * 4.4 - vec3(uTime * 0.008)) * 0.5;
    n /= 1.5;

    vec3 color = gradient + (n - 0.5) * 0.05;
    gl_FragColor = vec4(color, 1.0);
  }
`
