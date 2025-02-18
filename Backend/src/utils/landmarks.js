import { Client } from "@googlemaps/google-maps-services-js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({});
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
async function getRouteWithTouristSpots(req, res) {
    try {
        const origin = req.query.origin;    // Get from req.query
        const destination = req.query.destination;

        const directionsResponse = await getDirectionsWithCache(origin, destination, apiKey);
        const polyline = directionsResponse.data.routes[0].overview_polyline.points;
        const points = decodePolyline(polyline);

        // --- Optimized Waypoint Selection and Radius ---
        const waypoints = sampleWaypoints(points, 100); // Reduced waypoints for more focused search
        const radius = 45000; // Adjusted radius (5km) - experiment with this

        const allPlaces = []; // Array to store all unique places
        const seenPlaceIds = new Set();

        for (const waypoint of waypoints) {
            const placesNearWaypoint = await getTouristAttractionsWithCache(waypoint, radius, apiKey, combinedKeywords);

            for (const place of placesNearWaypoint) {
                if (!seenPlaceIds.has(place.place_id)) {
                    allPlaces.push(place);
                    seenPlaceIds.add(place.place_id);
                }
            }
            if (allPlaces.length >= 8) break; // Stop when we have enough
        }


        // --- Separate Place Details and Image URLs ---
        const placeDetails = [];
        const imageUrls = [];

        for (const place of allPlaces.slice(0, 8)) { // Limit to 8 after deduplication
            placeDetails.push({
                name: place.name,
                location: place.location,
                place_id: place.place_id,
            });

            const imageUrl = place.photos && place.photos.length > 0
                ? getPlacePhotoUrl(place.photos[0].photo_reference, apiKey)
                : null;

            imageUrls.push(imageUrl);
        }

        return res.json({ places: placeDetails, images: imageUrls });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "An error occurred" });
    }
}


// --- Helper Functions ---

// 1. Cached Directions Service
const directionsCache = {};
async function getDirectionsWithCache(origin, destination, apiKey) {
    const cacheKey = `${origin},${destination}`;
    if (directionsCache[cacheKey]) {
        return directionsCache[cacheKey];
    }

    const directionsResponse = await client.directions({
        params: { origin, destination, key: apiKey },
    });
    directionsCache[cacheKey] = directionsResponse;
    return directionsResponse;
}

// 2. Sample Waypoints
function sampleWaypoints(points, maxWaypoints) {
    if (points.length <= maxWaypoints) return points;

    const step = Math.ceil(points.length / maxWaypoints);
    const waypoints = [];
    for (let i = 0; i < points.length; i += step) {
        waypoints.push(points[i]);
    }
    return waypoints;
}

// 3. Cached and Optimized Places Nearby Search
const placesCache = {};
const combinedKeywords = "monument, historical site, shopping mall, museum, park, waterfall, garden, scenic view, sightseeing";

async function getTouristAttractionsWithCache(waypoint, radius, apiKey, keywords) {
    const cacheKey = `${waypoint.lat},${waypoint.lng},${radius},${keywords}`;
    if (placesCache[cacheKey]) {
        return placesCache[cacheKey];
    }

    const response = await client.placesNearby({
        params: {
            location: `${waypoint.lat},${waypoint.lng}`,
            radius,
            type: "tourist_attraction",
            keyword: keywords,
            key: apiKey,
        },
    });

    if (!response.data || !response.data.results) {
        console.error("Invalid Places API response:", response);
        placesCache[cacheKey] = []; // Cache an empty array in case of error
        return []; // Return an empty array
    }

    const attractions = response.data.results
        .filter(place => place.rating >= 4.0 && place.user_ratings_total > 100)
        .map(place => ({
            name: place.name,
            location: place.geometry.location,
            place_id: place.place_id,
            photos: place.photos || [] // Handle cases where photos might be undefined
        }));

    placesCache[cacheKey] = attractions;
    return attractions;
}
// 4. Efficient Filter and Deduplication
function filterAndDeduplicate(places) {
    const uniquePlaces = [];
    const seenPlaceIds = new Set();

    for (const place of places) {
        if (!seenPlaceIds.has(place.place_id)) {
            uniquePlaces.push(place);
            seenPlaceIds.add(place.place_id);
        }
    }
    return uniquePlaces;
}

// 5. Function to generate image URL from photo reference
function getPlacePhotoUrl(photoReference, apiKey, maxWidth = 400) {
    if (!photoReference) return null;

    const baseUrl = "https://maps.googleapis.com/maps/api/place/photo";
    const params = {
        maxwidth: maxWidth,
        photoreference: photoReference,
        key: apiKey,
    };

    const queryString = new URLSearchParams(params).toString();
    return `${baseUrl}?${queryString}`;
}

// Decode polyline function (unchanged)
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
