const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");
const adminDataModule = require('../../modules/adminDataModule');

const project_field_item_search = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM project_field_mast WHERE is_deleted = false AND LOWER(lable_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY m.field_id DESC) AS sr_no,
        m.field_id, m.field_type, m.lable_name, m.placeholder_text, m.is_enabled, m.added_date, m.modify_date
        FROM project_field_mast m WHERE m.is_deleted = false AND LOWER(m.lable_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
            list.push({
                sr_no: row1[i].sr_no,
                field_id: row1[i].field_id,
                field_type: row1[i].field_type,
                lable_name: row1[i].lable_name,
                placeholder_text: row1[i].placeholder_text,
                is_enabled: row1[i].is_enabled,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
            });
        }
        const results = {
            current_page: _page_no,
            total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
            total_record: total_record,
            data: list,
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_field_item_form_data = async (req, res, next) => {
    try {
        var field_type = await adminDataModule.attribute_type_list();
        var validation_type = await adminDataModule.attribute_validation_list();

        const results = {
            field_type: field_type,
            validation_type: validation_type,
        };
        return res.status(200).json(success(true, res.statusCode, "Success.", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_field_item_add_new = async (req, res, next) => {
    const { field_type, lable_name, lable_lng_key, placeholder_text, placeholder_lng_key, field_values, validations } = req.body;
    try {
        const _field_type = (field_type != null && field_type.length > 0) ? field_type.trim() : "";
        const _lable_name = (lable_name != null && lable_name.length > 0) ? lable_name.trim() : "";
        const _lable_lng_key = (lable_lng_key != null && lable_lng_key.length > 0) ? lable_lng_key.trim() : "";
        const _placeholder_text = (placeholder_text != null && placeholder_text.length > 0) ? placeholder_text.trim() : "";
        const _placeholder_lng_key = (placeholder_lng_key != null && placeholder_lng_key.length > 0) ? placeholder_lng_key.trim() : "";
        const _field_valuesTmp = (field_values != null && field_values.length > 0) ? field_values.trim() : "";
        var _validations = [];
        if (validations != null) {
            if (validations.constructor == Array) {
                _validations = validations;
            }
            else {
                if (validations.constructor == String) {
                    _validations = JSON.parse(validations);
                }
            }
        }

        const row00 = await db.sequelize.query("SELECT type_text FROM attribute_type WHERE LOWER(type_text) = LOWER(?)",
            { replacements: [_field_type], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Invalid field type, Please try again.", null));
        }
        var _field_values = ''; var _field_valuesArray = [];
        if (_field_type.toLowerCase() == 'select') {
            if (_field_valuesTmp.length > 0) {
                try {
                    const arr = JSON.parse(_field_valuesTmp);
                    for (let i = 0; arr && i < arr.length; i++) {
                        const ele = arr[i]; var is_exists = false;
                        for (let j = 0; j < _field_valuesArray.length; j++) {
                            if (_field_valuesArray[j].trim().toLowerCase() == ele.trim().toLowerCase()) {
                                is_exists = true; break;
                            }
                        }
                        if (is_exists) {
                            return res.status(200).json(success(false, res.statusCode, "Duplicate option found: Option- \"" + ele + "\"", null));
                        }
                        _field_valuesArray.push(ele);
                    }
                } catch (_) {
                }
            }
            _field_values = JSON.stringify(_field_valuesArray);
        }
        if (_lable_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter field lable name.", null));
        }
        if (_validations && _validations.length > 0) {
            for (let i = 0; i < _validations.length; i++) {
                const vl = _validations[i];
                const _query_11 = `SELECT vld_type_id, vld_type_name, applicable_for, input_required FROM attribute_validation WHERE vld_type_id = ?`;
                const row_11 = await db.sequelize.query(_query_11, { replacements: [vl.vld_type_id], type: QueryTypes.SELECT });
                if (row_11 && row_11.length > 0) {
                    var is_valid_applicable_for = false;
                    if (row_11[0].applicable_for && row_11[0].applicable_for.length > 0) {
                        const applicable_for_list = row_11[0].applicable_for.split(',').join('|');
                        const applicable_for_array = applicable_for_list.split('|');
                        for (let j = 0; applicable_for_array && j < applicable_for_array.length; j++) {
                            const _e = applicable_for_array[j];
                            if (_e && _e.length > 0) {
                                if (_e.trim().toLowerCase() == field_type.toLowerCase()) {
                                    is_valid_applicable_for = true; break;
                                }
                            }
                        }
                    }
                    if (!is_valid_applicable_for) {
                        return res.status(200).json(success(false, res.statusCode, "Validation \"" + row_11[0].vld_type_name + "\" is not applicable for \"" + field_type + "\".", null));
                    }
                    if (row_11[0].input_required && row_11[0].input_required == true) {
                        if (!vl.pattern_value || vl.pattern_value.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Pattern or value is required for validation \"" + row_11[0].vld_type_name + "\".", null));
                        }
                    }
                }
            }
        }

        const _queryChkName = `SELECT field_type FROM project_field_mast WHERE LOWER(lable_name) = LOWER(?) AND is_deleted = false`;
        const rowChkName = await db.sequelize.query(_queryChkName, { replacements: [_lable_name], type: QueryTypes.SELECT });
        if (rowChkName && rowChkName.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Field lable name is already exists.", null));
        }

        const _query2 = `INSERT INTO project_field_mast(field_type, lable_name, lable_lng_key, placeholder_text, placeholder_lng_key,
            field_values, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING "field_id"`;
        const _replacements2 = [_field_type, _lable_name, _lable_lng_key, _placeholder_text, _placeholder_lng_key, _field_values, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const field_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].field_id : 0);
        if (field_id > 0) {
            for (let d = 0; _validations && d < _validations.length; d++) {
                var pattern_value = ''; if (_validations[d].pattern_value) { pattern_value = _validations[d].pattern_value; }
                const _query_12 = `INSERT INTO project_field_validation(field_id, vld_type_id, pattern_value) VALUES (?, ?, ?)`;
                const _replacements_12 = [field_id, _validations[d].vld_type_id, pattern_value];
                await db.sequelize.query(_query_12, { replacements: _replacements_12, type: QueryTypes.INSERT });
            }
            return res.status(200).json(success(true, res.statusCode, "Field added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add field, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_field_item_edit_data = async (req, res, next) => {
    const { field_id } = req.body;
    try {
        const _field_id = field_id && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;

        const _query1 = `SELECT field_id, field_type, lable_name, lable_lng_key, placeholder_text, placeholder_lng_key, field_values
        FROM project_field_mast WHERE field_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Field details not found.", null));
        }

        var validations = [];
        const _query2 = `SELECT vld_type_id, pattern_value FROM project_field_validation WHERE field_id = ?`;
        const row2 = await db.sequelize.query(_query2, { replacements: [_field_id], type: QueryTypes.SELECT });
        for (let i = 0; row2 && i < row2.length; i++) {
            validations.push({
                vld_type_id: row2[i].vld_type_id,
                pattern_value: row2[i].pattern_value,
            });
        }
        const field_data = {
            field_id: row1[0].field_id,
            field_type: row1[0].field_type,
            lable_name: row1[0].lable_name,
            lable_lng_key: row1[0].lable_lng_key,
            placeholder_text: row1[0].placeholder_text,
            placeholder_lng_key: row1[0].placeholder_lng_key,
            field_values: row1[0].field_values,
            validations: validations,
        };
        const field_type = await adminDataModule.attribute_type_list();
        const validation_type = await adminDataModule.attribute_validation_list();
        const results = {
            field_data: field_data,
            field_type: field_type,
            validation_type: validation_type,
        };
        return res.status(200).json(success(true, res.statusCode, "Success.", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_field_item_update = async (req, res, next) => {
    const { field_id, field_type, lable_name, lable_lng_key, placeholder_text, placeholder_lng_key, field_values, validations } = req.body;
    try {
        const _field_id = field_id && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;
        const _query1 = `SELECT field_id, field_type FROM project_field_mast WHERE field_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Field details not found.", null));
        }

        const _field_type = (field_type != null && field_type.length > 0) ? field_type.trim() : "";
        const _lable_name = (lable_name != null && lable_name.length > 0) ? lable_name.trim() : "";
        const _lable_lng_key = (lable_lng_key != null && lable_lng_key.length > 0) ? lable_lng_key.trim() : "";
        const _placeholder_text = (placeholder_text != null && placeholder_text.length > 0) ? placeholder_text.trim() : "";
        const _placeholder_lng_key = (placeholder_lng_key != null && placeholder_lng_key.length > 0) ? placeholder_lng_key.trim() : "";
        const _field_valuesTmp = (field_values != null && field_values.length > 0) ? field_values.trim() : "";
        var _validations = [];
        if (validations != null) {
            if (validations.constructor == Array) {
                _validations = validations;
            }
            else {
                if (validations.constructor == String) {
                    _validations = JSON.parse(validations);
                }
            }
        }

        const row00 = await db.sequelize.query("SELECT type_text FROM attribute_type WHERE LOWER(type_text) = LOWER(?)",
            { replacements: [_field_type.trim()], type: QueryTypes.SELECT });
        var roleExists = (row00 && row00.length > 0) ? true : false;
        if (!roleExists) {
            return res.status(200).json(success(false, res.statusCode, "Invalid field type, Please try again.", null));
        }
        var _field_values = ''; var _field_valuesArray = [];
        if (_field_type.toLowerCase() == 'select') {
            if (_field_valuesTmp.length > 0) {
                try {
                    const arr = JSON.parse(_field_valuesTmp);
                    for (let i = 0; arr && i < arr.length; i++) {
                        const ele = arr[i]; var is_exists = false;
                        for (let j = 0; j < _field_valuesArray.length; j++) {
                            if (_field_valuesArray[j].trim().toLowerCase() == ele.trim().toLowerCase()) {
                                is_exists = true; break;
                            }
                        }
                        if (is_exists) {
                            return res.status(200).json(success(false, res.statusCode, "Duplicate option found: Option- \"" + ele + "\"", null));
                        }
                        _field_valuesArray.push(ele);
                    }
                } catch (_) {
                }
            }
            _field_values = JSON.stringify(_field_valuesArray);
        }
        if (_lable_name.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter field lable name.", null));
        }
        if (_validations && _validations.length > 0) {
            for (let i = 0; i < _validations.length; i++) {
                const vl = _validations[i];
                const _query_11 = `SELECT vld_type_id, vld_type_name, applicable_for, input_required FROM attribute_validation WHERE vld_type_id = ?`;
                const row_11 = await db.sequelize.query(_query_11, { replacements: [vl.vld_type_id], type: QueryTypes.SELECT });
                if (row_11 && row_11.length > 0) {
                    var is_valid_applicable_for = false;
                    if (row_11[0].applicable_for && row_11[0].applicable_for.length > 0) {
                        const applicable_for_list = row_11[0].applicable_for.split(',').join('|');
                        const applicable_for_array = applicable_for_list.split('|');
                        for (let j = 0; applicable_for_array && j < applicable_for_array.length; j++) {
                            const _e = applicable_for_array[j];
                            if (_e && _e.length > 0) {
                                if (_e.trim().toLowerCase() == field_type.toLowerCase()) {
                                    is_valid_applicable_for = true; break;
                                }
                            }
                        }
                    }
                    if (!is_valid_applicable_for) {
                        return res.status(200).json(success(false, res.statusCode, "Validation \"" + row_11[0].vld_type_name + "\" is not applicable for \"" + field_type + "\".", null));
                    }
                    if (row_11[0].input_required && row_11[0].input_required == true) {
                        if (!vl.pattern_value || vl.pattern_value.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Pattern or value is required for validation \"" + row_11[0].vld_type_name + "\".", null));
                        }
                    }
                }
            }
        }

        const _queryChkName = `SELECT field_type FROM project_field_mast WHERE field_id <> ? AND LOWER(lable_name) = LOWER(?) AND is_deleted = false`;
        const rowChkName = await db.sequelize.query(_queryChkName, { replacements: [_field_id, _lable_name], type: QueryTypes.SELECT });
        if (rowChkName && rowChkName.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Field lable name is already exists.", null));
        }


        const _query2 = `UPDATE project_field_mast SET field_type = ?, lable_name = ?, lable_lng_key = ?, placeholder_text = ?,
        placeholder_lng_key = ?, field_values = ?, modify_by = ?, modify_date = ? WHERE field_id = ?`;
        const _replacements2 = [_field_type, _lable_name, _lable_lng_key, _placeholder_text, _placeholder_lng_key, _field_values, req.token_data.account_id, new Date(), _field_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            for (let d = 0; _validations && d < _validations.length; d++) {
                var pattern_value = ''; if (_validations[d].pattern_value) { pattern_value = _validations[d].pattern_value; }
                const _query3 = `INSERT INTO project_field_validation(field_id, vld_type_id, pattern_value) 
                SELECT :field_id, :vld_type_id, :pattern_value WHERE NOT EXISTS (
                    SELECT vld_type_id FROM project_field_validation WHERE field_id = :field_id AND vld_type_id = :vld_type_id
                )`;
                await db.sequelize.query(_query3, {
                    replacements: {
                        field_id: _field_id, vld_type_id: _validations[d].vld_type_id, pattern_value: pattern_value
                    }, type: QueryTypes.INSERT
                });
                const _query5 = `UPDATE project_field_validation SET pattern_value = ? WHERE field_id = ? AND vld_type_id = ?`;
                await db.sequelize.query(_query5, { replacements: [pattern_value, _field_id, _validations[d].vld_type_id], type: QueryTypes.UPDATE });
            }
            var temp = [];
            for (let k = 0; _validations && k < _validations.length; k++) {
                temp.push(_validations[k].vld_type_id);
            }
            if (temp.length > 0) {
                const _query4 = `DELETE FROM project_field_validation WHERE field_id = ? AND vld_type_id NOT IN (?)`;
                await db.sequelize.query(_query4, { replacements: [_field_id, temp], type: QueryTypes.DELETE });
            } else {
                const _query4 = `DELETE FROM project_field_validation WHERE field_id = ?`;
                await db.sequelize.query(_query4, { replacements: [_field_id], type: QueryTypes.DELETE });
            }
            return res.status(200).json(success(true, res.statusCode, "Updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_field_item_toggle = async (req, res, next) => {
    const { field_id } = req.body;
    try {
        var _field_id = field_id != null && validator.isNumeric(field_id.toString()) ? parseInt(field_id) : 0;

        const _query1 = `SELECT field_id, lable_name, is_enabled FROM project_field_mast WHERE field_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Field details not found.", null));
        }
        const _query2 = `UPDATE project_field_mast SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE field_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _field_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Status changed successfully.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Unable to change, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, err.message, null));
    }
};

const project_field_item_delete = async (req, res, next) => {
    const { field_id } = req.body;
    try {
        var _field_id = field_id != null && validator.isNumeric(field_id.toString()) ? parseInt(field_id) : 0;
        const _query3 = `SELECT field_id FROM project_field_mast WHERE field_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Field details not found.", null));
        }
        const _query2 = `UPDATE project_field_mast SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE field_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _field_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Field deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    project_field_item_search,
    project_field_item_form_data,
    project_field_item_add_new,
    project_field_item_edit_data,
    project_field_item_update,
    project_field_item_toggle,
    project_field_item_delete,
};