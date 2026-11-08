import React, { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Polygon, Polyline, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import L from 'leaflet'
import { circleIntersections, geodesicCircle, toMeters, wrapLngNear } from './geo'
import type { LatLng, LatLngTuple, Unit } from './geo'

// Fix for default marker icon in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
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

const CIRCLE_COLORS = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140']

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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        {
          headers: {
            'User-Agent': 'RadiusMapTool/1.0'
          }
        }
      )

      const data = await response.json()

      if (data.length === 0) {
        setError('Address not found. Please try a different search.')
        setLoading(false)
        return
      }

      addCircle(parseFloat(data[0].lat), parseFloat(data[0].lon))
      setAddress('') // Clear the search input
      setLoading(false)
    } catch (err) {
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

  const handleAddressKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
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
    const shapes = circles.map((circle) => {
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
      ...shapes.flatMap((shape) => shape.area.flat()),
      ...intersections.map((point) => point.position),
    ])

    return { shapes, intersections, bounds }
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
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyPress={handleAddressKeyPress}
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
            {circles.map((circle) => (
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
                    className="circle-unit-select"
                  >
                    <option value="miles">mi</option>
                    <option value="km">km</option>
                  </select>
                  <button
                    onClick={() => deleteCircle(circle.id)}
                    className="delete-btn"
                    title="Delete circle"
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
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            }
          />

          {mapShapes && (
            <>
              <AutoFitAllBounds bounds={mapShapes.bounds} />
              {mapShapes.shapes.map(({ circle, center, area, edge }, index) => {
                const color = CIRCLE_COLORS[index % CIRCLE_COLORS.length]

                return (
                  <React.Fragment key={circle.id}>
                    <Marker position={[center.lat, center.lng]}>
                      <Popup>
                        {circle.lat.toFixed(6)}, {circle.lng.toFixed(6)}
                        <br />
                        Radius: {circle.radius} {circle.unit}
                      </Popup>
                    </Marker>
                    {/* Fill and outline are separate so the fill's closing
                        edges along a pole aren't stroked as if part of the circle */}
                    <Polygon
                      positions={area}
                      pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0.2 }}
                    />
                    <Polyline positions={edge} pathOptions={{ color }} />
                  </React.Fragment>
                )
              })}

              {/* Show intersection points */}
              {mapShapes.intersections.map(({ position, actual }, idx) => (
                <Circle
                  key={`intersection-${idx}`}
                  center={position}
                  radius={50}
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
                </Circle>
              ))}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}

export default App
