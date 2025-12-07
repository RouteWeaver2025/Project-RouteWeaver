import express from 'express';
import { getPlaceSuggestions, getRouteWithWaypoints, getGeocodeCoordinates } from '../utils/suggest.js';

const suggestRouter = express.Router();

// Route to get place suggestions between origin and destination
suggestRouter.post('/suggestions', getPlaceSuggestions);

// Route to get a route with waypoints
suggestRouter.post('/route', getRouteWithWaypoints);

// Route to geocode a place using multiple methods including Gemini
suggestRouter.get('/geocode', getGeocodeCoordinates);

export default suggestRouter; 