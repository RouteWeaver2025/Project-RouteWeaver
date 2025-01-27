import { Client } from "@googlemaps/google-maps-services-js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({});
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

async function getRouteWithTouristSpots(req, res) {
    try {
        const { origin, destination } = req.body;
        // Fetching route data and decode polyline
        const directionsResponse = await client.directions({
            params: {
                origin,
                destination,
                key: apiKey,
            },
        });

        const polyline = directionsResponse.data.routes[0].overview_polyline.points;
        const points = decodePolyline(polyline);

        // Fetching tourist attractions along the route
        const radius = 10000; // 10 km radius
        const step = Math.floor(points.length / 50); // Reduce the number of points to avoid excessive API calls
        const touristSpots = new Set(); // Use a Set to avoid duplicates

        for (let i = 0; i < points.length && touristSpots.size < 7; i += step) {
            const point = points[i];
            const response = await client.placesNearby({
                params: {
                    location: `${point.lat},${point.lng}`,
                    radius,
                    type: "tourist_attraction", // Search for tourist attractions
                    key: apiKey,
                },
            });

            // Filter for high-quality attractions
            const attractions = response.data.results
                .filter(place => place.rating >= 4.0 && place.user_ratings_total > 100) // Quality filter
                .map(place => ({
                    name: place.name,
                    location: place.geometry.location
                }));

            // Add attractions to the Set
            for (const attraction of attractions) {
                if (touristSpots.size < 9) {
                    touristSpots.add(JSON.stringify(attraction)); // Add unique attractions
                } else {
                    break; // Stop if we already have 7 attractions
                }
            }
        }

        // Step 3: Format results
        const finalAttractions = Array.from(touristSpots).map(attraction =>
            JSON.parse(attraction)
        );
        return res.json(finalAttractions);

    } catch (error) {
        console.error("Error fetching route or tourist spots:", error);
    }
}

// Decode polyline function
function decodePolyline(polyline) {
    let points = [];
    let index = 0, len = polyline.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = polyline.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = polyline.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return points;
}

// Test the function
export { getRouteWithTouristSpots };
