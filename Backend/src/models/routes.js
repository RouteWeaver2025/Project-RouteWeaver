import mongoose from 'mongoose';
import { User } from './user.js';

const RouteSchema = new mongoose.Schema({
  user: {
    type: String, 
    ref: User, 
    required: true,
  },
  routes: [
    {
      id: {
          type: Number, // index of the route
          required: true,
        },
      routeData:{
        type: String,
        required: true
      }
    },
  ],
});

RouteSchema.index({ 'user': 1, 'routes.id': 1 }, { unique: true });

const Route = mongoose.model("Route", RouteSchema);
export { Route };