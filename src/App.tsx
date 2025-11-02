import { useState, useEffect } from 'react'
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

interface LocationState {
  lat: number
  lng: number
}

// Component to recenter map when location changes
function RecenterMap({ center }: { center: LocationState }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], 13)
  }, [center, map])
  return null
}

function App() {
  const [location, setLocation] = useState<LocationState | null>(null)
  const [radius, setRadius] = useState<number>(5)
  const [unit, setUnit] = useState<Unit>('miles')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Convert radius to meters for Leaflet Circle
  const radiusInMeters = unit === 'miles' ? radius * 1609.34 : radius * 1000

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
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLoading(false)
      },
      (err) => {
        setError(`Error getting location: ${err.message}`)
        setLoading(false)
      }
    )
  }

  // Default center (will be replaced when user gets their location)
  const defaultCenter: LocationState = { lat: 40.7128, lng: -74.006 }
  const center = location || defaultCenter

  return (
    <div className="app">
      <div className="header">
        <h1>Radius Circle Map Tool</h1>
        <p>Get your location and draw a radius circle on the map</p>
      </div>

      <div className="controls">
        <button onClick={getLocation} disabled={loading} className="location-btn">
          {loading ? 'Getting Location...' : 'Get My Location'}
        </button>

        <div className="radius-controls">
          <label htmlFor="radius">Radius:</label>
          <input
            id="radius"
            type="number"
            min="1"
            step="1"
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value) || 1)}
            className="radius-input"
          />

          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as Unit)}
            className="unit-select"
          >
            <option value="miles">Miles</option>
            <option value="km">Kilometers</option>
          </select>
        </div>

        {error && <div className="error">{error}</div>}
        {location && (
          <div className="location-info">
            Location: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
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

          {location && (
            <>
              <RecenterMap center={location} />
              <Marker position={[location.lat, location.lng]}>
                <Popup>Your Location</Popup>
              </Marker>
              <Circle
                center={[location.lat, location.lng]}
                radius={radiusInMeters}
                pathOptions={{
                  color: 'blue',
                  fillColor: 'blue',
                  fillOpacity: 0.2,
                }}
              />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  )
}

export default App
