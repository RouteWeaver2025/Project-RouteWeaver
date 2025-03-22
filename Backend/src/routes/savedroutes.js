import express from "express";
import { fetchSavedRoutes, getRouteById, updateRouteById } from "../utils/fetchroute.js";
import { addRoute } from "../utils/saveroute.js";
// import {getTravelSummary} from "../utils/summary.js";

const saver = express.Router();
const app = express();
app.use(express.json());

// Route to fetch saved routes
saver.route('/').post(fetchSavedRoutes);

// Route to save a new route
saver.route('/save').post(addRoute);

// Route to get a specific route by ID
saver.route('/:email/:routeId').get(getRouteById);

// Route to update a route
saver.route('/update').post(updateRouteById);

// Uncomment when implementing summary functionality
// saver.route('/:id').get(getTravelSummary);

export { saver };