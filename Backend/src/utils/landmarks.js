import { Client } from "@googlemaps/google-maps-services-js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({});
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

async function getRoutesWithTouristSpots(req, res) {
  try {
    const origin = req.query.origin;
    const destination = req.query.destination;
    const selectedKeywords = JSON.parse(req.query.selectedKeywords || "[]");

    // Fetch directions with alternatives
    const directionsResponse = await client.directions({
      params: {
        origin,
        destination,
        key: apiKey,
        alternatives: true,
        mode: "driving"
      }
    });

    const routes = directionsResponse.data.routes || [];
    
    // Process each route
    const processedRoutes = await Promise.all(
      routes.map(async (route, index) => {
        let totalDuration = 0;
        let totalDistance = 0;
        route.legs.forEach(leg => {
          totalDuration += leg.duration.value;
          totalDistance += leg.distance.value;
        });
        const timeTaken = formatDuration(totalDuration);
        const distance = formatDistance(totalDistance);

        // Use steps from the first leg, skipping 10% at the start and 5% at the end
        const steps = route.legs[0].steps;
        const startIndex = Math.floor(steps.length * 0.1);
        const endIndex = Math.floor(steps.length * 0.95);
        const relevantSteps = steps.slice(startIndex, endIndex);

        // Get places along these steps (ensuring at least 5 and at most 11 unique places)
        let places = await getTouristSpots(relevantSteps, selectedKeywords);
        places = removeDuplicates(places);
        if (places.length > 11) {
          places = places.slice(0, 11);
        }
        
        return {
          index,
          timeTaken,
          distance,
          places
        };
      })
    );

    res.json({ routes: processedRoutes });
  } catch (error) {
    console.error("Error in getRoutesWithTouristSpots:", error);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
}

/**
 * getTouristSpots
 * For a given set of steps, fetch nearby tourist spots (with rating and image)
 * by iterating over the user-selected keywords.
 */
async function getTouristSpots(steps, selectedKeywords) {
  let spots = [];

  // For each step, try fetching places for each selected keyword (or fallback)
  for (const step of steps) {
    const waypoint = step.end_location;
    // Build array of types to search: use mapped values from keywords, or default to 'tourist_attraction'
    let typesToTry =
      selectedKeywords.length > 0
        ? selectedKeywords
            .map(keyword => mapKeywordToPlaceType(keyword))
            .filter(t => t)
        : ["tourist_attraction"];
    if (typesToTry.length === 0) {
      typesToTry = ["tourist_attraction"];
    }

    // For each type, fetch nearby places
    for (const type of typesToTry) {
      try {
        const placesResponse = await client.placesNearby({
          params: {
            location: `${waypoint.lat},${waypoint.lng}`,
            radius: 5000, // Use a broader search radius
            type,
            key: apiKey
          }
        });
        const results = placesResponse.data.results || [];
        // Filter for places that meet our quality criteria
        const filtered = results.filter(place => {
          return place.rating >= 4 && place.user_ratings_total >= 1500;
        });
        // For each type, push up to 2 places from the filtered results
        filtered.slice(0, 2).forEach(place => {
          spots.push({
            name: place.name,
            rating: place.rating.toString(),
            image: place.photos
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
              : "https://via.placeholder.com/100"
          });
        });
      } catch (error) {
        console.error("Error fetching places for type", type, error);
      }
    }
  }

  return spots;
}

/**
 * removeDuplicates
 * Removes duplicate places based on the place name.
 */
function removeDuplicates(spots) {
  const unique = [];
  const seen = new Set();
  for (const spot of spots) {
    if (!seen.has(spot.name)) {
      unique.push(spot);
      seen.add(spot.name);
    }
  }
  return unique;
}

/**
 * mapKeywordToPlaceType
 * Maps user-friendly keywords to Google Place types.
 */
function mapKeywordToPlaceType(keyword) {
  const lower = keyword.toLowerCase();
  const mapping = {
    restaurant: "restaurant",
    cafe: "cafe",
    lake: "natural_feature", // Google doesn't have a 'lake' type, so use natural_feature
    viewpoint: "point_of_interest",
    museum: "museum",
    park: "park"
    // Extend this mapping as needed
  };
  return mapping[lower] || "tourist_attraction";
}

// Helper function: formatDuration
function formatDuration(durationInSeconds) {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  return hours > 0 ? `${hours}hrs ${minutes}min` : `${minutes}min`;
}

// Helper function: formatDistance
function formatDistance(distanceInMeters) {
  const km = distanceInMeters / 1000;
  return `${Math.round(km)}km`;
}

// --- Helper Functions ---

// // 1. Cached Directions Service
// const directionsCache = {};
// async function getDirectionsWithCache(origin, destination, apiKey) {
//     const cacheKey = `${origin},${destination}`;
//     if (directionsCache[cacheKey]) {
//         return directionsCache[cacheKey];
//     }

//     const directionsResponse = await client.directions({
//         params: { origin, destination, key: apiKey },
//     });
//     directionsCache[cacheKey] = directionsResponse;
//     return directionsResponse;
// }

// // 2. Sample Waypoints
// function sampleWaypoints(points, maxWaypoints) {
//     if (points.length <= maxWaypoints) return points;

//     const step = Math.ceil(points.length / maxWaypoints);
//     const waypoints = [];
//     for (let i = 0; i < points.length; i += step) {
//         waypoints.push(points[i]);
//     }
//     return waypoints;
// }

// // 3. Cached and Optimized Places Nearby Search
// const placesCache = {};
// const combinedKeywords = "monument, historical site, shopping mall, museum, park, waterfall, garden, scenic view, sightseeing";


// async function getTouristAttractionsWithCache(waypoint, radius, apiKey, keywords) {
//     const cacheKey = `${waypoint.lat},${waypoint.lng},${radius},${keywords}`;
//     if (placesCache[cacheKey]) {
//         return placesCache[cacheKey];
//     }

//     const response = await client.placesNearby({
//         params: {
//             location: `${waypoint.lat},${waypoint.lng}`,
//             radius,
//             type: "tourist_attraction",
//             keyword: keywords,
//             key: apiKey,
//         },
//     });

//     if (!response.data || !response.data.results) {
//         console.error("Invalid Places API response:", response);
//         placesCache[cacheKey] = [];
//         return [];
//     }

//     const attractions = [];
//     for (const place of response.data.results.filter(place => place.rating >= 4.0 && place.user_ratings_total > 100)) {
//         const placeDetails = {
//             name: place.name,
//             location: place.geometry.location,
//             place_id: place.place_id,
//             photos: place.photos || [],
//         };

//         try {
//             const geocodeResponse = await client.geocode({
//                 params: { place_id: place.place_id, key: apiKey },
//             });

//             if (geocodeResponse.data.results && geocodeResponse.data.results.length > 0) {
//                 const addressComponents = geocodeResponse.data.results[0].address_components;
//                 placeDetails.formatted_address = geocodeResponse.data.results[0].formatted_address;

//                 const stateComponent = addressComponents.find(component => component.types.includes('administrative_area_level_1'));
//                 const countryComponent = addressComponents.find(component => component.types.includes('country'));

//                 if (stateComponent) {
//                     placeDetails.state = stateComponent.long_name;
//                 }
//                 if (countryComponent) {
//                     placeDetails.country = countryComponent.long_name;
//                 }
//             }
//         } catch (geocodeError) {
//             console.error("Geocoding error:", geocodeError);
//         }

//         attractions.push(placeDetails);
//     }

//     placesCache[cacheKey] = attractions;
//     return attractions;
// }

// // 4. Efficient Filter and Deduplication
// function filterAndDeduplicate(places) {
//     const uniquePlaces = [];
//     const seenPlaceIds = new Set();

//     for (const place of places) {
//         if (!seenPlaceIds.has(place.place_id)) {
//             uniquePlaces.push(place);
//             seenPlaceIds.add(place.place_id);
//         }
//     }
//     return uniquePlaces;
// }

// // 5. Function to generate image URL from photo reference
// function getPlacePhotoUrl(photoReference, apiKey, maxWidth = 400) {
//     if (!photoReference) return null;

//     const baseUrl = "https://maps.googleapis.com/maps/api/place/photo";
//     const params = {
//         maxwidth: maxWidth,
//         photoreference: photoReference,
//         key: apiKey,
//     };

//     const queryString = new URLSearchParams(params).toString();
//     return `${baseUrl}?${queryString}`;
// }

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

async function getOD(routeData) {
    try {
        const decodedPoints =  decodePolyline(routeData);
        const origin= await getName(decodedPoints[0].lat,decodedPoints[0].lng);
        const destination= await getName(decodedPoints[decodedPoints.length-1].lat,decodedPoints[decodedPoints.length-1].lng);
        return { origin, destination };

    } catch (error) {
        console.error("Error in getOD:", error.message);
        throw error;
    }
}
async function getName(lat, lng) {
    try {
        const response = await client.reverseGeocode({
            params: {
                latlng: `${lat},${lng}`,
                key: apiKey,
            },
        });

        if (response && response.data && response.data.plus_code && response.data.plus_code.compound_code) {
            const compoundCode = response.data.plus_code.compound_code;

            const cityMatch = compoundCode.match(/([A-Za-z\s.'-]+)(?:,\s*[A-Za-z\s.'-]+)?,\s*[A-Za-z\s.'-]+(?:,\s*[A-Za-z\s.'-]+)?$/);

            if (cityMatch && cityMatch[1]) {
                let cityName = cityMatch[1].trim();

                // Filter out leading plus code parts (including single letters)
                cityName = cityName.replace(/^[A-Z0-9]+\s/, "");

                if (cityName.length > 2) {
                    console.log("name:", cityName);
                    return cityName;
                } else {
                    console.log("Could not find a valid city name.");
                    return "Unknown";
                }
            } else {
                console.log("Could not find city name.");
                return "Unknown";
            }
        } else {
            console.log("Geocoding failed or compound_code not found.");
            return null;
        }
    } catch (error) {
        console.error("Error in getName:", error);
        return null;
    }
}
// Test the function
export { getRoutesWithTouristSpots, getEntireRoute ,getOD};
