const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const country_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM countries WHERE is_deleted = false AND LOWER(country_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY country_name) AS sr_no,
        country_id, country_name, country_code, mobile_code, is_enabled, added_date, modify_date
        FROM countries WHERE is_deleted = false AND LOWER(country_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                page_size:  parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                sr_no: row1[i].sr_no,
                country_id: row1[i].country_id,
                country_name: row1[i].country_name,
                country_code: row1[i].country_code,
                mobile_code: row1[i].mobile_code,
                is_enabled: row1[i].is_enabled,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
            })
        }
        const results = {
            current_page: _page_no,
            total_pages: Math.ceil(total_record /  parseInt(process.env.PAGINATION_SIZE)),
            data: list,
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const country_get = async (req, res, next) => {
    const { country_id } = req.body;
    try {
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;

        const _query1 = `SELECT country_id, country_name, country_code, mobile_code, is_enabled, added_date, modify_date FROM countries WHERE country_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_country_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Country details not found.", null));
        }
        const results = {
            country_id: row1[0].country_id,
            country_name: row1[0].country_name,
            country_code: row1[0].country_code,
            mobile_code: row1[0].mobile_code,
            is_enabled: row1[0].is_enabled,
            added_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].added_date)),
            modify_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].modify_date)),
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const country_new = async (req, res, next) => {
    const { country_name, country_code, mobile_code } = req.body;
    try {
        if (!country_name || country_name.length <= 0 || country_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter country name.", null));
        }
        const _query1 = `SELECT country_id FROM countries WHERE LOWER(country_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [country_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Country name is already exists.", null));
        }
        if (country_code && country_code.length > 0 && country_code.trim().length > 0) {
            const _query1 = `SELECT country_id FROM countries WHERE LOWER(country_code) = LOWER(?) AND is_deleted = false`;
            const row1 = await db.sequelize.query(_query1, { replacements: [country_code.trim()], type: QueryTypes.SELECT });
            if (row1 && row1.length > 0) {
                return res.status(200).json(success(false, res.statusCode, "Country code is already exists.", null));
            }
        }
        const _query2 = `INSERT INTO countries(country_name, country_code, mobile_code, is_enabled, is_deleted, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING "country_id"`;
        const _replacements2 = [country_name.trim(), country_code.trim(), mobile_code, true, false, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const country_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].country_id : 0);
        if (country_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Country added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add country, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const country_update = async (req, res, next) => {
    const { country_id, country_name, country_code, mobile_code } = req.body;
    try {
        if (!country_name || country_name.length <= 0 || country_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter country name.", null));
        }
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;

        const _query0 = `SELECT country_id FROM countries WHERE country_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_country_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Country details not found.", null));
        }

        const _query1 = `SELECT country_id FROM countries WHERE country_id <> ? AND LOWER(country_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_country_id, country_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Country name is already exists.", null));
        }

        if (country_code && country_code.length > 0 && country_code.trim().length > 0) {
            const _query01 = `SELECT country_id FROM countries WHERE country_id <> ? AND LOWER(country_code) = LOWER(?) AND is_deleted = false`;
            const row01 = await db.sequelize.query(_query01, { replacements: [_country_id, country_code.trim()], type: QueryTypes.SELECT });
            if (row01 && row01.length > 0) {
                return res.status(200).json(success(false, res.statusCode, "Country code is already exists.", null));
            }
        }

        const _query2 = `UPDATE countries SET country_name = ?, country_code = ?, mobile_code = ?, modify_by = ?, modify_date = ? WHERE country_id = ?`;
        const _replacements2 = [country_name.trim(), country_code.trim(), mobile_code, req.token_data.account_id, new Date(), _country_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const country_toggle = async (req, res, next) => {
    const { country_id } = req.body;
    try {
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;

        const _query1 = `SELECT country_id, country_name, is_enabled FROM countries WHERE country_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_country_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Country details not found.", null));
        }

        const _query2 = `UPDATE countries SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE country_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _country_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Status changed successfully.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Unable to change, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,err.message, null));
    }
};

const country_delete = async (req, res, next) => {
    const { country_id } = req.body;
    try {
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;

        const _query3 = `SELECT country_id FROM countries WHERE country_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_country_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Country details not found.", null));
        }
        const _query2 = `UPDATE countries SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE country_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _country_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Country deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

const country_dropdown = async (req, res, next) => {
    const { } = req.body;
    try {
        const _query1 = `SELECT country_id, country_name, country_code, is_default FROM countries 
        WHERE is_deleted = false AND is_enabled = true ORDER BY country_name`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                country_id: row1[i].country_id,
                country_name: row1[i].country_name,
                is_default: row1[i].is_default,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    country_list,
    country_get,
    country_new,
    country_update,
    country_toggle,
    country_delete,
    country_dropdown,
};
