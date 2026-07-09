import * as THREE from 'three'

/**
 * Contact section landmark: a closing "portal" — two concentric solid,
 * glowing rings standing upright, reading as a gateway at the end of the
 * journey rather than bare wireframe loops.
 */
export function createContactPortal() {
  const group = new THREE.Group()
  const materials = []

  function addRing(radius, tube, color) {
    const geometry = new THREE.TorusGeometry(radius, tube, 12, 40)
    const fillMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(geometry, fillMaterial)
    group.add(ring)
    materials.push(fillMaterial)
    return ring
  }

  addRing(1.6, 0.05, '#9b6bff')
  addRing(1.15, 0.045, '#4dfff2')

  return { group, materials }
}
