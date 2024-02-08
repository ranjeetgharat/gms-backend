const _logger = require('../logger/winston').logger;
const db = require('../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
var validator = require('validator');
const crypto = require('crypto');
const registrationModule = require('./registrationModule');
const cloudStorageModule = require('./cloudStorageModule');
var dateFormat = require('date-format');
const utils = require('../utilities/utils');
const { default: fetch } = require('cross-fetch');
const jws = require('jws');
const jwt = require('jsonwebtoken');

const preferences = {
    "payment_categories": ["upi", "card", "nb"],
    "allowed_bins": ["459150", "525211"]
};

const net_banking = {
    "showPopularBanks": "Y",
    "popularBanks": ["State Bank of India", "Kotak Bank", " AXIS Bank [Retail]"]
};

const jws_hmac = (payload) => {
    const signature = jws.sign({
        header: {
            alg: 'HS256',
            "clientid": process.env.BILL_DESK_CLIENTID,
        },
        payload: payload,
        secret: process.env.BILL_DESK_SECRETKEY,
    });

    /*const jwtOptions = {
        header: {
            alg: "HS256",
            clientid: process.env.BILL_DESK_CLIENTID,
        }
    }
    const signature = jwt.sign(payload, process.env.BILL_DESK_SECRETKEY, jwtOptions);*/

    return signature;
}

const create_order = async (payload, signature, traceid, timestamp) => {
    const resp = await fetch(process.env.BILL_DESK_URL + 'u2/payments/ve1_2/orders/create', {
        method: "POST",
        headers: {
            "Content-Type": "application/jose",
            "Accept": "application/jose",
            "BD-Traceid": traceid,
            "BD-Timestamp": timestamp,
        },
        body: signature,
    });
    return resp;
};


module.exports = {
    jws_hmac,
    create_order,
    preferences,
    net_banking,
};