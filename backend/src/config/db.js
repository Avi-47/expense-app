const mongoose = require("mongoose");
const { MONGO_URI } = require("./env");

console.log("MONGO_URI:", MONGO_URI ? "set" : "undefined");

const connectDB = async () =>{
    try{
        console.log("Attempting MongoDB connection...");
        console.log("URI starts with:", MONGO_URI ? MONGO_URI.substring(0, 20) : "none");
        
        const opts = {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        };
        
        await mongoose.connect(MONGO_URI, opts);
        console.log("MongoDB connected successfully");
    }catch(err){
        console.error("MongoDB connection failed:", err.message);
        console.error("Error name:", err.name);
        console.error("Error code:", err.code);
        if (err.cause) console.error("Cause:", err.cause);
        process.exit(1);
    }
}
module.exports = connectDB;