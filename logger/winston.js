require("dotenv").config();
const path = require('path');
const winston = require('winston');
require('winston-mongodb');
const winstonRotator = require('winston-daily-rotate-file');
const { combine, timestamp, json } = winston.format;
const correlator = require('express-correlation-id');

const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: 'logs/%DATE%.log',
    datePattern: 'yyyy-MM-DD',
    maxFiles: '90d',
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        winston.format((data) => {
            data.correlation_id = correlator.getId();
            return data;
        })(),
        timestamp(),
        json()
    ),
    transports: [fileRotateTransport],
});

const log_request = winston.createLogger({
    format: combine(
        winston.format((data) => {
            return data;
        })(),
        timestamp(),
        json(),
    ),
    transports: [
        new winston.transports.MongoDB({
            db: process.env.MONGO_DB_URL, // Your MongoDB connection URI
            dbName: process.env.MONGO_DB_NAME,
            collection: 'RequestLog', // Name of the collection in MongoDB
            options: { useNewUrlParser: true, useUnifiedTopology: true },
        }),
    ],
});

const log_payment = winston.createLogger({
    format: combine(
        winston.format((data) => {
            return data;
        })(),
        timestamp(),
        json(),
    ),
    transports: [
        new winston.transports.MongoDB({
            db: process.env.MONGO_DB_URL, // Your MongoDB connection URI
            dbName: process.env.MONGO_DB_NAME,
            collection: 'PaymentLog', // Name of the collection in MongoDB
            options: { useNewUrlParser: true, useUnifiedTopology: true },
        }),
    ],
});

module.exports = { logger, log_request, log_payment };
