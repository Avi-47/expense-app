const mongoose = require("mongoose");
const { MONGO_URI } = require("./env");

console.log("MONGO_URI:", MONGO_URI ? "set" : "undefined");

const connectDB = async () =>{
    try{
        console.log("Attempting MongoDB connection...");
        console.log("URI starts with:", MONGO_URI ? MONGO_URI.substring(0, 20) : "none");
        
        const opts = {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };
        
        const connectWithTimeout = async () => {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Connection timeout")), 8000);
                mongoose.connect(MONGO_URI, opts)
                    .then(() => { clearTimeout(timeout); resolve(); })
                    .catch(err => { clearTimeout(timeout); reject(err); });
            });
        };
        
        await connectWithTimeout();
        console.log("MongoDB connected successfully");
    }catch(err){
        console.error("MongoDB connection failed:", err.message);
        console.error("Error name:", err.name);
        process.exit(1);
    }
}
module.exports = connectDB;