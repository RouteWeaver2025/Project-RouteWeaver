import mongoose from "mongoose";

async function mongoconnect(url){
    try{
        return mongoose.connect(url);
    } catch(err){
        console.error("Error connecting to MongoDB", err);
    }
}

export {mongoconnect};