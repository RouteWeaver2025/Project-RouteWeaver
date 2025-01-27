import express from 'express';
import {addRoutes} from '../utils/fetchdata.js';
import { getRouteWithTouristSpots } from '../utils/landmarks.js';

const newr=express.Router();
const app=express();
app.use(express.json());

newr
    .route('/')
    .post(getRouteWithTouristSpots)

export {newr};