// Geometry for the radius circles, measured on the WGS84 ellipsoid (the
// Earth model GPS coordinates and the map tiles use).
//
// Leaflet's L.Circle draws a flat ellipse sized at the centre's latitude,
// which drifts away from the true circle as the radius grows, and a sphere
// is still up to ~0.5% off. Instead we trace each circle with geodesics on
// the ellipsoid and find crossings with the same geodesics, so the drawn
// edges, the intersection points and the map bounds all agree at any
// radius.

import { Geodesic } from 'geographiclib-geodesic'

export type Unit = 'miles' | 'km'

export interface LatLng {
  lat: number
  lng: number
}

export type LatLngTuple = [number, number]

export interface CircleShape {
  /** One polygon to fill, no more than one world wide: an outer ring, then any hole. */
  area: LatLngTuple[][]
  /** The circle's real edge, as lines to stroke. */
  edge: LatLngTuple[][]
  /** South-west and north-east corners of what to show when fitting the map to this circle. */
  fit: [LatLngTuple, LatLngTuple]
}

const WGS84 = Geodesic.WGS84

const METERS_PER_UNIT: Record<Unit, number> = {
  miles: 1609.344,
  km: 1000,
}

/** Points traced around each circle's edge (one every half degree of bearing). */
const EDGE_POINTS = 720

export function toMeters(radius: number, unit: Unit): number {
  return radius * METERS_PER_UNIT[unit]
}

/** Shift a longitude by whole turns so it lands within 180° of `ref`. */
export function wrapLngNear(lng: number, ref: number): number {
  return lng + 360 * Math.round((ref - lng) / 360)
}

function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

/** Shortest distance from a to b in metres, and the bearing it sets off on at a. */
function measure(a: LatLng, b: LatLng): { meters: number; bearing: number } {
  const r = WGS84.Inverse(a.lat, a.lng, b.lat, b.lng)
  return { meters: r.s12 as number, bearing: r.azi1 as number }
}

/** Where you end up going `meters` from `from` on `bearing` (degrees clockwise from north). */
function travel(from: LatLng, bearing: number, meters: number): LatLng {
  const r = WGS84.Direct(from.lat, from.lng, bearing, meters)
  return { lat: r.lat2 as number, lng: r.lon2 as number }
}

/** How far anywhere on Earth can be from `center`: the distance to its antipode. */
function farthest(center: LatLng): number {
  return measure(center, { lat: -center.lat, lng: center.lng + 180 }).meters
}

/**
 * Points around a circle's edge, starting at `startBearing`. Longitudes run
 * on continuously (past ±180 if need be) so Leaflet draws one unbroken line.
 */
function traceEdge(center: LatLng, meters: number, startBearing: number): LatLngTuple[] {
  const ring: LatLngTuple[] = []
  let lng = center.lng
  for (let i = 0; i < EDGE_POINTS; i++) {
    const p = travel(center, startBearing + (360 * i) / EDGE_POINTS, meters)
    lng = wrapLngNear(p.lng, lng)
    ring.push([p.lat, lng])
  }
  return ring
}

function closed(ring: LatLngTuple[]): LatLngTuple[] {
  return [...ring, ring[0]]
}

export function shiftLng(points: LatLngTuple[], by: number): LatLngTuple[] {
  return points.map(([lat, lng]): LatLngTuple => [lat, lng + by])
}

function boundingBox(points: LatLngTuple[]): [LatLngTuple, LatLngTuple] {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
  for (const [lat, lng] of points) {
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lng)
    east = Math.max(east, lng)
  }
  return [[south, west], [north, east]]
}

/** The true circle of `meters` around `center`, ready to draw on a Web Mercator map. */
export function geodesicCircle(center: LatLng, meters: number): CircleShape {
  const radius = Math.min(Math.max(meters, 0), farthest(center))
  const north = center.lat >= 0
  const coversNorthPole = radius > measure(center, { lat: 90, lng: center.lng }).meters
  const coversSouthPole = radius > measure(center, { lat: -90, lng: center.lng }).meters

  // Start from the side facing the nearer pole. If the circle covers that
  // pole, the start sits just across it, on the far side of the world from
  // the centre, so the seam lands there rather than through the middle.
  const ring = traceEdge(center, radius, north ? 0 : 180)

  if (coversNorthPole && coversSouthPole) {
    // Bigger than a hemisphere: only a patch around the far side of the
    // world is left uncovered. Fill one world's width with that patch cut
    // out, placing the patch mid-band so it isn't split at the band's edge.
    const [[, west], [, east]] = boundingBox(ring)
    const mid = (west + east) / 2
    const hole = shiftLng(ring, wrapLngNear(mid, center.lng + 180) - mid)
    const left = center.lng
    const right = center.lng + 360
    return {
      area: [[[90, left], [90, right], [-90, right], [-90, left]], hole],
      edge: [closed(hole)],
      fit: [[-90, center.lng - 180], [90, center.lng + 180]],
    }
  }

  const [firstLat, firstLng] = ring[0]
  const loopLng = wrapLngNear(firstLng, ring[ring.length - 1][1])

  if (loopLng === firstLng) {
    return { area: [ring], edge: [closed(ring)], fit: boundingBox(ring) }
  }

  // The edge loops all the way round the pole, so it isn't a closed shape
  // on the map. Shift the loop so it spans the turn centred on the circle,
  // close the fill along the pole (Leaflet clamps it to the top or bottom
  // of the map), and only stroke the real edge.
  const mid = (firstLng + loopLng) / 2
  const shift = wrapLngNear(mid, center.lng) - mid
  const poleLat = north ? 90 : -90
  const edge = shiftLng([...ring, [firstLat, loopLng]], shift)
  const area = [...edge, [poleLat, loopLng + shift], [poleLat, firstLng + shift]] as LatLngTuple[]
  return { area: [area], edge: [edge], fit: boundingBox(area) }
}

/**
 * Root of `f` between `a` and `b`, where f(a) and f(b) have opposite signs
 * (Illinois variant of regula falsi: as reliable as bisection, much faster).
 */
function findRoot(f: (x: number) => number, a: number, b: number, fa: number, fb: number): number {
  let side = 0
  for (let i = 0; i < 100; i++) {
    const x = (a * fb - b * fa) / (fb - fa)
    const fx = f(x)
    if (Math.abs(fx) < 1e-6 || Math.abs(b - a) < 1e-12) return x
    if ((fx > 0) === (fb > 0)) {
      b = x
      fb = fx
      if (side === -1) fa /= 2
      side = -1
    } else {
      a = x
      fa = fx
      if (side === 1) fb /= 2
      side = 1
    }
  }
  return (a + b) / 2
}

/**
 * Where the edges of two circles cross: none, one (just touching) or two
 * points, with longitudes in [-180, 180).
 */
export function circleIntersections(
  center1: LatLng,
  meters1: number,
  center2: LatLng,
  meters2: number,
): LatLng[] {
  const between = measure(center1, center2)
  // Same centre: the edges coincide or never meet. A circle shrunk to a
  // point, or grown to cover the whole Earth, has no edge to cross.
  if (between.meters < 1e-6) return []
  if (meters1 <= 0 || meters2 <= 0) return []
  if (meters1 >= farthest(center1) || meters2 >= farthest(center2)) return []

  // How far outside circle 2 the point on circle 1's edge at `bearing` is
  // (negative when inside). It's smallest heading straight toward
  // center2 and largest heading straight away, and rises steadily from one
  // to the other, so each half of the edge holds at most one crossing.
  const outsideBy = (bearing: number) =>
    measure(center2, travel(center1, bearing, meters1)).meters - meters2

  const toward = between.bearing
  const nearest = outsideBy(toward)
  const farthestOut = outsideBy(toward + 180)
  if (nearest > 0 || farthestOut < 0) return []

  const bearings =
    nearest === 0
      ? [toward]
      : [
          findRoot(outsideBy, toward, toward + 180, nearest, farthestOut),
          findRoot(outsideBy, toward + 180, toward + 360, farthestOut, nearest),
        ]

  return bearings.map((bearing) => {
    const p = travel(center1, bearing, meters1)
    return { lat: p.lat, lng: normalizeLng(p.lng) }
  })
}
