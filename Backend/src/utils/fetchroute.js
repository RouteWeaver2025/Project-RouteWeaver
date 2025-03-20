// import { Route } from '../models/routes.js';
// import {getOD} from './landmarks.js';
// async function fetchSavedRoutes(req, res) {
//     try {
//         const { email } = req.body;

//         // Fetch the user's saved routes
//         const user = await Route.findOne({ user: email });

//         if (!user) {
//             return res.status(404).json({ message: "No Available Routes" });
//         }
//         const routesObject = {};

//         await Promise.all(user.routes.map(async (route) => {
//             const { origin, destination } = await getOD(route.routeData);
//             routesObject[route.id] = { origin, destination };
//         }));

//         return res.json(routesObject);
//     } catch (error) {
//         console.error("Error fetching routes:", error);
//         res.status(500).json({ message: "Server Error" });
//     }
// }
// export { fetchSavedRoutes };