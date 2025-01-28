import mongoose from 'mongoose';
import { User } from './user.js';
const RouteSchema = new mongoose.Schema({
  user: {
    type: String, // Refers to the userId from UserSchema
    ref: User, // Reference to the User model
    required: true,
  },
  routes: [
    {
      routeData:{
        type:String,
        required:true
      }
      // id: {
      //   type: Number, // Name of the route (e.g., route1, route2)
      //   required: true,
      //   unique: true,
      // },
      // coordinates: [
      //   {
      //     latitude: {
      //       type: Number, // Latitude of the place
      //       required: true,
      //     },
      //     longitude: {
      //       type: Number, // Longitude of the place
      //       required: true,
      //     },
      //   },
      // ],
    },
  ],
});

const Route = mongoose.model("Route", RouteSchema);
export { Route };