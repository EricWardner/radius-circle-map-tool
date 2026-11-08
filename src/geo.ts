// Spherical-Earth geometry for the radius circles.
//
// Leaflet's L.Circle draws a flat ellipse sized at the centre's latitude,
// which drifts away from the true circle as the radius grows. Instead we
// trace each circle on the sphere ourselves and find crossings on the same
// sphere, so the drawn edges, the intersection points and the map bounds
// all agree at any radius.

export type Unit = 'miles' | 'km'

export interface LatLng {
  lat: number
  lng: number
}

export type LatLngTuple = [number, number]

export interface CircleShape {
  /** Rings to fill: an outer ring, then any holes. */
  area: LatLngTuple[][]
  /** The circle's real edge, as lines to stroke. */
  edge: LatLngTuple[][]
}

/** Same value as Leaflet's L.CRS.Earth.R, so map.distance() agrees with us. */
export const EARTH_RADIUS_M = 6371000

const METERS_PER_UNIT: Record<Unit, number> = {
  miles: 1609.344,
  km: 1000,
}

/** Points traced around each circle's edge (one every half degree of bearing). */
const EDGE_POINTS = 720

const RAD = Math.PI / 180

/** Bearings are undefined exactly at a pole, so start ~0.1 m away from it. */
const MAX_LAT = 90 - 1e-6

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

/** A distance along the surface as an angle at the Earth's centre, capped at half a turn. */
function toAngle(meters: number): number {
  return Math.min(Math.max(meters / EARTH_RADIUS_M, 0), Math.PI)
}

/** sin²(x/2). Stays precise for tiny angles, where 1 - cos(x) rounds away. */
function hav(x: number): number {
  const s = Math.sin(x / 2)
  return s * s
}

function angleBetween(a: LatLng, b: LatLng): number {
  const h =
    hav((b.lat - a.lat) * RAD) +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * hav((b.lng - a.lng) * RAD)
  return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
}

/** Initial bearing from a to b, in radians clockwise from north. */
function bearingTo(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * RAD
  const lat2 = b.lat * RAD
  const dLng = (b.lng - a.lng) * RAD
  return Math.atan2(
    Math.sin(dLng) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng),
  )
}

/**
 * The point `angle` radians from `from` along `bearing`. Its longitude is
 * left within 180° of the start rather than normalised.
 */
function destination(from: LatLng, bearing: number, angle: number): LatLng {
  const lat1 = Math.min(MAX_LAT, Math.max(-MAX_LAT, from.lat)) * RAD
  const sinLat2 =
    Math.sin(lat1) * Math.cos(angle) + Math.cos(lat1) * Math.sin(angle) * Math.cos(bearing)
  const dLng = Math.atan2(
    Math.sin(bearing) * Math.sin(angle) * Math.cos(lat1),
    Math.cos(angle) - Math.sin(lat1) * sinLat2,
  )
  return {
    lat: Math.asin(Math.min(1, Math.max(-1, sinLat2))) / RAD,
    lng: from.lng + dLng / RAD,
  }
}

/**
 * Points around a circle's edge, starting at `startBearing`. Longitudes run
 * on continuously (past ±180 if need be) so Leaflet draws one unbroken line.
 */
function traceEdge(center: LatLng, angle: number, startBearing: number): LatLngTuple[] {
  const ring: LatLngTuple[] = []
  let lng = center.lng
  for (let i = 0; i < EDGE_POINTS; i++) {
    const p = destination(center, startBearing + (2 * Math.PI * i) / EDGE_POINTS, angle)
    lng = wrapLngNear(p.lng, lng)
    ring.push([p.lat, lng])
  }
  return ring
}

function closed(ring: LatLngTuple[]): LatLngTuple[] {
  return [...ring, ring[0]]
}

/** The true circle of `meters` around `center`, ready to draw on a Web Mercator map. */
export function geodesicCircle(center: LatLng, meters: number): CircleShape {
  const angle = toAngle(meters)
  const north = center.lat >= 0
  const coversBothPoles = angle > (90 + Math.abs(center.lat)) * RAD

  if (coversBothPoles) {
    // Bigger than a hemisphere: only a cap around the far side of the
    // world is left uncovered. Fill a band one and a half worlds wide
    // with that cap cut out of both sides, so the uncovered part shows
    // wherever the map is panned.
    const antipode = { lat: -center.lat, lng: center.lng + 180 }
    const east = traceEdge(antipode, Math.PI - angle, antipode.lat >= 0 ? 0 : Math.PI)
    const west = east.map(([lat, lng]): LatLngTuple => [lat, lng - 360])
    const left = center.lng - 270
    const right = center.lng + 270
    return {
      area: [[[90, left], [90, right], [-90, right], [-90, left]], east, west],
      edge: [closed(east), closed(west)],
    }
  }

  // Start from the side facing the nearer pole. If the circle covers that
  // pole, the start sits just across it, on the far side of the world from
  // the centre, so the seam lands there rather than through the middle.
  const ring = traceEdge(center, angle, north ? 0 : Math.PI)
  const [firstLat, firstLng] = ring[0]
  const loopLng = wrapLngNear(firstLng, ring[ring.length - 1][1])

  if (loopLng === firstLng) {
    return { area: [ring], edge: [closed(ring)] }
  }

  // The edge loops all the way round the pole, so it isn't a closed shape
  // on the map. Shift the loop so it spans the turn centred on the circle,
  // close the fill along the pole (Leaflet clamps it to the top or bottom
  // of the map), and only stroke the real edge.
  const mid = (firstLng + loopLng) / 2
  const shift = wrapLngNear(mid, center.lng) - mid
  const poleLat = north ? 90 : -90
  const edge = [...ring, [firstLat, loopLng]].map(
    ([lat, lng]): LatLngTuple => [lat, lng + shift],
  )
  return {
    area: [[...edge, [poleLat, loopLng + shift], [poleLat, firstLng + shift]]],
    edge: [edge],
  }
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
  const r1 = toAngle(meters1)
  const r2 = toAngle(meters2)
  const d = angleBetween(center1, center2)

  // The edges meet only if the circles reach each other, neither sits
  // inside the other, and (on a sphere) they don't wrap so far round that
  // they swallow each other from behind.
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d > 2 * Math.PI - r1 - r2) return []
  // Same or opposite centres give no single crossing direction, and a
  // circle shrunk to a point has no edge.
  if (Math.sin(d) < 1e-12 || Math.sin(r1) < 1e-12) return []

  // Spherical law of cosines for the angle at center1 between the line to
  // center2 and the line to a crossing point. The numerator is
  // cos(r2) - cos(r1)·cos(d), rewritten with hav() to stay precise for
  // small circles and near-concentric ones.
  const cosAlpha =
    (2 * (hav(r1) - hav(r2) + hav(d) * Math.cos(r1))) / (Math.sin(r1) * Math.sin(d))
  // Rounding can push this a hair past ±1 when the circles barely touch.
  const alpha = Math.acos(Math.min(1, Math.max(-1, cosAlpha)))
  const toward = bearingTo(center1, center2)
  const bearings = alpha === 0 ? [toward] : [toward - alpha, toward + alpha]

  return bearings.map((bearing) => {
    const p = destination(center1, bearing, r1)
    return { lat: p.lat, lng: normalizeLng(p.lng) }
  })
}
