import React, { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Polygon, Polyline, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import L from 'leaflet'
import { circleIntersections, geodesicCircle, shiftLng, toMeters, wrapLngNear } from './geo'
import type { CircleShape, LatLng, LatLngTuple, Unit } from './geo'

// Fix for default marker icon in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

interface CircleData {
  id: string
  lat: number
  lng: number
  radius: number
  unit: Unit
}

interface IntersectionPoint {
  /** Where to draw it, beside its circles (the longitude may run past ±180). */
  position: LatLngTuple
  /** Its real coordinates, for display. */
  actual: LatLng
}

interface DrawnCircle extends CircleShape {
  circle: CircleData
  /** Centre to draw at (the longitude may run past ±180). */
  center: LatLng
  meters: number
}

const CIRCLE_COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140']

/**
 * Whole-turn longitude offsets to repeat the drawing at, so every copy of
 * the world in view shows it. Leaflet repeats the map tiles sideways but
 * draws each shape only once.
 */
function useWorldOffsets([minLng, maxLng]: [number, number]): number[] {
  const map = useMap()
  const [range, setRange] = useState<[number, number]>([0, 0])

  useEffect(() => {
    const update = () => {
      const view = map.getBounds()
      const first = Math.ceil((view.getWest() - maxLng) / 360)
      const last = Math.floor((view.getEast() - minLng) / 360)
      setRange((prev) => (prev[0] === first && prev[1] === last ? prev : [first, last]))
    }
    update()
    map.on('moveend resize', update)
    return () => {
      map.off('moveend resize', update)
    }
  }, [map, minLng, maxLng])

  return useMemo(() => {
    const offsets: number[] = []
    for (let k = range[0]; k <= range[1]; k++) offsets.push(k * 360)
    return offsets
  }, [range])
}

const CircleLayers = React.memo(function CircleLayers({
  shapes,
  intersections,
  lngRange,
}: {
  shapes: DrawnCircle[]
  intersections: IntersectionPoint[]
  lngRange: [number, number]
}) {
  const offsets = useWorldOffsets(lngRange)

  const repeated = useMemo(
    () =>
      shapes.map((shape) => ({
        ...shape,
        area: offsets.map((offset) => shape.area.map((ring) => shiftLng(ring, offset))),
        edge: offsets.flatMap((offset) => shape.edge.map((line) => shiftLng(line, offset))),
      })),
    [shapes, offsets],
  )

  return (
    <>
      {repeated.map(({ circle, center, area, edge }, index) => {
        const color = CIRCLE_COLORS[index % CIRCLE_COLORS.length]

        return (
          <React.Fragment key={circle.id}>
            {offsets.map((offset) => (
              <Marker key={offset} position={[center.lat, center.lng + offset]}>
                <Popup>
                  {circle.lat.toFixed(6)}, {circle.lng.toFixed(6)}
                  <br />
                  Radius: {circle.radius} {circle.unit}
                </Popup>
              </Marker>
            ))}
            {/* Fill and outline are separate so the fill's closing
                edges along a pole aren't stroked as if part of the circle */}
            <Polygon
              positions={area}
              pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0.2 }}
            />
            {/* Less simplification than Leaflet's default so the edge looks round, not faceted */}
            <Polyline positions={edge} pathOptions={{ color }} smoothFactor={0.25} />
          </React.Fragment>
        )
      })}

      {/* Intersection points, a fixed size on screen so they stay visible at any zoom */}
      {intersections.map(({ position, actual }, idx) =>
        offsets.map((offset) => (
          <CircleMarker
            key={`intersection-${idx}:${offset}`}
            center={[position[0], position[1] + offset]}
            radius={6}
            pathOptions={{
              color: '#ff6b6b',
              fillColor: '#ff6b6b',
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup>
              Intersection Point
              <br />
              {actual.lat.toFixed(6)}, {actual.lng.toFixed(6)}
            </Popup>
          </CircleMarker>
        )),
      )}
    </>
  )
})

// Component to auto-fit map bounds to show all circles and their intersections
function AutoFitAllBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap()

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true })
      } catch (error) {
        console.error('Error fitting bounds:', error)
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [bounds, map])

  return null
}

function App() {
  const [circles, setCircles] = useState<CircleData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [darkMode, setDarkMode] = useState(false)

  const addCircle = (lat: number, lng: number) => {
    const newCircle: CircleData = {
      id: Date.now().toString(),
      lat,
      lng,
      radius: 5,
      unit: 'miles'
    }
    setCircles((prev) => [...prev, newCircle])
  }

  const getLocation = () => {
    setLoading(true)
    setError('')

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        addCircle(position.coords.latitude, position.coords.longitude)
        setLoading(false)
      },
      (err) => {
        setError(`Error getting location: ${err.message}`)
        setLoading(false)
      }
    )
  }

  const searchAddress = async () => {
    if (!address.trim()) {
      setError('Please enter an address')
      return
    }

    setLoading(true)
    setError('')

    try {
      // No User-Agent header: browsers don't let pages set it (Chrome drops
      // it silently). Nominatim identifies us by the Referer the browser sends.
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
      )

      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Too many address searches. Please wait a moment and try again.'
            : `Address search failed (HTTP ${response.status}). Please try again.`
        )
        setLoading(false)
        return
      }

      const data = await response.json()

      if (data.length === 0) {
        setError('Address not found. Please try a different search.')
        setLoading(false)
        return
      }

      addCircle(parseFloat(data[0].lat), parseFloat(data[0].lon))
      setAddress('') // Clear the search input
      setLoading(false)
    } catch {
      setError('Error searching for address. Please try again.')
      setLoading(false)
    }
  }

  const updateCircle = (id: string, updates: Partial<CircleData>) => {
    setCircles((prev) => prev.map(circle =>
      circle.id === id ? { ...circle, ...updates } : circle
    ))
  }

  const deleteCircle = (id: string) => {
    setCircles((prev) => prev.filter(circle => circle.id !== id))
  }

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ignore the Enter that confirms an IME composition (e.g. Japanese input)
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      searchAddress()
    }
  }

  // Default center (New York City) - used when no circles exist
  const defaultCenter = { lat: 40.7128, lng: -74.006 }
  const center = circles.length > 0
    ? { lat: circles[0].lat, lng: circles[0].lng }
    : defaultCenter

  // Everything drawn on the map, recomputed only when the circles change.
  // Longitudes are shifted to sit beside the first circle, so circles on
  // either side of the ±180° line are drawn together, not at opposite edges.
  const mapShapes = useMemo(() => {
    if (circles.length === 0) return null

    const refLng = circles[0].lng
    const shapes = circles.map((circle): DrawnCircle => {
      const center = { lat: circle.lat, lng: wrapLngNear(circle.lng, refLng) }
      const meters = toMeters(circle.radius, circle.unit)
      return { circle, center, meters, ...geodesicCircle(center, meters) }
    })

    const intersections: IntersectionPoint[] = []
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const a = shapes[i]
        const b = shapes[j]
        for (const point of circleIntersections(a.center, a.meters, b.center, b.meters)) {
          intersections.push({
            position: [point.lat, wrapLngNear(point.lng, a.center.lng)],
            actual: point,
          })
        }
      }
    }

    const bounds = L.latLngBounds([
      ...shapes.flatMap((shape) => shape.fit),
      ...intersections.map((point) => point.position),
    ])

    // Longitudes covered by everything drawn, for repeating it across world copies.
    let minLng = Infinity
    let maxLng = -Infinity
    for (const shape of shapes) {
      for (const [, lng] of shape.area.flat()) {
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
      }
    }
    const lngRange: [number, number] = [minLng, maxLng]

    return { shapes, intersections, bounds, lngRange }
  }, [circles])

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="header">
        <h1>Radius Circle Map Tool</h1>
        <p>Add multiple locations and draw radius circles on the map</p>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="theme-toggle"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="controls">
        <div className="location-row">
          <button onClick={getLocation} disabled={loading} className="location-btn">
            {loading ? 'Getting Location...' : 'Add My Location'}
          </button>

          <div className="address-search">
            <input
              type="text"
              placeholder="Or enter an address to add..."
              aria-label="Address to add"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={handleAddressKeyDown}
              disabled={loading}
              className="address-input"
            />
            <button
              onClick={searchAddress}
              disabled={loading || !address.trim()}
              className="search-btn"
            >
              Add
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {circles.length > 0 && (
          <div className="circles-list">
            <h3>Circles ({circles.length})</h3>
            {circles.map((circle, index) => (
              <div key={circle.id} className="circle-item">
                <div className="circle-location">
                  <span className="circle-coords">
                    {circle.lat.toFixed(6)}, {circle.lng.toFixed(6)}
                  </span>
                </div>
                <div className="circle-controls">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Circle ${index + 1} radius`}
                    value={circle.radius}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || /^\d+$/.test(val)) {
                        const numVal = parseInt(val) || 0
                        updateCircle(circle.id, { radius: numVal })
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value)
                      if (!val || val < 1) {
                        updateCircle(circle.id, { radius: 1 })
                      }
                    }}
                    className="circle-radius-input"
                  />
                  <select
                    value={circle.unit}
                    onChange={(e) => updateCircle(circle.id, { unit: e.target.value as Unit })}
                    aria-label={`Circle ${index + 1} unit`}
                    className="circle-unit-select"
                  >
                    <option value="miles">mi</option>
                    <option value="km">km</option>
                  </select>
                  <button
                    onClick={() => deleteCircle(circle.id)}
                    className="delete-btn"
                    title="Delete circle"
                    aria-label={`Delete circle ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="map-container">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={darkMode
              ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
            url={darkMode
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            }
          />

          {mapShapes && (
            <>
              <AutoFitAllBounds bounds={mapShapes.bounds} />
              <CircleLayers
                shapes={mapShapes.shapes}
                intersections={mapShapes.intersections}
                lngRange={mapShapes.lngRange}
              />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}

export default App
