const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { postcodeValidator, postcodeValidatorExistsForCountry } = require('postcode-validator');
const { apiStatus } = require("../../constants/apiStatus");

const block_list = async (req, res, next) => {
    const { district_id, page_no, search_text } = req.body;
    try {
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM blocks WHERE district_id = :district_id AND is_deleted = false AND LOWER(block_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { district_id: _district_id, search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY block_name) AS sr_no,
        block_id, block_name, pin_codes, district_id, is_enabled, added_date, modify_date
        FROM blocks WHERE district_id = :district_id AND is_deleted = false AND LOWER(block_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                district_id: _district_id,
                search_text: '%' + _search_text + '%',
                page_size:  parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            var _pin_codes = [];
            if (row1[i].pin_codes && row1[i].pin_codes.length > 0) {
                _pin_codes = row1[i].pin_codes.split(',');
            }
            list.push({
                sr_no: row1[i].sr_no,
                block_id: row1[i].block_id,
                block_name: row1[i].block_name,
                pin_codes: _pin_codes,
                district_id: row1[i].district_id,
                is_enabled: row1[i].is_enabled,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
            });
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

const block_get = async (req, res, next) => {
    const { block_id } = req.body;
    try {
        var _block_id = block_id && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        const _query1 = `SELECT block_id, block_name, pin_codes, district_id, is_enabled, added_date, modify_date FROM blocks WHERE block_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_block_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Block/Taluka details not found.", null));
        }
        var _pin_codes = [];
        if (row1[0].pin_codes && row1[0].pin_codes.length > 0) {
            _pin_codes = row1[0].pin_codes.split(',');
        }
        const results = {
            block_id: row1[0].block_id,
            block_name: row1[0].block_name,
            pin_codes: _pin_codes,
            district_id: row1[0].district_id,
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

const block_new = async (req, res, next) => {
    const { district_id, block_name, pin_codes } = req.body;
    try {
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;

        if (!block_name || block_name.length <= 0 || block_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter block/taluka name.", null));
        }

        const row00 = await db.sequelize.query("SELECT district_id FROM districts WHERE district_id = ? AND is_deleted = false",
            { replacements: [_district_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "District not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT block_id FROM blocks WHERE district_id = ? AND LOWER(block_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_district_id, block_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Block/Taluka name is already exists.", null));
        }
        var country_code = '';
        const _query031 = `SELECT country_id, country_name, country_code FROM countries WHERE country_id IN (
                            SELECT country_id FROM states WHERE state_id IN (SELECT state_id FROM districts WHERE district_id = ?))`;
        const row031 = await db.sequelize.query(_query031, { replacements: [_district_id], type: QueryTypes.SELECT });
        if (row031 && row031.length > 0) {
            country_code = (row031[0].country_code && row031[0].country_code.length > 0 ? row031[0].country_code : '');
        }
        if (!postcodeValidatorExistsForCountry(country_code)) {
            country_code = 'IN';
        }

        var _pin_codes = [];
        if (pin_codes && pin_codes.length > 0) {
            const pin_codes_list = pin_codes.split(',').join('|');
            const pin_codes_array = pin_codes_list.split('|');
            for (let i = 0; i < pin_codes_array.length; i++) {
                const element = pin_codes_array[i];
                if (element && element.length > 0) {
                    if (postcodeValidator(element, country_code)) {
                        _pin_codes.push(element);
                    } else {
                        return res.status(200).json(success(false, res.statusCode, "Pin code \"" + element + "\" is not valid.", null));
                    }
                }
            }
        }

        const _query2 = `INSERT INTO blocks(block_name, pin_codes, district_id, is_enabled, is_deleted, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING "block_id"`;
        const _replacements2 = [block_name.trim(), _pin_codes.join(','), _district_id, true, false, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const block_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].block_id : 0);
        if (block_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Block/Taluka added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add block/taluka, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const block_update = async (req, res, next) => {
    const { district_id, block_id, block_name, pin_codes } = req.body;
    try {
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;

        if (!block_name || block_name.length <= 0 || block_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter block/taluka name.", null));
        }
        var _block_id = block_id && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        const _query0 = `SELECT block_id FROM blocks WHERE block_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_block_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Block/Taluka details not found.", null));
        }

        const row00 = await db.sequelize.query("SELECT district_id FROM districts WHERE district_id = ? AND is_deleted = false",
            { replacements: [_district_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "District not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT block_id FROM blocks WHERE district_id = ? AND block_id <> ? AND LOWER(block_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_district_id, _block_id, block_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Block/Taluka name is already exists.", null));
        }

        var country_code = '';
        const _query031 = `SELECT country_id, country_name, country_code FROM countries WHERE country_id IN (
                            SELECT country_id FROM states WHERE state_id IN (SELECT state_id FROM districts WHERE district_id = ?))`;
        const row031 = await db.sequelize.query(_query031, { replacements: [_district_id], type: QueryTypes.SELECT });
        if (row031 && row031.length > 0) {
            country_code = (row031[0].country_code && row031[0].country_code.length > 0 ? row031[0].country_code : '');
        }
        if (!postcodeValidatorExistsForCountry(country_code)) {
            country_code = 'IN';
        }

        var _pin_codes = [];
        if (pin_codes && pin_codes.length > 0) {
            const pin_codes_list = pin_codes.split(',').join('|');
            const pin_codes_array = pin_codes_list.split('|');
            for (let i = 0; i < pin_codes_array.length; i++) {
                const element = pin_codes_array[i];
                if (element && element.length > 0) {
                    if (postcodeValidator(element, country_code)) {
                        _pin_codes.push(element);
                    } else {
                        return res.status(200).json(success(false, res.statusCode, "Pin code \"" + element + "\" is not valid.", null));
                    }
                }
            }
        }

        const _query2 = `UPDATE blocks SET block_name = ?, pin_codes = ?, modify_by = ?, modify_date = ? WHERE block_id = ?`;
        const _replacements2 = [block_name.trim(), _pin_codes.join(','), req.token_data.account_id, new Date(), _block_id];
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

const block_toggle = async (req, res, next) => {
    const { block_id } = req.body;
    try {
        var _block_id = block_id && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        const _query1 = `SELECT block_id, block_name, is_enabled FROM blocks WHERE block_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_block_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Block/Taluka details not found.", null));
        }
        const _query2 = `UPDATE blocks SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE block_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _block_id];
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

const block_delete = async (req, res, next) => {
    const { block_id } = req.body;
    try {
        var _block_id = block_id && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        const _query3 = `SELECT block_id FROM blocks WHERE block_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_block_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Block/Taluka details not found.", null));
        }
        const _query2 = `UPDATE blocks SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE block_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _block_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Block/Taluka deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

const block_dropdown = async (req, res, next) => {
    const { district_id } = req.body;
    try {
        var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;

        const _query1 = `SELECT block_id, block_name, pin_codes 
        FROM blocks WHERE district_id = ? AND is_deleted = false AND is_enabled = true ORDER BY block_name`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_district_id], type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            var _pin_codes = [];
            if (row1[i].pin_codes && row1[i].pin_codes.length > 0) {
                _pin_codes = row1[i].pin_codes.split(',');
            }
            list.push({
                block_id: row1[i].block_id,
                block_name: row1[i].block_name,
                pin_codes: _pin_codes,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    block_list,
    block_get,
    block_new,
    block_update,
    block_toggle,
    block_delete,
    block_dropdown,
};