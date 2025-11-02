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

// Component to auto-fit map bounds to show all circles
function AutoFitAllBounds({ circles }: { circles: CircleData[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || circles.length === 0) return

    const timeoutId = setTimeout(() => {
      try {
        // Create bounds that include all circles
        const allBounds: L.LatLngBounds[] = []

        circles.forEach((circle) => {
          const radiusInMeters = circle.unit === 'miles' ? circle.radius * 1609.34 : circle.radius * 1000
          const latDelta = radiusInMeters / 111320
          const lngDelta = radiusInMeters / (111320 * Math.cos(circle.lat * Math.PI / 180))

          const circleBounds = L.latLngBounds(
            [circle.lat - latDelta, circle.lng - lngDelta],
            [circle.lat + latDelta, circle.lng + lngDelta]
          )
          allBounds.push(circleBounds)
        })

        if (allBounds.length === 1) {
          map.fitBounds(allBounds[0], { padding: [50, 50], maxZoom: 18, animate: true })
        } else if (allBounds.length > 1) {
          // Combine all bounds
          let combinedBounds = allBounds[0]
          for (let i = 1; i < allBounds.length; i++) {
            combinedBounds.extend(allBounds[i])
          }
          map.fitBounds(combinedBounds, { padding: [50, 50], maxZoom: 18, animate: true })
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
    <div className="app">
      <div className="header">
        <h1>Radius Circle Map Tool</h1>
        <p>Add multiple locations and draw radius circles on the map</p>
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}

export default App
