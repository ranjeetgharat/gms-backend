const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
const crypto = require('crypto');
const { emailTemplate, emailTags } = require('../../constants/emailConfig');
const emailer = require('../../utilities/emailer');
var validator = require('validator');

const user_list = async (req, res, next) => {
    const { page_no, role_id, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";
        var _role_id = role_id && validator.isNumeric(role_id.toString()) ? BigInt(role_id) : 0;

        const _query0 = `SELECT count(1) AS total_record FROM adm_user ar WHERE ar.is_deleted = false 
        AND (LOWER(ar.first_name) LIKE LOWER(:search_text) OR LOWER(ar.last_name) LIKE LOWER(:search_text)
        OR LOWER(ar.email_id) LIKE LOWER(:search_text) OR LOWER(ar.mobile_no) LIKE LOWER(:search_text))`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY au.admin_id DESC) AS sr_no,
        au.admin_id, au.first_name, au.last_name, au.email_id, au.mobile_no, au.is_master, au.is_enabled,
        au.added_date, au.modify_date, au.role_id, ar.role_name, au.is_activated, au.activate_date
	    FROM adm_user au INNER JOIN adm_role ar ON au.role_id = ar.role_id WHERE au.is_deleted = false 
        AND (LOWER(au.first_name) LIKE LOWER(:search_text) OR LOWER(au.last_name) LIKE LOWER(:search_text)
        OR LOWER(au.email_id) LIKE LOWER(:search_text) OR LOWER(au.mobile_no) LIKE LOWER(:search_text))
        LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: { search_text: _search_text + '%', page_size: parseInt(process.env.PAGINATION_SIZE), page_no: _page_no },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                sr_no: row1[i].sr_no,
                admin_id: row1[i].admin_id,
                first_name: row1[i].first_name,
                last_name: row1[i].last_name,
                email_id: row1[i].email_id,
                mobile_no: row1[i].mobile_no,
                role_name: row1[i].role_name,
                enabled: row1[i].is_enabled,
                is_master: row1[i].is_master,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
                is_activated: row1[i].is_activated,
                activate_date: row1[i].activate_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].activate_date)) : "",
            });
        }
        const results = {
            current_page: _page_no,
            total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
            data: list,
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const user_get = async (req, res, next) => {
    const { admin_id } = req.body;
    try {
        const _query1 = `SELECT admin_id, first_name, last_name, email_id, mobile_no, is_master, is_enabled,
        added_by, modify_by, added_date, modify_date, role_id, is_activated, activate_date
        FROM adm_user WHERE admin_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [admin_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Admin user details not found.", null));
        }
        const results = {
            admin_id: row1[0].admin_id,
            first_name: row1[0].first_name,
            last_name: row1[0].last_name,
            email_id: row1[0].email_id,
            mobile_no: row1[0].mobile_no,
            is_enabled: row1[0].is_enabled,
            role_id: row1[0].role_id,
            added_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].added_date)),
            modify_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].modify_date)),
            is_activated: row1[0].is_activated,
            activate_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].activate_date)),
        };

        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const user_new = async (req, res, next) => {
    const { first_name, last_name, email_id, mobile_no, role_id } = req.body;
    try {
        if (!first_name || first_name.length <= 0 || first_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter first name.", null));
        }
        if (first_name.trim().length > 30) {
            return res.status(200).json(success(false, res.statusCode, "First name should not be more than 30 character", null));
        }
        if (!last_name || last_name.length <= 0 || last_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter last name.", null));
        }
        if (last_name.trim().length > 30) {
            return res.status(200).json(success(false, res.statusCode, "Last name should not be more than 30 character", null));
        }
        if (!email_id || email_id.length <= 0 || email_id.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter email id.", null));
        }
        if (email_id && email_id.length > 0 && !validator.isEmail(email_id)) {
            return res.status(200).json(success(false, res.statusCode, "Please enter correct email address.", null));
        }
        if (!mobile_no || mobile_no.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter mobile no.", null));
        }
        if ((mobile_no && mobile_no.length > 0 && !validator.isNumeric(mobile_no)) || mobile_no.length != 10) {
            return res.status(200).json(success(false, res.statusCode, "Invalid mobile number.", null));
        }
        var _role_id = role_id && validator.isNumeric(role_id.toString()) ? BigInt(role_id) : 0;
        if (_role_id <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select user role.", null));
        }
        const row00 = await db.sequelize.query("SELECT role_id, role_name, is_editable FROM adm_role WHERE role_id = ? AND is_enabled = true AND is_deleted = false",
            { replacements: [_role_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Admin role not found, Please refresh page and try again.", null));
        }

        const is_editable = row00[0].is_editable && row00[0].is_editable == true ? true : false;
        if (!is_editable) {
            return res.status(200).json(success(false, res.statusCode, "Cannot create user of role \"" + row00[0].role_name + "\" .", null));
        }

        const row1 = await db.sequelize.query("SELECT admin_id FROM adm_user WHERE TRIM(LOWER(email_id)) = TRIM(LOWER(?)) AND is_deleted = false",
            { replacements: [email_id], type: QueryTypes.SELECT });
        var emailExists = (row1 && row1.length > 0) ? true : false;
        if (emailExists) {
            return res.status(200).json(success(false, res.statusCode, "Email address is already registered.", null));
        }
        const row3 = await db.sequelize.query("SELECT admin_id FROM adm_user WHERE TRIM(mobile_no) = TRIM(?) AND is_deleted = false ",
            { replacements: [mobile_no], type: QueryTypes.SELECT });
        var mobileExists = (row3 && row3.length > 0) ? true : false;
        if (mobileExists) {
            return res.status(200).json(success(false, res.statusCode, "Mobile number is already registered.", null));
        }

        const _query2 = `INSERT INTO adm_user(first_name, last_name, email_id, mobile_no, login_pass, is_master, is_enabled, is_deleted, added_by, added_date, role_id, is_activated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING "admin_id"`;
        const _replacements2 = [first_name.trim(), last_name.trim(), email_id.trim(), mobile_no.trim(), '', false, true, false, req.token_data.account_id, new Date(), _role_id, false];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });

        const admin_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].admin_id : 0);
        if (admin_id > 0) {
            await send_invite(admin_id);

            return res.status(200).json(success(true, res.statusCode, "User created successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to create user, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const user_toggle = async (req, res, next) => {
    const { admin_id } = req.body;
    try {
        const _query1 = `SELECT admin_id, is_enabled, email_id, is_master FROM adm_user WHERE admin_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [admin_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Admin user details not found.", null));
        }
        if (row1[0].is_master && row1[0].is_master == true) {
            return res.status(200).json(success(false, res.statusCode, "Master administrator status can not be change.", null));
        }

        const _query2 = `UPDATE adm_user SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE admin_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, admin_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Status changed successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to change, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const user_delete = async (req, res, next) => {
    const { admin_id } = req.body;
    try {
        var _admin_id = admin_id && validator.isNumeric(admin_id.toString()) ? BigInt(admin_id) : 0;

        const _query3 = `SELECT admin_id, is_master, email_id FROM adm_user WHERE admin_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_admin_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Admin user details not found.", null));
        }

        if (row3[0].is_master && row3[0].is_master == true) {
            return res.status(200).json(success(false, res.statusCode, "Master administrator can not be deleted.", null));
        }

        const _query = `UPDATE adm_user SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE admin_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _admin_id];
        const [, i] = await db.sequelize.query(_query, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            const _query4 = `UPDATE adm_token SET is_logout = true, logout_time = ? WHERE admin_id = ? AND is_logout = false`;
            await db.sequelize.query(_query4, { replacements: [new Date(), _admin_id], type: QueryTypes.UPDATE });

            return res.status(200).json(success(true, res.statusCode, "Admin user deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete user, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const user_invite = async (req, res, next) => {
    const { admin_id } = req.body;

    try {
        var _admin_id = admin_id && validator.isNumeric(admin_id.toString()) ? BigInt(admin_id) : 0;

        const _query3 = `SELECT admin_id, is_activated FROM adm_user WHERE admin_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_admin_id], type: QueryTypes.SELECT });
        if (row3 && row3.length > 0) {

            if (row3[0].is_activated && row3[0].is_activated == true) {
                return res.status(200).json(success(false, res.statusCode, "Admin user is already activated.", null));
            }

            var i = await send_invite(_admin_id);
            if (i > 0) {
                return res.status(200).json(success(true, res.statusCode, "Invite link has been sent on email address.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invite link sending failure, Please try again.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Admin user details not found.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const send_invite = async (admin_id) => {
    const _query4 = `SELECT a.first_name, a.last_name, a.email_id, a.mobile_no, a.is_enabled, a.added_date, a.modify_date, 
    a.role_id, a.is_activated, r.role_name
    FROM adm_user a LEFT OUTER JOIN adm_role r ON a.role_id = r.role_id WHERE a.admin_id = ? AND a.is_deleted = false`;
    const row4 = await db.sequelize.query(_query4, { replacements: [admin_id], type: QueryTypes.SELECT });
    if (row4 && row4.length > 0) {
        if (row4[0].is_activated && row4[0].is_activated == true) {
            return -1;      /*Already activated*/
        }
        const uuid = crypto.randomUUID();
        const link_data = { page: 'admin_invite', token: uuid.toString(), };
        const encoded_data = encodeURIComponent(Buffer.from(JSON.stringify(link_data), 'utf8').toString('base64'));
        var link_url = process.env.FRONT_SITE_URL + 'email/' + encoded_data;

        const _query1 = `INSERT INTO adm_link_act(unique_id, admin_id, sent_date) VALUES (?, ?, ?) RETURNING "link_id"`;
        const [row1] = await db.sequelize.query(_query1, { replacements: [uuid, admin_id, new Date()], type: QueryTypes.INSERT });
        const link_id = (row1 && row1.length > 0 && row1[0] ? row1[0].link_id : 0);
        if (link_id > 0) {
            const rowT = await db.sequelize.query(`SELECT subject, body_text, is_enabled FROM email_template WHERE template_id = ?`,
                { replacements: [emailTemplate.ADMIN_INVITE_LINK], type: QueryTypes.SELECT });
            if (rowT && rowT.length > 0) {
                if (rowT[0].is_enabled) {
                    var subject = rowT[0].subject && rowT[0].subject.length > 0 ? rowT[0].subject : "";
                    var body_text = rowT[0].body_text && rowT[0].body_text.length > 0 ? rowT[0].body_text : "";

                    subject = subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    subject = subject.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                    subject = subject.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                    subject = subject.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                    subject = subject.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                    subject = subject.replaceAll(emailTags.ROLE_NAME, row4[0].role_name);
                    subject = subject.replaceAll(emailTags.INVITE_LINK, link_url);

                    body_text = body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    body_text = body_text.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                    body_text = body_text.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                    body_text = body_text.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                    body_text = body_text.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                    body_text = body_text.replaceAll(emailTags.ROLE_NAME, row4[0].role_name);
                    body_text = body_text.replaceAll(emailTags.INVITE_LINK, link_url);

                    var mailOptions = {
                        from: process.env.MAIL_SENDER, // sender address
                        to: row4[0].email_id, // list of receivers
                        subject: subject, // Subject line 
                        html: body_text, // html body
                    }
                    var is_success = false;
                    try {
                        await emailer.sendMail(mailOptions);
                        is_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }
                    if (is_success) {
                        return 1;
                    } else {
                        return 0; /* Sending fail*/
                    }
                } else {
                    return -4;      /*Templete is disabled*/
                }
            } else {
                return -3;      /*Templete not found*/
            }
        }
        else {
            return -2;     /*Unable to add invite link uuid*/
        }
    }
    return 0;       /*admin data not found*/
};

const send_reset = async (admin_id) => {
    const _query4 = `SELECT a.first_name, a.last_name, a.email_id, a.mobile_no, a.is_enabled, a.added_date, a.modify_date, a.role_id, a.is_activated,
    r.role_name FROM adm_user a LEFT OUTER JOIN adm_role r ON a.role_id = r.role_id WHERE a.admin_id = ? AND a.is_deleted = false`;
    const row4 = await db.sequelize.query(_query4, { replacements: [admin_id], type: QueryTypes.SELECT });
    if (row4 && row4.length > 0) {
        if (row4[0].is_activated && row4[0].is_activated == true) {
            const uuid = crypto.randomUUID();
            const link_data = { page: 'admin_reset', token: uuid.toString(), };
            const encoded_data = encodeURIComponent(Buffer.from(JSON.stringify(link_data), 'utf8').toString('base64'));
            var reset_link = process.env.FRONT_SITE_URL + 'email/' + encoded_data;

            const _query1 = `INSERT INTO adm_link_reset(unique_id, admin_id, sent_date) VALUES (?, ?, ?) RETURNING "reset_id"`;
            const [row1] = await db.sequelize.query(_query1, { replacements: [uuid, admin_id, new Date()], type: QueryTypes.INSERT });
            const reset_id = (row1 && row1.length > 0 && row1[0] ? row1[0].reset_id : 0);
            if (reset_id > 0) {
                const rowT = await db.sequelize.query(`SELECT subject, body_text, is_enabled FROM email_template WHERE template_id = ?`,
                    { replacements: [emailTemplate.ADMIN_RESET_PASS_LINK], type: QueryTypes.SELECT });
                if (rowT && rowT.length > 0) {
                    if (rowT[0].is_enabled) {
                        var subject = rowT[0].subject && rowT[0].subject.length > 0 ? rowT[0].subject : "";
                        var body_text = rowT[0].body_text && rowT[0].body_text.length > 0 ? rowT[0].body_text : "";

                        subject = subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                        subject = subject.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                        subject = subject.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                        subject = subject.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                        subject = subject.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                        subject = subject.replaceAll(emailTags.ROLE_NAME, row4[0].role_name);

                        body_text = body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                        body_text = body_text.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                        body_text = body_text.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                        body_text = body_text.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                        body_text = body_text.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                        body_text = body_text.replaceAll(emailTags.ROLE_NAME, row4[0].role_name);
                        body_text = body_text.replaceAll(emailTags.RESET_LINK, reset_link);


                        var mailOptions = {
                            from: process.env.MAIL_SENDER, // sender address
                            to: row4[0].email_id, // list of receivers
                            subject: subject, // Subject line 
                            html: body_text, // html body
                        }
                        var is_success = false;
                        try {
                            await emailer.sendMail(mailOptions);
                            is_success = true;
                        } catch (err) {
                            _logger.error(err.stack);
                        }
                        if (is_success) {
                            return 1;
                        } else {
                            return 0; /* Sending fail*/
                        }
                    } else {
                        return -4;      /*Templete is disabled*/
                    }
                } else {
                    return -3;      /*Templete not found*/
                }
            }
            else {
                return -2;     /*Unable to add reset link uuid*/
            }
        } else {
            return -1;      /*account not activated*/
        }
    }
    return 0;       /*admin data not found*/
}

module.exports = {
    user_list,
    user_get,
    user_new,
    user_toggle,
    user_delete,
    user_invite,
    send_reset,
};
