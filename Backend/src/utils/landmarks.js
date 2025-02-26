import { Client } from "@googlemaps/google-maps-services-js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({});
const apiKey = process.env.GOOGLE_MAPS_API_KEY;
async function getRouteWithTouristSpots(req, res) {
    try {
        const origin = req.query.origin;
        const destination = req.query.destination;

        const directionsResponse = await getDirectionsWithCache(origin, destination, apiKey);
        const polyline = directionsResponse.data.routes[0].overview_polyline.points;
        const points = decodePolyline(polyline);

        const waypoints = sampleWaypoints(points, 100);
        const radius = 45000;

        const allPlaces = [];
        const seenPlaceIds = new Set();

        for (const waypoint of waypoints) {
            const placesNearWaypoint = await getTouristAttractionsWithCache(waypoint, radius, apiKey, combinedKeywords);

            if (placesNearWaypoint) { // Check if placesNearWaypoint is not undefined
                for (const place of placesNearWaypoint) {
                    if (!seenPlaceIds.has(place.place_id)) {
                        allPlaces.push(place);
                        seenPlaceIds.add(place.place_id);
                    }
                }
            }
            if (allPlaces.length >= 8) break;
        }

        const placeDetails = [];
        const imageUrls = [];

        for (const place of allPlaces.slice(0, 8)) {
            placeDetails.push({
                name: place.name,
                location: place.location,
                place_id: place.place_id,
                formatted_address: place.formatted_address,
                state: place.state,
                country: place.country,
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
        placesCache[cacheKey] = [];
        return [];
    }

    const attractions = [];
    for (const place of response.data.results.filter(place => place.rating >= 4.0 && place.user_ratings_total > 100)) {
        const placeDetails = {
            name: place.name,
            location: place.geometry.location,
            place_id: place.place_id,
            photos: place.photos || [],
        };

        try {
            const geocodeResponse = await client.geocode({
                params: { place_id: place.place_id, key: apiKey },
            });

            if (geocodeResponse.data.results && geocodeResponse.data.results.length > 0) {
                const addressComponents = geocodeResponse.data.results[0].address_components;
                placeDetails.formatted_address = geocodeResponse.data.results[0].formatted_address;

                const stateComponent = addressComponents.find(component => component.types.includes('administrative_area_level_1'));
                const countryComponent = addressComponents.find(component => component.types.includes('country'));

                if (stateComponent) {
                    placeDetails.state = stateComponent.long_name;
                }
                if (countryComponent) {
                    placeDetails.country = countryComponent.long_name;
                }
            }
        } catch (geocodeError) {
            console.error("Geocoding error:", geocodeError);
        }

        attractions.push(placeDetails);
    }

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
async function getEntireRoute(waypoints) {
    try {
        if (!waypoints || waypoints.length < 2) {
            throw new Error("Invalid waypoints array. Must contain at least origin and destination.");
        }

        let origin = formatLocation(waypoints[0]);
        let destination = formatLocation(waypoints[waypoints.length - 1]);

        const waypointsArray = waypoints.slice(1, waypoints.length - 1);
        let directionsResponse;

        try {
            const params = {
                origin: origin,
                destination: destination,
                key: apiKey,
            };

            if (waypointsArray.length > 0) {
                params.waypoints = waypointsArray.map(formatLocation);
            }

            directionsResponse = await client.directions({ params });

            if (!directionsResponse.data.routes.length) {
                throw new Error("No routes found for the given waypoints.");
            }
        } catch (error) {
            console.error("Google Maps API Error:", error.response?.data || error.message);
            throw new Error("Failed to fetch directions from Google Maps API.");
        }

        const encodedPolyline = directionsResponse.data.routes[0]?.overview_polyline?.points;
        if (!encodedPolyline) {
            throw new Error("Google Maps API response is missing polyline data.");
        }

        return encodedPolyline;
    } catch (error) {
        console.error("Error in getEntireRoute:", error.message);
        throw error;
    }
}

// Helper function to format waypoints correctly
function formatLocation(waypoint) {
    if (typeof waypoint === 'string') {
        return waypoint; // Already a valid address or place_id
    } 
    if (waypoint.place_id) {
        return `place_id:${waypoint.place_id}`; // Use place_id format
    }
    return `${waypoint.landmark}, ${waypoint.state}, ${waypoint.country}`; // Default format
}


// Test the function
export { getRouteWithTouristSpots, getEntireRoute };
