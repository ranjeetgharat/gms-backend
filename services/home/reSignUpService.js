const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
const requestIp = require('request-ip');
const registrationModule = require('../../modules/registrationModule');
const commonModule = require('../../modules/commonModule');
const entityDataModule = require('../../modules/entityDataModule');
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

function validate_token(str) {

}

const check_token = async (req, res, next) => {
    const { token } = req.body;
    try {
        const _raw_data = (token && token.length > 0) ? token.trim() : "";
        if (_raw_data && _raw_data.length > 0) {
            var decoded_data = ''; try { decoded_data = Buffer.from(_raw_data, 'base64').toString('utf8'); } catch (_) { }
            var decoded_json = null; if (decoded_data.length > 0) { try { decoded_json = JSON.parse(decoded_data); } catch (_) { } }
            if (decoded_json != null && decoded_json.id && decoded_json.key && decoded_json.id.length > 0 && decoded_json.key.length > 0
                && utils.isUUID(decoded_json.id) && utils.isUUID(decoded_json.key)) {

                const _query0 = `SELECT u.reg_id, u.entity_id, u.approve_status, t.entity_name, t.prerequisite_text, t.prerequisite_enabled,
                u.reject_resume_token, u.rejected_remark, u.first_name, u.middle_name, u.last_name, u.email_id, u.mobile_ccc, u.mobile_no, u.pan_no,
                u.company_name, u.registered_as_id, u.org_type_id, u.parent_org_id, u.address_1, u.address_2, u.address_3, u.country_id, u.state_id, u.district_id, u.block_id, u.pin_code, u.contact_no,
                u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no, u.mca_csr_f1_reg_no, u.fcra_no_with_status, u.fcra_no_status, u.fin_audit_rpt_filed
                FROM user_master u INNER JOIN entity_type t ON u.entity_id = t.entity_id WHERE u.unique_id = ? AND u.is_deleted = false`;
                const row0 = await db.sequelize.query(_query0, { replacements: [decoded_json.id], type: QueryTypes.SELECT });
                if (row0 && row0.length > 0 && row0[0].reject_resume_token.toString().toLowerCase() == decoded_json.key.toString().toLowerCase()) {
                    const rowData = row0[0];
                    const _approve_status = rowData.approve_status && validator.isNumeric(rowData.approve_status.toString()) ? parseInt(rowData.approve_status) : 0;
                    if (_approve_status.toString() == '2') {
                        const mobile_ccc_list = await commonModule.country_calling_code();
                        var form_static_fields = await registrationModule.registration_static_fields(rowData.entity_id);
                        var parent_organizations = await registrationModule.parent_organization(rowData.entity_id);
                        var designation = await registrationModule.designations(rowData.entity_id);
                        var documents = await registrationModule.documents(rowData.entity_id);
                        var registration_type = await registrationModule.registration_type(rowData.entity_id);
                        var expertise_area = await registrationModule.expertise_area(rowData.entity_id);
                        var services_data = await registrationModule.services_data(rowData.entity_id, form_static_fields.tab_services.visible);
                        var countries = await commonModule.country_dropdown();

                        var _parent_org_id = (rowData.parent_org_id && validator.isNumeric(rowData.parent_org_id.toString())) ? BigInt(rowData.parent_org_id) : 0;
                        var parent_org_data = null;
                        if (_parent_org_id > 0) {
                            const _querySelParent = `SELECT reg_no, company_name FROM user_master WHERE reg_id = ? AND is_deleted = false AND approve_status = 1`;
                            const rowSelParent = await db.sequelize.query(_querySelParent, { replacements: [_parent_org_id], type: QueryTypes.SELECT });
                            if (rowSelParent && rowSelParent.length > 0) {
                                parent_org_data = {
                                    reg_no: rowSelParent[0].reg_no,
                                    company_name: rowSelParent[0].company_name,
                                };
                            } else {
                                _parent_org_id = 0;
                            }
                        }

                        const my_country_id = (rowData.country_id && validator.isNumeric(rowData.country_id.toString())) ? BigInt(rowData.country_id) : 0;
                        const my_state_id = (rowData.state_id && validator.isNumeric(rowData.state_id.toString())) ? BigInt(rowData.state_id) : 0;
                        const my_district_id = (rowData.district_id && validator.isNumeric(rowData.district_id.toString())) ? BigInt(rowData.district_id) : 0;
                        const my_block_id = (rowData.block_id && validator.isNumeric(rowData.block_id.toString())) ? BigInt(rowData.block_id) : 0;

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

                        var initiator_mobile_ccc = (rowData.mobile_ccc && rowData.mobile_ccc.length > 0) ? rowData.mobile_ccc : "";
                        var is_valid_initiator_mobile_ccc = false;
                        if (initiator_mobile_ccc.length > 0) {
                            for (let j = 0; j < mobile_ccc_list.length; j++) {
                                if (mobile_ccc_list[j] == initiator_mobile_ccc) {
                                    is_valid_initiator_mobile_ccc = true; break;
                                }
                            }
                        }
                        if (!is_valid_initiator_mobile_ccc) { initiator_mobile_ccc = mobile_ccc_list[0]; }
                        var _expertise_area_ids = await entityDataModule.expertise_areas(rowData.reg_id);
                        var services_selected = []; const db_services = await entityDataModule.services(rowData.reg_id);
                        for (let i = 0; db_services && i < db_services.length; i++) {
                            const serEle = db_services[i];
                            services_selected.push({
                                head_id: serEle.head_id,
                                head_name: serEle.head_name,
                                category_id: serEle.category_id,
                                category_name: serEle.category_name,
                                sub_cat_id: serEle.sub_cat_id,
                                sub_cat_name: serEle.sub_cat_name,
                                range_size: serEle.range_size,
                                price: serEle.price,
                            });
                        }

                        var document_uploaded = await entityDataModule.entity_document_uploaded(rowData.reg_id);

                        var _account_no = ''; var _re_account_no = ''; var _account_type = 0; var _ifsc_code = ''; var _bank_name = ''; var _bank_branch = '';
                        const banks = await entityDataModule.bank_accounts(rowData.reg_id);
                        if (banks && banks.length > 0) {
                            _account_no = banks[0].account_no;
                            _re_account_no = banks[0].re_account_no;
                            _account_type = banks[0].account_type;
                            _ifsc_code = banks[0].ifsc_code;
                            _bank_name = banks[0].bank_name;
                            _bank_branch = banks[0].bank_branch;
                        }

                        var _user_details = [];
                        const _querySelUsr = `SELECT a.user_id, a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_ccc, a.mobile_no, a.design_id
                            FROM user_account a WHERE a.reg_id = ? AND a.is_deleted = false AND a.is_admin = true ORDER BY a.user_id`;
                        const rowSelUsr = await db.sequelize.query(_querySelUsr, { replacements: [rowData.reg_id], type: QueryTypes.SELECT });
                        for (let i = 0; rowSelUsr && i < rowSelUsr.length; i++) {
                            const eleUsr = rowSelUsr[i];
                            var user_mobile_ccc = (eleUsr.mobile_ccc && eleUsr.mobile_ccc.length > 0) ? eleUsr.mobile_ccc : "";
                            var is_valid_adm_mobile_ccc = false;
                            if (user_mobile_ccc.length > 0) {
                                for (let j = 0; j < mobile_ccc_list.length; j++) {
                                    if (mobile_ccc_list[j] == user_mobile_ccc) {
                                        is_valid_adm_mobile_ccc = true; break;
                                    }
                                }
                            }
                            if (!is_valid_adm_mobile_ccc) { user_mobile_ccc = mobile_ccc_list[0]; }
                            const _design_id = (eleUsr.design_id && validator.isNumeric(eleUsr.design_id.toString())) ? BigInt(eleUsr.design_id) : 0;
                            var design_name = '';
                            for (let k = 0; designation && k < designation.length; k++) {
                                if (designation[k].design_id.toString() == _design_id.toString()) {
                                    design_name = designation[k].design_name;
                                }
                            }

                            _user_details.push({
                                user_id: eleUsr.user_id,
                                first_name: (eleUsr.first_name && eleUsr.first_name.length > 0) ? eleUsr.first_name : "",
                                middle_name: (eleUsr.middle_name && eleUsr.middle_name.length > 0) ? eleUsr.middle_name : "",
                                last_name: (eleUsr.last_name && eleUsr.last_name.length > 0) ? eleUsr.last_name : "",
                                email_id: (eleUsr.email_id && eleUsr.email_id.length > 0) ? eleUsr.email_id : "",
                                mobile_ccc: user_mobile_ccc,
                                mobile_no: (eleUsr.mobile_no && eleUsr.mobile_no.length > 0) ? eleUsr.mobile_no : "",
                                designation: _design_id,
                                design_name: design_name,
                            });
                        }

                        const dynamic_field_values = await entityDataModule.dynamic_field_values_get(rowData.reg_id);
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
                            first_name: (rowData.first_name && rowData.first_name.length > 0) ? rowData.first_name : "",
                            middle_name: (rowData.middle_name && rowData.middle_name.length > 0) ? rowData.middle_name : "",
                            last_name: (rowData.last_name && rowData.last_name.length > 0) ? rowData.last_name : "",
                            mobile_ccc: initiator_mobile_ccc,
                            mobile_no: (rowData.mobile_no && rowData.mobile_no.length > 0) ? rowData.mobile_no : "",
                            email_id: (rowData.email_id && rowData.email_id.length > 0) ? rowData.email_id : "",
                            pan_no: (rowData.pan_no && rowData.pan_no.length > 0) ? rowData.pan_no : "",

                            company_name: (rowData.company_name && rowData.company_name.length > 0) ? rowData.company_name : "",
                            registered_as_id: (rowData.registered_as_id && validator.isNumeric(rowData.registered_as_id.toString())) ? BigInt(rowData.registered_as_id) : 0,
                            org_type_id: (rowData.org_type_id && validator.isNumeric(rowData.org_type_id.toString())) ? BigInt(rowData.org_type_id) : 0,
                            parent_org_id: _parent_org_id,
                            parent_org_data: parent_org_data,
                            address_1: (rowData.address_1 && rowData.address_1.length > 0) ? rowData.address_1 : "",
                            address_2: (rowData.address_2 && rowData.address_2.length > 0) ? rowData.address_2 : "",
                            address_3: (rowData.address_3 && rowData.address_3.length > 0) ? rowData.address_3 : "",
                            country_id: my_country_id,
                            state_id: my_state_id,
                            district_id: my_district_id,
                            block_id: my_block_id,
                            pin_code: (rowData.pin_code && rowData.pin_code.length > 0) ? rowData.pin_code : "",
                            contact_no: (rowData.contact_no && rowData.contact_no.length > 0) ? rowData.contact_no : "",

                            company_pan_no: (rowData.company_pan_no && rowData.company_pan_no.length > 0) ? rowData.company_pan_no : "",
                            gstin_no: (rowData.gstin_no && rowData.gstin_no.length > 0) ? rowData.gstin_no : "",
                            cin_no: (rowData.cin_no && rowData.cin_no.length > 0) ? rowData.cin_no : "",
                            registration_no: (rowData.registration_no && rowData.registration_no.length > 0) ? rowData.registration_no : "",
                            it_80g_reg_no: (rowData.it_80g_reg_no && rowData.it_80g_reg_no.length > 0) ? rowData.it_80g_reg_no : "",
                            it_12a_reg_no: (rowData.it_12a_reg_no && rowData.it_12a_reg_no.length > 0) ? rowData.it_12a_reg_no : "",
                            darpan_reg_no: (rowData.darpan_reg_no && rowData.darpan_reg_no.length > 0) ? rowData.darpan_reg_no : "",
                            mca_csr_f1_reg_no: (rowData.mca_csr_f1_reg_no && rowData.mca_csr_f1_reg_no.length > 0) ? rowData.mca_csr_f1_reg_no : "",
                            fcra_no_with_status: (rowData.fcra_no_with_status && rowData.fcra_no_with_status.length > 0) ? rowData.fcra_no_with_status : "",
                            fcra_no_status: (rowData.fcra_no_status && rowData.fcra_no_status == true) ? true : false,
                            expertise_area_ids: _expertise_area_ids,
                            fin_audit_rpt_filed: (rowData.fin_audit_rpt_filed && rowData.fin_audit_rpt_filed == true) ? true : false,

                            services_selected: services_selected,

                            document_uploaded: document_uploaded,

                            account_no: _account_no,
                            re_account_no: _re_account_no,
                            account_type: _account_type,
                            ifsc_code: _ifsc_code,
                            bank_name: _bank_name,
                            bank_branch: _bank_branch,

                            user_details: _user_details,

                        };

                        const results = {
                            rejected_remark: rowData.rejected_remark,
                            entity_id: rowData.entity_id,
                            entity_name: rowData.entity_name,
                            prerequisite_text: rowData.prerequisite_text,
                            prerequisite_enabled: rowData.prerequisite_enabled,

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
                        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Invalid resume journey link or expired.", null));
                    }
                } else {
                    return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Invalid resume journey link or expired.", null));
                }
            }
            else {
                return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Invalid resume journey link or expired.", null));
            }
        } else {
            return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, "Invalid resume journey link or expired.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, apiStatus.BACK_TO_PREV_PAGE, err.message, null));
    }
};

const states = async (req, res, next) => {
    const { country_id } = req.body;
    try {
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        const states = await commonModule.state_dropdown(_country_id);
        return res.status(200).json(success(true, res.statusCode, "", states));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const districts = async (req, res, next) => {
    const { state_id } = req.body;
    try {
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        const districts = await commonModule.district_dropdown(_state_id);
        return res.status(200).json(success(true, res.statusCode, "", districts));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const blocks = async (req, res, next) => {
    const { district_id } = req.body;
    try {
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        const blocks = await commonModule.block_dropdown(_district_id);
        return res.status(200).json(success(true, res.statusCode, "", blocks));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    check_token,
    states,
    districts,
    blocks,
};