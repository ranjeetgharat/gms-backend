const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
const crypto = require('crypto');
const commonModule = require('../../modules/commonModule');
const entityDataModule = require('../../modules/entityDataModule');
const registrationModule = require('../../modules/registrationModule');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");
const constants = require("../../constants/constants");
const cloudStorageModule = require('../../modules/cloudStorageModule');

const project_purpose_dropdown = async (req, res, next) => {
    try {
        return res.status(200).json(success(true, res.statusCode, "", constants.project_purpose));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_funding_option_dropdown = async (req, res, next) => {
    try {
        return res.status(200).json(success(true, res.statusCode, "", constants.project_funding_option));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_rfp_document_get_url = async (req, res, next) => {
    const { project_id, file_id } = req.body;
    try {
        var _id = (project_id != null && project_id.length > 0 ? project_id : "");
        const _file_id = file_id != null && validator.isNumeric(file_id.toString()) ? BigInt(file_id) : 0;
        if (utils.isUUID(_id)) {
            const resp = await entityDataModule.project_document_signed_url(_id, _file_id);
            return res.status(200).json(success(true, res.statusCode, "", resp));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Invalid document request.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_proposal_doc_get_url = async (req, res, next) => {
    const { apply_id, file_id } = req.body;
    try {
        var _id = (apply_id != null && apply_id.length > 0 ? apply_id : "");
        const _file_id = file_id != null && validator.isNumeric(file_id.toString()) ? BigInt(file_id) : 0;
        if (utils.isUUID(_id)) {
            const resp = await entityDataModule.project_appl_proposal_doc_signed_url(_id, _file_id);
            return res.status(200).json(success(true, res.statusCode, "", resp));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Invalid document request.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_created_list = async (req, res, next) => {
    const { page_no, search_text, purpose_id, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _purpose_id = purpose_id != null && validator.isNumeric(purpose_id.toString()) ? BigInt(purpose_id) : 0;
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        var _sql_condition = '';
        if (_search_text.length > 0) {
            _sql_condition += ' AND (LOWER(pc.project_no) LIKE LOWER(:search_text) OR LOWER(pc.project_name) LIKE LOWER(:search_text)) ';
        }
        if (_purpose_id > 0) { _sql_condition += ' AND pc.purpose_id = :purpose_id '; }
        if (_country_id > 0) { _sql_condition += ' AND pc.country_id = :country_id '; }
        if (_state_id > 0) { _sql_condition += ' AND pc.state_id = :state_id '; }
        if (_district_id > 0) { _sql_condition += ' AND pc.district_id = :district_id '; }
        if (_block_id > 0) { _sql_condition += ' AND pc.block_id = :block_id '; }

        const _query0 = `SELECT count(1) AS total_record FROM project_created pc
        WHERE pc.is_deleted = false AND pc.is_floated = false ${_sql_condition}`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                search_text: '%' + _search_text + '%',
                purpose_id: _purpose_id,
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY pc.project_id DESC) AS sr_no,
        pc.unique_id, pc.project_no, pc.project_name, pc.project_cost, pc.purpose_id, pc.funding_option_id, pc.start_date, pc.end_date, 
        pc.added_date, c.country_name, s.state_name, d.district_name, b.block_name, pc.pin_code, um.company_name
        FROM project_created pc INNER JOIN user_master um ON pc.reg_id = um.reg_id
        LEFT OUTER JOIN countries c ON pc.country_id = c.country_id LEFT OUTER JOIN states s ON pc.state_id = s.state_id
        LEFT OUTER JOIN districts d ON pc.district_id = d.district_id LEFT OUTER JOIN blocks b ON pc.block_id = b.block_id
        WHERE pc.is_deleted = false AND pc.is_floated = false ${_sql_condition}
        LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                purpose_id: _purpose_id,
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no,
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {

            var purpose = '';
            for (let p = 0; p < constants.project_purpose.length; p++) {
                if (constants.project_purpose[p].id.toString() == row1[i].purpose_id.toString()) {
                    purpose = constants.project_purpose[p].name; break;
                }
            }
            var funding_option = '';
            for (let p = 0; p < constants.project_funding_option.length; p++) {
                if (constants.project_funding_option[p].id.toString() == row1[i].funding_option_id.toString()) {
                    funding_option = constants.project_funding_option[p].name; break;
                }
            }
            const _project_cost = row1[i].project_cost != null && validator.isNumeric(row1[i].project_cost.toString()) ? parseFloat(row1[i].project_cost) : 0;

            list.push({
                sr_no: row1[i].sr_no,
                project_id: row1[i].unique_id,
                project_no: row1[i].project_no,
                project_name: row1[i].project_name,
                purpose: purpose,
                funding_option: funding_option,
                company_name: row1[i].company_name,
                project_cost: _project_cost,
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
                start_date: row1[i].start_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].start_date)) : "",
                end_date: row1[i].end_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].end_date)) : "",
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
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

const project_created_detail = async (req, res, next) => {
    const { project_id } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        if (_project_id.length > 0 && utils.isUUID(_project_id)) {
            const _querySelProj = `SELECT pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, pc.purpose_id, pc.funding_option_id, 
            pc.is_floated, pc.proj_objective, pc.proj_summary, pc.beneficiary_detail, pc.mapped_under, pc.sdg_goals, pc.esg_objective, pc.visible_to_all_ia, pc.visible_ia_list,
            COALESCE((SELECT t.thematic_name FROM thematic_area t WHERE t.thematic_id = COALESCE(pc.thematic_id, 0) LIMIT 1), '') AS thematic_area,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(pc.country_id, 0) LIMIT 1), '') AS country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(pc.state_id, 0) LIMIT 1), '') AS state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(pc.district_id, 0) LIMIT 1), '') AS district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(pc.block_id, 0) LIMIT 1), '') AS block_name, pc.pin_code,
            pc.incharge_full_name, pc.incharge_designation, pc.incharge_email_id, pc.incharge_mobile_ccc, pc.incharge_mobile_no,  
            um.first_name AS c_first_name, um.middle_name AS c_middle_name, um.last_name AS c_last_name, um.email_id AS c_email_id, 
            um.mobile_ccc AS c_mobile_ccc, um.mobile_no AS c_mobile_no, um.company_name AS c_company_name
            FROM project_created pc INNER JOIN user_master um ON pc.reg_id = um.reg_id 
            WHERE pc.unique_id = ? AND pc.is_deleted = false`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0]; var visible_to_ia_list = [];

                const _is_floated = rowData.is_floated && rowData.is_floated == true ? true : false;
                if (_is_floated != false) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Project is floated, Please check in project floated list.', null));
                }
                var purpose = '';
                for (let p = 0; p < constants.project_purpose.length; p++) {
                    if (constants.project_purpose[p].id.toString() == rowData.purpose_id.toString()) {
                        purpose = constants.project_purpose[p].name; break;
                    }
                }
                var funding_option = '';
                for (let p = 0; p < constants.project_funding_option.length; p++) {
                    if (constants.project_funding_option[p].id.toString() == rowData.funding_option_id.toString()) {
                        funding_option = constants.project_funding_option[p].name; break;
                    }
                }
                var mapped_under = '';
                for (let p = 0; p < constants.project_mapped_under.length; p++) {
                    if (constants.project_mapped_under[p].id.toString().toLowerCase() == rowData.mapped_under.toString().toLowerCase()) {
                        mapped_under = constants.project_mapped_under[p].name; break;
                    }
                }
                var sdg_goals = [];
                if (rowData.sdg_goals && rowData.sdg_goals.length > 0) {
                    sdg_goals = await commonModule.project_sdg_goals_get_by_ids(rowData.sdg_goals);
                }
                var my_scope_of_work = await entityDataModule.project_scope_of_work_view_data(rowData.project_id);
                var questionnaire = await entityDataModule.project_questionnaire_data(rowData.project_id);
                for (let i = 0; questionnaire && i < questionnaire.length; i++) {
                    try { questionnaire[i].max_score = parseFloat(questionnaire[i].max_score).toString(); } catch (_) { }
                    try { questionnaire[i].weightage = parseFloat(questionnaire[i].weightage).toString(); } catch (_) { }
                }
                var rfp_document = await entityDataModule.project_document_view_uploaded(rowData.project_id);
                const dynamic_values = await commonModule.project_dynamic_field_data(rowData.project_id);
                const visible_to_all_ia = (rowData.visible_to_all_ia && rowData.visible_to_all_ia == true ? true : false);
                if (!visible_to_all_ia && rowData.visible_ia_list && rowData.visible_ia_list.length > 0) {
                    visible_to_ia_list = await entityDataModule.project_visible_to_ia_list(rowData.visible_ia_list);
                }
                const is_awarded_to_ia = await entityDataModule.is_project_awarded_to_ia(rowData.project_id);
                const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(rowData.project_cost) : 0;

                const results = {
                    owner_detail: {
                        first_name: rowData.c_first_name,
                        middle_name: rowData.c_middle_name,
                        last_name: rowData.c_last_name,
                        email_id: rowData.c_email_id,
                        mobile_ccc: (rowData.c_mobile_ccc ? rowData.c_mobile_ccc : ""),
                        mobile_no: rowData.c_mobile_no,
                        company_name: rowData.c_company_name,
                    },
                    project_detail: {
                        project_no: (rowData.project_no ? rowData.project_no : ""),
                        project_name: (rowData.project_name ? rowData.project_name : ""),
                        project_cost: _project_cost,
                        start_date: (rowData.start_date ? dateFormat(constants.textbox_date_api_format, rowData.start_date) : ""),
                        end_date: (rowData.end_date ? dateFormat(constants.textbox_date_api_format, rowData.end_date) : ""),
                        purpose_id: rowData.purpose_id,
                        purpose: purpose,
                        funding_option: funding_option,
                        thematic_area: (rowData.thematic_area ? rowData.thematic_area : ""),
                        proj_objective: (rowData.proj_objective ? rowData.proj_objective : ""),
                        proj_summary: (rowData.proj_summary ? rowData.proj_summary : ""),
                        beneficiary_detail: (rowData.beneficiary_detail ? rowData.beneficiary_detail : ""),
                        mapped_under: mapped_under,
                        sdg_goals: sdg_goals,
                        esg_objective: (rowData.esg_objective ? rowData.esg_objective : ""),
                        country_name: (rowData.country_name ? rowData.country_name : ""),
                        state_name: (rowData.state_name ? rowData.state_name : ""),
                        district_name: (rowData.district_name ? rowData.district_name : ""),
                        block_name: (rowData.block_name ? rowData.block_name : ""),
                        pin_code: (rowData.pin_code ? rowData.pin_code : ""),
                    },
                    project_incharge: {
                        full_name: rowData.incharge_full_name,
                        designation: rowData.incharge_designation,
                        email_id: rowData.incharge_email_id,
                        mobile_ccc: rowData.incharge_mobile_ccc,
                        mobile_no: rowData.incharge_mobile_no,
                    },
                    dynamic_values: dynamic_values,
                    scope_of_work: my_scope_of_work,
                    questionnaire: questionnaire,
                    rfp_document: rfp_document,
                    visible_to_all_ia: visible_to_all_ia,
                    visible_to_ia_list: visible_to_ia_list,
                    is_awarded_to_ia: is_awarded_to_ia,
                };
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_floated_list = async (req, res, next) => {
    const { page_no, search_text, purpose_id, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _purpose_id = purpose_id != null && validator.isNumeric(purpose_id.toString()) ? BigInt(purpose_id) : 0;
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        var _sql_condition = '';
        if (_search_text.length > 0) {
            _sql_condition += ' AND (LOWER(pc.project_no) LIKE LOWER(:search_text) OR LOWER(pc.project_name) LIKE LOWER(:search_text)) ';
        }
        if (_purpose_id > 0) { _sql_condition += ' AND pc.purpose_id = :purpose_id '; }
        if (_country_id > 0) { _sql_condition += ' AND pc.country_id = :country_id '; }
        if (_state_id > 0) { _sql_condition += ' AND pc.state_id = :state_id '; }
        if (_district_id > 0) { _sql_condition += ' AND pc.district_id = :district_id '; }
        if (_block_id > 0) { _sql_condition += ' AND pc.block_id = :block_id '; }

        const _query0 = `SELECT count(1) AS total_record FROM project_created pc
        WHERE pc.is_deleted = false AND pc.is_floated = true AND pc.is_accepted_by_ia = false ${_sql_condition}`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                search_text: '%' + _search_text + '%',
                purpose_id: _purpose_id,
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY pc.project_id DESC) AS sr_no,
        pc.unique_id, pc.project_no, pc.project_name, pc.project_cost, pc.purpose_id, pc.funding_option_id, pc.start_date, pc.end_date, 
        pc.floated_date, c.country_name, s.state_name, d.district_name, b.block_name, pc.pin_code, um.company_name,
        COALESCE((SELECT COUNT(1) FROM project_appl_mast ii WHERE ii.project_id = pc.project_id), 0) AS appl_count
        FROM project_created pc INNER JOIN user_master um ON pc.reg_id = um.reg_id
        LEFT OUTER JOIN countries c ON pc.country_id = c.country_id LEFT OUTER JOIN states s ON pc.state_id = s.state_id
        LEFT OUTER JOIN districts d ON pc.district_id = d.district_id LEFT OUTER JOIN blocks b ON pc.block_id = b.block_id
        WHERE pc.is_deleted = false AND pc.is_floated = true AND pc.is_accepted_by_ia = false ${_sql_condition}
        LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                purpose_id: _purpose_id,
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no,
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {

            var purpose = '';
            for (let p = 0; p < constants.project_purpose.length; p++) {
                if (constants.project_purpose[p].id.toString() == row1[i].purpose_id.toString()) {
                    purpose = constants.project_purpose[p].name; break;
                }
            }
            var funding_option = '';
            for (let p = 0; p < constants.project_funding_option.length; p++) {
                if (constants.project_funding_option[p].id.toString() == row1[i].funding_option_id.toString()) {
                    funding_option = constants.project_funding_option[p].name; break;
                }
            }
            const _project_cost = row1[i].project_cost != null && validator.isNumeric(row1[i].project_cost.toString()) ? parseFloat(row1[i].project_cost) : 0;


            list.push({
                sr_no: row1[i].sr_no,
                project_id: row1[i].unique_id,
                project_no: row1[i].project_no,
                project_name: row1[i].project_name,
                purpose: purpose,
                funding_option: funding_option,
                company_name: row1[i].company_name,
                project_cost: _project_cost,
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
                start_date: row1[i].start_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].start_date)) : "",
                end_date: row1[i].end_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].end_date)) : "",
                floated_date: row1[i].floated_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].floated_date)) : "",
                appl_count: row1[i].appl_count,
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

const project_floated_detail = async (req, res, next) => {
    const { project_id } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        if (_project_id.length > 0 && utils.isUUID(_project_id)) {
            const _querySelProj = `SELECT pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, pc.purpose_id, pc.funding_option_id, 
            pc.proj_objective, pc.proj_summary, pc.beneficiary_detail, pc.mapped_under, pc.sdg_goals, pc.esg_objective, pc.visible_to_all_ia, pc.visible_ia_list,
            COALESCE((SELECT t.thematic_name FROM thematic_area t WHERE t.thematic_id = COALESCE(pc.thematic_id, 0) LIMIT 1), '') AS thematic_area,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(pc.country_id, 0) LIMIT 1), '') AS country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(pc.state_id, 0) LIMIT 1), '') AS state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(pc.district_id, 0) LIMIT 1), '') AS district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(pc.block_id, 0) LIMIT 1), '') AS block_name, pc.pin_code,
            pc.incharge_full_name, pc.incharge_designation, pc.incharge_email_id, pc.incharge_mobile_ccc, pc.incharge_mobile_no,  
            um.first_name AS c_first_name, um.middle_name AS c_middle_name, um.last_name AS c_last_name, um.email_id AS c_email_id, 
            um.mobile_ccc AS c_mobile_ccc, um.mobile_no AS c_mobile_no, um.company_name AS c_company_name
            FROM project_created pc INNER JOIN user_master um ON pc.reg_id = um.reg_id 
            WHERE pc.unique_id = ? AND pc.is_deleted = false `;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0]; var visible_to_ia_list = [];

                const _is_floated = rowData.is_floated && rowData.is_floated == true ? true : false;
                if (_is_floated != true) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Project is not yet floated, Please check in project created list.', null));
                }

                var purpose = '';
                for (let p = 0; p < constants.project_purpose.length; p++) {
                    if (constants.project_purpose[p].id.toString() == rowData.purpose_id.toString()) {
                        purpose = constants.project_purpose[p].name; break;
                    }
                }
                var funding_option = '';
                for (let p = 0; p < constants.project_funding_option.length; p++) {
                    if (constants.project_funding_option[p].id.toString() == rowData.funding_option_id.toString()) {
                        funding_option = constants.project_funding_option[p].name; break;
                    }
                }
                var mapped_under = '';
                for (let p = 0; p < constants.project_mapped_under.length; p++) {
                    if (constants.project_mapped_under[p].id.toString().toLowerCase() == rowData.mapped_under.toString().toLowerCase()) {
                        mapped_under = constants.project_mapped_under[p].name; break;
                    }
                }
                var sdg_goals = [];
                if (rowData.sdg_goals && rowData.sdg_goals.length > 0) {
                    sdg_goals = await commonModule.project_sdg_goals_get_by_ids(rowData.sdg_goals);
                }
                var my_scope_of_work = await entityDataModule.project_scope_of_work_view_data(rowData.project_id);
                var questionnaire = await entityDataModule.project_questionnaire_data(rowData.project_id);
                for (let i = 0; questionnaire && i < questionnaire.length; i++) {
                    try { questionnaire[i].max_score = parseFloat(questionnaire[i].max_score).toString(); } catch (_) { }
                    try { questionnaire[i].weightage = parseFloat(questionnaire[i].weightage).toString(); } catch (_) { }
                }
                var rfp_document = await entityDataModule.project_document_view_uploaded(rowData.project_id);
                const dynamic_values = await commonModule.project_dynamic_field_data(rowData.project_id);
                const visible_to_all_ia = (rowData.visible_to_all_ia && rowData.visible_to_all_ia == true ? true : false);
                if (!visible_to_all_ia && rowData.visible_ia_list && rowData.visible_ia_list.length > 0) {
                    visible_to_ia_list = await entityDataModule.project_visible_to_ia_list(rowData.visible_ia_list);
                }
                const is_awarded_to_ia = await entityDataModule.is_project_awarded_to_ia(rowData.project_id);
                const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(rowData.project_cost) : 0;

                const results = {
                    owner_detail: {
                        first_name: rowData.c_first_name,
                        middle_name: rowData.c_middle_name,
                        last_name: rowData.c_last_name,
                        email_id: rowData.c_email_id,
                        mobile_ccc: (rowData.c_mobile_ccc ? rowData.c_mobile_ccc : ""),
                        mobile_no: rowData.c_mobile_no,
                        company_name: rowData.c_company_name,
                    },
                    project_detail: {
                        project_no: (rowData.project_no ? rowData.project_no : ""),
                        project_name: (rowData.project_name ? rowData.project_name : ""),
                        project_cost: _project_cost,
                        start_date: (rowData.start_date ? dateFormat(constants.textbox_date_api_format, rowData.start_date) : ""),
                        end_date: (rowData.end_date ? dateFormat(constants.textbox_date_api_format, rowData.end_date) : ""),
                        purpose_id: rowData.purpose_id,
                        purpose: purpose,
                        funding_option: funding_option,
                        thematic_area: (rowData.thematic_area ? rowData.thematic_area : ""),
                        proj_objective: (rowData.proj_objective ? rowData.proj_objective : ""),
                        proj_summary: (rowData.proj_summary ? rowData.proj_summary : ""),
                        beneficiary_detail: (rowData.beneficiary_detail ? rowData.beneficiary_detail : ""),
                        mapped_under: mapped_under,
                        sdg_goals: sdg_goals,
                        esg_objective: (rowData.esg_objective ? rowData.esg_objective : ""),
                        country_name: (rowData.country_name ? rowData.country_name : ""),
                        state_name: (rowData.state_name ? rowData.state_name : ""),
                        district_name: (rowData.district_name ? rowData.district_name : ""),
                        block_name: (rowData.block_name ? rowData.block_name : ""),
                        pin_code: (rowData.pin_code ? rowData.pin_code : ""),
                    },
                    project_incharge: {
                        full_name: rowData.incharge_full_name,
                        designation: rowData.incharge_designation,
                        email_id: rowData.incharge_email_id,
                        mobile_ccc: rowData.incharge_mobile_ccc,
                        mobile_no: rowData.incharge_mobile_no,
                    },
                    dynamic_values: dynamic_values,
                    scope_of_work: my_scope_of_work,
                    questionnaire: questionnaire,
                    rfp_document: rfp_document,
                    visible_to_all_ia: visible_to_all_ia,
                    visible_to_ia_list: visible_to_ia_list,
                    is_awarded_to_ia: is_awarded_to_ia,
                };
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_awarded_list = async (req, res, next) => {
    const { page_no, search_text, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        var _sql_condition = '';
        if (_search_text.length > 0) {
            _sql_condition += ' AND (LOWER(pc.project_no) LIKE LOWER(:search_text) OR LOWER(pc.project_name) LIKE LOWER(:search_text)) ';
        }
        if (_country_id > 0) { _sql_condition += ' AND pc.country_id = :country_id '; }
        if (_state_id > 0) { _sql_condition += ' AND pc.state_id = :state_id '; }
        if (_district_id > 0) { _sql_condition += ' AND pc.district_id = :district_id '; }
        if (_block_id > 0) { _sql_condition += ' AND pc.block_id = :block_id '; }

        const _query0 = `SELECT count(1) AS total_record FROM project_accepted pa INNER JOIN project_created pc ON pa.project_id = pc.project_id
        WHERE pc.is_deleted = false ${_sql_condition}`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                search_text: '%' + _search_text + '%',
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY pa.accepted_id DESC) AS sr_no,
        pa.unique_id AS accept_unique_id, pa.accepted_date, pa.project_status,
        pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, 
        c.country_name, s.state_name, d.district_name, b.block_name, pc.pin_code, uo.company_name AS o_company_name, ui.company_name AS i_company_name
        FROM project_accepted pa INNER JOIN project_created pc ON pa.project_id = pc.project_id
        LEFT OUTER JOIN user_master uo ON pa.owner_reg_id = uo.reg_id LEFT OUTER JOIN user_master ui ON pa.ia_reg_id = ui.reg_id
        LEFT OUTER JOIN countries c ON pc.country_id = c.country_id LEFT OUTER JOIN states s ON pc.state_id = s.state_id
        LEFT OUTER JOIN districts d ON pc.district_id = d.district_id LEFT OUTER JOIN blocks b ON pc.block_id = b.block_id
        WHERE pc.is_deleted = false ${_sql_condition}
        LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no,
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            const _project_cost = row1[i].project_cost != null && validator.isNumeric(row1[i].project_cost.toString()) ? parseFloat(row1[i].project_cost) : 0;
            list.push({
                sr_no: row1[i].sr_no,
                accept_id: row1[i].accept_unique_id,
                project_no: row1[i].project_no,
                project_name: row1[i].project_name,
                owner_company_name: row1[i].o_company_name,
                ia_company_name: row1[i].i_company_name,
                project_cost: _project_cost,
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
                start_date: row1[i].start_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].start_date)) : "",
                end_date: row1[i].end_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].end_date)) : "",
                accepted_date: row1[i].accepted_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].accepted_date)) : "",
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

const project_awarded_detail = async (req, res, next) => {
    const { accept_id } = req.body;
    try {
        const _accept_id = (accept_id && accept_id.length > 0) ? accept_id.trim() : "";
        if (_accept_id.length > 0 && utils.isUUID(_accept_id)) {
            const _querySelProj = `SELECT pa.project_id, pa.apply_id, am.unique_id AS apply_unique_id, pa.accepted_date, pa.owner_reg_id, pa.ia_reg_id,
            pc.unique_id AS project_unique_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, pc.purpose_id, 
            pc.funding_option_id, pc.proj_objective, pc.proj_summary, pc.beneficiary_detail, pc.mapped_under, pc.sdg_goals, pc.esg_objective,
            COALESCE((SELECT t.thematic_name FROM thematic_area t WHERE t.thematic_id = COALESCE(pc.thematic_id, 0) LIMIT 1), '') AS thematic_area,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(pc.country_id, 0) LIMIT 1), '') AS country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(pc.state_id, 0) LIMIT 1), '') AS state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(pc.district_id, 0) LIMIT 1), '') AS district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(pc.block_id, 0) LIMIT 1), '') AS block_name, pc.pin_code,
            pc.incharge_full_name, pc.incharge_designation, pc.incharge_email_id, pc.incharge_mobile_ccc, pc.incharge_mobile_no, pc.visible_to_all_ia,
            pc.visible_ia_list,

            uo.first_name AS o_first_name, uo.middle_name AS o_middle_name, uo.last_name AS o_last_name, uo.email_id AS o_email_id, 
            uo.mobile_ccc AS o_mobile_ccc, uo.mobile_no AS o_mobile_no, uo.company_name AS o_company_name,

            ui.first_name AS i_first_name, ui.middle_name AS i_middle_name, ui.last_name AS i_last_name, ui.email_id AS i_email_id, 
            ui.mobile_ccc AS i_mobile_ccc, ui.mobile_no AS i_mobile_no, ui.company_name AS i_company_name

            FROM project_accepted pa INNER JOIN project_created pc ON pa.project_id = pc.project_id
            LEFT OUTER JOIN user_master uo ON pa.owner_reg_id = uo.reg_id
            LEFT OUTER JOIN user_master ui ON pa.ia_reg_id = ui.reg_id
            LEFT OUTER JOIN project_appl_mast am ON pa.apply_id = am.apply_id

            WHERE pa.unique_id = ?`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_accept_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0]; var visible_to_ia_list = [];
                const visible_to_all_ia = (rowData.visible_to_all_ia && rowData.visible_to_all_ia == true ? true : false);
                if (!visible_to_all_ia && rowData.visible_ia_list && rowData.visible_ia_list.length > 0) {
                    visible_to_ia_list = await entityDataModule.project_visible_to_ia_list(rowData.visible_ia_list);
                }
                var purpose = '';
                for (let p = 0; p < constants.project_purpose.length; p++) {
                    if (constants.project_purpose[p].id.toString() == rowData.purpose_id.toString()) {
                        purpose = constants.project_purpose[p].name; break;
                    }
                }
                var funding_option = '';
                for (let p = 0; p < constants.project_funding_option.length; p++) {
                    if (constants.project_funding_option[p].id == rowData.funding_option_id) {
                        funding_option = constants.project_funding_option[p].name; break;
                    }
                }
                var mapped_under = '';
                for (let p = 0; p < constants.project_mapped_under.length; p++) {
                    if (constants.project_mapped_under[p].id.toString().toLowerCase() == rowData.mapped_under.toString().toLowerCase()) {
                        mapped_under = constants.project_mapped_under[p].name; break;
                    }
                }
                var sdg_goals = [];
                if (rowData.sdg_goals && rowData.sdg_goals.length > 0) {
                    sdg_goals = await commonModule.project_sdg_goals_get_by_ids(rowData.sdg_goals);
                }
                const dynamic_values = await commonModule.project_dynamic_field_data(rowData.project_id);
                const my_scope_of_work = await entityDataModule.project_scope_of_work_view_data(rowData.project_id);
                var questionnaire = await entityDataModule.project_questionnaire_data(rowData.project_id);
                for (let i = 0; questionnaire && i < questionnaire.length; i++) {
                    try { questionnaire[i].max_score = parseFloat(questionnaire[i].max_score).toString(); } catch (_) { }
                    try { questionnaire[i].weightage = parseFloat(questionnaire[i].weightage).toString(); } catch (_) { }
                }
                const rfp_document = await entityDataModule.project_document_view_uploaded(rowData.project_id);

                const ia_questionnaire = await entityDataModule.project_appl_questionnaire_data(rowData.apply_id);
                const ia_proposal_docs = await entityDataModule.project_appl_proposal_docs_data(rowData.apply_id);

                const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(rowData.project_cost) : 0;

                const results = {
                    project_id: rowData.project_unique_id,
                    apply_id: rowData.apply_unique_id,
                    owner_detail: {
                        first_name: rowData.o_first_name,
                        middle_name: rowData.o_middle_name,
                        last_name: rowData.o_last_name,
                        email_id: rowData.o_email_id,
                        mobile_ccc: (rowData.o_mobile_ccc ? rowData.o_mobile_ccc : ""),
                        mobile_no: rowData.o_mobile_no,
                        company_name: rowData.o_company_name,
                    },
                    project_detail: {
                        project_no: (rowData.project_no ? rowData.project_no : ""),
                        project_name: (rowData.project_name ? rowData.project_name : ""),
                        project_cost: _project_cost,
                        start_date: (rowData.start_date ? dateFormat(constants.textbox_date_api_format, rowData.start_date) : ""),
                        end_date: (rowData.end_date ? dateFormat(constants.textbox_date_api_format, rowData.end_date) : ""),
                        purpose_id: rowData.purpose_id,
                        purpose: purpose,
                        funding_option: funding_option,
                        thematic_area: (rowData.thematic_area ? rowData.thematic_area : ""),
                        proj_objective: (rowData.proj_objective ? rowData.proj_objective : ""),
                        proj_summary: (rowData.proj_summary ? rowData.proj_summary : ""),
                        beneficiary_detail: (rowData.beneficiary_detail ? rowData.beneficiary_detail : ""),
                        mapped_under: mapped_under,
                        sdg_goals: sdg_goals,
                        esg_objective: (rowData.esg_objective ? rowData.esg_objective : ""),
                        country_name: (rowData.country_name ? rowData.country_name : ""),
                        state_name: (rowData.state_name ? rowData.state_name : ""),
                        district_name: (rowData.district_name ? rowData.district_name : ""),
                        block_name: (rowData.block_name ? rowData.block_name : ""),
                        pin_code: (rowData.pin_code ? rowData.pin_code : ""),
                    },
                    project_incharge: {
                        full_name: rowData.incharge_full_name,
                        designation: rowData.incharge_designation,
                        email_id: rowData.incharge_email_id,
                        mobile_ccc: rowData.incharge_mobile_ccc,
                        mobile_no: rowData.incharge_mobile_no,
                    },
                    dynamic_values: dynamic_values,
                    scope_of_work: my_scope_of_work,
                    questionnaire: questionnaire,
                    rfp_document: rfp_document,
                    ia_detail: {
                        first_name: rowData.i_first_name,
                        middle_name: rowData.i_middle_name,
                        last_name: rowData.i_last_name,
                        email_id: rowData.i_email_id,
                        mobile_ccc: rowData.i_mobile_ccc,
                        mobile_no: rowData.i_mobile_no,
                        company_name: rowData.i_company_name,
                    },
                    ia_questionnaire: ia_questionnaire,
                    ia_proposal_docs: ia_proposal_docs,
                    visible_to_all_ia: visible_to_all_ia,
                    visible_to_ia_list: visible_to_ia_list,
                }
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_fund_transfer_agency_list = async (req, res, next) => {
    const { page_no, search_text, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        var _sql_condition = '';
        if (_search_text.length > 0) {
            _sql_condition += '  AND (LOWER(um.email_id) LIKE LOWER(:search_text) OR LOWER(um.mobile_no) LIKE LOWER(:search_text) OR ' +
                ' LOWER(um.company_name) LIKE LOWER(:search_text) OR LOWER(um.company_pan_no) LIKE LOWER(:search_text)) ';
        }
        if (_country_id > 0) { _sql_condition += ' AND um.country_id = :country_id '; }
        if (_state_id > 0) { _sql_condition += ' AND um.state_id = :state_id '; }
        if (_district_id > 0) { _sql_condition += ' AND um.district_id = :district_id '; }
        if (_block_id > 0) { _sql_condition += ' AND um.block_id = :block_id '; }

        const _query0 = `SELECT COUNT(1) AS total_record 
        FROM user_master um LEFT JOIN LATERAL (
            SELECT COUNT(1) AS reg_count FROM project_accepted pa WHERE pa.ia_reg_id = um.reg_id
        ) pa ON true
        WHERE pa.reg_count > 0 ${_sql_condition}`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                search_text: '%' + _search_text + '%',
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY um.company_name) AS sr_no,
        um.unique_id, um.reg_no, um.first_name, um.middle_name, um.last_name, um.email_id, um.mobile_ccc, um.mobile_no, um.company_name,
        c.country_name, s.state_name, d.district_name, b.block_name, um.pin_code 
        FROM user_master um LEFT JOIN LATERAL (
            SELECT COUNT(1) AS reg_count FROM project_accepted pa WHERE pa.ia_reg_id = um.reg_id
        ) pa ON true
        LEFT OUTER JOIN countries c ON um.country_id = c.country_id LEFT OUTER JOIN states s ON um.state_id = s.state_id
        LEFT OUTER JOIN districts d ON um.district_id = d.district_id LEFT OUTER JOIN blocks b ON um.block_id = b.block_id
        WHERE pa.reg_count > 0 ${_sql_condition} LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;

        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%',
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
                page_size: parseInt(process.env.PAGINATION_SIZE),
                page_no: _page_no,
            },
            type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                sr_no: row1[i].sr_no,
                id: row1[i].unique_id,
                reg_no: (row1[i].reg_no ? row1[i].reg_no : ""),
                first_name: row1[i].first_name,
                middle_name: row1[i].middle_name,
                last_name: row1[i].last_name,
                email_id: row1[i].email_id,
                mobile_no: row1[i].mobile_no,
                company_name: row1[i].company_name,
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
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

const project_fund_transfer_agency_projects = async (req, res, next) => {
    const { agency_id, page_no, search_text, country_id, state_id, district_id, block_id } = req.body;
    try {
        const _agency_id = (agency_id != null && agency_id.length > 0) ? agency_id.trim() : "";
        if (_agency_id.length > 0 && utils.isUUID(_agency_id)) {
            const agency_reg_id = await entityDataModule.user_master_get_id(_agency_id);
            if (agency_reg_id > 0) {
                var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
                var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
                var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
                var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
                var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
                var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

                var _sql_condition = '';
                if (_search_text.length > 0) {
                    _sql_condition += ' AND (LOWER(pc.project_no) LIKE LOWER(:search_text) OR LOWER(pc.project_name) LIKE LOWER(:search_text)) ';
                }
                if (_country_id > 0) { _sql_condition += ' AND pc.country_id = :country_id '; }
                if (_state_id > 0) { _sql_condition += ' AND pc.state_id = :state_id '; }
                if (_district_id > 0) { _sql_condition += ' AND pc.district_id = :district_id '; }
                if (_block_id > 0) { _sql_condition += ' AND pc.block_id = :block_id '; }

                const _query0 = `SELECT count(1) AS total_record 
                FROM project_accepted ap INNER JOIN project_created pc ON ap.project_id = pc.project_id
                WHERE ap.ia_reg_id = :ia_reg_id ${_sql_condition}`;
                const row0 = await db.sequelize.query(_query0, {
                    replacements: {
                        ia_reg_id: agency_reg_id, search_text: '%' + _search_text + '%', country_id: _country_id,
                        state_id: _state_id, district_id: _district_id, block_id: _block_id,
                    }, type: QueryTypes.SELECT
                });
                var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }
                const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY pc.project_id DESC) AS sr_no,
                ap.unique_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date,
                c.country_name, s.state_name, d.district_name, b.block_name, pc.pin_code, ap.accepted_date,
                COALESCE((SELECT COUNT(1) FROM project_milestone ml WHERE ml.project_id = ap.project_id AND ml.is_deleted = false), 0) AS milestones,
                um.company_name AS o_company_name
                FROM project_accepted ap INNER JOIN project_created pc ON ap.project_id = pc.project_id 
                LEFT OUTER JOIN user_master um ON ap.owner_reg_id = um.reg_id
                LEFT OUTER JOIN countries c ON pc.country_id = c.country_id LEFT OUTER JOIN states s ON pc.state_id = s.state_id 
                LEFT OUTER JOIN districts d ON pc.district_id = d.district_id LEFT OUTER JOIN blocks b ON pc.block_id = b.block_id
                WHERE ap.ia_reg_id = :ia_reg_id ${_sql_condition} LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
                const row1 = await db.sequelize.query(_query1, {
                    replacements: {
                        ia_reg_id: agency_reg_id, search_text: '%' + _search_text + '%', country_id: _country_id, state_id: _state_id,
                        district_id: _district_id, block_id: _block_id, page_size: parseInt(process.env.PAGINATION_SIZE), page_no: _page_no,
                    }, type: QueryTypes.SELECT
                });
                var list = [];
                for (let i = 0; row1 && i < row1.length; i++) {
                    const _project_cost = row1[i].project_cost != null && validator.isNumeric(row1[i].project_cost.toString()) ? parseFloat(row1[i].project_cost) : 0;
                    list.push({
                        sr_no: row1[i].sr_no,
                        accept_id: row1[i].unique_id,
                        owner_company_name: row1[i].o_company_name,
                        project_no: row1[i].project_no,
                        project_name: row1[i].project_name,
                        project_cost: _project_cost,
                        start_date: row1[i].start_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].start_date)) : "",
                        end_date: row1[i].end_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].end_date)) : "",
                        country_name: row1[i].country_name,
                        state_name: row1[i].state_name,
                        district_name: row1[i].district_name,
                        block_name: row1[i].block_name,
                        pin_code: row1[i].pin_code,
                        accepted_date: row1[i].accepted_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].accepted_date)) : "",
                        milestones: row1[i].milestones,
                    });
                }
                const results = {
                    current_page: _page_no,
                    total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
                    total_record: total_record,
                    data: list,
                };
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid IA projects view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid IA projects view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const project_fund_transfer_ext_payments = async (req, res, next) => {
    const { agency_id, page_no, search_text, country_id, state_id, district_id, block_id } = req.body;
    try {
        const _agency_id = (agency_id != null && agency_id.length > 0) ? agency_id.trim() : "";
        if (_agency_id.length > 0 && utils.isUUID(_agency_id)) {
            const _queryAgency = `SELECT reg_id, company_name FROM user_master WHERE unique_id = ?`;
            const rowAgency = await db.sequelize.query(_queryAgency, { replacements: [_agency_id], type: QueryTypes.SELECT });
            if (rowAgency && rowAgency.length > 0) {
                const _query1 = `SELECT accepted_id FROM project_accepted WHERE ia_reg_id = ?`;
                const row1 = await db.sequelize.query(_query1, { replacements: [rowAgency[0].reg_id], type: QueryTypes.SELECT });
                if (row1 && row1.length > 0) {
                    var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
                    var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
                    var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
                    var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
                    var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
                    var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

                    var _sql_condition = '';
                    if (_search_text.length > 0) {
                        _sql_condition += ' AND (LOWER(p.project_name) LIKE LOWER(:search_text) OR LOWER(p.milestone_name) LIKE LOWER(:search_text) OR ' +
                            'LOWER(um.company_name) LIKE LOWER(:search_text) OR LOWER(um.email_id) LIKE LOWER(:search_text) OR LOWER(um.mobile_no) LIKE LOWER(:search_text) ) ';
                    }
                    if (_country_id > 0) { _sql_condition += ' AND um.country_id = :country_id '; }
                    if (_state_id > 0) { _sql_condition += ' AND um.state_id = :state_id '; }
                    if (_district_id > 0) { _sql_condition += ' AND um.district_id = :district_id '; }
                    if (_block_id > 0) { _sql_condition += ' AND um.block_id = :block_id '; }

                    const _query0 = `SELECT COUNT(1) AS total_record
                    FROM project_payment_ext p LEFT OUTER JOIN user_master um ON p.paid_by_reg_id = um.reg_id
                    WHERE p.paid_to_reg_id = :ia_reg_id AND p.is_success = true ${_sql_condition}`;
                    const row0 = await db.sequelize.query(_query0, {
                        replacements: {
                            ia_reg_id: rowAgency[0].reg_id, search_text: '%' + _search_text + '%', country_id: _country_id,
                            state_id: _state_id, district_id: _district_id, block_id: _block_id,
                        }, type: QueryTypes.SELECT
                    });
                    var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

                    const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY p.payment_id DESC) AS sr_no,
                    p.unique_id, p.project_name, p.milestone_name, p.payment_date, p.total_amount, p.pg_charges, p.protean_fees, 
                    p.tax_amount, p.net_amount, um.company_name AS o_company_name
                    FROM project_payment_ext p LEFT OUTER JOIN user_master um ON p.paid_by_reg_id = um.reg_id
                    LEFT OUTER JOIN countries c ON um.country_id = c.country_id LEFT OUTER JOIN states s ON um.state_id = s.state_id 
                    LEFT OUTER JOIN districts d ON um.district_id = d.district_id LEFT OUTER JOIN blocks b ON um.block_id = b.block_id
                    WHERE p.paid_to_reg_id = :ia_reg_id AND p.is_success = true ${_sql_condition} LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
                    const row1 = await db.sequelize.query(_query1, {
                        replacements: {
                            ia_reg_id: rowAgency[0].reg_id, search_text: '%' + _search_text + '%', country_id: _country_id, state_id: _state_id,
                            district_id: _district_id, block_id: _block_id, page_size: parseInt(process.env.PAGINATION_SIZE), page_no: _page_no,
                        }, type: QueryTypes.SELECT
                    });
                    var list = [];
                    for (let i = 0; row1 && i < row1.length; i++) {
                        const eleHis = row1[i];
                        const _total_amount = eleHis.total_amount != null && validator.isNumeric(eleHis.total_amount.toString()) ? parseFloat(eleHis.total_amount) : 0;
                        const _pg_charges = eleHis.pg_charges != null && validator.isNumeric(eleHis.pg_charges.toString()) ? parseFloat(eleHis.pg_charges) : 0;
                        const _protean_fees = eleHis.protean_fees != null && validator.isNumeric(eleHis.protean_fees.toString()) ? parseFloat(eleHis.protean_fees) : 0;
                        const _tax_amount = eleHis.tax_amount != null && validator.isNumeric(eleHis.tax_amount.toString()) ? parseFloat(eleHis.tax_amount) : 0;
                        const _net_amount = eleHis.net_amount != null && validator.isNumeric(eleHis.net_amount.toString()) ? parseFloat(eleHis.net_amount) : 0;

                        list.push({
                            sr_no: eleHis.sr_no,
                            payment_id: eleHis.unique_id,
                            owner_company_name: eleHis.o_company_name,
                            project_name: eleHis.project_name,
                            milestone_name: eleHis.milestone_name,
                            payment_date: eleHis.payment_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(eleHis.payment_date)) : "",
                            total_amount: _total_amount,
                            pg_charges: _pg_charges,
                            protean_fees: _protean_fees,
                            tax_amount: _tax_amount,
                            net_amount: _net_amount,
                        });
                    }
                    const results = {
                        current_page: _page_no,
                        total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
                        total_record: total_record,
                        data: list,
                    };
                    return res.status(200).json(success(true, res.statusCode, "", results));
                } else {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid agency payments view detail request.', null));
                }
            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid agency payments view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid agency payments view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, err.message, null));
    }
};


const monitoring_looking_ia_project_list = async (req, res, next) => {
    const { page_no, search_text, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        var _sql_condition = '';
        if (_search_text.length > 0) { _sql_condition += ' AND (LOWER(pc.project_no) LIKE LOWER(:search_text) OR LOWER(pc.project_name) LIKE LOWER(:search_text)) '; }
        if (_country_id > 0) { _sql_condition += ' AND pc.country_id = :country_id '; }
        if (_state_id > 0) { _sql_condition += ' AND pc.state_id = :state_id '; }
        if (_district_id > 0) { _sql_condition += ' AND pc.district_id = :district_id '; }
        if (_block_id > 0) { _sql_condition += ' AND pc.block_id = :block_id '; }

        const _query0 = `SELECT count(1) AS total_record FROM project_accepted ap INNER JOIN project_created pc ON ap.project_id = pc.project_id
        LEFT OUTER JOIN user_master uo ON ap.owner_reg_id = uo.reg_id LEFT OUTER JOIN user_master ui ON ap.ia_reg_id = ui.reg_id
        WHERE (1 = 1) ${_sql_condition}`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                search_text: '%' + _search_text + '%', country_id: _country_id,
                state_id: _state_id, district_id: _district_id, block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY ap.accepted_id DESC) AS sr_no,
        ap.unique_id, ap.owner_reg_id, ap.ia_reg_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, pc.purpose_id, 
        pc.unique_id AS project_unique_id, c.country_name, s.state_name, d.district_name, b.block_name, pc.pin_code, pc.added_date, pc.modify_date,
        uo.company_name AS o_company_name, ui.company_name AS i_company_name
        FROM project_accepted ap INNER JOIN project_created pc ON ap.project_id = pc.project_id 
        LEFT OUTER JOIN user_master uo ON ap.owner_reg_id = uo.reg_id LEFT OUTER JOIN user_master ui ON ap.ia_reg_id = ui.reg_id            
        LEFT OUTER JOIN countries c ON pc.country_id = c.country_id 
        LEFT OUTER JOIN states s ON pc.state_id = s.state_id LEFT OUTER JOIN districts d ON pc.district_id = d.district_id LEFT OUTER JOIN blocks b ON pc.block_id = b.block_id
        WHERE (1 = 1) ${_sql_condition} LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%', country_id: _country_id, state_id: _state_id,
                district_id: _district_id, block_id: _block_id, page_size: parseInt(process.env.PAGINATION_SIZE), page_no: _page_no,
            }, type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {

            const _project_cost = row1[i].project_cost != null && validator.isNumeric(row1[i].project_cost.toString()) ? parseFloat(parseFloat(row1[i].project_cost).toFixed(2)) : 0;

            list.push({
                sr_no: row1[i].sr_no,
                accept_id: row1[i].unique_id,
                project_no: row1[i].project_no,
                project_name: row1[i].project_name,
                project_cost: _project_cost,
                start_date: row1[i].start_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].start_date)) : "",
                end_date: row1[i].end_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].end_date)) : "",
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                modify_date: row1[i].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].modify_date)) : "",
                owner_company_name: row1[i].o_company_name,
                ia_company_name: row1[i].i_company_name,
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

const monitoring_looking_ia_project_view = async (req, res, next) => {
    const { accept_id } = req.body;
    try {
        const _accept_id = (accept_id && accept_id.length > 0) ? accept_id.trim() : "";
        if (_accept_id.length > 0 && utils.isUUID(_accept_id)) {
            const _querySelProj = `SELECT pa.project_id, pa.apply_id, am.unique_id AS apply_unique_id, pa.accepted_date, pa.owner_reg_id, pa.ia_reg_id,
            pc.unique_id AS project_unique_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, pc.purpose_id, 
            pc.funding_option_id, pc.proj_objective, pc.proj_summary, pc.beneficiary_detail, pc.mapped_under, pc.sdg_goals, pc.esg_objective,
            COALESCE((SELECT t.thematic_name FROM thematic_area t WHERE t.thematic_id = COALESCE(pc.thematic_id, 0) LIMIT 1), '') AS thematic_area,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(pc.country_id, 0) LIMIT 1), '') AS country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(pc.state_id, 0) LIMIT 1), '') AS state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(pc.district_id, 0) LIMIT 1), '') AS district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(pc.block_id, 0) LIMIT 1), '') AS block_name, pc.pin_code,
            pc.incharge_full_name, pc.incharge_designation, pc.incharge_email_id, pc.incharge_mobile_ccc, pc.incharge_mobile_no, pc.visible_to_all_ia,
            pc.visible_ia_list,

            uo.first_name AS o_first_name, uo.middle_name AS o_middle_name, uo.last_name AS o_last_name, uo.email_id AS o_email_id, 
            uo.mobile_ccc AS o_mobile_ccc, uo.mobile_no AS o_mobile_no, uo.company_name AS o_company_name,

            ui.first_name AS i_first_name, ui.middle_name AS i_middle_name, ui.last_name AS i_last_name, ui.email_id AS i_email_id, 
            ui.mobile_ccc AS i_mobile_ccc, ui.mobile_no AS i_mobile_no, ui.company_name AS i_company_name

            FROM project_accepted pa INNER JOIN project_created pc ON pa.project_id = pc.project_id
            LEFT OUTER JOIN user_master uo ON pa.owner_reg_id = uo.reg_id
            LEFT OUTER JOIN user_master ui ON pa.ia_reg_id = ui.reg_id
            LEFT OUTER JOIN project_appl_mast am ON pa.apply_id = am.apply_id

            WHERE pa.unique_id = ?`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_accept_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0]; var visible_to_ia_list = [];
                const visible_to_all_ia = (rowData.visible_to_all_ia && rowData.visible_to_all_ia == true ? true : false);
                if (!visible_to_all_ia && rowData.visible_ia_list && rowData.visible_ia_list.length > 0) {
                    visible_to_ia_list = await entityDataModule.project_visible_to_ia_list(rowData.visible_ia_list);
                }

                var purpose = '';
                for (let p = 0; p < constants.project_purpose.length; p++) {
                    if (constants.project_purpose[p].id.toString() == rowData.purpose_id.toString()) {
                        purpose = constants.project_purpose[p].name; break;
                    }
                }
                var funding_option = '';
                for (let p = 0; p < constants.project_funding_option.length; p++) {
                    if (constants.project_funding_option[p].id == rowData.funding_option_id) {
                        funding_option = constants.project_funding_option[p].name; break;
                    }
                }
                var mapped_under = '';
                for (let p = 0; p < constants.project_mapped_under.length; p++) {
                    if (constants.project_mapped_under[p].id.toString().toLowerCase() == rowData.mapped_under.toString().toLowerCase()) {
                        mapped_under = constants.project_mapped_under[p].name; break;
                    }
                }
                var sdg_goals = [];
                if (rowData.sdg_goals && rowData.sdg_goals.length > 0) {
                    sdg_goals = await commonModule.project_sdg_goals_get_by_ids(rowData.sdg_goals);
                }
                const dynamic_values = await commonModule.project_dynamic_field_data(rowData.project_id);
                const my_scope_of_work = await entityDataModule.project_scope_of_work_view_data(rowData.project_id);
                var questionnaire = await entityDataModule.project_questionnaire_data(rowData.project_id);
                for (let i = 0; questionnaire && i < questionnaire.length; i++) {
                    try { questionnaire[i].max_score = parseFloat(questionnaire[i].max_score).toString(); } catch (_) { }
                    try { questionnaire[i].weightage = parseFloat(questionnaire[i].weightage).toString(); } catch (_) { }
                }
                const rfp_document = await entityDataModule.project_document_view_uploaded(rowData.project_id);

                const ia_questionnaire = await entityDataModule.project_appl_questionnaire_data(rowData.apply_id);
                const ia_proposal_docs = await entityDataModule.project_appl_proposal_docs_data(rowData.apply_id);
                const _project_cost = (rowData.project_cost ? parseFloat(parseFloat(rowData.project_cost).toFixed(2)) : 0);

                const results = {
                    project_id: rowData.project_unique_id,
                    apply_id: rowData.apply_unique_id,
                    owner_detail: {
                        first_name: rowData.o_first_name,
                        middle_name: rowData.o_middle_name,
                        last_name: rowData.o_last_name,
                        email_id: rowData.o_email_id,
                        mobile_ccc: (rowData.o_mobile_ccc ? rowData.o_mobile_ccc : ""),
                        mobile_no: rowData.o_mobile_no,
                        company_name: rowData.o_company_name,
                    },
                    project_detail: {
                        project_no: (rowData.project_no ? rowData.project_no : ""),
                        project_name: (rowData.project_name ? rowData.project_name : ""),
                        project_cost: _project_cost,
                        start_date: (rowData.start_date ? dateFormat(constants.textbox_date_api_format, rowData.start_date) : ""),
                        end_date: (rowData.end_date ? dateFormat(constants.textbox_date_api_format, rowData.end_date) : ""),
                        purpose: purpose,
                        funding_option: funding_option,
                        thematic_area: (rowData.thematic_area ? rowData.thematic_area : ""),
                        proj_objective: (rowData.proj_objective ? rowData.proj_objective : ""),
                        proj_summary: (rowData.proj_summary ? rowData.proj_summary : ""),
                        beneficiary_detail: (rowData.beneficiary_detail ? rowData.beneficiary_detail : ""),
                        mapped_under: mapped_under,
                        sdg_goals: sdg_goals,
                        esg_objective: (rowData.esg_objective ? rowData.esg_objective : ""),
                        country_name: (rowData.country_name ? rowData.country_name : ""),
                        state_name: (rowData.state_name ? rowData.state_name : ""),
                        district_name: (rowData.district_name ? rowData.district_name : ""),
                        block_name: (rowData.block_name ? rowData.block_name : ""),
                        pin_code: (rowData.pin_code ? rowData.pin_code : ""),
                    },
                    project_incharge: {
                        full_name: rowData.incharge_full_name,
                        designation: rowData.incharge_designation,
                        email_id: rowData.incharge_email_id,
                        mobile_ccc: rowData.incharge_mobile_ccc,
                        mobile_no: rowData.incharge_mobile_no,
                    },
                    dynamic_values: dynamic_values,
                    scope_of_work: my_scope_of_work,
                    questionnaire: questionnaire,
                    rfp_document: rfp_document,
                    ia_detail: {
                        first_name: rowData.i_first_name,
                        middle_name: rowData.i_middle_name,
                        last_name: rowData.i_last_name,
                        email_id: rowData.i_email_id,
                        mobile_ccc: rowData.i_mobile_ccc,
                        mobile_no: rowData.i_mobile_no,
                        company_name: rowData.i_company_name,
                    },
                    ia_questionnaire: ia_questionnaire,
                    ia_proposal_docs: ia_proposal_docs,
                    visible_to_all_ia: visible_to_all_ia,
                    visible_to_ia_list: visible_to_ia_list,
                }
                return res.status(200).json(success(true, res.statusCode, "", results));
            }
            else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_looking_ia_milestone_list = async (req, res, next) => {
    const { accept_id } = req.body;
    try {
        const _accept_id = (accept_id && accept_id.length > 0) ? accept_id.trim() : "";
        if (_accept_id.length > 0 && utils.isUUID(_accept_id)) {
            const _querySelProj = `SELECT pa.unique_id AS accept_unique_id, pa.accepted_id, pa.project_id, pa.apply_id, pa.accepted_date, pa.owner_reg_id, pa.ia_reg_id,
            pc.unique_id AS project_unique_id, pc.project_no, pc.project_name
            FROM project_accepted pa INNER JOIN project_created pc ON pa.project_id = pc.project_id
            WHERE pa.unique_id = ?`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_accept_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0]; var milestones = [];

                const _queryMls = `SELECT pm.milestone_id, pm.milestone_status, ml.milestone_no, ml.milestone_name,
                COALESCE((SELECT SUM(COALESCE(ppi.total_amount, 0)) FROM project_payment_int ppi WHERE ppi.accepted_id = pm.accepted_id AND ppi.milestone_id = pm.milestone_id), 0) AS amount
                FROM project_track_milestone pm INNER JOIN project_milestone ml ON pm.milestone_id = ml.milestone_id
                WHERE pm.accepted_id = ?`;
                const rowMls = await db.sequelize.query(_queryMls, { replacements: [rowData.accepted_id], type: QueryTypes.SELECT });
                for (let i = 0; rowMls && i < rowMls.length; i++) {
                    const eleRow = rowMls[i];
                    const amount = (eleRow.amount ? parseFloat(parseFloat(eleRow.amount).toFixed(2)) : 0);
                    const _milestone_status = eleRow.milestone_status != null && validator.isNumeric(eleRow.milestone_status.toString()) ? parseInt(eleRow.milestone_status) : 0;
                    milestones.push({
                        milestone_id: eleRow.milestone_id,
                        milestone_no: eleRow.milestone_no,
                        milestone_name: eleRow.milestone_name,
                        milestone_status: _milestone_status,
                        amount: amount,
                    });
                }
                const results = {
                    accept_id: rowData.accept_unique_id,
                    project_id: rowData.project_unique_id,
                    milestones: milestones,
                };
                return res.status(200).json(success(true, res.statusCode, "", results));
            }
            else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_looking_ia_milestone_view = async (req, res, next) => {
    const { accept_id, milestone_id } = req.body;
    try {
        const _accept_id = (accept_id && accept_id.length > 0) ? accept_id.trim() : "";
        const _milestone_id = (milestone_id != null && validator.isNumeric(milestone_id.toString()) ? BigInt(milestone_id) : 0);
        if (_accept_id.length > 0 && utils.isUUID(_accept_id) && _milestone_id > 0) {
            const _querySelProj = `SELECT pa.accepted_id, pa.project_id, pa.apply_id, pa.accepted_date, pa.owner_reg_id, pa.ia_reg_id,
            pc.unique_id AS project_unique_id, pc.project_no, pc.project_name
            FROM project_accepted pa INNER JOIN project_created pc ON pa.project_id = pc.project_id
            WHERE pa.unique_id = ?`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_accept_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0];

                const _queryMls = `SELECT pm.milestone_id, pm.milestone_status, pm.approval_status, ml.milestone_no, ml.milestone_name,
                pm.approve_remark, pm.reject_remark, pm.approval_status_date, ml.sort_order,
                pm.completion_file_name, pm.completion_new_name, pm.completion_gcp_path, pm.completion_to_all_delivery, 
                pm.other_file_name, pm.other_new_name, pm.other_gcp_path, pm.other_to_all_delivery, 
                pm.beneficiary_file_name, pm.beneficiary_new_name, pm.beneficiary_gcp_path, pm.beneficiary_to_all_delivery
                FROM project_track_milestone pm INNER JOIN project_milestone ml ON pm.milestone_id = ml.milestone_id
                WHERE pm.accepted_id = ? AND pm.milestone_id = ?`;
                const rowMls = await db.sequelize.query(_queryMls, { replacements: [rowData.accepted_id, _milestone_id], type: QueryTypes.SELECT });
                if (rowMls && rowMls.length > 0) {
                    const dataMil = rowMls[0]; var delivery = [];
                    const _milestone_status = dataMil.milestone_status != null && validator.isNumeric(dataMil.milestone_status.toString()) ? parseInt(dataMil.milestone_status) : 0;
                    const _approval_status = (dataMil.approval_status != null && validator.isNumeric(dataMil.approval_status.toString()) ? parseInt(dataMil.approval_status) : 0);

                    const _queryDel = `SELECT pd.delivery_id, pd.delivery_status, dl.delivery_no, dl.delivery_name,
                    pd.completion_file_name, pd.completion_new_name, pd.completion_gcp_path, pd.completion_to_all_activity, 
                    pd.other_file_name, pd.other_new_name, pd.other_gcp_path, pd.other_to_all_activity, dl.sort_order,
                    pd.beneficiary_file_name, pd.beneficiary_new_name, pd.beneficiary_gcp_path, pd.beneficiary_to_all_activity
                    FROM project_track_delivery pd INNER JOIN project_delivery dl ON pd.delivery_id = dl.delivery_id
                    WHERE pd.accepted_id = ? AND pd.milestone_id = ? ORDER BY dl.sort_order`;
                    const rowDel = await db.sequelize.query(_queryDel, { replacements: [rowData.accepted_id, _milestone_id], type: QueryTypes.SELECT });
                    for (let i = 0; rowDel && i < rowDel.length; i++) {
                        const eleDel = rowDel[i]; var activity = [];
                        const _delivery_status = eleDel.delivery_status != null && validator.isNumeric(eleDel.delivery_status.toString()) ? parseInt(eleDel.delivery_status) : 0;
                        const _queryAct = `SELECT pa.activity_id, pa.activity_status, ac.activity_no, ac.activity_name, ac.sort_order,
                        pa.completion_file_name, pa.completion_new_name, pa.completion_gcp_path, pa.other_file_name, pa.other_new_name, 
                        pa.other_gcp_path, pa.beneficiary_file_name, pa.beneficiary_new_name, pa.beneficiary_gcp_path
                        FROM project_track_activity pa INNER JOIN project_activity ac ON pa.activity_id = ac.activity_id
                        WHERE pa.accepted_id = ? AND pa.delivery_id = ? ORDER BY ac.sort_order`;
                        const rowAct = await db.sequelize.query(_queryAct, { replacements: [rowData.accepted_id, eleDel.delivery_id], type: QueryTypes.SELECT });
                        for (let j = 0; rowAct && j < rowAct.length; j++) {
                            const eleAct = rowAct[j];
                            const _activity_status = eleAct.activity_status != null && validator.isNumeric(eleAct.activity_status.toString()) ? parseInt(eleAct.activity_status) : 0;

                            activity.push({
                                activity_id: eleAct.activity_id,
                                activity_no: eleAct.activity_no,
                                activity_name: eleAct.activity_name,
                                activity_order: eleAct.sort_order,
                                activity_status: _activity_status,
                                completion_file_name: (eleAct.completion_file_name ? eleAct.completion_file_name : ""),
                                completion_new_name: (eleAct.completion_new_name ? eleAct.completion_new_name : ""),
                                other_file_name: (eleAct.other_file_name ? eleAct.other_file_name : ""),
                                other_new_name: (eleAct.other_new_name ? eleAct.other_new_name : ""),
                                beneficiary_file_name: (eleAct.beneficiary_file_name ? eleAct.beneficiary_file_name : ""),
                                beneficiary_new_name: (eleAct.beneficiary_new_name ? eleAct.beneficiary_new_name : ""),
                            });
                        }

                        delivery.push({
                            delivery_id: eleDel.delivery_id,
                            delivery_no: eleDel.delivery_no,
                            delivery_name: eleDel.delivery_name,
                            delivery_order: eleDel.sort_order,
                            delivery_status: _delivery_status,
                            completion_file_name: (eleDel.completion_file_name ? eleDel.completion_file_name : ""),
                            completion_new_name: (eleDel.completion_new_name ? eleDel.completion_new_name : ""),
                            completion_to_all_activity: eleDel.completion_to_all_activity,
                            other_file_name: (eleDel.other_file_name ? eleDel.other_file_name : ""),
                            other_new_name: (eleDel.other_new_name ? eleDel.other_new_name : ""),
                            other_to_all_activity: eleDel.other_to_all_activity,
                            beneficiary_file_name: (eleDel.beneficiary_file_name ? eleDel.beneficiary_file_name : ""),
                            beneficiary_new_name: (eleDel.beneficiary_new_name ? eleDel.beneficiary_new_name : ""),
                            beneficiary_to_all_activity: eleDel.beneficiary_to_all_activity,
                            activity: activity,
                        });
                    }

                    const results = {
                        project_id: rowData.project_unique_id,
                        milestone_id: _milestone_id,
                        milestone_no: dataMil.milestone_no,
                        milestone_name: dataMil.milestone_name,
                        milestone_order: dataMil.sort_order,
                        milestone_status: _milestone_status,
                        request_for_approve: (_approval_status.toString() == '1' ? true : false),
                        is_approved: (_approval_status.toString() == '2' ? true : false),
                        approve_remark: (dataMil.approve_remark ? dataMil.approve_remark : ""),
                        is_rejected: (_approval_status.toString() == '3' ? true : false),
                        reject_remark: (dataMil.reject_remark ? dataMil.reject_remark : ""),
                        status_date: dataMil.approval_status_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(dataMil.approval_status_date)) : "",
                        completion_file_name: (dataMil.completion_file_name ? dataMil.completion_file_name : ""),
                        completion_new_name: (dataMil.completion_new_name ? dataMil.completion_new_name : ""),
                        completion_to_all_delivery: dataMil.completion_to_all_delivery,
                        other_file_name: (dataMil.other_file_name ? dataMil.other_file_name : ""),
                        other_new_name: (dataMil.other_new_name ? dataMil.other_new_name : ""),
                        other_to_all_delivery: dataMil.other_to_all_delivery,
                        beneficiary_file_name: (dataMil.beneficiary_file_name ? dataMil.beneficiary_file_name : ""),
                        beneficiary_new_name: (dataMil.beneficiary_new_name ? dataMil.beneficiary_new_name : ""),
                        beneficiary_to_all_delivery: dataMil.beneficiary_to_all_delivery,
                        delivery: delivery,
                    };
                    return res.status(200).json(success(true, res.statusCode, "", results));
                } else {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
                }
            }
            else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_looking_ia_milestone_doc_get_url = async (req, res, next) => {
    const { accept_id, milestone_id, doc_type, field_type, field_id } = req.body;
    try {
        const _accept_id = (accept_id && accept_id.length > 0) ? accept_id.trim() : "";
        const _milestone_id = (milestone_id != null && validator.isNumeric(milestone_id.toString()) ? BigInt(milestone_id) : 0);
        if (_accept_id.length > 0 && utils.isUUID(_accept_id) && _milestone_id > 0) {
            const _querySelProj = `SELECT pa.accepted_id, pa.project_id, pa.owner_reg_id, pa.ia_reg_id FROM project_accepted pa WHERE pa.unique_id = ?`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_accept_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {

                const doc_type_allowed = ['completion', 'other', 'beneficiary'];
                const field_type_allowed = ['milestone', 'delivery', 'activity'];

                const _doc_type = (doc_type && doc_type.length > 0) ? doc_type.trim() : "";
                if (!utils.check_in_array(_doc_type.toLowerCase(), doc_type_allowed)) {
                    return res.status(200).json(success(false, res.statusCode, 'Invalid value for parameter : "doc_type".<br>Values should be - ' + doc_type_allowed.join(', ') + '.', null));
                }
                const _field_type = (field_type && field_type.length > 0) ? field_type.trim() : "";
                if (!utils.check_in_array(_field_type.toLowerCase(), field_type_allowed)) {
                    return res.status(200).json(success(false, res.statusCode, 'Invalid value for parameter : "field_type".<br>Values should be - ' + field_type_allowed.join(', ') + '.', null));
                }
                const _field_id = field_id != null && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;
                const resp = await entityDataModule.monitoring_looking_ia_milestone_doc_get_url(rowSelProj[0].accepted_id, _doc_type.toLowerCase(), _field_type.toLowerCase(), _field_id);
                return res.status(200).json(success(true, res.statusCode, "", resp));
            }
            else {
                return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};


const monitoring_crowd_fund_project_list = async (req, res, next) => {
    const { page_no, search_text, funding_option_id, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _funding_option_id = funding_option_id != null && validator.isNumeric(funding_option_id.toString()) ? BigInt(funding_option_id) : 0;
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        var _sql_condition = '';
        if (_search_text.length > 0) {
            _sql_condition += ' AND (LOWER(pc.project_no) LIKE LOWER(:search_text) OR LOWER(pc.project_name) LIKE LOWER(:search_text)' +
                '  OR LOWER(um.company_name) LIKE LOWER(:search_text)  ) ';
        }
        if (_country_id > 0) { _sql_condition += ' AND pc.country_id = :country_id '; }
        if (_state_id > 0) { _sql_condition += ' AND pc.state_id = :state_id '; }
        if (_district_id > 0) { _sql_condition += ' AND pc.district_id = :district_id '; }
        if (_block_id > 0) { _sql_condition += ' AND pc.block_id = :block_id '; }
        if (_funding_option_id > 0) { _sql_condition += ' AND pc.funding_option_id = :funding_option_id '; }

        const _query0 = `SELECT count(1) AS total_record FROM project_created pc INNER JOIN user_master um ON pc.reg_id = um.reg_id
        WHERE pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2 ${_sql_condition}`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                search_text: '%' + _search_text + '%', funding_option_id: _funding_option_id, country_id: _country_id,
                state_id: _state_id, district_id: _district_id, block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY pc.project_id DESC) AS sr_no,
        pc.unique_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, pc.floated_date, pc.funding_option_id,
        c.country_name, s.state_name, d.district_name, b.block_name, pc.pin_code, um.company_name
        FROM project_created pc INNER JOIN user_master um ON pc.reg_id = um.reg_id
        LEFT OUTER JOIN countries c ON pc.country_id = c.country_id LEFT OUTER JOIN states s ON pc.state_id = s.state_id
        LEFT OUTER JOIN districts d ON pc.district_id = d.district_id LEFT OUTER JOIN blocks b ON pc.block_id = b.block_id                      
        WHERE pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2 ${_sql_condition}
        LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                search_text: '%' + _search_text + '%', funding_option_id: _funding_option_id, country_id: _country_id, state_id: _state_id,
                district_id: _district_id, block_id: _block_id, page_size: parseInt(process.env.PAGINATION_SIZE), page_no: _page_no,
            }, type: QueryTypes.SELECT
        });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            var funding_option = '';
            for (let p = 0; p < constants.project_funding_option.length; p++) {
                if (constants.project_funding_option[p].id.toString() == row1[i].funding_option_id.toString()) {
                    funding_option = constants.project_funding_option[p].short_name; break;
                }
            }
            const _project_cost = row1[i].project_cost != null && validator.isNumeric(row1[i].project_cost.toString()) ? parseFloat(parseFloat(row1[i].project_cost).toFixed(2)) : 0;

            list.push({
                sr_no: row1[i].sr_no,
                project_id: row1[i].unique_id,
                project_no: row1[i].project_no,
                project_name: row1[i].project_name,
                funding_option: funding_option,
                project_cost: _project_cost,
                owner_company_name: row1[i].company_name,
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
                start_date: row1[i].start_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].start_date)) : "",
                end_date: row1[i].end_date ? dateFormat(constants.textbox_date_api_format, utils.db_date_to_ist(row1[i].end_date)) : "",
                floated_date: row1[i].floated_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].floated_date)) : "",
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

const monitoring_crowd_fund_project_view = async (req, res, next) => {
    const { project_id } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        if (_project_id.length > 0 && utils.isUUID(_project_id)) {
            const _querySelProj = `SELECT pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost, pc.start_date, pc.end_date, pc.purpose_id, 
            pc.funding_option_id, pc.proj_objective, pc.proj_summary, pc.beneficiary_detail, pc.mapped_under, pc.sdg_goals, pc.esg_objective,
            COALESCE((SELECT t.thematic_name FROM thematic_area t WHERE t.thematic_id = COALESCE(pc.thematic_id, 0) LIMIT 1), '') AS thematic_area,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(pc.country_id, 0) LIMIT 1), '') AS country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(pc.state_id, 0) LIMIT 1), '') AS state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(pc.district_id, 0) LIMIT 1), '') AS district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(pc.block_id, 0) LIMIT 1), '') AS block_name, pc.pin_code,
            pc.incharge_full_name, pc.incharge_designation, pc.incharge_email_id, pc.incharge_mobile_ccc, pc.incharge_mobile_no,  
            um.first_name AS c_first_name, um.middle_name AS c_middle_name, um.last_name AS c_last_name, um.email_id AS c_email_id, 
            um.mobile_ccc AS c_mobile_ccc, um.mobile_no AS c_mobile_no, um.company_name AS c_company_name
            FROM project_created pc INNER JOIN user_master um ON pc.reg_id = um.reg_id 
            WHERE pc.unique_id = ? AND pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0];

                var purpose = '';
                for (let p = 0; p < constants.project_purpose.length; p++) {
                    if (constants.project_purpose[p].id.toString() == rowData.purpose_id.toString()) {
                        purpose = constants.project_purpose[p].name; break;
                    }
                }
                var funding_option = '';
                for (let p = 0; p < constants.project_funding_option.length; p++) {
                    if (constants.project_funding_option[p].id.toString() == rowData.funding_option_id.toString()) {
                        funding_option = constants.project_funding_option[p].name; break;
                    }
                }
                var mapped_under = '';
                for (let p = 0; p < constants.project_mapped_under.length; p++) {
                    if (constants.project_mapped_under[p].id.toString().toLowerCase() == rowData.mapped_under.toString().toLowerCase()) {
                        mapped_under = constants.project_mapped_under[p].name; break;
                    }
                }
                var sdg_goals = [];
                if (rowData.sdg_goals && rowData.sdg_goals.length > 0) {
                    sdg_goals = await commonModule.project_sdg_goals_get_by_ids(rowData.sdg_goals);
                }
                var my_scope_of_work = await entityDataModule.project_scope_of_work_view_data(rowData.project_id);
                const dynamic_values = await commonModule.project_dynamic_field_data(rowData.project_id);
                const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(parseFloat(rowData.project_cost).toFixed(2)) : 0;

                const results = {
                    owner_detail: {
                        first_name: rowData.c_first_name,
                        middle_name: rowData.c_middle_name,
                        last_name: rowData.c_last_name,
                        email_id: rowData.c_email_id,
                        mobile_ccc: (rowData.c_mobile_ccc ? rowData.c_mobile_ccc : ""),
                        mobile_no: rowData.c_mobile_no,
                        company_name: rowData.c_company_name,
                    },
                    project_detail: {
                        project_no: (rowData.project_no ? rowData.project_no : ""),
                        project_name: (rowData.project_name ? rowData.project_name : ""),
                        project_cost: _project_cost,
                        start_date: (rowData.start_date ? dateFormat(constants.textbox_date_api_format, rowData.start_date) : ""),
                        end_date: (rowData.end_date ? dateFormat(constants.textbox_date_api_format, rowData.end_date) : ""),
                        purpose: purpose,
                        funding_option: funding_option,
                        thematic_area: (rowData.thematic_area ? rowData.thematic_area : ""),
                        proj_objective: (rowData.proj_objective ? rowData.proj_objective : ""),
                        proj_summary: (rowData.proj_summary ? rowData.proj_summary : ""),
                        beneficiary_detail: (rowData.beneficiary_detail ? rowData.beneficiary_detail : ""),
                        mapped_under: mapped_under,
                        sdg_goals: sdg_goals,
                        esg_objective: (rowData.esg_objective ? rowData.esg_objective : ""),
                        country_name: (rowData.country_name ? rowData.country_name : ""),
                        state_name: (rowData.state_name ? rowData.state_name : ""),
                        district_name: (rowData.district_name ? rowData.district_name : ""),
                        block_name: (rowData.block_name ? rowData.block_name : ""),
                        pin_code: (rowData.pin_code ? rowData.pin_code : ""),
                    },
                    project_incharge: {
                        full_name: rowData.incharge_full_name,
                        designation: rowData.incharge_designation,
                        email_id: rowData.incharge_email_id,
                        mobile_ccc: rowData.incharge_mobile_ccc,
                        mobile_no: rowData.incharge_mobile_no,
                    },
                    dynamic_values: dynamic_values,
                    scope_of_work: my_scope_of_work,
                };
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_crowd_fund_milestone_list = async (req, res, next) => {
    const { project_id } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        if (_project_id.length > 0 && utils.isUUID(_project_id)) {
            const _querySelProj = `SELECT pc.unique_id AS project_unique_id, pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost
            FROM project_created pc WHERE pc.unique_id = ? AND pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0]; var milestones = [];

                await db.sequelize.query(`CALL project_track_crowd_fund_update_data_if_not_exists(?)`,
                    { replacements: [rowData.project_id], type: QueryTypes.UPDATE });

                const _queryMls = `SELECT pm.milestone_id, pm.milestone_status, ml.milestone_no, ml.milestone_name
                FROM project_track_milestone pm INNER JOIN project_milestone ml ON pm.milestone_id = ml.milestone_id
                WHERE pm.project_id = ?`;
                const rowMls = await db.sequelize.query(_queryMls, { replacements: [rowData.project_id], type: QueryTypes.SELECT });

                for (let i = 0; rowMls && i < rowMls.length; i++) {
                    const eleRow = rowMls[i];
                    const _milestone_status = eleRow.milestone_status != null && validator.isNumeric(eleRow.milestone_status.toString()) ? parseInt(eleRow.milestone_status) : 0;
                    milestones.push({
                        milestone_id: eleRow.milestone_id,
                        milestone_no: eleRow.milestone_no,
                        milestone_name: eleRow.milestone_name,
                        milestone_status: _milestone_status,
                    });
                }

                const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(parseFloat(rowData.project_cost).toFixed(2)) : 0;
                const fund_raised = await entityDataModule.project_total_fund_raised(rowData.project_id);

                const results = {
                    project_id: rowData.project_unique_id,
                    project_no: rowData.project_no,
                    project_name: rowData.project_name,
                    project_cost: _project_cost,
                    fund_raised: fund_raised,
                    milestones: milestones,
                };
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_crowd_fund_milestone_view = async (req, res, next) => {
    const { project_id, milestone_id } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        const _milestone_id = (milestone_id != null && validator.isNumeric(milestone_id.toString()) ? BigInt(milestone_id) : 0);
        if (_project_id.length > 0 && utils.isUUID(_project_id) && _milestone_id > 0) {
            const _querySelProj = `SELECT pc.unique_id AS project_unique_id, pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost
            FROM project_created pc WHERE pc.unique_id = ? AND pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const rowData = rowSelProj[0];

                const _queryMls = `SELECT pm.milestone_id, pm.milestone_status, pm.approval_status, ml.milestone_no, ml.milestone_name,
                pm.approve_remark, pm.reject_remark, pm.approval_status_date, ml.sort_order,
                pm.completion_file_name, pm.completion_new_name, pm.completion_gcp_path, pm.completion_to_all_delivery, 
                pm.other_file_name, pm.other_new_name, pm.other_gcp_path, pm.other_to_all_delivery, 
                pm.beneficiary_file_name, pm.beneficiary_new_name, pm.beneficiary_gcp_path, pm.beneficiary_to_all_delivery
                FROM project_track_milestone pm INNER JOIN project_milestone ml ON pm.milestone_id = ml.milestone_id
                WHERE pm.project_id = ? AND pm.milestone_id = ?`;
                const rowMls = await db.sequelize.query(_queryMls, { replacements: [rowData.project_id, _milestone_id], type: QueryTypes.SELECT });
                if (rowMls && rowMls.length > 0) {
                    const dataMil = rowMls[0]; var delivery = [];
                    const _milestone_status = dataMil.milestone_status != null && validator.isNumeric(dataMil.milestone_status.toString()) ? parseInt(dataMil.milestone_status) : 0;
                    const _approval_status = (dataMil.approval_status != null && validator.isNumeric(dataMil.approval_status.toString()) ? parseInt(dataMil.approval_status) : 0);

                    const _queryDel = `SELECT pd.delivery_id, pd.delivery_status, dl.delivery_no, dl.delivery_name,
                    pd.completion_file_name, pd.completion_new_name, pd.completion_gcp_path, pd.completion_to_all_activity, 
                    pd.other_file_name, pd.other_new_name, pd.other_gcp_path, pd.other_to_all_activity, dl.sort_order,
                    pd.beneficiary_file_name, pd.beneficiary_new_name, pd.beneficiary_gcp_path, pd.beneficiary_to_all_activity
                    FROM project_track_delivery pd INNER JOIN project_delivery dl ON pd.delivery_id = dl.delivery_id
                    WHERE pd.project_id = ? AND pd.milestone_id = ? ORDER BY dl.sort_order`;
                    const rowDel = await db.sequelize.query(_queryDel, { replacements: [rowData.project_id, _milestone_id], type: QueryTypes.SELECT });
                    for (let i = 0; rowDel && i < rowDel.length; i++) {
                        const eleDel = rowDel[i]; var activity = [];
                        const _delivery_status = eleDel.delivery_status != null && validator.isNumeric(eleDel.delivery_status.toString()) ? parseInt(eleDel.delivery_status) : 0;

                        const _queryAct = `SELECT pa.activity_id, pa.activity_status, ac.activity_no, ac.activity_name, ac.sort_order,
                        pa.completion_file_name, pa.completion_new_name, pa.completion_gcp_path, pa.other_file_name, pa.other_new_name, 
                        pa.other_gcp_path, pa.beneficiary_file_name, pa.beneficiary_new_name, pa.beneficiary_gcp_path
                        FROM project_track_activity pa INNER JOIN project_activity ac ON pa.activity_id = ac.activity_id
                        WHERE pa.project_id = ? AND pa.delivery_id = ? ORDER BY ac.sort_order`;
                        const rowAct = await db.sequelize.query(_queryAct, { replacements: [rowData.project_id, eleDel.delivery_id], type: QueryTypes.SELECT });
                        for (let j = 0; rowAct && j < rowAct.length; j++) {
                            const eleAct = rowAct[j];
                            const _activity_status = eleAct.activity_status != null && validator.isNumeric(eleAct.activity_status.toString()) ? parseInt(eleAct.activity_status) : 0;

                            activity.push({
                                activity_id: eleAct.activity_id,
                                activity_no: eleAct.activity_no,
                                activity_name: eleAct.activity_name,
                                activity_order: eleAct.sort_order,
                                activity_status: _activity_status,
                                completion_file_name: (eleAct.completion_file_name ? eleAct.completion_file_name : ""),
                                completion_new_name: (eleAct.completion_new_name ? eleAct.completion_new_name : ""),
                                other_file_name: (eleAct.other_file_name ? eleAct.other_file_name : ""),
                                other_new_name: (eleAct.other_new_name ? eleAct.other_new_name : ""),
                                beneficiary_file_name: (eleAct.beneficiary_file_name ? eleAct.beneficiary_file_name : ""),
                                beneficiary_new_name: (eleAct.beneficiary_new_name ? eleAct.beneficiary_new_name : ""),
                            });
                        }

                        delivery.push({
                            delivery_id: eleDel.delivery_id,
                            delivery_no: eleDel.delivery_no,
                            delivery_name: eleDel.delivery_name,
                            delivery_order: eleDel.sort_order,
                            delivery_status: _delivery_status,
                            completion_file_name: (eleDel.completion_file_name ? eleDel.completion_file_name : ""),
                            completion_new_name: (eleDel.completion_new_name ? eleDel.completion_new_name : ""),
                            completion_to_all_activity: eleDel.completion_to_all_activity,
                            other_file_name: (eleDel.other_file_name ? eleDel.other_file_name : ""),
                            other_new_name: (eleDel.other_new_name ? eleDel.other_new_name : ""),
                            other_to_all_activity: eleDel.other_to_all_activity,
                            beneficiary_file_name: (eleDel.beneficiary_file_name ? eleDel.beneficiary_file_name : ""),
                            beneficiary_new_name: (eleDel.beneficiary_new_name ? eleDel.beneficiary_new_name : ""),
                            beneficiary_to_all_activity: eleDel.beneficiary_to_all_activity,
                            activity: activity,
                        });
                    }

                    const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(parseFloat(rowData.project_cost).toFixed(2)) : 0;

                    const results = {
                        project_id: rowData.project_unique_id,
                        project_no: rowData.project_no,
                        project_name: rowData.project_name,
                        project_cost: _project_cost,
                        milestone_id: _milestone_id,
                        milestone_no: dataMil.milestone_no,
                        milestone_name: dataMil.milestone_name,
                        milestone_order: dataMil.sort_order,
                        milestone_status: _milestone_status,
                        request_for_approve: (_approval_status.toString() == '1' ? true : false),
                        is_approved: (_approval_status.toString() == '2' ? true : false),
                        approve_remark: (dataMil.approve_remark ? dataMil.approve_remark : ""),
                        is_rejected: (_approval_status.toString() == '3' ? true : false),
                        reject_remark: (dataMil.reject_remark ? dataMil.reject_remark : ""),
                        status_date: dataMil.approval_status_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(dataMil.approval_status_date)) : "",
                        completion_file_name: (dataMil.completion_file_name ? dataMil.completion_file_name : ""),
                        completion_new_name: (dataMil.completion_new_name ? dataMil.completion_new_name : ""),
                        completion_to_all_delivery: dataMil.completion_to_all_delivery,
                        other_file_name: (dataMil.other_file_name ? dataMil.other_file_name : ""),
                        other_new_name: (dataMil.other_new_name ? dataMil.other_new_name : ""),
                        other_to_all_delivery: dataMil.other_to_all_delivery,
                        beneficiary_file_name: (dataMil.beneficiary_file_name ? dataMil.beneficiary_file_name : ""),
                        beneficiary_new_name: (dataMil.beneficiary_new_name ? dataMil.beneficiary_new_name : ""),
                        beneficiary_to_all_delivery: dataMil.beneficiary_to_all_delivery,
                        delivery: delivery,
                    };
                    return res.status(200).json(success(true, res.statusCode, "", results));
                } else {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
                }

            } else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_crowd_fund_milestone_reject = async (req, res, next) => {
    const { project_id, milestone_id, remark } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        const _milestone_id = (milestone_id != null && validator.isNumeric(milestone_id.toString()) ? BigInt(milestone_id) : 0);
        if (_project_id.length > 0 && utils.isUUID(_project_id) && _milestone_id > 0) {
            const _querySelProj = `SELECT pc.unique_id AS project_unique_id, pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost
            FROM project_created pc WHERE pc.unique_id = ? AND pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const _remark = (remark != null && remark.length > 0) ? remark.trim() : "";
                if (_remark.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, 'Please enter reason to reject.', null));
                }
                if (_remark.length < 10) {
                    return res.status(200).json(success(false, res.statusCode, 'Reason should not be less than 10 character.', null));
                }
                const _queryChkMil = `SELECT approval_status FROM project_track_milestone WHERE project_id = ? AND milestone_id = ?`
                const rowChkMil = await db.sequelize.query(_queryChkMil, { replacements: [rowSelProj[0].project_id, _milestone_id], type: QueryTypes.SELECT });
                if (rowChkMil && rowChkMil.length > 0) {
                    const _approvalStatus = rowChkMil[0].approval_status != null && validator.isNumeric(rowChkMil[0].approval_status.toString()) ? parseInt(rowChkMil[0].approval_status.toString()) : 0;
                    if (_approvalStatus.toString() == '1') {
                        const _queryAddReq = `INSERT INTO project_track_status(project_id, milestone_id, curr_status, status_by, status_date, status_remark, is_by_owner)
                        VALUES(?, ?, ?, ?, ?, ?, ?)  RETURNING "log_id"`;
                        const _repAddReq = [rowSelProj[0].project_id, _milestone_id, 3, req.token_data.account_id, new Date(), _remark, true];
                        const [rowAddReq] = await db.sequelize.query(_queryAddReq, { replacements: _repAddReq, returning: true, type: QueryTypes.INSERT });

                        const log_id = (rowAddReq && rowAddReq.length > 0 && rowAddReq[0] ? rowAddReq[0].log_id : 0);
                        if (log_id > 0) {
                            const _queryBackUp = `SELECT 'milestone' AS field_type, milestone_id AS field_id, milestone_status AS status, 
                            completion_file_name AS c_file_name, completion_new_name AS c_new_name, completion_gcp_path AS c_gcp_path, completion_to_all_delivery AS c_to_all,
                            other_file_name AS o_file_name, other_new_name AS o_new_name, other_gcp_path AS o_gcp_path, other_to_all_delivery AS o_to_all,
                            beneficiary_file_name AS b_file_name, beneficiary_new_name AS b_new_name, beneficiary_gcp_path AS b_gcp_path, beneficiary_to_all_delivery AS b_to_all
                            FROM project_track_milestone WHERE project_id = :project_id AND milestone_id = :milestone_id
                            UNION ALL
                            SELECT 'delivery' AS field_type, delivery_id AS field_id, delivery_status AS status, 
                            completion_file_name AS c_file_name, completion_new_name AS c_new_name, completion_gcp_path AS c_gcp_path, completion_to_all_activity AS c_to_all,
                            other_file_name AS o_file_name, other_new_name AS o_new_name, other_gcp_path AS o_gcp_path, other_to_all_activity AS o_to_all,
                            beneficiary_file_name AS b_file_name, beneficiary_new_name AS b_new_name, beneficiary_gcp_path AS b_gcp_path, beneficiary_to_all_activity AS b_to_all
                            FROM project_track_delivery WHERE project_id = :project_id AND milestone_id = :milestone_id
                            UNION ALL
                            SELECT 'activity' AS field_type, activity_id AS field_id, activity_status AS status, 
                            completion_file_name AS c_file_name, completion_new_name AS c_new_name, completion_gcp_path AS c_gcp_path, false AS c_to_all,
                            other_file_name AS o_file_name, other_new_name AS o_new_name, other_gcp_path AS o_gcp_path, false AS o_to_all,
                            beneficiary_file_name AS b_file_name, beneficiary_new_name AS b_new_name, beneficiary_gcp_path AS b_gcp_path, false AS b_to_all
                            FROM project_track_activity WHERE project_id = :project_id AND delivery_id IN (
                                SELECT delivery_id FROM project_track_delivery WHERE project_id = :project_id AND milestone_id = :milestone_id
                            )`;
                            const rowBackUp = await db.sequelize.query(_queryBackUp, { replacements: { project_id: rowSelProj[0].project_id, milestone_id: _milestone_id }, type: QueryTypes.SELECT });
                            var backupArray = [];

                            for (let bi = 0; rowBackUp && bi < rowBackUp.length; bi++) {
                                const eleBak = rowBackUp[bi];
                                var c_gcp_path = (eleBak.c_gcp_path && eleBak.c_gcp_path.length > 0 ? eleBak.c_gcp_path : "");
                                if (c_gcp_path.length > 0) {
                                    const c_gcp_path_new = 'monitoring/back/' + rowSelProj[0].project_id.toString() + eleBak.c_new_name;
                                    try {
                                        await cloudStorageModule.CopyFile(c_gcp_path, c_gcp_path_new);
                                        c_gcp_path = c_gcp_path_new;
                                    } catch (_) {
                                    }
                                }
                                var o_gcp_path = (eleBak.o_gcp_path && eleBak.o_gcp_path.length > 0 ? eleBak.o_gcp_path : "");
                                if (o_gcp_path.length > 0) {
                                    const o_gcp_path_new = 'monitoring/back/' + rowSelProj[0].project_id.toString() + eleBak.o_new_name;
                                    try {
                                        await cloudStorageModule.CopyFile(o_gcp_path, o_gcp_path_new);
                                        o_gcp_path = o_gcp_path_new;
                                    } catch (_) {
                                    }
                                }
                                var b_gcp_path = (eleBak.b_gcp_path && eleBak.b_gcp_path.length > 0 ? eleBak.b_gcp_path : "");
                                if (b_gcp_path.length > 0) {
                                    const b_gcp_path_new = 'monitoring/back/' + rowSelProj[0].project_id.toString() + eleBak.b_new_name;
                                    try {
                                        await cloudStorageModule.CopyFile(b_gcp_path, b_gcp_path_new);
                                        b_gcp_path = b_gcp_path_new;
                                    } catch (_) {
                                    }
                                }

                                backupArray.push({
                                    field_type: eleBak.field_type,
                                    field_id: eleBak.field_id,
                                    status: eleBak.status,
                                    c_file_name: eleBak.c_file_name,
                                    c_new_name: eleBak.c_new_name,
                                    c_gcp_path: c_gcp_path,
                                    c_to_all: eleBak.c_to_all,
                                    o_file_name: eleBak.o_file_name,
                                    o_new_name: eleBak.o_new_name,
                                    o_gcp_path: o_gcp_path,
                                    o_to_all: eleBak.o_to_all,
                                    b_file_name: eleBak.b_file_name,
                                    b_new_name: eleBak.b_new_name,
                                    b_gcp_path: b_gcp_path,
                                    b_to_all: eleBak.b_to_all,
                                });
                            }

                            const _queryBackIn = `INSERT INTO project_track_reject_data(log_id, log_data) VALUES(?, ?)`;
                            await db.sequelize.query(_queryBackIn, { replacements: [log_id, JSON.stringify(backupArray)], type: QueryTypes.INSERT });

                            return res.status(200).json(success(true, res.statusCode, 'Rejected successfully.', null));
                        } else {
                            return res.status(200).json(success(false, res.statusCode, 'Unable to add record, Please try again.', null));
                        }
                    } else {
                        return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, 'Status has been already changed.', null));
                    }
                }
                else {
                    return res.status(200).json(success(false, res.statusCode, 'Milestone detail not found, Please try again.', null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_crowd_fund_milestone_accept = async (req, res, next) => {
    const { project_id, milestone_id, remark } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        const _milestone_id = (milestone_id != null && validator.isNumeric(milestone_id.toString()) ? BigInt(milestone_id) : 0);
        if (_project_id.length > 0 && utils.isUUID(_project_id) && _milestone_id > 0) {
            const _querySelProj = `SELECT pc.unique_id AS project_unique_id, pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost
            FROM project_created pc WHERE pc.unique_id = ? AND pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {
                const _remark = (remark != null && remark.length > 0) ? remark.trim() : "";
                if (_remark.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, 'Please enter remark to accept.', null));
                }
                if (_remark.length < 10) {
                    return res.status(200).json(success(false, res.statusCode, 'Remark should not be less than 10 character.', null));
                }
                const _queryChkMil = `SELECT approval_status FROM project_track_milestone WHERE project_id = ? AND milestone_id = ?`
                const rowChkMil = await db.sequelize.query(_queryChkMil, { replacements: [rowSelProj[0].project_id, _milestone_id], type: QueryTypes.SELECT });
                if (rowChkMil && rowChkMil.length > 0) {
                    const _approvalStatus = rowChkMil[0].approval_status != null && validator.isNumeric(rowChkMil[0].approval_status.toString()) ? parseInt(rowChkMil[0].approval_status.toString()) : 0;
                    if (_approvalStatus.toString() == '1') {
                        const _queryAddReq = `INSERT INTO project_track_status(project_id, milestone_id, curr_status, status_by, status_date, status_remark, is_by_owner)
                                VALUES(?, ?, ?, ?, ?, ?, ?)  RETURNING "log_id"`;
                        const _repAddReq = [rowSelProj[0].project_id, _milestone_id, 2, req.token_data.account_id, new Date(), _remark, false];
                        const [rowAddReq] = await db.sequelize.query(_queryAddReq, { replacements: _repAddReq, returning: true, type: QueryTypes.INSERT });

                        const log_id = (rowAddReq && rowAddReq.length > 0 && rowAddReq[0] ? rowAddReq[0].log_id : 0);
                        if (log_id > 0) {
                            return res.status(200).json(success(true, res.statusCode, 'Accepted successfully.', null));
                        } else {
                            return res.status(200).json(success(false, res.statusCode, 'Unable to add record, Please try again.', null));
                        }
                    } else {
                        return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, 'Status has been already changed.', null));
                    }
                }
                else {
                    return res.status(200).json(success(false, res.statusCode, 'Milestone detail not found, Please try again.', null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const monitoring_crowd_fund_milestone_doc_get_url = async (req, res, next) => {
    const { project_id, milestone_id, doc_type, field_type, field_id } = req.body;
    try {
        const _project_id = (project_id && project_id.length > 0) ? project_id.trim() : "";
        const _milestone_id = (milestone_id != null && validator.isNumeric(milestone_id.toString()) ? BigInt(milestone_id) : 0);
        if (_project_id.length > 0 && utils.isUUID(_project_id) && _milestone_id > 0) {
            const _querySelProj = `SELECT pc.unique_id AS project_unique_id, pc.project_id, pc.reg_id, pc.project_no, pc.project_name, pc.project_cost
            FROM project_created pc WHERE pc.unique_id = ? AND pc.is_deleted = false AND pc.is_floated = true AND pc.purpose_id = 2`;
            const rowSelProj = await db.sequelize.query(_querySelProj, { replacements: [_project_id], type: QueryTypes.SELECT });
            if (rowSelProj && rowSelProj.length > 0) {

                const doc_type_allowed = ['completion', 'other', 'beneficiary'];
                const field_type_allowed = ['milestone', 'delivery', 'activity'];

                const _doc_type = (doc_type && doc_type.length > 0) ? doc_type.trim() : "";
                if (!utils.check_in_array(_doc_type.toLowerCase(), doc_type_allowed)) {
                    return res.status(200).json(success(false, res.statusCode, 'Invalid value for parameter : "doc_type".<br>Values should be - ' + doc_type_allowed.join(', ') + '.', null));
                }
                const _field_type = (field_type && field_type.length > 0) ? field_type.trim() : "";
                if (!utils.check_in_array(_field_type.toLowerCase(), field_type_allowed)) {
                    return res.status(200).json(success(false, res.statusCode, 'Invalid value for parameter : "field_type".<br>Values should be - ' + field_type_allowed.join(', ') + '.', null));
                }
                const _field_id = field_id != null && validator.isNumeric(field_id.toString()) ? BigInt(field_id) : 0;
                const resp = await entityDataModule.monitoring_crowd_fund_milestone_doc_get_url(rowSelProj[0].project_id, _doc_type.toLowerCase(), _field_type.toLowerCase(), _field_id);
                return res.status(200).json(success(true, res.statusCode, "", resp));
            } else {
                return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, 'Invalid project view detail request.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    project_purpose_dropdown,
    project_funding_option_dropdown,
    project_rfp_document_get_url,
    project_proposal_doc_get_url,
    project_created_list,
    project_created_detail,
    project_floated_list,
    project_floated_detail,
    project_awarded_list,
    project_awarded_detail,
    project_fund_transfer_agency_list,
    project_fund_transfer_agency_projects,
    project_fund_transfer_ext_payments,


    monitoring_looking_ia_project_list,
    monitoring_looking_ia_project_view,
    monitoring_looking_ia_milestone_list,
    monitoring_looking_ia_milestone_view,
    monitoring_looking_ia_milestone_doc_get_url,

    monitoring_crowd_fund_project_list,
    monitoring_crowd_fund_project_view,
    monitoring_crowd_fund_milestone_list,
    monitoring_crowd_fund_milestone_view,
    monitoring_crowd_fund_milestone_reject,
    monitoring_crowd_fund_milestone_accept,
    monitoring_crowd_fund_milestone_doc_get_url,
};