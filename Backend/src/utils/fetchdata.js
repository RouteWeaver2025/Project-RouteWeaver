import {User} from "../../models/user.js";


async function findUserByEmail(req, res){ //checks email then password
    try {
        const user = await User.findOne(req.params.email); 
        if (!user) {
            return res.status(404).json({ message: "Email not registered" });
        }
        if(user.password !== req.body.password) {
            return res.status(401).json({ message: "Incorrect password" });
        }
        res.status(200).json({ message: "Login successful", redirectUrl: "/home" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
}

async function addUser(req, res) { //for signup, checks if email already exists
    try{
        const user=req.body;
        if(await User.findOne({email: user.email})){
            return {message: "Email already exists"};
        }
        else{
            const newUser = new User({username: user.username, email: user.email, password: user.password});
            await newUser.save();
            return res.status(201).json({ message: "User added!",redirectUrl: "/home" });
        }
    }
    catch(error){
        return res.status(500).json({ message: "Server error", error });
    }
}
async function deleteUser(email) {
    res.json({ message: "Status Pending" });
}
async function fetchSavedRoutes(req, res) {
    res.json({ message: "Status Pending" });
}
async function addRoutes(req,res){
    const user= await Routes.findOne(req.params.Userid);
}
export {findUserByEmail, addUser, deleteUser,fetchSavedRoutes,addRoutes};