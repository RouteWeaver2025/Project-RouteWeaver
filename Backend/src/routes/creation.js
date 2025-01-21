import express from 'express';
import {addRoutes} from '../utils/fetchdata.js';

const newr=express.Router();
const app=express();
app.use(express.json());

newr
    .route('/custom')
    .post(addRoutes)

export {newr};