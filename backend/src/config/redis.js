const {createClient} = require("redis");
const {REDIS_URL} = require("./env");

const redisClient = createClient({
    url:REDIS_URL
});

redisClient.on("error",(err)=>{
    console.error("Redis Client Error",err);
})

const connectRedis = async()=>{
    await redisClient.connect();
    console.log("Connected to Redis successfully");
}
module.exports = {connectRedis,redisClient};