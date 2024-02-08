const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");

const parent_orgs_list = async (req, res, next) => {
    const { page_no, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";

        const _query0 = `SELECT count(1) AS total_record FROM parent_orgs_mast WHERE is_deleted = false AND LOWER(org_type_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: '%' + _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY m.org_type_id DESC) AS sr_no,
        m.org_type_id, m.org_type_name, m.org_type_lng_key, m.is_enabled, m.added_date, m.modify_date
        FROM parent_orgs_mast m WHERE m.is_deleted = false AND LOWER(m.org_type_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
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
            const _query2 = `SELECT m.entity_id, e.entity_name, m.parent_entity FROM parent_orgs_mapp m INNER JOIN entity_type e ON m.entity_id = e.entity_id WHERE m.org_type_id = ?`;
            const row2 = await db.sequelize.query(_query2, { replacements: [row1[i].org_type_id], type: QueryTypes.SELECT });
            for (let j = 0; row2 && j < row2.length; j++) {
                map_entity.push({
                    entity_id: row2[j].entity_id,
                    entity_name: row2[j].entity_name,
                    parent_entity: (row2[j].parent_entity && row2[j].parent_entity.length > 0 ? row2[j].parent_entity : []),
                });
            }
            list.push({
                sr_no: row1[i].sr_no,
                org_type_id: row1[i].org_type_id,
                org_type_name: row1[i].org_type_name,
                org_type_lng_key: row1[i].org_type_lng_key,
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

const parent_orgs_get = async (req, res, next) => {
    const { org_type_id } = req.body;
    try {
        var _org_type_id = org_type_id && validator.isNumeric(org_type_id.toString()) ? BigInt(org_type_id) : 0;

        const _query1 = `SELECT org_type_id, org_type_name, org_type_lng_key, is_enabled, added_date, modify_date FROM parent_orgs_mast WHERE org_type_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_org_type_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Organization details not found.", null));
        }
        var map_entity = [];
        const _query2 = `SELECT m.entity_id, e.entity_name, m.parent_entity FROM parent_orgs_mapp m INNER JOIN entity_type e ON m.entity_id = e.entity_id WHERE m.org_type_id = ?`;
        const row2 = await db.sequelize.query(_query2, { replacements: [row1[0].org_type_id], type: QueryTypes.SELECT });
        for (let j = 0; row2 && j < row2.length; j++) {
            map_entity.push({
                entity_id: row2[j].entity_id,
                entity_name: row2[j].entity_name,
                parent_entity: (row2[j].parent_entity && row2[j].parent_entity.length > 0 ? row2[j].parent_entity : []),
            });
        }
        const results = {
            org_type_id: row1[0].org_type_id,
            org_type_name: row1[0].org_type_name,
            org_type_lng_key: row1[0].org_type_lng_key,
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

const parent_orgs_new = async (req, res, next) => {
    const { org_type_name, org_type_lng_key, map_entity } = req.body;
    try {
        if (!org_type_name || org_type_name.length <= 0 || org_type_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter organization name.", null));
        }
        const _query1 = `SELECT org_type_id FROM parent_orgs_mast WHERE LOWER(org_type_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [org_type_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Organization name is already exists.", null));
        }
        var _map_entity = map_entity;
        /*var _map_entity = [];        
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
        }*/
        if (_map_entity.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable entity.", null));
        }

        const _query2 = `INSERT INTO parent_orgs_mast(org_type_name, org_type_lng_key, is_enabled, is_deleted, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?) RETURNING "org_type_id"`;
        const _replacements2 = [org_type_name.trim(), org_type_lng_key.trim(), true, false, req.token_data.account_id, new Date()];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const org_type_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].org_type_id : 0);
        if (org_type_id > 0) {
            for (let k = 0; _map_entity && k < _map_entity.length; k++) {
                var temp_entity_id = _map_entity[k].value ? _map_entity[k].value : _map_entity[k].entity_id;
                var temp_parent = [];
                for (let y = 0; y < _map_entity[k].parent_entity.length; y++) {
                    const ele = _map_entity[k].parent_entity[y];
                    var _t = ele && validator.isNumeric(ele.toString()) ? BigInt(ele) : 0;
                    if (_t > 0) {
                        temp_parent.push(_t);
                    }
                }

                const _query3 = `INSERT INTO parent_orgs_mapp(org_type_id, entity_id, parent_entity) VALUES (?, ?, ARRAY[?]::bigint[])`;
                const _replacements3 = [org_type_id, temp_entity_id, temp_parent];
                await db.sequelize.query(_query3, { replacements: _replacements3, type: QueryTypes.INSERT });
            }
            return res.status(200).json(success(true, res.statusCode, "Organization added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add organization, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const parent_orgs_update = async (req, res, next) => {
    const { org_type_id, org_type_name, org_type_lng_key, map_entity } = req.body;
    try {
        if (!org_type_name || org_type_name.length <= 0 || org_type_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter organization name.", null));
        }
        var _org_type_id = org_type_id && validator.isNumeric(org_type_id.toString()) ? BigInt(org_type_id) : 0;

        const _query0 = `SELECT org_type_id FROM parent_orgs_mast WHERE org_type_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_org_type_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Organization details not found.", null));
        }

        const _query1 = `SELECT org_type_id FROM parent_orgs_mast WHERE org_type_id <> ? AND LOWER(org_type_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_org_type_id, org_type_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Organization name is already exists.", null));
        }
        var _map_entity = map_entity;
        /*var _map_entity = [];
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
        }*/
        if (_map_entity.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please select applicable entity.", null));
        }

        const _query2 = `UPDATE parent_orgs_mast SET org_type_name = ?, org_type_lng_key = ?, modify_by = ?, modify_date = ? WHERE org_type_id = ?`;
        const _replacements2 = [org_type_name.trim(), org_type_lng_key.trim(), req.token_data.account_id, new Date(), _org_type_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            var temp_entity = [];
            for (let k = 0; _map_entity && k < _map_entity.length; k++) {
                var temp_entity_id = _map_entity[k].value ? _map_entity[k].value : _map_entity[k].entity_id;
                var temp_parent = [];
                for (let y = 0; y < _map_entity[k].parent_entity.length; y++) {
                    const ele = _map_entity[k].parent_entity[y];
                    var _t = ele && validator.isNumeric(ele.toString()) ? BigInt(ele) : 0;
                    if (_t > 0) {
                        temp_parent.push(_t);
                    }
                }
                const _query6 = `UPDATE parent_orgs_mapp SET parent_entity = ARRAY[?]::bigint[] WHERE org_type_id = ? AND entity_id = ?`;
                const [, uu] = await db.sequelize.query(_query6, { replacements: [temp_parent, _org_type_id, temp_entity_id], type: QueryTypes.UPDATE });
                if (uu > 0) {
                    temp_entity.push(temp_entity_id);
                } else {
                    console.log('INSERT INTO parent_orgs_mapp');
                    const _query7 = `INSERT INTO parent_orgs_mapp(org_type_id, entity_id, parent_entity) VALUES(?, ?, ARRAY[?]::bigint[]) RETURNING "entity_id"`;
                    const [rowEout] = await db.sequelize.query(_query7, { replacements: [_org_type_id, temp_entity_id, temp_parent], type: QueryTypes.INSERT });
                    const ret_entity_id = (rowEout && rowEout.length > 0 && rowEout[0] ? rowEout[0].entity_id : 0);
                    if (ret_entity_id > 0) {
                        temp_entity.push(ret_entity_id);
                    }
                }
            }
            if (temp_entity.length > 0) {
                const _query8 = `DELETE FROM parent_orgs_mapp WHERE org_type_id = ? AND entity_id NOT IN (?)`;
                await db.sequelize.query(_query8, { replacements: [_org_type_id, temp_entity], type: QueryTypes.DELETE });
            } else {
                const _query9 = `DELETE FROM parent_orgs_mapp WHERE org_type_id = ?`;
                await db.sequelize.query(_query9, { replacements: [_org_type_id], type: QueryTypes.DELETE });
            }

            /*for (let k = 0; _map_entity && k < _map_entity.length; k++) {
                const _query3 = `INSERT INTO parent_orgs_mapp(org_type_id, entity_id) 
                SELECT :org_type_id, :entity_id WHERE NOT EXISTS (
                    SELECT entity_id FROM parent_orgs_mapp WHERE org_type_id = :org_type_id AND entity_id = :entity_id
                )`;
                await db.sequelize.query(_query3, { replacements: { org_type_id: _org_type_id, entity_id: _map_entity[k] }, type: QueryTypes.INSERT });
            }
            const _query4 = `DELETE FROM parent_orgs_mapp WHERE org_type_id = ? AND entity_id NOT IN (?)`;
            await db.sequelize.query(_query4, { replacements: [_org_type_id, _map_entity], type: QueryTypes.DELETE });*/

            return res.status(200).json(success(true, res.statusCode, "Updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const parent_orgs_toggle = async (req, res, next) => {
    const { org_type_id } = req.body;
    try {
        var _org_type_id = org_type_id && validator.isNumeric(org_type_id.toString()) ? BigInt(org_type_id) : 0;

        const _query1 = `SELECT org_type_id, org_type_name, is_enabled FROM parent_orgs_mast WHERE org_type_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_org_type_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Organization details not found.", null));
        }

        const _query2 = `UPDATE parent_orgs_mast SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE org_type_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _org_type_id];
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

const parent_orgs_delete = async (req, res, next) => {
    const { org_type_id } = req.body;
    try {
        var _org_type_id = org_type_id && validator.isNumeric(org_type_id.toString()) ? BigInt(org_type_id) : 0;

        const _query3 = `SELECT org_type_id FROM parent_orgs_mast WHERE org_type_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_org_type_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Organization details not found.", null));
        }
        const _query2 = `UPDATE parent_orgs_mast SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE org_type_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _org_type_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Organization deleted successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

module.exports = {
    parent_orgs_list,
    parent_orgs_get,
    parent_orgs_new,
    parent_orgs_update,
    parent_orgs_toggle,
    parent_orgs_delete,
};