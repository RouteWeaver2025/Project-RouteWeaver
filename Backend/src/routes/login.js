import express from "express";
import { mongoconnect } from "../utils/connection.js";
import {findUserByEmail, addUser, getProfile} from "../utils/fetchdata.js";
import dotenv from "dotenv";
dotenv.config();

const router=express.Router();
const app=express();
app.use(express.json());
const url = process.env.MONGODB_URL;
mongoconnect(url);
router
  .route('/login')
  .post(findUserByEmail)

router
  .route('/signup')
  .post(addUser)

router
  .route('/getProfile')
  .get(getProfile)

export {router};