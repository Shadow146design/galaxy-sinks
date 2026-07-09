import * as THREE from 'three'

/**
 * Histoire section landmark: a row of solid, edge-glowing pillars rising in
 * height — reads as a growth/milestone monument, echoing the section's
 * timeline. Filled panels (not pure wireframe) give each pillar real color
 * and body instead of a thin neon outline.
 */
export function createHistoryMonument() {
  const group = new THREE.Group()
  const materials = []
  const heights = [0.8, 1.3, 1.8, 2.4, 3.1]
  const colors = ['#4dfff2', '#9b6bff', '#4dfff2', '#9b6bff', '#ff3ec8']

  heights.forEach((h, i) => {
    const geometry = new THREE.BoxGeometry(0.5, h, 0.5)
    const color = colors[i % colors.length]

    const fillMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })
    const pillar = new THREE.Mesh(geometry, fillMaterial)
    pillar.position.set((i - (heights.length - 1) / 2) * 0.75, h / 2 - 1.2, 0)

    const edgeMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    pillar.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial))

    group.add(pillar)
    materials.push(fillMaterial, edgeMaterial)
  })

  return { group, materials }
}
