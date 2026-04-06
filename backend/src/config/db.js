const mongoose = require("mongoose");
const { MONGO_URI } = require("./env");

console.log("MONGO_URI:", MONGO_URI ? "set" : "undefined");

const connectDB = async () =>{
    try{
        console.log("Attempting MongoDB connection...");
        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected successfully");
    }catch(err){
        console.error("MongoDB connection failed:", err.message);
        console.error("Full error:", err);
        process.exit(1);
    }
}
module.exports = connectDB;