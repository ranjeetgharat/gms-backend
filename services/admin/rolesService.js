const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
const { apiStatus } = require('../../constants/apiStatus');
var validator = require('validator');

const role_list = async (req, res, next) => {
    const { page_no, role_level, search_text } = req.body;
    try {
        var _page_no = page_no && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text && search_text.length > 0 ? search_text : "";
        var _role_level = role_level && validator.isNumeric(role_level.toString()) ? BigInt(role_level) : 0;
        const _query0 = `SELECT count(1) AS total_record FROM adm_role ar WHERE ar.is_deleted = false AND LOWER(ar.role_name) LIKE LOWER(:search_text)`;
        const row0 = await db.sequelize.query(_query0, { replacements: { search_text: _search_text + '%', }, type: QueryTypes.SELECT });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY ar.role_id DESC) AS sr_no,
        ar.role_id, ar.role_name, ar.role_level, ar.is_editable, ar.checker_maker, ar.is_enabled, ar.added_date, ar.modify_date
        FROM adm_role ar WHERE ar.is_deleted = false AND LOWER(ar.role_name) LIKE LOWER(:search_text) LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: _search_text + '%',
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                sr_no: row1[i].sr_no,
                role_id: row1[i].role_id,
                role_level: row1[i].role_level,
                role_name: row1[i].role_name,
                enabled: row1[i].is_enabled,
                is_editable: row1[i].is_editable,
                checker_maker: row1[i].checker_maker,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
            })
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

const role_get = async (req, res, next) => {
    const { role_id } = req.body;
    try {
        const _query1 = `SELECT role_id, role_name, role_level, checker_maker, is_enabled, added_date, modify_date, is_editable FROM adm_role WHERE role_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [role_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Role details not found.", null));
        }
        const results = {
            role_id: row1[0].role_id,
            role_name: row1[0].role_name,
            role_level: row1[0].role_level,
            is_enabled: row1[0].is_enabled,
            is_editable: row1[0].is_editable,
            checker_maker: row1[0].checker_maker,
            added_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].added_date)),
            modify_date: dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[0].modify_date)),
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const role_new = async (req, res, next) => {
    const { role_name, role_level, checker_maker } = req.body;
    try {
        if (!role_name || role_name.length <= 0 || role_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter role name.", null));
        }
        if (role_name.length > 30) {
            return res.status(200).json(success(false, res.statusCode, "Role name should not be more than 30 character", null));
        }
        var _checker_maker = checker_maker && validator.isNumeric(checker_maker.toString()) ? BigInt(checker_maker) : 0;
        var _role_level = role_level && validator.isNumeric(role_level.toString()) ? BigInt(role_level) : 0;

        const _query1 = `SELECT role_id FROM adm_role WHERE LOWER(role_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [role_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Role name is already exists.", null));
        }

        const _query2 = `INSERT INTO adm_role(role_name, role_level, is_enabled, is_deleted, added_by, added_date, is_editable, checker_maker)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING "role_id"`;
        const _replacements2 = [role_name.trim(), _role_level, true, false, req.token_data.account_id, new Date(), true, _checker_maker];
        const [rowOut] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.INSERT });
        const role_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].role_id : 0);
        if (role_id > 0) {
            return res.status(200).json(success(true, res.statusCode, "Role added successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to add role, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const role_update = async (req, res, next) => {
    const { role_id, role_name, role_level, checker_maker } = req.body;
    try {
        if (!role_name || role_name.length <= 0 || role_name.trim().length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter role name.", null));
        }
        if (role_name.length > 30) {
            return res.status(200).json(success(false, res.statusCode, "Role name should not be more than 30 character", null));
        }
        var _role_id = role_id && validator.isNumeric(role_id.toString()) ? BigInt(role_id) : 0;
        var _checker_maker = checker_maker && validator.isNumeric(checker_maker.toString()) ? BigInt(checker_maker) : 0;
        var _role_level = role_level && validator.isNumeric(role_level.toString()) ? BigInt(role_level) : 0;

        const _query0 = `SELECT role_id, is_editable FROM adm_role WHERE role_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_role_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Role details not found.", null));
        }

        const _query1 = `SELECT role_id FROM adm_role WHERE role_id <> ? AND LOWER(role_name) = LOWER(?) AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_role_id, role_name.trim()], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return res.status(200).json(success(false, res.statusCode, "Role name is already exists.", null));
        }

        if (row0[0].is_editable && row0[0].is_editable == true) {
            const _query2 = `UPDATE adm_role SET role_name = ?, role_level = ?, checker_maker = ?, modify_by = ?, modify_date = ? WHERE role_id = ?`;
            const _replacements2 = [role_name.trim(), _role_level, _checker_maker, req.token_data.account_id, new Date(), _role_id];
            const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
            if (i > 0) {
                return res.status(200).json(success(true, res.statusCode, "Updated successfully.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Administrator role can not edit.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const role_toggle = async (req, res, next) => {
    const { role_id } = req.body;
    try {
        const _query1 = `SELECT role_id, is_enabled, role_name, is_editable FROM adm_role WHERE role_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [role_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Role details not found.", null));
        }
        if (row1[0].is_editable && row1[0].is_editable == true) {
            const _query2 = `UPDATE adm_role SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE role_id = ?`;
            const _replacements2 = [new Date(), req.token_data.account_id, role_id];
            const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
            if (i > 0) {
                return res.status(200).json(success(true, res.statusCode, "Status changed successfully.", null));
            } else {
                return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Unable to change, Please try again.", null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,"Administrator role can not be edit.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.RELOAD_PAGE,err.message, null));
    }
};

const role_delete = async (req, res, next) => {
    const { role_id } = req.body;
    try {
        var _role_id = role_id && validator.isNumeric(role_id.toString()) ? BigInt(role_id) : 0;
        const _query3 = `SELECT role_id, is_editable, role_name FROM adm_role WHERE role_id = ? AND is_deleted = false`;
        const row3 = await db.sequelize.query(_query3, { replacements: [_role_id], type: QueryTypes.SELECT });
        if (!row3 || row3.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Role details not found.", null));
        }

        if (row3[0].is_editable && row3[0].is_editable == true) {
            const _query4 = `SELECT admin_id FROM adm_user WHERE role_id = ? AND is_deleted = false`;
            const row4 = await db.sequelize.query(_query4, { replacements: [_role_id], type: QueryTypes.SELECT });
            if (row4 && row4.length > 0) {
                return res.status(200).json(success(false, res.statusCode, "This role is already assign to users and can not be deleted.", null));
            }

            const _query2 = `UPDATE adm_role SET is_deleted = true, deleted_date = ?, deleted_by = ? WHERE role_id = ?`;
            const _replacements2 = [new Date(), req.token_data.account_id, _role_id];
            const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
            if (i > 0) {
                return res.status(200).json(success(true, res.statusCode, "Role deleted successfully.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Unable to delete, please try again.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Administrator role can not be deleted.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

const role_dropdown = async (req, res, next) => {
    const { } = req.body;
    try {
        const _query1 = `SELECT ar.role_id, ar.role_name FROM adm_role ar WHERE ar.is_deleted = false AND ar.is_enabled = true AND ar.is_editable = true`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                role_id: row1[i].role_id,
                role_name: row1[i].role_name,
            })
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const protean_role_permission_list = async (req, res, next) => {
    const { role_id } = req.body;
    try {
        var _role_id = role_id != null && validator.isNumeric(role_id.toString()) ? BigInt(role_id) : 0;
        const _query4 = `SELECT role_name, is_editable FROM adm_role WHERE role_id = ? AND is_deleted = false`;
        const row5 = await db.sequelize.query(_query4, { replacements: [_role_id], type: QueryTypes.SELECT });
        if (row5 && row5.length > 0) {
            var is_editable = row5[0].is_editable && row5[0].is_editable == true ? true : false;
            if (!is_editable) {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE,'Cannot update permissions of administrator', null));
            }
            const _query3 = `SELECT p.menu_id, p.menu_name, p.is_visible, p.parent_id,
            COALESCE((SELECT rp.allowed FROM adm_menu_permit rp WHERE rp.menu_id = p.menu_id AND rp.role_id = ?), false) AS allowed
            FROM adm_menu_master p ORDER BY CASE WHEN COALESCE(p.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(p.sort_order, 0) END, p.menu_id`;
            const row4 = await db.sequelize.query(_query3, { replacements: [_role_id], type: QueryTypes.SELECT });
            var list = [];
            for (let i = 0; row4 && i < row4.length; i++) {
                list.push({
                    menu_id: row4[i].menu_id,
                    menu_name: row4[i].menu_name,
                    is_visible: row4[i].is_visible,
                    parent_id: row4[i].parent_id,
                    allowed: row4[i].allowed,
                });
            }
            const results = {
                role: row5[0].role_name,
                permissions: list,
            };
            return res.status(200).json(success(true, res.statusCode, "", results));
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE,"Role details not found, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE,err.message, null));
    }
};

const protean_role_permission_update = async (req, res, next) => {
    const { role_id, permissions } = req.body;
    try {
        var _role_id = role_id != null && validator.isNumeric(role_id.toString()) ? BigInt(role_id) : 0;
        const _query4 = `SELECT role_name FROM adm_role WHERE role_id = ? AND is_deleted = false`;
        const row5 = await db.sequelize.query(_query4, { replacements: [_role_id], type: QueryTypes.SELECT });
        if (row5 && row5.length > 0) {
            var _permissions = []; var tempArray = [];
            if (permissions != null) {
                if (permissions.constructor == Array) {
                    _permissions = permissions;
                } else {
                    if (permissions.constructor == String) {
                        try { _permissions = JSON.parse(permissions); } catch (_) { }
                    }
                }
            }
            for (const item of _permissions) {
                var _menu_id = item.menu_id && validator.isNumeric(item.menu_id.toString()) ? BigInt(item.menu_id) : 0;
                var allowed = item.allowed || false;

                const _query1 = `SELECT menu_id FROM adm_menu_permit WHERE role_id = ? AND menu_id = ? `;
                const row1 = await db.sequelize.query(_query1, { replacements: [_role_id, _menu_id], type: QueryTypes.SELECT });

                if (row1 && row1.length > 0) {
                    const _query2 = `UPDATE adm_menu_permit SET allowed = ?,  modify_by = ?, modify_date = ? WHERE role_id = ? AND menu_id = ?`;
                    await db.sequelize.query(_query2, { replacements: [allowed, req.token_data.account_id, new Date(), _role_id, _menu_id], type: QueryTypes.UPDATE });
                }
                else {
                    const _query2 = `INSERT INTO adm_menu_permit(role_id, menu_id, allowed, added_by, added_date) VALUES (?, ?, ?, ?, ?)`;
                    await db.sequelize.query(_query2, { replacements: [_role_id, _menu_id, allowed, req.token_data.account_id, new Date()], type: QueryTypes.INSERT });
                }
                tempArray.push(_menu_id);
            }
            if (tempArray.length > 0) {
                const _query3 = `UPDATE adm_menu_permit SET allowed = false, modify_by = ?, modify_date = ? WHERE role_id = ? AND menu_id NOT IN (?)`;
                const _replacements2 = [req.token_data.account_id, new Date(), _role_id, tempArray];
                await db.sequelize.query(_query3, { replacements: _replacements2, type: QueryTypes.UPDATE });
            }
            return res.status(200).json(success(true, res.statusCode, "Permission saved successfully.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE,"Role details not found, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE,err.message, null));
    }
};



module.exports = {
    role_list,
    role_get,
    role_new,
    role_update,
    role_toggle,
    role_delete,
    role_dropdown,
    protean_role_permission_list,
    protean_role_permission_update,
};
