import {User} from "../models/user.js";
import bcrypt from "bcryptjs";
async function findUserByEmail(req, res){ //checks email then password
    try {
        const {email,password}=req.body;
        const user = await User.findOne({ email: email }); // Find user by email
        if (!user) {
            return res.status(404).json({ message: "Email not registered" });
        }
        const isMatch = await bcrypt.compare(password, user.password); //uses bcrypt to compare input password with that present in database.
        if(!isMatch) {
            return res.status(401).json({ message: "Incorrect password" });
        }
        return res.status(200).json({ message: "Login successful", redirectUrl: "/home" });
    } catch (error) {
        return res.status(500).json({ message: "Server error", error });
    }
}

async function addUser(req, res) { //for signup, checks if email already exists
    try{
        const user=req.body;
        if(await User.findOne({email: user.email})){
            return res.json({message: "Email already exists"});
        }
        else{
            const newUser = new User({username: user.username, email: user.email, password: user.password});
            await newUser.save();
            return res.status(201).json({ message: "User added!",redirectUrl: "/home" });
        }
    }
    catch(error){
        return res.status(500).json({ message: "Server error"});
    }
}
async function deleteUser(email) {
    res.json({ message: "Status Pending" });
}
    
export {findUserByEmail, addUser, deleteUser};