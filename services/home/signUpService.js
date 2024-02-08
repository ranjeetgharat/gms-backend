const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
const requestIp = require('request-ip');
const registrationModule = require('../../modules/registrationModule');
const commonModule = require('../../modules/commonModule');
var validator = require('validator');
const utils = require('../../utilities/utils');
const { emailTemplate, emailTags } = require('../../constants/emailConfig');
const emailer = require('../../utilities/emailer');
const { smsTemplate, smsTags } = require('../../constants/smsConfig');
const sms_sender = require('../../utilities/sms_sender');
const { apiStatus } = require('../../constants/apiStatus');
const fetchApigee = require('../../apigee/fetchApigee');
const fs = require('fs');
const cloudStorageModule = require('../../modules/cloudStorageModule');
const jws = require('jws');
const constants = require('../../constants/constants');
const validate_dynamic_field_on_reg = false;

const entities = async (req, res, next) => {
    try {
        var entities = [];
        const _query2 = `SELECT entity_id, entity_name, entity_lng_key, is_individual FROM entity_type WHERE reg_allowed = true ORDER BY entity_id`;
        const row2 = await db.sequelize.query(_query2, { type: QueryTypes.SELECT });
        for (let i = 0; row2 && i < row2.length; i++) {
            entities.push({
                entity_id: row2[i].entity_id,
                entity_name: row2[i].entity_name,
                name_lng_key: row2[i].entity_lng_key,
                is_individual: row2[i].is_individual,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", entities));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const form_data = async (req, res, next) => {
    const { entity_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const _query00 = `SELECT entity_id, entity_name, entity_lng_key, is_individual, reg_allowed, prerequisite_text, 
        prerequisite_enabled FROM entity_type WHERE entity_id = ?`;
        const row00 = await db.sequelize.query(_query00, { replacements: [_entity_id], type: QueryTypes.SELECT });
        if (!row00 || row00.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Invalid entity id provided in request.", null));
        }
        var reg_allowed = ((row00[0].reg_allowed && row00[0].reg_allowed == true) ? true : false);
        if (!reg_allowed) {
            return res.status(200).json(success(false, res.statusCode, "Registration of entity \"" + row00[0].entity_name + "\" is disabled.", null));
        }

        var ip = ''; try { const clientIp = requestIp.getClientIp(req); ip = clientIp; } catch { }
        const _query1 = `INSERT INTO temp_master(ip_address, added_date, entity_id) VALUES (?, ?, ?) RETURNING "unique_id"`;
        const [row1] = await db.sequelize.query(_query1, { replacements: [ip, new Date(), _entity_id], returning: true });
        const unique_id = (row1 && row1.length > 0 && row1[0] ? row1[0].unique_id : "");

        var form_static_fields = await registrationModule.registration_static_fields(_entity_id);
        var parent_organizations = await registrationModule.parent_organization(_entity_id);
        var designation = await registrationModule.designations(_entity_id);
        var documents = await registrationModule.documents(_entity_id);
        var registration_type = await registrationModule.registration_type(_entity_id);
        var expertise_area = await registrationModule.expertise_area(_entity_id);
        var services_data = await registrationModule.services_data(_entity_id, form_static_fields.tab_services.visible);


        var countries = await commonModule.country_dropdown();
        var default_country_id = 0;
        for (let i = 0; countries && i < countries.length; i++) {
            if (countries[i].is_default && countries[i].is_default == true) { default_country_id = countries[i].country_id; break; }
        }
        var states = []; if (default_country_id && default_country_id > 0) { states = await commonModule.state_dropdown(default_country_id); }

        const mobile_ccc_list = await commonModule.country_calling_code();

        const results = {
            entity_id: row00[0].entity_id,
            entity_name: row00[0].entity_name,
            name_lng_key: row00[0].entity_lng_key,
            is_individual: row00[0].is_individual,
            prerequisite_text: row00[0].prerequisite_text,
            prerequisite_enabled: row00[0].prerequisite_enabled,
            resume_time_limit: parseInt(process.env.ENTITY_REGISTRATION_RESUME_TIME_LIMIT),

            parent_organizations: parent_organizations,
            designation: designation,
            documents: documents,
            registration_type: registration_type,
            expertise_area: expertise_area,
            services: services_data,

            countries: countries,
            states: states,
            districts: [],
            blocks: [],

            form_static_fields: form_static_fields,
            mobile_ccc_list: mobile_ccc_list,
        };
        res.header("Access-Control-Expose-Headers", "x-api-key");
        res.setHeader('x-api-key', unique_id);
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const resume_data = async (req, res, next) => {
    try {
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 1, }));
                }

                var addMlSeconds = parseInt(process.env.ENTITY_REGISTRATION_RESUME_TIME_LIMIT) * 1000;
                var newDateObj = new Date(new Date(row.added_date).getTime() + addMlSeconds);
                if (newDateObj >= new Date()) {

                    const _entity_id = row.entity_id && validator.isNumeric(row.entity_id.toString()) ? BigInt(row.entity_id) : 0;

                    const _query00 = `SELECT entity_id, entity_name, entity_lng_key, is_individual, reg_allowed, prerequisite_text, 
                    prerequisite_enabled FROM entity_type WHERE entity_id = ?`;
                    const row00 = await db.sequelize.query(_query00, { replacements: [_entity_id], type: QueryTypes.SELECT });
                    if (!row00 || row00.length <= 0) {
                        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Entity details not found, Please try again.", null));
                    }
                    var reg_allowed = ((row00[0].reg_allowed && row00[0].reg_allowed == true) ? true : false);
                    if (!reg_allowed) {
                        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Registration of entity \"" + row00[0].entity_name + "\" is disabled.", null));
                    }

                    const mobile_ccc_list = await commonModule.country_calling_code();
                    var form_static_fields = await registrationModule.registration_static_fields(_entity_id);
                    var parent_organizations = await registrationModule.parent_organization(_entity_id);
                    var designation = await registrationModule.designations(_entity_id);
                    var documents = await registrationModule.documents(_entity_id);
                    var registration_type = await registrationModule.registration_type(_entity_id);
                    var expertise_area = await registrationModule.expertise_area(_entity_id);
                    var services_data = await registrationModule.services_data(_entity_id, form_static_fields.tab_services.visible);

                    const my_country_id = (row.country_id && validator.isNumeric(row.country_id.toString())) ? BigInt(row.country_id) : 0;
                    const my_state_id = (row.state_id && validator.isNumeric(row.state_id.toString())) ? BigInt(row.state_id) : 0;
                    const my_district_id = (row.district_id && validator.isNumeric(row.district_id.toString())) ? BigInt(row.district_id) : 0;
                    const my_block_id = (row.block_id && validator.isNumeric(row.block_id.toString())) ? BigInt(row.block_id) : 0;

                    var _expertise_area_ids = [];
                    if (row.expertise_area_id && row.expertise_area_id.length > 0) {
                        const expertise_area_ids_list = row.expertise_area_id.split(',').join('|');
                        const expertise_area_ids_array = expertise_area_ids_list.split('|');
                        for (let ax = 0; expertise_area_ids_array && ax < expertise_area_ids_array.length; ax++) {
                            var _ax = expertise_area_ids_array[ax] && validator.isNumeric(expertise_area_ids_array[ax].toString()) ? BigInt(expertise_area_ids_array[ax]) : 0;
                            if (_ax > 0) {
                                _expertise_area_ids.push(_ax);
                            }
                        }
                    }
                    var _account_no = ''; var _re_account_no = ''; var _account_type = 0; var _ifsc_code = ''; var _bank_name = ''; var _bank_branch = '';
                    const tempBank = await registrationModule.temp_bank_exists(row.temp_id);
                    if (tempBank) {
                        _account_no = (tempBank.account_no && tempBank.account_no.length > 0) ? tempBank.account_no : "";
                        _re_account_no = (tempBank.re_account_no && tempBank.re_account_no.length > 0) ? tempBank.re_account_no : "";
                        _account_type = (tempBank.account_type && validator.isNumeric(tempBank.account_type.toString())) ? parseInt(tempBank.account_type) : 0;
                        _ifsc_code = (tempBank.ifsc_code && tempBank.ifsc_code.length > 0) ? tempBank.ifsc_code : "";
                        _bank_name = (tempBank.bank_other && tempBank.bank_other.length > 0) ? tempBank.bank_other : "";
                        _bank_branch = (tempBank.branch_other && tempBank.branch_other.length > 0) ? tempBank.branch_other : "";
                    }

                    var _user_details = [];
                    const _query456 = `SELECT first_name, middle_name, last_name, email_id, mobile_ccc, mobile_no, design_id
                    FROM temp_account WHERE temp_id = ? ORDER BY user_no`;
                    const row456 = await db.sequelize.query(_query456, { replacements: [row.temp_id], type: QueryTypes.SELECT });
                    for (let i = 0; row456 && i < row456.length; i++) {
                        var mobile_ccc = (row456[i].mobile_ccc && row456[i].mobile_ccc.length > 0) ? row456[i].mobile_ccc : "";
                        var is_valid_adm_mobile_ccc = false;
                        if (mobile_ccc.length > 0) {
                            for (let j = 0; j < mobile_ccc_list.length; j++) {
                                if (mobile_ccc_list[j] == mobile_ccc) {
                                    is_valid_adm_mobile_ccc = true; break;
                                }
                            }
                        }
                        if (!is_valid_adm_mobile_ccc) { mobile_ccc = mobile_ccc_list[0]; }
                        _user_details.push({
                            first_name: (row456[i].first_name && row456[i].first_name.length > 0) ? row456[i].first_name : "",
                            middle_name: (row456[i].middle_name && row456[i].middle_name.length > 0) ? row456[i].middle_name : "",
                            last_name: (row456[i].last_name && row456[i].last_name.length > 0) ? row456[i].last_name : "",
                            email_id: (row456[i].email_id && row456[i].email_id.length > 0) ? row456[i].email_id : "",
                            mobile_ccc: mobile_ccc,
                            mobile_no: (row456[i].mobile_no && row456[i].mobile_no.length > 0) ? row456[i].mobile_no : "",
                            designation: (row456[i].design_id && validator.isNumeric(row456[i].design_id.toString())) ? BigInt(row456[i].design_id) : 0,
                        });
                    }

                    var initiator_mobile_ccc = (row.mobile_ccc && row.mobile_ccc.length > 0) ? row.mobile_ccc : "";
                    var is_valid_initiator_mobile_ccc = false;
                    if (initiator_mobile_ccc.length > 0) {
                        for (let j = 0; j < mobile_ccc_list.length; j++) {
                            if (mobile_ccc_list[j] == initiator_mobile_ccc) {
                                is_valid_initiator_mobile_ccc = true; break;
                            }
                        }
                    }
                    if (!is_valid_initiator_mobile_ccc) { initiator_mobile_ccc = mobile_ccc_list[0]; }
                    var services_selected = [];
                    if (form_static_fields.tab_services.visible) {
                        services_selected = await registrationModule.temp_services_selected(row.temp_id);
                    }
                    const dynamic_field_values = await registrationModule.temp_dynamic_field_values(row.temp_id);

                    if (form_static_fields.flow_by_reg_type_id) {
                        for (let fl = 0; form_static_fields.reg_type_flow_data && fl < form_static_fields.reg_type_flow_data.length; fl++) {
                            for (let dv = 0; form_static_fields.reg_type_flow_data[fl].field_data &&
                                form_static_fields.reg_type_flow_data[fl].field_data.dynamic_fields &&
                                dv < form_static_fields.reg_type_flow_data[fl].field_data.dynamic_fields.length; dv++) {
                                const t_field_id = form_static_fields.reg_type_flow_data[fl].field_data.dynamic_fields[dv].field_id;
                                for (let de = 0; dynamic_field_values && de < dynamic_field_values.length; de++) {
                                    if (dynamic_field_values[de].field_id.toString() == t_field_id.toString()) {
                                        form_static_fields.reg_type_flow_data[fl].field_data.dynamic_fields[dv].user_value = dynamic_field_values[de].user_value;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    for (let dv = 0; form_static_fields.dynamic_fields && dv < form_static_fields.dynamic_fields.length; dv++) {
                        const t_field_id = form_static_fields.dynamic_fields[dv].field_id;
                        for (let de = 0; dynamic_field_values && de < dynamic_field_values.length; de++) {
                            if (dynamic_field_values[de].field_id.toString() == t_field_id.toString()) {
                                form_static_fields.dynamic_fields[dv].user_value = dynamic_field_values[de].user_value;
                                break;
                            }
                        }
                    }

                    const resume_details = {
                        first_name: (row.first_name && row.first_name.length > 0) ? row.first_name : "",
                        middle_name: (row.middle_name && row.middle_name.length > 0) ? row.middle_name : "",
                        last_name: (row.last_name && row.last_name.length > 0) ? row.last_name : "",
                        mobile_ccc: initiator_mobile_ccc,
                        mobile_no: (row.mobile_no && row.mobile_no.length > 0) ? row.mobile_no : "",
                        email_id: (row.email_id && row.email_id.length > 0) ? row.email_id : "",
                        pan_no: (row.pan_no && row.pan_no.length > 0) ? row.pan_no : "",
                        org_type_id: (row.org_type_id && validator.isNumeric(row.org_type_id.toString())) ? BigInt(row.org_type_id) : 0,

                        company_name: (row.company_name && row.company_name.length > 0) ? row.company_name : "",
                        registered_as_id: (row.registered_as_id && validator.isNumeric(row.registered_as_id.toString())) ? BigInt(row.registered_as_id) : 0,
                        address_1: (row.address_1 && row.address_1.length > 0) ? row.address_1 : "",
                        address_2: (row.address_2 && row.address_2.length > 0) ? row.address_2 : "",
                        address_3: (row.address_3 && row.address_3.length > 0) ? row.address_3 : "",
                        country_id: my_country_id,
                        state_id: my_state_id,
                        district_id: my_district_id,
                        block_id: my_block_id,
                        pin_code: (row.pin_code && row.pin_code.length > 0) ? row.pin_code : "",
                        contact_no: (row.contact_no && row.contact_no.length > 0) ? row.contact_no : "",
                        company_pan_no: (row.company_pan_no && row.company_pan_no.length > 0) ? row.company_pan_no : "",
                        gstin_no: (row.gstin_no && row.gstin_no.length > 0) ? row.gstin_no : "",
                        cin_no: (row.cin_no && row.cin_no.length > 0) ? row.cin_no : "",
                        registration_no: (row.registration_no && row.registration_no.length > 0) ? row.registration_no : "",
                        it_80g_reg_no: (row.it_80g_reg_no && row.it_80g_reg_no.length > 0) ? row.it_80g_reg_no : "",
                        it_12a_reg_no: (row.it_12a_reg_no && row.it_12a_reg_no.length > 0) ? row.it_12a_reg_no : "",
                        darpan_reg_no: (row.darpan_reg_no && row.darpan_reg_no.length > 0) ? row.darpan_reg_no : "",
                        mca_csr_f1_reg_no: (row.mca_csr_f1_reg_no && row.mca_csr_f1_reg_no.length > 0) ? row.mca_csr_f1_reg_no : "",
                        fcra_no_with_status: (row.fcra_no_with_status && row.fcra_no_with_status.length > 0) ? row.fcra_no_with_status : "",
                        fcra_no_status: (row.fcra_no_status && row.fcra_no_status == true) ? true : false,
                        expertise_area_ids: _expertise_area_ids,
                        fin_audit_rpt_filed: (row.fin_audit_rpt_filed && row.fin_audit_rpt_filed == true) ? true : false,

                        services_selected: services_selected,

                        account_no: _account_no,
                        re_account_no: _re_account_no,
                        account_type: _account_type,
                        ifsc_code: _ifsc_code,
                        bank_name: _bank_name,
                        bank_branch: _bank_branch,

                        user_details: _user_details,
                    };

                    var countries = await commonModule.country_dropdown();
                    var default_country_id = 0;
                    if (my_country_id > 0) {
                        default_country_id = my_country_id;
                        for (let i = 0; countries && i < countries.length; i++) {
                            if (countries[i].is_default && countries[i].is_default == true) {
                                countries[i].is_default = false;
                            }
                            if (countries[i].country_id.toString() == my_country_id.toString()) {
                                countries[i].is_default = true;
                            }
                        }
                    } else {
                        for (let i = 0; countries && i < countries.length; i++) {
                            if ((countries[i].is_default && countries[i].is_default == true)) {
                                default_country_id = countries[i].country_id;
                                break;
                            }
                        }
                    }
                    var states = [];
                    if (default_country_id && default_country_id > 0) {
                        states = await commonModule.state_dropdown(default_country_id);
                    }
                    var default_state_id = 0;
                    for (let i = 0; i < states.length; i++) {
                        if (states[i].state_id.toString() == my_state_id.toString()) {
                            default_state_id = my_state_id; break;
                        }
                    }
                    var districts = [];
                    if (default_state_id && default_state_id > 0) {
                        districts = await commonModule.district_dropdown(default_state_id);
                    }
                    var default_district_id = 0;
                    for (let i = 0; i < districts.length; i++) {
                        if (districts[i].district_id.toString() == my_district_id.toString()) {
                            default_district_id = my_district_id; break;
                        }
                    }
                    var blocks = [];
                    if (default_district_id && default_district_id > 0) {
                        blocks = await commonModule.block_dropdown(default_district_id);
                    }

                    const results = {
                        entity_id: row00[0].entity_id,
                        entity_name: row00[0].entity_name,
                        name_lng_key: row00[0].entity_lng_key,
                        is_individual: row00[0].is_individual,
                        prerequisite_text: row00[0].prerequisite_text,
                        prerequisite_enabled: row00[0].prerequisite_enabled,
                        resume_time_limit: parseInt(process.env.ENTITY_REGISTRATION_RESUME_TIME_LIMIT),

                        parent_organizations: parent_organizations,
                        designation: designation,
                        documents: documents,
                        registration_type: registration_type,
                        expertise_area: expertise_area,
                        services: services_data,

                        countries: countries,
                        states: states,
                        districts: districts,
                        blocks: blocks,

                        form_static_fields: form_static_fields,
                        mobile_ccc_list: mobile_ccc_list,

                        resume_details: resume_details,

                    };
                    return res.status(200).json(success(true, res.statusCode, "", results));
                } else {
                    return res.status(200).json(success(false, res.statusCode, "Resume registration time limit is expired.", null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const states = async (req, res, next) => {
    const { country_id } = req.body;
    try {
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row) {
                var _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
                const states = await commonModule.state_dropdown(_country_id);
                return res.status(200).json(success(true, res.statusCode, "State list", states));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const districts = async (req, res, next) => {
    const { state_id } = req.body;
    try {
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row) {
                var _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
                const districts = await commonModule.district_dropdown(_state_id);
                return res.status(200).json(success(true, res.statusCode, "District list", districts));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const blocks = async (req, res, next) => {
    const { district_id } = req.body;
    try {
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row) {
                var _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
                const blocks = await commonModule.block_dropdown(_district_id);
                return res.status(200).json(success(true, res.statusCode, "Block/Taluka list", blocks));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const check_pan_no = async (req, res, next) => {
    const { entity_id, pan_no } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {
                const _pan_no = (pan_no && pan_no.length > 0) ? pan_no.trim().toUpperCase() : "";

                if (_pan_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter PAN number.", null));
                }
                if (!utils.is_pan_no(_pan_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct PAN number.", null));
                }
                const _query2 = `SELECT reg_id FROM user_master WHERE is_deleted = false AND LENGTH(COALESCE(company_pan_no, '')) > 0 AND LOWER(company_pan_no) = LOWER(:pan_no)
                                UNION ALL
                                SELECT reg_id FROM user_master WHERE is_deleted = false AND LENGTH(COALESCE(pan_no, '')) > 0 AND LOWER(pan_no) = LOWER(:pan_no)`;
                const row2 = await db.sequelize.query(_query2, { replacements: { pan_no: _pan_no }, type: QueryTypes.SELECT });
                if (row2 && row2.length > 0) {
                    if (row.pan_no && row.pan_no.length > 0) {
                        const _query3 = `UPDATE temp_master SET pan_no = '', pan_no_validated = false, pan_no_valid_date = null WHERE temp_id = ?`;
                        await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                    }
                    return res.status(200).json(success(false, res.statusCode, "PAN number is already registered.", null));
                }
                if (row.pan_no) {
                    if (_pan_no == row.pan_no &&
                        (row.pan_no_validated && row.pan_no_validated == true)) {
                        return res.status(200).json(success(true, apiStatus.PAN_VALIDATED, "PAN number is already verified.", null));
                    }
                }

                var is_pan_no_valid = false; var pan_error_msg = ''; var pan_no_response = '';
                // EXTERNAL CALL HERE
                const pan_result = await fetchApigee.validate_pan_card(_pan_no);
                is_pan_no_valid = pan_result.status;
                pan_error_msg = pan_result.msg;
                pan_no_response = pan_result.data;
                // EXTERNAL CALL HERE

                if (is_pan_no_valid) {
                    const _query3 = `UPDATE temp_master SET pan_no = ?, pan_no_validated = true, pan_no_valid_date = ?, pan_no_response = ? WHERE temp_id = ?`;
                    await db.sequelize.query(_query3, { replacements: [_pan_no, new Date(), pan_no_response, row.temp_id], type: QueryTypes.UPDATE });
                    return res.status(200).json(success(true, res.statusCode, "PAN card number verified successfully.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, (pan_error_msg.length > 0 ? pan_error_msg : 'Pan card verification failed.'), null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const validate_initiator = async (req, res, next) => {
    const { entity_id, first_name, middle_name, last_name, mobile_ccc, mobile_no, email_id, pan_no, dynamic_values } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 1, }));
                }

                const entity = await commonModule.entity_type_get(_entity_id);
                var form_static_fields = await registrationModule.registration_static_fields(_entity_id);
                const _first_name = (first_name && first_name.length > 0) ? first_name.trim() : "";
                if (form_static_fields.first_name.visible && form_static_fields.first_name.required) {
                    if (_first_name.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter first name.", { tab: 1, }));
                    }
                }
                if (_first_name.length > 0) {
                    if (_first_name.length < 2) {
                        return res.status(200).json(success(false, res.statusCode, "First name should not be less than 2 characters.", { tab: 1, }));
                    }
                    if (_first_name.length > 30) {
                        return res.status(200).json(success(false, res.statusCode, "First name should not be more than 30 characters.", { tab: 1, }));
                    }
                }
                const _middle_name = (middle_name && middle_name.length > 0) ? middle_name.trim() : "";
                if (form_static_fields.middle_name.visible && form_static_fields.middle_name.required) {
                    if (_middle_name.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter middle name.", { tab: 1, }));
                    }
                }
                if (_middle_name.length > 30) {
                    return res.status(200).json(success(false, res.statusCode, "Middle name should not be more than 30 characters.", { tab: 1, }));
                }
                const _last_name = (last_name && last_name.length > 0) ? last_name.trim() : "";
                if (form_static_fields.last_name.visible && form_static_fields.last_name.required) {
                    if (_last_name.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter last name.", { tab: 1, }));
                    }
                }
                if (_last_name.length > 0) {
                    if (_last_name.length < 2) {
                        return res.status(200).json(success(false, res.statusCode, "Last name should not be less than 2 characters.", { tab: 1, }));
                    }
                    if (_last_name.length > 30) {
                        return res.status(200).json(success(false, res.statusCode, "Last name should not be more than 30 characters.", { tab: 1, }));
                    }
                }
                const mobile_ccc_list = await commonModule.country_calling_code();

                var _mobile_ccc = (mobile_ccc && mobile_ccc.length > 0) ? mobile_ccc.trim() : "";
                var is_valid_mobile_ccc = false;
                if (_mobile_ccc.length > 0) {
                    for (let cc = 0; cc < mobile_ccc_list.length; cc++) {
                        if (mobile_ccc_list[cc].toLowerCase().trim() == _mobile_ccc.toLowerCase().trim()) {
                            is_valid_mobile_ccc = true; break;
                        }
                    }
                } else {
                    _mobile_ccc = mobile_ccc_list[0]; is_valid_mobile_ccc = true;
                }
                if (!is_valid_mobile_ccc) {
                    return res.status(200).json(success(false, res.statusCode, "Invalid mobile country code.", { tab: 1, }));
                }
                const _mobile_no = (mobile_no && mobile_no.length > 0) ? mobile_no.trim() : "";
                if (_mobile_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter mobile number.", { tab: 1, }));
                }
                if (!utils.is_mobile_no(_mobile_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct mobile number.", { tab: 1, }));
                }
                const chkMobile = await commonModule.is_mobile_registered(_mobile_no);
                if (chkMobile) {
                    return res.status(200).json(success(false, res.statusCode, "Mobile number is already registered.", { tab: 1, }));
                }

                const _email_id = (email_id && email_id.length > 0) ? email_id.trim() : "";
                if (_email_id.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter email id.", { tab: 1, }));
                }
                if (!validator.isEmail(_email_id)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct email id.", { tab: 1, }));
                }
                const chkMail = await commonModule.is_email_registered(_email_id);
                if (chkMail) {
                    return res.status(200).json(success(false, res.statusCode, "Email id is already registered.", { tab: 1, }));
                }

                const _pan_no = (pan_no && pan_no.length > 0) ? pan_no.trim().toUpperCase() : "";
                if (form_static_fields.pan_no.visible) {
                    if (form_static_fields.pan_no.required && _pan_no.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter pan number.", { tab: 1, }));
                    }
                }
                if (_pan_no.length > 0) {
                    if (!utils.is_pan_no(_pan_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter valid pan number.", { tab: 1, }));
                    }
                    const _query3 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:pan_no)`;
                    const row3 = await db.sequelize.query(_query3, { replacements: { pan_no: _pan_no }, type: QueryTypes.SELECT });
                    if (row3 && row3.length > 0) {
                        if (row.pan_no && row.pan_no.length > 0) {
                            const _queryInReg = `UPDATE temp_master SET pan_no = '', pan_no_validated = false, pan_no_valid_date = null WHERE temp_id = ?`;
                            await db.sequelize.query(_queryInReg, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                        }
                        return res.status(200).json(success(false, res.statusCode, "Pan number is already registered.", { tab: 1, }));
                    }
                    var pan_no_validated = false;
                    if (row.pan_no && _pan_no == row.pan_no &&
                        (row.pan_no_validated && row.pan_no_validated == true)) {
                        pan_no_validated = true;
                    }
                    if (!pan_no_validated) {
                        var is_pan_no_valid = false; var pan_error_msg = ''; var pan_no_response = '';
                        // EXTERNAL CALL HERE
                        const pan_result = await fetchApigee.validate_pan_card(_pan_no);
                        is_pan_no_valid = pan_result.status;
                        pan_error_msg = pan_result.msg;
                        pan_no_response = pan_result.data;
                        // EXTERNAL CALL HERE 
                        if (is_pan_no_valid) {
                            const _queryInReg = `UPDATE temp_master SET pan_no = ?, pan_no_validated = true, pan_no_valid_date = ?, pan_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryInReg, { replacements: [_pan_no, new Date(), pan_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (pan_error_msg.length > 0 ? pan_error_msg : 'Pan card verification failed.'), { tab: 1, }));
                        }
                    }
                }
                if (row.mobile_no && row.email_id) {
                    if (_mobile_no == row.mobile_no && _email_id == row.email_id
                        && (row.mobile_validated && row.mobile_validated == true)
                        && (row.email_validated && row.email_validated == true)) {
                        const _query12 = `UPDATE temp_master SET first_name = ?, middle_name = ?, last_name = ? WHERE temp_id = ?`;
                        const _replacements12 = [_first_name, _middle_name, _last_name, row.temp_id];
                        await db.sequelize.query(_query12, { replacements: _replacements12, type: QueryTypes.UPDATE });

                        return res.status(200).json(success(true, apiStatus.MOBILE_EMAIL_VALIDATED, "Mobile number and email id is already verified.", { tab: 1, }));
                    }
                }

                var _dynamic_values = []; var _dynamic_values_new_array = []; var current_section_field = [];
                if (dynamic_values != null) {
                    if (dynamic_values.constructor == String) {
                        try { _dynamic_values = JSON.parse(dynamic_values); } catch (_) { }
                    } else {
                        if (dynamic_values.constructor == Array) { _dynamic_values = dynamic_values; }
                    }
                }
                for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                    const eleFld = form_static_fields.dynamic_fields[i];
                    if (eleFld.section_id == 'ID_USER') {
                        current_section_field.push(eleFld.field_id); var fieldData = null;
                        for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                            if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                fieldData = _dynamic_values[j]; break;
                            }
                        }
                        if (fieldData != null) {
                            const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                            if (eleFld.is_required) {
                                if (_user_value.length <= 0) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 1, }));
                                    }
                                }
                            }
                            const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                            if (validation_result.has_error) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 1, }));
                                }
                            }
                            _dynamic_values_new_array.push({
                                field_id: eleFld.field_id,
                                user_value: _user_value,
                            });
                        } else {
                            if (eleFld.is_required) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 1, }));
                                }
                            }
                        }
                    }
                }

                const stmp = await commonModule.sms_template_get(smsTemplate.ENTITY_OTP_ON_REGISTRATION);
                const etmp = await commonModule.email_template_get(emailTemplate.ENTITY_OTP_ON_REGISTRATION);
                if (stmp && etmp) {
                    const mobile_otp_code = await registrationModule.generate_mobile_otp(row.temp_id, _mobile_no, true);
                    var sms_text = stmp.message_text && stmp.message_text.length > 0 ? stmp.message_text : "";

                    sms_text = sms_text.replaceAll(smsTags.ENTITY_TYPE, entity.entity_name);
                    sms_text = sms_text.replaceAll(smsTags.OTP_CODE, mobile_otp_code);

                    var sms_success = false;
                    try {
                        await sms_sender.send(smsTemplate.ENTITY_OTP_ON_REGISTRATION, _mobile_no, sms_text);
                        sms_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }

                    const email_otp_code = await registrationModule.generate_email_otp(row.temp_id, _email_id, true);

                    var mail_subject = etmp.subject && etmp.subject.length > 0 ? etmp.subject : "";
                    var mail_body_text = etmp.body_text && etmp.body_text.length > 0 ? etmp.body_text : "";

                    mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_subject = mail_subject.replaceAll(emailTags.ENTITY_TYPE, entity.entity_name);
                    mail_subject = mail_subject.replaceAll(emailTags.OTP_CODE, email_otp_code);
                    mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, _email_id);

                    mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_body_text = mail_body_text.replaceAll(emailTags.ENTITY_TYPE, entity.entity_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.OTP_CODE, email_otp_code);
                    mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, _email_id);

                    var mailOptions = {
                        from: process.env.MAIL_SENDER, to: _email_id, subject: mail_subject, html: mail_body_text,
                    }
                    var mail_success = false;
                    try {
                        await emailer.sendMail(mailOptions);
                        mail_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }

                    const _query12 = `UPDATE temp_master SET first_name = ?, middle_name = ?, last_name = ?, mobile_ccc = ? WHERE temp_id = ?`;
                    const _replacements12 = [_first_name, _middle_name, _last_name, _mobile_ccc, row.temp_id];
                    await db.sequelize.query(_query12, { replacements: _replacements12, type: QueryTypes.UPDATE });

                    var updatedFieldToDB = [];
                    for (let dv = 0; _dynamic_values_new_array && dv < _dynamic_values_new_array.length; dv++) {
                        const eleVal = _dynamic_values_new_array[dv];
                        const _queryChkField = `SELECT temp_id FROM temp_field_values WHERE temp_id = ? AND static_field_id = ?`;
                        const rowChkField = await db.sequelize.query(_queryChkField, { replacements: [row.temp_id, eleVal.field_id], type: QueryTypes.SELECT });
                        if (rowChkField && rowChkField.length > 0) {
                            const _queryFieldUp = `UPDATE temp_field_values SET user_value = ? WHERE temp_id = ? AND static_field_id = ?`;
                            await db.sequelize.query(_queryFieldUp, { replacements: [eleVal.user_value, row.temp_id, eleVal.field_id], type: QueryTypes.UPDATE });
                        } else {
                            const _queryFieldIn = `INSERT INTO temp_field_values(temp_id, static_field_id, user_value) VALUES(?, ?, ?)`;
                            await db.sequelize.query(_queryFieldIn, { replacements: [row.temp_id, eleVal.field_id, eleVal.user_value], type: QueryTypes.INSERT });
                        }
                        updatedFieldToDB.push(eleVal.field_id);
                    }
                    if (current_section_field.length > 0) {
                        const _queryFieldDel = `DELETE FROM temp_field_values WHERE temp_id = ? AND static_field_id IN (?) ${(updatedFieldToDB.length > 0 ? ' AND static_field_id NOT IN (?)' : '')}`;
                        var _replFieldDel = [row.temp_id, current_section_field]; if (updatedFieldToDB.length > 0) { _replFieldDel.push(updatedFieldToDB); }
                        await db.sequelize.query(_queryFieldDel, { replacements: _replFieldDel, type: QueryTypes.DELETE });
                    }
                    return res.status(200).json(success(true, res.statusCode, "OTP has been sent on mobile number & email address.", { tab: 1, }));
                }
                else {
                    return res.status(200).json(success(false, res.statusCode, "Unable to send OTP. ERR: Template not found.", { tab: 1, }));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const resend_mobile_otp = async (req, res, next) => {
    const { entity_id, mobile_no } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 1, }));
                }

                const entity = await commonModule.entity_type_get(_entity_id);

                if (!mobile_no || mobile_no.length <= 0) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter mobile number.", null));
                }
                if (!utils.is_mobile_no(mobile_no)) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter correct mobile number.", null));
                }
                if (mobile_no != row.mobile_no) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Mobile number does not matched.", null));
                }
                const chkMobile = await commonModule.is_mobile_registered(mobile_no);
                if (chkMobile) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Mobile number is already registered.", null));
                }

                const stmp = await commonModule.sms_template_get(smsTemplate.ENTITY_OTP_ON_REGISTRATION);
                if (stmp) {
                    const mobile_otp_code = await registrationModule.generate_mobile_otp(row.temp_id, mobile_no, false);
                    var sms_text = stmp.message_text && stmp.message_text.length > 0 ? stmp.message_text : "";
                    sms_text = sms_text.replaceAll(smsTags.ENTITY_TYPE, entity.entity_name);
                    sms_text = sms_text.replaceAll(smsTags.OTP_CODE, mobile_otp_code);

                    var sms_success = false;
                    try {
                        await sms_sender.send(smsTemplate.ENTITY_OTP_ON_REGISTRATION, mobile_no, sms_text);
                        sms_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }

                    return res.status(200).json(success(true, res.statusCode, "Otp has been resent on mobile number.", null));
                }
                else {
                    return res.status(200).json(success(false, res.statusCode, "Unable to send OTP. ERR: Template not found.", null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const resend_email_otp = async (req, res, next) => {
    const { entity_id, email_id } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 1, }));
                }

                const entity = await commonModule.entity_type_get(_entity_id);

                if (!email_id || email_id.length <= 0) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter email id.", null));
                }
                if (!validator.isEmail(email_id)) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter correct email id.", null));
                }
                if (email_id != row.email_id) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Email id does not matched.", null));
                }
                const chkMail = await commonModule.is_email_registered(email_id);
                if (chkMail) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Email id is already registered.", null));
                }

                const etmp = await commonModule.email_template_get(emailTemplate.ENTITY_OTP_ON_REGISTRATION);
                if (etmp) {

                    const email_otp_code = await registrationModule.generate_email_otp(row.temp_id, email_id, false);

                    var mail_subject = etmp.subject && etmp.subject.length > 0 ? etmp.subject : "";
                    var mail_body_text = etmp.body_text && etmp.body_text.length > 0 ? etmp.body_text : "";

                    mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_subject = mail_subject.replaceAll(emailTags.ENTITY_TYPE, entity.entity_name);
                    mail_subject = mail_subject.replaceAll(emailTags.OTP_CODE, email_otp_code);
                    mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, email_id);

                    mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_body_text = mail_body_text.replaceAll(emailTags.ENTITY_TYPE, entity.entity_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.OTP_CODE, email_otp_code);
                    mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, email_id);

                    var mailOptions = {
                        from: process.env.MAIL_SENDER, to: email_id, subject: mail_subject, html: mail_body_text,
                    }
                    var mail_success = false;
                    try {
                        await emailer.sendMail(mailOptions);
                        mail_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }

                    return res.status(200).json(success(true, res.statusCode, "Otp has been resent on email address.", null));
                }
                else {
                    return res.status(200).json(success(false, res.statusCode, "Unable to send OTP. ERR: Template not found.", null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const verify_otp_codes = async (req, res, next) => {
    const { entity_id, mobile_no, mobile_otp, email_id, email_otp } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 1, }));
                }

                if (!mobile_no || mobile_no.length <= 0) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter mobile number.", null));
                }
                if (!utils.is_mobile_no(mobile_no)) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter correct mobile number.", null));
                }
                if (mobile_no != row.mobile_no) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Mobile number does not matched.", null));
                }

                const _chkMobile = await commonModule.is_mobile_registered(mobile_no);
                if (_chkMobile) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Mobile number is already registered.", null));
                }

                if (!email_id || email_id.length <= 0) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter email id.", null));
                }
                if (!validator.isEmail(email_id)) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Please enter correct email id.", null));
                }
                if (email_id != row.email_id) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Email id does not matched.", null));
                }

                const _chkMail = await commonModule.is_email_registered(email_id);
                if (_chkMail) {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Email id is already registered.", null));
                }

                if (!mobile_otp || mobile_otp.length <= 0 || !email_otp || email_otp.length <= 0) {
                    const results = {
                        mobile: (mobile_otp && mobile_otp.length > 0 ? '' : 'Please enter mobile otp code.'),
                        email: (email_otp && email_otp.length > 0 ? '' : 'Please enter email otp code.'),
                    };
                    return res.status(200).json(success(false, res.statusCode, "", results));
                }
                const _query3 = `SELECT mobile_no, mobile_otp_code, NOW() AS current_date, mobile_otp_time + INTERVAL ':expired_on Second' AS expiry_time FROM temp_master WHERE temp_id = :temp_id`;
                const _replacements3 = { temp_id: row.temp_id, expired_on: parseInt(process.env.MOBILE_OTP_EXPIRY) };
                const row3 = await db.sequelize.query(utils.build_query_obj(_query3, _replacements3), { type: QueryTypes.SELECT });

                const _query4 = `SELECT email_id, email_otp_code, NOW() AS current_date, email_otp_time + INTERVAL ':expired_on Second' AS expiry_time FROM temp_master WHERE temp_id = :temp_id`;
                const _replacements4 = { temp_id: row.temp_id, expired_on: parseInt(process.env.EMAIL_OTP_EXPIRY) };
                const row4 = await db.sequelize.query(utils.build_query_obj(_query4, _replacements4), { type: QueryTypes.SELECT });

                if (row3 && row3.length > 0 && row4 && row4.length > 0) {
                    var mobile_otp_valid = false; var mobile_valid_msg = '';
                    if (row3[0].current_date < row3[0].expiry_time) {
                        if (row3[0].mobile_otp_code == mobile_otp) {
                            mobile_otp_valid = true;
                        }
                    } else {
                        mobile_valid_msg = "Mobile OTP code is expired, Please regenerate again.";
                    }
                    var email_otp_valid = false; var email_valid_msg = '';
                    if (row4[0].current_date < row4[0].expiry_time) {
                        if (row4[0].email_otp_code == email_otp) {
                            email_otp_valid = true;
                        }
                    } else {
                        email_valid_msg = "Email OTP code is expired, Please regenerate again.";
                    }
                    if (mobile_otp_valid && email_otp_valid) {
                        const _query5 = `UPDATE temp_master SET mobile_otp_code = ?, mobile_otp_time = ?, 
                        email_otp_code = ?, email_otp_time = ?, mobile_validated = ?, email_validated = ?, 
                        mobile_valid_date = ?, email_valid_date = ? WHERE temp_id = ?`;
                        const _replacements5 = ["", null, "", null, true, true, new Date(), new Date(), row.temp_id];
                        await db.sequelize.query(_query5, { replacements: _replacements5, type: QueryTypes.UPDATE });

                        return res.status(200).json(success(true, res.statusCode, "OTP verification is successful.", null));
                    } else {
                        const results = {
                            mobile: (mobile_otp_valid ? '' : (mobile_valid_msg.length > 0 ? mobile_valid_msg : 'Incorrect OTP entered, Please retry.')),
                            email: (email_otp_valid ? '' : (email_valid_msg.length > 0 ? email_valid_msg : 'Incorrect OTP entered, Please retry.')),
                        };
                        return res.status(200).json(success(false, res.statusCode, "", results));
                    }
                } else {
                    return res.status(200).json(success(false, res.statusCode, "Unable to find record, Please try again.", null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const search_parent_entity = async (req, res, next) => {
    const { entity_id, org_type_id, unique_id, company_name, pin_code } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 2, }));
                }
                var _org_type_id = org_type_id && validator.isNumeric(org_type_id.toString()) ? BigInt(org_type_id) : 0;

                const _unique_id = (unique_id && unique_id.length > 0) ? unique_id.trim() : "";
                const _company_name = (company_name && company_name.length > 0) ? company_name.trim() : "";
                const _pin_code = (pin_code && pin_code.length > 0) ? pin_code.trim() : "";


                const results = await commonModule.search_parent_entity(_org_type_id, _unique_id, _company_name, _pin_code);

                return res.status(200).json(success(true, res.statusCode, "Search result.", results));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const validate_details = async (req, res, next) => {
    const { entity_id, company_name, registered_as_id, org_type_id, parent_org_id,
        address_1, address_2, address_3, country_id, state_id, district_id, block_id, pin_code, contact_no, dynamic_values
    } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 2, }));
                }

                var form_static_fields = await registrationModule.registration_static_fields(_entity_id);
                const _company_name = (company_name && company_name.length > 0) ? company_name.trim() : "";
                if (form_static_fields.company_name.visible) {
                    if (form_static_fields.company_name.required) {
                        if (_company_name.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please enter company name.", { tab: 2, }));
                        }
                    }
                    if (_company_name.length > 0) {
                        if (_company_name.length < 5) {
                            return res.status(200).json(success(false, res.statusCode, "Company name should not be less than 5 characters.", { tab: 2, }));
                        }
                        if (_company_name.length > 100) {
                            return res.status(200).json(success(false, res.statusCode, "Company name should not be more than 100 characters.", { tab: 2, }));
                        }
                    }
                }
                const _registered_as_id = registered_as_id && validator.isNumeric(registered_as_id.toString()) ? BigInt(registered_as_id) : 0;
                if (form_static_fields.registered_as_id.visible) {
                    if (form_static_fields.registered_as_id.required && _registered_as_id <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please select entity registered as.", { tab: 2, }));
                    }
                }
                const _org_type_id = org_type_id && validator.isNumeric(org_type_id.toString()) ? BigInt(org_type_id) : 0;
                var _parent_org_id = 0;
                if (form_static_fields.parent_orgnization.visible) {
                    if (form_static_fields.parent_orgnization.required && _org_type_id <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please select parent organization.", { tab: 2, }));
                    }
                }
                if (_org_type_id > 0) {
                    const _query1014 = `SELECT m.parent_entity FROM parent_orgs_mast d INNER JOIN parent_orgs_mapp m ON d.org_type_id = m.org_type_id
                    WHERE d.org_type_id = ? AND d.is_enabled = true AND d.is_deleted = false`;
                    const row1014 = await db.sequelize.query(_query1014, { replacements: [_org_type_id], type: QueryTypes.SELECT });
                    if (row1014 && row1014.length > 0) {
                        const select_org_req = (row1014[0].parent_entity && row1014[0].parent_entity.length > 0 ? true : false);
                        if (select_org_req) {
                            _parent_org_id = parent_org_id && validator.isNumeric(parent_org_id.toString()) ? BigInt(parent_org_id) : 0;
                            if (_parent_org_id <= 0) {
                                return res.status(200).json(success(false, res.statusCode, "Please search & select parent entity name.", { tab: 2, }));
                            }
                            const _query1015 = `SELECT u.entity_id FROM user_master u WHERE u.reg_id = ? AND u.is_enabled = true AND u.is_deleted = false AND u.approve_status = 1`;
                            const row1015 = await db.sequelize.query(_query1015, { replacements: [_parent_org_id], type: QueryTypes.SELECT });
                            if (row1015 && row1015.length > 0) {
                                var _is_org_matched = false;
                                for (let opn = 0; row1014[0].parent_entity && opn < row1014[0].parent_entity.length; opn++) {
                                    if (row1014[0].parent_entity[opn].toString() == row1015[0].entity_id.toString()) {
                                        _is_org_matched = true; break;
                                    }
                                }
                                if (!_is_org_matched) {
                                    return res.status(200).json(success(false, res.statusCode, "Invalid parent entity name selected.", { tab: 2, }));
                                }
                            } else {
                                return res.status(200).json(success(false, res.statusCode, "Invalid parent entity name selected.", { tab: 2, }));
                            }
                        }
                    } else {
                        return res.status(200).json(success(false, res.statusCode, "Invalid parent organization selected.", { tab: 2, }));
                    }
                }
                var _dynamic_values = []; var _dynamic_values_new_array = []; var current_section_field = [];
                if (dynamic_values != null) {
                    if (dynamic_values.constructor == String) {
                        try { _dynamic_values = JSON.parse(dynamic_values); } catch (_) { }
                    } else {
                        if (dynamic_values.constructor == Array) { _dynamic_values = dynamic_values; }
                    }
                }
                for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                    const eleFld = form_static_fields.dynamic_fields[i];
                    if (eleFld.section_id == 'CD_BASIC') {
                        current_section_field.push(eleFld.field_id); var fieldData = null;
                        for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                            if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                fieldData = _dynamic_values[j]; break;
                            }
                        }
                        if (fieldData != null) {
                            const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                            if (eleFld.is_required) {
                                if (_user_value.length <= 0) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                    }
                                }
                            }
                            const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                            if (validation_result.has_error) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 2, }));
                                }
                            }
                            _dynamic_values_new_array.push({
                                field_id: eleFld.field_id,
                                user_value: _user_value,
                            });
                        } else {
                            if (eleFld.is_required) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                }
                            }
                        }
                    }
                }
                const _address_1 = (address_1 && address_1.length > 0) ? address_1.trim() : "";
                if (form_static_fields.address_1.visible) {
                    if (form_static_fields.address_1.required && _address_1.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company address.", { tab: 2, }));
                    }
                }
                const _address_2 = (address_2 && address_2.length > 0) ? address_2.trim() : "";
                if (form_static_fields.address_2.visible) {
                    if (form_static_fields.address_2.required && _address_2.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company address.", { tab: 2, }));
                    }
                }
                const _address_3 = (address_3 && address_3.length > 0) ? address_3.trim() : "";
                if (form_static_fields.address_3.visible) {
                    if (form_static_fields.address_3.required && _address_3.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company address.", { tab: 2, }));
                    }
                }
                const _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
                if (form_static_fields.country_id.visible) {
                    if (form_static_fields.country_id.required && _country_id <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please select country.", { tab: 2, }));
                    }
                }
                const _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
                if (form_static_fields.state_id.visible) {
                    if (form_static_fields.state_id.required && _state_id <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please select state/UT.", { tab: 2, }));
                    }
                }
                const _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
                if (form_static_fields.district_id.visible) {
                    if (form_static_fields.district_id.required && _district_id <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please select district.", { tab: 2, }));
                    }
                }
                const _block_id = block_id && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;
                if (form_static_fields.block_id.visible) {
                    if (form_static_fields.block_id.required) {
                        if (_block_id <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please select block/taluka.", { tab: 2, }));
                        }
                    }
                }
                const _pin_code = (pin_code && pin_code.length > 0) ? pin_code.trim() : "";
                if (form_static_fields.pin_code.visible) {
                    if (form_static_fields.pin_code.required && _pin_code.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter pin code.", { tab: 2, }));
                    }
                }
                if (_pin_code.length > 0) {
                    if (!utils.is_pin_code(_pin_code)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct pin code.", { tab: 2, }));
                    }
                }
                const _contact_no = (contact_no && contact_no.length > 0) ? contact_no.trim() : "";
                if (form_static_fields.contact_no.visible) {
                    if (_contact_no.length <= 0 && form_static_fields.contact_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter landline no. (with STD code).", { tab: 2, }));
                    }
                }
                for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                    const eleFld = form_static_fields.dynamic_fields[i];
                    if (eleFld.section_id == 'CD_ADDR') {
                        current_section_field.push(eleFld.field_id); var fieldData = null;
                        for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                            if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                fieldData = _dynamic_values[j]; break;
                            }
                        }
                        if (fieldData != null) {
                            const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                            if (eleFld.is_required) {
                                if (_user_value.length <= 0) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                    }
                                }
                            }
                            const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                            if (validation_result.has_error) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 2, }));
                                }
                            }
                            _dynamic_values_new_array.push({
                                field_id: eleFld.field_id,
                                user_value: _user_value,
                            });
                        } else {
                            if (eleFld.is_required) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                }
                            }
                        }
                    }
                }
                const _query13 = `UPDATE temp_master SET company_name = ?, registered_as_id = ?, org_type_id = ?, parent_org_id = ?, address_1 = ?, address_2 = ?, 
                address_3 = ?, country_id = ?, state_id = ?, district_id = ?, block_id = ?, pin_code = ?, contact_no = ?
                WHERE temp_id = ?`;
                const _replacements13 = [_company_name, _registered_as_id, _org_type_id, _parent_org_id, _address_1, _address_2,
                    _address_3, _country_id, _state_id, _district_id, _block_id, _pin_code, _contact_no, row.temp_id];
                await db.sequelize.query(_query13, { replacements: _replacements13, type: QueryTypes.UPDATE });

                var updatedFieldToDB = [];
                for (let dv = 0; _dynamic_values_new_array && dv < _dynamic_values_new_array.length; dv++) {
                    const eleVal = _dynamic_values_new_array[dv];
                    const _queryChkField = `SELECT temp_id FROM temp_field_values WHERE temp_id = ? AND static_field_id = ?`;
                    const rowChkField = await db.sequelize.query(_queryChkField, { replacements: [row.temp_id, eleVal.field_id], type: QueryTypes.SELECT });
                    if (rowChkField && rowChkField.length > 0) {
                        const _queryFieldUp = `UPDATE temp_field_values SET user_value = ? WHERE temp_id = ? AND static_field_id = ?`;
                        await db.sequelize.query(_queryFieldUp, { replacements: [eleVal.user_value, row.temp_id, eleVal.field_id], type: QueryTypes.UPDATE });
                    } else {
                        const _queryFieldIn = `INSERT INTO temp_field_values(temp_id, static_field_id, user_value) VALUES(?, ?, ?)`;
                        await db.sequelize.query(_queryFieldIn, { replacements: [row.temp_id, eleVal.field_id, eleVal.user_value], type: QueryTypes.INSERT });
                    }
                    updatedFieldToDB.push(eleVal.field_id);
                }
                if (current_section_field.length > 0) {
                    const _queryFieldDel = `DELETE FROM temp_field_values WHERE temp_id = ? AND static_field_id IN (?) ${(updatedFieldToDB.length > 0 ? ' AND static_field_id NOT IN (?)' : '')}`;
                    var _replFieldDel = [row.temp_id, current_section_field]; if (updatedFieldToDB.length > 0) { _replFieldDel.push(updatedFieldToDB); }
                    await db.sequelize.query(_queryFieldDel, { replacements: _replFieldDel, type: QueryTypes.DELETE });
                }
                return res.status(200).json(success(true, res.statusCode, "", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", { tab: 2, }));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", { tab: 2, }));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, { tab: 2, }));
    }
};

const check_company_pan_no = async (req, res, next) => {
    const { entity_id, company_pan_no } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {
                const _company_pan_no = (company_pan_no && company_pan_no.length > 0) ? company_pan_no.trim().toUpperCase() : "";

                if (_company_pan_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter company pan number.", null));
                }
                if (!utils.is_pan_no(_company_pan_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct company pan number.", null));
                }
                const _query2 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:company_pan_no)
                UNION ALL
                SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:company_pan_no)`;
                const row2 = await db.sequelize.query(_query2, { replacements: { company_pan_no: _company_pan_no }, type: QueryTypes.SELECT });
                if (row2 && row2.length > 0) {
                    if (row.company_pan_no && row.company_pan_no.length > 0) {
                        const _query3 = `UPDATE temp_master SET company_pan_no = '', company_pan_no_validated = false, company_pan_no_valid_date = null WHERE temp_id = ?`;
                        await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                    }
                    return res.status(200).json(success(false, res.statusCode, "Pan number is already registered.", null));
                }
                if (row.company_pan_no) {
                    if (_company_pan_no == row.company_pan_no &&
                        (row.company_pan_no_validated && row.company_pan_no_validated == true)) {
                        return res.status(200).json(success(true, apiStatus.COMPANY_PAN_VALIDATED, "Company pan number is already verified.", null));
                    }
                }
                var is_pan_no_valid = false; var pan_error_msg = ''; var company_pan_no_response = '';
                // EXTERNAL CALL HERE
                const pan_result = await fetchApigee.validate_pan_card(_company_pan_no);
                is_pan_no_valid = pan_result.status;
                pan_error_msg = pan_result.msg;
                pan_no_response = pan_result.data;
                // EXTERNAL CALL HERE
                if (is_pan_no_valid) {
                    const _query3 = `UPDATE temp_master SET company_pan_no = ?, company_pan_no_validated = true, company_pan_no_valid_date = ?, company_pan_no_response = ? WHERE temp_id = ?`;
                    await db.sequelize.query(_query3, { replacements: [_company_pan_no, new Date(), company_pan_no_response, row.temp_id], type: QueryTypes.UPDATE });
                    return res.status(200).json(success(true, res.statusCode, "Pan card number verified successfully.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, (pan_error_msg.length > 0 ? pan_error_msg : 'Pan card verification failed.'), null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const check_gstin_no = async (req, res, next) => {
    const { entity_id, gstin_no } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {
                const _gstin_no = (gstin_no && gstin_no.length > 0) ? gstin_no.trim().toUpperCase() : "";

                if (_gstin_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter GSTIN number.", null));
                }
                if (!utils.is_gstn_no(_gstin_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct GSTIN number.", null));
                }
                const _query2 = `SELECT reg_id FROM user_master WHERE is_deleted = false AND LENGTH(COALESCE(gstin_no, '')) > 0 AND LOWER(gstin_no) = LOWER(:gstin_no)`;
                const row2 = await db.sequelize.query(_query2, { replacements: { gstin_no: _gstin_no }, type: QueryTypes.SELECT });
                if (row2 && row2.length > 0) {
                    if (row.gstin_no && row.gstin_no.length > 0) {
                        const _query3 = `UPDATE temp_master SET gstin_no = '', gstin_no_validated = false, gstin_no_valid_date = null WHERE temp_id = ?`;
                        await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                    }
                    return res.status(200).json(success(false, res.statusCode, "GSTIN number is already registered.", null));
                }
                if (row.gstin_no) {
                    if (_gstin_no == row.gstin_no &&
                        (row.gstin_no_validated && row.gstin_no_validated == true)) {
                        return res.status(200).json(success(true, apiStatus.GSTIN_NO_VALIDATED, "GSTIN number is already verified.", null));
                    }
                }

                var is_gstin_no_valid = false; var gstin_error_msg = ''; var gstin_no_response = '';
                // EXTERNAL CALL HERE
                const gstin_result = await fetchApigee.validate_gstin_no(_gstin_no);
                is_gstin_no_valid = gstin_result.status;
                gstin_error_msg = gstin_result.msg;
                gstin_no_response = gstin_result.data;
                // EXTERNAL CALL HERE
                if (is_gstin_no_valid) {
                    const _query3 = `UPDATE temp_master SET gstin_no = ?, gstin_no_validated = true, gstin_no_valid_date = ?, gstin_no_response = ? WHERE temp_id = ?`;
                    await db.sequelize.query(_query3, { replacements: [_gstin_no, new Date(), gstin_no_response, row.temp_id], type: QueryTypes.UPDATE });
                    return res.status(200).json(success(true, res.statusCode, "GSTIN number verified successfully.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, (gstin_error_msg.length > 0 ? gstin_error_msg : 'GSTIN number verification failed.'), null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const check_cin_no = async (req, res, next) => {
    const { entity_id, cin_no } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {
                const _cin_no = (cin_no && cin_no.length > 0) ? cin_no.trim().toUpperCase() : "";

                if (_cin_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter company identification number.", null));
                }
                if (!utils.is_cin_no(_cin_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct company identification number.", null));
                }
                const _query2 = `SELECT reg_id FROM user_master WHERE is_deleted = false AND LENGTH(COALESCE(cin_no, '')) > 0 AND LOWER(cin_no) = LOWER(:cin_no)`;
                const row2 = await db.sequelize.query(_query2, { replacements: { cin_no: _cin_no }, type: QueryTypes.SELECT });
                if (row2 && row2.length > 0) {
                    if (row.cin_no && row.cin_no.length > 0) {
                        const _query3 = `UPDATE temp_master SET cin_no = '', cin_no_validated = false, cin_no_valid_date = null WHERE temp_id = ?`;
                        await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                    }
                    return res.status(200).json(success(false, res.statusCode, "Company identification number is already registered.", null));
                }
                if (row.cin_no) {
                    if (_cin_no == row.cin_no &&
                        (row.cin_no_validated && row.cin_no_validated == true)) {
                        return res.status(200).json(success(true, apiStatus.CIN_NO_VALIDATED, "Company identification number is already verified.", null));
                    }
                }

                var is_cin_no_valid = false; var cin_error_msg = ''; var cin_no_response = '';
                // EXTERNAL CALL HERE
                const cin_result = await fetchApigee.validate_cin_no(_cin_no);
                is_cin_no_valid = cin_result.status;
                cin_error_msg = cin_result.msg;
                cin_no_response = cin_result.data;
                // EXTERNAL CALL HERE
                if (is_cin_no_valid) {
                    const _query3 = `UPDATE temp_master SET cin_no = ?, cin_no_validated = true, cin_no_valid_date = ?, cin_no_response = ? WHERE temp_id = ?`;
                    await db.sequelize.query(_query3, { replacements: [_cin_no, new Date(), cin_no_response, row.temp_id], type: QueryTypes.UPDATE });
                    return res.status(200).json(success(true, res.statusCode, "Company identification number verified successfully.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, (cin_error_msg.length > 0 ? cin_error_msg : 'Company identification number verification failed.'), null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const check_ifsc_code = async (req, res, next) => {
    const { entity_id, ifsc_code } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {
                const _ifsc_code = (ifsc_code && ifsc_code.length > 0) ? ifsc_code.trim().toUpperCase() : "";

                if (!_ifsc_code || _ifsc_code.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter IFSC code.", null));
                }
                if (!utils.is_ifsc_code(_ifsc_code)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct IFSC code.", null));
                }
                const rowBank = await registrationModule.temp_bank_exists(row.temp_id);
                if (rowBank) {
                    if (_ifsc_code == rowBank.ifsc_code &&
                        (rowBank.ifsc_code_validated && rowBank.ifsc_code_validated == true)) {
                        const ifscOutResult = {
                            ifsc: _ifsc_code,
                            bank: rowBank.bank_other,
                            branch: rowBank.branch_other,
                        };
                        return res.status(200).json(success(true, apiStatus.IFSC_CODE_VALIDATED, "IFSC code is already verified.", ifscOutResult));
                    }

                    var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';
                    // EXTERNAL CALL HERE
                    const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                    is_ifsc_valid = ifsc_result.status;
                    ifsc_error_msg = ifsc_result.msg;
                    ifsc_response = ifsc_result.data;
                    // EXTERNAL CALL HERE

                    if (is_ifsc_valid) {
                        var bank_other = ''; var branch_other = '';
                        try {
                            const tempJson = JSON.parse(ifsc_response);
                            bank_other = tempJson.bank;
                            branch_other = tempJson.branch;
                        } catch (_) {

                        }
                        const _query3 = `UPDATE temp_bank SET ifsc_code = ?, bank_other = ?, branch_other = ?, ifsc_code_validated = true,
                        ifsc_code_valid_date = ?, ifsc_code_response = ? WHERE temp_id = ?`;
                        await db.sequelize.query(_query3, { replacements: [_ifsc_code, bank_other, branch_other, new Date(), ifsc_response, row.temp_id], type: QueryTypes.UPDATE });
                        const ifscOutResult = {
                            ifsc: _ifsc_code,
                            bank: bank_other,
                            branch: branch_other,
                        };
                        return res.status(200).json(success(true, res.statusCode, "IFSC code verified successfully.", ifscOutResult));

                    } else {
                        const _query3 = `UPDATE temp_bank SET ifsc_code_validated = false WHERE temp_id = ?`;
                        await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                        return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), null));
                    }

                } else {
                    var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';
                    // EXTERNAL CALL HERE
                    const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                    is_ifsc_valid = ifsc_result.status;
                    ifsc_error_msg = ifsc_result.msg;
                    ifsc_response = ifsc_result.data;
                    // EXTERNAL CALL HERE
                    if (is_ifsc_valid) {
                        var bank_other = ''; var branch_other = '';
                        try {
                            const tempJson = JSON.parse(ifsc_response);
                            bank_other = tempJson.bank;
                            branch_other = tempJson.branch;
                        } catch (_) {

                        }
                        const _query3 = `INSERT INTO temp_bank(temp_id, ifsc_code, bank_other, branch_other, ifsc_code_validated, ifsc_code_valid_date,
                            ifsc_code_response) VALUES(?, ?, ?, ?, ?, ?, ?)`;
                        await db.sequelize.query(_query3, { replacements: [row.temp_id, _ifsc_code, bank_other, branch_other, true, new Date(), ifsc_response], type: QueryTypes.INSERT });
                        const ifscOutResult = {
                            ifsc: _ifsc_code,
                            bank: bank_other,
                            branch: branch_other,
                        };
                        return res.status(200).json(success(true, res.statusCode, "IFSC code verified successfully.", ifscOutResult));
                    } else {
                        return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), null));
                    }
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const ifsc_code_search = async (req, res, next) => {
    const { entity_id, ifsc_code } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {
                const _ifsc_code = (ifsc_code && ifsc_code.length > 0) ? ifsc_code.trim().toUpperCase() : "";
                const results = await commonModule.ifsc_code_search(_ifsc_code);
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const validate_enrolment_detail = async (req, res, next) => {
    const { entity_id, company_pan_no, gstin_no, cin_no, registration_no, it_80g_reg_no, it_12a_reg_no, darpan_reg_no,
        mca_csr_f1_reg_no, fcra_no_with_status, fcra_no_status, expertise_area_ids, fin_audit_rpt_filed,
        account_no, re_account_no, account_type, ifsc_code, bank_name, bank_branch, services, dynamic_values
    } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 3, }));
                }

                var form_static_fields = await registrationModule.registration_static_fields(_entity_id);

                const _company_pan_no = (company_pan_no && company_pan_no.length > 0) ? company_pan_no.trim().toUpperCase() : "";
                if (form_static_fields.company_pan_no.visible) {
                    if (_company_pan_no.length <= 0 && form_static_fields.company_pan_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company PAN number.", { tab: 3, }));
                    }
                }
                if (_company_pan_no.length > 0) {
                    if (!utils.is_pan_no(_company_pan_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct company PAN number.", { tab: 3, }));
                    }
                    const _queryPan = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:company_pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:company_pan_no)`;
                    const rowPan = await db.sequelize.query(_queryPan, { replacements: { company_pan_no: _company_pan_no }, type: QueryTypes.SELECT });
                    if (rowPan && rowPan.length > 0) {
                        if (row.company_pan_no && row.company_pan_no.length > 0) {
                            const _query3 = `UPDATE temp_master SET company_pan_no = '', company_pan_no_validated = false, company_pan_no_valid_date = null WHERE temp_id = ?`;
                            await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                        }
                        return res.status(200).json(success(false, res.statusCode, "Company PAN number is already registered.", { tab: 3, }));
                    }
                    var company_pan_no_validated = false;
                    if (row.company_pan_no) {
                        if (_company_pan_no == row.company_pan_no &&
                            (row.company_pan_no_validated && row.company_pan_no_validated == true)) {
                            company_pan_no_validated = true;
                        }
                    }
                    if (!company_pan_no_validated) {
                        var is_pan_no_valid = false; var pan_error_msg = ''; var company_pan_no_response = '';
                        // EXTERNAL CALL HERE
                        const pan_result = await fetchApigee.validate_pan_card(_company_pan_no);
                        is_pan_no_valid = pan_result.status;
                        pan_error_msg = pan_result.msg;
                        company_pan_no_response = pan_result.data;
                        // EXTERNAL CALL HERE
                        if (is_pan_no_valid) {
                            const _queryInReg = `UPDATE temp_master SET company_pan_no = ?, company_pan_no_validated = true, company_pan_no_valid_date = ?, company_pan_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryInReg, { replacements: [_company_pan_no, new Date(), company_pan_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (pan_error_msg.length > 0 ? pan_error_msg : 'Company PAN verification failed.'), { tab: 3, }));
                        }
                    }
                }
                const _gstin_no = (gstin_no && gstin_no.length > 0) ? gstin_no.trim().toUpperCase() : "";
                if (form_static_fields.gstin_no.visible) {
                    if (_gstin_no.length <= 0 && form_static_fields.gstin_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter GSTIN number.", { tab: 3, }));
                    }
                }
                if (_gstin_no.length > 0) {
                    if (!utils.is_gstn_no(_gstin_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct GSTIN number.", { tab: 3, }));
                    }
                    const _queryGstin = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.gstin_no, '')) > 0 AND LOWER(u.gstin_no) = LOWER(:gstin_no)`;
                    const rowGstin = await db.sequelize.query(_queryGstin, { replacements: { gstin_no: _gstin_no }, type: QueryTypes.SELECT });
                    if (rowGstin && rowGstin.length > 0) {
                        if (row.gstin_no && row.gstin_no.length > 0) {
                            const _query3 = `UPDATE temp_master SET gstin_no = '', gstin_no_validated = false, gstin_no_valid_date = null WHERE temp_id = ?`;
                            await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                        }
                        return res.status(200).json(success(false, res.statusCode, "GSTIN number is already registered.", { tab: 3, }));
                    }
                    var gstin_no_validated = false;
                    if (row.gstin_no) {
                        if (_gstin_no == row.gstin_no && (row.gstin_no_validated && row.gstin_no_validated == true)) {
                            gstin_no_validated = true;
                        }
                    }
                    if (!gstin_no_validated) {
                        var is_gstin_no_valid = false; var gstin_error_msg = ''; var gstin_no_response = '';
                        // EXTERNAL CALL HERE
                        const gstin_result = await fetchApigee.validate_gstin_no(_gstin_no);
                        is_gstin_no_valid = gstin_result.status;
                        gstin_error_msg = gstin_result.msg;
                        gstin_no_response = gstin_result.data;
                        // EXTERNAL CALL HERE
                        if (is_gstin_no_valid) {
                            const _queryInReg = `UPDATE temp_master SET gstin_no = ?, gstin_no_validated = true, gstin_no_valid_date = ?, gstin_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryInReg, { replacements: [_gstin_no, new Date(), gstin_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (gstin_error_msg.length > 0 ? gstin_error_msg : 'GSTIN number verification failed.'), { tab: 3, }));
                        }
                    }
                }
                const _cin_no = (cin_no && cin_no.length > 0) ? cin_no.trim().toUpperCase() : "";
                if (form_static_fields.cin_no.visible) {
                    if (_cin_no.length <= 0 && form_static_fields.cin_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company identification number.", { tab: 3, }));
                    }
                }
                if (_cin_no.length > 0) {
                    if (!utils.is_cin_no(_cin_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct company identification number.", { tab: 3, }));
                    }
                    const _queryCin = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.cin_no, '')) > 0 AND LOWER(u.cin_no) = LOWER(:cin_no)`;
                    const rowCin = await db.sequelize.query(_queryCin, { replacements: { cin_no: _cin_no }, type: QueryTypes.SELECT });
                    if (rowCin && rowCin.length > 0) {
                        if (row.cin_no && row.cin_no.length > 0) {
                            const _query3 = `UPDATE temp_master SET cin_no = '', cin_no_validated = false, cin_no_valid_date = null WHERE temp_id = ?`;
                            await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                        }
                        return res.status(200).json(success(false, res.statusCode, "Company identification number is already registered.", { tab: 3, }));
                    }
                    var cin_no_validated = false;
                    if (row.cin_no) {
                        if (_cin_no == row.cin_no && (row.cin_no_validated && row.cin_no_validated == true)) {
                            cin_no_validated = true;
                        }
                    }
                    if (!cin_no_validated) {
                        var is_cin_no_valid = false; var cin_error_msg = ''; var cin_no_response = '';
                        // EXTERNAL CALL HERE
                        const cin_result = await fetchApigee.validate_cin_no(_cin_no);
                        is_cin_no_valid = cin_result.status;
                        cin_error_msg = cin_result.msg;
                        cin_no_response = cin_result.data;
                        // EXTERNAL CALL HERE
                        if (is_cin_no_valid) {
                            const _queryInReg = `UPDATE temp_master SET cin_no = ?, cin_no_validated = true, cin_no_valid_date = ?, cin_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryInReg, { replacements: [_cin_no, new Date(), cin_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (cin_error_msg.length > 0 ? cin_error_msg : 'Company identification number verification failed.'), { tab: 3, }));
                        }
                    }
                }
                const _registration_no = (registration_no && registration_no.length > 0) ? registration_no.trim() : "";
                if (form_static_fields.registration_no.visible) {
                    if (_registration_no.length <= 0 && form_static_fields.registration_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter registration number.", { tab: 3, }));
                    }
                }
                if (_registration_no.length > 0) {
                    const _query501 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.registration_no, '')) > 0 AND LOWER(u.registration_no) = LOWER(:registration_no)`;
                    const row501 = await db.sequelize.query(_query501, { replacements: { registration_no: _registration_no }, type: QueryTypes.SELECT });
                    if (row501 && row501.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Registration number is already registered.", { tab: 3, }));
                    }
                }
                const _it_80g_reg_no = (it_80g_reg_no && it_80g_reg_no.length > 0) ? it_80g_reg_no.trim() : "";
                if (form_static_fields.it_80g_reg_no.visible) {
                    if (_it_80g_reg_no.length <= 0 && form_static_fields.it_80g_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter income tax 18G registration no.", { tab: 3, }));
                    }
                }
                if (_it_80g_reg_no.length > 0) {
                    const _query502 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.it_80g_reg_no, '')) > 0 AND LOWER(u.it_80g_reg_no) = LOWER(:it_80g_reg_no)`;
                    const row502 = await db.sequelize.query(_query502, { replacements: { it_80g_reg_no: _it_80g_reg_no }, type: QueryTypes.SELECT });
                    if (row502 && row502.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Income tax 18G registration no. is already registered.", { tab: 3, }));
                    }
                }
                const _it_12a_reg_no = (it_12a_reg_no && it_12a_reg_no.length > 0) ? it_12a_reg_no.trim() : "";
                if (form_static_fields.it_12a_reg_no.visible) {
                    if (_it_12a_reg_no.length <= 0 && form_static_fields.it_12a_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter income tax 12A registration no.", { tab: 3, }));
                    }
                }
                if (_it_12a_reg_no.length > 0) {
                    const _query503 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.it_12a_reg_no, '')) > 0 AND LOWER(u.it_12a_reg_no) = LOWER(:it_12a_reg_no)`;
                    const row503 = await db.sequelize.query(_query503, { replacements: { it_12a_reg_no: _it_12a_reg_no }, type: QueryTypes.SELECT });
                    if (row503 && row503.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Income tax 12A registration no. is already registered.", { tab: 3, }));
                    }
                }
                const _darpan_reg_no = (darpan_reg_no && darpan_reg_no.length > 0) ? darpan_reg_no.trim() : "";
                if (form_static_fields.darpan_reg_no.visible) {
                    if (_darpan_reg_no.length <= 0 && form_static_fields.darpan_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter NGO DARPAN registration no/id.", { tab: 3, }));
                    }
                }
                if (_darpan_reg_no.length > 0) {
                    const _query504 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.darpan_reg_no, '')) > 0 AND LOWER(u.darpan_reg_no) = LOWER(:darpan_reg_no)`;
                    const row504 = await db.sequelize.query(_query504, { replacements: { darpan_reg_no: _darpan_reg_no }, type: QueryTypes.SELECT });
                    if (row504 && row504.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "NGO DARPAN registration no/id is already registered.", { tab: 3, }));
                    }
                }
                const _mca_csr_f1_reg_no = (mca_csr_f1_reg_no && mca_csr_f1_reg_no.length > 0) ? mca_csr_f1_reg_no.trim() : "";
                if (form_static_fields.mca_csr_f1_reg_no.visible) {
                    if (_mca_csr_f1_reg_no.length <= 0 && form_static_fields.mca_csr_f1_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter MCA CSR form 1 registration no.", { tab: 3, }));
                    }
                }
                if (_mca_csr_f1_reg_no.length > 0) {
                    const _query505 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.mca_csr_f1_reg_no, '')) > 0 AND LOWER(u.mca_csr_f1_reg_no) = LOWER(:mca_csr_f1_reg_no)`;
                    const row505 = await db.sequelize.query(_query505, { replacements: { mca_csr_f1_reg_no: _mca_csr_f1_reg_no }, type: QueryTypes.SELECT });
                    if (row505 && row505.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "MCA CSR form 1 registration no. is already registered.", { tab: 3, }));
                    }
                }
                const _fcra_no_with_status = (fcra_no_with_status && fcra_no_with_status.length > 0) ? fcra_no_with_status.trim() : "";
                const _fcra_no_status = (fcra_no_status && fcra_no_status.toString().toLowerCase() == 'true') ? true : false;

                var _expertise_area_ids = [];
                if (expertise_area_ids && expertise_area_ids.length > 0) {
                    const expertise_area_ids_list = expertise_area_ids.split(',').join('|');
                    const expertise_area_ids_array = expertise_area_ids_list.split('|');
                    for (let ax = 0; expertise_area_ids_array && ax < expertise_area_ids_array.length; ax++) {
                        var _ax = expertise_area_ids_array[ax] && validator.isNumeric(expertise_area_ids_array[ax].toString()) ? BigInt(expertise_area_ids_array[ax]) : 0;
                        if (_ax > 0) {
                            _expertise_area_ids.push(_ax);
                        }
                    }
                }
                if (form_static_fields.expertise_area_id.visible) {
                    if (_expertise_area_ids.length <= 0 && form_static_fields.expertise_area_id.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please select area of expertise.", { tab: 3, }));
                    }
                }
                const _fin_audit_rpt_filed = (fin_audit_rpt_filed && fin_audit_rpt_filed.toString().toLowerCase() == 'true') ? true : false;

                var _dynamic_values = []; var _dynamic_values_new_array = []; var current_section_field = [];
                if (dynamic_values != null) {
                    if (dynamic_values.constructor == String) {
                        try { _dynamic_values = JSON.parse(dynamic_values); } catch (_) { }
                    } else {
                        if (dynamic_values.constructor == Array) { _dynamic_values = dynamic_values; }
                    }
                }
                if (form_static_fields.flow_by_reg_type_id) {
                    for (let pf = 0; form_static_fields.reg_type_flow_data && pf < form_static_fields.reg_type_flow_data.length; pf++) {
                        if (form_static_fields.reg_type_flow_data[pf].reg_type_id.toString() == row.registered_as_id.toString()) {
                            const tmpDynFormField = form_static_fields.reg_type_flow_data[pf].field_data.dynamic_fields;
                            for (let i = 0; i < tmpDynFormField.length; i++) {
                                const eleFld = tmpDynFormField[i];
                                if (eleFld.section_id == 'ED_IDN' && eleFld.reg_type == true) {
                                    current_section_field.push(eleFld.field_id); var fieldData = null;
                                    for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                                        if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                            fieldData = _dynamic_values[j]; break;
                                        }
                                    }
                                    if (fieldData != null) {
                                        const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                                        if (eleFld.is_required) {
                                            if (_user_value.length <= 0) {
                                                if (validate_dynamic_field_on_reg) {
                                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                                }
                                            }
                                        }
                                        const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                                        if (validation_result.has_error) {
                                            if (validate_dynamic_field_on_reg) {
                                                return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 3, }));
                                            }
                                        }
                                        _dynamic_values_new_array.push({
                                            field_id: eleFld.field_id,
                                            user_value: _user_value,
                                        });
                                    } else {
                                        if (eleFld.is_required) {
                                            if (validate_dynamic_field_on_reg) {
                                                return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                        }
                    }

                    for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                        const eleFld = form_static_fields.dynamic_fields[i];
                        if (eleFld.section_id == 'ED_IDN' && eleFld.reg_type == false) {
                            current_section_field.push(eleFld.field_id); var fieldData = null;
                            for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                                if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                    fieldData = _dynamic_values[j]; break;
                                }
                            }
                            if (fieldData != null) {
                                const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                                if (eleFld.is_required) {
                                    if (_user_value.length <= 0) {
                                        if (validate_dynamic_field_on_reg) {
                                            return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                        }
                                    }
                                }
                                const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                                if (validation_result.has_error) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 3, }));
                                    }
                                }
                                _dynamic_values_new_array.push({
                                    field_id: eleFld.field_id,
                                    user_value: _user_value,
                                });
                            } else {
                                if (eleFld.is_required) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                    }
                                }
                            }
                        }
                    }
                } else {
                    for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                        const eleFld = form_static_fields.dynamic_fields[i];
                        if (eleFld.section_id == 'ED_IDN') {
                            current_section_field.push(eleFld.field_id); var fieldData = null;
                            for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                                if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                    fieldData = _dynamic_values[j]; break;
                                }
                            }
                            if (fieldData != null) {
                                const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                                if (eleFld.is_required) {
                                    if (_user_value.length <= 0) {
                                        if (validate_dynamic_field_on_reg) {
                                            return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                        }
                                    }
                                }
                                const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                                if (validation_result.has_error) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 3, }));
                                    }
                                }
                                _dynamic_values_new_array.push({
                                    field_id: eleFld.field_id,
                                    user_value: _user_value,
                                });
                            } else {
                                if (eleFld.is_required) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                    }
                                }
                            }
                        }
                    }
                }

                var _services = [];
                if (form_static_fields.tab_services.visible) {
                    var services_data = await registrationModule.services_data(_entity_id, form_static_fields.tab_services.visible);
                    for (let s_i = 0; services && s_i < services.length; s_i++) {
                        const sEle = services[s_i]; var is_exists = false; var cat_name = ''; var service_name = '';
                        for (let i = 0; services_data && i < services_data.length; i++) {
                            for (let j = 0; services_data[i].category && j < services_data[i].category.length; j++) {
                                for (let k = 0; services_data[i].category[j].sub_category && k < services_data[i].category[j].sub_category.length; k++) {
                                    console.log(services_data[i].category[j].sub_category[k].id.toString(), sEle.id.toString());
                                    if (services_data[i].category[j].sub_category[k].id.toString() == sEle.id.toString()) {
                                        cat_name = services_data[i].category[j].name;
                                        service_name = services_data[i].category[j].sub_category[k].name; is_exists = true;
                                        break;
                                    }
                                }
                                if (is_exists) { break; }
                            }
                            if (is_exists) { break; }
                        }
                        if (!is_exists) {
                            return res.status(200).json(success(false, res.statusCode, "Invalid service selected, Please check.", { tab: 3, }));
                        }
                        var amt = 0; try { amt = parseFloat(sEle.price); amt = parseFloat(amt.toFixed(2)); } catch (_) { }
                        if (amt <= 0) {
                            return res.status(200).json(success(false, res.statusCode, `Please enter price for service ${cat_name}(${service_name}).`, { tab: 3, }));
                        }
                        _services.push({
                            id: sEle.id,
                            size: sEle.size,
                            price: amt,
                        });
                    }
                    if (form_static_fields.tab_services.required) {
                        if (_services.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please select services you will provide.", { tab: 3, }));
                        }
                    }
                }
                if (_services && _services.length > 0) {
                    var tmpSerID = [];
                    for (let i = 0; i < _services.length; i++) {
                        var rowSer = await registrationModule.temp_service_exists(row.temp_id, _services[i].id);
                        if (rowSer) {
                            const _query952 = `UPDATE temp_services SET range_size = ?, price = ? WHERE t_id = ?`;
                            await db.sequelize.query(_query952, { replacements: [_services[i].size, _services[i].price, rowSer.t_id], type: QueryTypes.UPDATE });
                            tmpSerID.push(rowSer.t_id);
                        } else {
                            const _query953 = `INSERT INTO temp_services(temp_id, sub_cat_id, range_size, price) VALUES (?, ?, ?, ?) RETURNING "t_id"`;
                            const _replacements953 = [row.temp_id, _services[i].id, _services[i].size, _services[i].price];
                            const [rowOut953] = await db.sequelize.query(_query953, { replacements: _replacements953, type: QueryTypes.INSERT });
                            const t_id = (rowOut953 && rowOut953.length > 0 && rowOut953[0] ? rowOut953[0].t_id : 0);
                            if (t_id > 0) {
                                tmpSerID.push(t_id);
                            }
                        }
                    }
                    if (tmpSerID.length > 0) {
                        const _query954 = `DELETE FROM temp_services WHERE temp_id = ? AND t_id NOT IN (?)`;
                        await db.sequelize.query(_query954, { replacements: [row.temp_id, tmpSerID], type: QueryTypes.DELETE });
                    } else {
                        const _query954 = `DELETE FROM temp_services WHERE temp_id = ?`;
                        await db.sequelize.query(_query954, { replacements: [row.temp_id], type: QueryTypes.DELETE });
                    }
                } else {
                    const _query951 = `DELETE FROM temp_services WHERE temp_id = ?`;
                    await db.sequelize.query(_query951, { replacements: [row.temp_id], type: QueryTypes.DELETE });
                }

                if (form_static_fields.tab_bank_details.visible) {
                    var _account_no = ""; var _re_account_no = ""; var _account_type = ""; var _ifsc_code = ""; var _bank_name = ""; var _bank_branch = "";
                    _account_no = (account_no && account_no.length > 0) ? account_no.trim() : "";
                    if (_account_no.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter bank account number.", { tab: 3, }));
                    }
                    if (!utils.is_bank_account_no(_account_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Invalid bank account number.", { tab: 3, }));
                    }
                    _re_account_no = (re_account_no && re_account_no.length > 0) ? re_account_no.trim() : "";
                    if (_re_account_no.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please re-enter bank account number.", { tab: 3, }));
                    }
                    if (!utils.is_bank_account_no(_re_account_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Invalid re-enter bank account number.", { tab: 3, }));
                    }
                    if (_account_no != _re_account_no) {
                        return res.status(200).json(success(false, res.statusCode, "Bank account number does not matched.", { tab: 3, }));
                    }
                    _account_type = account_type && validator.isNumeric(account_type.toString()) ? parseInt(account_type) : 0;
                    if (_account_type <= 0 && account_type && account_type.length > 0) {
                        if (account_type.trim().toLowerCase() == 'saving') { _account_type = 1; }
                        if (account_type.trim().toLowerCase() == 'current') { _account_type = 2; }
                    }
                    if (_account_type <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please select account type.", { tab: 3, }));
                    }
                    if (!utils.check_in_array(_account_type, [1, 2])) {
                        return res.status(200).json(success(false, res.statusCode, "Account type must be Saving(1) or Current(2).", { tab: 3, }));
                    }
                    _ifsc_code = (ifsc_code && ifsc_code.length > 0) ? ifsc_code.trim().toUpperCase() : "";
                    if (_ifsc_code.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter IFSC code.", { tab: 3, }));
                    }
                    if (!utils.is_ifsc_code(_ifsc_code)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct IFSC code.", { tab: 3, }));
                    }
                    var rowBank = await registrationModule.temp_bank_exists(row.temp_id);
                    var is_ifsc_validation_completed = false; var is_ifsc_reverified = true;
                    if (rowBank) {
                        if (_ifsc_code == rowBank.ifsc_code &&
                            (rowBank.ifsc_code_validated && rowBank.ifsc_code_validated == true)) {
                            is_ifsc_validation_completed = true; is_ifsc_reverified = false;
                        } else {
                            var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';
                            // EXTERNAL CALL HERE
                            const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                            is_ifsc_valid = ifsc_result.status;
                            ifsc_error_msg = ifsc_result.msg;
                            ifsc_response = ifsc_result.data;
                            // EXTERNAL CALL HERE
                            if (is_ifsc_valid) {
                                try {
                                    const tempJson = JSON.parse(ifsc_response);
                                    _bank_name = tempJson.bank;
                                    _bank_branch = tempJson.branch;
                                } catch (_) {
                                }
                                const _query7 = `UPDATE temp_bank SET ifsc_code = ?, bank_other = ?, branch_other = ?, ifsc_code_validated = true,
                                ifsc_code_valid_date = ?, ifsc_code_response = ? WHERE temp_id = ?`;
                                await db.sequelize.query(_query7, { replacements: [_ifsc_code, _bank_name, _bank_branch, new Date(), ifsc_response, row.temp_id], type: QueryTypes.UPDATE });
                                is_ifsc_validation_completed = true;
                            } else {
                                return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), { tab: 3, }));
                            }
                        }
                    } else {
                        var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';
                        // EXTERNAL CALL HERE
                        const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                        is_ifsc_valid = ifsc_result.status;
                        ifsc_error_msg = ifsc_result.msg;
                        ifsc_response = ifsc_result.data;
                        // EXTERNAL CALL HERE
                        if (is_ifsc_valid) {
                            try {
                                const tempJson = JSON.parse(ifsc_response);
                                _bank_name = tempJson.bank;
                                _bank_branch = tempJson.branch;
                            } catch (_) {
                            }
                            const _query8 = `INSERT INTO temp_bank(temp_id, ifsc_code, bank_other, branch_other, ifsc_code_validated, ifsc_code_valid_date,
                                ifsc_code_response) VALUES(?, ?, ?, ?, ?, ?, ?)`;
                            await db.sequelize.query(_query8, { replacements: [row.temp_id, _ifsc_code, _bank_name, _bank_branch, true, new Date(), ifsc_response], type: QueryTypes.INSERT });
                            is_ifsc_validation_completed = true;
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), { tab: 3, }));
                        }
                    }
                    if (is_ifsc_validation_completed) {
                        if (is_ifsc_reverified) {
                            rowBank = await registrationModule.temp_bank_exists(row.temp_id);
                        }
                        var account_validation_completed = false;
                        if (rowBank.account_no && _account_no == rowBank.account_no &&
                            (rowBank.account_no_validated && rowBank.account_no_validated == true)) {
                            if (!is_ifsc_reverified) {
                                account_validation_completed = true;
                            }
                        }
                        if (!account_validation_completed) {
                            var is_account_no_valid = false; var account_no_error_msg = ''; var account_no_response = '';
                            // EXTERNAL CALL HERE
                            const acc_no_result = await fetchApigee.validate_bank_acc_number(_account_no, _account_type, _ifsc_code);
                            is_account_no_valid = acc_no_result.status;
                            account_no_error_msg = acc_no_result.msg;
                            account_no_response = acc_no_result.data;
                            // EXTERNAL CALL HERE
                            if (is_account_no_valid) {
                                const _query9 = `UPDATE temp_bank SET account_no = ?, re_account_no = ?, account_type = ?, consent_provided = true,
                                account_no_validated = true, account_no_valid_date = ?, account_no_response = ? WHERE temp_id = ?`;
                                await db.sequelize.query(_query9, { replacements: [_account_no, _re_account_no, _account_type, new Date(), account_no_response, row.temp_id], type: QueryTypes.UPDATE });
                            } else {
                                return res.status(200).json(success(false, res.statusCode, (account_no_error_msg.length > 0 ? account_no_error_msg : 'Bank account verification failed.'), { tab: 3, }));
                            }
                        }
                    }
                    else {
                        return res.status(200).json(success(false, res.statusCode, 'IFSC code verification failed.', { tab: 3, }));
                    }
                } else {
                    const _query801 = `DELETE FROM temp_bank WHERE temp_id = ?`;
                    await db.sequelize.query(_query801, { replacements: [row.temp_id], type: QueryTypes.DELETE });
                }

                const _query13 = `UPDATE temp_master SET  
                registration_no = ?, it_80g_reg_no = ?, it_12a_reg_no = ?, darpan_reg_no = ?, mca_csr_f1_reg_no = ?, 
                fcra_no_with_status = ?, fcra_no_status = ?, expertise_area_id = ?, fin_audit_rpt_filed = ?
                WHERE temp_id = ?`;
                const _replacements13 = [_registration_no, _it_80g_reg_no, _it_12a_reg_no, _darpan_reg_no, _mca_csr_f1_reg_no,
                    _fcra_no_with_status, _fcra_no_status, _expertise_area_ids.join(','), _fin_audit_rpt_filed, row.temp_id];
                await db.sequelize.query(_query13, { replacements: _replacements13, type: QueryTypes.UPDATE });

                var updatedFieldToDB = [];
                for (let dv = 0; _dynamic_values_new_array && dv < _dynamic_values_new_array.length; dv++) {
                    const eleVal = _dynamic_values_new_array[dv];
                    const _queryChkField = `SELECT temp_id FROM temp_field_values WHERE temp_id = ? AND static_field_id = ?`;
                    const rowChkField = await db.sequelize.query(_queryChkField, { replacements: [row.temp_id, eleVal.field_id], type: QueryTypes.SELECT });
                    if (rowChkField && rowChkField.length > 0) {
                        const _queryFieldUp = `UPDATE temp_field_values SET user_value = ? WHERE temp_id = ? AND static_field_id = ?`;
                        await db.sequelize.query(_queryFieldUp, { replacements: [eleVal.user_value, row.temp_id, eleVal.field_id], type: QueryTypes.UPDATE });
                    } else {
                        const _queryFieldIn = `INSERT INTO temp_field_values(temp_id, static_field_id, user_value) VALUES(?, ?, ?)`;
                        await db.sequelize.query(_queryFieldIn, { replacements: [row.temp_id, eleVal.field_id, eleVal.user_value], type: QueryTypes.INSERT });
                    }
                    updatedFieldToDB.push(eleVal.field_id);
                }

                if (current_section_field.length > 0) {
                    const _queryFieldDel = `DELETE FROM temp_field_values WHERE temp_id = ? AND static_field_id IN (?) ${(updatedFieldToDB.length > 0 ? ' AND static_field_id NOT IN (?)' : '')}`;
                    var _replFieldDel = [row.temp_id, current_section_field]; if (updatedFieldToDB.length > 0) { _replFieldDel.push(updatedFieldToDB); }
                    await db.sequelize.query(_queryFieldDel, { replacements: _replFieldDel, type: QueryTypes.DELETE });
                }

                return res.status(200).json(success(true, res.statusCode, "", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", { tab: 3, }));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", { tab: 3, }));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, { tab: 3, }));
    }
};

const validate_user_detail = async (req, res, next) => {
    const { entity_id, user_details } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 4, }));
                }

                if (!user_details) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter admin user details.", { tab: 4, }));
                }
                if (user_details.length >= 2) {
                    const mobile_ccc_list = await commonModule.country_calling_code();
                    for (let i = 0; i < user_details.length; i++) {
                        const usr = user_details[i];
                        var tmpDesigID = usr.designation && validator.isNumeric(usr.designation.toString()) ? BigInt(usr.designation) : 0;
                        if (tmpDesigID <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please select designation for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }
                        if (!usr.email_id || usr.email_id.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please enter email id for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }
                        if (!validator.isEmail(usr.email_id)) {
                            return res.status(200).json(success(false, res.statusCode, "Please enter correct email id for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }
                        const chkUsrMail = await commonModule.is_email_registered(usr.email_id);
                        if (chkUsrMail) {
                            return res.status(200).json(success(false, res.statusCode, "Email id is already registered of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }

                        var _mobile_ccc = (usr.mobile_ccc && usr.mobile_ccc.length > 0) ? usr.mobile_ccc.trim() : "";
                        var is_valid_mobile_ccc = false;
                        if (_mobile_ccc.length > 0) {
                            for (let cc = 0; cc < mobile_ccc_list.length; cc++) {
                                if (mobile_ccc_list[cc].toLowerCase().trim() == _mobile_ccc.toLowerCase().trim()) {
                                    is_valid_mobile_ccc = true; break;
                                }
                            }
                        } else {
                            _mobile_ccc = mobile_ccc_list[0]; is_valid_mobile_ccc = true;
                        }
                        if (!is_valid_mobile_ccc) {
                            return res.status(200).json(success(false, res.statusCode, "Invalid mobile country code of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }
                        if (!usr.mobile_no || usr.mobile_no.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please enter mobile number of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }
                        if (!utils.is_mobile_no(usr.mobile_no)) {
                            return res.status(200).json(success(false, res.statusCode, "Please enter correct mobile number of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }
                        const chkUsrMobile = await commonModule.is_mobile_registered(usr.mobile_no);
                        if (chkUsrMobile) {
                            return res.status(200).json(success(false, res.statusCode, "Mobile number is already registered of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                        }
                    }
                    var both_user_has_same_email = hasDuplicate(user_details, "email_id");
                    if (both_user_has_same_email) {
                        return res.status(200).json(success(false, res.statusCode, "Admin user details have same email address.", { tab: 4, }));
                    }
                    var both_user_has_same_mobile = hasDuplicate(user_details, "mobile_no");
                    if (both_user_has_same_mobile) {
                        return res.status(200).json(success(false, res.statusCode, "Admin user details have same mobile number.", { tab: 4, }));
                    }
                    var both_user_has_same_designation = hasDuplicate(user_details, "designation");
                    if (both_user_has_same_designation) {
                        return res.status(200).json(success(false, res.statusCode, "Admin user details have same designation.", { tab: 4, }));
                    }

                    return res.status(200).json(success(true, res.statusCode, "Success.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, 'Please add both admin user details.<br>Click on "Add Member" button to add.', { tab: 4, }));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", { tab: 4, }));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", { tab: 4, }));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, { tab: 4, }));
    }
};

const validate_bank_detail = async (req, res, next) => {
    const { entity_id, account_no, re_account_no, account_type, ifsc_code, bank_name, bank_branch } = req.body;
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;

        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 1, }));
                }


                if (!account_no || account_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter bank account number.", null));
                }
                if (!utils.is_bank_account_no(account_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Invalid bank account number.", null));
                }
                if (!re_account_no || re_account_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please re-enter bank account number.", null));
                }
                if (!utils.is_bank_account_no(re_account_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Invalid re-enter bank account number.", null));
                }
                if (account_no != re_account_no) {
                    return res.status(200).json(success(false, res.statusCode, "Bank account number does not matched.", null));
                }
                var _account_type = account_type && validator.isNumeric(account_type.toString()) ? parseInt(account_type) : 0;
                if (_account_type <= 0 && account_type && account_type.length > 0) {
                    if (account_type.trim().toLowerCase() == 'saving') { _account_type = 1; }
                    if (account_type.trim().toLowerCase() == 'current') { _account_type = 2; }
                }
                if (_account_type <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please select account type.", null));
                }
                if (!utils.check_in_array(_account_type, [1, 2])) {
                    return res.status(200).json(success(false, res.statusCode, "Account type must be Saving(1) or Current(2).", null));
                }
                const _ifsc_code = (ifsc_code && ifsc_code.length > 0) ? ifsc_code.trim().toUpperCase() : "";

                if (!_ifsc_code || _ifsc_code.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter IFSC code.", null));
                }
                if (!utils.is_ifsc_code(_ifsc_code)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct IFSC code.", null));
                }

                var rowBank = await registrationModule.temp_bank_exists(row.temp_id);

                var is_ifsc_validation_completed = false; var is_ifsc_reverified = true;
                if (rowBank) {
                    if (_ifsc_code == rowBank.ifsc_code &&
                        (rowBank.ifsc_code_validated && rowBank.ifsc_code_validated == true)) {
                        is_ifsc_validation_completed = true; is_ifsc_reverified = false;
                    } else {
                        var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';

                        // EXTERNAL CALL HERE
                        const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                        is_ifsc_valid = ifsc_result.status;
                        ifsc_error_msg = ifsc_result.msg;
                        ifsc_response = ifsc_result.data;
                        // EXTERNAL CALL HERE

                        if (is_ifsc_valid) {
                            var bank_other = ''; var branch_other = '';
                            try {
                                const tempJson = JSON.parse(ifsc_response);
                                bank_other = tempJson.bank;
                                branch_other = tempJson.branch;
                            } catch (_) {

                            }
                            const _query3 = `UPDATE temp_bank SET ifsc_code = ?, bank_other = ?, branch_other = ?, ifsc_code_validated = true,
                            ifsc_code_valid_date = ?, ifsc_code_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_query3, { replacements: [_ifsc_code, bank_other, branch_other, new Date(), ifsc_response, row.temp_id], type: QueryTypes.UPDATE });
                            is_ifsc_validation_completed = true;
                        } else {
                            const _query3 = `UPDATE temp_bank SET ifsc_code_validated = false WHERE temp_id = ?`;
                            await db.sequelize.query(_query3, { replacements: [row.temp_id], type: QueryTypes.UPDATE });
                            return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), null));
                        }
                    }
                } else {
                    var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';

                    // EXTERNAL CALL HERE
                    const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                    is_ifsc_valid = ifsc_result.status;
                    ifsc_error_msg = ifsc_result.msg;
                    ifsc_response = ifsc_result.data;
                    // EXTERNAL CALL HERE

                    if (is_ifsc_valid) {
                        var bank_other = ''; var branch_other = '';
                        try {
                            const tempJson = JSON.parse(ifsc_response);
                            bank_other = tempJson.bank;
                            branch_other = tempJson.branch;
                        } catch (_) {

                        }
                        const _query3 = `INSERT INTO temp_bank(temp_id, ifsc_code, bank_other, branch_other, ifsc_code_validated, ifsc_code_valid_date,
                            ifsc_code_response) VALUES(?, ?, ?, ?, ?, ?, ?)`;
                        await db.sequelize.query(_query3, { replacements: [row.temp_id, _ifsc_code, bank_other, branch_other, true, new Date(), ifsc_response], type: QueryTypes.INSERT });
                        is_ifsc_validation_completed = true;
                    } else {
                        return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), null));
                    }
                }
                if (is_ifsc_validation_completed) {
                    if (is_ifsc_reverified) {
                        rowBank = await registrationModule.temp_bank_exists(row.temp_id);
                    }
                    var account_validation_completed = false;
                    if (rowBank.account_no && account_no == rowBank.account_no &&
                        (rowBank.account_no_validated && rowBank.account_no_validated == true)) {
                        if (!is_ifsc_reverified) {
                            account_validation_completed = true;
                        }
                    }
                    if (account_validation_completed) {
                        return res.status(200).json(success(true, apiStatus.BANK_ACCOUNT_VALIDATED, "Bank account is already verified.", null));
                    } else {

                        var is_account_no_valid = false; var account_no_error_msg = ''; var account_no_response = '';

                        // EXTERNAL CALL HERE
                        const acc_no_result = await fetchApigee.validate_bank_acc_number(account_no, account_type, _ifsc_code);
                        is_account_no_valid = acc_no_result.status;
                        account_no_error_msg = acc_no_result.msg;
                        account_no_response = acc_no_result.data;
                        // EXTERNAL CALL HERE

                        if (is_account_no_valid) {
                            const _query3 = `UPDATE temp_bank SET account_no = ?, re_account_no = ?, account_type = ?, consent_provided = true,
                            account_no_validated = true, account_no_valid_date = ?, account_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_query3, { replacements: [account_no, re_account_no, account_type, new Date(), account_no_response, row.temp_id], type: QueryTypes.UPDATE });
                            return res.status(200).json(success(true, res.statusCode, "Bank account verified successfully.", null));
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (account_no_error_msg.length > 0 ? account_no_error_msg : 'Bank account verification failed.'), null));
                        }
                    }
                } else {
                    return res.status(200).json(success(false, res.statusCode, 'IFSC code verification failed.', null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const hasDuplicate = (arrayObj, colName) => {
    var hash = Object.create(null);
    return arrayObj.some((arr) => {
        return arr[colName] && (hash[arr[colName]] || !(hash[arr[colName]] = true));
    });
};

const submit_detail = async (req, res, next) => {
    const {
        entity_id,
        first_name, middle_name, last_name, mobile_ccc, mobile_no, email_id, pan_no,
        company_name, registered_as_id, org_type_id, parent_org_id, address_1, address_2, address_3, country_id, state_id, district_id, block_id,
        pin_code, contact_no, company_pan_no, gstin_no, cin_no, registration_no, it_80g_reg_no, it_12a_reg_no, darpan_reg_no,
        mca_csr_f1_reg_no, fcra_no_with_status, fcra_no_status, expertise_area_ids, fin_audit_rpt_filed, services,
        account_no, re_account_no, account_type, ifsc_code, bank_name, bank_branch,
        user_details, dynamic_values
    } = req.body;
    res.on('finish', () => {
        delete_uploaded_files(req);
    });
    try {
        var _entity_id = entity_id && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        const authKey = req.headers["x-api-key"];
        if (authKey && authKey.length > 0) {
            const row = await registrationModule.temp_master_exists(authKey);
            if (row && _entity_id.toString() == row.entity_id.toString()) {

                const is_reg_complete = await registrationModule.temp_master_registered(row.temp_id);
                if (is_reg_complete == true) {
                    return res.status(200).json(success(false, apiStatus.REMOVE_RESUME_REGISTER, "Registration is already completed.<br><br>Please refresh page.", { tab: 1, }));
                }

                const entity = await commonModule.entity_type_get(_entity_id);
                var form_static_fields = await registrationModule.registration_static_fields(_entity_id);
                const mobile_ccc_list = await commonModule.country_calling_code();

                var _dynamic_values = []; var _dynamic_values_new_array = []; var current_section_field = [];
                if (dynamic_values != null) {
                    if (dynamic_values.constructor == String) {
                        try { _dynamic_values = JSON.parse(dynamic_values); } catch (_) { }
                    } else {
                        if (dynamic_values.constructor == Array) { _dynamic_values = dynamic_values; }
                    }
                }

                // Step 1
                const _first_name = (first_name && first_name.length > 0) ? first_name.trim() : "";
                if (form_static_fields.first_name.visible && form_static_fields.first_name.required) {
                    if (_first_name.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter first name.", { tab: 1, }));
                    }
                }
                if (_first_name.length > 0) {
                    if (_first_name.length < 2) {
                        return res.status(200).json(success(false, res.statusCode, "First name should not be less than 2 characters.", { tab: 1, }));
                    }
                    if (_first_name.length > 30) {
                        return res.status(200).json(success(false, res.statusCode, "First name should not be more than 30 characters.", { tab: 1, }));
                    }
                }
                const _middle_name = (middle_name && middle_name.length > 0) ? middle_name.trim() : "";
                if (form_static_fields.middle_name.visible && form_static_fields.middle_name.required) {
                    if (_middle_name.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter middle name.", { tab: 1, }));
                    }
                }
                if (_middle_name.length > 30) {
                    return res.status(200).json(success(false, res.statusCode, "Middle name should not be more than 30 characters.", { tab: 1, }));
                }
                const _last_name = (last_name && last_name.length > 0) ? last_name.trim() : "";
                if (form_static_fields.last_name.visible && form_static_fields.last_name.required) {
                    if (_last_name.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter last name.", { tab: 1, }));
                    }
                }
                if (_last_name.length > 0) {
                    if (_last_name.length < 2) {
                        return res.status(200).json(success(false, res.statusCode, "Last name should not be less than 2 characters.", { tab: 1, }));
                    }
                    if (_last_name.length > 30) {
                        return res.status(200).json(success(false, res.statusCode, "Last name should not be more than 30 characters.", { tab: 1, }));
                    }
                }

                var _mobile_ccc = (mobile_ccc && mobile_ccc.length > 0) ? mobile_ccc.trim() : "";
                var is_valid_mobile_ccc = false;
                if (_mobile_ccc.length > 0) {
                    for (let cc = 0; cc < mobile_ccc_list.length; cc++) {
                        if (mobile_ccc_list[cc].toLowerCase().trim() == _mobile_ccc.toLowerCase().trim()) {
                            is_valid_mobile_ccc = true; break;
                        }
                    }
                } else {
                    _mobile_ccc = mobile_ccc_list[0]; is_valid_mobile_ccc = true;
                }

                if (!is_valid_mobile_ccc) {
                    return res.status(200).json(success(false, res.statusCode, "Invalid mobile country code.", { tab: 1, }));
                }

                const _mobile_no = (mobile_no && mobile_no.length > 0) ? mobile_no.trim() : "";
                if (_mobile_no.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter mobile number.", { tab: 1, }));
                }
                if (!utils.is_mobile_no(_mobile_no)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct mobile number.", { tab: 1, }));
                }

                const chkMobile = await commonModule.is_mobile_registered(_mobile_no);
                if (chkMobile) {
                    return res.status(200).json(success(false, res.statusCode, "Mobile number is already registered.", { tab: 1, }));
                }

                var mobile_validated = false;
                if (row.mobile_no) {
                    if (_mobile_no == row.mobile_no && (row.mobile_validated && row.mobile_validated == true)) {
                        mobile_validated = true;
                    }
                }
                if (!mobile_validated) {
                    return res.status(200).json(success(false, res.statusCode, "Please verify mobile number with an OTP.", { tab: 1, }));
                }
                const _email_id = (email_id && email_id.length > 0) ? email_id.trim() : "";

                if (_email_id.length <= 0) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter email address.", { tab: 1, }));
                }
                if (!validator.isEmail(_email_id)) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter correct email id.", { tab: 1, }));
                }

                const chkMail = await commonModule.is_email_registered(_email_id);
                if (chkMail) {
                    return res.status(200).json(success(false, res.statusCode, "Email id is already registered.", { tab: 1, }));
                }

                var email_validated = false;
                if (row.email_id) {
                    if (_email_id == row.email_id && (row.email_validated && row.email_validated == true)) {
                        email_validated = true;
                    }
                }
                if (!email_validated) {
                    return res.status(200).json(success(false, res.statusCode, "Please verify email address with an OTP.", { tab: 1, }));
                }
                const _pan_no = (pan_no && pan_no.length > 0) ? pan_no.trim().toUpperCase() : "";
                if (form_static_fields.pan_no.visible) {
                    if (_pan_no.length <= 0 && form_static_fields.pan_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter PAN number.", { tab: 1, }));
                    }
                }
                if (_pan_no.length > 0) {
                    if (!utils.is_pan_no(_pan_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct PAN number.", { tab: 1, }));
                    }
                    const _query3 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:pan_no)`;
                    const row3 = await db.sequelize.query(_query3, { replacements: { pan_no: _pan_no }, type: QueryTypes.SELECT });
                    if (row3 && row3.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "PAN number is already registered.", { tab: 1, }));
                    }
                    var pan_no_validated = false;
                    if (row.pan_no) {
                        if (_pan_no == row.pan_no && (row.pan_no_validated && row.pan_no_validated == true)) {
                            pan_no_validated = true;
                        }
                    }
                    if (!pan_no_validated) {
                        var is_pan_no_valid = false; var pan_error_msg = ''; var pan_no_response = '';
                        // EXTERNAL CALL HERE
                        const pan_result = await fetchApigee.validate_pan_card(_pan_no);
                        is_pan_no_valid = pan_result.status;
                        pan_error_msg = pan_result.msg;
                        pan_no_response = pan_result.data;
                        // EXTERNAL CALL HERE 
                        if (is_pan_no_valid) {
                            const _queryPanInn = `UPDATE temp_master SET pan_no = ?, pan_no_validated = true, pan_no_valid_date = ?, pan_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryPanInn, { replacements: [_pan_no, new Date(), pan_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (pan_error_msg.length > 0 ? pan_error_msg : 'Pan card verification failed.'), { tab: 1, }));
                        }
                    }
                }

                for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                    const eleFld = form_static_fields.dynamic_fields[i];
                    if (eleFld.section_id == 'ID_USER') {
                        current_section_field.push(eleFld.field_id); var fieldData = null;
                        for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                            if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                fieldData = _dynamic_values[j]; break;
                            }
                        }
                        if (fieldData != null) {
                            const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                            if (eleFld.is_required) {
                                if (_user_value.length <= 0) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 1, }));
                                    }
                                }
                            }
                            const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                            if (validation_result.has_error) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 1, }));
                                }
                            }
                            _dynamic_values_new_array.push({
                                field_id: eleFld.field_id,
                                user_value: _user_value,
                            });
                        } else {
                            if (eleFld.is_required) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 1, }));
                                }
                            }
                        }
                    }
                }

                // Step 2
                const _company_name = (company_name && company_name.length > 0) ? company_name.trim() : "";
                if (form_static_fields.company_name.visible) {
                    if (form_static_fields.company_name.required) {
                        if (_company_name.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please enter company name.", { tab: 2, }));
                        }
                    }
                }
                if (_company_name.length > 0) {
                    if (_company_name.length < 5) {
                        return res.status(200).json(success(false, res.statusCode, "Company name should not be less than 5 characters.", { tab: 2, }));
                    }
                    if (_company_name.length > 100) {
                        return res.status(200).json(success(false, res.statusCode, "Company name should not be more than 100 characters.", { tab: 2, }));
                    }
                }
                const _registered_as_id = registered_as_id && validator.isNumeric(registered_as_id.toString()) ? BigInt(registered_as_id) : 0;
                if (form_static_fields.registered_as_id.visible) {
                    if (_registered_as_id <= 0 && form_static_fields.registered_as_id.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please select entity registered as.", { tab: 2, }));
                    }
                }
                if (_registered_as_id > 0) {
                    const reg_types_ = await registrationModule.registration_type(_entity_id);
                    var _exists = false;
                    for (let p = 0; reg_types_ && p < reg_types_.length; p++) {
                        if (reg_types_[p].reg_type_id.toString() == _registered_as_id.toString()) {
                            _exists = true; break;
                        }
                    }
                    if (!_exists) {
                        return res.status(200).json(success(false, res.statusCode, "Invalid entity registered as selected.", { tab: 2, }));
                    }
                }
                const _org_type_id = org_type_id && validator.isNumeric(org_type_id.toString()) ? BigInt(org_type_id) : 0;
                var _parent_org_id = 0;
                if (form_static_fields.parent_orgnization.visible) {
                    if (_org_type_id <= 0 && form_static_fields.parent_orgnization.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please select parent organization.", { tab: 2, }));
                    }
                }
                if (_org_type_id > 0) {
                    const _query1014 = `SELECT m.parent_entity FROM parent_orgs_mast d INNER JOIN parent_orgs_mapp m ON d.org_type_id = m.org_type_id
                    WHERE d.org_type_id = ? AND d.is_enabled = true AND d.is_deleted = false`;
                    const row1014 = await db.sequelize.query(_query1014, { replacements: [_org_type_id], type: QueryTypes.SELECT });
                    if (row1014 && row1014.length > 0) {
                        const select_org_req = (row1014[0].parent_entity && row1014[0].parent_entity.length > 0 ? true : false);
                        if (select_org_req) {
                            _parent_org_id = parent_org_id && validator.isNumeric(parent_org_id.toString()) ? BigInt(parent_org_id) : 0;
                            if (_parent_org_id <= 0) {
                                return res.status(200).json(success(false, res.statusCode, "Please search & select parent entity name.", { tab: 2, }));
                            }
                            const _query1015 = `SELECT u.entity_id FROM user_master u WHERE u.reg_id = ? AND u.is_enabled = true AND u.is_deleted = false AND u.approve_status = 1`;
                            const row1015 = await db.sequelize.query(_query1015, { replacements: [_parent_org_id], type: QueryTypes.SELECT });
                            if (row1015 && row1015.length > 0) {
                                var _is_org_matched = false;
                                for (let opn = 0; row1014[0].parent_entity && opn < row1014[0].parent_entity.length; opn++) {
                                    if (row1014[0].parent_entity[opn].toString() == row1015[0].entity_id.toString()) {
                                        _is_org_matched = true; break;
                                    }
                                }
                                if (!_is_org_matched) {
                                    return res.status(200).json(success(false, res.statusCode, "Invalid parent entity name selected.", { tab: 2, }));
                                }
                            } else {
                                return res.status(200).json(success(false, res.statusCode, "Invalid parent entity name selected.", { tab: 2, }));
                            }
                        }
                    } else {
                        return res.status(200).json(success(false, res.statusCode, "Invalid parent organization selected.", { tab: 2, }));
                    }
                }

                for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                    const eleFld = form_static_fields.dynamic_fields[i];
                    if (eleFld.section_id == 'CD_BASIC') {
                        current_section_field.push(eleFld.field_id); var fieldData = null;
                        for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                            if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                fieldData = _dynamic_values[j]; break;
                            }
                        }
                        if (fieldData != null) {
                            const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                            if (eleFld.is_required) {
                                if (_user_value.length <= 0) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                    }
                                }
                            }
                            const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                            if (validation_result.has_error) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 2, }));
                                }
                            }
                            _dynamic_values_new_array.push({
                                field_id: eleFld.field_id,
                                user_value: _user_value,
                            });
                        } else {
                            if (eleFld.is_required) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                }
                            }
                        }
                    }
                }

                const _address_1 = (address_1 && address_1.length > 0) ? address_1.trim() : "";
                if (form_static_fields.address_1.visible) {
                    if (_address_1.length <= 0 && form_static_fields.address_1.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company address.", { tab: 2, }));
                    }
                }
                const _address_2 = (address_2 && address_2.length > 0) ? address_2.trim() : "";
                if (form_static_fields.address_2.visible) {
                    if (_address_2.length <= 0 && form_static_fields.address_2.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company address.", { tab: 2, }));
                    }
                }
                const _address_3 = (address_3 && address_3.length > 0) ? address_3.trim() : "";
                if (form_static_fields.address_3.visible) {
                    if (_address_3.length <= 0 && form_static_fields.address_3.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company address.", { tab: 2, }));
                    }
                }
                const _country_id = country_id && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
                if (form_static_fields.country_id.visible) {
                    if (_country_id <= 0 && form_static_fields.country_id.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please select country.", { tab: 2, }));
                    }
                }
                const _state_id = state_id && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
                if (form_static_fields.state_id.visible) {
                    if (_state_id <= 0 && form_static_fields.state_id.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please select state/UT.", { tab: 2, }));
                    }
                }
                const _district_id = district_id && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
                if (form_static_fields.district_id.visible) {
                    if (_district_id <= 0 && form_static_fields.district_id.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please select district.", { tab: 2, }));
                    }
                }
                const _block_id = block_id && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;
                if (form_static_fields.block_id.visible) {
                    if (form_static_fields.block_id.required) {
                        if (_block_id <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please select block/taluka.", { tab: 2, }));
                        }
                    }
                }
                const _pin_code = (pin_code && pin_code.length > 0) ? pin_code.trim() : "";
                if (form_static_fields.pin_code.visible) {
                    if (_pin_code.length <= 0 && form_static_fields.pin_code.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter pin code.", { tab: 2, }));
                    }
                }
                if (_pin_code.length > 0) {
                    if (!utils.is_pin_code(_pin_code)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct pin code.", { tab: 2, }));
                    }
                }
                const _contact_no = (contact_no && contact_no.length > 0) ? contact_no.trim() : "";
                if (form_static_fields.contact_no.visible) {
                    if (_contact_no.length <= 0 && form_static_fields.contact_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter landline no. (with STD code).", { tab: 2, }));
                    }
                }

                for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                    const eleFld = form_static_fields.dynamic_fields[i];
                    if (eleFld.section_id == 'CD_ADDR') {
                        current_section_field.push(eleFld.field_id); var fieldData = null;
                        for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                            if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                fieldData = _dynamic_values[j]; break;
                            }
                        }
                        if (fieldData != null) {
                            const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                            if (eleFld.is_required) {
                                if (_user_value.length <= 0) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                    }
                                }
                            }
                            const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                            if (validation_result.has_error) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 2, }));
                                }
                            }
                            _dynamic_values_new_array.push({
                                field_id: eleFld.field_id,
                                user_value: _user_value,
                            });
                        } else {
                            if (eleFld.is_required) {
                                if (validate_dynamic_field_on_reg) {
                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 2, }));
                                }
                            }
                        }
                    }
                }

                // Step 3 - 1

                const _company_pan_no = (company_pan_no && company_pan_no.length > 0) ? company_pan_no.trim().toUpperCase() : "";
                if (form_static_fields.company_pan_no.visible) {
                    if (_company_pan_no.length <= 0 && form_static_fields.company_pan_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company PAN number.", { tab: 2, }));
                    }
                }
                if (_company_pan_no.length > 0) {
                    if (!utils.is_pan_no(_company_pan_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct company PAN number.", { tab: 2, }));
                    }
                    const _query4 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:company_pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:company_pan_no)`;
                    const row4 = await db.sequelize.query(_query4, { replacements: { company_pan_no: _company_pan_no }, type: QueryTypes.SELECT });
                    if (row4 && row4.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Company PAN number is already registered.", { tab: 2, }));
                    }
                    var company_pan_no_validated = false;
                    if (row.company_pan_no) {
                        if (_company_pan_no == row.company_pan_no && (row.company_pan_no_validated && row.company_pan_no_validated == true)) {
                            company_pan_no_validated = true;
                        }
                    }
                    if (!company_pan_no_validated) {
                        var company_pan_no_valid = false; var company_pan_error_msg = ''; var company_pan_no_response = '';
                        // EXTERNAL CALL HERE
                        const pan_result = await fetchApigee.validate_pan_card(_company_pan_no);
                        company_pan_no_valid = pan_result.status;
                        company_pan_error_msg = pan_result.msg;
                        company_pan_no_response = pan_result.data;
                        // EXTERNAL CALL HERE 
                        if (company_pan_no_valid) {
                            const _queryCmpPanInn = `UPDATE temp_master SET company_pan_no = ?, company_pan_no_validated = true, company_pan_no_valid_date = ?, company_pan_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryCmpPanInn, { replacements: [_company_pan_no, new Date(), company_pan_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (company_pan_error_msg.length > 0 ? company_pan_error_msg : 'Company PAN verification failed.'), { tab: 2, }));
                        }
                    }
                }
                const _gstin_no = (gstin_no && gstin_no.length > 0) ? gstin_no.trim().toUpperCase() : "";
                if (form_static_fields.gstin_no.visible) {
                    if (_gstin_no.length <= 0 && form_static_fields.gstin_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter GSTIN number.", { tab: 2, }));
                    }
                }
                if (_gstin_no.length > 0) {
                    if (!utils.is_gstn_no(_gstin_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct GSTIN number.", { tab: 2, }));
                    }
                    const _query5 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.gstin_no, '')) > 0 AND LOWER(u.gstin_no) = LOWER(:gstin_no)`;
                    const row5 = await db.sequelize.query(_query5, { replacements: { gstin_no: _gstin_no }, type: QueryTypes.SELECT });
                    if (row5 && row5.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "GSTIN number is already registered.", { tab: 2, }));
                    }
                    var gstin_no_validated = false;
                    if (_gstin_no == row.gstin_no && (row.gstin_no_validated && row.gstin_no_validated == true)) {
                        gstin_no_validated = true;
                    }
                    if (!gstin_no_validated) {
                        var is_gstin_no_valid = false; var gstin_error_msg = ''; var gstin_no_response = '';
                        // EXTERNAL CALL HERE
                        const gstin_result = await fetchApigee.validate_gstin_no(_gstin_no);
                        is_gstin_no_valid = gstin_result.status;
                        gstin_error_msg = gstin_result.msg;
                        gstin_no_response = gstin_result.data;
                        // EXTERNAL CALL HERE
                        if (is_gstin_no_valid) {
                            const _queryGstinInn = `UPDATE temp_master SET gstin_no = ?, gstin_no_validated = true, gstin_no_valid_date = ?, gstin_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryGstinInn, { replacements: [_gstin_no, new Date(), gstin_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (gstin_error_msg.length > 0 ? gstin_error_msg : 'GSTIN number verification failed.'), { tab: 2, }));
                        }
                    }
                }
                const _cin_no = (cin_no && cin_no.length > 0) ? cin_no.trim().toUpperCase() : "";
                if (form_static_fields.cin_no.visible) {
                    if (_cin_no.length <= 0 && form_static_fields.cin_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter company identification number.", { tab: 2, }));
                    }
                }
                if (_cin_no.length > 0) {
                    if (!utils.is_cin_no(_cin_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct company identification number.", { tab: 2, }));
                    }
                    const _query6 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.cin_no, '')) > 0 AND LOWER(u.cin_no) = LOWER(:cin_no)`;
                    const row6 = await db.sequelize.query(_query6, { replacements: { cin_no: _cin_no }, type: QueryTypes.SELECT });
                    if (row6 && row6.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Company identification number is already registered.", { tab: 2, }));
                    }
                    var cin_no_validated = false;
                    if (row.cin_no) {
                        if (_cin_no == row.cin_no && (row.cin_no_validated && row.cin_no_validated == true)) {
                            cin_no_validated = true;
                        }
                    }
                    if (!cin_no_validated) {
                        var is_cin_no_valid = false; var cin_error_msg = ''; var cin_no_response = '';
                        // EXTERNAL CALL HERE
                        const cin_result = await fetchApigee.validate_cin_no(_cin_no);
                        is_cin_no_valid = cin_result.status;
                        cin_error_msg = cin_result.msg;
                        cin_no_response = cin_result.data;
                        // EXTERNAL CALL HERE
                        if (is_cin_no_valid) {
                            const _queryCinInn = `UPDATE temp_master SET cin_no = ?, cin_no_validated = true, cin_no_valid_date = ?, cin_no_response = ? WHERE temp_id = ?`;
                            await db.sequelize.query(_queryCinInn, { replacements: [_cin_no, new Date(), cin_no_response, row.temp_id], type: QueryTypes.UPDATE });
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (cin_error_msg.length > 0 ? cin_error_msg : 'Company identification number verification failed.'), { tab: 2, }));
                        }
                    }
                }
                const _registration_no = (registration_no && registration_no.length > 0) ? registration_no.trim() : "";
                if (form_static_fields.registration_no.visible) {
                    if (form_static_fields.registration_no.required) {
                        if (_registration_no.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please enter registration number.", { tab: 2, }));
                        }
                    }
                }
                if (_registration_no.length > 0) {
                    // if (_registration_no.length < 5) {
                    //     return res.status(200).json(success(false, res.statusCode, "Registration number should not be less than 5 characters.", { tab: 2, }));
                    // }
                    // if (_registration_no.length > 20) {
                    //     return res.status(200).json(success(false, res.statusCode, "Registration number should not be more than 20 characters.", { tab: 2, }));
                    // }
                    const _query501 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.registration_no, '')) > 0 AND LOWER(u.registration_no) = LOWER(:registration_no)`;
                    const row501 = await db.sequelize.query(_query501, { replacements: { registration_no: _registration_no }, type: QueryTypes.SELECT });
                    if (row501 && row501.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Registration number is already registered.", { tab: 2, }));
                    }
                }
                const _it_80g_reg_no = (it_80g_reg_no && it_80g_reg_no.length > 0) ? it_80g_reg_no.trim() : "";
                if (form_static_fields.it_80g_reg_no.visible) {
                    if (_it_80g_reg_no.length <= 0 && form_static_fields.it_80g_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter income tax 18G registration no.", { tab: 2, }));
                    }
                }
                if (_it_80g_reg_no.length > 0) {
                    // if (_it_80g_reg_no.length < 5) {
                    //     return res.status(200).json(success(false, res.statusCode, "Income tax 18G registration no should not be less than 5 characters.", { tab: 2, }));
                    // }
                    // if (_it_80g_reg_no.length > 20) {
                    //     return res.status(200).json(success(false, res.statusCode, "Income tax 18G registration no should not be more than 20 characters.", { tab: 2, }));
                    // }

                    const _query502 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.it_80g_reg_no, '')) > 0 AND LOWER(u.it_80g_reg_no) = LOWER(:it_80g_reg_no)`;
                    const row502 = await db.sequelize.query(_query502, { replacements: { it_80g_reg_no: _it_80g_reg_no }, type: QueryTypes.SELECT });
                    if (row502 && row502.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Income tax 18G registration no. is already registered.", { tab: 2, }));
                    }
                }
                const _it_12a_reg_no = (it_12a_reg_no && it_12a_reg_no.length > 0) ? it_12a_reg_no.trim() : "";
                if (form_static_fields.it_12a_reg_no.visible) {
                    if (_it_12a_reg_no.length <= 0 && form_static_fields.it_12a_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter income tax 12A registration no.", { tab: 2, }));
                    }
                }
                if (_it_12a_reg_no.length > 0) {
                    // if (_it_12a_reg_no.length < 5) {
                    //     return res.status(200).json(success(false, res.statusCode, "Income tax 12A registration no should not be less than 5 characters.", { tab: 2, }));
                    // }
                    // if (_it_12a_reg_no.length > 20) {
                    //     return res.status(200).json(success(false, res.statusCode, "Income tax 12A registration no should not be more than 20 characters.", { tab: 2, }));
                    // }

                    const _query503 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.it_12a_reg_no, '')) > 0 AND LOWER(u.it_12a_reg_no) = LOWER(:it_12a_reg_no)`;
                    const row503 = await db.sequelize.query(_query503, { replacements: { it_12a_reg_no: _it_12a_reg_no }, type: QueryTypes.SELECT });
                    if (row503 && row503.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Income tax 12A registration no. is already registered.", { tab: 2, }));
                    }
                }
                const _darpan_reg_no = (darpan_reg_no && darpan_reg_no.length > 0) ? darpan_reg_no.trim() : "";
                if (form_static_fields.darpan_reg_no.visible) {
                    if (_darpan_reg_no.length <= 0 && form_static_fields.darpan_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter NGO DARPAN registration no/id.", { tab: 2, }));
                    }
                }
                if (_darpan_reg_no.length > 0) {
                    // if (_darpan_reg_no.length < 5) {
                    //     return res.status(200).json(success(false, res.statusCode, "NGO DARPAN registration no/id should not be less than 5 characters.", { tab: 2, }));
                    // }
                    // if (_darpan_reg_no.length > 20) {
                    //     return res.status(200).json(success(false, res.statusCode, "NGO DARPAN registration no/id should not be more than 20 characters.", { tab: 2, }));
                    // }
                    const _query504 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.darpan_reg_no, '')) > 0 AND LOWER(u.darpan_reg_no) = LOWER(:darpan_reg_no)`;
                    const row504 = await db.sequelize.query(_query504, { replacements: { darpan_reg_no: _darpan_reg_no }, type: QueryTypes.SELECT });
                    if (row504 && row504.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "NGO DARPAN registration no/id is already registered.", { tab: 2, }));
                    }
                }
                const _mca_csr_f1_reg_no = (mca_csr_f1_reg_no && mca_csr_f1_reg_no.length > 0) ? mca_csr_f1_reg_no.trim() : "";
                if (form_static_fields.mca_csr_f1_reg_no.visible) {
                    if (_mca_csr_f1_reg_no.length <= 0 && form_static_fields.mca_csr_f1_reg_no.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter MCA CSR form 1 registration no.", { tab: 2, }));
                    }
                }
                if (_mca_csr_f1_reg_no.length > 0) {
                    const _query505 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.mca_csr_f1_reg_no, '')) > 0 AND LOWER(u.mca_csr_f1_reg_no) = LOWER(:mca_csr_f1_reg_no)`;
                    const row505 = await db.sequelize.query(_query505, { replacements: { mca_csr_f1_reg_no: _mca_csr_f1_reg_no }, type: QueryTypes.SELECT });
                    if (row505 && row505.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "MCA CSR form 1 registration no. is already registered.", { tab: 2, }));
                    }
                }
                const _fcra_no_with_status = (fcra_no_with_status && fcra_no_with_status.length > 0) ? fcra_no_with_status.trim() : "";
                const _fcra_no_status = (fcra_no_status && fcra_no_status.toString().toLowerCase() == 'true') ? true : false;

                var _expertise_area_ids = [];
                if (form_static_fields.expertise_area_id.visible) {
                    if (expertise_area_ids && expertise_area_ids.length > 0) {
                        const expertise_area_ids_list = expertise_area_ids.split(',').join('|');
                        const expertise_area_ids_array = expertise_area_ids_list.split('|');
                        for (let ax = 0; expertise_area_ids_array && ax < expertise_area_ids_array.length; ax++) {
                            var _ax = expertise_area_ids_array[ax] && validator.isNumeric(expertise_area_ids_array[ax].toString()) ? BigInt(expertise_area_ids_array[ax]) : 0;
                            if (_ax > 0) {
                                _expertise_area_ids.push(_ax);
                            }
                        }
                    }
                    if (_expertise_area_ids.length <= 0 && form_static_fields.expertise_area_id.required) {
                        return res.status(200).json(success(false, res.statusCode, "Please select area of expertise.", { tab: 2, }));
                    }
                }
                if (_expertise_area_ids.length > 0) {
                    const expertise_areas_ = await registrationModule.expertise_area(_entity_id);
                    for (let ti = 0; _expertise_area_ids && ti < _expertise_area_ids.length; ti++) {
                        var _exists = false;
                        for (let ii = 0; expertise_areas_ && ii < expertise_areas_.length; ii++) {
                            if (expertise_areas_[ii].expertise_area_id.toString() == _expertise_area_ids[ti].toString()) {
                                _exists = true; break;
                            }
                        }
                        if (!_exists) {
                            return res.status(200).json(success(false, res.statusCode, "Invalid area of expertise selected.", { tab: 2, }));
                        }
                    }
                }
                const _fin_audit_rpt_filed = (fin_audit_rpt_filed && fin_audit_rpt_filed.toString().toLowerCase() == 'true') ? true : false;

                if (form_static_fields.flow_by_reg_type_id) {
                    for (let pf = 0; form_static_fields.reg_type_flow_data && pf < form_static_fields.reg_type_flow_data.length; pf++) {
                        if (form_static_fields.reg_type_flow_data[pf].reg_type_id.toString() == _registered_as_id.toString()) {
                            const tmpDynFormField = form_static_fields.reg_type_flow_data[pf].field_data.dynamic_fields;
                            for (let i = 0; i < tmpDynFormField.length; i++) {
                                const eleFld = tmpDynFormField[i];
                                if (eleFld.section_id == 'ED_IDN' && eleFld.reg_type == true) {
                                    current_section_field.push(eleFld.field_id); var fieldData = null;
                                    for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                                        if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                            fieldData = _dynamic_values[j]; break;
                                        }
                                    }
                                    if (fieldData != null) {
                                        const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                                        if (eleFld.is_required) {
                                            if (_user_value.length <= 0) {
                                                if (validate_dynamic_field_on_reg) {
                                                    return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                                }
                                            }
                                        }
                                        const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                                        if (validation_result.has_error) {
                                            if (validate_dynamic_field_on_reg) {
                                                return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 3, }));
                                            }
                                        }
                                        _dynamic_values_new_array.push({
                                            field_id: eleFld.field_id,
                                            user_value: _user_value,
                                        });
                                    } else {
                                        if (eleFld.is_required) {
                                            if (validate_dynamic_field_on_reg) {
                                                return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                        }
                    }

                    for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                        const eleFld = form_static_fields.dynamic_fields[i];
                        if (eleFld.section_id == 'ED_IDN' && eleFld.reg_type == false) {
                            current_section_field.push(eleFld.field_id); var fieldData = null;
                            for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                                if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                    fieldData = _dynamic_values[j]; break;
                                }
                            }
                            if (fieldData != null) {
                                const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                                if (eleFld.is_required) {
                                    if (_user_value.length <= 0) {
                                        if (validate_dynamic_field_on_reg) {
                                            return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                        }
                                    }
                                }
                                const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                                if (validation_result.has_error) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 3, }));
                                    }
                                }
                                _dynamic_values_new_array.push({
                                    field_id: eleFld.field_id,
                                    user_value: _user_value,
                                });
                            } else {
                                if (eleFld.is_required) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                    }
                                }
                            }
                        }
                    }

                } else {
                    for (let i = 0; form_static_fields.dynamic_fields && i < form_static_fields.dynamic_fields.length; i++) {
                        const eleFld = form_static_fields.dynamic_fields[i];
                        if (eleFld.section_id == 'ED_IDN') {
                            current_section_field.push(eleFld.field_id); var fieldData = null;
                            for (let j = 0; _dynamic_values && j < _dynamic_values.length; j++) {
                                if (_dynamic_values[j].field_id.toString() == eleFld.field_id.toString()) {
                                    fieldData = _dynamic_values[j]; break;
                                }
                            }
                            if (fieldData != null) {
                                const _user_value = fieldData.user_value != null && fieldData.user_value.length > 0 ? fieldData.user_value.trim() : "";
                                if (eleFld.is_required) {
                                    if (_user_value.length <= 0) {
                                        if (validate_dynamic_field_on_reg) {
                                            return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                        }
                                    }
                                }
                                const validation_result = utils.check_field_validations_skip_req(eleFld.validations, _user_value, eleFld.field_type, eleFld.field_values, eleFld.lable_name);
                                if (validation_result.has_error) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, validation_result.error_msg, { tab: 3, }));
                                    }
                                }
                                _dynamic_values_new_array.push({
                                    field_id: eleFld.field_id,
                                    user_value: _user_value,
                                });
                            } else {
                                if (eleFld.is_required) {
                                    if (validate_dynamic_field_on_reg) {
                                        return res.status(200).json(success(false, res.statusCode, utils.capabilities_first_letter(eleFld.lable_name) + ' is mandatory.', { tab: 3, }));
                                    }
                                }
                            }
                        }
                    }
                }

                var _services = [];
                if (form_static_fields.tab_services.visible) {
                    var services_data = await registrationModule.services_data(_entity_id, form_static_fields.tab_services.visible);
                    var _tmpServices = [];
                    if (services.constructor == String) {
                        try { _tmpServices = JSON.parse(services); } catch (_) { }
                    } else {
                        if (services != null) { _tmpServices = services; }
                    }
                    for (let s_i = 0; _tmpServices && s_i < _tmpServices.length; s_i++) {
                        const sEle = _tmpServices[s_i]; var is_exists = false; var cat_name = ''; var service_name = '';
                        for (let i = 0; services_data && i < services_data.length; i++) {
                            for (let j = 0; services_data[i].category && j < services_data[i].category.length; j++) {
                                for (let k = 0; services_data[i].category[j].sub_category && k < services_data[i].category[j].sub_category.length; k++) {
                                    if (services_data[i].category[j].sub_category[k].id.toString() == sEle.id.toString()) {
                                        cat_name = services_data[i].category[j].name;
                                        service_name = services_data[i].category[j].sub_category[k].name; is_exists = true;
                                        break;
                                    }
                                }
                                if (is_exists) { break; }
                            }
                            if (is_exists) { break; }
                        }
                        if (!is_exists) {
                            return res.status(200).json(success(false, res.statusCode, "Invalid service selected, Please check.", { tab: 3, }));
                        }
                        var amt = 0; try { amt = parseFloat(sEle.price); amt = parseFloat(amt.toFixed(2)); } catch (_) { }
                        if (amt <= 0) {
                            return res.status(200).json(success(false, res.statusCode, `Please enter price for service ${cat_name}(${service_name}).`, { tab: 3, }));
                        }
                        _services.push({
                            id: sEle.id,
                            size: sEle.size,
                            price: amt,
                        });
                    }
                    if (form_static_fields.tab_services.required) {
                        if (_services.length <= 0) {
                            return res.status(200).json(success(false, res.statusCode, "Please select services you will provide.", { tab: 3, }));
                        }
                    }
                }
                if (_services && _services.length > 0) {
                    var tmpSerID = [];
                    for (let i = 0; i < _services.length; i++) {
                        var rowSer = await registrationModule.temp_service_exists(row.temp_id, _services[i].id);
                        if (rowSer) {
                            const _query952 = `UPDATE temp_services SET range_size = ?, price = ? WHERE t_id = ?`;
                            await db.sequelize.query(_query952, { replacements: [_services[i].size, _services[i].price, rowSer.t_id], type: QueryTypes.UPDATE });
                            tmpSerID.push(rowSer.t_id);
                        } else {
                            const _query953 = `INSERT INTO temp_services(temp_id, sub_cat_id, range_size, price) VALUES (?, ?, ?, ?) RETURNING "t_id"`;
                            const _replacements953 = [row.temp_id, _services[i].id, _services[i].size, _services[i].price];
                            const [rowOut953] = await db.sequelize.query(_query953, { replacements: _replacements953, type: QueryTypes.INSERT });
                            const t_id = (rowOut953 && rowOut953.length > 0 && rowOut953[0] ? rowOut953[0].t_id : 0);
                            if (t_id > 0) {
                                tmpSerID.push(t_id);
                            }
                        }
                    }
                    if (tmpSerID.length > 0) {
                        const _query954 = `DELETE FROM temp_services WHERE temp_id = ? AND t_id NOT IN (?)`;
                        await db.sequelize.query(_query954, { replacements: [row.temp_id, tmpSerID], type: QueryTypes.DELETE });
                    } else {
                        const _query954 = `DELETE FROM temp_services WHERE temp_id = ?`;
                        await db.sequelize.query(_query954, { replacements: [row.temp_id], type: QueryTypes.DELETE });
                    }
                } else {
                    const _query951 = `DELETE FROM temp_services WHERE temp_id = ?`;
                    await db.sequelize.query(_query951, { replacements: [row.temp_id], type: QueryTypes.DELETE });
                }

                // Step 3 - 2

                var documentRequired = await registrationModule.documents(_entity_id);
                if (documentRequired && documentRequired.length > 0) {
                    for (let i = 0; i < documentRequired.length; i++) {
                        if (form_static_fields.flow_by_reg_type_id) {
                            for (let tt = 0; tt < form_static_fields.reg_type_flow_data.length; tt++) {
                                if (form_static_fields.reg_type_flow_data[tt].reg_type_id.toString() == _registered_as_id.toString()) {
                                    for (let ti = 0; ti < form_static_fields.reg_type_flow_data[tt].field_data.document_list.length; ti++) {
                                        const docEle = form_static_fields.reg_type_flow_data[tt].field_data.document_list[ti];
                                        if (docEle.document_id.toString() == documentRequired[i].document_id.toString()) {
                                            documentRequired[i].is_required = docEle.is_required;
                                            break;
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                        const file_name_to_check = 'doc_' + documentRequired[i].document_id.toString();
                        var is_file_exists = false; var file_json_data = null;
                        for (let j = 0; req.files && j < req.files.length; j++) {
                            if (req.files[j].fieldname.toLowerCase() == file_name_to_check.toLowerCase()) {
                                file_json_data = req.files[j]; is_file_exists = true; break;
                            }
                        }
                        if (documentRequired[i].is_required && !is_file_exists) {
                            return res.status(200).json(success(false, res.statusCode, "Please upload required document.<br><br>" + documentRequired[i].doc_name, { tab: 2, }));
                        }
                        if (is_file_exists) {
                            const ext = file_json_data.originalname.substr(file_json_data.originalname.lastIndexOf('.')).toLowerCase();
                            if (!utils.check_in_array(ext, documentRequired[i].file_type_allowed)) {
                                return res.status(200).json(success(false, res.statusCode, "Please check file format for document<br>\"" + documentRequired[i].doc_name + "\"<br><br>Supported formats are: " + documentRequired[i].file_type_allowed.join(', '), { tab: 2, }));
                            }
                            const file_size_in_kb = file_json_data.size / 1024;
                            if (file_size_in_kb > documentRequired[i].file_max_size) {
                                const readable = utils.bytes_to_readable(documentRequired[i].file_max_size * 1024);
                                return res.status(200).json(success(false, res.statusCode, "Please check file size for document<br>\"" + documentRequired[i].doc_name + "\"<br><br>Maximum file size limit is " + readable, { tab: 2, }));
                            }
                        }
                    }
                }

                // Step 3 - 3
                var _account_no = ""; var _re_account_no = ""; var _account_type = ""; var _ifsc_code = ""; var _bank_name = ""; var _bank_branch = "";
                if (form_static_fields.tab_bank_details.visible) {
                    _account_no = (account_no && account_no.length > 0) ? account_no.trim() : "";
                    if (_account_no.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter bank account number.", { tab: 3, }));
                    }
                    if (!utils.is_bank_account_no(_account_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Invalid bank account number.", { tab: 3, }));
                    }
                    _re_account_no = (re_account_no && re_account_no.length > 0) ? re_account_no.trim() : "";
                    if (_re_account_no.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please re-enter bank account number.", { tab: 3, }));
                    }
                    if (!utils.is_bank_account_no(_re_account_no)) {
                        return res.status(200).json(success(false, res.statusCode, "Invalid re-enter bank account number.", { tab: 3, }));
                    }
                    if (_account_no != _re_account_no) {
                        return res.status(200).json(success(false, res.statusCode, "Bank account number does not matched.", { tab: 3, }));
                    }
                    _account_type = account_type && validator.isNumeric(account_type.toString()) ? parseInt(account_type) : 0;
                    if (_account_type <= 0 && account_type && account_type.length > 0) {
                        if (account_type.trim().toLowerCase() == 'saving') { _account_type = 1; }
                        if (account_type.trim().toLowerCase() == 'current') { _account_type = 2; }
                    }
                    if (_account_type <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please select account type.", { tab: 3, }));
                    }
                    if (!utils.check_in_array(_account_type, [1, 2])) {
                        return res.status(200).json(success(false, res.statusCode, "Account type must be Saving(1) or Current(2).", { tab: 3, }));
                    }
                    _ifsc_code = (ifsc_code && ifsc_code.length > 0) ? ifsc_code.trim().toUpperCase() : "";
                    if (_ifsc_code.length <= 0) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter IFSC code.", { tab: 3, }));
                    }
                    if (!utils.is_ifsc_code(_ifsc_code)) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter correct IFSC code.", { tab: 3, }));
                    }
                    var rowBank = await registrationModule.temp_bank_exists(row.temp_id);
                    var is_ifsc_validation_completed = false; var is_ifsc_reverified = true;
                    if (rowBank) {
                        if (_ifsc_code == rowBank.ifsc_code &&
                            (rowBank.ifsc_code_validated && rowBank.ifsc_code_validated == true)) {
                            is_ifsc_validation_completed = true; is_ifsc_reverified = false;
                        } else {
                            var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';
                            // EXTERNAL CALL HERE
                            const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                            is_ifsc_valid = ifsc_result.status;
                            ifsc_error_msg = ifsc_result.msg;
                            ifsc_response = ifsc_result.data;
                            // EXTERNAL CALL HERE
                            if (is_ifsc_valid) {
                                try {
                                    const tempJson = JSON.parse(ifsc_response);
                                    _bank_name = tempJson.bank;
                                    _bank_branch = tempJson.branch;
                                } catch (_) {
                                }
                                const _query7 = `UPDATE temp_bank SET ifsc_code = ?, bank_other = ?, branch_other = ?, ifsc_code_validated = true,
                                ifsc_code_valid_date = ?, ifsc_code_response = ? WHERE temp_id = ?`;
                                await db.sequelize.query(_query7, { replacements: [_ifsc_code, _bank_name, _bank_branch, new Date(), ifsc_response, row.temp_id], type: QueryTypes.UPDATE });
                                is_ifsc_validation_completed = true;
                            } else {
                                return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), { tab: 3, }));
                            }
                        }
                    } else {
                        var is_ifsc_valid = false; var ifsc_error_msg = ''; var ifsc_response = '';
                        // EXTERNAL CALL HERE
                        const ifsc_result = await fetchApigee.validate_ifsc_code(_ifsc_code);
                        is_ifsc_valid = ifsc_result.status;
                        ifsc_error_msg = ifsc_result.msg;
                        ifsc_response = ifsc_result.data;
                        // EXTERNAL CALL HERE
                        if (is_ifsc_valid) {
                            try {
                                const tempJson = JSON.parse(ifsc_response);
                                _bank_name = tempJson.bank;
                                _bank_branch = tempJson.branch;
                            } catch (_) {
                            }
                            const _query8 = `INSERT INTO temp_bank(temp_id, ifsc_code, bank_other, branch_other, ifsc_code_validated, ifsc_code_valid_date,
                                ifsc_code_response) VALUES(?, ?, ?, ?, ?, ?, ?)`;
                            await db.sequelize.query(_query8, { replacements: [row.temp_id, _ifsc_code, _bank_name, _bank_branch, true, new Date(), ifsc_response], type: QueryTypes.INSERT });
                            is_ifsc_validation_completed = true;
                        } else {
                            return res.status(200).json(success(false, res.statusCode, (ifsc_error_msg.length > 0 ? ifsc_error_msg : 'IFSC code verification failed.'), { tab: 3, }));
                        }
                    }
                    if (is_ifsc_validation_completed) {
                        if (is_ifsc_reverified) {
                            rowBank = await registrationModule.temp_bank_exists(row.temp_id);
                        }
                        var account_validation_completed = false;
                        if (rowBank.account_no && _account_no == rowBank.account_no &&
                            (rowBank.account_no_validated && rowBank.account_no_validated == true)) {
                            if (!is_ifsc_reverified) {
                                account_validation_completed = true;
                            }
                        }
                        if (!account_validation_completed) {
                            var is_account_no_valid = false; var account_no_error_msg = ''; var account_no_response = '';
                            // EXTERNAL CALL HERE
                            const acc_no_result = await fetchApigee.validate_bank_acc_number(_account_no, _account_type, _ifsc_code);
                            is_account_no_valid = acc_no_result.status;
                            account_no_error_msg = acc_no_result.msg;
                            account_no_response = acc_no_result.data;
                            // EXTERNAL CALL HERE
                            if (is_account_no_valid) {
                                const _query9 = `UPDATE temp_bank SET account_no = ?, re_account_no = ?, account_type = ?, consent_provided = true,
                                account_no_validated = true, account_no_valid_date = ?, account_no_response = ? WHERE temp_id = ?`;
                                await db.sequelize.query(_query9, { replacements: [_account_no, _re_account_no, _account_type, new Date(), account_no_response, row.temp_id], type: QueryTypes.UPDATE });
                            } else {
                                return res.status(200).json(success(false, res.statusCode, (account_no_error_msg.length > 0 ? account_no_error_msg : 'Bank account verification failed.'), { tab: 3, }));
                            }
                        }
                    }
                    else {
                        return res.status(200).json(success(false, res.statusCode, 'IFSC code verification failed.', { tab: 3, }));
                    }
                }
                else {
                    const _query801 = `DELETE FROM temp_bank WHERE temp_id = ?`;
                    await db.sequelize.query(_query801, { replacements: [row.temp_id], type: QueryTypes.DELETE });
                }

                // Dynamic value update
                var updatedFieldToDB = [];
                for (let dv = 0; _dynamic_values_new_array && dv < _dynamic_values_new_array.length; dv++) {
                    const eleVal = _dynamic_values_new_array[dv];
                    const _queryChkField = `SELECT temp_id FROM temp_field_values WHERE temp_id = ? AND static_field_id = ?`;
                    const rowChkField = await db.sequelize.query(_queryChkField, { replacements: [row.temp_id, eleVal.field_id], type: QueryTypes.SELECT });
                    if (rowChkField && rowChkField.length > 0) {
                        const _queryFieldUp = `UPDATE temp_field_values SET user_value = ? WHERE temp_id = ? AND static_field_id = ?`;
                        await db.sequelize.query(_queryFieldUp, { replacements: [eleVal.user_value, row.temp_id, eleVal.field_id], type: QueryTypes.UPDATE });
                    } else {
                        const _queryFieldIn = `INSERT INTO temp_field_values(temp_id, static_field_id, user_value) VALUES(?, ?, ?)`;
                        await db.sequelize.query(_queryFieldIn, { replacements: [row.temp_id, eleVal.field_id, eleVal.user_value], type: QueryTypes.INSERT });
                    }
                    updatedFieldToDB.push(eleVal.field_id);
                }
                const _queryFieldDel = `DELETE FROM temp_field_values WHERE temp_id = ?  ${(updatedFieldToDB.length > 0 ? ' AND static_field_id NOT IN (?)' : '')}`;
                var _replFieldDel = [row.temp_id]; if (updatedFieldToDB.length > 0) { _replFieldDel.push(updatedFieldToDB); }
                await db.sequelize.query(_queryFieldDel, { replacements: _replFieldDel, type: QueryTypes.DELETE });

                // Step 4               
                var _user_details = null; var has_valid_users = false; var _isNoUserReg = false;
                const designations_ = await registrationModule.designations(_entity_id);
                if (form_static_fields.tab_user_details.visible) {
                    if (user_details.constructor == String) {
                        try { _user_details = JSON.parse(user_details); } catch (_) { }
                    } else {
                        if (user_details != null) { _user_details = user_details; }
                    }
                    if (!_user_details) {
                        return res.status(200).json(success(false, res.statusCode, "Please enter admin user details.", { tab: 4, }));
                    }
                    if (_user_details.constructor != Array) {
                        return res.status(200).json(success(false, res.statusCode, "Admin user details must be an array.", { tab: 4, }));
                    }
                    if (_user_details.length >= 2) {
                        for (let i = 0; i < _user_details.length; i++) {
                            const usr = _user_details[i];

                            if (!usr.first_name || usr.first_name.length <= 0) {
                                return res.status(200).json(success(false, res.statusCode, "Please enter first name for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            if (!usr.last_name || usr.last_name.length <= 0) {
                                return res.status(200).json(success(false, res.statusCode, "Please enter last name for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            var tmpDesigID = usr.designation && validator.isNumeric(usr.designation.toString()) ? BigInt(usr.designation) : 0;
                            if (tmpDesigID <= 0) {
                                return res.status(200).json(success(false, res.statusCode, "Please select designation for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            if (!usr.email_id || usr.email_id.length <= 0) {
                                return res.status(200).json(success(false, res.statusCode, "Please enter email id for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            if (!validator.isEmail(usr.email_id)) {
                                return res.status(200).json(success(false, res.statusCode, "Please enter correct email id for admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            const _chkUsrMail = await commonModule.is_email_registered(usr.email_id);
                            if (_chkUsrMail) {
                                return res.status(200).json(success(false, res.statusCode, "Email id is already registered of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }

                            var _adm_mobile_ccc = (usr.mobile_ccc && usr.mobile_ccc.length > 0) ? usr.mobile_ccc.trim() : "";
                            var is_valid_adm_mobile_ccc = false;
                            if (_adm_mobile_ccc.length > 0) {
                                for (let cc = 0; cc < mobile_ccc_list.length; cc++) {
                                    if (mobile_ccc_list[cc].toLowerCase().trim() == _adm_mobile_ccc.toLowerCase().trim()) {
                                        is_valid_adm_mobile_ccc = true; break;
                                    }
                                }
                            } else {
                                _adm_mobile_ccc = mobile_ccc_list[0]; is_valid_adm_mobile_ccc = true;
                            }
                            if (!is_valid_adm_mobile_ccc) {
                                return res.status(200).json(success(false, res.statusCode, "Invalid mobile country code of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            _user_details[i].mobile_ccc = _adm_mobile_ccc;
                            if (!usr.mobile_no || usr.mobile_no.length <= 0) {
                                return res.status(200).json(success(false, res.statusCode, "Please enter mobile number of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            if (!utils.is_mobile_no(usr.mobile_no)) {
                                return res.status(200).json(success(false, res.statusCode, "Please enter correct mobile number of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }
                            const _chkUsrMobile = await commonModule.is_mobile_registered(usr.mobile_no);
                            if (_chkUsrMobile) {
                                return res.status(200).json(success(false, res.statusCode, "Mobile number is already registered of admin user " + (i + 1).toString() + ".", { tab: 4, }));
                            }

                            var _exists__ = false;
                            for (let di = 0; designations_ && di < designations_.length; di++) {
                                if (designations_[di].design_id.toString() == tmpDesigID.toString()) {
                                    _exists__ = true; break;
                                }
                            }
                            if (!_exists__) {
                                return res.status(200).json(success(false, res.statusCode, "Invalid designation for admin user " + (i + 1).toString() + " selected.", { tab: 4, }));
                            }
                        }
                        var both_user_has_same_email = hasDuplicate(_user_details, "email_id");
                        if (both_user_has_same_email) {
                            return res.status(200).json(success(false, res.statusCode, "Admin user details have same email address.", { tab: 4, }));
                        }
                        var both_user_has_same_mobile = hasDuplicate(_user_details, "mobile_no");
                        if (both_user_has_same_mobile) {
                            return res.status(200).json(success(false, res.statusCode, "Admin user details have same mobile number.", { tab: 4, }));
                        }
                        var both_user_has_same_designation = hasDuplicate(_user_details, "designation");
                        if (both_user_has_same_designation) {
                            return res.status(200).json(success(false, res.statusCode, "Admin user details have same designation.", { tab: 4, }));
                        }
                        has_valid_users = true;
                    } else {
                        return res.status(200).json(success(false, res.statusCode, 'Please add both admin user details.<br>Click on "Add Member" button to add.', { tab: 4, }));
                    }
                }
                if (form_static_fields.tab_user_details.visible == false) {
                    const phi_user = {
                        user_no: 1,
                        first_name: _first_name,
                        middle_name: _middle_name,
                        last_name: _last_name,
                        designation: 0,
                        email_id: _email_id,
                        mobile_ccc: _mobile_ccc,
                        mobile_no: _mobile_no,
                    };
                    _user_details = []; _user_details.push(phi_user); has_valid_users = true; _isNoUserReg = true;
                }
                if (!has_valid_users) {
                    return res.status(200).json(success(false, res.statusCode, "Please enter admin user account details.", { tab: 4, }));
                }

                var platform_fee_enabled = entity.platform_fee_enabled && entity.platform_fee_enabled == true ? true : false;
                var platform_fee_amount = 0;
                const _query18 = `SELECT amount FROM entity_platform_fees WHERE entity_id = ? ORDER BY table_id DESC LIMIT 1`;
                const row18 = await db.sequelize.query(_query18, { replacements: [_entity_id], type: QueryTypes.SELECT });
                if (row18 && row18.length > 0) {
                    platform_fee_amount = row18[0].amount != null && validator.isNumeric(row18[0].amount.toString()) ? parseFloat(parseFloat(row18[0].amount).toFixed(2)) : 0;
                }

                const _query13 = `UPDATE temp_master SET first_name = ?, middle_name = ?, last_name = ?, mobile_ccc = ?,
                company_name = ?, registered_as_id = ?, org_type_id = ?, parent_org_id = ?, address_1 = ?, address_2 = ?, address_3 = ?, country_id = ?,
                state_id = ?, district_id = ?, block_id = ?, pin_code = ?, contact_no = ?, registration_no = ?,
                it_80g_reg_no = ?, it_12a_reg_no = ?, darpan_reg_no = ?, mca_csr_f1_reg_no = ?, fcra_no_with_status = ?,
                fcra_no_status = ?, expertise_area_id = ?, fin_audit_rpt_filed = ?,
                platform_fee_enabled = ?, platform_fee_amount = ?, form_static_fields_json = ?
                WHERE temp_id = ?`;
                const _replacements13 = [_first_name, _middle_name, _last_name, _mobile_ccc, _company_name, _registered_as_id, _org_type_id, _parent_org_id, _address_1,
                    _address_2, _address_3, _country_id, _state_id, _district_id, _block_id, _pin_code, _contact_no, _registration_no,
                    _it_80g_reg_no, _it_12a_reg_no, _darpan_reg_no, _mca_csr_f1_reg_no, _fcra_no_with_status, _fcra_no_status,
                    _expertise_area_ids.join(','), _fin_audit_rpt_filed,
                    platform_fee_enabled, platform_fee_amount, JSON.stringify(form_static_fields), row.temp_id];
                await db.sequelize.query(_query13, { replacements: _replacements13, type: QueryTypes.UPDATE });

                var tuser_ids = [];
                if (_user_details && has_valid_users) {
                    for (let i = 0; i < _user_details.length; i++) {
                        const usr = _user_details[i];

                        const _query14 = `SELECT tuser_id FROM temp_account WHERE temp_id = ? AND user_no = ?`;
                        const row14 = await db.sequelize.query(_query14, { replacements: [row.temp_id, (i + 1)], type: QueryTypes.SELECT });
                        if (row14 && row14.length > 0) {
                            const _query15 = `UPDATE temp_account SET first_name = ?, middle_name = ?, last_name = ?,
                            email_id = ?, mobile_ccc = ?, mobile_no = ?, design_id = ? WHERE tuser_id = ?`;
                            const _replacements15 = [usr.first_name, usr.middle_name, usr.last_name, usr.email_id, usr.mobile_ccc, usr.mobile_no, usr.designation, row14[0].tuser_id];
                            await db.sequelize.query(_query15, { replacements: _replacements15, type: QueryTypes.UPDATE });
                            tuser_ids.push(row14[0].tuser_id);
                        } else {
                            const _query16 = `INSERT INTO temp_account(temp_id, user_no, first_name, middle_name, last_name, email_id, mobile_ccc, mobile_no, design_id)
                            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING "tuser_id"`;
                            const _replacements16 = [row.temp_id, (i + 1), usr.first_name, usr.middle_name, usr.last_name, usr.email_id, usr.mobile_ccc, usr.mobile_no, usr.designation];
                            const [row16] = await db.sequelize.query(_query16, { replacements: _replacements16, returning: true });
                            const tuser_id = (row16 && row16.length > 0 && row16[0] ? row16[0].tuser_id : 0);
                            if (tuser_id > 0) {
                                tuser_ids.push(tuser_id);
                            }
                        }
                    }
                }
                if (tuser_ids.length > 0) {
                    const _query17 = `DELETE FROM temp_account WHERE temp_id = ? AND tuser_id NOT IN (?)`;
                    await db.sequelize.query(_query17, { replacements: [row.temp_id, tuser_ids], type: QueryTypes.DELETE });
                } else {
                    const _query17_1 = `DELETE FROM temp_account WHERE temp_id = ?`;
                    await db.sequelize.query(_query17_1, { replacements: [row.temp_id], type: QueryTypes.DELETE });
                }

                // Delete and store documents to GCP
                const _query200 = `SELECT local_file_path, gcp_file_path FROM temp_document WHERE temp_id = ?`;
                const row200 = await db.sequelize.query(_query200, { replacements: [row.temp_id], type: QueryTypes.SELECT });
                for (let r = 0; row200 && r < row200.length; r++) {
                    if (row200[r].local_file_path && row200[r].local_file_path.length > 0) {
                        delete_file_by_path(row200[r].local_file_path);
                    }
                    if (row200[r].gcp_file_path && row200[r].gcp_file_path.length > 0) {
                        try { await cloudStorageModule.DeleteFile(row200[r].gcp_file_path); } catch (_) { }
                    }
                }
                const _query201 = `DELETE FROM temp_document WHERE temp_id = ?`;
                await db.sequelize.query(_query201, { replacements: [row.temp_id], type: QueryTypes.DELETE });

                for (let i = 0; documentRequired && i < documentRequired.length; i++) {
                    const file_name_to_check = 'doc_' + documentRequired[i].document_id.toString();
                    var is_file_exists = false; var file_json_data = null;
                    for (let j = 0; req.files && j < req.files.length; j++) {
                        if (req.files[j].fieldname.toLowerCase() == file_name_to_check.toLowerCase()) {
                            file_json_data = req.files[j]; is_file_exists = true; break;
                        }
                    }
                    if (is_file_exists) {
                        try {
                            const gcp_file_path = 'temp/' + file_json_data.filename;
                            const gcpResp = await cloudStorageModule.UploadFile(file_json_data.path, gcp_file_path);
                            const _query202 = `INSERT INTO temp_document(temp_id, document_id, original_file_name, upload_file_data, local_file_path, added_date,
                                gcp_file_data, gcp_file_path, new_file_name) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                            await db.sequelize.query(_query202, {
                                replacements: [
                                    row.temp_id, documentRequired[i].document_id, file_json_data.originalname, JSON.stringify(file_json_data), file_json_data.path,
                                    new Date(), JSON.stringify(gcpResp), gcp_file_path, file_json_data.filename
                                ], type: QueryTypes.INSERT
                            });
                        } catch (gErr) {
                            try { _logger.error(gErr.stack); } catch (_) { }
                            return res.status(200).json(success(false, res.statusCode, "Unable to upload file to \"Cloud Storage\".<br>File Name: " + file_json_data.originalname, { tab: 2, }));
                        }
                    }
                }
                // Delete and store documents to GCP
                const currDate = new Date();
                /**************** RE-CHECK EMAIL & MOBILE *******************/
                const reChkMobile = await commonModule.is_mobile_registered(_mobile_no);
                if (reChkMobile) {
                    return res.status(200).json(success(false, res.statusCode, "Mobile number is already registered.", { tab: 1, }));
                }
                const reChkMail = await commonModule.is_email_registered(_email_id);
                if (reChkMail) {
                    return res.status(200).json(success(false, res.statusCode, "Email id is already registered.", { tab: 1, }));
                }
                if (!_isNoUserReg) {
                    for (let rci = 0; rci < _user_details.length; rci++) {
                        const eleUsr = _user_details[rci];
                        const reChkUsrMail = await commonModule.is_email_registered(eleUsr.email_id);
                        if (reChkUsrMail) {
                            return res.status(200).json(success(false, res.statusCode, "Email id is already registered of admin user " + (rci + 1).toString() + ".", { tab: 4, }));
                        }
                        const reChkUsrMobile = await commonModule.is_mobile_registered(eleUsr.mobile_no);
                        if (reChkUsrMobile) {
                            return res.status(200).json(success(false, res.statusCode, "Mobile number is already registered of admin user " + (rci + 1).toString() + ".", { tab: 4, }));
                        }
                    }
                }
                /**************** RE-CHECK EMAIL & MOBILE *******************/
                platform_fee_enabled = false;
                if (platform_fee_enabled && platform_fee_amount > 0) {




                } else {
                    const _query20 = `INSERT INTO user_master(entity_id, temp_id, added_date, consent_provided, 
                        first_name, middle_name, last_name, email_id, mobile_ccc, mobile_no, pan_no, org_type_id, parent_org_id,
                        company_name, registered_as_id, address_1, address_2, address_3, country_id, state_id, district_id,
                        block_id, pin_code, contact_no, company_pan_no, gstin_no, cin_no, registration_no, it_80g_reg_no, it_12a_reg_no,
                        darpan_reg_no, mca_csr_f1_reg_no, fcra_no_with_status, fcra_no_status, expertise_area_id, fin_audit_rpt_filed, form_static_fields_json)
                      
                        SELECT entity_id, temp_id, :added_date, true,
                        first_name, middle_name, last_name, email_id, mobile_ccc, mobile_no, pan_no, org_type_id, parent_org_id,
                        company_name, registered_as_id, address_1, address_2, address_3, country_id, state_id, district_id,
                        block_id, pin_code, contact_no, company_pan_no, gstin_no, cin_no, registration_no, it_80g_reg_no, it_12a_reg_no,
                        darpan_reg_no, mca_csr_f1_reg_no, fcra_no_with_status, fcra_no_status, expertise_area_id, fin_audit_rpt_filed, form_static_fields_json
                        FROM temp_master WHERE temp_id = :temp_id RETURNING "reg_id", "unique_id"`;
                    const _replacements20 = { added_date: currDate, temp_id: row.temp_id };
                    const [row20] = await db.sequelize.query(_query20, { replacements: _replacements20, type: QueryTypes.INSERT, returning: true });
                    const reg_id = (row20 && row20.length > 0 && row20[0] ? row20[0].reg_id : 0);
                    if (reg_id > 0) {

                        const _query21 = `INSERT INTO user_account(reg_id, first_name, middle_name, last_name, email_id, mobile_ccc, mobile_no, design_id, is_admin, added_date, tuser_id)
                        SELECT :reg_id, first_name, middle_name, last_name, email_id, mobile_ccc, mobile_no, design_id, true, :added_date, tuser_id
                        FROM temp_account WHERE temp_id = :temp_id`;
                        const _replacements21 = { reg_id: reg_id, added_date: currDate, temp_id: row.temp_id };
                        await db.sequelize.query(_query21, { replacements: _replacements21, type: QueryTypes.INSERT });

                        const _query300 = `SELECT doc_file_id, document_id, original_file_name, gcp_file_path, gcp_file_data, new_file_name FROM temp_document WHERE temp_id = ?`;
                        const row300 = await db.sequelize.query(_query300, { replacements: [row.temp_id], type: QueryTypes.SELECT });
                        for (let gi = 0; row300 && gi < row300.length; gi++) {
                            var _doc_updated_path = row300[gi].gcp_file_path; var _doc_updated_resp = row300[gi].gcp_file_data;
                            try {
                                const _newGcpPath = 'entity/' + reg_id.toString() + '/' + row300[gi].new_file_name;
                                const moveRsp = await cloudStorageModule.MoveFile(row300[gi].gcp_file_path, _newGcpPath);
                                _doc_updated_path = _newGcpPath; _doc_updated_resp = JSON.stringify(moveRsp);
                            } catch (_) {
                            }
                            const _query301 = `INSERT INTO user_document(document_id, original_file_name, new_file_name, gcp_response_data, gcp_file_path, t_doc_file_id, 
                                uploaded_date, cloud_file_stored, reg_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                            const repDoc = [row300[gi].document_id, row300[gi].original_file_name, row300[gi].new_file_name, _doc_updated_resp, _doc_updated_path,
                            row300[gi].doc_file_id, currDate, true, reg_id];
                            await db.sequelize.query(_query301, { replacements: repDoc, type: QueryTypes.INSERT });
                        }

                        for (let aq = 0; _expertise_area_ids && aq < _expertise_area_ids.length; aq++) {
                            const _query0003 = `INSERT INTO user_expertise(reg_id, expertise_area_id) VALUES(?, ?)`;
                            await db.sequelize.query(_query0003, { replacements: [reg_id, _expertise_area_ids[aq]], type: QueryTypes.INSERT });
                        }

                        const _query2453 = `INSERT INTO user_services(reg_id, head_id, category_id, sub_cat_id, range_size, price, t_id, added_date)
                        SELECT :reg_id, c.head_id, sc.category_id, t.sub_cat_id, t.range_size, t.price, t.t_id, :added_date
                        FROM temp_services t INNER JOIN services_sub_cat sc ON t.sub_cat_id = sc.sub_cat_id INNER JOIN services_category c ON sc.category_id = c.category_id
                        WHERE t.temp_id = :temp_id`;
                        const _replacements2453 = { reg_id: reg_id, added_date: currDate, temp_id: row.temp_id };
                        await db.sequelize.query(_query2453, { replacements: _replacements2453, type: QueryTypes.INSERT });

                        const _query22 = `INSERT INTO user_bank(reg_id, ifsc_code, bank_id, bank_other, branch_id, branch_other, account_type, 
                            account_no, re_account_no, consent_provided, added_date, tbank_id)
                            SELECT :reg_id, ifsc_code, bank_id, bank_other, branch_id, branch_other, account_type, 
                            account_no, re_account_no, true, :added_date, tbank_id
                            FROM temp_bank WHERE temp_id = :temp_id`;
                        const _replacements22 = { reg_id: reg_id, added_date: currDate, temp_id: row.temp_id };
                        await db.sequelize.query(_query22, { replacements: _replacements22, type: QueryTypes.INSERT });

                        setTimeout(async () => {
                            await commonModule.send_entity_registration_email(reg_id);
                        }, 0);

                        if (entity.auto_approve_enabled && entity.auto_approve_enabled == true) {

                            const _query61 = `UPDATE user_master SET approve_status = 1, approved_date = ?, auto_approved = true WHERE reg_id = ?`;
                            const [, ra] = await db.sequelize.query(_query61, { replacements: [new Date(), reg_id], type: QueryTypes.UPDATE });
                            if (ra > 0) {
                                const _queryAutoAppLog = `INSERT INTO user_stat_log(reg_id, approve_status, status_date, status_remark) VALUES(?, ?, ?, ?)`;
                                await db.sequelize.query(_queryAutoAppLog, { replacements: [reg_id, 1, new Date(), 'Auto approved registration.'], type: QueryTypes.INSERT });

                                setTimeout(async () => {
                                    await commonModule.send_entity_approval_email(reg_id);
                                }, 0);
                            }
                        }

                        return res.status(200).json(success(true, apiStatus.REG_SUCCESS_NO_PAYMENT, constants.entity_reg_success_msg, null));

                    } else {
                        return res.status(200).json(success(false, res.statusCode, "Unable to add record, Please try again.", null));
                    }
                }

                return res.status(200).json(success(false, res.statusCode, " key.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Invalid authentication key.", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sign up key is required for authentication.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const delete_uploaded_files = (req) => {
    if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
            try {
                fs.unlinkSync(req.files[i].path);
            } catch (err) {
                try { _logger.error(err.stack); } catch (_) { }
            }
        }
    }
};

const delete_file_by_path = (path) => {
    try {
        fs.unlinkSync(path);
    } catch (err) {
        try { _logger.error(err.stack); } catch (_) { }
    }
};

const testing = async (req, res, next) => {
    res.on('finish', () => {
        delete_uploaded_files(req);
    });
    try {
        /*
        const _query1 = `select * from project_accepted`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        for (let i = 0; row1 && i < row1.length; i++) {
            const eleData = row1[i];

            const _queryChk = `SELECT * FROM project_track_milestone WHERE accepted_id = ?`
            const rowChk = await db.sequelize.query(_queryChk, { replacements: [eleData.accepted_id], type: QueryTypes.SELECT });
            const exists = (rowChk && rowChk.length > 0) ? true : false;
            if (!exists) {
                const _query2 = `INSERT INTO project_track_milestone(accepted_id, milestone_id)
                SELECT :accepted_id, m.milestone_id
                FROM project_milestone m WHERE m.project_id = :project_id AND m.is_deleted = false;`
                await db.sequelize.query(_query2, { replacements: { accepted_id: eleData.accepted_id, project_id: eleData.project_id }, type: QueryTypes.INSERT });

                const _query3 = `INSERT INTO project_track_delivery(accepted_id, milestone_id, delivery_id)
            SELECT :accepted_id, d.milestone_id, d.delivery_id
            FROM project_delivery d WHERE d.milestone_id IN (
                SELECT i.milestone_id FROM project_milestone i WHERE i.project_id = :project_id AND i.is_deleted = false
            ) AND d.is_deleted = false;`
                await db.sequelize.query(_query3, { replacements: { accepted_id: eleData.accepted_id, project_id: eleData.project_id }, type: QueryTypes.INSERT });

                const _query4 = `INSERT INTO project_track_activity(accepted_id, milestone_id, delivery_id, activity_id)
            SELECT :accepted_id, a.milestone_id, a.delivery_id, a.activity_id
            FROM project_activity a WHERE a.delivery_id IN (
                SELECT d.delivery_id FROM project_delivery d WHERE d.milestone_id IN (
                    SELECT i.milestone_id FROM project_milestone i WHERE i.project_id = :project_id AND i.is_deleted = false
                ) AND d.is_deleted = false
            ) AND a.is_deleted = false;`
                await db.sequelize.query(_query4, { replacements: { accepted_id: eleData.accepted_id, project_id: eleData.project_id }, type: QueryTypes.INSERT });
            }
        }
        */



        var aa = `eyJhbGciOiJIUzI1NiIsImNsaWVudGlkIjoieHVhdGFpc2EiLCJraWQiOiJITUFDIn0.eyJzdGF0dXMiOjQwMSwiZXJyb3JfdHlwZSI6ImF1dGhlbnRpY2F0aW9uX2Vycm9yIiwiZXJyb3JfY29kZSI6IkdOQVVFMDAwNiIsIm1lc3NhZ2UiOiJSZXF1ZXN0IGZyb20gdW5hdXRob3JpemVkIGlwIn0.VE10nd8d9DEySb_t62i5jYEIwPtSknk8SOmkXcD3SC0`;

        const data = jws.verify(aa, "HS256", process.env.BILL_DESK_SECRETKEY);
        if (data) {
            const ddd = jws.decode(aa);

            console.log(ddd);
        }

        //const pan_result = await fetchApigee.validate_pan_card('AAAPA0039K');
        //const penny_less_result = await fetchApigee.validate_bank_acc_number('007801037885', 1, 'ICIC0000078');
        //const ifsc_result = await fetchApigee.validate_ifsc_code('SBIS0054404');
        return res.status(200).json(success(true, res.statusCode, "", null));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    testing,
    entities,
    form_data,
    resume_data,
    states,
    districts,
    blocks,
    check_pan_no,
    validate_initiator,
    resend_mobile_otp,
    resend_email_otp,
    verify_otp_codes,
    check_company_pan_no,
    check_gstin_no,
    check_cin_no,
    search_parent_entity,
    validate_details,
    check_ifsc_code,
    ifsc_code_search,
    validate_enrolment_detail,
    validate_bank_detail,
    validate_user_detail,
    submit_detail,
};
