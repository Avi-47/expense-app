const {createClient} = require("redis");
const {REDIS_URL} = require("./env");

const redisClient = createClient({
    url: REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error",(err)=>{
    console.log("Redis error:", err.message);
})

const connectRedis = async()=>{
    try {
        await redisClient.connect();
        console.log("Connected to Redis successfully");
    } catch (err) {
        console.log("Redis not available:", err.message);
    }
}
module.exports = {connectRedis,redisClient};