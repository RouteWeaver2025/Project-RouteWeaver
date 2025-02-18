import express from "express";
import {fetchSavedRoutes} from "../utils/fetchroute.js";
// import {getTravelSummary} from "../utils/summary.js";

const saver=express.Router();
const app=express();
app.use(express.json());

saver
    .route('/')
    .get(fetchSavedRoutes)

// saver
    // .route('/:id')
    // .get(getTravelSummary)
export {saver};