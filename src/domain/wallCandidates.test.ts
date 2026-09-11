import { describe, expect, it } from 'vitest'
import { detectWallCandidates } from './wallCandidates'

function raster(width = 200, height = 160) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  return {
    data, width, height,
    rect(x: number, y: number, w: number, h: number, alpha = 255) {
      for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
        data.set([0, 0, 0, alpha], (row * width + col) * 4)
      }
    },
    detect() { return detectWallCandidates(data, width, height) },
  }
}

describe('raster line candidates', () => {
  it('returns one centerline per thick stripe with stable IDs', () => {
    const image = raster()
    image.rect(20, 30, 140, 6)
    const found = image.detect()
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ start: { x: 20, y: 33 }, end: { x: 160, y: 33 }, thicknessPx: 6 })
    expect(image.detect()).toEqual(found)
  })

  it('finds all four sides of a rectangular outline without short crossing stripes', () => {
    const image = raster()
    image.rect(20, 20, 140, 5)
    image.rect(20, 120, 140, 5)
    image.rect(20, 20, 5, 105)
    image.rect(155, 20, 5, 105)
    expect(image.detect()).toHaveLength(4)
  })

  it('preserves door-sized gaps between collinear segments', () => {
    const image = raster()
    image.rect(10, 40, 70, 4)
    image.rect(100, 40, 70, 4)
    const found = image.detect()
    expect(found).toHaveLength(2)
    expect(found.map(line => [line.start.x, line.end.x])).toEqual([[10, 80], [100, 170]])
  })

  it('rejects blank, transparent black, short text strokes, and thin dimension rules', () => {
    const image = raster()
    expect(image.detect()).toEqual([])
    image.rect(0, 0, 200, 160, 0)
    expect(image.detect()).toEqual([])
    image.data.fill(255)
    for (let x = 10; x < 180; x += 20) image.rect(x, 20, 7, 12)
    image.rect(10, 80, 160, 1)
    expect(image.detect()).toEqual([])
  })

  it('does not collapse nearby distinct parallel lines', () => {
    const image = raster()
    image.rect(10, 20, 160, 3)
    image.rect(10, 25, 160, 3)
    expect(image.detect()).toHaveLength(2)
  })

  it('allows deliberate one-pixel detection through options', () => {
    const image = raster()
    image.rect(10, 80, 160, 1)
    expect(detectWallCandidates(image.data, image.width, image.height, { minThicknessPx: 1 })).toHaveLength(1)
  })

  it('caps dense outputs at 100 lines', () => {
    const image = raster(600, 600)
    for (let y = 0; y < 600; y += 5) image.rect(10, y, 580, 2)
    expect(image.detect()).toHaveLength(100)
  })

  it('rejects invalid and unbounded input or options', () => {
    const image = raster()
    for (const [w, h] of [[0, 2], [2.5, 2], [1601, 1], [Infinity, 1]]) {
      expect(() => detectWallCandidates(image.data, w, h)).toThrow()
    }
    expect(() => detectWallCandidates(new Uint8ClampedArray(3), 1, 1)).toThrow()
    for (const options of [{ threshold: NaN }, { threshold: 256 }, { minLengthPx: 0 }, { minThicknessPx: -1 }]) {
      expect(() => detectWallCandidates(image.data, image.width, image.height, options)).toThrow()
    }
  })
})
it('retains short structure beyond the manual 100-line cap in automatic mode',()=>{const image=raster(600,600);for(let y=0;y<550;y+=5)image.rect(10,y,580,2);image.rect(20,580,50,4);const old=detectWallCandidates(image.data,600,600,{minLengthPx:10}),expanded=detectWallCandidates(image.data,600,600,{minLengthPx:10,maxCandidates:500});expect(old.some(l=>l.start.y>550)).toBe(false);expect(expanded.some(l=>l.start.y>550)).toBe(true);expect(()=>detectWallCandidates(image.data,600,600,{maxCandidates:501})).toThrow();});
