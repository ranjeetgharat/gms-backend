const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const bank_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM bank_mast WHERE is_deleted = false AND LOWER(bank_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY bank_name) AS sr_no,
        bank_id, bank_name, bank_code, is_enabled, added_date, modify_date
        FROM bank_mast WHERE is_deleted = false AND LOWER(bank_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
                bank_id: row1[i].bank_id,
                bank_name: row1[i].bank_name,
                bank_code: row1[i].bank_code,
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

const bank_get = async (req, res, next) => {
    const { bank_id } = req.body;
    try {
        var _bank_id = bank_id && validator.isNumeric(bank_id.toString()) ? BigInt(bank_id) : 0;

        const _query1 = `SELECT bank_id, bank_name, bank_code, is_enabled, added_date, modify_date FROM bank_mast WHERE bank_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_bank_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Bank details not found.", null));
        }
        const results = {
            bank_id: row1[0].bank_id,
            bank_name: row1[0].bank_name,
            bank_code: row1[0].bank_code,
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

const bank_new = async (req, res, next) => {
    const { bank_name, bank_code } = req.body;
    try {
        const _bank_name = (bank_name && bank_name.length > 0) ? bank_name.trim() : "";
        const _bank_code = (bank_code && bank_code.length > 0) ? bank_code.trim() : "";

        if (_bank_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter bank name.", null));
        }
        const _query1 = `SELECT bank_id FROM bank_mast WHERE LOWER(bank_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_bank_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Bank name is already exists.", null));
        }
        if (_bank_code.length > 0) {
            const _query1 = `SELECT bank_id FROM bank_mast WHERE LOWER(bank_code) = LOWER(?) AND is_deleted = false`;
            const row1 = await db.sequelize.query(_query1, { replacements: [_bank_code], type: QueryTypes.SELECT });
            if (row1 && row1.length > 0) {
                return res.status(200).json(success(false, res.statusCode, "Bank code is already exists.", null));
            }
        }
        const _query2 = `INSERT INTO bank_mast(bank_name, bank_code, is_enabled, is_deleted, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING "bank_id"`;
        const _replacements2 = [_bank_name, _bank_code, true, false, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const bank_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].bank_id : 0);
        if (bank_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Bank added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add bank, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const bank_update = async (req, res, next) => {
    const { bank_id, bank_name, bank_code } = req.body;
    try {
        var _bank_id = bank_id && validator.isNumeric(bank_id.toString()) ? BigInt(bank_id) : 0;
        const _bank_name = (bank_name && bank_name.length > 0) ? bank_name.trim() : "";
        const _bank_code = (bank_code && bank_code.length > 0) ? bank_code.trim() : "";

        if (_bank_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter bank name.", null));
        }

        const _query0 = `SELECT bank_id FROM bank_mast WHERE bank_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_bank_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Bank details not found.", null));
        }

        const _query1 = `SELECT bank_id FROM bank_mast WHERE bank_id <> ? AND LOWER(bank_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_bank_id, _bank_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Bank name is already exists.", null));
        }

        if (_bank_code.length > 0) {
            const _query01 = `SELECT bank_id FROM bank_mast WHERE bank_id <> ? AND LOWER(bank_code) = LOWER(?) AND is_deleted = false`;
            const row01 = await db.sequelize.query(_query01, { replacements: [_bank_id, _bank_code], type: QueryTypes.SELECT });
            if (row01 && row01.length > 0) {
                return res.status(200).json(success(false, res.statusCode, "Bank code is already exists.", null));
            }
        }

        const _query2 = `UPDATE bank_mast SET bank_name = ?, bank_code = ?, modify_by = ?, modify_date = ? WHERE bank_id = ?`;
        const _replacements2 = [_bank_name, _bank_code, req.token_data.account_id, new Date(), _bank_id];
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

const bank_toggle = async (req, res, next) => {
    const { bank_id } = req.body;
    try {
        var _bank_id = bank_id && validator.isNumeric(bank_id.toString()) ? BigInt(bank_id) : 0;

        const _query1 = `SELECT bank_id, bank_name, is_enabled FROM bank_mast WHERE bank_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_bank_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Bank details not found.", null));
        }

        const _query2 = `UPDATE bank_mast SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE bank_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _bank_id];
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

const bank_delete = async (req, res, next) => {
    const { bank_id } = req.body;
    try {
        var _bank_id = bank_id && validator.isNumeric(bank_id.toString()) ? BigInt(bank_id) : 0;

        const _query3 = `SELECT bank_id FROM bank_mast WHERE bank_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_bank_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Bank details not found.", null));
        }
        const _query2 = `UPDATE bank_mast SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE bank_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _bank_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Bank deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

const bank_dropdown = async (req, res, next) => {
    const { } = req.body;
    try {
        const _query1 = `SELECT bank_id, bank_name, bank_code FROM bank_mast WHERE is_deleted = false AND is_enabled = true `;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                bank_id: row1[i].bank_id,
                bank_name: row1[i].bank_name,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    bank_list,
    bank_get,
    bank_new,
    bank_update,
    bank_toggle,
    bank_delete,
    bank_dropdown,
};
