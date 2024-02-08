const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");
const adminDataModule = require('../../modules/adminDataModule');
const constants = require("../../constants/constants");

const entity_type_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM entity_type WHERE LOWER(entity_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY entity_id) AS sr_no,
        entity_id, entity_name, reg_allowed, auto_approve_enabled, modify_date
        FROM entity_type WHERE LOWER(entity_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
                entity_id: row1[i].entity_id,
                entity_name: row1[i].entity_name,
                reg_allowed: row1[i].reg_allowed,
                auto_approve_enabled: row1[i].auto_approve_enabled,
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

const entity_type_reg_toggle = async (req, res, next) => {
    const { entity_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query1 = `SELECT entity_id, entity_name, reg_allowed FROM entity_type WHERE entity_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Entity details not found.", null));
        }

        const _query2 = `UPDATE entity_type SET reg_allowed = CASE WHEN reg_allowed = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE entity_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _entity_id];
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

const entity_type_dropdown = async (req, res, next) => {
    const { } = req.body;
    try {
        const _query1 = `SELECT entity_id, entity_name, registration_flow_by_reg_type_id
        FROM entity_type ORDER BY entity_id`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                entity_id: row1[i].entity_id,
                entity_name: row1[i].entity_name,
                registration_flow_by_reg_type_id: row1[i].registration_flow_by_reg_type_id,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_type_manage_view = async (req, res, next) => {
    const { entity_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query00 = `SELECT entity_id, entity_name, entity_lng_key, is_individual, reg_allowed, prerequisite_text,
        prerequisite_enabled, platform_fee_enabled, registration_flow_by_reg_type_id FROM entity_type WHERE entity_id = ?`;
        const row00 = await db.sequelize.query(_query00, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row00 || row00.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity details not found.", null));
        }
        var platform_fee_amount = 0;

        const _query1 = `SELECT amount FROM entity_platform_fees WHERE entity_id = ? ORDER BY table_id DESC LIMIT 1`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            platform_fee_amount = row1[0].amount;
        }
        var field_map_data = null;
        const registration_flow_by_reg_type_id = row00[0].registration_flow_by_reg_type_id && row00[0].registration_flow_by_reg_type_id == true ? true : false;
        if (registration_flow_by_reg_type_id) {
            const _query51 = `SELECT tm.reg_type_id, tm.reg_type_name 
            FROM entity_reg_type_mast tm INNER JOIN entity_reg_type_mapp tc ON tm.reg_type_id = tc.reg_type_id
            WHERE tc.entity_id = ? AND tm.is_deleted = false`
            const row51 = await db.sequelize.query(_query51, { replacements: [_entity_id], type: QueryTypes.SELECT });
            var temp_map_reg_type = [];
            for (let g = 0; row51 && g < row51.length; g++) {
                const _query52 = `SELECT f.static_field_id, f.field_label, COALESCE(m.is_added, 0) AS is_added, COALESCE(m.is_required, false) AS is_required,
                COALESCE(m.label_text, '') AS label_text, COALESCE(m.label_lng_key, '') AS label_lng_key
                FROM reg_static_field_item f
                LEFT JOIN LATERAL (
                    SELECT COALESCE(em.entity_id, 0) AS is_added, em.is_required, em.label_text, em.label_lng_key 
                    FROM reg_static_field_map_entity em WHERE em.static_field_id = f.static_field_id AND em.entity_id = :entity_id AND em.reg_type_id = :reg_type_id
                    FETCH FIRST 1 ROW ONLY
                ) m ON true
                WHERE f.flow_by_reg_type_id = true
                ORDER BY CASE WHEN COALESCE(sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(sort_order, 0) END`;
                const row52 = await db.sequelize.query(_query52, { replacements: { entity_id: _entity_id, reg_type_id: row51[g].reg_type_id }, type: QueryTypes.SELECT });
                var temp_map_entity = [];
                for (let h = 0; row52 && h < row52.length; h++) {
                    var is_added = row52[h].is_added && validator.isNumeric(row52[h].is_added.toString()) ? BigInt(row52[h].is_added) : 0;
                    var doc_childs = [];
                    var __static_field_id = row52[h].static_field_id && validator.isNumeric(row52[h].static_field_id.toString()) ? BigInt(row52[h].static_field_id) : 0;
                    if (__static_field_id.toString() == '34') {
                        const _query53 = `SELECT dm.document_id, dm.doc_name, COALESCE(m.is_added, 0) AS is_added, COALESCE(m.is_required, false) AS is_required
                        FROM document_mast dm INNER JOIN document_mapp dc ON dm.document_id = dc.document_id
                        LEFT JOIN LATERAL (
                            SELECT COALESCE(md.document_id, 0) AS is_added, md.is_required FROM reg_static_field_map_docs md
                            WHERE md.entity_id = dc.entity_id AND md.document_id = dm.document_id AND md.reg_type_id = :reg_type_id
                        ) m ON true
                        WHERE dc.entity_id = :entity_id AND dm.is_deleted = false
                        ORDER BY CASE WHEN COALESCE(dm.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(dm.sort_order, 0) END`;
                        const row53 = await db.sequelize.query(_query53, { replacements: { entity_id: _entity_id, reg_type_id: row51[g].reg_type_id }, type: QueryTypes.SELECT });
                        for (let d = 0; row53 && d < row53.length; d++) {
                            var doc_is_added = row53[d].is_added && validator.isNumeric(row53[d].is_added.toString()) ? BigInt(row53[d].is_added) : 0;
                            doc_childs.push({
                                document_id: row53[d].document_id,
                                doc_name: row53[d].doc_name,
                                is_added: (doc_is_added > 0),
                                is_required: (row53[d].is_required && row53[d].is_required == true ? true : false),
                            });
                        }
                    }
                    temp_map_entity.push({
                        field_id: row52[h].static_field_id,
                        field_label: row52[h].field_label,
                        label_text: row52[h].label_text,
                        label_lng_key: row52[h].label_lng_key,
                        is_added: (is_added > 0),
                        is_required: (row52[h].is_required && row52[h].is_required == true ? true : false),
                        documents: doc_childs,
                    });
                }
                temp_map_reg_type.push({
                    reg_type_id: row51[g].reg_type_id,
                    reg_type_name: row51[g].reg_type_name,
                    static_field_map_entity: temp_map_entity,
                });
            }
            const _query89 = `SELECT f.static_field_id, f.field_label, COALESCE(m.is_added, 0) AS is_added, COALESCE(m.is_required, false) AS is_required,
            COALESCE(m.label_text, '') AS label_text, COALESCE(m.label_lng_key, '') AS label_lng_key
            FROM reg_static_field_item f
            LEFT JOIN LATERAL (
                SELECT COALESCE(em.entity_id, 0) AS is_added, em.is_required, em.label_text, em.label_lng_key 
                FROM reg_static_field_map_entity em WHERE em.static_field_id = f.static_field_id AND em.entity_id = :entity_id
                FETCH FIRST 1 ROW ONLY
            ) m ON true
            WHERE f.flow_by_reg_type_id = false
            ORDER BY CASE WHEN COALESCE(sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(sort_order, 0) END`;
            const row89 = await db.sequelize.query(_query89, { replacements: { entity_id: _entity_id }, type: QueryTypes.SELECT });
            var temp_map_entity = [];
            for (let j = 0; row89 && j < row89.length; j++) {
                var is_added = row89[j].is_added && validator.isNumeric(row89[j].is_added.toString()) ? BigInt(row89[j].is_added) : 0;
                temp_map_entity.push({
                    field_id: row89[j].static_field_id,
                    field_label: row89[j].field_label,
                    label_text: row89[j].label_text,
                    label_lng_key: row89[j].label_lng_key,
                    is_added: (is_added > 0),
                    is_required: (row89[j].is_required && row89[j].is_required == true ? true : false),
                });
            }
            field_map_data = {
                static_field_map_reg_type: temp_map_reg_type,
                static_field_map_entity: temp_map_entity,
            };
        } else {
            const _query11 = `SELECT f.static_field_id, f.field_label, COALESCE(m.is_added, 0) AS is_added, COALESCE(m.is_required, false) AS is_required,
                COALESCE(m.label_text, '') AS label_text, COALESCE(m.label_lng_key, '') AS label_lng_key
                FROM reg_static_field_item f
                LEFT JOIN LATERAL (
                    SELECT COALESCE(em.entity_id, 0) AS is_added, em.is_required, em.label_text, em.label_lng_key 
                    FROM reg_static_field_map_entity em WHERE em.static_field_id = f.static_field_id AND em.entity_id = :entity_id
                    FETCH FIRST 1 ROW ONLY
                ) m ON true
                ORDER BY CASE WHEN COALESCE(sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(sort_order, 0) END`;
            const row11 = await db.sequelize.query(_query11, { replacements: { entity_id: _entity_id }, type: QueryTypes.SELECT });
            var temp_map_entity = [];
            for (let j = 0; row11 && j < row11.length; j++) {
                var is_added = row11[j].is_added && validator.isNumeric(row11[j].is_added.toString()) ? BigInt(row11[j].is_added) : 0;
                temp_map_entity.push({
                    field_id: row11[j].static_field_id,
                    field_label: row11[j].field_label,
                    label_text: row11[j].label_text,
                    label_lng_key: row11[j].label_lng_key,
                    is_added: (is_added > 0),
                    is_required: (row11[j].is_required && row11[j].is_required == true ? true : false),
                });
            }
            field_map_data = {
                static_field_map_entity: temp_map_entity
            };
        }

        const results = {
            entity_id: row00[0].entity_id,
            entity_name: row00[0].entity_name,
            entity_lng_key: row00[0].entity_lng_key,
            is_individual: row00[0].is_individual,
            reg_allowed: row00[0].reg_allowed,
            registration_flow_by_reg_type_id: registration_flow_by_reg_type_id,
            prerequisite_text: row00[0].prerequisite_text,
            prerequisite_enabled: row00[0].prerequisite_enabled,
            platform_fee_amount: platform_fee_amount,
            platform_fee_enabled: row00[0].platform_fee_enabled,
            field_map_data: field_map_data,
        };

        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_prerequisite_update = async (req, res, next) => {
    const { entity_id, prerequisite_text } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query00 = `SELECT entity_id FROM entity_type WHERE entity_id = ?`;
        const row00 = await db.sequelize.query(_query00, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row00 || row00.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity details not found.", null));
        }

        const _query2 = `UPDATE entity_type SET prerequisite_text = ?, prerequisite_modify_date = ?, prerequisite_modify_by = ? WHERE entity_id = ?`;
        const _replacements2 = [prerequisite_text, new Date(), req.token_data.account_id, _entity_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Prerequisite updated successfully.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Unable to update, Please try again.", null));
        }

    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_prerequisite_toggle = async (req, res, next) => {
    const { entity_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query00 = `SELECT entity_id, prerequisite_enabled FROM entity_type WHERE entity_id = ?`;
        const row00 = await db.sequelize.query(_query00, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row00 || row00.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity details not found.", null));
        }
        var prerequisite_enabled = (row00[0].prerequisite_enabled && row00[0].prerequisite_enabled == true) ? false : true;

        const _query2 = `UPDATE entity_type SET prerequisite_enabled = ?, prerequisite_modify_date = ?, prerequisite_modify_by = ? WHERE entity_id = ?`;
        const _replacements2 = [prerequisite_enabled, new Date(), req.token_data.account_id, _entity_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Prerequisite status changed.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Unable to change, Please try again.", null));
        }

    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_platform_fee_update = async (req, res, next) => {
    const { entity_id, amount } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query00 = `SELECT entity_id, entity_name FROM entity_type WHERE entity_id = ?`;
        const row00 = await db.sequelize.query(_query00, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row00 || row00.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity details not found.", null));
        }
        var _amount = amount && validator.isNumeric(amount.toString()) ? parseFloat(amount) : 0;
        if (_amount <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter platform fee.", null));
        }

        var platform_fee_amount = 0;
        const _query1 = `SELECT amount FROM entity_platform_fees WHERE entity_id = ? ORDER BY table_id DESC LIMIT 1`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            platform_fee_amount = row1[0].amount;
        }
        if (_amount == platform_fee_amount) {
            return res.status(200).json(success(false, res.statusCode, "Platform fee is same as previous.", null));
        }

        const _query2 = `INSERT INTO entity_platform_fees(entity_id, amount, added_by, added_date)VALUES (?, ?, ?, ?) RETURNING "table_id"`;
        const _replacements2 = [_entity_id, _amount, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const table_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].table_id : 0);
        if (table_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Platform fee updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update fee, Please try again", null));
        }

    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_platform_fee_toggle = async (req, res, next) => {
    const { entity_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query00 = `SELECT entity_id, platform_fee_enabled FROM entity_type WHERE entity_id = ?`;
        const row00 = await db.sequelize.query(_query00, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row00 || row00.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity details not found.", null));
        }
        var platform_fee_enabled = (row00[0].platform_fee_enabled && row00[0].platform_fee_enabled == true) ? false : true;

        const _query2 = `UPDATE entity_type SET platform_fee_enabled = ?, platform_fee_toggle_date = ?, platform_fee_toggle_by = ? WHERE entity_id = ?`;
        const _replacements2 = [platform_fee_enabled, new Date(), req.token_data.account_id, _entity_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Platform fee status changed.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Unable to change, Please try again.", null));
        }

    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_type_auto_approve_toggle = async (req, res, next) => {
    const { entity_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query1 = `SELECT entity_id, entity_name, auto_approve_enabled FROM entity_type WHERE entity_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Entity details not found.", null));
        }

        const _query2 = `UPDATE entity_type SET auto_approve_enabled = CASE WHEN auto_approve_enabled = true THEN false ELSE true END, auto_approve_last_changed = ?, auto_approve_last_mod_by = ? WHERE entity_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _entity_id];
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

const entity_registration_form_update = async (req, res, next) => {
    const { entity_id, field_map_data } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const _query1 = `SELECT entity_id, entity_name, registration_flow_by_reg_type_id FROM entity_type WHERE entity_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Entity details not found.", null));
        }
        var updated_count = 0; var temp_static_field_available = []; var temp_docs_available = [];
        const registration_flow_by_reg_type_id = row1[0].registration_flow_by_reg_type_id && row1[0].registration_flow_by_reg_type_id == true ? true : false;
        if (registration_flow_by_reg_type_id) {
            var _by_reg_type_id = field_map_data.reg_type_id && validator.isNumeric(field_map_data.reg_type_id.toString()) ? BigInt(field_map_data.reg_type_id) : 0;
            if (_by_reg_type_id > 0) {
                for (let l = 0; field_map_data && field_map_data.static_field_map_entity && l < field_map_data.static_field_map_entity.length; l++) {
                    if (field_map_data.static_field_map_entity[l].is_added && field_map_data.static_field_map_entity[l].is_added == true) {
                        const _query2 = `INSERT INTO reg_static_field_map_entity(entity_id, static_field_id, reg_type_id) 
                        SELECT :entity_id, :static_field_id, :reg_type_id WHERE NOT EXISTS (
                            SELECT entity_id FROM reg_static_field_map_entity WHERE entity_id = :entity_id AND static_field_id = :static_field_id AND reg_type_id = :reg_type_id
                        )`;
                        await db.sequelize.query(_query2, {
                            replacements: { entity_id: _entity_id, static_field_id: field_map_data.static_field_map_entity[l].field_id, reg_type_id: field_map_data.reg_type_id }, type: QueryTypes.INSERT
                        });
                        const _query5 = `UPDATE reg_static_field_map_entity SET is_required = ?, label_text = ?, label_lng_key = ? WHERE entity_id = ? AND static_field_id = ? AND reg_type_id = ?`;
                        await db.sequelize.query(_query5, {
                            replacements: [
                                field_map_data.static_field_map_entity[l].is_required,
                                field_map_data.static_field_map_entity[l].label_text,
                                field_map_data.static_field_map_entity[l].label_lng_key,
                                _entity_id,
                                field_map_data.static_field_map_entity[l].field_id,
                                field_map_data.reg_type_id
                            ], type: QueryTypes.UPDATE
                        });
                        temp_static_field_available.push(field_map_data.static_field_map_entity[l].field_id);
                        updated_count = updated_count + 1;
                        if (field_map_data.static_field_map_entity[l].field_id.toString() == "34") {
                            const documentsData = field_map_data.static_field_map_entity[l].documents;
                            for (let y = 0; documentsData && y < documentsData.length; y++) {
                                if (documentsData[y].is_added && documentsData[y].is_added == true) {
                                    const _query21 = `INSERT INTO reg_static_field_map_docs(entity_id, reg_type_id, document_id) 
                                    SELECT :entity_id, :reg_type_id, :document_id WHERE NOT EXISTS (
                                        SELECT entity_id FROM reg_static_field_map_docs WHERE entity_id = :entity_id AND reg_type_id = :reg_type_id AND document_id = :document_id
                                    )`;
                                    await db.sequelize.query(_query21, {
                                        replacements: {
                                            entity_id: _entity_id, reg_type_id: field_map_data.reg_type_id, document_id: documentsData[y].document_id,
                                        }, type: QueryTypes.INSERT
                                    });
                                    const _query22 = `UPDATE reg_static_field_map_docs SET is_required = ? WHERE entity_id = ? AND reg_type_id = ? AND document_id = ?`;
                                    await db.sequelize.query(_query22, {
                                        replacements: [
                                            documentsData[y].is_required, _entity_id, field_map_data.reg_type_id, documentsData[y].document_id,
                                        ], type: QueryTypes.UPDATE
                                    });
                                    temp_docs_available.push(documentsData[y].document_id);
                                }
                            }
                            if (temp_docs_available.length > 0) {
                                const _query23 = `DELETE FROM reg_static_field_map_docs WHERE entity_id = ? AND reg_type_id = ? AND document_id NOT IN (?)`;
                                await db.sequelize.query(_query23, { replacements: [_entity_id, field_map_data.reg_type_id, temp_docs_available], type: QueryTypes.DELETE });
                                updated_count = updated_count + 1;
                            } else {
                                const _query24 = `DELETE FROM reg_static_field_map_docs WHERE entity_id = ? AND reg_type_id = ?`;
                                await db.sequelize.query(_query24, { replacements: [_entity_id, field_map_data.reg_type_id], type: QueryTypes.DELETE });
                                updated_count = updated_count + 1;
                            }
                        }
                    } else {
                        if (field_map_data.static_field_map_entity[l].field_id.toString() == "34") {
                            const _query25 = `DELETE FROM reg_static_field_map_docs WHERE entity_id = ? AND reg_type_id = ?`;
                            await db.sequelize.query(_query25, { replacements: [_entity_id, field_map_data.reg_type_id], type: QueryTypes.DELETE });
                            updated_count = updated_count + 1;
                        }
                    }
                }
                if (temp_static_field_available.length > 0) {
                    const _query26 = `DELETE FROM reg_static_field_map_entity WHERE entity_id = ? AND reg_type_id = ? AND static_field_id NOT IN (?) 
                    AND static_field_id IN (SELECT static_field_id FROM reg_static_field_item WHERE flow_by_reg_type_id = true)`;
                    await db.sequelize.query(_query26, { replacements: [_entity_id, field_map_data.reg_type_id, temp_static_field_available], type: QueryTypes.DELETE });
                    updated_count = updated_count + 1;
                } else {
                    const _query27 = `DELETE FROM reg_static_field_map_entity WHERE entity_id = ? AND reg_type_id = ?
                    AND static_field_id IN (SELECT static_field_id FROM reg_static_field_item WHERE flow_by_reg_type_id = true)`;
                    await db.sequelize.query(_query27, { replacements: [_entity_id, field_map_data.reg_type_id], type: QueryTypes.DELETE });
                    updated_count = updated_count + 1;
                }
            } else {
                for (let l = 0; field_map_data && field_map_data.static_field_map_entity && l < field_map_data.static_field_map_entity.length; l++) {
                    if (utils.check_in_array(field_map_data.static_field_map_entity[l].field_id, [4, 5])) {
                        field_map_data.static_field_map_entity[l].is_added = true;
                        field_map_data.static_field_map_entity[l].is_required = true;
                    }
                    if (field_map_data.static_field_map_entity[l].is_added && field_map_data.static_field_map_entity[l].is_added == true) {
                        const _query2 = `INSERT INTO reg_static_field_map_entity(entity_id, static_field_id) 
                                            SELECT :entity_id, :static_field_id WHERE NOT EXISTS (
                                                SELECT entity_id FROM reg_static_field_map_entity WHERE entity_id = :entity_id AND static_field_id = :static_field_id
                                            )`;
                        await db.sequelize.query(_query2, {
                            replacements: { entity_id: _entity_id, static_field_id: field_map_data.static_field_map_entity[l].field_id, }, type: QueryTypes.INSERT
                        });
                        const _query5 = `UPDATE reg_static_field_map_entity SET is_required = ?, label_text = ?, label_lng_key = ? WHERE entity_id = ? AND static_field_id = ?`;
                        await db.sequelize.query(_query5, {
                            replacements: [
                                field_map_data.static_field_map_entity[l].is_required,
                                field_map_data.static_field_map_entity[l].label_text,
                                field_map_data.static_field_map_entity[l].label_lng_key,
                                _entity_id,
                                field_map_data.static_field_map_entity[l].field_id
                            ], type: QueryTypes.UPDATE
                        });
                        temp_static_field_available.push(field_map_data.static_field_map_entity[l].field_id);
                        updated_count = updated_count + 1;
                    }
                }
                if (temp_static_field_available.length > 0) {
                    const _query4 = `DELETE FROM reg_static_field_map_entity WHERE entity_id = ? AND static_field_id NOT IN (?)
                    AND static_field_id IN (SELECT static_field_id FROM reg_static_field_item WHERE flow_by_reg_type_id = false)`;
                    await db.sequelize.query(_query4, { replacements: [_entity_id, temp_static_field_available], type: QueryTypes.DELETE });
                    updated_count = updated_count + 1;
                } else {
                    const _query4 = `DELETE FROM reg_static_field_map_entity WHERE entity_id = ?
                    AND static_field_id IN (SELECT static_field_id FROM reg_static_field_item WHERE flow_by_reg_type_id = false)`;
                    await db.sequelize.query(_query4, { replacements: [_entity_id], type: QueryTypes.DELETE });
                    updated_count = updated_count + 1;
                }
            }
        } else {
            for (let l = 0; field_map_data && field_map_data.static_field_map_entity && l < field_map_data.static_field_map_entity.length; l++) {
                if (utils.check_in_array(field_map_data.static_field_map_entity[l].field_id, [4, 5])) {
                    field_map_data.static_field_map_entity[l].is_added = true;
                    field_map_data.static_field_map_entity[l].is_required = true;
                }
                if (field_map_data.static_field_map_entity[l].is_added && field_map_data.static_field_map_entity[l].is_added == true) {
                    const _query2 = `INSERT INTO reg_static_field_map_entity(entity_id, static_field_id) 
                                        SELECT :entity_id, :static_field_id WHERE NOT EXISTS (
                                            SELECT entity_id FROM reg_static_field_map_entity WHERE entity_id = :entity_id AND static_field_id = :static_field_id
                                        )`;
                    await db.sequelize.query(_query2, {
                        replacements: { entity_id: _entity_id, static_field_id: field_map_data.static_field_map_entity[l].field_id, }, type: QueryTypes.INSERT
                    });
                    const _query5 = `UPDATE reg_static_field_map_entity SET is_required = ?, label_text = ?, label_lng_key = ? WHERE entity_id = ? AND static_field_id = ?`;
                    await db.sequelize.query(_query5, {
                        replacements: [
                            field_map_data.static_field_map_entity[l].is_required,
                            field_map_data.static_field_map_entity[l].label_text,
                            field_map_data.static_field_map_entity[l].label_lng_key,
                            _entity_id,
                            field_map_data.static_field_map_entity[l].field_id
                        ], type: QueryTypes.UPDATE
                    });
                    temp_static_field_available.push(field_map_data.static_field_map_entity[l].field_id);
                    updated_count = updated_count + 1;
                }
            }
            if (temp_static_field_available.length > 0) {
                const _query4 = `DELETE FROM reg_static_field_map_entity WHERE entity_id = ? AND static_field_id NOT IN (?)`;
                await db.sequelize.query(_query4, { replacements: [_entity_id, temp_static_field_available], type: QueryTypes.DELETE });
                updated_count = updated_count + 1;
            } else {
                const _query4 = `DELETE FROM reg_static_field_map_entity WHERE entity_id = ?`;
                await db.sequelize.query(_query4, { replacements: [_entity_id], type: QueryTypes.DELETE });
                updated_count = updated_count + 1;
            }
        }
        if (updated_count > 0) {
            return res.status(200).json(success(true, res.statusCode, "Updated Successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "No data updated, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, err.message, null));
    }
};

const entity_permission_list = async (req, res, next) => {
    const { entity_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const _query4 = `SELECT entity_name FROM entity_type WHERE entity_id = ?`;
        const row5 = await db.sequelize.query(_query4, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (row5 && row5.length > 0) {
            const _query3 = `SELECT m.menu_id, m.menu_name, m.is_visible, m.parent_id,
            COALESCE((SELECT allowed FROM entity_menu_permit p WHERE p.menu_id = m.menu_id AND p.entity_id = ? LIMIT 1), false) AS allowed
            FROM entity_menu_master m`;
            const row4 = await db.sequelize.query(_query3, { replacements: [_entity_id], type: QueryTypes.SELECT });
            var results = [];
            for (let i = 0; row4 && i < row4.length; i++) {
                var _menu_id = row4[i].menu_id && validator.isNumeric(row4[i].menu_id.toString()) ? BigInt(row4[i].menu_id) : 0;
                var _parent_id = row4[i].parent_id && validator.isNumeric(row4[i].parent_id.toString()) ? BigInt(row4[i].parent_id) : 0;
                results.push({
                    menu_id: _menu_id,
                    menu_name: row4[i].menu_name,
                    is_visible: row4[i].is_visible,
                    parent_id: _parent_id,
                    allowed: row4[i].allowed,
                });
            }
            return res.status(200).json(success(true, res.statusCode, "Entity permission details.", {
                entity_name: row5[0].entity_name,
                permissions: results,
            }));
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Entity details not found, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, err.message, null));
    }
};

const entity_permission_update = async (req, res, next) => {
    const { entity_id, permissions } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const _query4 = `SELECT entity_name FROM entity_type WHERE entity_id = ?`;
        const row5 = await db.sequelize.query(_query4, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (row5 && row5.length > 0) {
            for (const item of permissions) {
                var _menu_id = item.menu_id && validator.isNumeric(item.menu_id.toString()) ? BigInt(item.menu_id) : 0;
                var allowed = item.allowed || false;
                const _query1 = `SELECT menu_id FROM entity_menu_permit WHERE entity_id = ? AND menu_id = ? `;
                const row1 = await db.sequelize.query(_query1, { replacements: [_entity_id, _menu_id], type: QueryTypes.SELECT });
                if (row1 && row1.length > 0) {
                    const _query2 = `UPDATE entity_menu_permit SET allowed = ?, modify_by = ?, modify_date = ? WHERE entity_id = ? AND menu_id = ?`;
                    const [, i] = await db.sequelize.query(_query2, { replacements: [allowed, req.token_data.account_id, new Date(), _entity_id, _menu_id], type: QueryTypes.UPDATE });
                }
                else {
                    const _query2 = `INSERT INTO entity_menu_permit(entity_id, menu_id, allowed, added_by, added_date) VALUES (?, ?, ?, ?, ?)`;
                    await db.sequelize.query(_query2, { replacements: [_entity_id, _menu_id, allowed, req.token_data.account_id, new Date()], type: QueryTypes.INSERT });
                }
            }
            var tempArray = [];
            for (const item of permissions) {
                var _menu_id = item.menu_id && validator.isNumeric(item.menu_id.toString()) ? BigInt(item.menu_id) : 0;
                if (_menu_id > 0) {
                    tempArray.push(_menu_id);
                }
            }
            if (tempArray.length > 0) {
                const _query3 = `UPDATE entity_menu_permit SET allowed = false, modify_by = ?, modify_date = ? WHERE entity_id = ? AND menu_id NOT IN (?)`;
                const _replacements2 = [req.token_data.account_id, new Date(), _entity_id, tempArray];
                const [, i] = await db.sequelize.query(_query3, { replacements: _replacements2, type: QueryTypes.UPDATE });
            }
            return res.status(200).json(success(true, res.statusCode, "Permission saved successfully.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Entity details not found, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};



const entity_dynamic_field_item_search = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM reg_static_field_item WHERE is_static = false AND is_deleted = false AND LOWER(field_label) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY m.static_field_id DESC) AS sr_no,
        m.static_field_id, m.field_type, m.section_name, m.field_label, m.placeholder_text, m.is_enabled, m.added_date, m.modify_date
        FROM reg_static_field_item m WHERE m.is_static = false AND m.is_deleted = false AND 
        LOWER(m.field_label) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
            var _section_name = '';
            for (let k = 0; k < constants.entity_registration_section.length; k++) {
                if (constants.entity_registration_section[k].id.toLowerCase() == row1[i].section_name.toLowerCase()) {
                    _section_name = constants.entity_registration_section[k].name; break;
                }
            }
            list.push({
                sr_no: row1[i].sr_no,
                field_id: row1[i].static_field_id,
                field_type: row1[i].field_type,
                section_name: _section_name,
                lable_name: row1[i].field_label,
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

const entity_dynamic_field_item_form_data = async (req, res, next) => {
    try {
        const field_type = await adminDataModule.attribute_type_list();
        const validation_type = await adminDataModule.attribute_validation_list();

        const results = {
            field_type: field_type,
            validation_type: validation_type,
            section_list: constants.entity_registration_section,
        };
        return res.status(200).json(success(true, res.statusCode, "Success.", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_dynamic_field_item_add_new = async (req, res, next) => {
    const { field_type, section_name, lable_name, lable_lng_key, placeholder_text, placeholder_lng_key, field_values, validations } = req.body;
    try {
        const _field_type = (field_type != null && field_type.length > 0) ? field_type.trim() : "";
        const _section_name = (section_name != null && section_name.length > 0) ? section_name.trim() : "";
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
        var section_id = '';
        for (let i = 0; i < constants.entity_registration_section.length; i++) {
            if (constants.entity_registration_section[i].id.toLowerCase() == _section_name.toLowerCase()) {
                section_id = constants.entity_registration_section[i].id; break;
            }
        }
        if (section_id.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid section selected.", null));
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

        const _queryChkName = `SELECT field_type FROM reg_static_field_item WHERE LOWER(field_label) = LOWER(?) AND is_deleted = false`;
        const rowChkName = await db.sequelize.query(_queryChkName, { replacements: [_lable_name], type: QueryTypes.SELECT });
        if (rowChkName && rowChkName.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Field lable name is already exists.", null));
        }

        const _query2 = `INSERT INTO reg_static_field_item(field_type, section_name, field_label, field_lng_key, placeholder_text, placeholder_lng_key,
            field_values, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING "static_field_id"`;
        const _replacements2 = [_field_type, section_id, _lable_name, _lable_lng_key, _placeholder_text, _placeholder_lng_key, _field_values, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const field_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].static_field_id : 0);
        if (field_id > 0) {
            for (let d = 0; _validations && d < _validations.length; d++) {
                var pattern_value = ''; if (_validations[d].pattern_value) { pattern_value = _validations[d].pattern_value; }
                const _query_12 = `INSERT INTO reg_static_field_validation(static_field_id, vld_type_id, pattern_value) VALUES (?, ?, ?)`;
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

const entity_dynamic_field_item_edit_data = async (req, res, next) => {
    const { field_id } = req.body;
    try {
        const _field_id = field_id && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;

        const _query1 = `SELECT static_field_id, field_type, section_name, field_name, field_label, placeholder_text, placeholder_lng_key, 
        field_values FROM reg_static_field_item WHERE static_field_id = ? AND is_deleted = false AND is_static = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Field details not found.", null));
        }

        var validations = [];
        const _query2 = `SELECT vld_type_id, pattern_value FROM reg_static_field_validation WHERE static_field_id = ?`;
        const row2 = await db.sequelize.query(_query2, { replacements: [_field_id], type: QueryTypes.SELECT });
        for (let i = 0; row2 && i < row2.length; i++) {
            validations.push({
                vld_type_id: row2[i].vld_type_id,
                pattern_value: row2[i].pattern_value,
            });
        }
        var section_id = ''; var section_name = '';
        for (let i = 0; i < constants.entity_registration_section.length; i++) {
            if (constants.entity_registration_section[i].id.toLowerCase() == row1[0].section_name.toLowerCase()) {
                section_id = constants.entity_registration_section[i].id;
                section_name = constants.entity_registration_section[i].name;
                break;
            }
        }

        const field_data = {
            field_id: row1[0].static_field_id,
            field_type: row1[0].field_type,
            section_id: section_id,
            section_name: section_name,
            lable_name: row1[0].field_label,
            lable_lng_key: row1[0].field_lng_key,
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
            section_list: constants.entity_registration_section,
        };
        return res.status(200).json(success(true, res.statusCode, "Success.", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_dynamic_field_item_update = async (req, res, next) => {
    const { field_id, field_type, section_name, lable_name, lable_lng_key, placeholder_text, placeholder_lng_key, field_values, validations } = req.body;
    try {
        const _field_id = field_id && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;
        const _query1 = `SELECT static_field_id, field_type FROM reg_static_field_item WHERE static_field_id = ? AND is_deleted = false AND is_static = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Field details not found.", null));
        }

        const _field_type = (field_type != null && field_type.length > 0) ? field_type.trim() : "";
        const _section_name = (section_name != null && section_name.length > 0) ? section_name.trim() : "";
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

        var section_id = '';
        for (let i = 0; i < constants.entity_registration_section.length; i++) {
            if (constants.entity_registration_section[i].id.toLowerCase() == _section_name.toLowerCase()) {
                section_id = constants.entity_registration_section[i].id; break;
            }
        }
        if (section_id.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid section selected.", null));
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

        const _queryChkName = `SELECT field_type FROM reg_static_field_item WHERE static_field_id <> ? AND LOWER(field_label) = LOWER(?) AND is_deleted = false`;
        const rowChkName = await db.sequelize.query(_queryChkName, { replacements: [_field_id, _lable_name], type: QueryTypes.SELECT });
        if (rowChkName && rowChkName.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Field lable name is already exists.", null));
        }

        const _query2 = `UPDATE reg_static_field_item SET field_type = ?, section_name = ?, field_label = ?, field_lng_key = ?, placeholder_text = ?,
        placeholder_lng_key = ?, field_values = ?, modify_by = ?, modify_date = ? WHERE static_field_id = ?`;
        const _replacements2 = [_field_type, section_id, _lable_name, _lable_lng_key, _placeholder_text, _placeholder_lng_key, _field_values, req.token_data.account_id, new Date(), _field_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            for (let d = 0; _validations && d < _validations.length; d++) {
                var pattern_value = ''; if (_validations[d].pattern_value) { pattern_value = _validations[d].pattern_value; }
                const _query3 = `INSERT INTO reg_static_field_validation(static_field_id, vld_type_id, pattern_value) 
                SELECT :field_id, :vld_type_id, :pattern_value WHERE NOT EXISTS (
                    SELECT vld_type_id FROM reg_static_field_validation WHERE static_field_id = :field_id AND vld_type_id = :vld_type_id
                )`;
                await db.sequelize.query(_query3, {
                    replacements: {
                        field_id: _field_id, vld_type_id: _validations[d].vld_type_id, pattern_value: pattern_value
                    }, type: QueryTypes.INSERT
                });
                const _query5 = `UPDATE reg_static_field_validation SET pattern_value = ? WHERE static_field_id = ? AND vld_type_id = ?`;
                await db.sequelize.query(_query5, { replacements: [pattern_value, _field_id, _validations[d].vld_type_id], type: QueryTypes.UPDATE });
            }
            var temp = [];
            for (let k = 0; _validations && k < _validations.length; k++) {
                temp.push(_validations[k].vld_type_id);
            }
            if (temp.length > 0) {
                const _query4 = `DELETE FROM reg_static_field_validation WHERE static_field_id = ? AND vld_type_id NOT IN (?)`;
                await db.sequelize.query(_query4, { replacements: [_field_id, temp], type: QueryTypes.DELETE });
            } else {
                const _query4 = `DELETE FROM reg_static_field_validation WHERE static_field_id = ?`;
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

const entity_dynamic_field_item_toggle = async (req, res, next) => {
    const { field_id } = req.body;
    try {
        const _field_id = field_id != null && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;

        const _query1 = `SELECT static_field_id, field_label, is_enabled FROM reg_static_field_item WHERE static_field_id = ? AND is_deleted = false AND is_static = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Field details not found.", null));
        }
        const _query2 = `UPDATE reg_static_field_item SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE static_field_id = ?`;
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

const entity_dynamic_field_item_delete = async (req, res, next) => {
    const { field_id } = req.body;
    try {
        const _field_id = field_id != null && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;

        const _query3 = `SELECT static_field_id FROM reg_static_field_item WHERE static_field_id = ? AND is_deleted = false AND is_static = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_field_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Field details not found.", null));
        }
        const _query2 = `UPDATE reg_static_field_item SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE static_field_id = ?`;
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
    entity_type_list,
    entity_type_reg_toggle,
    entity_type_dropdown,
    entity_type_manage_view,
    entity_prerequisite_update,
    entity_prerequisite_toggle,
    entity_platform_fee_update,
    entity_platform_fee_toggle,
    entity_type_auto_approve_toggle,
    entity_registration_form_update,
    entity_permission_list,
    entity_permission_update,


    entity_dynamic_field_item_search,
    entity_dynamic_field_item_form_data,
    entity_dynamic_field_item_add_new,
    entity_dynamic_field_item_edit_data,
    entity_dynamic_field_item_update,
    entity_dynamic_field_item_toggle,
    entity_dynamic_field_item_delete,
};