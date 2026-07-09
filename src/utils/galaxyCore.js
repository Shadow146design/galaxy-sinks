import * as THREE from 'three'

/**
 * "Galaxy Core": a procedural, code-generated car silhouette — nothing here
 * is an imported/downloaded model, every panel is a primitive geometry
 * built at runtime. Blue body, black roof/spoiler, gold wheel hubs, all
 * kept deliberately translucent (glass-like, not flat opaque paint) so the
 * glowing neon edges layered on top of every panel stay the dominant
 * read — plus a small drifting shell of "galactic particle" stardust
 * around it, reinforcing that this is a creature of light and particles
 * rather than a solid toy model. update() gives it a slow idle sway and a
 * gentle vertical bob so it reads as floating.
 *
 * A flat box only reads as "a car" from a 3/4 angle — a pure side view
 * collapses the near/far wheels into one overlapping smear, and a pure
 * front/back view flattens the whole body to a sliver. BASE_ROTATION parks
 * it at the classic "3/4 car-ad" angle where both problems go away — the
 * update loop only *sways* gently around that angle rather than fully
 * spinning through it, so it never drifts back into either bad extreme.
 */
const BASE_ROTATION = Math.PI / 7.5

function createParticleSwarm() {
  const count = 260
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = THREE.MathUtils.lerp(1.5, 2.5, Math.random())
    positions[i3] = Math.sin(phi) * Math.cos(theta) * r * 1.35
    positions[i3 + 1] = Math.cos(phi) * r * 0.5
    positions[i3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.85
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: '#bcd4ff',
    size: 0.05,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geometry, material)

  return { points, material }
}

export function createGalaxyCore() {
  const group = new THREE.Group()
  const fillMaterials = []
  const edgeMaterials = []

  function addPart(geometry, fillColor, edgeColor, position, rotationZ) {
    // Kept translucent on purpose — the neon edge outline (below) is meant
    // to read as the primary silhouette, with the fill as a faint tinted
    // glass rather than solid opaque paint. Standard (lit) so it still
    // catches the cursor point light (see main.js) as a soft highlight.
    const fillMaterial = new THREE.MeshStandardMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0,
      roughness: 0.3,
      metalness: 0.5,
    })
    const mesh = new THREE.Mesh(geometry, fillMaterial)
    if (position) mesh.position.set(...position)
    if (rotationZ) mesh.rotation.z = rotationZ

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial))

    group.add(mesh)
    fillMaterials.push(fillMaterial)
    edgeMaterials.push(edgeMaterial)
    return mesh
  }

  const BLUE = '#2f6bff'
  const BLUE_GLOW = '#8fbcff'
  const BLACK = '#0f0f16'

  // Chassis + a lower front hood section (shorter, so the hood/cabin step
  // stays visible even from straight-on rather than reading as one slab).
  addPart(new THREE.BoxGeometry(2.5, 0.34, 1.28), BLUE, BLUE_GLOW)
  addPart(new THREE.BoxGeometry(0.95, 0.26, 1.1), BLUE, BLUE_GLOW, [0.95, 0.12, 0])

  // Roof: black, narrower than the body, pushed toward the rear.
  addPart(new THREE.BoxGeometry(1.05, 0.38, 0.88), BLACK, '#4dfff2', [-0.25, 0.46, 0])

  // Rear spoiler: a thin raised black wing.
  addPart(new THREE.BoxGeometry(0.85, 0.05, 1.15), BLACK, '#ff3ec8', [-1.15, 0.36, 0])

  // Headlights: pale, at the front corners.
  ;[0.62, -0.62].forEach((z) => {
    addPart(new THREE.BoxGeometry(0.1, 0.1, 0.22), '#eaf6ff', '#eaf6ff', [1.58, 0.05, z])
  })

  // Wheels: a black tire cylinder + a smaller gold hub, both edge-glowing.
  const wheelPositions = [
    [1.05, -0.32, 0.66],
    [1.05, -0.32, -0.66],
    [-1.05, -0.32, 0.66],
    [-1.05, -0.32, -0.66],
  ]
  wheelPositions.forEach(([x, y, z]) => {
    addPart(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), BLACK, '#333340', [x, y, z], Math.PI / 2)
    addPart(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 16), '#d4af37', '#ffdc73', [x, y, z], Math.PI / 2)
  })

  const swarm = createParticleSwarm()
  group.add(swarm.points)

  const materials = [...fillMaterials, ...edgeMaterials, swarm.material]
  const baseY = group.position.y

  function update(time) {
    // A gentle sway (not a full spin) around the 3/4 angle — enough to feel
    // alive without ever drifting into the flat-side or flat-front views.
    group.rotation.y = BASE_ROTATION + Math.sin(time * 0.15) * 0.15
    group.position.y = baseY + Math.sin(time * 0.6) * 0.25
    swarm.points.rotation.y = time * 0.08
    swarm.points.rotation.x = Math.sin(time * 0.05) * 0.1
  }

  return { group, materials, fillMaterials, edgeMaterials, swarmMaterial: swarm.material, update }
}
