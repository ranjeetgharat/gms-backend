const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const redisDB = require('../../database/redis_cache_db');
var dateFormat = require('date-format');
const requestIp = require('request-ip');
const DeviceDetector = require('node-device-detector');
const detector = new DeviceDetector({ clientIndexes: true, deviceIndexes: true, deviceAliasCode: false, });
const adminUsersService = require('../admin/adminUsersService');
const { apiStatus } = require("../../constants/apiStatus");
const commonModule = require('../../modules/commonModule');

const login = async (req, res, next) => {
    const { user_name, password } = req.body;
    try {
        if (!user_name || user_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter username.", null));
        }
        if (!password || password.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter password.", null));
        }

        const _query1 = `SELECT admin_id, account_id, first_name, last_name, email_id, mobile_no, login_pass, is_master, is_enabled, role_id
        FROM adm_user WHERE email_id = TRIM(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [user_name], type: QueryTypes.SELECT });

        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid username or password.", null));
        }

        const isValidPass = await bcrypt.compare(password, row1[0].login_pass);

        if (!isValidPass) {
            return res.status(200).json(success(false, res.statusCode, "Invalid username or password.", null));
        }
        if (!row1[0].is_master) {
            if (!row1[0].is_enabled) {
                return res.status(200).json(success(false, res.statusCode, "Your account has been blocked, contact system administrator.", null));
            }
        }

        const jwtUser = { id: row1[0].admin_id, account_id: row1[0].account_id }

        const accessToken = jwt.sign(jwtUser, process.env.JWT_ACCESS_TOKEN_KEY,
            { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES) * 1000, }
        );
        const refreshToken = jwt.sign(jwtUser, process.env.JWT_REFRESH_TOKEN_KEY,
            { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRES) * 1000, }
        );

        var ip = ''; try { const clientIp = requestIp.getClientIp(req); ip = clientIp; } catch { }
        var user_agent = req.headers['user-agent'];
        var os_name = ''; try { const result = detector.detect(user_agent); os_name = result.os.name; } catch (e) { }
        const permissions = await commonModule.protean_user_permissions(row1[0].role_id);

        const _query2 = `INSERT INTO adm_token(admin_id, account_id, added_date, last_action, ip_address, is_logout, logout_time, user_agent)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING "token_id", "unique_id"`;
        const [row2] = await db.sequelize.query(_query2, {
            replacements: [row1[0].admin_id, row1[0].account_id, new Date(), new Date(), ip, false, null, user_agent],
            returning: true
        });
        //const token_id = (row2 && row2.length > 0 && row2[0] ? row2[0].token_id : 0);
        const unique_id = (row2 && row2.length > 0 && row2[0] ? row2[0].unique_id : "");
        if (parseInt(process.env.REDIS_ENABLED) > 0) {
            await redisDB.set(unique_id, refreshToken, { EX: process.env.REDIS_CACHE_EXPIRY });
        }
        const results = {
            first_name: row1[0].first_name,
            last_name: row1[0].last_name,
            email_id: row1[0].email_id,
            mobile_no: row1[0].mobile_no,
            api_auth_key: unique_id,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES),
            token_issued_at: dateFormat(process.env.DATE_FORMAT, new Date()),
            permissions: permissions,
        };
        res.setHeader('x-auth-key', unique_id);
        return res.status(200).json(success(true, res.statusCode, "Logged in successfully.", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const refresh_token = async (req, res, next) => {
    const authKey = req.headers["x-auth-key"];
    if (!authKey) {
        return res.status(200).json(success(false, res.statusCode, "Auth key is required for authentication.", null));
    }
    const { refresh_token } = req.body;
    try {
        if (!refresh_token || refresh_token.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid request.", null));
        }
        try {
            const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_TOKEN_KEY);
            const jwtUser = { id: decoded.id, account_id: decoded.account_id };

            const dbKey = await redisDB.get(authKey);

            if (dbKey && refresh_token === dbKey) {

                const accessToken = jwt.sign(jwtUser, process.env.JWT_ACCESS_TOKEN_KEY,
                    { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES) * 1000, }
                );
                const refreshToken = jwt.sign(jwtUser, process.env.JWT_REFRESH_TOKEN_KEY,
                    { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRES) * 1000, }
                );

                await redisDB.set(authKey, refreshToken, { EX: process.env.REDIS_CACHE_EXPIRY });

                const results = {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    token_expiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES),
                    token_issued_at: dateFormat(process.env.DATE_FORMAT, new Date()),
                };

                return res.status(200).json(success(true, res.statusCode, "Success.", results));

            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid request.", null));
            }
        } catch (err) {
            _logger.error(err.stack);
            return res.status(200).json(success(false, res.statusCode, "Invalid request.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const token_data = async (unique_id) => {
    const _query1 = `select t.token_id, t.admin_id, u.account_id, t.is_logout, u.is_enabled, u.is_deleted
    from adm_token t inner join adm_user u on t.admin_id = u.admin_id where t.unique_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [unique_id], type: QueryTypes.SELECT });
    return row1;
}

const logout = async (req, res, next) => {
    try {
        const auth_key = req.token_data.auth_key;
        const _query1 = `update adm_token set is_logout = ?, logout_time = ? where unique_id = ?`;
        await db.sequelize.query(_query1, { replacements: [true, new Date(), auth_key], type: QueryTypes.UPDATE });
        if (parseInt(process.env.REDIS_ENABLED) > 0) {
            await redisDB.del(auth_key);
        }
        return res.status(200).json(success(true, res.statusCode, "Logout successfully.", null));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const reset_pass_request = async (req, res, next) => {
    const { email_id } = req.body;
    try {
        const _query4 = `SELECT admin_id, is_activated FROM adm_user WHERE email_id = :email_id AND is_deleted = false`;
        const row4 = await db.sequelize.query(_query4, { replacements: { email_id: email_id }, type: QueryTypes.SELECT });
        if (row4 && row4.length > 0) {
            if (row4[0].is_activated && row4[0].is_activated == true) {
                const i = await adminUsersService.send_reset(row4[0].admin_id);
                if (i > 0) {
                    return res.status(200).json(success(true, res.statusCode, "Reset password link has been sent on your email address.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, "Reset password link sending failure, Please try again.", null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Your account is not yet activated, Please contact to administrator.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Email id is not registered with us.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const reset_pass_check = async (req, res, next) => {
    const { token } = req.body;
    try {
        if (!token || token.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid reset password link or expired.", null));
        }
        const uuid_decode = Buffer.from(decodeURIComponent(token), 'base64').toString('utf8');
        const row1 = await db.sequelize.query("SELECT * FROM adm_link_reset WHERE unique_id = ? AND is_used = ? ",
            { replacements: [uuid_decode, false], type: QueryTypes.SELECT });
        var token_idExists = (row1 && row1.length > 0) ? true : false;
        if (token_idExists) {
            var addMlSeconds = parseInt(process.env.RESET_LINK_EXPIRY) * 1000;
            var newDateObj = new Date(new Date(row1[0].sent_date).getTime() + addMlSeconds);
            if (newDateObj >= new Date()) {
                return res.status(200).json(success(true, res.statusCode, "Reset password link is valid.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid reset password link or expired.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Invalid reset password link or expired.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const reset_pass_update = async (req, res, next) => {
    const { token, password } = req.body;
    try {
        if (!token || token.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Invalid reset password link or expired.", null));
        }
        if (!password || password.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter password.", null));
        }
        if (password.length < 8) {
            return res.status(200).json(success(false, res.statusCode, "The password must contain atleast 8 characters.", null));
        }
        const hasNumber = /\d/;
        if (!hasNumber.test(password)) {
            return res.status(200).json(success(false, res.statusCode, "The password must contain a number.", null));
        }
        const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
        if (!specialChars.test(password)) {
            return res.status(200).json(success(false, res.statusCode, "The password must contain a special character.", null));
        }

        const uuid_decode = Buffer.from(decodeURIComponent(token), 'base64').toString('utf8')
        const row1 = await db.sequelize.query("SELECT * FROM adm_link_reset WHERE unique_id = ? AND is_used = ? ",
            { replacements: [uuid_decode, false], type: QueryTypes.SELECT });
        var token_idExists = (row1 && row1.length > 0) ? true : false;
        if (!token_idExists) {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Invalid reset password link or expired.", null));
        }
        var addMlSeconds = parseInt(process.env.RESET_LINK_EXPIRY) * 1000;
        var newDateObj = new Date(new Date(row1[0].sent_date).getTime() + addMlSeconds);
        if (newDateObj >= new Date()) {
            var password_hash = await bcrypt.hash(password, 10);

            const _query1 = `UPDATE adm_link_reset SET is_used = ?, used_date = ? WHERE unique_id = ?`;
            const _replacements2 = [true, new Date(), uuid_decode];
            const [, i] = await db.sequelize.query(_query1, { replacements: _replacements2, type: QueryTypes.UPDATE });

            const _query2 = `UPDATE adm_user SET login_pass = ? WHERE admin_id = ? AND is_deleted = false`;
            const [, j] = await db.sequelize.query(_query2, { replacements: [password_hash, row1[0].admin_id], type: QueryTypes.UPDATE });
            if (j > 0) {
                return res.status(200).json(success(true, res.statusCode, "Reset password successfully.", null));
            } else {
                return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Unable to reset password, Please try again.", null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Invalid reset password link or expired.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,err.message, null));
    }
};

const new_pass_check = async (req, res, next) => {
    const { token } = req.body;
    try {
        if (!token || token.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid activation link or expired.", null));
        }
        const uuid_decode = Buffer.from(decodeURIComponent(token), 'base64').toString('utf8')
        const row1 = await db.sequelize.query("SELECT * FROM adm_link_act WHERE unique_id = ? AND is_used = ? ",
            { replacements: [uuid_decode, false], type: QueryTypes.SELECT });
        var token_idExists = (row1 && row1.length > 0) ? true : false;
        if (token_idExists) {
            var addMlSeconds = parseInt(process.env.SET_PASS_LINK_EXPIRY) * 1000;
            var newDateObj = new Date(new Date(row1[0].sent_date).getTime() + addMlSeconds);
            if (newDateObj >= new Date()) {
                return res.status(200).json(success(true, res.statusCode, "Activation link is valid.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid reset password link or expired.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Invalid activation link or expired.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const new_pass_update = async (req, res, next) => {
    const { token, password } = req.body;
    try {
        if (!token || token.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Invalid activation link or expired.", null));
        }
        const uuid_decode = Buffer.from(decodeURIComponent(token), 'base64').toString('utf8')
        const row1 = await db.sequelize.query("SELECT * FROM adm_link_act WHERE unique_id = ? AND is_used = ?",
            { replacements: [uuid_decode, false], type: QueryTypes.SELECT });
        var token_idExists = (row1 && row1.length > 0) ? true : false;
        if (!token_idExists) {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Invalid activation link or expired.", null));
        }
        const _query01 = `SELECT is_activated FROM adm_user WHERE admin_id = ?`;
        const row01 = await db.sequelize.query(_query01, { replacements: [row1[0].admin_id], type: QueryTypes.SELECT });
        if (row01 && row01.length > 0) {
            if (row01[0].is_activated && row01[0].is_activated == true) {
                return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Account is already activated.", null));
            }

            if (!password || password.length <= 0) {
                return res.status(200).json(success(false, res.statusCode, "Please enter password.", null));
            }
            if (password.length < 8) {
                return res.status(200).json(success(false, res.statusCode, "The password must contain atleast 8 characters.", null));
            }
            const hasNumber = /\d/;
            if (!hasNumber.test(password)) {
                return res.status(200).json(success(false, res.statusCode, "The password must contain a number.", null));
            }
            const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
            if (!specialChars.test(password)) {
                return res.status(200).json(success(false, res.statusCode, "The password must contain a special character.", null));
            }

            var addMlSeconds = parseInt(process.env.SET_PASS_LINK_EXPIRY) * 1000;
            var newDateObj = new Date(new Date(row1[0].sent_date).getTime() + addMlSeconds);
            if (newDateObj >= new Date()) {
                var password_hash = await bcrypt.hash(password, 10);

                const _query1 = `UPDATE adm_link_act SET is_used = ?, used_date = ? WHERE unique_id = ?`;
                const _replacements2 = [true, new Date(), uuid_decode];
                await db.sequelize.query(_query1, { replacements: _replacements2, type: QueryTypes.UPDATE });

                const _query2 = `UPDATE adm_user SET login_pass = ?, is_activated = ? WHERE admin_id = ?`;
                const [, j] = await db.sequelize.query(_query2, { replacements: [password_hash, true, row1[0].admin_id], type: QueryTypes.UPDATE });

                if (j > 0) {
                    return res.status(200).json(success(true, res.statusCode, "Activated & new password updated successfully.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, "Unable to update password, Please try again.", null));
                }
            } else {
                return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Invalid activation link or expired.", null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,"Account details not found.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED,err.message, null));
    }
};

const dashboard = async (req, res, next) => {
    try {
        return res.status(200).json(success(true, res.statusCode, "Dashboard.", null));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const change_password = async (req, res, next) => {
    const { old_password, new_password, confirm_password } = req.body;
    try {
        if (!old_password || old_password.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter old password.", null));
        }
        if (!new_password || new_password.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter new password.", null));
        }
        if (!confirm_password || confirm_password.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter confirm password.", null));
        }
        if (new_password.length < 8) {
            return res.status(200).json(success(false, res.statusCode, "New password must contain atleast 8 characters.", null));
        }
        const hasNumber = /\d/;
        if (!hasNumber.test(new_password)) {
            return res.status(200).json(success(false, res.statusCode, "New password must contain a number.", null));
        }
        const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
        if (!specialChars.test(new_password)) {
            return res.status(200).json(success(false, res.statusCode, "New password must contain a special character.", null));
        }
        if (new_password != confirm_password) {
            return res.status(200).json(success(false, res.statusCode, "Confirm password mismatch.", null));
        }

        const row3 = await db.sequelize.query("SELECT login_pass FROM adm_user WHERE admin_id = ? AND is_deleted = false",
            { replacements: [req.token_data.admin_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Account details not found, Please try again.", null));
        }
        const isValidPass = await bcrypt.compare(old_password, row3[0].login_pass);
        if (isValidPass) {
            var password_hash = await bcrypt.hash(new_password, 10);

            const _query2 = `UPDATE adm_user SET login_pass = ? WHERE admin_id = ?`;
            const [, j] = await db.sequelize.query(_query2, { replacements: [password_hash, req.token_data.admin_id], type: QueryTypes.UPDATE });
            if (j > 0) {

                const _query5 = `UPDATE adm_token SET is_logout = true, logout_time = ? WHERE admin_id = ? AND token_id <> ? AND is_logout = false`;
                await db.sequelize.query(_query5, { replacements: [new Date(), req.token_data.admin_id, req.token_data.token_id], type: QueryTypes.UPDATE });

                return res.status(200).json(success(true, res.statusCode, "Password changed successfully.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Unable to change password, Please try again.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Please enter correct old password.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    login,
    refresh_token,
    token_data,
    logout,
    reset_pass_request,
    reset_pass_check,
    reset_pass_update,
    new_pass_check,
    new_pass_update,
    dashboard,
    change_password,
};
