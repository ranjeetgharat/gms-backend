const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");


const accreditation_question_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM accreditation_question WHERE is_deleted = false AND LOWER(que_text) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY CASE WHEN COALESCE(m.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(m.sort_order, 0) END, m.que_id DESC) AS sr_no,
        m.que_id, m.que_text, m.applicable_levels, m.sort_order, m.is_enabled, m.added_date, m.modify_date
        FROM accreditation_question m WHERE m.is_deleted = false AND LOWER(m.que_text) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
            var map_level = [];
            if (row1[i].applicable_levels && row1[i].applicable_levels.length > 0) {
                const _query2 = `SELECT level_id, level_name FROM accreditation_level WHERE level_id IN (?) ORDER BY level_rank`;
                const row2 = await db.sequelize.query(_query2, { replacements: [row1[i].applicable_levels], type: QueryTypes.SELECT });
                for (let j = 0; row2 && j < row2.length; j++) {
                    map_level.push({
                        level_id: row2[j].level_id,
                        level_name: row2[j].level_name,
                    });
                }
            }
            list.push({
                sr_no: row1[i].sr_no,
                que_id: row1[i].que_id,
                que_text: row1[i].que_text,
                sort_order: row1[i].sort_order,
                map_level: map_level,
                is_enabled: row1[i].is_enabled,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
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

const accreditation_question_get = async (req, res, next) => {
    const { que_id } = req.body;
    try {
        var _que_id = que_id && validator.isNumeric(que_id.toString()) ? BigInt(que_id) : 0;

        const _query1 = `SELECT que_id, que_text, applicable_levels, sort_order, is_enabled, added_date, modify_date FROM accreditation_question WHERE que_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_que_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Evaluation question details not found.", null));
        }
        var map_level = [];
        if (row1[0].applicable_levels && row1[0].applicable_levels.length > 0) {
            const _query2 = `SELECT level_id, level_name FROM accreditation_level WHERE level_id IN (?) ORDER BY level_rank`;
            const row2 = await db.sequelize.query(_query2, { replacements: [row1[0].applicable_levels], type: QueryTypes.SELECT });
            for (let j = 0; row2 && j < row2.length; j++) {
                map_level.push({
                    level_id: row2[j].level_id,
                    level_name: row2[j].level_name,
                });
            }
        }

        const results = {
            que_id: row1[0].que_id,
            que_text: row1[0].que_text,
            sort_order: row1[0].sort_order,
            map_level: map_level,
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

const accreditation_question_new = async (req, res, next) => {
    const { que_text, map_level, sort_order } = req.body;
    try {
        const _que_text = (que_text && que_text.length > 0) ? que_text.trim() : "";
        var _sort_order = sort_order && validator.isNumeric(sort_order.toString()) ? BigInt(sort_order) : 0;

        if (_que_text.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter evaluation question text.", null));
        }

        const _query1 = `SELECT que_id FROM accreditation_question WHERE LOWER(que_text) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_que_text], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Evaluation question is already exists.", null));
        }
        var _map_level = [];
        for (let i = 0; map_level && i < map_level.length; i++) {
            var _t = map_level[i] && validator.isNumeric(map_level[i].toString()) ? BigInt(map_level[i]) : 0;
            if (_t > 0) {
                _map_level.push(_t);
            }
        }
        if (_map_level.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable level.", null));
        }

        const _query2 = `INSERT INTO accreditation_question(que_text, applicable_levels, sort_order, added_by, added_date) VALUES (?, ARRAY[?]::bigint[], ?, ?, ?) RETURNING "que_id"`;
        const _replacements2 = [_que_text, _map_level, _sort_order, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const que_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].que_id : 0);
        if (que_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Evaluation question added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add evaluation question, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const accreditation_question_update = async (req, res, next) => {
    const { que_id, que_text, map_level, sort_order } = req.body;
    try {
        var _que_id = que_id && validator.isNumeric(que_id.toString()) ? BigInt(que_id) : 0;
        const _que_text = (que_text && que_text.length > 0) ? que_text.trim() : "";

        if (_que_text.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter evaluation question text.", null));
        }
        var _sort_order = sort_order && validator.isNumeric(sort_order.toString()) ? BigInt(sort_order) : 0;

        const _query0 = `SELECT que_id FROM accreditation_question WHERE que_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_que_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Evaluation question details not found.", null));
        }

        const _query1 = `SELECT que_id FROM accreditation_question WHERE que_id <> ? AND LOWER(que_text) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_que_id, _que_text], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Evaluation question is already exists.", null));
        }

        var _map_level = [];
        for (let i = 0; map_level && i < map_level.length; i++) {
            var _t = map_level[i] && validator.isNumeric(map_level[i].toString()) ? BigInt(map_level[i]) : 0;
            if (_t > 0) {
                _map_level.push(_t);
            }
        }
        if (_map_level.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable level.", null));
        }

        const _query2 = `UPDATE accreditation_question SET que_text = ?, applicable_levels = ARRAY[?]::bigint[], sort_order = ?, modify_by = ?, modify_date = ? WHERE que_id = ?`;
        const _replacements2 = [_que_text, _map_level, _sort_order, req.token_data.account_id, new Date(), _que_id];
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

const accreditation_question_toggle = async (req, res, next) => {
    const { que_id } = req.body;
    try {
        var _que_id = que_id && validator.isNumeric(que_id.toString()) ? BigInt(que_id) : 0;

        const _query1 = `SELECT que_id, que_text, is_enabled FROM accreditation_question WHERE que_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_que_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Evaluation question details not found.", null));
        }

        const _query2 = `UPDATE accreditation_question SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE que_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _que_id];
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

const accreditation_question_delete = async (req, res, next) => {
    const { que_id } = req.body;
    try {
        var _que_id = que_id && validator.isNumeric(que_id.toString()) ? BigInt(que_id) : 0;

        const _query3 = `SELECT que_id FROM accreditation_question WHERE que_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_que_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Evaluation question details not found.", null));
        }
        const _query2 = `UPDATE accreditation_question SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE que_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _que_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Evaluation question deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

module.exports = {
    accreditation_question_list,
    accreditation_question_get,
    accreditation_question_new,
    accreditation_question_update,
    accreditation_question_toggle,
    accreditation_question_delete,
};