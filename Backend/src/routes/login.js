import express from "express";
import { mongoconnect } from "../utils/connection.js";
import {findUserByEmail, addUser} from "../utils/fetchdata.js";
import dotenv from "dotenv";
dotenv.config();

const router=express.Router();
const app=express();
app.use(express.json());
const url = process.env.MONGO_URL;
mongoconnect(url);
router
  .route('/login')
  .post(findUserByEmail)

router
  .route('/signup')
  .post(addUser)

export {router};