import express from "express";
import { mongoconnect } from "../utils/connection.js";
import {findUserByEmail, addUser} from "../utils/fetchdata.js";

const router=express.Router();
const app=express();
app.use(express.json());

mongoconnect("mongodb+srv://routeweaver25:its2025bruh@cluster0.8p2ri.mongodb.net/Main?retryWrites=true&w=majority&appName=Cluster0");
router
  .route('/login')
  .post(findUserByEmail)

router
  .route('/signup')
  .post(addUser)

export {router};