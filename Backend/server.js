import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env file first
dotenv.config();

import { router } from './src/routes/login.js';
import { saver } from './src/routes/savedroutes.js';
import creationRouter from './src/routes/creation.js';
import {homr} from './src/routes/home.js';
import travelRouter from './src/routes/@traveloptions.js';
import suggestRouter from './src/routes/@suggest.js';
import smartVacayRouter from './src/routes/@smartvacay.js';


// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

app.use("/user",router); //handles all routes starting with /user
app.use("/saved",saver); //handles all routes starting with /saved
app.use('/api', creationRouter);
app.use("/home",homr);
app.use('/travel', travelRouter); // handles all routes starting with /travel

app.use('/suggest', suggestRouter); // handles all routes starting with /suggest
app.use('/smartvacay', smartVacayRouter); // handles all routes starting with /smartvacay

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
