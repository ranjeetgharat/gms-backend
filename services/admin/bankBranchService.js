const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const ifsc_code_list = async (req, res, next) => {
    const { page_no, search_text, bank_id } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";
        var _bank_id = bank_id && validator.isNumeric(bank_id.toString()) ? BigInt(bank_id) : 0;

        const _query21 = `SELECT bank_id FROM bank_mast WHERE bank_id = ? AND is_deleted = false`;
        const row21 = await db.sequelize.query(_query21, { replacements: [_bank_id], type: QueryTypes.SELECT });
        if (!row21 || row21.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Bank details not found.", null));
        }

        const _query0 = `SELECT count(1) AS total_record FROM bank_branch WHERE bank_id = :bank_id AND is_deleted = false AND LOWER(ifsc_code) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { bank_id: _bank_id, search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY ifsc_code) AS sr_no,
        branch_id, ifsc_code, branch_name, branch_address, is_enabled, added_date, modify_date
        FROM bank_branch WHERE bank_id = :bank_id AND is_deleted = false AND LOWER(ifsc_code) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                bank_id: _bank_id,
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
                branch_id: row1[i].branch_id,
                ifsc_code: row1[i].ifsc_code,
                branch_name: row1[i].branch_name,
                branch_address: row1[i].branch_address,
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

const ifsc_code_get = async (req, res, next) => {
    const { branch_id } = req.body;
    try {
        var _branch_id = branch_id && validator.isNumeric(branch_id.toString()) ? BigInt(branch_id) : 0;

        const _query1 = `SELECT branch_id, ifsc_code, bank_id, branch_name, branch_address, is_enabled, added_date, modify_date
        FROM bank_branch WHERE branch_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_branch_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "IFSC Code details not found.", null));
        }
        const results = {
            branch_id: row1[0].branch_id,
            ifsc_code: row1[0].ifsc_code,
            bank_id: row1[0].bank_id,
            branch_name: row1[0].branch_name,
            branch_address: row1[0].branch_address,
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

const ifsc_code_new = async (req, res, next) => {
    const { bank_id, ifsc_code, branch_name, branch_address } = req.body;
    try {
        var _bank_id = bank_id && validator.isNumeric(bank_id.toString()) ? BigInt(bank_id) : 0;
        const _ifsc_code = (ifsc_code && ifsc_code.length > 0) ? ifsc_code.trim().toUpperCase() : "";
        const _branch_name = (branch_name && branch_name.length > 0) ? branch_name.trim() : "";
        const _branch_address = (branch_address && branch_address.length > 0) ? branch_address.trim() : "";

        if (_bank_id <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select bank name.", null));
        }
        const _query21 = `SELECT bank_id FROM bank_mast WHERE bank_id = ? AND is_deleted = false`;
        const row21 = await db.sequelize.query(_query21, { replacements: [_bank_id], type: QueryTypes.SELECT });
        if (!row21 || row21.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Bank details not found.", null));
        }
        if (_ifsc_code.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter ifsc code.", null));
        }
        if (!utils.is_ifsc_code(_ifsc_code)) {
            return res.status(200).json(success(false, res.statusCode, "Please enter correct ifsc code.", null));
        }
        if (_branch_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter branch name.", null));
        }

        const _query1 = `SELECT c.branch_id FROM bank_branch c INNER JOIN bank_mast m ON c.bank_id = m.bank_id
        WHERE LOWER(c.ifsc_code) = LOWER(?) AND c.is_deleted = false AND m.is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_ifsc_code], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "IFSC Code is already exists.", null));
        }

        const _query2 = `INSERT INTO bank_branch(bank_id, ifsc_code, branch_name, branch_address, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING "branch_id"`;
        const _replacements2 = [_bank_id, _ifsc_code, _branch_name, _branch_address, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const branch_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].branch_id : 0);
        if (branch_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "IFSC Code added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add ifsc code, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const ifsc_code_update = async (req, res, next) => {
    const { branch_id, ifsc_code, branch_name, branch_address } = req.body;
    try {
        var _branch_id = branch_id && validator.isNumeric(branch_id.toString()) ? BigInt(branch_id) : 0;
        const _ifsc_code = (ifsc_code && ifsc_code.length > 0) ? ifsc_code.trim().toUpperCase() : "";
        const _branch_name = (branch_name && branch_name.length > 0) ? branch_name.trim() : "";
        const _branch_address = (branch_address && branch_address.length > 0) ? branch_address.trim() : "";

        if (_ifsc_code.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter ifsc code.", null));
        }
        if (_branch_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter branch name.", null));
        }
        const _query0 = `SELECT branch_id FROM bank_branch WHERE branch_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_branch_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "IFSC Code details not found.", null));
        }

        const _query1 = `SELECT c.branch_id FROM bank_branch c INNER JOIN bank_mast m ON c.bank_id = m.bank_id
        WHERE c.branch_id <> ? AND LOWER(c.ifsc_code) = LOWER(?) AND c.is_deleted = false AND m.is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_branch_id, _ifsc_code], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "IFSC Code is already exists.", null));
        }

        const _query2 = `UPDATE bank_branch SET ifsc_code = ?, branch_name = ?, branch_address = ?, modify_by = ?, modify_date = ? WHERE branch_id = ?`;
        const _replacements2 = [_ifsc_code, _branch_name, _branch_address, req.token_data.account_id, new Date(), _branch_id];
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

const ifsc_code_toggle = async (req, res, next) => {
    const { branch_id } = req.body;
    try {
        var _branch_id = branch_id && validator.isNumeric(branch_id.toString()) ? BigInt(branch_id) : 0;

        const _query1 = `SELECT branch_id, ifsc_code, is_enabled FROM bank_branch WHERE branch_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_branch_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"IFSC Code details not found.", null));
        }

        const _query2 = `UPDATE bank_branch SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE branch_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _branch_id];
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

const ifsc_code_delete = async (req, res, next) => {
    const { branch_id } = req.body;
    try {
        var _branch_id = branch_id && validator.isNumeric(branch_id.toString()) ? BigInt(branch_id) : 0;

        const _query1 = `SELECT branch_id, ifsc_code, is_enabled FROM bank_branch WHERE branch_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_branch_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"IFSC Code details not found.", null));
        }

        const _query2 = `UPDATE bank_branch SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE branch_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _branch_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "IFSC Code deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

module.exports = {
    ifsc_code_list,
    ifsc_code_get,
    ifsc_code_new,
    ifsc_code_update,
    ifsc_code_toggle,
    ifsc_code_delete,
};