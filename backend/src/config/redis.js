const {createClient} = require("redis");
const {REDIS_URL} = require("./env");

let _redisClient = null;

const getRedisClient = () => {
    if (!_redisClient) {
        _redisClient = createClient({
            url: REDIS_URL || "redis://localhost:6379"
        });
        _redisClient.on("error", (err) => {
            console.log("Redis error:", err.message);
        });
    }
    return _redisClient;
};

const connectRedis = async () => {
    try {
        await getRedisClient().connect();
        console.log("Connected to Redis successfully");
    } catch (err) {
        console.log("Redis not available, continuing without it");
    }
};

const redisClient = {
    get: async (key) => {
        try { return await getRedisClient().get(key); } catch { return null; }
    },
    set: async (key, value) => {
        try { return await getRedisClient().set(key, value); } catch { return null; }
    },
    hGet: async (key, field) => {
        try { return await getRedisClient().hGet(key, field); } catch { return null; }
    },
    hSet: async (key, field, value) => {
        try { return await getRedisClient().hSet(key, field, value); } catch { return null; }
    },
    hDel: async (key, ...fields) => {
        try { return await getRedisClient().hDel(key, ...fields); } catch { return null; }
    },
    hGetAll: async (key) => {
        try { return await getRedisClient().hGetAll(key); } catch { return {}; }
    }
};

module.exports = { connectRedis, getRedisClient, redisClient };