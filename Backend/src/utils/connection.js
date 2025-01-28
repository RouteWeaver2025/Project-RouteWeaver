import mongoose from "mongoose";

async function mongoconnect(url){
    try{
        await mongoose.connect(url, {
            serverSelectionTimeoutMS: 10000, // Increased timeout to 10 seconds
          });
    } catch(err){
        console.error("Error connecting to MongoDB", err);
    }
}

export {mongoconnect};