import express from 'express';
import { router } from './src/routes/login.js';
import {saver} from './src/routes/savedroutes.js';
import {newr} from './src/routes/creation.js';
import {homr} from './src/routes/home.js';
const app = express();
const PORT = 5000;
app.use(express.json());

app.use("/user",router); //handles all routes starting with /user
app.use("/saved",saver); //handles all routes starting with /saved
app.use("/create" ,newr); //handles all routes starting with /create
app.use("/home",homr);
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
