// import { Route } from "../models/routes.js";
// import { getEntireRoute } from './landmarks.js';
// async function addRoute(req, res) {
//     try {
//         const { email, id, waypoints } = req.body;
//         console.log("Received waypoints:", req.body.waypoints);
//         const routeStr = await getEntireRoute(req.body.waypoints);
//         console.log("Generated Route:", routeStr);
//         let userRoute = await Route.findOne({ user: email });

//         if (!userRoute) {
//             userRoute = new Route({ user: email, routes: [] });
//         }

//         let newId;

//         if (id === "x") {
//             newId = userRoute.routes.length > 0
//                 ? Math.max(...userRoute.routes.map(r => r.id)) + 1
//                 : 1;
//         } else {
//             newId = id;
//         }

//         userRoute.routes.push({ id: newId, routeData: routeStr });
//         await userRoute.save();
//         return res.status(200).json({ message: "Route added successfully", newId });


//     } catch (error) {
//         console.error("Error in addRoute:", error.message);
//         return res.status(500).json({ message: "Server error" });
//     }
// }
// export { addRoute };