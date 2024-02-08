require("dotenv").config()
const { createClient } = require('redis');

console.log(process.env.REDIS_HOST);
const redisClient = createClient({
    socket: {
        port: process.env.REDIS_PORT,
        host: process.env.REDIS_HOST,
    }
});

module.exports = redisClient;