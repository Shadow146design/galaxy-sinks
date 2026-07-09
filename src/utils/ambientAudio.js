/**
 * A looping synth pad ("nappe spatiale") built entirely from Web Audio
 * nodes — no audio files. A handful of detuned oscillators through a warm
 * lowpass filter and a feedback delay, with a slow LFO breathing the filter
 * cutoff so it never feels static. setIntensity(velocity) is meant to be
 * called every frame with the current scroll speed: faster scrolling opens
 * the filter (brighter) and raises the delay's feedback/wet mix (more
 * echo), so the texture audibly reacts to how fast the visitor is moving
 * through the page — at rest it settles back to a calm, dark drone.
 */
export function createAmbientPad() {
  let ctx = null
  let masterGain = null
  let filter = null
  let feedbackGain = null
  let wetGain = null
  let started = false
  let muted = false

  // Open-fifth-and-octave voicing (root, fifth, octave, + a detuned unison
  // on the root for width/beating) — reads as spacious rather than "musical".
  const VOICES = [65.41, 65.41 * 1.006, 98.0, 130.81]

  function build() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    ctx = new AudioContextClass()

    masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)

    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    filter.Q.value = 0.7

    const delay = ctx.createDelay(2)
    delay.delayTime.value = 0.42
    feedbackGain = ctx.createGain()
    feedbackGain.gain.value = 0.15
    wetGain = ctx.createGain()
    wetGain.gain.value = 0.2

    // dry path
    filter.connect(masterGain)
    // wet (echo) path: filter -> delay -> feedback loop back into delay, and
    // out to the wet gain -> master
    filter.connect(delay)
    delay.connect(feedbackGain)
    feedbackGain.connect(delay)
    delay.connect(wetGain)
    wetGain.connect(masterGain)

    VOICES.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle'
      osc.frequency.value = freq

      const voiceGain = ctx.createGain()
      voiceGain.gain.value = 0.9 / VOICES.length

      osc.connect(voiceGain).connect(filter)
      osc.start()
    })

    // Slow LFO so the filter "breathes" instead of sitting static even when
    // the visitor isn't scrolling.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 120
    lfo.connect(lfoGain).connect(filter.frequency)
    lfo.start()
  }

  function start() {
    if (!ctx) build()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    if (started) return
    started = true
    masterGain.gain.cancelScheduledValues(ctx.currentTime)
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime)
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.16, ctx.currentTime + 2.5)
  }

  function setIntensity(velocity) {
    if (!ctx) return
    const norm = Math.min(Math.abs(velocity) / 40, 1)
    const targetCutoff = 400 + norm * 1800
    const targetFeedback = 0.15 + norm * 0.3
    const targetWet = 0.2 + norm * 0.3

    // Gentle per-call easing (not a hard setValueAtTime jump) so the texture
    // glides rather than steps as scroll speed changes frame to frame.
    const now = ctx.currentTime
    filter.frequency.setTargetAtTime(targetCutoff, now, 0.25)
    feedbackGain.gain.setTargetAtTime(targetFeedback, now, 0.25)
    wetGain.gain.setTargetAtTime(targetWet, now, 0.25)
  }

  function setMuted(value) {
    muted = value
    if (!ctx || !started) return
    const now = ctx.currentTime
    masterGain.gain.cancelScheduledValues(now)
    masterGain.gain.setValueAtTime(masterGain.gain.value, now)
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.16, now + 0.6)
  }

  /**
   * A single synthesized "typing tick" for the typewriter text reveal — a
   * ~20ms triangle burst, pitched and panned with a little randomness per
   * call so a fast run of them (one per character) reads as a texture
   * rather than the same sample looping. Routed straight to masterGain,
   * bypassing the pad's lowpass/delay chain, so it stays crisp instead of
   * getting muffled or smeared by the pad's own filter sweep — but it
   * still shares masterGain, so muting the pad mutes ticks too.
   */
  function playTick() {
    if (!ctx || !started) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 1900 + Math.random() * 500

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022)

    let node = osc.connect(gain)
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      panner.pan.value = (Math.random() - 0.5) * 0.5
      node = node.connect(panner)
    }
    node.connect(masterGain)

    osc.start(now)
    osc.stop(now + 0.03)
  }

  /**
   * A short filtered-noise "boost" whoosh — the single most iconic Rocket
   * League sound — fired on every section-transition beat alongside the
   * existing particle/glitch kick. A burst of white noise swept through a
   * rising-then-falling bandpass filter reads as a rush of air rather than
   * a musical note, in keeping with the rest of this file's synthesis-only
   * approach (no recorded samples anywhere in the project).
   */
  function playBoost() {
    if (!ctx || !started) return
    const now = ctx.currentTime
    const duration = 0.45

    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(280, now)
    filter.frequency.exponentialRampToValueAtTime(3000, now + duration * 0.65)
    filter.frequency.exponentialRampToValueAtTime(700, now + duration)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.07)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    noise.connect(filter).connect(gain).connect(masterGain)
    noise.start(now)
    noise.stop(now + duration)
  }

  /**
   * A short triumphant three-note blast — a nod to the arena goal horn —
   * for the one moment the site actually talks about a goal (the Match
   * History section). Same synthesis-only approach as everything else: three
   * detuned sawtooth oscillators landing in quick succession, not a sample.
   */
  function playGoalHorn() {
    if (!ctx || !started) return
    const now = ctx.currentTime
    const notes = [392, 523.25, 659.25]

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq

      const gain = ctx.createGain()
      const start = now + i * 0.06
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)

      osc.connect(gain).connect(masterGain)
      osc.start(start)
      osc.stop(start + 0.95)
    })
  }

  return {
    start,
    setIntensity,
    setMuted,
    playTick,
    playBoost,
    playGoalHorn,
    isMuted: () => muted,
  }
}
