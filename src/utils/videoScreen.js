import * as THREE from 'three'

/**
 * Vidéo section landmark: an actual modeled monitor — a solid dark bezel
 * housing, a bright glowing screen face, a play-icon triangle sitting on
 * that screen, and a stand — reads as a real video/replay player console
 * rather than a flat neon outline.
 */
export function createVideoScreen() {
  const group = new THREE.Group()
  const materials = []

  function addSolid(geometry, color, position, { additive = false } = {}) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      ...(additive ? { blending: THREE.AdditiveBlending, depthWrite: false } : {}),
    })
    const mesh = new THREE.Mesh(geometry, material)
    if (position) mesh.position.set(...position)
    group.add(mesh)
    materials.push(material)
    return mesh
  }

  function addEdges(mesh, color) {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), material))
    materials.push(material)
  }

  // Bezel: a solid dark housing, like a real monitor's frame.
  const bezel = addSolid(new THREE.BoxGeometry(3.3, 2.0, 0.14), '#12121c', [0, 0, -0.02])
  addEdges(bezel, '#4dfff2')

  // Screen: bright and additive so it reads as an emissive display rather
  // than another flat panel — the one part of the monitor that should
  // actually look lit from within.
  addSolid(new THREE.PlaneGeometry(2.9, 1.6), '#0d2b4f', [0, 0, 0.06], { additive: true })

  // A few thin "scanline" bars across the screen for a video-console feel.
  ;[0.5, 0.15, -0.2, -0.55].forEach((y) => {
    addSolid(new THREE.PlaneGeometry(2.6, 0.03), '#4dfff2', [0, y, 0.07], { additive: true })
  })

  // Play triangle icon, filled.
  const triShape = new THREE.Shape()
  triShape.moveTo(-0.22, 0.28)
  triShape.lineTo(-0.22, -0.28)
  triShape.lineTo(0.3, 0)
  triShape.closePath()
  addSolid(new THREE.ShapeGeometry(triShape), '#ff3ec8', [0, 0, 0.08], { additive: true })

  // Stand.
  const stand = addSolid(new THREE.BoxGeometry(0.9, 0.12, 0.4), '#12121c', [0, -1.15, 0])
  addEdges(stand, '#4dfff2')

  return { group, materials }
}
