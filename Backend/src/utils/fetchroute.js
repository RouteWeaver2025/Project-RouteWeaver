function fetchSavedRoutes( req, res) {   
    const response = {
        1: {
            origin: "Kochi",
            destination: "Trivandrum"
        },
        2: {
            origin: "Kanjirappally",
            destination: "Kochi"
        }
    }
    return res.json(response);
}
function parseRoutes(req){
    const {person, routes}=req.body;
    const newRoute=new Route({person, routes});
    return newRoute;
}
export {fetchSavedRoutes};