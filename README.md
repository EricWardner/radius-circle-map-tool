# Radius Circle Map Tool

A simple and elegant web application built with React, TypeScript, and Vite that allows you to visualize multiple radius circles on a map with automatic intersection detection.

## Features

- **Multiple Locations**: Add unlimited circles via geolocation or address search
- **Interactive Map**: Display locations on OpenStreetMap with unique colors per circle
- **Address Search**: Free geocoding using Nominatim (OpenStreetMap)
- **Customizable Radius**: Adjust radius for each circle independently
- **Unit Conversion**: Switch between miles and kilometers per circle
- **Intersection Detection**: Automatically calculates and displays where circles intersect
- **Auto-Fit Bounds**: Map automatically zooms to show all circles and intersections
- **Real-time Updates**: All changes reflect instantly on the map
- **Fully Responsive**: Works on desktop, tablet, and mobile
- **No API Keys**: 100% free and open source - no paid APIs required

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Leaflet** - Open-source mapping library
- **React-Leaflet** - React components for Leaflet
- **OpenStreetMap** - Free map tiles

## Installation

1. Navigate to the project directory:
```bash
cd radius-map-tool
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to the URL shown in the terminal (typically `http://localhost:5173`)

3. **Add locations**:
   - Click "Add My Location" to add your current position
   - Or enter an address and click "Add" to search for a location

4. **Customize circles**:
   - Each circle appears in the list with coordinates
   - Adjust the radius value for any circle
   - Switch between miles (mi) and kilometers (km)
   - Click the red ✕ to remove a circle

## Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

To preview the production build locally:

```bash
npm run preview
```

## Deploying to GitHub Pages

This project is configured for easy deployment to GitHub Pages.

## Privacy

This application:
- Only requests location when you click "Get My Location"
- Does not store or transmit your location data
- Runs entirely in your browser
- Uses no analytics or tracking

## License

MIT