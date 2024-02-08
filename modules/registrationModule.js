const _logger = require('../logger/winston').logger;
const db = require('../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
var validator = require('validator');
const crypto = require('crypto');
const utils = require('../utilities/utils');
const constants = require('../constants/constants');
const commonModule = require('./commonModule');

const registration_static_fields = async (entity_id) => {
    var _flow_by_reg_type_id = false;
    const _query1 = `SELECT registration_flow_by_reg_type_id FROM entity_type WHERE entity_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        _flow_by_reg_type_id = row1[0].registration_flow_by_reg_type_id && row1[0].registration_flow_by_reg_type_id == true ? true : false;
    }
    var reg_type_flow_data = [];
    if (_flow_by_reg_type_id) {
        const _query51 = `SELECT tm.reg_type_id
        FROM entity_reg_type_mast tm INNER JOIN entity_reg_type_mapp tc ON tm.reg_type_id = tc.reg_type_id
        WHERE tc.entity_id = ? AND tm.is_deleted = false`
        const row51 = await db.sequelize.query(_query51, { replacements: [entity_id], type: QueryTypes.SELECT });
        for (let g = 0; row51 && g < row51.length; g++) {
            const _query52 = `SELECT f.static_field_id, f.flow_by_reg_type_id, f.is_static,
            CASE WHEN LENGTH(COALESCE(m.label_text, '')) > 0 THEN m.label_text ELSE f.field_label END AS field_label,
            CASE WHEN LENGTH(COALESCE(m.label_lng_key, '')) > 0 THEN m.label_lng_key ELSE f.field_lng_key END AS field_lng_key,
            COALESCE(m.is_added, 0) AS is_added, COALESCE(m.is_required, false) AS is_required
            FROM reg_static_field_item f 
            LEFT JOIN LATERAL (
                SELECT COALESCE(em.entity_id, 0) AS is_added, em.is_required, em.label_text, em.label_lng_key 
                FROM reg_static_field_map_entity em WHERE em.static_field_id = f.static_field_id AND em.entity_id = ? AND em.reg_type_id = ?
                FETCH FIRST 1 ROW ONLY
            ) m ON true
            WHERE f.flow_by_reg_type_id = true
            ORDER BY CASE WHEN COALESCE(f.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(f.sort_order, 0) END`;
            const row52 = await db.sequelize.query(_query52, { replacements: [entity_id, row51[g].reg_type_id], type: QueryTypes.SELECT });
            var document_list = [];
            const _query53 = `SELECT document_id, is_required FROM reg_static_field_map_docs WHERE entity_id = ? AND reg_type_id = ?`;
            const row53 = await db.sequelize.query(_query53, { replacements: [entity_id, row51[g].reg_type_id], type: QueryTypes.SELECT });
            for (let h = 0; row53 && h < row53.length; h++) {
                document_list.push({
                    document_id: row53[h].document_id,
                    is_required: row53[h].is_required,
                });
            }
            const _flow_dynamic_fields = await commonModule.entity_dynamic_form_fields_by_reg_type_id(entity_id, row51[g].reg_type_id);

            reg_type_flow_data.push({
                reg_type_id: row51[g].reg_type_id,
                field_data: {
                    registration_no: get_field_map_reg_row_data(22, row52),
                    it_80g_reg_no: get_field_map_reg_row_data(23, row52),
                    it_12a_reg_no: get_field_map_reg_row_data(24, row52),
                    darpan_reg_no: get_field_map_reg_row_data(25, row52),
                    mca_csr_f1_reg_no: get_field_map_reg_row_data(26, row52),
                    fcra_no_with_status: get_field_map_reg_row_data(27, row52),
                    fcra_no_status: get_field_map_reg_row_data(28, row52),
                    expertise_area_id: get_field_map_reg_row_data(29, row52),
                    fin_audit_rpt_filed: get_field_map_reg_row_data(30, row52),

                    tab_documents: get_field_map_reg_row_data(34, row52),
                    document_list: document_list,
                    dynamic_fields: _flow_dynamic_fields,
                }
            });
        }
    }
    const _query2 = `SELECT f.static_field_id, f.flow_by_reg_type_id, f.is_static,
                        CASE WHEN LENGTH(COALESCE(m.label_text, '')) > 0 THEN m.label_text ELSE f.field_label END AS field_label,
                        CASE WHEN LENGTH(COALESCE(m.label_lng_key, '')) > 0 THEN m.label_lng_key ELSE f.field_lng_key END AS field_lng_key,
                        COALESCE(m.is_added, 0) AS is_added, COALESCE(m.is_required, false) AS is_required
                        FROM reg_static_field_item f 
                        LEFT JOIN LATERAL (
                            SELECT COALESCE(em.entity_id, 0) AS is_added, em.is_required, em.label_text, em.label_lng_key 
                            FROM reg_static_field_map_entity em WHERE em.static_field_id = f.static_field_id AND em.entity_id = ?
                            FETCH FIRST 1 ROW ONLY
                        ) m ON true
                        ORDER BY CASE WHEN COALESCE(f.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(f.sort_order, 0) END`;
    const row2 = await db.sequelize.query(_query2, { replacements: [entity_id], type: QueryTypes.SELECT });

    const _dynamic_fields = await commonModule.entity_dynamic_form_fields(entity_id);


    const field_data = {
        first_name: get_field_map_row_data(1, _flow_by_reg_type_id, row2),
        middle_name: get_field_map_row_data(2, _flow_by_reg_type_id, row2),
        last_name: get_field_map_row_data(3, _flow_by_reg_type_id, row2),
        mobile_no: get_field_map_row_data(4, _flow_by_reg_type_id, row2),
        email_id: get_field_map_row_data(5, _flow_by_reg_type_id, row2),
        pan_no: get_field_map_row_data(6, _flow_by_reg_type_id, row2),

        company_name: get_field_map_row_data(7, _flow_by_reg_type_id, row2),
        registered_as_id: get_field_map_row_data(8, _flow_by_reg_type_id, row2),
        parent_orgnization: get_field_map_row_data(9, _flow_by_reg_type_id, row2),
        address_1: get_field_map_row_data(10, _flow_by_reg_type_id, row2),
        address_2: get_field_map_row_data(11, _flow_by_reg_type_id, row2),
        address_3: get_field_map_row_data(12, _flow_by_reg_type_id, row2),
        country_id: get_field_map_row_data(13, _flow_by_reg_type_id, row2),
        state_id: get_field_map_row_data(14, _flow_by_reg_type_id, row2),
        district_id: get_field_map_row_data(15, _flow_by_reg_type_id, row2),
        block_id: get_field_map_row_data(16, _flow_by_reg_type_id, row2),
        pin_code: get_field_map_row_data(17, _flow_by_reg_type_id, row2),
        contact_no: get_field_map_row_data(18, _flow_by_reg_type_id, row2),
        company_pan_no: get_field_map_row_data(19, _flow_by_reg_type_id, row2),
        gstin_no: get_field_map_row_data(20, _flow_by_reg_type_id, row2),
        cin_no: get_field_map_row_data(21, _flow_by_reg_type_id, row2),
        registration_no: get_field_map_row_data(22, _flow_by_reg_type_id, row2),
        it_80g_reg_no: get_field_map_row_data(23, _flow_by_reg_type_id, row2),
        it_12a_reg_no: get_field_map_row_data(24, _flow_by_reg_type_id, row2),
        darpan_reg_no: get_field_map_row_data(25, _flow_by_reg_type_id, row2),
        mca_csr_f1_reg_no: get_field_map_row_data(26, _flow_by_reg_type_id, row2),
        fcra_no_with_status: get_field_map_row_data(27, _flow_by_reg_type_id, row2),
        fcra_no_status: get_field_map_row_data(28, _flow_by_reg_type_id, row2),
        expertise_area_id: get_field_map_row_data(29, _flow_by_reg_type_id, row2),
        fin_audit_rpt_filed: get_field_map_row_data(30, _flow_by_reg_type_id, row2),

        tab_bank_details: get_field_map_row_data(31, _flow_by_reg_type_id, row2),
        tab_user_details: get_field_map_row_data(32, _flow_by_reg_type_id, row2),
        tab_services: get_field_map_row_data(33, _flow_by_reg_type_id, row2),
        tab_documents: get_field_map_row_data(34, _flow_by_reg_type_id, row2),

        flow_by_reg_type_id: _flow_by_reg_type_id,
        reg_type_flow_data: reg_type_flow_data,

        dynamic_fields: _dynamic_fields,


    };
    return field_data;
    /*
        const fields = {
            first_name: utils.check_in_entity(entity_id, [2, 3, 4, 5, 6, 7, 8]),
            middle_name: utils.check_in_entity(entity_id, [2, 3, 4, 5, 6, 7, 8]),
            last_name: utils.check_in_entity(entity_id, [2, 3, 4, 5, 6, 7, 8]),
            mobile_no: utils.check_in_entity(entity_id, [2, 3, 4, 5, 6, 7, 8]),
            email_id: utils.check_in_entity(entity_id, [2, 3, 4, 5, 6, 7, 8]),
            pan_no: utils.check_in_entity(entity_id, [4]),
    
            company_name: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            registered_as_id: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            parent_orgnization: utils.check_in_entity(entity_id, [5]),
            googlelocate: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            address_1: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            address_2: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            address_3: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            country_id: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            state_id: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            district_id: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            block_id: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            pin_code: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            contact_no: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            company_pan_no: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            gstin_no: utils.check_in_entity(entity_id, [2, 3, 5, 6, 7, 8]),
            cin_no: utils.check_in_entity(entity_id, [2, 3, 8]),
            registration_no: utils.check_in_entity(entity_id, [5, 6, 8]),
            it_80g_reg_no: utils.check_in_entity(entity_id, [3, 5, 8]),
            it_12a_reg_no: utils.check_in_entity(entity_id, [3, 5, 8]),
            darpan_reg_no: utils.check_in_entity(entity_id, [3, 5, 8]),
            mca_csr_f1_reg_no: utils.check_in_entity(entity_id, [3, 5, 8]),
            fcra_no_with_status: utils.check_in_entity(entity_id, [3, 5, 8]),
            fcra_no_status: utils.check_in_entity(entity_id, [3, 5, 8]),
            expertise_area_id: utils.check_in_entity(entity_id, [3, 5, 8]),
            fin_audit_rpt_filed: utils.check_in_entity(entity_id, [3, 5, 8]),
    
            tab_bank_details: utils.check_in_entity(entity_id, [1, 2, 3, 5, 6, 7, 8]),
            tab_user_details: utils.check_in_entity(entity_id, [1, 2, 3, 5, 6, 7, 8]),
            tab_services: utils.check_in_entity(entity_id, [7]),
            is_no_user_entity: utils.check_in_entity(entity_id, [4]),
        };
        return fields;
    */
};

function get_field_map_row_data(field_id, _flow_by_reg_type_id, row) {
    for (let i = 0; row && i < row.length; i++) {
        if (row[i].static_field_id.toString() == field_id.toString()) {
            const _is_added = row[i].is_added && validator.isNumeric(row[i].is_added.toString()) ? BigInt(row[i].is_added) : 0;
            const flow_by_reg_type_id = (row[i].flow_by_reg_type_id && row[i].flow_by_reg_type_id == true ? true : false);
            return {
                label: row[i].field_label,
                visible: (_flow_by_reg_type_id == true && flow_by_reg_type_id == true ? false : (_is_added > 0)),
                required: (_flow_by_reg_type_id == true && flow_by_reg_type_id == true ? false : (row[i].is_required && row[i].is_required == true ? true : false)),
                reg_type: flow_by_reg_type_id,
            };
        }
    }
    return {
        label: '',
        visible: false,
        required: false,
        reg_type: false,
    };
}

function get_field_map_reg_row_data(field_id, row) {
    for (let i = 0; row && i < row.length; i++) {
        if (row[i].static_field_id.toString() == field_id.toString()) {
            const _is_added = row[i].is_added && validator.isNumeric(row[i].is_added.toString()) ? BigInt(row[i].is_added) : 0;
            return {
                label: row[i].field_label,
                visible: (_is_added > 0),
                required: (row[i].is_required && row[i].is_required == true ? true : false),
            };
        }
    }
    return {
        label: '',
        visible: false,
        required: false,
    };
}

const temp_master_exists = async (unique_id) => {
    if (utils.isUUID(unique_id)) {
        const _query1 = `SELECT 
        temp_id, ip_address, added_date, entity_id, 
       
        first_name, middle_name, last_name, mobile_ccc, mobile_no, email_id, pan_no, org_type_id,
        mobile_validated, mobile_valid_date, email_validated, email_valid_date, pan_no_validated, pan_no_valid_date,

        company_name, registered_as_id, address_1, address_2, address_3, country_id, state_id, district_id, block_id,
        pin_code, contact_no, company_pan_no, gstin_no, cin_no, registration_no, it_80g_reg_no, it_12a_reg_no, 
        darpan_reg_no, mca_csr_f1_reg_no, fcra_no_with_status, fcra_no_status, expertise_area_id, fin_audit_rpt_filed,
        
        company_pan_no_validated, company_pan_no_valid_date, gstin_no_validated, gstin_no_valid_date, cin_no_validated, cin_no_valid_date
        
        FROM temp_master WHERE unique_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [unique_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            return row1[0];
        }
    }
    return null;
};

const temp_master_registered = async (temp_id) => {
    const _query1 = `SELECT reg_id FROM user_master WHERE temp_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [temp_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return true;
    }
    return false;
};

const temp_bank_exists = async (temp_id) => {
    const _query1 = `SELECT ifsc_code, bank_other, branch_other, ifsc_code_validated, ifsc_code_valid_date,
    account_no, re_account_no, account_type, account_no_validated, account_no_valid_date
    FROM temp_bank WHERE temp_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [temp_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return row1[0];
    }
    return null;
};

const temp_service_exists = async (temp_id, sub_cat_id) => {
    const _query1 = `SELECT t_id FROM temp_services WHERE temp_id = ? AND sub_cat_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [temp_id, sub_cat_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return row1[0];
    }
    return null;
};

const parent_organization = async (entity_id) => {
    var organizations = [];
    const _query1 = `SELECT d.org_type_id, d.org_type_name, d.org_type_lng_key, m.parent_entity 
    FROM parent_orgs_mast d INNER JOIN parent_orgs_mapp m ON d.org_type_id = m.org_type_id
    WHERE m.entity_id = ? AND d.is_enabled = true AND d.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        organizations.push({
            org_type_id: row1[i].org_type_id,
            org_type_name: row1[i].org_type_name,
            select_org_req: (row1[i].parent_entity && row1[i].parent_entity.length > 0 ? true : false),
        });
    }
    return organizations;
};

const designations = async (entity_id) => {
    var designations = [];
    const _query1 = `SELECT d.design_id, d.design_name, d.design_code 
    FROM designation_mast d INNER JOIN designation_mapp m ON d.design_id = m.design_id
    WHERE m.entity_id = ? AND d.is_enabled = true AND d.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        designations.push({
            design_id: row1[i].design_id,
            design_name: row1[i].design_name,
            design_code: row1[i].design_code,
        });
    }
    return designations;
};

const documents = async (entity_id) => {
    var documents = [];
    const _query1 = `SELECT d.document_id, d.doc_name, d.doc_lng_key, d.file_type_allowed, d.file_max_size, m.is_required 
    FROM document_mast d INNER JOIN document_mapp m ON d.document_id = m.document_id
    WHERE m.entity_id = ? AND d.is_enabled = true AND d.is_deleted = false
    ORDER BY CASE WHEN COALESCE(d.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(d.sort_order, 0) END, d.document_id DESC`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        var file_type_allowed = [];
        if (row1[i].file_type_allowed && row1[i].file_type_allowed.length > 0) {
            const file_type_allowed_array = row1[i].file_type_allowed.split(',');
            for (let k = 0; file_type_allowed_array && k < file_type_allowed_array.length; k++) {
                if (file_type_allowed_array[k] && file_type_allowed_array[k].trim().length > 0) {
                    file_type_allowed.push(file_type_allowed_array[k].trim());
                }
            }
        }
        var _file_max_size = row1[i].file_max_size && validator.isNumeric(row1[i].file_max_size.toString()) ? BigInt(row1[i].file_max_size) : 0;

        documents.push({
            document_id: row1[i].document_id,
            doc_name: row1[i].doc_name,
            doc_lng_key: row1[i].doc_lng_key,
            file_type_allowed: file_type_allowed,
            file_max_size: _file_max_size,
            is_required: row1[i].is_required,
        });
    }
    return documents;
};

const user_acc_documents = async (entity_id) => {
    var documents = [];
    const _query1 = `SELECT d.document_id, d.doc_name, d.doc_lng_key, d.file_type_allowed, d.file_max_size, m.is_required 
    FROM user_acc_doc_mast d INNER JOIN user_acc_doc_mapp m ON d.document_id = m.document_id
    WHERE m.entity_id = ? AND d.is_enabled = true AND d.is_deleted = false
    ORDER BY CASE WHEN COALESCE(d.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(d.sort_order, 0) END, d.document_id DESC`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        var file_type_allowed = [];
        if (row1[i].file_type_allowed && row1[i].file_type_allowed.length > 0) {
            const file_type_allowed_array = row1[i].file_type_allowed.split(',');
            for (let k = 0; file_type_allowed_array && k < file_type_allowed_array.length; k++) {
                if (file_type_allowed_array[k] && file_type_allowed_array[k].trim().length > 0) {
                    file_type_allowed.push(file_type_allowed_array[k].trim());
                }
            }
        }
        var _file_max_size = row1[i].file_max_size && validator.isNumeric(row1[i].file_max_size.toString()) ? BigInt(row1[i].file_max_size) : 0;

        documents.push({
            document_id: row1[i].document_id,
            doc_name: row1[i].doc_name,
            doc_lng_key: row1[i].doc_lng_key,
            file_type_allowed: file_type_allowed,
            file_max_size: _file_max_size,
            is_required: row1[i].is_required,
        });
    }
    return documents;
};

const csr_policy_documents = async (entity_id) => {
    var documents = [];
    const _query1 = `SELECT d.document_id, d.doc_name, d.doc_lng_key, d.file_type_allowed, d.file_max_size, m.is_required 
    FROM csr_policy_doc_mast d INNER JOIN csr_policy_doc_mapp m ON d.document_id = m.document_id
    WHERE m.entity_id = ? AND d.is_enabled = true AND d.is_deleted = false
    ORDER BY CASE WHEN COALESCE(d.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(d.sort_order, 0) END, d.document_id DESC`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        var file_type_allowed = [];
        if (row1[i].file_type_allowed && row1[i].file_type_allowed.length > 0) {
            const file_type_allowed_array = row1[i].file_type_allowed.split(',');
            for (let k = 0; file_type_allowed_array && k < file_type_allowed_array.length; k++) {
                if (file_type_allowed_array[k] && file_type_allowed_array[k].trim().length > 0) {
                    file_type_allowed.push(file_type_allowed_array[k].trim());
                }
            }
        }
        var _file_max_size = row1[i].file_max_size && validator.isNumeric(row1[i].file_max_size.toString()) ? BigInt(row1[i].file_max_size) : 0;

        documents.push({
            document_id: row1[i].document_id,
            doc_name: row1[i].doc_name,
            doc_lng_key: row1[i].doc_lng_key,
            file_type_allowed: file_type_allowed,
            file_max_size: _file_max_size,
            is_required: row1[i].is_required,
        });
    }
    return documents;
};

const registration_type = async (entity_id) => {
    var types = [];
    const _query1 = `SELECT d.reg_type_id, d.reg_type_name, d.reg_type_lng_key
    FROM entity_reg_type_mast d INNER JOIN entity_reg_type_mapp m ON d.reg_type_id = m.reg_type_id
    WHERE m.entity_id = ? AND d.is_enabled = true AND d.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        types.push({
            reg_type_id: row1[i].reg_type_id,
            reg_type_name: row1[i].reg_type_name,
            reg_type_lng_key: row1[i].reg_type_lng_key,
        });
    }
    return types;
};

const expertise_area = async (entity_id) => {
    var areas = [];
    const _query1 = `SELECT d.expertise_area_id, d.expertise_name, d.expertise_lng_key
    FROM expertise_area_mast d INNER JOIN expertise_area_mapp m ON d.expertise_area_id = m.expertise_area_id
    WHERE m.entity_id = ? AND d.is_enabled = true AND d.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        areas.push({
            expertise_area_id: row1[i].expertise_area_id,
            expertise_name: row1[i].expertise_name,
            expertise_lng_key: row1[i].expertise_lng_key,
        });
    }
    return areas;
};

const services_data = async (entity_id, is_enabled) => {
    var services = [];
    if (is_enabled) {
        const _query1 = `SELECT jsonb_build_object('id', h.head_id, 'name', h.head_name, 'category', coalesce(cat.categories, '[]')) as row_data
        FROM services_head h
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(jsonb_build_object('id', c.category_id, 'name', c.category_name,  'sub_category', coalesce(sub_cat.sub_cats, '[]')   )) as categories
            FROM services_category c
              LEFT JOIN LATERAL(	  
                  SELECT jsonb_agg(jsonb_build_object('id', s.sub_cat_id, 'name', s.sub_cat_name)) as sub_cats
                  FROM services_sub_cat s WHERE s.category_id = c.category_id AND s.is_deleted = false AND s.is_enabled = true		  
              ) as sub_cat on true
            WHERE c.head_id = h.head_id AND c.is_deleted = false AND c.is_enabled = true AND sub_cat.sub_cats IS NOT NULL
          ) as cat on true
         WHERE h.is_deleted = false AND h.is_enabled = true AND cat.categories IS NOT NULL`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        for (let i = 0; row1 && i < row1.length; i++) {
            services.push(row1[i].row_data);
        }
    }
    return services;
};

const generate_mobile_otp = async (temp_id, mobile_no, get_new_only) => {
    var generate_new = true; var mobile_otp_code = '';
    if (!get_new_only) {
        const _query3 = `SELECT mobile_no, mobile_otp_code, NOW() AS current_date, mobile_otp_time + INTERVAL ':expired_on Second' AS expiry_time FROM temp_master WHERE temp_id = :temp_id`;
        const _replacements3 = { temp_id: temp_id, expired_on: parseInt(process.env.MOBILE_OTP_EXPIRY) }
        const row1 = await db.sequelize.query(utils.build_query_obj(_query3, _replacements3), { type: QueryTypes.SELECT });
        if (row1 && row1.length > 0 && row1[0].mobile_no == mobile_no) {
            if (row1[0].mobile_otp_code && row1[0].mobile_otp_code.length > 0) {
                if (row1[0].current_date < row1[0].expiry_time) {
                    generate_new = false; mobile_otp_code = row1[0].mobile_otp_code;
                }
            }
        }
    }
    if (mobile_otp_code.length <= 0) {
        mobile_otp_code = utils.random_int(constants.otp_length).toString();
        mobile_otp_code = '111111';
        generate_new = true;
    }
    if (generate_new) {
        const _query4 = `UPDATE temp_master SET mobile_no = ?, mobile_otp_code = ?, mobile_otp_time = ?, mobile_validated = false WHERE temp_id = ?`;
        const _replacements4 = [mobile_no, mobile_otp_code, new Date(), temp_id];
        await db.sequelize.query(_query4, { replacements: _replacements4, type: QueryTypes.UPDATE });
    }
    return mobile_otp_code;
};

const generate_email_otp = async (temp_id, email_id, get_new_only) => {
    var generate_new = true; var email_otp_code = '';
    if (!get_new_only) {
        const _query3 = `SELECT email_id, email_otp_code, NOW() AS current_date, email_otp_time + INTERVAL ':expired_on Second' AS expiry_time FROM temp_master WHERE temp_id = :temp_id`;
        const _replacements3 = { temp_id: temp_id, expired_on: parseInt(process.env.EMAIL_OTP_EXPIRY) }
        const row1 = await db.sequelize.query(utils.build_query_obj(_query3, _replacements3), { type: QueryTypes.SELECT });
        if (row1 && row1.length > 0 && row1[0].email_id == email_id) {
            if (row1[0].email_otp_code && row1[0].email_otp_code.length > 0) {
                if (row1[0].current_date < row1[0].expiry_time) {
                    generate_new = false; email_otp_code = row1[0].email_otp_code;
                }
            }
        }
    }
    if (email_otp_code.length <= 0) {
        email_otp_code = utils.random_int(constants.otp_length).toString();
        email_otp_code = '111111';
        generate_new = true;
    }
    if (generate_new) {
        const _query4 = `UPDATE temp_master SET email_id = ?, email_otp_code = ?, email_otp_time = ?, email_validated = false WHERE temp_id = ?`;
        const _replacements4 = [email_id, email_otp_code, new Date(), temp_id];
        await db.sequelize.query(_query4, { replacements: _replacements4, type: QueryTypes.UPDATE });
    }
    return email_otp_code;
};

const temp_services_selected = async (temp_id) => {
    var list = [];
    const _query4 = `SELECT c.head_id, h.head_name, sc.category_id, c.category_name, us.sub_cat_id, sc.sub_cat_name, us.range_size, us.price 
    FROM temp_services us INNER JOIN services_sub_cat sc ON us.sub_cat_id = sc.sub_cat_id LEFT OUTER JOIN services_category c ON sc.category_id = c.category_id
    LEFT OUTER JOIN services_head h ON c.head_id = h.head_id WHERE us.temp_id = ?`;
    const row4 = await db.sequelize.query(_query4, { replacements: [temp_id], type: QueryTypes.SELECT });
    for (let i = 0; row4 && i < row4.length; i++) {
        const serEle = row4[i];
        list.push({
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
    return list;
};

const temp_dynamic_field_values = async (temp_id) => {
    var list = [];
    const _query4 = `SELECT static_field_id, user_value FROM temp_field_values WHERE temp_id = ?`;
    const row4 = await db.sequelize.query(_query4, { replacements: [temp_id], type: QueryTypes.SELECT });
    for (let i = 0; row4 && i < row4.length; i++) {
        const serEle = row4[i];
        list.push({
            field_id: serEle.static_field_id,
            user_value: serEle.user_value,
        });
    }
    return list;
};

module.exports = {
    registration_static_fields,
    temp_master_exists,
    temp_master_registered,
    temp_bank_exists,
    temp_service_exists,
    parent_organization,
    designations,
    documents,
    user_acc_documents,
    csr_policy_documents,
    registration_type,
    expertise_area,
    services_data,

    generate_mobile_otp,
    generate_email_otp,

    temp_services_selected,
    temp_dynamic_field_values,
};