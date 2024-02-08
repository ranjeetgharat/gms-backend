const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const services_head_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM services_head WHERE is_deleted = false AND LOWER(head_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY head_id DESC) AS sr_no,
        head_id, head_name, head_lng_key, is_enabled, added_date, modify_date
        FROM services_head WHERE is_deleted = false AND LOWER(head_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
                head_id: row1[i].head_id,
                head_name: row1[i].head_name,
                head_lng_key: row1[i].head_lng_key,
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

const services_head_get = async (req, res, next) => {
    const { head_id } = req.body;
    try {
        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;

        const _query1 = `SELECT head_id, head_name, head_lng_key, is_enabled, added_date, modify_date FROM services_head WHERE head_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_head_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Service head details not found.", null));
        }
        const results = {
            head_id: row1[0].head_id,
            head_name: row1[0].head_name,
            head_lng_key: row1[0].head_lng_key,
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

const services_head_new = async (req, res, next) => {
    const { head_name, head_lng_key } = req.body;
    try {
        const _head_name = (head_name && head_name.length > 0) ? head_name.trim() : "";
        const _head_lng_key = (head_lng_key && head_lng_key.length > 0) ? head_lng_key.trim() : "";
        if (_head_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter service head name.", null));
        }

        const _query1 = `SELECT head_id FROM services_head WHERE LOWER(head_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_head_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Service head is already exists.", null));
        }

        const _query2 = `INSERT INTO services_head(head_name, head_lng_key, added_by, added_date) VALUES (?, ?, ?, ?) RETURNING "head_id"`;
        const _replacements2 = [_head_name, _head_lng_key, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const head_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].head_id : 0);
        if (head_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Service head added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add service head, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const services_head_update = async (req, res, next) => {
    const { head_id, head_name, head_lng_key } = req.body;
    try {
        const _head_name = (head_name && head_name.length > 0) ? head_name.trim() : "";
        const _head_lng_key = (head_lng_key && head_lng_key.length > 0) ? head_lng_key.trim() : "";
        if (_head_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter service head name.", null));
        }

        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;

        const _query0 = `SELECT head_id FROM services_head WHERE head_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_head_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Service head details not found.", null));
        }

        const _query1 = `SELECT head_id FROM services_head WHERE head_id <> ? AND LOWER(head_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_head_id, _head_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Service head is already exists.", null));
        }

        const _query2 = `UPDATE services_head SET head_name = ?, head_lng_key = ?, modify_by = ?, modify_date = ? WHERE head_id = ?`;
        const _replacements2 = [_head_name, _head_lng_key, req.token_data.account_id, new Date(), _head_id];
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

const services_head_toggle = async (req, res, next) => {
    const { head_id } = req.body;
    try {
        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;

        const _query1 = `SELECT head_id, head_name, is_enabled FROM services_head WHERE head_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_head_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Services head details not found.", null));
        }

        const _query2 = `UPDATE services_head SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE head_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _head_id];
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

const services_head_delete = async (req, res, next) => {
    const { head_id } = req.body;
    try {
        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;

        const _query3 = `SELECT head_id FROM services_head WHERE head_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_head_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Services head details not found.", null));
        }
        const _query2 = `UPDATE services_head SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE head_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _head_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Services head deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

const services_head_dropdown = async (req, res, next) => {
    const { } = req.body;
    try {
        const _query1 = `SELECT head_id, head_name FROM services_head WHERE is_deleted = false AND is_enabled = true `;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                head_id: row1[i].head_id,
                head_name: row1[i].head_name,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};



const services_category_list = async (req, res, next) => {
    const { head_id, page_no, search_text } = req.body;
    try {
        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM services_category WHERE head_id = :head_id AND is_deleted = false AND LOWER(category_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { head_id: _head_id, search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY category_id DESC) AS sr_no,
        category_id, category_name, category_lng_key, head_id, is_enabled, added_date, modify_date
        FROM services_category WHERE head_id = :head_id AND is_deleted = false AND LOWER(category_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                head_id: _head_id,
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
                category_id: row1[i].category_id,
                category_name: row1[i].category_name,
                category_lng_key: row1[i].category_lng_key,
                head_id: row1[i].head_id,
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

const services_category_get = async (req, res, next) => {
    const { category_id } = req.body;
    try {
        var _category_id = category_id && validator.isNumeric(category_id.toString()) ? BigInt(category_id) : 0;

        const _query1 = `SELECT category_id, category_name, category_lng_key, head_id, is_enabled, added_date, modify_date FROM services_category WHERE category_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_category_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Service category details not found.", null));
        }
        const results = {
            category_id: row1[0].category_id,
            category_name: row1[0].category_name,
            category_lng_key: row1[0].category_lng_key,
            head_id: row1[0].head_id,
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

const services_category_new = async (req, res, next) => {
    const { head_id, category_name, category_lng_key } = req.body;
    try {
        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;
        const _category_name = (category_name && category_name.length > 0) ? category_name.trim() : "";
        const _category_lng_key = (category_lng_key && category_lng_key.length > 0) ? category_lng_key.trim() : "";

        if (_category_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter services category name.", null));
        }

        const row00 = await db.sequelize.query("SELECT head_id FROM services_head WHERE head_id = ? AND is_deleted = false",
            { replacements: [_head_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Service head not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT category_id FROM services_category WHERE head_id = ? AND LOWER(category_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_head_id, _category_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Services category is already exists.", null));
        }

        const _query2 = `INSERT INTO services_category(category_name, category_lng_key, head_id, added_by, added_date) VALUES (?, ?, ?, ?, ?) RETURNING "category_id"`;
        const _replacements2 = [_category_name, _category_lng_key, _head_id, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const category_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].category_id : 0);
        if (category_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Services category added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add category, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const services_category_update = async (req, res, next) => {
    const { head_id, category_id, category_name, category_lng_key } = req.body;
    try {
        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;
        var _category_id = category_id && validator.isNumeric(category_id.toString()) ? BigInt(category_id) : 0;
        const _category_name = (category_name && category_name.length > 0) ? category_name.trim() : "";
        const _category_lng_key = (category_lng_key && category_lng_key.length > 0) ? category_lng_key.trim() : "";

        if (_category_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter services category name.", null));
        }

        const _query0 = `SELECT category_id FROM services_category WHERE category_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_category_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Services category details not found.", null));
        }

        const row00 = await db.sequelize.query("SELECT head_id FROM services_head WHERE head_id = ? AND is_deleted = false",
            { replacements: [_head_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Services head not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT category_id FROM services_category WHERE head_id = ? AND category_id <> ? AND LOWER(category_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_head_id, _category_id, _category_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Services category is already exists.", null));
        }

        const _query2 = `UPDATE services_category SET category_name = ?, category_lng_key = ?, modify_by = ?, modify_date = ? WHERE category_id = ?`;
        const _replacements2 = [_category_name, _category_lng_key, req.token_data.account_id, new Date(), _category_id];
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

const services_category_toggle = async (req, res, next) => {
    const { category_id } = req.body;
    try {
        var _category_id = category_id && validator.isNumeric(category_id.toString()) ? BigInt(category_id) : 0;

        const _query1 = `SELECT category_id, category_name, is_enabled FROM services_category WHERE category_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_category_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Services category details not found.", null));
        }

        const _query2 = `UPDATE services_category SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE category_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _category_id];
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

const services_category_delete = async (req, res, next) => {
    const { category_id } = req.body;
    try {
        var _category_id = category_id && validator.isNumeric(category_id.toString()) ? BigInt(category_id) : 0;

        const _query3 = `SELECT category_id FROM services_category WHERE category_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_category_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Services category details not found.", null));
        }
        const _query2 = `UPDATE services_category SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE category_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _category_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Services category deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const services_category_dropdown = async (req, res, next) => {
    const { head_id } = req.body;
    try {
        var _head_id = head_id && validator.isNumeric(head_id.toString()) ? BigInt(head_id) : 0;

        const _query1 = `SELECT category_id, category_name FROM services_category WHERE head_id = ? AND is_deleted = false AND is_enabled = true `;
        const row1 = await db.sequelize.query(_query1, { replacements: [_head_id], type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                category_id: row1[i].category_id,
                category_name: row1[i].category_name,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};




const services_sub_cat_list = async (req, res, next) => {
    const { category_id, page_no, search_text } = req.body;
    try {
        var _category_id = category_id && validator.isNumeric(category_id.toString()) ? BigInt(category_id) : 0;
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM services_sub_cat WHERE category_id = :category_id AND is_deleted = false AND LOWER(sub_cat_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { category_id: _category_id, search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY sub_cat_id DESC) AS sr_no,
        sub_cat_id, sub_cat_name, sub_cat_lng_key, category_id, is_enabled, added_date, modify_date
        FROM services_sub_cat WHERE category_id = :category_id AND is_deleted = false AND LOWER(sub_cat_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                category_id: _category_id,
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
                sub_cat_id: row1[i].sub_cat_id,
                sub_cat_name: row1[i].sub_cat_name,
                sub_cat_lng_key: row1[i].sub_cat_lng_key,
                category_id: row1[i].category_id,
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

const services_sub_cat_get = async (req, res, next) => {
    const { sub_cat_id } = req.body;
    try {
        var _sub_cat_id = sub_cat_id && validator.isNumeric(sub_cat_id.toString()) ? BigInt(sub_cat_id) : 0;

        const _query1 = `SELECT sub_cat_id, sub_cat_name, sub_cat_lng_key, category_id, is_enabled, added_date, modify_date FROM services_sub_cat WHERE sub_cat_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_sub_cat_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Service sub category details not found.", null));
        }
        const results = {
            sub_cat_id: row1[0].sub_cat_id,
            sub_cat_name: row1[0].sub_cat_name,
            sub_cat_lng_key: row1[0].sub_cat_lng_key,
            category_id: row1[0].category_id,
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

const services_sub_cat_new = async (req, res, next) => {
    const { category_id, sub_cat_name, sub_cat_lng_key } = req.body;
    try {
        var _category_id = category_id && validator.isNumeric(category_id.toString()) ? BigInt(category_id) : 0;
        const _sub_cat_name = (sub_cat_name && sub_cat_name.length > 0) ? sub_cat_name.trim() : "";
        const _sub_cat_lng_key = (sub_cat_lng_key && sub_cat_lng_key.length > 0) ? sub_cat_lng_key.trim() : "";

        if (_sub_cat_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter sub category name.", null));
        }

        const row00 = await db.sequelize.query("SELECT category_id FROM services_category WHERE category_id = ? AND is_deleted = false",
            { replacements: [_category_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Services category not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT sub_cat_id FROM services_sub_cat WHERE category_id = ? AND LOWER(sub_cat_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_category_id, _sub_cat_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Sub category is already exists.", null));
        }

        const _query2 = `INSERT INTO services_sub_cat(sub_cat_name, sub_cat_lng_key, category_id, added_by, added_date) VALUES (?, ?, ?, ?, ?) RETURNING "sub_cat_id"`;
        const _replacements2 = [_sub_cat_name, _sub_cat_lng_key, _category_id, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const sub_cat_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].sub_cat_id : 0);
        if (sub_cat_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Sub category added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add sub category, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const services_sub_cat_update = async (req, res, next) => {
    const { sub_cat_id, sub_cat_name, sub_cat_lng_key } = req.body;
    try {
        var _sub_cat_id = sub_cat_id && validator.isNumeric(sub_cat_id.toString()) ? BigInt(sub_cat_id) : 0;
        const _sub_cat_name = (sub_cat_name && sub_cat_name.length > 0) ? sub_cat_name.trim() : "";
        const _sub_cat_lng_key = (sub_cat_lng_key && sub_cat_lng_key.length > 0) ? sub_cat_lng_key.trim() : "";

        if (_sub_cat_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter sub category name.", null));
        }

        const _query0 = `SELECT sub_cat_id, category_id FROM services_sub_cat WHERE sub_cat_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_sub_cat_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Sub category details not found.", null));
        }
        var _category_id = row0[0].category_id && validator.isNumeric(row0[0].category_id.toString()) ? BigInt(row0[0].category_id) : 0;

        const row00 = await db.sequelize.query("SELECT category_id FROM services_category WHERE category_id = ? AND is_deleted = false",
            { replacements: [_category_id], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Services category not found, Please refresh page and try again.", null));
        }

        const _query1 = `SELECT sub_cat_id FROM services_sub_cat WHERE sub_cat_id <> ? AND category_id = ? AND LOWER(sub_cat_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_sub_cat_id, _category_id, _sub_cat_name], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Sub category is already exists.", null));
        }

        const _query2 = `UPDATE services_sub_cat SET sub_cat_name = ?, sub_cat_lng_key = ?, category_id = ?, modify_by = ?, modify_date = ? WHERE sub_cat_id = ?`;
        const _replacements2 = [_sub_cat_name, _sub_cat_lng_key, _category_id, req.token_data.account_id, new Date(), _sub_cat_id];
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

const services_sub_cat_toggle = async (req, res, next) => {
    const { sub_cat_id } = req.body;
    try {
        var _sub_cat_id = sub_cat_id && validator.isNumeric(sub_cat_id.toString()) ? BigInt(sub_cat_id) : 0;

        const _query1 = `SELECT sub_cat_id, sub_cat_name, is_enabled FROM services_sub_cat WHERE sub_cat_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_sub_cat_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Sub category details not found.", null));
        }

        const _query2 = `UPDATE services_sub_cat SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE sub_cat_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _sub_cat_id];
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

const services_sub_cat_delete = async (req, res, next) => {
    const { sub_cat_id } = req.body;
    try {
        var _sub_cat_id = sub_cat_id && validator.isNumeric(sub_cat_id.toString()) ? BigInt(sub_cat_id) : 0;

        const _query3 = `SELECT sub_cat_id FROM services_sub_cat WHERE sub_cat_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_sub_cat_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Sub category details not found.", null));
        }
        const _query2 = `UPDATE services_sub_cat SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE sub_cat_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _sub_cat_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Sub category deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};


module.exports = {
    services_head_list,
    services_head_get,
    services_head_new,
    services_head_update,
    services_head_toggle,
    services_head_delete,
    services_head_dropdown,

    services_category_list,
    services_category_get,
    services_category_new,
    services_category_update,
    services_category_toggle,
    services_category_delete,
    services_category_dropdown,

    services_sub_cat_list,
    services_sub_cat_get,
    services_sub_cat_new,
    services_sub_cat_update,
    services_sub_cat_toggle,
    services_sub_cat_delete,

};
