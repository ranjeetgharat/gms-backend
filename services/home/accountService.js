const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
const requestIp = require('request-ip');
const DeviceDetector = require('node-device-detector');
const detector = new DeviceDetector({ clientIndexes: true, deviceIndexes: true, deviceAliasCode: false, });
var validator = require('validator');
const { apiStatus } = require('../../constants/apiStatus');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const redisDB = require('../../database/redis_cache_db');
var dateFormat = require('date-format');
const commonModule = require('../../modules/commonModule');
const utils = require('../../utilities/utils');
const constants = require('../../constants/constants');
const { emailTemplate, emailTags } = require('../../constants/emailConfig');
const emailer = require('../../utilities/emailer');
const { smsTemplate, smsTags } = require('../../constants/smsConfig');
const sms_sender = require('../../utilities/sms_sender');
const entityDataModule = require('../../modules/entityDataModule');



const entities = async (req, res, next) => {
    try {
        var entities = [];
        const _query2 = `SELECT entity_id, entity_name FROM entity_type ORDER BY entity_id`;
        const row2 = await db.sequelize.query(_query2, { type: QueryTypes.SELECT });
        for (let i = 0; row2 && i < row2.length; i++) {
            entities.push({
                entity_id: row2[i].entity_id,
                entity_name: row2[i].entity_name,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", entities));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const login = async (req, res, next) => {
    const { entity_id, email_id, password } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        if (_entity_id <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select profile type.", null));
        }
        if (!email_id || email_id.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter email id/mobile no.", null));
        }
        if (!password || password.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter password.", null));
        }
        const _query001 = `SELECT entity_id, entity_name FROM entity_type WHERE entity_id = ?`;
        const row001 = await db.sequelize.query(_query001, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row001 || row001.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid profile type.", null));
        }

        const _query1 = `SELECT a.user_id, a.account_id, a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, a.login_pass, a.is_enabled, a.is_activated,
        a.reg_id, a.is_admin, a.role_id, a.re_activation_required, u.entity_id, u.is_enabled AS entity_enabled, u.approve_status, u.company_name
        FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE a.is_deleted = false AND u.is_deleted = false AND 
        (
            (LENGTH(COALESCE(a.email_id, '')) > 0 AND a.email_id = TRIM(:email_id)) 
            OR
            (LENGTH(COALESCE(a.mobile_no, '')) > 0 AND a.mobile_no = TRIM(:email_id))
        )`;
        const row1 = await db.sequelize.query(_query1, { replacements: { email_id: email_id }, type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid email id or password.", null));
        }
        var _entity_idTmp = row1[0].entity_id && validator.isNumeric(row1[0].entity_id.toString()) ? BigInt(row1[0].entity_id) : 0;
        if (_entity_idTmp != _entity_id) {
            return res.status(200).json(success(false, res.statusCode, "Invalid email id or password.", null));
        }
        var entity_enabled = row1[0].entity_enabled && row1[0].entity_enabled == true ? true : false;
        if (!entity_enabled) {
            return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is currently suspended.", null));
        }
        var _approve_status = row1[0].approve_status && validator.isNumeric(row1[0].approve_status.toString()) ? parseInt(row1[0].approve_status) : 0;
        if (_approve_status != 1) {
            return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is not approved.", null));
        }
        var re_activation_required = row1[0].re_activation_required && row1[0].re_activation_required == true ? true : false;
        if (re_activation_required) {
            return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account requires reactivation.", null));
        }
        var is_activated = row1[0].is_activated && row1[0].is_activated == true ? true : false;
        if (!is_activated) {
            return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account is not activated.", null));
        }
        const is_admin = row1[0].is_admin && row1[0].is_admin == true ? true : false;
        const _role_id = row1[0].role_id && validator.isNumeric(row1[0].role_id.toString()) ? BigInt(row1[0].role_id) : 0;
        if (!is_admin) {
            const roleStatus = await entityDataModule.uam_role_login_status(_role_id);
            if (roleStatus <= 0) {
                const msg = roleStatus == -1 ? 'Your account role is currently disabled.' : 'Your account role details are not found.';
                return res.status(200).json(success(false, res.statusCode, msg, null));
            }
        }

        var is_enabled = row1[0].is_enabled && row1[0].is_enabled == true ? true : false;
        if (!is_enabled) {
            return res.status(200).json(success(false, res.statusCode, "Your account is currently suspended.", null));
        }
        const _login_pass = (row1[0].login_pass && row1[0].login_pass.length > 0) ? row1[0].login_pass : "";
        if (_login_pass.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "You didn't update login password, Please reset your password.", null));
        }

        const isValidPass = await bcrypt.compare(password, row1[0].login_pass);

        if (!isValidPass) {
            return res.status(200).json(success(false, res.statusCode, "Invalid email id or password.", null));
        }

        const jwtUser = { id: row1[0].user_id, account_id: row1[0].account_id }

        const accessToken = jwt.sign(jwtUser, process.env.JWT_ACCESS_TOKEN_KEY,
            { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES) * 1000, }
        );
        const refreshToken = jwt.sign(jwtUser, process.env.JWT_REFRESH_TOKEN_KEY,
            { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRES) * 1000, }
        );

        var ip = ''; try { const clientIp = requestIp.getClientIp(req); ip = clientIp; } catch { }
        var user_agent = req.headers['user-agent'];
        var os_name = ''; try { const result = detector.detect(user_agent); os_name = result.os.name; } catch (e) { }
        const permissions = await commonModule.entity_permissions(_entity_id, row1[0].reg_id, is_admin, _role_id);

        const _query2 = `INSERT INTO user_token(user_id, account_id, added_date, last_action, ip_address, is_logout, logout_time, user_agent, permissions)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING "token_id", "unique_id"`;
        const [row2] = await db.sequelize.query(_query2, {
            replacements: [row1[0].user_id, row1[0].account_id, new Date(), new Date(), ip, false, null, user_agent, JSON.stringify(permissions)], returning: true
        });
        //const token_id = (row2 && row2.length > 0 && row2[0] ? row2[0].token_id : 0);
        const unique_id = (row2 && row2.length > 0 && row2[0] ? row2[0].unique_id : "");
        if (parseInt(process.env.REDIS_ENABLED) > 0) {
            await redisDB.set(unique_id, refreshToken, { EX: process.env.REDIS_CACHE_EXPIRY });
        }
        const results = {
            entity_id: _entity_idTmp,
            entity_name: row001[0].entity_name,
            first_name: row1[0].first_name,
            last_name: row1[0].last_name,
            email_id: row1[0].email_id,
            mobile_no: row1[0].mobile_no,
            company_name: row1[0].company_name,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES),
            token_issued_at: dateFormat(process.env.DATE_FORMAT, new Date()),
            permissions: permissions,
        };
        res.header("Access-Control-Expose-Headers", "x-auth-key");
        res.setHeader('x-auth-key', unique_id);
        return res.status(200).json(success(true, res.statusCode, "Logged in successfully.", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const login_otp_get = async (req, res, next) => {
    const { entity_id, email_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        if (_entity_id <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select profile type.", null));
        }
        if (!email_id || email_id.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter email id/mobile no.", null));
        }

        const _query001 = `SELECT entity_id, entity_name FROM entity_type WHERE entity_id = ?`;
        const row001 = await db.sequelize.query(_query001, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row001 || row001.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid profile type.", null));
        }

        const _query1 = `SELECT a.user_id, a.account_id, a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, a.login_pass, a.is_enabled, a.is_activated,
        a.reg_id, a.is_admin, a.role_id, a.re_activation_required, u.entity_id, u.is_enabled AS entity_enabled, u.approve_status
        FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE a.is_deleted = false AND u.is_deleted = false AND 
        (
            (LENGTH(COALESCE(a.email_id, '')) > 0 AND a.email_id = TRIM(:email_id)) 
            OR
            (LENGTH(COALESCE(a.mobile_no, '')) > 0 AND a.mobile_no = TRIM(:email_id))
        )`;
        const row1 = await db.sequelize.query(_query1, { replacements: { email_id: email_id }, type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid email id/mobile no.", null));
        }
        var _entity_idTmp = row1[0].entity_id && validator.isNumeric(row1[0].entity_id.toString()) ? BigInt(row1[0].entity_id) : 0;
        if (_entity_idTmp != _entity_id) {
            return res.status(200).json(success(false, res.statusCode, "Invalid email id/mobile no.", null));
        }
        var entity_enabled = row1[0].entity_enabled && row1[0].entity_enabled == true ? true : false;
        if (!entity_enabled) {
            return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is currently suspended.", null));
        }
        var _approve_status = row1[0].approve_status && validator.isNumeric(row1[0].approve_status.toString()) ? parseInt(row1[0].approve_status) : 0;
        if (_approve_status != 1) {
            return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is not approved.", null));
        }
        var re_activation_required = row1[0].re_activation_required && row1[0].re_activation_required == true ? true : false;
        if (re_activation_required) {
            return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account requires reactivation.", null));
        }
        var is_activated = row1[0].is_activated && row1[0].is_activated == true ? true : false;
        if (!is_activated) {
            return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account is not activated.", null));
        }
        const is_admin = row1[0].is_admin && row1[0].is_admin == true ? true : false;
        const _role_id = row1[0].role_id && validator.isNumeric(row1[0].role_id.toString()) ? BigInt(row1[0].role_id) : 0;
        if (!is_admin) {
            const roleStatus = await entityDataModule.uam_role_login_status(_role_id);
            if (roleStatus <= 0) {
                const msg = roleStatus == -1 ? 'Your account role is currently disabled.' : 'Your account role details are not found.';
                return res.status(200).json(success(false, res.statusCode, msg, null));
            }
        }

        var is_enabled = row1[0].is_enabled && row1[0].is_enabled == true ? true : false;
        if (!is_enabled) {
            return res.status(200).json(success(false, res.statusCode, "Your account is currently suspended.", null));
        }

        var ip = ''; try { const clientIp = requestIp.getClientIp(req); ip = clientIp; } catch { }
        var user_agent = req.headers['user-agent'];
        var os_name = ''; try { const result = detector.detect(user_agent); os_name = result.os.name; } catch (e) { }

        const otp_code = utils.random_int(constants.otp_length).toString();

        const _query2 = `INSERT INTO user_login_otp(user_id, otp_code, sent_date, ip_address, user_agent)
                         VALUES (?, ?, ?, ?, ?) RETURNING "otp_id", "unique_id"`;
        const [row2] = await db.sequelize.query(_query2, {
            replacements: [row1[0].user_id, otp_code, new Date(), ip, user_agent], returning: true
        });

        const otp_id = (row2 && row2.length > 0 && row2[0] ? row2[0].otp_id : 0);
        const unique_id = (row2 && row2.length > 0 && row2[0] ? row2[0].unique_id : "");
        if (otp_id > 0) {
            var full_name_array = [];
            if (row1[0].first_name && row1[0].first_name.length > 0) { full_name_array.push(row1[0].first_name); }
            if (row1[0].middle_name && row1[0].middle_name.length > 0) { full_name_array.push(row1[0].middle_name); }
            if (row1[0].last_name && row1[0].last_name.length > 0) { full_name_array.push(row1[0].last_name); }

            const stmp = await commonModule.sms_template_get(smsTemplate.ENTITY_LOGIN_WITH_OTP);
            const etmp = await commonModule.email_template_get(emailTemplate.ENTITY_LOGIN_WITH_OTP);
            if (stmp && stmp.is_enabled) {
                var sms_text = stmp.message_text && stmp.message_text.length > 0 ? stmp.message_text : "";

                sms_text = sms_text.replaceAll(smsTags.ENTITY_TYPE, row001[0].entity_name);
                sms_text = sms_text.replaceAll(smsTags.OTP_CODE, otp_code);
                sms_text = sms_text.replaceAll(smsTags.FIRST_NAME, row1[0].first_name);
                sms_text = sms_text.replaceAll(smsTags.MIDDLE_NAME, row1[0].middle_name);
                sms_text = sms_text.replaceAll(smsTags.LAST_NAME, row1[0].last_name);
                sms_text = sms_text.replaceAll(smsTags.FULL_NAME, full_name_array.join(' '));
                sms_text = sms_text.replaceAll(smsTags.EMAIL_ID, row1[0].email_id);
                sms_text = sms_text.replaceAll(smsTags.MOBILE_NO, row1[0].mobile_no);

                var sms_success = false;
                try {
                    await sms_sender.send(smsTemplate.ENTITY_LOGIN_WITH_OTP, row1[0].mobile_no, sms_text);
                    sms_success = true;
                } catch (err) {
                    _logger.error(err.stack);
                }
            }
            if (etmp && etmp.is_enabled) {
                var mail_subject = etmp.subject && etmp.subject.length > 0 ? etmp.subject : "";
                var mail_body_text = etmp.body_text && etmp.body_text.length > 0 ? etmp.body_text : "";

                mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                mail_subject = mail_subject.replaceAll(emailTags.ENTITY_TYPE, row001[0].entity_name);
                mail_subject = mail_subject.replaceAll(emailTags.OTP_CODE, otp_code);
                mail_subject = mail_subject.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                mail_subject = mail_subject.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                mail_subject = mail_subject.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                mail_subject = mail_subject.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                mail_subject = mail_subject.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);

                mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                mail_body_text = mail_body_text.replaceAll(emailTags.ENTITY_TYPE, row001[0].entity_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.OTP_CODE, otp_code);
                mail_body_text = mail_body_text.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                mail_body_text = mail_body_text.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);

                var mailOptions = {
                    from: process.env.MAIL_SENDER, to: row1[0].email_id, subject: mail_subject, html: mail_body_text,
                }
                var mail_success = false;
                try {
                    await emailer.sendMail(mailOptions);
                    mail_success = true;
                } catch (err) {
                    _logger.error(err.stack);
                }
            }
            res.header("Access-Control-Expose-Headers", "x-otp-key");
            res.setHeader('x-otp-key', unique_id);
            return res.status(200).json(success(true, res.statusCode, "OTP sent successfully.", {
                mobile_no: row1[0].mobile_no,
                email_id: row1[0].email_id,
            }));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add otp record, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const login_otp_resend = async (req, res, next) => {
    const { otp_key } = req.body;
    try {
        const _otp_key = (otp_key && otp_key.length > 0) ? otp_key.trim() : "";
        if (_otp_key.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "OTP key is missing.", null));
        }
        const _query41 = `SELECT otp_id, user_id, otp_code, sent_date, resent_count FROM user_login_otp WHERE unique_id = ? AND is_used = false`;
        const row41 = await db.sequelize.query(_query41, { replacements: [_otp_key], type: QueryTypes.SELECT });
        if (!row41 || row41.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid OTP key.", null));
        }
        var resent_count = row41[0].resent_count && validator.isNumeric(row41[0].resent_count.toString()) ? BigInt(row41[0].resent_count) : 0;
        if (resent_count >= 2) {
            return res.status(200).json(success(false, res.statusCode, "You have exhausted resend limit.", null));
        }

        var addMlSeconds = parseInt(process.env.LOGIN_WIH_OTP_EXPIRY) * 1000;
        var newDateObj = new Date(new Date(row41[0].sent_date).getTime() + addMlSeconds);
        if (newDateObj >= new Date()) {
            const _query1 = `SELECT a.user_id, a.account_id, a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, a.login_pass, a.is_enabled, a.is_activated,
            a.reg_id, a.is_admin, a.role_id, a.re_activation_required, u.entity_id, u.is_enabled AS entity_enabled, u.approve_status
            FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id 
            WHERE a.is_deleted = false AND u.is_deleted = false AND a.user_id = :user_id`;
            const row1 = await db.sequelize.query(_query1, { replacements: { user_id: row41[0].user_id }, type: QueryTypes.SELECT });
            if (!row1 || row1.length <= 0) {
                return res.status(200).json(success(false, res.statusCode, "Account details not found, Please try again.", null));
            }
            var _entity_id = row1[0].entity_id && validator.isNumeric(row1[0].entity_id.toString()) ? BigInt(row1[0].entity_id) : 0;
            const _query001 = `SELECT entity_id, entity_name FROM entity_type WHERE entity_id = ?`;
            const row001 = await db.sequelize.query(_query001, { replacements: [_entity_id], type: QueryTypes.SELECT });
            if (!row001 || row001.length <= 0) {
                return res.status(200).json(success(false, res.statusCode, "Profile details not found, Please try again.", null));
            }
            var entity_enabled = row1[0].entity_enabled && row1[0].entity_enabled == true ? true : false;
            if (!entity_enabled) {
                return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is currently suspended.", null));
            }
            var _approve_status = row1[0].approve_status && validator.isNumeric(row1[0].approve_status.toString()) ? parseInt(row1[0].approve_status) : 0;
            if (_approve_status != 1) {
                return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is not approved.", null));
            }
            var re_activation_required = row1[0].re_activation_required && row1[0].re_activation_required == true ? true : false;
            if (re_activation_required) {
                return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account requires reactivation.", null));
            }
            var is_activated = row1[0].is_activated && row1[0].is_activated == true ? true : false;
            if (!is_activated) {
                return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account is not activated.", null));
            }
            const is_admin = row1[0].is_admin && row1[0].is_admin == true ? true : false;
            const _role_id = row1[0].role_id && validator.isNumeric(row1[0].role_id.toString()) ? BigInt(row1[0].role_id) : 0;
            if (!is_admin) {
                const roleStatus = await entityDataModule.uam_role_login_status(_role_id);
                if (roleStatus <= 0) {
                    const msg = roleStatus == -1 ? 'Your account role is currently disabled.' : 'Your account role details are not found.';
                    return res.status(200).json(success(false, res.statusCode, msg, null));
                }
            }

            var is_enabled = row1[0].is_enabled && row1[0].is_enabled == true ? true : false;
            if (!is_enabled) {
                return res.status(200).json(success(false, res.statusCode, "Your account is currently suspended.", null));
            }
            const _query2 = `UPDATE user_login_otp SET resent_count = COALESCE(resent_count, 0) + 1 WHERE otp_id = ?`;
            const [, i] = await db.sequelize.query(_query2, { replacements: [row41[0].otp_id], type: QueryTypes.UPDATE });
            if (i > 0) {
                const otp_code = row41[0].otp_code;
                var full_name_array = [];
                if (row1[0].first_name && row1[0].first_name.length > 0) { full_name_array.push(row1[0].first_name); }
                if (row1[0].middle_name && row1[0].middle_name.length > 0) { full_name_array.push(row1[0].middle_name); }
                if (row1[0].last_name && row1[0].last_name.length > 0) { full_name_array.push(row1[0].last_name); }

                const stmp = await commonModule.sms_template_get(smsTemplate.ENTITY_LOGIN_WITH_OTP);
                const etmp = await commonModule.email_template_get(emailTemplate.ENTITY_LOGIN_WITH_OTP);
                if (stmp && stmp.is_enabled) {
                    var sms_text = stmp.message_text && stmp.message_text.length > 0 ? stmp.message_text : "";
                    sms_text = sms_text.replaceAll(smsTags.ENTITY_TYPE, row001[0].entity_name);
                    sms_text = sms_text.replaceAll(smsTags.OTP_CODE, otp_code);
                    sms_text = sms_text.replaceAll(smsTags.FIRST_NAME, row1[0].first_name);
                    sms_text = sms_text.replaceAll(smsTags.MIDDLE_NAME, row1[0].middle_name);
                    sms_text = sms_text.replaceAll(smsTags.LAST_NAME, row1[0].last_name);
                    sms_text = sms_text.replaceAll(smsTags.FULL_NAME, full_name_array.join(' '));
                    sms_text = sms_text.replaceAll(smsTags.EMAIL_ID, row1[0].email_id);
                    sms_text = sms_text.replaceAll(smsTags.MOBILE_NO, row1[0].mobile_no);

                    var sms_success = false;
                    try {
                        await sms_sender.send(smsTemplate.ENTITY_LOGIN_WITH_OTP, row1[0].mobile_no, sms_text);
                        sms_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }
                }

                if (etmp && etmp.is_enabled) {
                    var mail_subject = etmp.subject && etmp.subject.length > 0 ? etmp.subject : "";
                    var mail_body_text = etmp.body_text && etmp.body_text.length > 0 ? etmp.body_text : "";

                    mail_subject = mail_subject.replaceAll(emailTags.ENTITY_TYPE, row001[0].entity_name);
                    mail_subject = mail_subject.replaceAll(emailTags.OTP_CODE, otp_code);
                    mail_subject = mail_subject.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                    mail_subject = mail_subject.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                    mail_subject = mail_subject.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                    mail_subject = mail_subject.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                    mail_subject = mail_subject.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                    mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);

                    mail_body_text = mail_body_text.replaceAll(emailTags.ENTITY_TYPE, row001[0].entity_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.OTP_CODE, otp_code);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);

                    var mailOptions = {
                        from: process.env.MAIL_SENDER, to: row1[0].email_id, subject: mail_subject, html: mail_body_text,
                    }
                    var mail_success = false;
                    try {
                        await emailer.sendMail(mailOptions);
                        mail_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }
                }

                return res.status(200).json(success(true, res.statusCode, "OTP resent successfully.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Unable to update resend count, Please try again.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "OTP time limit is expired.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const login_otp_check = async (req, res, next) => {
    const { otp_key, otp_code } = req.body;
    try {
        const _otp_key = (otp_key && otp_key.length > 0) ? otp_key.trim() : "";
        if (_otp_key.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "OTP key is missing.", null));
        }
        const _otp_code = (otp_code && otp_code.length > 0) ? otp_code.trim() : "";
        if (_otp_code.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter OTP code.", null));
        }
        const _query41 = `SELECT otp_id, user_id, otp_code, sent_date FROM user_login_otp WHERE unique_id = ? AND is_used = false`;
        const row41 = await db.sequelize.query(_query41, { replacements: [_otp_key], type: QueryTypes.SELECT });
        if (!row41 || row41.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid OTP key.", null));
        }
        var addMlSeconds = parseInt(process.env.LOGIN_WIH_OTP_EXPIRY) * 1000;
        var newDateObj = new Date(new Date(row41[0].sent_date).getTime() + addMlSeconds);
        if (newDateObj >= new Date()) {
            if (_otp_code == row41[0].otp_code) {
                const _query1 = `SELECT a.user_id, a.account_id, a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, a.login_pass, a.is_enabled, a.is_activated,
                a.reg_id, a.is_admin, a.role_id, a.re_activation_required, u.entity_id, u.is_enabled AS entity_enabled, u.approve_status, u.company_name
                FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id 
                WHERE a.is_deleted = false AND u.is_deleted = false AND a.user_id = :user_id`;
                const row1 = await db.sequelize.query(_query1, { replacements: { user_id: row41[0].user_id }, type: QueryTypes.SELECT });
                if (!row1 || row1.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Account details not found, Please try again.", null));
                }
                var _entity_id = row1[0].entity_id && validator.isNumeric(row1[0].entity_id.toString()) ? BigInt(row1[0].entity_id) : 0;
                const _query001 = `SELECT entity_id, entity_name FROM entity_type WHERE entity_id = ?`;
                const row001 = await db.sequelize.query(_query001, { replacements: [_entity_id], type: QueryTypes.SELECT });
                if (!row001 || row001.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Profile details not found, Please try again.", null));
                }
                var entity_enabled = row1[0].entity_enabled && row1[0].entity_enabled == true ? true : false;
                if (!entity_enabled) {
                    return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is currently suspended.", null));
                }
                var _approve_status = row1[0].approve_status && validator.isNumeric(row1[0].approve_status.toString()) ? parseInt(row1[0].approve_status) : 0;
                if (_approve_status != 1) {
                    return res.status(200).json(success(false, res.statusCode, "Your registration of " + row001[0].entity_name + " is not approved.", null));
                }
                var re_activation_required = row1[0].re_activation_required && row1[0].re_activation_required == true ? true : false;
                if (re_activation_required) {
                    return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account requires reactivation.", null));
                }
                var is_activated = row1[0].is_activated && row1[0].is_activated == true ? true : false;
                if (!is_activated) {
                    return res.status(200).json(success(false, apiStatus.ACCOUNT_NOT_ACTIVATED, "Your account is not activated.", null));
                }
                const is_admin = row1[0].is_admin && row1[0].is_admin == true ? true : false;
                const _role_id = row1[0].role_id && validator.isNumeric(row1[0].role_id.toString()) ? BigInt(row1[0].role_id) : 0;
                if (!is_admin) {
                    const roleStatus = await entityDataModule.uam_role_login_status(_role_id);
                    if (roleStatus <= 0) {
                        const msg = roleStatus == -1 ? 'Your account role is currently disabled.' : 'Your account role details are not found.';
                        return res.status(200).json(success(false, res.statusCode, msg, null));
                    }
                }

                var is_enabled = row1[0].is_enabled && row1[0].is_enabled == true ? true : false;
                if (!is_enabled) {
                    return res.status(200).json(success(false, res.statusCode, "Your account is currently suspended.", null));
                }
                const _query255 = `UPDATE user_login_otp SET is_used = true, used_date = ? WHERE otp_id = ?`;
                const [, i] = await db.sequelize.query(_query255, { replacements: [new Date(), row41[0].otp_id], type: QueryTypes.UPDATE });
                if (i > 0) {

                    const jwtUser = { id: row1[0].user_id, account_id: row1[0].account_id }

                    const accessToken = jwt.sign(jwtUser, process.env.JWT_ACCESS_TOKEN_KEY,
                        { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES) * 1000, }
                    );
                    const refreshToken = jwt.sign(jwtUser, process.env.JWT_REFRESH_TOKEN_KEY,
                        { algorithm: 'HS256', allowInsecureKeySizes: true, expiresIn: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRES) * 1000, }
                    );

                    var ip = ''; try { const clientIp = requestIp.getClientIp(req); ip = clientIp; } catch { }
                    var user_agent = req.headers['user-agent'];
                    var os_name = ''; try { const result = detector.detect(user_agent); os_name = result.os.name; } catch (e) { }
                    const permissions = await commonModule.entity_permissions(_entity_id, row1[0].reg_id, is_admin, _role_id);

                    const _query2 = `INSERT INTO user_token(user_id, account_id, added_date, last_action, ip_address, is_logout, logout_time, user_agent, permissions)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING "token_id", "unique_id"`;
                    const [row2] = await db.sequelize.query(_query2, {
                        replacements: [row1[0].user_id, row1[0].account_id, new Date(), new Date(), ip, false, null, user_agent, JSON.stringify(permissions)], returning: true
                    });
                    //const token_id = (row2 && row2.length > 0 && row2[0] ? row2[0].token_id : 0);
                    const unique_id = (row2 && row2.length > 0 && row2[0] ? row2[0].unique_id : "");
                    if (parseInt(process.env.REDIS_ENABLED) > 0) {
                        await redisDB.set(unique_id, refreshToken, { EX: process.env.REDIS_CACHE_EXPIRY });
                    }
                    const results = {
                        entity_id: _entity_id,
                        entity_name: row001[0].entity_name,
                        first_name: row1[0].first_name,
                        last_name: row1[0].last_name,
                        email_id: row1[0].email_id,
                        mobile_no: row1[0].mobile_no,
                        company_name: row1[0].company_name,
                        access_token: accessToken,
                        refresh_token: refreshToken,
                        token_expiry: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES),
                        token_issued_at: dateFormat(process.env.DATE_FORMAT, new Date()),
                        permissions: permissions,
                    };
                    res.header("Access-Control-Expose-Headers", "x-auth-key");
                    res.setHeader('x-auth-key', unique_id);
                    return res.status(200).json(success(true, res.statusCode, "Logged in successfully.", results));
                } else {
                    return res.status(200).json(success(false, res.statusCode, "Unable to update otp record, Please try again.", null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid OTP code.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "OTP time limit is expired.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const token_data = async (unique_id) => {
    const _query1 = `select t.token_id, t.user_id, u.account_id, t.is_logout, u.is_enabled, u.is_deleted, t.permissions
    from user_token t inner join user_account u on t.user_id = u.user_id where t.unique_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [unique_id], type: QueryTypes.SELECT });
    return row1;
};

const reset_pass_request = async (req, res, next) => {
    const { entity_id, email_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        if (_entity_id <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select entity type.", null));
        }
        if (!email_id || email_id.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter email id.", null));
        }

        const _query4 = `SELECT a.user_id, a.account_id, a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, a.login_pass, a.is_enabled, a.is_activated,
        u.entity_id, u.is_enabled AS entity_enabled, u.approve_status
        FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE a.is_deleted = false AND u.is_deleted = false AND 
        (
            (LENGTH(COALESCE(a.email_id, '')) > 0 AND a.email_id = TRIM(:email_id)) 
            OR
            (LENGTH(COALESCE(a.mobile_no, '')) > 0 AND a.mobile_no = TRIM(:email_id))
        )`;
        const row4 = await db.sequelize.query(_query4, { replacements: { email_id: email_id }, type: QueryTypes.SELECT });
        if (row4 && row4.length > 0) {
            var _entity_idTmp = row4[0].entity_id && validator.isNumeric(row4[0].entity_id.toString()) ? BigInt(row4[0].entity_id) : 0;
            if (_entity_idTmp != _entity_id) {
                return res.status(200).json(success(false, res.statusCode, "Email id is not registered with selected entity.", null));
            }
            var _approve_status = row4[0].approve_status && validator.isNumeric(row4[0].approve_status.toString()) ? parseInt(row4[0].approve_status) : 0;
            if (_approve_status != 1) {
                return res.status(200).json(success(false, res.statusCode, "Your entity is not approved yet.", null));
            }
            if (row4[0].is_activated && row4[0].is_activated == true) {
                const i = await commonModule.send_entity_user_reset(row4[0].user_id);
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
        const row1 = await db.sequelize.query("SELECT * FROM user_link_reset WHERE unique_id = ? AND is_used = ? ",
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
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Invalid reset password link or expired.", null));
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
        const row1 = await db.sequelize.query("SELECT * FROM user_link_reset WHERE unique_id = ? AND is_used = ? ",
            { replacements: [uuid_decode, false], type: QueryTypes.SELECT });
        var token_idExists = (row1 && row1.length > 0) ? true : false;
        if (!token_idExists) {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Invalid reset password link or expired.", null));
        }
        var addMlSeconds = parseInt(process.env.RESET_LINK_EXPIRY) * 1000;
        var newDateObj = new Date(new Date(row1[0].sent_date).getTime() + addMlSeconds);
        if (newDateObj >= new Date()) {
            var password_hash = await bcrypt.hash(password, 10);

            const transaction = await db.sequelize.transaction();

            const _query1 = `UPDATE user_link_reset SET is_used = ?, used_date = ? WHERE unique_id = ?`;
            const _replacements2 = [true, new Date(), uuid_decode];
            const [, i] = await db.sequelize.query(_query1, { replacements: _replacements2, type: QueryTypes.UPDATE });

            const _query2 = `UPDATE user_account SET login_pass = ? WHERE user_id = ? AND is_deleted = false`;
            const [, j] = await db.sequelize.query(_query2, { replacements: [password_hash, row1[0].user_id], type: QueryTypes.UPDATE });
            if (j > 0) {
                await transaction.commit();
                return res.status(200).json(success(true, res.statusCode, "Reset password successfully.", null));
            } else {
                await transaction.rollback();
                return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Unable to reset password, Please try again.", null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Invalid reset password link or expired.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, err.message, null));
    }
};

const new_pass_check = async (req, res, next) => {
    const { token } = req.body;
    try {
        if (!token || token.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid activation link or expired.", null));
        }
        const uuid_decode = Buffer.from(decodeURIComponent(token), 'base64').toString('utf8');
        const row1 = await db.sequelize.query("SELECT * FROM user_link_act WHERE unique_id = ? AND is_used = ? ",
            { replacements: [uuid_decode, false], type: QueryTypes.SELECT });
        var token_idExists = (row1 && row1.length > 0) ? true : false;
        if (token_idExists) {
            var addMlSeconds = parseInt(process.env.SET_PASS_LINK_EXPIRY) * 1000;
            var newDateObj = new Date(new Date(row1[0].sent_date).getTime() + addMlSeconds);
            if (newDateObj >= new Date()) {
                const _queryAccGet = `SELECT email_id, mobile_no FROM user_account WHERE user_id = ? AND is_deleted = false`;
                const rowAccGet = await db.sequelize.query(_queryAccGet, { replacements: [row1[0].user_id], type: QueryTypes.SELECT });
                if (rowAccGet && rowAccGet.length > 0) {
                    const sameEmailID = (rowAccGet[0].email_id.trim().toLowerCase() == row1[0].email_id.trim().toLowerCase() ? true : false);
                    const sameMobileNo = (rowAccGet[0].mobile_no.trim().toLowerCase() == row1[0].mobile_no.trim().toLowerCase() ? true : false);
                    const changeCred = (sameEmailID && sameMobileNo ? false : true);
                    if (changeCred) {
                        return res.status(200).json(success(false, res.statusCode, "Account credentials have been changed. Please try using the new activation link.", null));
                    }
                    return res.status(200).json(success(true, res.statusCode, "Activation link is valid.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, "Account details not found, Please try again.", null));
                }
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
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Invalid activation link or expired.", null));
        }
        const uuid_decode = Buffer.from(decodeURIComponent(token), 'base64').toString('utf8');
        const row1 = await db.sequelize.query("SELECT * FROM user_link_act WHERE unique_id = ? AND is_used = ?",
            { replacements: [uuid_decode, false], type: QueryTypes.SELECT });
        var token_idExists = (row1 && row1.length > 0) ? true : false;
        if (!token_idExists) {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Invalid activation link or expired.", null));
        }
        const _query01 = `SELECT u.approve_status, a.is_activated, a.email_id, a.mobile_no FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id 
        WHERE a.user_id = ? AND a.is_deleted = false AND u.is_deleted = false`;
        const row01 = await db.sequelize.query(_query01, { replacements: [row1[0].user_id], type: QueryTypes.SELECT });
        if (row01 && row01.length > 0) {
            var _approve_status = row01[0].approve_status && validator.isNumeric(row01[0].approve_status.toString()) ? parseInt(row01[0].approve_status) : 0;
            if (_approve_status != 1) {
                return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Your entity registration is not yet approved.", null));
            }
            if (row01[0].is_activated && row01[0].is_activated == true) {
                return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Account is already activated.", null));
            }

            const sameEmailID = (row01[0].email_id.trim().toLowerCase() == row1[0].email_id.trim().toLowerCase() ? true : false);
            const sameMobileNo = (row01[0].mobile_no.trim().toLowerCase() == row1[0].mobile_no.trim().toLowerCase() ? true : false);
            const changeCred = (sameEmailID && sameMobileNo ? false : true);
            if (changeCred) {
                return res.status(200).json(success(false, res.statusCode, "Account credentials have been changed. Please try using the new activation link.", null));
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

                const transaction = await db.sequelize.transaction();

                const _query1 = `UPDATE user_link_act SET is_used = ?, used_date = ? WHERE unique_id = ?`;
                const _replacements2 = [true, new Date(), uuid_decode];
                await db.sequelize.query(_query1, { replacements: _replacements2, type: QueryTypes.UPDATE });

                const _query2 = `UPDATE user_account SET login_pass = ?, is_activated = ?, activate_date = ?, re_activation_required = false WHERE user_id = ?`;
                const [, j] = await db.sequelize.query(_query2, { replacements: [password_hash, true, new Date(), row1[0].user_id], type: QueryTypes.UPDATE });
                if (j > 0) {
                    await transaction.commit();
                    return res.status(200).json(success(true, res.statusCode, "Activated & new password updated successfully.", null));
                } else {
                    await transaction.rollback();
                    return res.status(200).json(success(false, res.statusCode, "Unable to update password, Please try again.", null));
                }
            } else {
                return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Invalid activation link or expired.", null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, "Account details not found.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RESET_LINK_EXPIRED, err.message, null));
    }
};

module.exports = {
    entities,
    login,
    login_otp_get,
    login_otp_resend,
    login_otp_check,
    token_data,
    reset_pass_request,
    reset_pass_check,
    reset_pass_update,
    new_pass_check,
    new_pass_update,
};
