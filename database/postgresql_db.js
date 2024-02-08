require("dotenv").config()
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');

module.exports = db = {
    initialize
};

async function initialize() {
    const options = {
        dialect: 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        timezone: 'Asia/Kolkata',
        dialectOptions: { timezone: 'Asia/Kolkata', }
    };
    const sequelize = new Sequelize(options);
    
    db.sequelize = sequelize;
    await sequelize.authenticate();
    console.log('Database connected successfully.');
}