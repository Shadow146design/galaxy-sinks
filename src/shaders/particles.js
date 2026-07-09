export const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  uniform float uNoiseFrequency;
  uniform float uNoiseAmplitude;
  uniform float uProgress;

  attribute float aScale;
  attribute vec3 aTargetPosition;

  varying float vScale;
  varying float vNoise;
  varying float vFogDepth;
  varying float vSeed;

  // --- 3D Simplex noise (Ashima Arts / Ian McEwan) ---
  vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    float t = uTime * uSpeed;

    // Three offset noise samples give a flowing, organic curl to the cloud.
    float nx = snoise(position * uNoiseFrequency + vec3(t, 0.0, 0.0));
    float ny = snoise(position * uNoiseFrequency + vec3(0.0, t, 100.0));
    float nz = snoise(position * uNoiseFrequency + vec3(100.0, 0.0, t));

    // Chaotic noise fades out as uProgress goes from 0 (sphere) to 1 (text),
    // so the cloud settles smoothly into the target shape instead of snapping.
    vec3 morphed = mix(position, aTargetPosition, uProgress);
    vec3 pos = morphed + vec3(nx, ny, nz) * uNoiseAmplitude * (1.0 - uProgress);

    vNoise = nx;
    vScale = aScale;
    // A stable per-star random seed → each star twinkles on its own phase.
    vSeed = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = uSize * aScale * (1.0 / -mvPosition.z);
    // Hard cap so a star the camera glides toward never balloons into a big
    // white blob rushing at the viewer.
    gl_PointSize = min(gl_PointSize, uSize * 0.5);
    vFogDepth = -mvPosition.z;
  }
`

export const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec3 fogColor;
  uniform float fogDensity;

  varying float vScale;
  varying float vNoise;
  varying float vFogDepth;
  varying float vSeed;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    float strength = 1.0 - smoothstep(0.0, 0.5, dist);
    strength = pow(strength, 3.0);
    strength *= uOpacity;

    // Twinkle: each star pulses on its own random phase so the field shimmers
    // gently instead of sitting perfectly still.
    float twinkle = 0.6 + 0.4 * sin(uTime * 1.6 + vSeed * 6.2831853);
    strength *= twinkle;

    // Near fade: stars very close to the camera fade out instead of looming
    // large and bright as the camera drifts toward them.
    float nearFade = smoothstep(1.0, 8.0, vFogDepth);
    strength *= nearFade;

    vec3 color = mix(uColorA, uColorB, vNoise * 0.5 + 0.5);

    // Exponential-squared fog (same falloff three.js uses for FogExp2):
    // fades distant particles toward the fog color, which is additive
    // blending's way of sinking them into the dark background for depth.
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    color = mix(color, fogColor, fogFactor);

    gl_FragColor = vec4(color, strength * vScale);
  }
`
