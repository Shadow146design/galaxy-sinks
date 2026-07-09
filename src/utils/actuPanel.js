import * as THREE from 'three'

/**
 * Actu section landmark: a small fan of solid, edge-glowing panels,
 * staggered like a stack of news cards — filled color instead of bare
 * wireframe boxes.
 */
export function createActuPanel() {
  const group = new THREE.Group()
  const materials = []
  const colors = ['#ff3ec8', '#9b6bff', '#4dfff2']

  colors.forEach((color, i) => {
    const geometry = new THREE.BoxGeometry(1.6, 2.1, 0.05)
    const fillMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
    })
    const panel = new THREE.Mesh(geometry, fillMaterial)
    panel.position.set(i * 0.55 - 0.55, i * -0.15, i * 0.35)
    panel.rotation.y = (i - 1) * 0.35

    const edgeMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    panel.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial))

    group.add(panel)
    materials.push(fillMaterial, edgeMaterial)
  })

  return { group, materials }
}
