import express from "express";
import {fetchSavedRoutes} from "../utils/fetchroute.js";
import { addRoute } from "../utils/saveroute.js";
// import {getTravelSummary} from "../utils/summary.js";

const saver=express.Router();
const app=express();
app.use(express.json());

saver
    .route('/')
    .post(fetchSavedRoutes)

saver
    .route('/save')
    .post(addRoute)
// saver
    // .route('/:id')
    // .get(getTravelSummary)
export {saver};