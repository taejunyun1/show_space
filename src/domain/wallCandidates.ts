import {removeContainedSolidBands} from './containedBands';
import {detectDiagonalLines} from './diagonalLines';
import {mergeSolidStripes} from './solidStripes';
import {recoverInkJunctions} from './inkJunctions';
/** Pixel coordinates describe image edges, with centers at n + 0.5. */
export interface WallCandidate {
  id: string
  start: { x: number; y: number }
  end: { x: number; y: number }
  thicknessPx: number
  solidSupportThicknessPx?: number
}

export interface WallCandidateOptions {
  maxCandidates?: number
  threshold?: number
  minLengthPx?: number
  minThicknessPx?: number
}

interface Stripe {
  from: number
  to: number
  first: number
  last: number
  samples: number
}

/**
 * Finds axis-aligned stripes and straight diagonal ink components, not semantic walls.
 * Text, furniture and dimension lines may still qualify. No morphology
 * or gap closing is used: separate runs retain their openings.
 */
export function detectWallCandidates(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: WallCandidateOptions = {},
): WallCandidate[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > 1600 || height > 1600 || width * height > 4_000_000
    || !(data instanceof Uint8ClampedArray) || data.length !== width * height * 4) {
    throw new Error('선 검출 이미지는 가로·세로 1600px 이하의 올바른 RGBA 데이터여야 합니다.')
  }
  const maxCandidates=options.maxCandidates??100
  if(!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>500)throw new Error('선 후보 한도는 1~500이어야 합니다.')
  const threshold = options.threshold ?? 145
  const minLength = options.minLengthPx ?? Math.max(24, Math.round(Math.min(width, height) * 0.04))
  const minThickness = options.minThicknessPx ?? 2
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255
    || !Number.isFinite(minLength) || minLength < 2 || minLength > 1600
    || !Number.isFinite(minThickness) || minThickness < 1 || minThickness > 1600) {
    throw new Error('선 검출 밝기·최소 길이·두께 설정을 확인하세요.')
  }

  const dark = new Uint8Array(width * height)
  for (let pixel = 0; pixel < dark.length; pixel++) {
    const offset = pixel * 4
    const alpha = data[offset + 3] / 255
    const luminance = (0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]) * alpha + 255 * (1 - alpha)
    dark[pixel] = luminance < threshold ? 1 : 0
  }

  const result: WallCandidate[] = []
  function scan(horizontal: boolean) {
    const count = horizontal ? height : width
    const length = horizontal ? width : height
    let active: Stripe[] = []
    const finish = (stripe: Stripe) => {
      const thickness = stripe.last - stripe.first + 1
      const from = stripe.from / stripe.samples
      const to = stripe.to / stripe.samples
      // Thick blobs must not become two crossing walls.
      if (thickness < minThickness || to - from < Math.max(minLength, thickness * 4)) return
      const center = (stripe.first + stripe.last + 1) / 2
      const start = horizontal ? { x: from, y: center } : { x: center, y: from }
      const end = horizontal ? { x: to, y: center } : { x: center, y: to }
      result.push({ id: `${horizontal ? 'h' : 'v'}-${stripe.first}-${from.toFixed(2)}-${to.toFixed(2)}`, start, end, thicknessPx: thickness })
    }
    for (let row = 0; row < count; row++) {
      const next: Stripe[] = []
      const matched = new Set<Stripe>()
      let col = 0
      while (col < length) {
        const isDark = (position: number) => dark[horizontal ? row * width + position : position * width + row] === 1
        if (!isDark(col)) { col++; continue }
        const from = col
        while (col < length && isDark(col)) col++
        const to = col
        if (to - from < minLength) continue
        const previous = active.find(stripe => {
          if (matched.has(stripe)) return false
          const oldFrom = stripe.from / stripe.samples
          const oldTo = stripe.to / stripe.samples
          const overlap = Math.min(to, oldTo) - Math.max(from, oldFrom)
          return Math.abs(from - oldFrom) <= 2 && Math.abs(to - oldTo) <= 2
            && overlap >= 0.9 * Math.max(to - from, oldTo - oldFrom)
        })
        if (previous) {
          matched.add(previous)
          next.push({ ...previous, from: previous.from + from, to: previous.to + to, last: row, samples: previous.samples + 1 })
        } else next.push({ from, to, first: row, last: row, samples: 1 })
      }
      for (const stripe of active) if (!matched.has(stripe)) finish(stripe)
      active = next
    }
    for (const stripe of active) finish(stripe)
  }
  scan(true)
  scan(false)
  // Prefer the longest useful candidates if a dense page exceeds the review cap.
  const merged=recoverInkJunctions(mergeSolidStripes(result,dark,width,height),dark,width,height);
  return [...removeContainedSolidBands(merged,dark,width,height),...detectDiagonalLines(dark,width,height,merged,minLength,minThickness)].sort((a, b) => {
    const difference = Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y) - Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y)
    return difference || a.start.y - b.start.y || a.start.x - b.start.x || a.id.localeCompare(b.id)
  }).slice(0, maxCandidates)
}
