const _logger = require('../logger/winston').logger;
const jwt = require('jsonwebtoken');
const { success } = require("../model/responseModel");
const adminService = require('../services/admin/adminService');
const { apiStatus } = require("../constants/apiStatus");

const verifyTokenAdmin = async (req, res, next) => {
    const accessToken = req.headers["x-access-token"];
    if (!accessToken) {
        return res.status(200).json(success(false, apiStatus.SESSION_EXPIRED, "Access token is required for authentication.", null));
    }
    try {
        const decoded = jwt.verify(accessToken, process.env.JWT_ACCESS_TOKEN_KEY);
        const authKey = req.headers["x-auth-key"];
        if (!authKey) {
            return res.status(200).json(success(false, apiStatus.SESSION_EXPIRED, "Auth key is required for authentication.", null));
        }
        const user_data = await adminService.token_data(authKey);

        if (!user_data || user_data.length <= 0) {
            return res.status(200).json(success(false, apiStatus.SESSION_EXPIRED, "Session is expired or invalid.", null));
        }
        if (user_data[0].is_deleted) {
            return res.status(200).json(success(false, apiStatus.SESSION_EXPIRED, "Your account does not exist.", null));
        }
        if (user_data[0].is_logout) {
            return res.status(200).json(success(false, apiStatus.SESSION_EXPIRED, "Session is expired or invalid.", null));
        }
        if (!user_data[0].is_master) {
            if (!user_data[0].is_enabled) {
                return res.status(200).json(success(false, apiStatus.SESSION_EXPIRED, "Your account has been blocked, contact system administrator.", null));
            }
        }
        req.token_data = user_data[0];
        req.token_data.auth_key = authKey;
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, "Unauthorized! Invalid access token.", null));
    }
    return next();
};

module.exports = verifyTokenAdmin;