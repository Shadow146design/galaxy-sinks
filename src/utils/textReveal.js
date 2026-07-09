import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText, ScrollTrigger)

// Same breakpoint as the site's mobile CSS layout switch — below it, text
// just keeps the existing simple block-level `.reveal` fade for legibility
// and to avoid splitting hundreds of extra span elements on weaker devices.
const isDesktop = () => window.matchMedia('(min-width: 721px)').matches

/**
 * Splits each matched element's own text into chars or words and reveals
 * them with a staggered fade as the element scrolls into view — the
 * "typewriter" cinematic effect. Bidirectional: scrolling back up past the
 * element fades it back out the same way. Does nothing on narrow viewports.
 *
 * Callers are responsible for keeping these elements out of any ancestor's
 * own opacity-based `.reveal` animation (CSS opacity multiplies down the
 * tree, so two independent opacity fades on the same pixels would compound
 * into a duller, mistimed result) — see the HTML structure around each of
 * this function's call sites in main.js.
 *
 * onTick(optional): fired the instant each character/word starts revealing
 * on the way in (forward direction only, not on the reverse onLeaveBack
 * fade) — used to play a synced typing-tick sound. A single gsap.to() with
 * a `stagger` option only exposes one onStart for the whole batch, not one
 * per target, so the forward reveal is built as individually-delayed
 * tweens instead — the only way to get a real per-character callback with
 * zero perceptible drift between the visual and the sound.
 */
export function setupTypewriterReveal(selector, { type = 'words', stagger = 0.035, duration = 0.5, onTick } = {}) {
  if (!isDesktop()) return

  document.querySelectorAll(selector).forEach((el) => {
    // SplitText always builds word-level wrappers internally and only keeps
    // them in the DOM if 'words' is part of the requested type — asking for
    // 'chars' alone strips them, and bare per-character inline-blocks can
    // then line-wrap between ANY two characters instead of just at word
    // boundaries (a real bug we hit: "Sinks" wrapping as "Si" / "nks").
    // Requesting both keeps mid-word breaks impossible either way.
    const split = SplitText.create(el, { type: type === 'chars' ? 'chars,words' : type, autoSplit: false })
    const targets = type === 'chars' ? split.chars : split.words

    gsap.set(targets, { opacity: 0, y: 8 })

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () =>
        targets.forEach((target, i) =>
          gsap.to(target, {
            opacity: 1,
            y: 0,
            duration,
            delay: i * stagger,
            ease: 'power2.out',
            overwrite: true,
            onStart: onTick,
          })
        ),
      onLeaveBack: () =>
        gsap.to(targets, {
          opacity: 0,
          y: 8,
          duration: duration * 0.6,
          stagger: stagger * 0.6,
          ease: 'power2.in',
          overwrite: true,
        }),
    })
  })
}
