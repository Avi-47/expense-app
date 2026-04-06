const {createClient} = require("redis");
const {REDIS_URL} = require("./env");

let _redisClient = null;

const getRedisClient = () => {
    if (!_redisClient) {
        if (!REDIS_URL) {
            console.log("Redis: REDIS_URL not set, skipping");
            return null;
        }
        _redisClient = createClient({
            url: REDIS_URL
        });
        _redisClient.on("error", (err) => {
            console.log("Redis error:", err.message);
        });
    }
    return _redisClient;
};

const connectRedis = async () => {
    if (!REDIS_URL) {
        console.log("Redis: REDIS_URL not set, skipping connection");
        return;
    }
    try {
        await getRedisClient().connect();
        console.log("Connected to Redis successfully");
    } catch (err) {
        console.log("Redis not available:", err.message);
    }
};

const redisClient = {
    get: async (key) => {
        if (!REDIS_URL) return null;
        try { return await getRedisClient().get(key); } catch { return null; }
    },
    set: async (key, value) => {
        if (!REDIS_URL) return null;
        try { return await getRedisClient().set(key, value); } catch { return null; }
    },
    hGet: async (key, field) => {
        if (!REDIS_URL) return null;
        try { return await getRedisClient().hGet(key, field); } catch { return null; }
    },
    hSet: async (key, field, value) => {
        if (!REDIS_URL) return null;
        try { return await getRedisClient().hSet(key, field, value); } catch { return null; }
    },
    hDel: async (key, ...fields) => {
        if (!REDIS_URL) return null;
        try { return await getRedisClient().hDel(key, ...fields); } catch { return null; }
    },
    hGetAll: async (key) => {
        if (!REDIS_URL) return {};
        try { return await getRedisClient().hGetAll(key); } catch { return {}; }
    }
};

module.exports = { connectRedis, getRedisClient, redisClient };