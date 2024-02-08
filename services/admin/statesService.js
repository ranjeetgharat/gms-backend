const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const state_list = async (req, res, next) => {
    const { country_id, page_no, search_text } = req.body;
    try {
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM states WHERE country_id = :country_id AND is_deleted = false AND LOWER(state_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { country_id: _country_id, search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY state_name) AS sr_no,
        state_id, state_name, state_code, country_id, is_enabled, added_date, modify_date
        FROM states WHERE country_id = :country_id AND is_deleted = false AND LOWER(state_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                country_id: _country_id,
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
                state_id: row1[i].state_id,
                state_name: row1[i].state_name,
                state_code: row1[i].state_code,
                country_id: row1[i].country_id,
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

const state_get = async (req, res, next) => {
    const { state_id } = req.body;
    try {
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;

        const _query1 = `SELECT state_id, state_name, state_code, country_id, is_enabled, added_date, modify_date FROM states WHERE state_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_state_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "State details not found.", null));
        }
        const results = {
            state_id: row1[0].state_id,
            state_name: row1[0].state_name,
            state_code: row1[0].state_code,
            country_id: row1[0].country_id,
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

const state_new = async (req, res, next) => {
    const { country_id, state_name, state_code } = req.body;
    try {
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;

        if (!state_name || state_name.length <= 0 || state_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter state name.", null));
        }

        const row00 = await db.sequelize.query("SELECT country_id FROM countries WHERE country_id = ? AND is_deleted = false",
            { replacements: [_country_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Country not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT state_id FROM states WHERE country_id = ? AND LOWER(state_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_country_id, state_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "State name is already exists.", null));
        }
        if (state_code && state_code.length > 0 && state_code.trim().length > 0) {
            const _query1 = `SELECT state_id FROM states WHERE country_id = ? AND LOWER(state_code) = LOWER(?) AND is_deleted = false`;
            const row1 = await db.sequelize.query(_query1, { replacements: [_country_id, state_code.trim()], type: QueryTypes.SELECT });
            if (row1 && row1.length > 0) {
                return res.status(200).json(success(false, res.statusCode, "State code is already exists.", null));
            }
        }
        const _query2 = `INSERT INTO states(state_name, state_code, country_id, is_enabled, is_deleted, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING "state_id"`;
        const _replacements2 = [state_name.trim(), state_code.trim(), _country_id, true, false, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const state_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].state_id : 0);
        if (state_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "State added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add state, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const state_update = async (req, res, next) => {
    const { country_id, state_id, state_name, state_code } = req.body;
    try {
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;

        if (!state_name || state_name.length <= 0 || state_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter state name.", null));
        }
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;

        const _query0 = `SELECT state_id FROM states WHERE state_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_state_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "State details not found.", null));
        }

        const row00 = await db.sequelize.query("SELECT country_id FROM countries WHERE country_id = ? AND is_deleted = false",
            { replacements: [_country_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Country not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT state_id FROM states WHERE country_id = ? AND state_id <> ? AND LOWER(state_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_country_id, _state_id, state_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "State name is already exists.", null));
        }

        if (state_code && state_code.length > 0 && state_code.trim().length > 0) {
            const _query11 = `SELECT state_id FROM states WHERE country_id = ? AND state_id <> ? AND LOWER(state_code) = LOWER(?) AND is_deleted = false`;
            const row11 = await db.sequelize.query(_query11, { replacements: [_country_id, _state_id, state_code.trim()], type: QueryTypes.SELECT });
            if (row11 && row11.length > 0) {
                return res.status(200).json(success(false, res.statusCode, "State code is already exists.", null));
            }
        }

        const _query2 = `UPDATE states SET state_name = ?, state_code = ?, modify_by = ?, modify_date = ? WHERE state_id = ?`;
        const _replacements2 = [state_name.trim(), state_code.trim(), req.token_data.account_id, new Date(), _state_id];
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

const state_toggle = async (req, res, next) => {
    const { state_id } = req.body;
    try {
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;

        const _query1 = `SELECT state_id, state_name, is_enabled FROM states WHERE state_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_state_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"State details not found.", null));
        }

        const _query2 = `UPDATE states SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE state_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _state_id];
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

const state_delete = async (req, res, next) => {
    const { state_id } = req.body;
    try {
        var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;

        const _query3 = `SELECT state_id FROM states WHERE state_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_state_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "State details not found.", null));
        }
        const _query2 = `UPDATE states SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE state_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _state_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "State deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const state_dropdown = async (req, res, next) => {
    const { country_id } = req.body;
    try {
        var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;

        const _query1 = `SELECT state_id, state_name, state_code FROM states 
        WHERE country_id = ? AND is_deleted = false AND is_enabled = true ORDER BY state_name`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_country_id], type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                state_id: row1[i].state_id,
                state_name: row1[i].state_name,
            })
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    state_list,
    state_get,
    state_new,
    state_update,
    state_toggle,
    state_delete,
    state_dropdown,
};
