import * as THREE from 'three'

/**
 * Stats section landmark: a 3D radar/spider chart with a filled, glowing
 * data area (not just thin outline rings), plus a small wireframe ball at
 * the center — a nod to Rocket League rather than a generic dashboard
 * widget — reads as a live stats readout with real color and identity.
 */
export function createStatsRadar() {
  const group = new THREE.Group()
  const materials = []
  const SPOKES = 6

  function circlePositions(radius, segments = 48) {
    const positions = []
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
    }
    return positions
  }

  function addLine(positions, color, closed = false) {
    const finalPositions = closed ? [...positions, positions[0], positions[1], positions[2]] : positions
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(finalPositions, 3))
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    group.add(new THREE.Line(geometry, material))
    materials.push(material)
    return material
  }

  ;[0.6, 1.1, 1.6].forEach((radius) => addLine(circlePositions(radius), '#4dfff2'))

  const spokePositions = []
  const dataAngles = []
  for (let i = 0; i < SPOKES; i++) {
    const angle = (i / SPOKES) * Math.PI * 2
    spokePositions.push(0, 0, 0, Math.cos(angle) * 1.6, Math.sin(angle) * 1.6, 0)
    dataAngles.push(angle)
  }

  const spokeGeometry = new THREE.BufferGeometry()
  spokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(spokePositions, 3))
  const spokeMaterial = new THREE.LineBasicMaterial({
    color: '#9b6bff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  group.add(new THREE.LineSegments(spokeGeometry, spokeMaterial))
  materials.push(spokeMaterial)

  // Filled data area: a solid, semi-transparent polygon underneath the
  // wireframe data outline, so the chart reads as a lit readout instead of
  // bare lines with nothing behind them.
  const dataPoints2D = dataAngles.map((angle) => {
    const radius = THREE.MathUtils.lerp(0.6, 1.5, Math.random())
    return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius)
  })
  const dataShape = new THREE.Shape(dataPoints2D)
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: '#ff3ec8',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  group.add(new THREE.Mesh(new THREE.ShapeGeometry(dataShape), fillMaterial))
  materials.push(fillMaterial)

  const dataOutlinePositions = dataPoints2D.flatMap((p) => [p.x, p.y, 0])
  addLine(dataOutlinePositions, '#ff3ec8', true)

  // A small wireframe ball at the center — Rocket League's own icon,
  // grounding an otherwise generic chart shape in the site's actual theme.
  const ballGeometry = new THREE.IcosahedronGeometry(0.28, 2)
  const ballMaterial = new THREE.LineBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(ballGeometry), ballMaterial))
  materials.push(ballMaterial)

  return { group, materials }
}
