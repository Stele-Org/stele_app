import { expect, it } from 'vitest'
import { DISCOVERY_NETWORK_SECONDS, discoveryDots, discoveryNetworkFrame } from './discovery-network'

const dots = discoveryDots()
const frame = (time: number) => discoveryNetworkFrame(dots, time)

it('fills the whole frame below the logo with a form of large dots and a field of small ones', () => {
  expect(dots).toHaveLength(19 * 28)
  expect(Math.min(...dots.map(dot => dot.y))).toBe(362)
  expect(Math.max(...dots.map(dot => dot.y))).toBeLessThan(1920)
  expect(Math.min(...dots.map(dot => dot.x))).toBeGreaterThan(0)
  expect(Math.max(...dots.map(dot => dot.x))).toBeLessThan(1080)
  expect(dots.every(dot => dot.radius > 0)).toBe(true)
  const form = dots.filter(dot => dot.alpha === 1), field = dots.filter(dot => dot.alpha < 1)
  expect(form.length).toBeGreaterThan(100)
  expect(field.length).toBeGreaterThan(100)
  expect(Math.max(...form.map(dot => dot.radius))).toBeGreaterThan(12)
  expect(field.some(dot => dot.radius > 5.5)).toBe(true)
  expect(field.some(dot => dot.radius < 3)).toBe(true)
})

it('keeps the accepted scene length', () => {
  expect(DISCOVERY_NETWORK_SECONDS).toBe(23.3)
})

it('starts empty, grows from the centre and rests on the exact pattern', () => {
  expect(frame(0).points.every(point => point.radius === 0 || point.alpha === 0)).toBe(true)
  const early = frame(1.2).points
  const centre = early.filter((_, i) => Math.hypot(dots[i].x - 555, dots[i].y - 1150) < 200)
  const corners = early.filter((_, i) => Math.hypot(dots[i].x - 555, dots[i].y - 1150) > 800)
  expect(centre.some(point => point.radius > 2 && point.alpha > 0.5)).toBe(true)
  expect(corners.every(point => point.alpha === 0)).toBe(true)
  for (const time of [4.2, 5, 5.9]) {
    const rest = frame(time)
    expect(rest.pulse).toBe(0)
    expect(rest.network).toBe(0)
    rest.points.forEach((point, i) => {
      expect(point.x).toBe(dots[i].x)
      expect(point.y).toBe(dots[i].y)
      expect(point.radius).toBeCloseTo(dots[i].radius)
      expect(point.alpha).toBeCloseTo(dots[i].alpha)
    })
  }
})

it('pulses for five seconds, then unfolds into the network and works for six', () => {
  expect(frame(8.5).pulse).toBeCloseTo(0.5)
  expect(frame(10.9).network).toBe(0)
  expect(frame(11).pulse).toBe(1)
  expect(frame(12.4).network).toBeCloseTo(0.5)
  for (const time of [13.8, 16, 19.8]) {
    const working = frame(time)
    expect(working.network).toBe(1)
    expect(working.pulse).toBe(1)
    // The network keeps clear of the logo and stays inside the frame.
    expect(Math.min(...working.points.map(point => point.y))).toBeGreaterThanOrEqual(354)
    expect(Math.max(...working.points.map(point => point.y))).toBeLessThanOrEqual(1826)
    expect(Math.min(...working.points.map(point => point.x))).toBeGreaterThanOrEqual(64)
    expect(Math.max(...working.points.map(point => point.x))).toBeLessThanOrEqual(1016)
  }
  const moved = frame(16).points.filter((point, i) => Math.hypot(point.x - dots[i].x, point.y - dots[i].y) > 60)
  expect(moved.length).toBeGreaterThan(dots.length / 2)
})

it('returns to the starting frame and ends with a wave that has left the screen', () => {
  expect(frame(21.2).network).toBe(0)
  const crest = frame(22.1).points
  expect(crest.some((point, i) => point.radius > dots[i].radius + 3)).toBe(true)
  const end = frame(DISCOVERY_NETWORK_SECONDS)
  expect(end.pulse).toBe(0)
  expect(end.network).toBe(0)
  end.points.forEach((point, i) => {
    expect(point.x).toBe(dots[i].x)
    expect(point.y).toBe(dots[i].y)
    expect(point.radius).toBeCloseTo(dots[i].radius)
    expect(point.alpha).toBeCloseTo(dots[i].alpha)
  })
})
