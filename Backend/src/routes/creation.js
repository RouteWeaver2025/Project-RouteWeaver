import express from 'express';
import { getRouteWithTouristSpots } from '../utils/landmarks.js';
// import {summarizer} from '../utils/summmary.js';

const newr=express.Router();
const app=express();
app.use(express.json());

newr
    .route('/')
    .get(getRouteWithTouristSpots)

// newr
//     .route('/suggestion')
//     .get(summarizer)
export {newr};