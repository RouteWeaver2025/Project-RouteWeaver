import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_PLACES_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in environment variables");
}

// GET /places?lat=...&lng=...&type=...&radius=...
router.get('/places', async (req, res) => {
  try {
    const { lat, lng, type, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    // If type is missing or empty, fallback to 'tourist_attraction'
    const finalType = type && type.trim() !== "" ? type : "tourist_attraction";
    const searchRadius = radius || 20000; // default 20km

    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", searchRadius);
    url.searchParams.set("type", finalType);
    url.searchParams.set("key", GOOGLE_PLACES_API_KEY);

    console.log("Fetching Google Places from:", url.toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.status(response.status).json({ error: "Google Places API error" });
    }
    const data = await response.json();

    // Process results: include name, rating, geometry, photos (with photo_reference), and vicinity
    const processedResults = data.results.map(place => ({
      name: place.name,
      rating: place.rating,
      geometry: place.geometry,
      photos: place.photos,      // Contains photo_reference, height, width, etc.
      vicinity: place.vicinity
    }));

    return res.json({ results: processedResults });
  } catch (error) {
    console.error("Error in /places endpoint:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
