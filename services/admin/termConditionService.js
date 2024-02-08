const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const term_condition_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM term_condition WHERE is_deleted = false AND LOWER(title_text) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY CASE WHEN COALESCE(sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(sort_order, 0) END, table_id) AS sr_no,
        table_id, title_text, sort_order, is_enabled, added_date, modify_date
        FROM term_condition WHERE is_deleted = false AND LOWER(title_text) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
                table_id: row1[i].table_id,
                title_text: row1[i].title_text,
                sort_order: row1[i].sort_order,
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

const term_condition_get = async (req, res, next) => {
    const { table_id } = req.body;
    try {
        var _table_id = table_id && validator.isNumeric(table_id.toString()) ? BigInt(table_id) : 0;

        const _query1 = `SELECT table_id, title_text, content_text, sort_order, is_enabled, added_date, modify_date 
        FROM term_condition WHERE table_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_table_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Term and condition details not found.", null));
        }
        const results = {
            table_id: row1[0].table_id,
            title_text: row1[0].title_text,
            content_text: row1[0].content_text,
            sort_order: row1[0].sort_order,
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

const term_condition_new = async (req, res, next) => {
    const { title_text, content_text, sort_order } = req.body;
    try {
        const _title_text = (title_text && title_text.length > 0) ? title_text.trim() : "";
        const _content_text = (content_text && content_text.length > 0) ? content_text.trim() : "";
        var _sort_order = sort_order && validator.isNumeric(sort_order.toString()) ? BigInt(sort_order) : 0;

        if (_title_text.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter title text.", null));
        }
        if (_content_text.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter contents.", null));
        }
        const _query1 = `SELECT table_id FROM term_condition WHERE LOWER(title_text) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_title_text], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Title text is already exists.", null));
        }

        const _query2 = `INSERT INTO term_condition(title_text, content_text, sort_order, added_by, added_date) VALUES (?, ?, ?, ?, ?) RETURNING "table_id"`;
        const _replacements2 = [_title_text, _content_text, _sort_order, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const table_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].table_id : 0);
        if (table_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Term & condition added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const term_condition_update = async (req, res, next) => {
    const { table_id, title_text, content_text, sort_order } = req.body;
    try {
        var _table_id = table_id && validator.isNumeric(table_id.toString()) ? BigInt(table_id) : 0;
        const _query0 = `SELECT table_id FROM term_condition WHERE table_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_table_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Term & condition details not found.", null));
        }
        const _title_text = (title_text && title_text.length > 0) ? title_text.trim() : "";
        const _content_text = (content_text && content_text.length > 0) ? content_text.trim() : "";
        var _sort_order = sort_order && validator.isNumeric(sort_order.toString()) ? BigInt(sort_order) : 0;

        if (_title_text.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter title text.", null));
        }
        if (_content_text.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter contents.", null));
        }

        const _query1 = `SELECT table_id FROM term_condition WHERE table_id <> ? AND LOWER(title_text) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_table_id, _title_text], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Title text is already exists.", null));
        }

        const _query2 = `UPDATE term_condition SET title_text = ?, content_text = ?, sort_order = ?, modify_by = ?, modify_date = ? WHERE table_id = ?`;
        const _replacements2 = [_title_text, _content_text, _sort_order, req.token_data.account_id, new Date(), _table_id];
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

const term_condition_toggle = async (req, res, next) => {
    const { table_id } = req.body;
    try {
        var _table_id = table_id && validator.isNumeric(table_id.toString()) ? BigInt(table_id) : 0;

        const _query1 = `SELECT table_id, title_text, is_enabled FROM term_condition WHERE table_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_table_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Term & condition details not found.", null));
        }

        const _query2 = `UPDATE term_condition SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE table_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _table_id];
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

const term_condition_delete = async (req, res, next) => {
    const { table_id } = req.body;
    try {
        var _table_id = table_id && validator.isNumeric(table_id.toString()) ? BigInt(table_id) : 0;

        const _query3 = `SELECT table_id FROM term_condition WHERE table_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_table_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Term & condition details not found.", null));
        }
        const _query2 = `UPDATE term_condition SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE table_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _table_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Term & condition deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

module.exports = {
    term_condition_list,
    term_condition_get,
    term_condition_new,
    term_condition_update,
    term_condition_toggle,
    term_condition_delete,
};
