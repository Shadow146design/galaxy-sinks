/**
 * Rasterizes text to an offscreen canvas and samples its opaque pixels into
 * a flat Float32Array of 3D world-space positions, so a particle system can
 * morph into the shape of the text.
 */
export function sampleTextPositions(text, count, { width = 1536, height = 320, worldWidth = 9 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Shrink the font until the text fits within the canvas so no letters get clipped.
  const maxTextWidth = width * 0.88
  let fontSize = height * 0.6
  ctx.font = `700 ${fontSize}px Arial, "Helvetica Neue", sans-serif`
  const measuredWidth = ctx.measureText(text).width
  if (measuredWidth > maxTextWidth) {
    fontSize *= maxTextWidth / measuredWidth
    ctx.font = `700 ${fontSize}px Arial, "Helvetica Neue", sans-serif`
  }

  ctx.fillText(text, width / 2, height / 2)

  const { data } = ctx.getImageData(0, 0, width, height)
  const candidates = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4]
      if (alpha > 128) candidates.push(x, y)
    }
  }

  const worldHeight = worldWidth * (height / width)
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const c = (Math.floor(Math.random() * (candidates.length / 2)) * 2)
    const x = candidates[c]
    const y = candidates[c + 1]

    const i3 = i * 3
    positions[i3] = (x / width - 0.5) * worldWidth + (Math.random() - 0.5) * 0.05
    positions[i3 + 1] = -(y / height - 0.5) * worldHeight + (Math.random() - 0.5) * 0.05
    positions[i3 + 2] = (Math.random() - 0.5) * 0.3
  }

  return positions
}
