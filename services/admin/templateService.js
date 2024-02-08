const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
const { apiStatus } = require('../../constants/apiStatus');
var validator = require('validator');
const dotenv = require('dotenv');

const email_template_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM email_template WHERE LOWER(template_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY CASE WHEN COALESCE(sort_order, 0) <= 0 THEN 2147483647 ELSE COALESCE(sort_order, 0) END, template_id) AS sr_no,
        template_id, template_name, subject, body_text, is_enabled, added_date, modify_date, applicable_tags
        FROM email_template WHERE LOWER(template_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            var applicable_tags = [];
            if (row1[i].applicable_tags && row1[i].applicable_tags.length > 0) {
                const applicable_tags_list = row1[i].applicable_tags.split(',');
                for (let j = 0; applicable_tags_list && j < applicable_tags_list.length; j++) {
                    if (applicable_tags_list[j] && applicable_tags_list[j].length > 0 && applicable_tags_list[j].trim().length > 0) {
                        applicable_tags.push(applicable_tags_list[j].trim());
                    }
                }
            }
            list.push({
                id: row1[i].template_id,
                name: row1[i].template_name,
                subject: row1[i].subject,
                body_text: row1[i].body_text,
                is_enabled: row1[i].is_enabled,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
                applicable_tags: applicable_tags,
            })
        }
        const results = {
            current_page: _page_no,
            total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
            data: list,
            key_codes: [],
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const email_template_get = async (req, res, next) => {
    const { id } = req.body;
    try {
        const _query1 = `SELECT template_id, template_name, subject, body_text, is_enabled, applicable_tags FROM email_template WHERE template_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Email template details not found.", null));
        }
        var applicable_tags = [];
        if (row1[0].applicable_tags && row1[0].applicable_tags.length > 0) {
            const applicable_tags_list = row1[0].applicable_tags.split(',');
            for (let i = 0; applicable_tags_list && i < applicable_tags_list.length; i++) {
                if (applicable_tags_list[i] && applicable_tags_list[i].length > 0 && applicable_tags_list[i].trim().length > 0) {
                    applicable_tags.push(applicable_tags_list[i].trim());
                }
            }
        }
        const results = {
            id: row1[0].template_id,
            name: row1[0].template_name,
            subject: row1[0].subject,
            body_text: row1[0].body_text,
            is_enabled: row1[0].is_enabled,
            applicable_tags: applicable_tags,
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const email_template_set = async (req, res, next) => {
    const { id, template_name, subject, body_text } = req.body;
    try {
        var template_id = id && validator.isNumeric(id.toString()) ? BigInt(id) : 0;
        if (!subject || subject.length <= 0 || subject.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter email subject.", null));
        }
        if (!body_text || body_text.length <= 0 || body_text.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter email body text.", null));
        }
        const _query1 = `SELECT template_name FROM email_template WHERE template_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [template_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Email template details not found.", null));
        }

        const _query2 = `UPDATE email_template SET subject = ?, body_text = ?, modify_date = ?, modify_by = ? WHERE template_id = ?`;
        const _replacements2 = [subject, body_text, new Date(), req.token_data.account_id, template_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Email template updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const sms_template_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM sms_template WHERE LOWER(template_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY CASE WHEN COALESCE(sort_order, 0) <= 0 THEN 2147483647 ELSE COALESCE(sort_order, 0) END, template_id) AS sr_no,
        template_id, template_name, message_text, is_enabled, added_date, modify_date, applicable_tags
        FROM sms_template WHERE LOWER(template_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            var applicable_tags = [];
            if (row1[i].applicable_tags && row1[i].applicable_tags.length > 0) {
                const applicable_tags_list = row1[i].applicable_tags.split(',');
                for (let j = 0; applicable_tags_list && j < applicable_tags_list.length; j++) {
                    if (applicable_tags_list[j] && applicable_tags_list[j].length > 0 && applicable_tags_list[j].trim().length > 0) {
                        applicable_tags.push(applicable_tags_list[j].trim());
                    }
                }
            }

            list.push({
                id: row1[i].template_id,
                name: row1[i].template_name,
                message_text: row1[i].message_text,
                is_enabled: row1[i].is_enabled,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
                applicable_tags: applicable_tags,
            })
        }
        const results = {
            current_page: _page_no,
            total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
            data: list,
            key_codes: [],
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const sms_template_get = async (req, res, next) => {
    const { id } = req.body;
    try {
        const _query1 = `SELECT template_id, template_name, message_text, is_enabled, applicable_tags FROM sms_template WHERE template_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "SMS template details not found.", null));
        }
        var applicable_tags = [];
        if (row1[0].applicable_tags && row1[0].applicable_tags.length > 0) {
            const applicable_tags_list = row1[0].applicable_tags.split(',');
            for (let i = 0; applicable_tags_list && i < applicable_tags_list.length; i++) {
                if (applicable_tags_list[i] && applicable_tags_list[i].length > 0 && applicable_tags_list[i].trim().length > 0) {
                    applicable_tags.push(applicable_tags_list[i].trim());
                }
            }
        }
        const results = {
            id: row1[0].template_id,
            name: row1[0].template_name,
            message_text: row1[0].message_text,
            is_enabled: row1[0].is_enabled,
            applicable_tags: applicable_tags,
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const sms_template_set = async (req, res, next) => {
    const { id, template_name, message_text } = req.body;
    try {
        var template_id = id && validator.isNumeric(id.toString()) ? BigInt(id) : 0;
        if (!message_text || message_text.length <= 0 || message_text.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter message text.", null));
        }
        const _query1 = `SELECT template_name FROM sms_template WHERE template_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [template_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "SMS template details not found.", null));
        }

        const _query2 = `UPDATE sms_template SET message_text = ?, modify_date = ?, modify_by = ? WHERE template_id = ?`;
        const _replacements2 = [message_text, new Date(), req.token_data.account_id, template_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "SMS template updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};


module.exports = {
    email_template_list,
    email_template_get,
    email_template_set,
    sms_template_list,
    sms_template_get,
    sms_template_set,
};
