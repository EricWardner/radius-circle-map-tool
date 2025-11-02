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

// Component to auto-fit map bounds to show the entire circle
function AutoFitBounds({ center, radiusInMeters }: { center: LocationState; radiusInMeters: number }) {
  const map = useMap()

  useEffect(() => {
    // Small delay to ensure map is ready
    const timeoutId = setTimeout(() => {
      try {
        if (!map || !center || radiusInMeters <= 0) return

        // Create bounds manually instead of using a temporary circle
        // This is more reliable and doesn't create unnecessary objects
        const latDelta = (radiusInMeters / 111320) // 1 degree latitude ≈ 111,320 meters
        const lngDelta = radiusInMeters / (111320 * Math.cos(center.lat * Math.PI / 180))

        const bounds = L.latLngBounds(
          [center.lat - latDelta, center.lng - lngDelta],
          [center.lat + latDelta, center.lng + lngDelta]
        )

        // Fit the map to show the entire circle with padding
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 18,
          animate: true
        })
      } catch (error) {
        console.error('Error fitting bounds:', error)
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [center, radiusInMeters, map])

  return null
}

function App() {
  const [location, setLocation] = useState<LocationState | null>(null)
  const [radius, setRadius] = useState<number>(5)
  const [unit, setUnit] = useState<Unit>('miles')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [address, setAddress] = useState<string>('')

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

  const searchAddress = async () => {
    if (!address.trim()) {
      setError('Please enter an address')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Use Nominatim (OpenStreetMap's free geocoding service)
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

      setLocation({
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      })
      setLoading(false)
    } catch (err) {
      setError('Error searching for address. Please try again.')
      setLoading(false)
    }
  }

  const handleAddressKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      searchAddress()
    }
  }

  // Default center (will be replaced when user gets their location)
  const defaultCenter: LocationState = { lat: 40.7128, lng: -74.006 }
  const center = location || defaultCenter

  return (
    <div className="app">
      <div className="header">
        <h1>Radius Circle Map Tool</h1>
        <p>Get your location or search an address to draw a radius circle on the map</p>
      </div>

      <div className="controls">
        <div className="location-row">
          <button onClick={getLocation} disabled={loading} className="location-btn">
            {loading ? 'Getting Location...' : 'Get My Location'}
          </button>

          <div className="address-search">
            <input
              type="text"
              placeholder="Or enter an address..."
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
              Search
            </button>
          </div>
        </div>

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
              <AutoFitBounds center={location} radiusInMeters={radiusInMeters} />
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
