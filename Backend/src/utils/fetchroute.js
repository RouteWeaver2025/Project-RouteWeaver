async function fetchSavedRoutes( req, res) {   
    res.json({ message: "Status Pending" });
}
function parseRoutes(req){
    const {person, routes}=req.body;
    const newRoute=new Route({person, routes});
    return newRoute;
}
export {fetchSavedRoutes};