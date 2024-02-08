const rateLimit = require("express-rate-limit");
const { success } = require("../model/responseModel");
const message = 'Too many requests. Please wait a while then try again.';

function limitHandler(req, res, /*next*/) {
    return res.status(200).json(success(false, 429, message, null));
};

const signUpRateLimit = rateLimit({
    windowMs: 1 * 1000,
    max: 1,
    headers: false,
    handler: limitHandler,
});

module.exports = { signUpRateLimit: signUpRateLimit };
