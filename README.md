# Radius Circle Map Tool

A simple and elegant web application built with React, TypeScript, and Vite that allows you to get your current location and visualize a radius circle on a map.

## Features

- Get your current location using browser geolocation
- Display your location on an interactive map using OpenStreetMap
- Draw a customizable radius circle around your location
- Switch between miles and kilometers
- Real-time radius adjustment
- Fully responsive design
- No paid APIs required - 100% open source

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Leaflet** - Open-source mapping library
- **React-Leaflet** - React components for Leaflet
- **OpenStreetMap** - Free map tiles

## Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 7)
- npm or yarn

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

3. Click "Get My Location" to allow the browser to access your location

4. Adjust the radius and unit (miles/km) to see the circle update on the map

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

## How It Works

1. **Geolocation**: Uses the browser's native `navigator.geolocation` API to get your current coordinates
2. **Map Rendering**: Leaflet renders an interactive map using free OpenStreetMap tiles
3. **Circle Visualization**: A circle is drawn using Leaflet's Circle component with the radius converted to meters
4. **Unit Conversion**:
   - Miles to meters: `miles × 1609.34`
   - Kilometers to meters: `km × 1000`

## Browser Compatibility

This application requires a modern browser with:
- Geolocation API support
- ES6+ JavaScript support

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Privacy

This application:
- Only requests location when you click "Get My Location"
- Does not store or transmit your location data
- Runs entirely in your browser
- Uses no analytics or tracking

## License

MIT

## Contributing

Feel free to open issues or submit pull requests for improvements!
