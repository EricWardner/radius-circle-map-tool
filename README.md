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

## Prerequisites

- Node.js 20.19+, 22.12+, or 24.x (latest LTS recommended)
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

3. **Add locations**:
   - Click "Add My Location" to add your current position
   - Or enter an address and click "Add" to search for a location

4. **Customize circles**:
   - Each circle appears in the list with coordinates
   - Adjust the radius value for any circle
   - Switch between miles (mi) and kilometers (km)
   - Click the red ✕ to remove a circle

5. **View intersections**:
   - When circles overlap, red dots mark intersection points
   - Click the dots to see exact coordinates
   - Map auto-zooms to show all circles and intersections

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

### Automatic Deployment (Recommended)

The project includes a GitHub Actions workflow that automatically deploys to GitHub Pages on every push to the `main` branch.

**Setup Steps:**

1. **Create a GitHub repository** and push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/radius-map-tool.git
   git push -u origin main
   ```

2. **Enable GitHub Pages** in your repository:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**

3. **Configure the base URL** (if needed):
   - If your repo name is NOT `radius-map-tool`, edit `vite.config.ts`:
     ```typescript
     base: '/YOUR_REPO_NAME/',
     ```
   - If using a custom domain or `username.github.io`, set:
     ```typescript
     base: '/',
     ```

4. **Push to deploy**:
   ```bash
   git add .
   git commit -m "Configure deployment"
   git push
   ```

Your site will be live at: `https://YOUR_USERNAME.github.io/radius-map-tool/`

### Manual Deployment

You can also deploy manually using the `gh-pages` package:

```bash
npm run deploy
```

This builds the project and pushes the `dist` folder to the `gh-pages` branch.

## How It Works

1. **Geolocation**: Uses the browser's native `navigator.geolocation` API to get your current coordinates
2. **Address Geocoding**: Uses Nominatim API (OpenStreetMap) to convert addresses to coordinates
3. **Map Rendering**: Leaflet renders an interactive map using free OpenStreetMap tiles
4. **Multiple Circles**: Each location is stored with its own radius and unit settings
5. **Circle Visualization**: Circles are drawn using Leaflet's Circle component with unique colors
6. **Intersection Calculation**:
   - Converts lat/lng to cartesian coordinates
   - Uses geometric formulas to find intersection points between circle pairs
   - Marks intersection points with red dots
7. **Auto-Fit Bounds**:
   - Calculates bounding box for all circles
   - Includes intersection points in bounds
   - Automatically adjusts zoom to fit everything
8. **Unit Conversion**:
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
