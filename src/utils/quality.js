/**
 * Cheap, synchronous device-capability heuristic used to pick a starting
 * particle density and pixel-ratio cap before anything is rendered — no
 * benchmark, just signals that correlate with weaker GPUs/CPUs (low core
 * count, low RAM, touch-first devices).
 */
export function detectQualityTier() {
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 4
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
  const isNarrowViewport = window.innerWidth < 768

  if (cores <= 4 || memory <= 4 || (isCoarsePointer && isNarrowViewport)) return 'low'
  if (cores <= 6 || isCoarsePointer) return 'medium'
  return 'high'
}

export const QUALITY_PRESETS = {
  high: { drawCount: 160000, pixelRatioCap: 2 },
  medium: { drawCount: 90000, pixelRatioCap: 1.5 },
  low: { drawCount: 45000, pixelRatioCap: 1 },
}
