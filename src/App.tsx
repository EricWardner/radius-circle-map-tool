import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import L from 'leaflet'

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

type Unit = 'miles' | 'km'

interface CircleData {
  id: string
  lat: number
  lng: number
  radius: number
  unit: Unit
}

interface IntersectionPoint {
  lat: number
  lng: number
}

// Calculate intersection points between two circles
function calculateIntersectionPoints(
  circle1: CircleData,
  circle2: CircleData
): IntersectionPoint[] {
  const r1 = circle1.unit === 'miles' ? circle1.radius * 1609.34 : circle1.radius * 1000
  const r2 = circle2.unit === 'miles' ? circle2.radius * 1609.34 : circle2.radius * 1000

  // Convert lat/lng to approximate cartesian coordinates (meters)
  const lat1Rad = circle1.lat * Math.PI / 180
  const lat2Rad = circle2.lat * Math.PI / 180

  const x1 = circle1.lng * 111320 * Math.cos(lat1Rad)
  const y1 = circle1.lat * 111320
  const x2 = circle2.lng * 111320 * Math.cos(lat2Rad)
  const y2 = circle2.lat * 111320

  // Distance between centers
  const d = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))

  // Check if circles intersect
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) {
    return [] // No intersection or circles are identical
  }

  // Calculate intersection points
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const h = Math.sqrt(r1 * r1 - a * a)

  // Point on line between centers
  const px = x1 + a * (x2 - x1) / d
  const py = y1 + a * (y2 - y1) / d

  // Intersection points
  const ix1 = px + h * (y2 - y1) / d
  const iy1 = py - h * (x2 - x1) / d
  const ix2 = px - h * (y2 - y1) / d
  const iy2 = py + h * (x2 - x1) / d

  // Convert back to lat/lng
  const avgLat = (circle1.lat + circle2.lat) / 2
  const cosAvgLat = Math.cos(avgLat * Math.PI / 180)

  return [
    {
      lat: iy1 / 111320,
      lng: ix1 / (111320 * cosAvgLat)
    },
    {
      lat: iy2 / 111320,
      lng: ix2 / (111320 * cosAvgLat)
    }
  ]
}

// Component to auto-fit map bounds to show all circles and their intersections
function AutoFitAllBounds({ circles }: { circles: CircleData[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || circles.length === 0) return

    const timeoutId = setTimeout(() => {
      try {
        // Create bounds that include all circles
        const allPoints: L.LatLng[] = []

        // Add circle bounds
        circles.forEach((circle) => {
          const radiusInMeters = circle.unit === 'miles' ? circle.radius * 1609.34 : circle.radius * 1000
          const latDelta = radiusInMeters / 111320
          const lngDelta = radiusInMeters / (111320 * Math.cos(circle.lat * Math.PI / 180))

          // Add the four corner points of the circle's bounding box
          allPoints.push(L.latLng(circle.lat + latDelta, circle.lng + lngDelta))
          allPoints.push(L.latLng(circle.lat + latDelta, circle.lng - lngDelta))
          allPoints.push(L.latLng(circle.lat - latDelta, circle.lng + lngDelta))
          allPoints.push(L.latLng(circle.lat - latDelta, circle.lng - lngDelta))
        })

        // Add intersection points
        for (let i = 0; i < circles.length; i++) {
          for (let j = i + 1; j < circles.length; j++) {
            const intersections = calculateIntersectionPoints(circles[i], circles[j])
            intersections.forEach(point => {
              allPoints.push(L.latLng(point.lat, point.lng))
            })
          }
        }

        if (allPoints.length > 0) {
          const bounds = L.latLngBounds(allPoints)
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true })
        }
      } catch (error) {
        console.error('Error fitting bounds:', error)
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [circles, map])

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
    setCircles([...circles, newCircle])
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
    setCircles(circles.map(circle =>
      circle.id === id ? { ...circle, ...updates } : circle
    ))
  }

  const deleteCircle = (id: string) => {
    setCircles(circles.filter(circle => circle.id !== id))
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
                    type="number"
                    min="1"
                    step="1"
                    value={circle.radius}
                    onChange={(e) => updateCircle(circle.id, { radius: parseFloat(e.target.value) || 1 })}
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

          {circles.length > 0 && (
            <>
              <AutoFitAllBounds circles={circles} />
              {circles.map((circle, index) => {
                const radiusInMeters = circle.unit === 'miles' ? circle.radius * 1609.34 : circle.radius * 1000
                // Generate different colors for each circle
                const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140']
                const color = colors[index % colors.length]

                return (
                  <React.Fragment key={circle.id}>
                    <Marker position={[circle.lat, circle.lng]}>
                      <Popup>
                        {circle.lat.toFixed(6)}, {circle.lng.toFixed(6)}
                        <br />
                        Radius: {circle.radius} {circle.unit}
                      </Popup>
                    </Marker>
                    <Circle
                      center={[circle.lat, circle.lng]}
                      radius={radiusInMeters}
                      pathOptions={{
                        color: color,
                        fillColor: color,
                        fillOpacity: 0.2,
                      }}
                    />
                  </React.Fragment>
                )
              })}

              {/* Show intersection points */}
              {circles.length > 1 && (() => {
                const allIntersections: IntersectionPoint[] = []
                for (let i = 0; i < circles.length; i++) {
                  for (let j = i + 1; j < circles.length; j++) {
                    const intersections = calculateIntersectionPoints(circles[i], circles[j])
                    allIntersections.push(...intersections)
                  }
                }
                return allIntersections.map((point, idx) => (
                  <Circle
                    key={`intersection-${idx}`}
                    center={[point.lat, point.lng]}
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
                      {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                    </Popup>
                  </Circle>
                ))
              })()}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}

export default App
