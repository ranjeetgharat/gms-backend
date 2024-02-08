const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const fileTypeList = require('../../constants/fileTypeList');
const { apiStatus } = require("../../constants/apiStatus");
const constants = require("../../constants/constants");

const rfp_doc_mast_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM rfp_doc_mast WHERE is_deleted = false AND LOWER(doc_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY CASE WHEN COALESCE(m.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(m.sort_order, 0) END, m.document_id DESC) AS sr_no,
        m.document_id, m.doc_name, m.doc_lng_key, m.file_type_allowed, m.file_max_size, m.is_enabled, m.added_date, m.modify_date
        FROM rfp_doc_mast m WHERE m.is_deleted = false AND LOWER(m.doc_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no
            },
            type: QueryTypes.SELECT
        });
        var list = []; const project_purpose = constants.project_purpose;
        for (let i = 0; row1 && i < row1.length; i++) {
            var map_purpose = [];
            const _query2 = `SELECT m.purpose_id, m.is_required FROM rfp_doc_mapp m WHERE m.document_id = ?`;
            const row2 = await db.sequelize.query(_query2, { replacements: [row1[i].document_id], type: QueryTypes.SELECT });
            for (let j = 0; row2 && j < row2.length; j++) {
                var purpose_name = '';
                for (let d = 0; project_purpose && d < project_purpose.length; d++) {
                    if (project_purpose[d].id.toString() == row2[j].purpose_id.toString()) {
                        purpose_name = project_purpose[d].name; break;
                    }
                }
                map_purpose.push({
                    purpose_id: row2[j].purpose_id,
                    purpose_name: purpose_name,
                    is_required: row2[j].is_required,
                });
            }
            list.push({
                sr_no: row1[i].sr_no,
                document_id: row1[i].document_id,
                doc_name: row1[i].doc_name,
                doc_lng_key: row1[i].doc_lng_key,
                file_type_allowed: row1[i].file_type_allowed,
                file_max_size: row1[i].file_max_size,
                map_purpose: map_purpose,
                is_enabled: row1[i].is_enabled,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
            });
        }
        const file_types = fileTypeList;
        const results = {
            current_page: _page_no,
            total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
            data: list,
            file_types: file_types,
            project_purpose: project_purpose,
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const rfp_doc_mast_get = async (req, res, next) => {
    const { document_id } = req.body;
    try {
        var _document_id = document_id && validator.isNumeric(document_id.toString()) ? BigInt(document_id) : 0;

        const _query1 = `SELECT document_id, doc_name, doc_lng_key, file_type_allowed, file_max_size, is_enabled, added_date, modify_date FROM rfp_doc_mast WHERE document_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_document_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Document details not found.", null));
        }
        var map_purpose = []; const project_purpose = constants.project_purpose;
        const _query2 = `SELECT m.purpose_id, m.is_required FROM rfp_doc_mapp m WHERE m.document_id = ?`;
        const row2 = await db.sequelize.query(_query2, { replacements: [row1[0].document_id], type: QueryTypes.SELECT });
        for (let j = 0; row2 && j < row2.length; j++) {
            var purpose_name = '';
            for (let d = 0; project_purpose && d < project_purpose.length; d++) {
                if (project_purpose[d].id.toString() == row2[j].purpose_id.toString()) {
                    purpose_name = project_purpose[d].name; break;
                }
            }
            map_purpose.push({
                purpose_id: row2[j].purpose_id,
                purpose_name: purpose_name,
                is_required: row2[j].is_required,
            });
        }
        const results = {
            document_id: row1[0].document_id,
            doc_name: row1[0].doc_name,
            doc_lng_key: row1[0].doc_lng_key,
            file_type_allowed: row1[0].file_type_allowed,
            file_max_size: row1[0].file_max_size,
            is_enabled: row1[0].is_enabled,
            map_purpose: map_purpose,
            added_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].added_date)),
            modify_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].modify_date)),
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const rfp_doc_mast_new = async (req, res, next) => {
    const { doc_name, doc_lng_key, file_type_allowed, file_max_size, map_purpose, sort_order } = req.body;
    try {
        if (!doc_name || doc_name.length <= 0 || doc_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter document name.", null));
        }
        var _file_max_size = file_max_size != null && validator.isNumeric(file_max_size.toString()) ? BigInt(file_max_size) : 0;
        var _sort_order = sort_order != null && validator.isNumeric(sort_order.toString()) ? BigInt(sort_order) : 0;

        const _query1 = `SELECT document_id FROM rfp_doc_mast WHERE LOWER(doc_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [doc_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Document name is already exists.", null));
        }
        var _file_type_allowed = [];
        if (file_type_allowed && file_type_allowed.length > 0) {
            const file_type_allowed_list = file_type_allowed.split(',').join('|');
            const file_type_allowed_array = file_type_allowed_list.split('|');
            for (let i = 0; file_type_allowed_array && i < file_type_allowed_array.length; i++) {
                const element = file_type_allowed_array[i];
                if (element && element.length > 0) {
                    var is_exists = false;
                    for (let g = 0; _file_type_allowed && g < _file_type_allowed.length; g++) {
                        if (_file_type_allowed[g].trim() == element.trim()) {
                            is_exists = true; break;
                        }
                    }
                    if (!is_exists) {
                        _file_type_allowed.push(element.trim());
                    }
                }
            }
        }
        if (_file_type_allowed.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select allowed file type.", null));
        }

        for (let t = 0; _file_type_allowed && t < _file_type_allowed.length; t++) {
            var exists = false;
            for (let w = 0; fileTypeList && w < fileTypeList.length; w++) {
                if (fileTypeList[w].trim().toLowerCase() == _file_type_allowed[t].trim().toLowerCase()) {
                    exists = true; break;
                }
            }
            if (!exists) {
                return res.status(200).json(success(false, res.statusCode, _file_type_allowed[t] + " is not a valid file type to allowed.", null));
            }
        }

        if (_file_max_size <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter file size max limit in KB.", null));
        }
        var _map_purpose = map_purpose;
        if (_map_purpose.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable project purpose.", null));
        }

        const _query2 = `INSERT INTO rfp_doc_mast(doc_name, doc_lng_key, file_type_allowed, file_max_size, added_by, added_date, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING "document_id"`;
        const _replacements2 = [doc_name.trim(), doc_lng_key.trim(), _file_type_allowed.join(','), _file_max_size, req.token_data.account_id, new Date(), _sort_order];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const document_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].document_id : 0);
        if (document_id > 0) {
            for (let k = 0; _map_purpose && k < _map_purpose.length; k++) {
                const _query3 = `INSERT INTO rfp_doc_mapp(document_id, purpose_id, is_required) VALUES (?, ?, ?)`;
                const _replacements3 = [document_id, _map_purpose[k].purpose_id, _map_purpose[k].is_required];
                await db.sequelize.query(_query3, { replacements: _replacements3, type: QueryTypes.INSERT });
            }
            return res.status(200).json(success(true, res.statusCode, "Document added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add document, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const rfp_doc_mast_update = async (req, res, next) => {
    const { document_id, doc_name, doc_lng_key, file_type_allowed, file_max_size, map_purpose, sort_order } = req.body;
    try {
        if (!doc_name || doc_name.length <= 0 || doc_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter document name.", null));
        }
        var _document_id = document_id && validator.isNumeric(document_id.toString()) ? BigInt(document_id) : 0;
        var _sort_order = sort_order && validator.isNumeric(sort_order.toString()) ? BigInt(sort_order) : 0;

        const _query0 = `SELECT document_id FROM rfp_doc_mast WHERE document_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_document_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Document details not found.", null));
        }
        var _file_max_size = file_max_size != null && validator.isNumeric(file_max_size.toString()) ? BigInt(file_max_size) : 0;

        const _query1 = `SELECT document_id FROM rfp_doc_mast WHERE document_id <> ? AND LOWER(doc_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_document_id, doc_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Document name is already exists.", null));
        }
        var _file_type_allowed = [];
        if (file_type_allowed && file_type_allowed.length > 0) {
            const file_type_allowed_list = file_type_allowed.split(',').join('|');
            const file_type_allowed_array = file_type_allowed_list.split('|');
            for (let i = 0; file_type_allowed_array && i < file_type_allowed_array.length; i++) {
                const element = file_type_allowed_array[i];
                if (element && element.length > 0) {
                    var is_exists = false;
                    for (let g = 0; _file_type_allowed && g < _file_type_allowed.length; g++) {
                        if (_file_type_allowed[g].trim() == element.trim()) {
                            is_exists = true; break;
                        }
                    }
                    if (!is_exists) {
                        _file_type_allowed.push(element.trim());
                    }
                }
            }
        }
        if (_file_type_allowed.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select allowed file type.", null));
        }
        for (let t = 0; _file_type_allowed && t < _file_type_allowed.length; t++) {
            var exists = false;
            for (let w = 0; fileTypeList && w < fileTypeList.length; w++) {
                if (fileTypeList[w].trim().toLowerCase() == _file_type_allowed[t].trim().toLowerCase()) {
                    exists = true; break;
                }
            }
            if (!exists) {
                return res.status(200).json(success(false, res.statusCode, _file_type_allowed[t] + " is not a valid file type to allowed.", null));
            }
        }

        if (_file_max_size <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter file size max limit in KB.", null));
        }
        var _map_purpose = map_purpose;
        if (_map_purpose.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable project purpose.", null));
        }

        const _query2 = `UPDATE rfp_doc_mast SET sort_order = ?, doc_name = ?, doc_lng_key = ?, file_type_allowed = ?, file_max_size = ?, modify_by = ?, modify_date = ? WHERE document_id = ?`;
        const _replacements2 = [_sort_order, doc_name.trim(), doc_lng_key.trim(), _file_type_allowed.join(','), _file_max_size, req.token_data.account_id, new Date(), _document_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            for (let k = 0; _map_purpose && k < _map_purpose.length; k++) {
                const _query3 = `INSERT INTO rfp_doc_mapp(document_id, purpose_id, is_required) 
                SELECT :document_id, :purpose_id, :is_required WHERE NOT EXISTS (
                    SELECT purpose_id FROM rfp_doc_mapp WHERE document_id = :document_id AND purpose_id = :purpose_id
                )`;
                await db.sequelize.query(_query3, {
                    replacements: {
                        document_id: _document_id,
                        purpose_id: _map_purpose[k].purpose_id,
                        is_required: _map_purpose[k].is_required
                    }, type: QueryTypes.INSERT
                });

                const _query5 = `UPDATE rfp_doc_mapp SET is_required = ? WHERE document_id = ? AND purpose_id = ?`;
                await db.sequelize.query(_query5, { replacements: [_map_purpose[k].is_required, _document_id, _map_purpose[k].purpose_id], type: QueryTypes.UPDATE });
            }
            var temp = [];
            for (let k = 0; _map_purpose && k < _map_purpose.length; k++) {
                temp.push(_map_purpose[k].purpose_id);
            }
            const _query4 = `DELETE FROM rfp_doc_mapp WHERE document_id = ? AND purpose_id NOT IN (?)`;
            await db.sequelize.query(_query4, { replacements: [_document_id, temp], type: QueryTypes.DELETE });

            return res.status(200).json(success(true, res.statusCode, "Updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const rfp_doc_mast_toggle = async (req, res, next) => {
    const { document_id } = req.body;
    try {
        var _document_id = document_id && validator.isNumeric(document_id.toString()) ? BigInt(document_id) : 0;

        const _query1 = `SELECT document_id, doc_name, is_enabled FROM rfp_doc_mast WHERE document_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_document_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Document details not found.", null));
        }

        const _query2 = `UPDATE rfp_doc_mast SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE document_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _document_id];
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

const rfp_doc_mast_delete = async (req, res, next) => {
    const { document_id } = req.body;
    try {
        var _document_id = document_id && validator.isNumeric(document_id.toString()) ? BigInt(document_id) : 0;

        const _query3 = `SELECT document_id FROM rfp_doc_mast WHERE document_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_document_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Document details not found.", null));
        }
        const _query2 = `UPDATE rfp_doc_mast SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE document_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _document_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Document deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

module.exports = {
    rfp_doc_mast_list,
    rfp_doc_mast_get,
    rfp_doc_mast_new,
    rfp_doc_mast_update,
    rfp_doc_mast_toggle,
    rfp_doc_mast_delete,
};