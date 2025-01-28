import express from 'express';
import {User} from "../models/user.js";
const homr=express.Router();
const app=express();
homr  //works for all requests on /home
    .route('/')
    .get(async(req,res)=>{
        try{
            const userEmail=req.body.email;
            const user = await User.findOne({ email: userEmail }, 'username');
            return res.json(user);
        }
        catch(err){
            return res.status(400).json('Server Error');
        }
        
    })
export {homr};