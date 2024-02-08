const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const district_list = async (req, res, next) => {
    const { state_id, page_no, search_text } = req.body;
    try {
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM districts WHERE state_id = :state_id AND is_deleted = false AND LOWER(district_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { state_id: _state_id, search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY district_name) AS sr_no,
        district_id, district_name, district_code, state_id, is_enabled, added_date, modify_date
        FROM districts WHERE state_id = :state_id AND is_deleted = false AND LOWER(district_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                state_id: _state_id,
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
                district_id: row1[i].district_id,
                district_name: row1[i].district_name,
                district_code: row1[i].district_code,
                state_id: row1[i].state_id,
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

const district_get = async (req, res, next) => {
    const { district_id } = req.body;
    try {
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;

        const _query1 = `SELECT district_id, district_name, district_code, state_id, is_enabled, added_date, modify_date FROM districts WHERE district_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_district_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "District details not found.", null));
        }
        const results = {
            district_id: row1[0].district_id,
            district_name: row1[0].district_name,
            district_code: row1[0].district_code,
            state_id: row1[0].state_id,
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

const district_new = async (req, res, next) => {
    const { state_id, district_name, district_code } = req.body;
    try {
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;

        if (!district_name || district_name.length <= 0 || district_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter district name.", null));
        }

        const row00 = await db.sequelize.query("SELECT state_id FROM states WHERE state_id = ? AND is_deleted = false",
            { replacements: [_state_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "State not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT district_id FROM districts WHERE state_id = ? AND LOWER(district_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_state_id, district_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "District name is already exists.", null));
        }

        const _query2 = `INSERT INTO districts(district_name, district_code, state_id, is_enabled, is_deleted, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING "district_id"`;
        const _replacements2 = [district_name.trim(), district_code, _state_id, true, false, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const district_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].district_id : 0);
        if (district_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "District added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add district, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const district_update = async (req, res, next) => {
    const { state_id, district_id, district_name, district_code } = req.body;
    try {
        if (!district_name || district_name.length <= 0 || district_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter district name.", null));
        }
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;

        const _query0 = `SELECT district_id FROM districts WHERE district_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_district_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "District details not found.", null));
        }
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;


        const row00 = await db.sequelize.query("SELECT state_id FROM states WHERE state_id = ? AND is_deleted = false",
            { replacements: [_state_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "State not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT district_id FROM districts WHERE district_id <> ? AND state_id = ? AND LOWER(district_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_district_id, _state_id, district_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "District name is already exists.", null));
        }

        const _query2 = `UPDATE districts SET district_name = ?, district_code = ?, state_id = ?, modify_by = ?, modify_date = ? WHERE district_id = ?`;
        const _replacements2 = [district_name.trim(), district_code, _state_id, req.token_data.account_id, new Date(), _district_id];
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

const district_toggle = async (req, res, next) => {
    const { district_id } = req.body;
    try {
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;

        const _query1 = `SELECT district_id, district_name, is_enabled FROM districts WHERE district_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_district_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"District details not found.", null));
        }

        const _query2 = `UPDATE districts SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE district_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _district_id];
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

const district_delete = async (req, res, next) => {
    const { district_id } = req.body;
    try {
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;

        const _query3 = `SELECT district_id FROM districts WHERE district_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_district_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "District details not found.", null));
        }
        const _query2 = `UPDATE districts SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE district_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _district_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "District deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const district_dropdown = async (req, res, next) => {
    const { state_id } = req.body;
    try {
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;

        const _query1 = `SELECT district_id, district_name, district_code FROM districts 
        WHERE state_id = ? AND is_deleted = false AND is_enabled = true ORDER BY district_name`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_state_id], type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                district_id: row1[i].district_id,
                district_name: row1[i].district_name,
            })
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    district_list,
    district_get,
    district_new,
    district_update,
    district_toggle,
    district_delete,
    district_dropdown
};
