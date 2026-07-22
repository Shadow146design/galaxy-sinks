import * as THREE from 'three'
import { OrgLineShader } from '../shaders/orgLine.js'

const SEGMENTS = 24
const ROSTER_NAMES = ['Lucas', 'Chelli', 'Vxice', 'Luciano', 'Mimi', 'Sass']

// The three-color cycle every connector line and the hub itself pulse
// through — the brand's own palette, not an arbitrary rainbow, so the
// "living wiring diagram" effect still reads as this site's colors.
const CYCLE_COLORS = [new THREE.Color('#9b6bff'), new THREE.Color('#4dfff2'), new THREE.Color('#ff3ec8')]

function sampleCycleColor(target, t) {
  const wrapped = ((t % CYCLE_COLORS.length) + CYCLE_COLORS.length) % CYCLE_COLORS.length
  const i = Math.floor(wrapped)
  const next = (i + 1) % CYCLE_COLORS.length
  target.lerpColors(CYCLE_COLORS[i], CYCLE_COLORS[next], wrapped - i)
}

/**
 * A small 3D node graph for the Staff section: a central hub connects to
 * the two founders and out to the wider roster in an arc. Lines are drawn
 * progressively (see uDrawProgress in orgLine.js, driven from main.js via
 * ScrollTrigger), bend gently toward the cursor every frame, and continuously
 * cycle through the brand palette rather than sitting at one flat color.
 * Every node (hub + members) breathes on its own sine wave — organic nodes
 * rather than static balls.
 *
 * The hub is two overlapping icosahedra in the site's violet/cyan brand
 * gradient — a stand-in "logo" core distinct from the plain member nodes,
 * since there's no texture/text in this abstract-geometry scene to render
 * an actual wordmark. The 11 member nodes (2 founders + 9 roster) share a
 * single InstancedMesh — one draw call instead of eleven.
 */
export function createOrgChart() {
  const group = new THREE.Group()

  const hub = new THREE.Vector3(0, 0.3, 0)

  // The "logo": two overlapping, slightly offset icosahedra in the brand's
  // signature violet->cyan pairing, standing in for a wordmark.
  const hubGeometry = new THREE.IcosahedronGeometry(0.22, 1)
  const hubMaterialA = new THREE.MeshBasicMaterial({
    color: '#9b6bff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const hubMaterialB = new THREE.MeshBasicMaterial({
    color: '#4dfff2',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const hubMeshA = new THREE.Mesh(hubGeometry, hubMaterialA)
  hubMeshA.position.copy(hub)
  const hubMeshB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), hubMaterialB)
  hubMeshB.position.copy(hub).add(new THREE.Vector3(0.08, 0.05, 0.05))
  group.add(hubMeshA, hubMeshB)

  const roots = [
    { name: 'Ins4ne', position: new THREE.Vector3(-1.5, 1.7, 0.3), color: new THREE.Color('#4dfff2'), scale: 1.2 },
    { name: 'Shadow', position: new THREE.Vector3(1.5, 1.7, -0.3), color: new THREE.Color('#ff3ec8'), scale: 1.2 },
  ]
  const roster = ROSTER_NAMES.map((name, i) => {
    const t = i / (ROSTER_NAMES.length - 1)
    return {
      name,
      position: new THREE.Vector3(
        THREE.MathUtils.lerp(-3.2, 3.2, t),
        -1.6 - Math.sin(t * Math.PI) * 0.4,
        Math.cos(t * Math.PI) * 0.9 - 0.3,
      ),
      color: new THREE.Color('#9b6bff'),
      scale: 0.85,
    }
  })

  const members = [...roots, ...roster]
  // Each node breathes on its own phase offset (not all in lockstep) so the
  // graph reads as organically alive rather than a single synchronized pulse.
  const memberPhases = members.map(() => Math.random() * Math.PI * 2)

  const nodesMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.14, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    members.length,
  )
  const instanceMatrix = new THREE.Matrix4()
  members.forEach((member, i) => {
    instanceMatrix.makeScale(member.scale, member.scale, member.scale)
    instanceMatrix.setPosition(member.position)
    nodesMesh.setMatrixAt(i, instanceMatrix)
    nodesMesh.setColorAt(i, member.color)
  })
  nodesMesh.instanceMatrix.needsUpdate = true
  if (nodesMesh.instanceColor) nodesMesh.instanceColor.needsUpdate = true
  group.add(nodesMesh)

  const connections = members.map((target) => ({ from: hub, to: target.position }))
  const linePhases = connections.map((_, i) => i / connections.length)

  const lines = connections.map(() => {
    const positions = new Float32Array(SEGMENTS * 3)
    const progress = new Float32Array(SEGMENTS)
    for (let i = 0; i < SEGMENTS; i++) progress[i] = i / (SEGMENTS - 1)

    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    lineGeometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))

    const material = new THREE.ShaderMaterial({
      vertexShader: OrgLineShader.vertexShader,
      fragmentShader: OrgLineShader.fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color('#9b6bff') },
        uDrawProgress: { value: 0 },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const line = new THREE.Line(lineGeometry, material)
    group.add(line)
    return { line, material }
  })

  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3())
  const tmpPoint = new THREE.Vector3()

  /**
   * Recomputes every line's curve each frame so they bend toward
   * `mouseWorld` — a subtle "magnetic" pull, not a hard snap-to-cursor —
   * cycles every line's color through the brand palette (faster while the
   * visitor is actively scrolling), and makes every node (hub + members)
   * breathe on a sine wave rather than sitting at a fixed size.
   */
  const tmpColor = new THREE.Color()

  function update(mouseWorld, time = 0, scrollVelocity = 0) {
    lines.forEach(({ line, material }, i) => {
      const { from, to } = connections[i]
      curve.v0.copy(from)
      curve.v2.copy(to)
      curve.v1.copy(from).add(to).multiplyScalar(0.5).lerp(mouseWorld, 0.25)

      const positionAttr = line.geometry.attributes.position
      for (let s = 0; s < SEGMENTS; s++) {
        curve.getPoint(s / (SEGMENTS - 1), tmpPoint)
        positionAttr.setXYZ(s, tmpPoint.x, tmpPoint.y, tmpPoint.z)
      }
      positionAttr.needsUpdate = true

      const cycleSpeed = 0.08 + Math.min(Math.abs(scrollVelocity) * 0.01, 0.6)
      sampleCycleColor(tmpColor, time * cycleSpeed + linePhases[i] * CYCLE_COLORS.length)
      material.uniforms.uColor.value.copy(tmpColor)
    })

    const hubPulse = 1 + Math.sin(time * 1.1) * 0.12
    hubMeshA.scale.setScalar(hubPulse)
    hubMeshB.scale.setScalar(hubPulse)

    members.forEach((member, i) => {
      const pulse = member.scale * (1 + Math.sin(time * 1.3 + memberPhases[i]) * 0.15)
      instanceMatrix.makeScale(pulse, pulse, pulse)
      instanceMatrix.setPosition(member.position)
      nodesMesh.setMatrixAt(i, instanceMatrix)
    })
    nodesMesh.instanceMatrix.needsUpdate = true
  }

  return {
    group,
    update,
    lineMaterials: lines.map((l) => l.material),
    nodeMaterials: [hubMaterialA, hubMaterialB, nodesMesh.material],
  }
}
