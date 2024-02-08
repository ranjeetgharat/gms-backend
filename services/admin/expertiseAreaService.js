const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const expertise_area_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM expertise_area_mast WHERE is_deleted = false AND LOWER(expertise_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY m.expertise_area_id DESC) AS sr_no,
        m.expertise_area_id, m.expertise_name, m.expertise_lng_key, m.is_enabled, m.added_date, m.modify_date
        FROM expertise_area_mast m WHERE m.is_deleted = false AND LOWER(m.expertise_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
            var map_entity = [];
            const _query2 = `SELECT m.entity_id, e.entity_name FROM expertise_area_mapp m INNER JOIN entity_type e ON m.entity_id = e.entity_id WHERE m.expertise_area_id = ?`;
            const row2 = await db.sequelize.query(_query2, { replacements: [row1[i].expertise_area_id], type: QueryTypes.SELECT });
            for (let j = 0; row2 && j < row2.length; j++) {
                map_entity.push({
                    entity_id: row2[j].entity_id,
                    entity_name: row2[j].entity_name,
                });
            }
            list.push({
                sr_no: row1[i].sr_no,
                expertise_area_id: row1[i].expertise_area_id,
                expertise_name: row1[i].expertise_name,
                expertise_lng_key: row1[i].expertise_lng_key,
                map_entity: map_entity,
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

const expertise_area_get = async (req, res, next) => {
    const { expertise_area_id } = req.body;
    try {
        var _expertise_area_id = expertise_area_id && validator.isNumeric(expertise_area_id.toString()) ? BigInt(expertise_area_id) : 0;

        const _query1 = `SELECT expertise_area_id, expertise_name, expertise_lng_key, is_enabled, added_date, modify_date FROM expertise_area_mast WHERE expertise_area_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_expertise_area_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Expertise area details not found.", null));
        }
        var map_entity = [];
        const _query2 = `SELECT m.entity_id, e.entity_name FROM expertise_area_mapp m INNER JOIN entity_type e ON m.entity_id = e.entity_id WHERE m.expertise_area_id = ?`;
        const row2 = await db.sequelize.query(_query2, { replacements: [row1[0].expertise_area_id], type: QueryTypes.SELECT });
        for (let j = 0; row2 && j < row2.length; j++) {
            map_entity.push({
                entity_id: row2[j].entity_id,
                entity_name: row2[j].entity_name,
            });
        }
        const results = {
            expertise_area_id: row1[0].expertise_area_id,
            expertise_name: row1[0].expertise_name,
            expertise_lng_key: row1[0].expertise_lng_key,
            is_enabled: row1[0].is_enabled,
            map_entity: map_entity,
            added_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].added_date)),
            modify_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].modify_date)),
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const expertise_area_new = async (req, res, next) => {
    const { expertise_name, expertise_lng_key, map_entity } = req.body;
    try {
        if (!expertise_name || expertise_name.length <= 0 || expertise_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter name of expertise area.", null));
        }

        const _query1 = `SELECT expertise_area_id FROM expertise_area_mast WHERE LOWER(expertise_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [expertise_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Expertise area name is already exists.", null));
        }
        var _map_entity = [];
        if (map_entity && map_entity.length > 0) {
            const map_entity_list = map_entity.split(',').join('|');
            const map_entity_array = map_entity_list.split('|');
            for (let i = 0; i < map_entity_array.length; i++) {
                const element = map_entity_array[i];
                var entity_id = element && validator.isNumeric(element.toString()) ? BigInt(element) : 0;
                if (entity_id > 0) {
                    _map_entity.push(entity_id);
                }
            }
        }
        if (_map_entity.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable entity.", null));
        }
        const _query2 = `INSERT INTO expertise_area_mast(expertise_name, expertise_lng_key, is_enabled, is_deleted, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING "expertise_area_id"`;
        const _replacements2 = [expertise_name.trim(), expertise_lng_key.trim(), true, false, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const expertise_area_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].expertise_area_id : 0);
        if (expertise_area_id > 0) {
            for (let k = 0; _map_entity && k < _map_entity.length; k++) {
                const _query3 = `INSERT INTO expertise_area_mapp(expertise_area_id, entity_id) VALUES (?, ?)`;
                const _replacements3 = [expertise_area_id, _map_entity[k]];
                await db.sequelize.query(_query3, { replacements: _replacements3, type: QueryTypes.INSERT });
            }
            return res.status(200).json(success(true, res.statusCode, "Expertise area added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add expertise area, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const expertise_area_update = async (req, res, next) => {
    const { expertise_area_id, expertise_name, expertise_lng_key, map_entity } = req.body;
    try {
        if (!expertise_name || expertise_name.length <= 0 || expertise_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter name of expertise area.", null));
        }
        var _expertise_area_id = expertise_area_id && validator.isNumeric(expertise_area_id.toString()) ? BigInt(expertise_area_id) : 0;

        const _query0 = `SELECT expertise_area_id FROM expertise_area_mast WHERE expertise_area_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_expertise_area_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Expertise area details not found.", null));
        }

        const _query1 = `SELECT expertise_area_id FROM expertise_area_mast WHERE expertise_area_id <> ? AND LOWER(expertise_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_expertise_area_id, expertise_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Expertise area name is already exists.", null));
        }

        var _map_entity = [];
        if (map_entity && map_entity.length > 0) {
            const map_entity_list = map_entity.split(',').join('|');
            const map_entity_array = map_entity_list.split('|');
            for (let i = 0; i < map_entity_array.length; i++) {
                const element = map_entity_array[i];
                var entity_id = element && validator.isNumeric(element.toString()) ? BigInt(element) : 0;
                if (entity_id > 0) {
                    _map_entity.push(entity_id);
                }
            }
        }
        if (_map_entity.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable entity.", null));
        }

        const _query2 = `UPDATE expertise_area_mast SET expertise_name = ?, expertise_lng_key = ?, modify_by = ?, modify_date = ? WHERE expertise_area_id = ?`;
        const _replacements2 = [expertise_name.trim(), expertise_lng_key.trim(), req.token_data.account_id, new Date(), _expertise_area_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            for (let k = 0; _map_entity && k < _map_entity.length; k++) {
                const _query3 = `INSERT INTO expertise_area_mapp(expertise_area_id, entity_id) 
                SELECT :expertise_area_id, :entity_id WHERE NOT EXISTS (
                    SELECT entity_id FROM expertise_area_mapp WHERE expertise_area_id = :expertise_area_id AND entity_id = :entity_id
                )`;
                await db.sequelize.query(_query3, { replacements: { expertise_area_id: _expertise_area_id, entity_id: _map_entity[k] }, type: QueryTypes.INSERT });
            }
            const _query4 = `DELETE FROM expertise_area_mapp WHERE expertise_area_id =  ? AND entity_id NOT IN (?)`;
            await db.sequelize.query(_query4, { replacements: [_expertise_area_id, _map_entity], type: QueryTypes.DELETE });

            return res.status(200).json(success(true, res.statusCode, "Updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const expertise_area_toggle = async (req, res, next) => {
    const { expertise_area_id } = req.body;
    try {
        var _expertise_area_id = expertise_area_id && validator.isNumeric(expertise_area_id.toString()) ? BigInt(expertise_area_id) : 0;

        const _query1 = `SELECT expertise_area_id, expertise_name, is_enabled FROM expertise_area_mast WHERE expertise_area_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_expertise_area_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Expertise area details not found.", null));
        }

        const _query2 = `UPDATE expertise_area_mast SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE expertise_area_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _expertise_area_id];
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

const expertise_area_delete = async (req, res, next) => {
    const { expertise_area_id } = req.body;
    try {
        var _expertise_area_id = expertise_area_id && validator.isNumeric(expertise_area_id.toString()) ? BigInt(expertise_area_id) : 0;

        const _query3 = `SELECT expertise_area_id FROM expertise_area_mast WHERE expertise_area_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_expertise_area_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Expertise area details not found.", null));
        }
        const _query2 = `UPDATE expertise_area_mast SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE expertise_area_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _expertise_area_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Expertise area deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

module.exports = {
    expertise_area_list,
    expertise_area_get,
    expertise_area_new,
    expertise_area_update,
    expertise_area_toggle,
    expertise_area_delete,
};