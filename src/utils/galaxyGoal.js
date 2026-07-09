import * as THREE from 'three'

/**
 * A stylized wireframe goal frame — a front rectangle plus the net's
 * volume behind it, both as glowing line-edges — positioned to sit behind
 * the "Reprises" glass panel in the Match History section. It's a stand-in
 * for real goal-replay footage (see the panel's "coming soon" copy), not a
 * functioning video preview.
 */
export function createGalaxyGoal() {
  const group = new THREE.Group()

  function addWireBox(width, height, depth, color, offsetZ = 0) {
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), material)
    lines.position.z = offsetZ
    group.add(lines)
    return material
  }

  const frameMat = addWireBox(2.4, 1.2, 0.04, '#4dfff2', 0.45)
  const netMat = addWireBox(2.4, 1.2, 0.9, '#9b6bff', 0)

  // A handful of net "threads" running front-to-back, just enough to read
  // as a net rather than an empty box.
  const netLinePositions = []
  const netSteps = 4
  for (let i = 1; i < netSteps; i++) {
    const x = THREE.MathUtils.lerp(-1.2, 1.2, i / netSteps)
    netLinePositions.push(x, 0.6, 0, x, 0.6, -0.9, x, -0.6, 0, x, -0.6, -0.9)
    const y = THREE.MathUtils.lerp(-0.6, 0.6, i / netSteps)
    netLinePositions.push(-1.2, y, 0, -1.2, y, -0.9, 1.2, y, 0, 1.2, y, -0.9)
  }
  const netLinesGeometry = new THREE.BufferGeometry()
  netLinesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(netLinePositions, 3))
  const netThreadsMat = new THREE.LineBasicMaterial({
    color: '#9b6bff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const netThreads = new THREE.LineSegments(netLinesGeometry, netThreadsMat)
  group.add(netThreads)

  return { group, materials: [frameMat, netMat, netThreadsMat] }
}
