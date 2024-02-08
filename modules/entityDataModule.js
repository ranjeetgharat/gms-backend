const _logger = require('../logger/winston').logger;
const db = require('../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
var validator = require('validator');
const crypto = require('crypto');
const registrationModule = require('./registrationModule');
const cloudStorageModule = require('./cloudStorageModule');
var dateFormat = require('date-format');
const utils = require('../utilities/utils');

const search_entities = async (logged_reg_id, entity_id, page_no, search_text, country_id, state_id, district_id, block_id) => {
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

    const _query0 = `SELECT count(1) AS total_record FROM user_master um WHERE um.entity_id = :entity_id AND um.is_deleted = false
    AND COALESCE(um.approve_status, 0) = 1 AND um.reg_id <> :reg_id ${_sql_condition}`;

    const row0 = await db.sequelize.query(_query0, {
        replacements: {
            reg_id: logged_reg_id,
            entity_id: entity_id,
            search_text: '%' + _search_text + '%',
            country_id: _country_id,
            state_id: _state_id,
            district_id: _district_id,
            block_id: _block_id,
        }, type: QueryTypes.SELECT
    });
    var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

    const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY um.reg_id DESC) AS sr_no,
    um.unique_id, um.first_name, um.middle_name, um.last_name, um.email_id, um.mobile_no, um.company_name, um.registration_no,
    rt.reg_type_name AS registered_as, c.country_name, s.state_name, d.district_name, b.block_name, um.pin_code,
    um.is_enabled, um.approve_status, um.approved_date, um.rejected_date
    FROM user_master um LEFT OUTER JOIN entity_reg_type_mast rt ON um.registered_as_id = rt.reg_type_id 
    LEFT OUTER JOIN countries c ON um.country_id = c.country_id LEFT OUTER JOIN states s ON um.state_id = s.state_id
    LEFT OUTER JOIN districts d ON um.district_id = d.district_id LEFT OUTER JOIN blocks b ON um.block_id = b.block_id
    WHERE um.entity_id = :entity_id AND um.is_deleted = false AND COALESCE(um.approve_status, 0) = 1 AND um.reg_id <> :reg_id 
    ${_sql_condition} LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;

    const row1 = await db.sequelize.query(_query1, {
        replacements: {
            reg_id: logged_reg_id,
            entity_id: entity_id,
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
            first_name: row1[i].first_name,
            middle_name: row1[i].middle_name,
            last_name: row1[i].last_name,
            email_id: row1[i].email_id,
            mobile_no: row1[i].mobile_no,
            company_name: row1[i].company_name,
            registered_as: row1[i].registered_as,
            country_name: row1[i].country_name,
            state_name: row1[i].state_name,
            district_name: row1[i].district_name,
            block_name: row1[i].block_name,
            pin_code: row1[i].pin_code,
            registration_no: row1[i].registration_no,
            is_enabled: row1[i].is_enabled,
            approve_status: row1[i].approve_status,
            approved_date: row1[i].approved_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].approved_date)) : "",
            rejected_date: row1[i].rejected_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].rejected_date)) : "",
        });
    }
    const results = {
        current_page: _page_no,
        total_pages: Math.ceil(total_record / parseInt(process.env.PAGINATION_SIZE)),
        total_record: total_record,
        data: list,
    };
    return results;
};

const profile_validation_field = async (entity_id, form_static_fields_json) => {
    var form_static_fields = {};
    if (form_static_fields_json && form_static_fields_json.length > 0) {
        try {
            form_static_fields = JSON.parse(form_static_fields_json);
        } catch (_) {
            form_static_fields = await registrationModule.registration_static_fields(entity_id);
        }
    } else {
        form_static_fields = await registrationModule.registration_static_fields(entity_id);
    }
    return form_static_fields;
};

const user_master_get_id = async (unique_id) => {
    var reg_id = 0;
    const _query2 = `SELECT reg_id FROM user_master WHERE unique_id = ?`;
    const row2 = await db.sequelize.query(_query2, { replacements: [unique_id], type: QueryTypes.SELECT });
    if (row2 && row2.length > 0) {
        reg_id = row2[0].reg_id && validator.isNumeric(row2[0].reg_id.toString()) ? BigInt(row2[0].reg_id) : 0;
    }
    return reg_id;
};

const admin_account_view_list = async (reg_id) => {
    var list = [];
    const _query2 = `SELECT ua.first_name, ua.middle_name, ua.last_name, ua.email_id, ua.mobile_no, dm.design_name
    FROM user_account ua LEFT OUTER JOIN designation_mast dm ON ua.design_id = dm.design_id 
    WHERE ua.reg_id = ? AND ua.is_admin = true AND ua.is_enabled = true AND ua.is_deleted = false`;
    const row2 = await db.sequelize.query(_query2, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row2 && i < row2.length; i++) {
        list.push({
            first_name: row2[i].first_name,
            middle_name: row2[i].middle_name,
            last_name: row2[i].last_name,
            email_id: row2[i].email_id,
            mobile_no: row2[i].mobile_no,
            design_name: row2[i].design_name,
        });
    }
    return list;
};

const expertise_areas = async (reg_id) => {
    var list = [];
    const _query2 = `SELECT expertise_area_id FROM user_expertise WHERE reg_id = ?`;
    const row2 = await db.sequelize.query(_query2, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row2 && i < row2.length; i++) {
        const _ax = row2[i].expertise_area_id && validator.isNumeric(row2[i].expertise_area_id.toString()) ? BigInt(row2[i].expertise_area_id) : 0;
        if (_ax > 0) {
            list.push(_ax);
        }
    }
    return list;
};

const expertise_area_names = async (reg_id) => {
    var list = [];
    const _query2 = `SELECT em.expertise_name FROM user_expertise ue INNER JOIN expertise_area_mast em ON ue.expertise_area_id = em.expertise_area_id WHERE ue.reg_id = ?`;
    const row2 = await db.sequelize.query(_query2, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row2 && i < row2.length; i++) {
        list.push(row2[i].expertise_name);
    }
    return list;
};

const services = async (reg_id) => {
    var list = [];
    const _query4 = `SELECT us.u_serv_id, c.head_id, h.head_name, sc.category_id, c.category_name, us.sub_cat_id, sc.sub_cat_name, us.range_size, us.price 
            FROM user_services us INNER JOIN services_sub_cat sc ON us.sub_cat_id = sc.sub_cat_id LEFT OUTER JOIN services_category c ON sc.category_id = c.category_id
            LEFT OUTER JOIN services_head h ON c.head_id = h.head_id WHERE us.reg_id = ? AND us.is_deleted = false`;
    const row4 = await db.sequelize.query(_query4, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row4 && i < row4.length; i++) {
        const serEle = row4[i];
        list.push({
            u_serv_id: serEle.u_serv_id,
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

const bank_accounts = async (reg_id) => {
    var list = [];
    const _query5 = `SELECT bm.ubank_id, bm.account_no, bm.re_account_no, bm.account_type, bm.ifsc_code, bb.branch_id, b.bank_id,
    bb.branch_name, b.bank_name, bm.bank_other, bm.branch_other, bm.consent_provided 
    FROM user_bank bm LEFT OUTER JOIN bank_branch bb ON LOWER(bm.ifsc_code) = LOWER(bb.ifsc_code) 
    LEFT OUTER JOIN bank_mast b ON bb.bank_id = b.bank_id WHERE bm.reg_id = ? AND bm.is_deleted = false ORDER BY bm.ubank_id`;
    const row5 = await db.sequelize.query(_query5, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row5 && i < row5.length; i++) {
        const bnkEle = row5[i];
        var _account_type = (bnkEle.account_type && validator.isNumeric(bnkEle.account_type.toString())) ? parseInt(bnkEle.account_type) : 0;
        var _branch_id = (bnkEle.branch_id && validator.isNumeric(bnkEle.branch_id.toString())) ? BigInt(bnkEle.branch_id) : 0;
        var _bank_id = (bnkEle.bank_id && validator.isNumeric(bnkEle.bank_id.toString())) ? BigInt(bnkEle.bank_id) : 0;

        list.push({
            ubank_id: bnkEle.ubank_id,
            account_no: bnkEle.account_no,
            re_account_no: bnkEle.re_account_no,
            account_type: _account_type,
            ifsc_code: bnkEle.ifsc_code,
            branch_id: _branch_id,
            bank_branch: (_branch_id > 0 ? bnkEle.branch_name : bnkEle.branch_other),
            bank_id: _bank_id,
            bank_name: (_bank_id > 0 ? bnkEle.bank_name : bnkEle.bank_other),
            consent_provided: bnkEle.consent_provided,
        });
    }
    return list;
};

const entity_document_uploaded = async (reg_id) => {
    var list = [];
    const _query1 = `SELECT doc_file_id, document_id, original_file_name, new_file_name, gcp_file_path FROM user_document WHERE reg_id = ? AND is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            file_id: row1[i].doc_file_id,
            document_id: row1[i].document_id,
            file_name: row1[i].original_file_name,
            new_name: row1[i].new_file_name,
            file_path: row1[i].gcp_file_path,
        });
    }
    return list;
};

const entity_document_signed_url = async (modify_id, file_id, document_id) => {
    var results = { status: false, msg: "", doc_name: "", file_name: "", new_name: "", file_path: "", file_url: "", };
    if (file_id > 0) {
        const _query1 = `SELECT dm.doc_name, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM user_document ud INNER JOIN document_mast dm ON ud.document_id = dm.document_id
        WHERE ud.doc_file_id = ? AND ud.is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [file_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
            results.status = true;
            results.doc_name = row1[0].doc_name;
            results.file_name = row1[0].original_file_name;
            results.new_name = row1[0].new_file_name;
            results.file_path = row1[0].gcp_file_path;
            results.file_url = resp;
        } else {
            results.msg = "Document details not found.";
        }
    } else {
        const _query1 = `SELECT dm.doc_name, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM modify_document ud INNER JOIN document_mast dm ON ud.document_id = dm.document_id
        WHERE ud.modify_id = ? AND ud.document_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [modify_id, document_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
            results.status = true;
            results.doc_name = row1[0].doc_name;
            results.file_name = row1[0].original_file_name;
            results.new_name = row1[0].new_file_name;
            results.file_path = row1[0].gcp_file_path;
            results.file_url = resp;
        } else {
            results.msg = "Document details not found.";
        }
    }
    return results;
};

const user_acc_document_uploaded = async (user_id) => {
    var list = [];
    const _query1 = `SELECT doc_file_id, document_id, original_file_name, new_file_name, gcp_file_path FROM user_acc_doc_upload WHERE user_id = ? AND is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [user_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            file_id: row1[i].doc_file_id,
            document_id: row1[i].document_id,
            file_name: row1[i].original_file_name,
            new_name: row1[i].new_file_name,
            file_path: row1[i].gcp_file_path,
        });
    }
    return list;
};

const user_acc_document_signed_url = async (modify_id, file_id, document_id) => {
    var results = { status: false, msg: "", doc_name: "", file_name: "", new_name: "", file_path: "", file_url: "", };
    if (file_id > 0) {
        const _query1 = `SELECT dm.doc_name, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM user_acc_doc_upload ud INNER JOIN user_acc_doc_mast dm ON ud.document_id = dm.document_id
        WHERE ud.doc_file_id = ? AND ud.is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [file_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
            results.status = true;
            results.doc_name = row1[0].doc_name;
            results.file_name = row1[0].original_file_name;
            results.new_name = row1[0].new_file_name;
            results.file_path = row1[0].gcp_file_path;
            results.file_url = resp;
        } else {
            results.msg = "Document details not found.";
        }
    } else {
        const _query1 = `SELECT dm.doc_name, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM modify_acc_doc_upload ud INNER JOIN user_acc_doc_mast dm ON ud.document_id = dm.document_id
        WHERE ud.modify_id = ? AND ud.document_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [modify_id, document_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
            results.status = true;
            results.doc_name = row1[0].doc_name;
            results.file_name = row1[0].original_file_name;
            results.new_name = row1[0].new_file_name;
            results.file_path = row1[0].gcp_file_path;
            results.file_url = resp;
        } else {
            results.msg = "Document details not found.";
        }
    }
    return results;
};

const csr_docs_document_uploaded = async (reg_id) => {
    var list = [];
    const _query1 = `SELECT doc_file_id, document_id, original_file_name, new_file_name, gcp_file_path FROM user_csr_policy_docs WHERE reg_id = ? AND is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            file_id: row1[i].doc_file_id,
            document_id: row1[i].document_id,
            file_name: row1[i].original_file_name,
            new_name: row1[i].new_file_name,
            file_path: row1[i].gcp_file_path,
        });
    }
    return list;
};

const csr_docs_document_signed_url = async (modify_id, file_id, document_id) => {
    var results = { status: false, msg: "", doc_name: "", file_name: "", new_name: "", file_path: "", file_url: "", };
    if (file_id > 0) {
        const _query1 = `SELECT dm.doc_name, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM user_csr_policy_docs ud INNER JOIN csr_policy_doc_mast dm ON ud.document_id = dm.document_id
        WHERE ud.doc_file_id = ? AND ud.is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [file_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
            results.status = true;
            results.doc_name = row1[0].doc_name;
            results.file_name = row1[0].original_file_name;
            results.new_name = row1[0].new_file_name;
            results.file_path = row1[0].gcp_file_path;
            results.file_url = resp;
        } else {
            results.msg = "Document details not found.";
        }
    } else {
        const _query1 = `SELECT dm.doc_name, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM modify_csr_policy_docs ud INNER JOIN csr_policy_doc_mast dm ON ud.document_id = dm.document_id
        WHERE ud.modify_id = ? AND ud.document_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [modify_id, document_id], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
            results.status = true;
            results.doc_name = row1[0].doc_name;
            results.file_name = row1[0].original_file_name;
            results.new_name = row1[0].new_file_name;
            results.file_path = row1[0].gcp_file_path;
            results.file_url = resp;
        } else {
            results.msg = "Document details not found.";
        }
    }
    return results;
};

const board_members = async (reg_id) => {
    var list = [];
    const _queryb1 = `SELECT member_id, full_name, designation, email_id, mobile_ccc, mobile_no 
    FROM user_board_member WHERE reg_id = ? AND is_deleted = false`;
    const rowb1 = await db.sequelize.query(_queryb1, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; rowb1 && i < rowb1.length; i++) {
        list.push({
            member_id: rowb1[i].member_id,
            full_name: rowb1[i].full_name,
            designation: rowb1[i].designation,
            email_id: rowb1[i].email_id,
            mobile_ccc: rowb1[i].mobile_ccc,
            mobile_no: rowb1[i].mobile_no,
        });
    }
    return list;
};

const csr_committee_members = async (reg_id) => {
    var list = [];
    const _queryc1 = `SELECT member_id, full_name, designation, email_id, mobile_ccc, mobile_no 
    FROM user_csr_member WHERE reg_id = ? AND is_deleted = false`;
    const rowc1 = await db.sequelize.query(_queryc1, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; rowc1 && i < rowc1.length; i++) {
        list.push({
            member_id: rowc1[i].member_id,
            full_name: rowc1[i].full_name,
            designation: rowc1[i].designation,
            email_id: rowc1[i].email_id,
            mobile_ccc: rowc1[i].mobile_ccc,
            mobile_no: rowc1[i].mobile_no,
        });
    }
    return list;
};


const modified_entity_document_uploaded = async (modify_id) => {
    var list = [];
    const _query3 = `SELECT document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data, to_delete FROM modify_document WHERE modify_id = ?`;
    const row3 = await db.sequelize.query(_query3, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row3 && i < row3.length; i++) {
        list.push({
            file_id: 0,
            document_id: row3[i].document_id,
            file_name: row3[i].original_file_name,
            new_name: row3[i].new_file_name,
            file_path: row3[i].gcp_file_path,
            to_delete: row3[i].to_delete,
            gcp_resp: row3[i].gcp_response_data,
        });
    }
    return list;
};

const modified_entity_document_uploaded_old = async (modify_id) => {
    var list = [];
    const _query3 = `SELECT doc_file_id, document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data 
    FROM modify_document_old WHERE modify_id = ?`;
    const row3 = await db.sequelize.query(_query3, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row3 && i < row3.length; i++) {
        list.push({
            file_id: row3[i].doc_file_id,
            document_id: row3[i].document_id,
            file_name: row3[i].original_file_name,
            new_name: row3[i].new_file_name,
            file_path: row3[i].gcp_file_path,
            gcp_resp: row3[i].gcp_response_data,
        });
    }
    return list;
};

const modified_user_acc_document_uploaded = async (modify_id) => {
    var list = [];
    const _query33 = `SELECT document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data, to_delete FROM modify_acc_doc_upload WHERE modify_id = ?`;
    const row33 = await db.sequelize.query(_query33, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row33 && i < row33.length; i++) {
        list.push({
            file_id: 0,
            document_id: row33[i].document_id,
            file_name: row33[i].original_file_name,
            new_name: row33[i].new_file_name,
            file_path: row33[i].gcp_file_path,
            to_delete: row33[i].to_delete,
            gcp_resp: row33[i].gcp_response_data,
        });
    }
    return list;
};

const modified_user_acc_document_uploaded_old = async (modify_id) => {
    var list = [];
    const _query33 = `SELECT doc_file_id, document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data
    FROM modify_acc_doc_upload_old WHERE modify_id = ?`;
    const row33 = await db.sequelize.query(_query33, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row33 && i < row33.length; i++) {
        list.push({
            file_id: row33[i].doc_file_id,
            document_id: row33[i].document_id,
            file_name: row33[i].original_file_name,
            new_name: row33[i].new_file_name,
            file_path: row33[i].gcp_file_path,
            gcp_resp: row33[i].gcp_response_data,
        });
    }
    return list;
};

const modified_csr_docs_document_uploaded = async (modify_id) => {
    var list = [];
    const _query33 = `SELECT document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data, to_delete FROM modify_csr_policy_docs WHERE modify_id = ?`;
    const row33 = await db.sequelize.query(_query33, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row33 && i < row33.length; i++) {
        list.push({
            file_id: 0,
            document_id: row33[i].document_id,
            file_name: row33[i].original_file_name,
            new_name: row33[i].new_file_name,
            file_path: row33[i].gcp_file_path,
            to_delete: row33[i].to_delete,
            gcp_resp: row33[i].gcp_response_data,
        });
    }
    return list;
};

const modified_csr_docs_document_uploaded_old = async (modify_id) => {
    var list = [];
    const _query33 = `SELECT doc_file_id, document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data
    FROM modify_csr_policy_docs_old WHERE modify_id = ?`;
    const row33 = await db.sequelize.query(_query33, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row33 && i < row33.length; i++) {
        list.push({
            file_id: row33[i].doc_file_id,
            document_id: row33[i].document_id,
            file_name: row33[i].original_file_name,
            new_name: row33[i].new_file_name,
            file_path: row33[i].gcp_file_path,
            gcp_resp: row33[i].gcp_response_data,
        });
    }
    return list;
};

const modified_expertise_area_names = async (modify_id) => {
    var list = [];
    const _query2 = `SELECT em.expertise_name FROM modify_expertise ue INNER JOIN expertise_area_mast em ON ue.expertise_area_id = em.expertise_area_id WHERE ue.modify_id = ?`;
    const row2 = await db.sequelize.query(_query2, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row2 && i < row2.length; i++) {
        list.push(row2[i].expertise_name);
    }
    return list;
};

const modified_expertise_area_names_old = async (modify_id) => {
    var list = [];
    const _query2 = `SELECT em.expertise_name FROM modify_expertise_old ue INNER JOIN expertise_area_mast em ON ue.expertise_area_id = em.expertise_area_id WHERE ue.modify_id = ?`;
    const row2 = await db.sequelize.query(_query2, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row2 && i < row2.length; i++) {
        list.push(row2[i].expertise_name);
    }
    return list;
};

const modified_services = async (modify_id) => {
    var list = [];
    const _query4 = `SELECT ms.u_serv_id, c.head_id, h.head_name, sc.category_id, c.category_name, ms.sub_cat_id, sc.sub_cat_name, ms.range_size, ms.price 
    FROM modify_services ms INNER JOIN services_sub_cat sc ON ms.sub_cat_id = sc.sub_cat_id LEFT OUTER JOIN services_category c ON sc.category_id = c.category_id
    LEFT OUTER JOIN services_head h ON c.head_id = h.head_id WHERE ms.modify_id = ?`;
    const row4 = await db.sequelize.query(_query4, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row4 && i < row4.length; i++) {
        const serEle = row4[i];
        list.push({
            u_serv_id: serEle.u_serv_id,
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

const modified_services_old = async (modify_id) => {
    var list = [];
    const _query4 = `SELECT ms.u_serv_id, c.head_id, h.head_name, sc.category_id, c.category_name, ms.sub_cat_id, sc.sub_cat_name, ms.range_size, ms.price 
    FROM modify_services_old ms INNER JOIN services_sub_cat sc ON ms.sub_cat_id = sc.sub_cat_id LEFT OUTER JOIN services_category c ON sc.category_id = c.category_id
    LEFT OUTER JOIN services_head h ON c.head_id = h.head_id WHERE ms.modify_id = ?`;
    const row4 = await db.sequelize.query(_query4, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row4 && i < row4.length; i++) {
        const serEle = row4[i];
        list.push({
            u_serv_id: serEle.u_serv_id,
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

const modified_bank_accounts = async (modify_id) => {
    var list = [];
    const _query5 = `SELECT bm.ubank_id, bm.account_no, bm.re_account_no, bm.account_type, bm.ifsc_code, bb.branch_id, b.bank_id,
    bb.branch_name, b.bank_name, bm.bank_other, bm.branch_other, bm.consent_provided 
    FROM modify_bank bm LEFT OUTER JOIN bank_branch bb ON LOWER(bm.ifsc_code) = LOWER(bb.ifsc_code) 
    LEFT OUTER JOIN bank_mast b ON bb.bank_id = b.bank_id WHERE modify_id = ?`;
    const row5 = await db.sequelize.query(_query5, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row5 && i < row5.length; i++) {
        const bnkEle = row5[i];
        var _account_type = (bnkEle.account_type && validator.isNumeric(bnkEle.account_type.toString())) ? parseInt(bnkEle.account_type) : 0;
        var _branch_id = (bnkEle.branch_id && validator.isNumeric(bnkEle.branch_id.toString())) ? BigInt(bnkEle.branch_id) : 0;
        var _bank_id = (bnkEle.bank_id && validator.isNumeric(bnkEle.bank_id.toString())) ? BigInt(bnkEle.bank_id) : 0;

        list.push({
            ubank_id: bnkEle.ubank_id,
            account_no: bnkEle.account_no,
            re_account_no: bnkEle.re_account_no,
            account_type: _account_type,
            ifsc_code: bnkEle.ifsc_code,
            branch_id: _branch_id,
            bank_branch: (_branch_id > 0 ? bnkEle.branch_name : bnkEle.branch_other),
            bank_id: _bank_id,
            bank_name: (_bank_id > 0 ? bnkEle.bank_name : bnkEle.bank_other),
            consent_provided: bnkEle.consent_provided,
        });
    }
    return list;
};

const modified_bank_accounts_old = async (modify_id) => {
    var list = [];
    const _query5 = `SELECT bm.ubank_id, bm.account_no, bm.re_account_no, bm.account_type, bm.ifsc_code, bb.branch_id, b.bank_id,
    bb.branch_name, b.bank_name, bm.bank_other, bm.branch_other, bm.consent_provided 
    FROM modify_bank_old bm LEFT OUTER JOIN bank_branch bb ON LOWER(bm.ifsc_code) = LOWER(bb.ifsc_code) 
    LEFT OUTER JOIN bank_mast b ON bb.bank_id = b.bank_id WHERE modify_id = ?`;
    const row5 = await db.sequelize.query(_query5, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; row5 && i < row5.length; i++) {
        const bnkEle = row5[i];
        var _account_type = (bnkEle.account_type && validator.isNumeric(bnkEle.account_type.toString())) ? parseInt(bnkEle.account_type) : 0;
        var _branch_id = (bnkEle.branch_id && validator.isNumeric(bnkEle.branch_id.toString())) ? BigInt(bnkEle.branch_id) : 0;
        var _bank_id = (bnkEle.bank_id && validator.isNumeric(bnkEle.bank_id.toString())) ? BigInt(bnkEle.bank_id) : 0;

        list.push({
            ubank_id: bnkEle.ubank_id,
            account_no: bnkEle.account_no,
            re_account_no: bnkEle.re_account_no,
            account_type: _account_type,
            ifsc_code: bnkEle.ifsc_code,
            branch_id: _branch_id,
            bank_branch: (_branch_id > 0 ? bnkEle.branch_name : bnkEle.branch_other),
            bank_id: _bank_id,
            bank_name: (_bank_id > 0 ? bnkEle.bank_name : bnkEle.bank_other),
            consent_provided: bnkEle.consent_provided,
        });
    }
    return list;
};

const modified_board_members = async (modify_id) => {
    var list = [];
    const _queryb1 = `SELECT member_id, full_name, designation, email_id, mobile_ccc, mobile_no 
    FROM modify_board_member WHERE modify_id = ?`;
    const rowb1 = await db.sequelize.query(_queryb1, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; rowb1 && i < rowb1.length; i++) {
        list.push({
            member_id: rowb1[i].member_id,
            full_name: rowb1[i].full_name,
            designation: rowb1[i].designation,
            email_id: rowb1[i].email_id,
            mobile_ccc: rowb1[i].mobile_ccc,
            mobile_no: rowb1[i].mobile_no,
        });
    }
    return list;
};

const modified_board_members_old = async (modify_id) => {
    var list = [];
    const _queryb1 = `SELECT member_id, full_name, designation, email_id, mobile_ccc, mobile_no 
    FROM modify_board_member_old WHERE modify_id = ?`;
    const rowb1 = await db.sequelize.query(_queryb1, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; rowb1 && i < rowb1.length; i++) {
        list.push({
            member_id: rowb1[i].member_id,
            full_name: rowb1[i].full_name,
            designation: rowb1[i].designation,
            email_id: rowb1[i].email_id,
            mobile_ccc: rowb1[i].mobile_ccc,
            mobile_no: rowb1[i].mobile_no,
        });
    }
    return list;
};

const modified_csr_committee_members = async (modify_id) => {
    var list = [];
    const _queryc1 = `SELECT member_id, full_name, designation, email_id, mobile_ccc, mobile_no FROM modify_csr_member WHERE modify_id = ?`;
    const rowc1 = await db.sequelize.query(_queryc1, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; rowc1 && i < rowc1.length; i++) {
        list.push({
            member_id: rowc1[i].member_id,
            full_name: rowc1[i].full_name,
            designation: rowc1[i].designation,
            email_id: rowc1[i].email_id,
            mobile_ccc: rowc1[i].mobile_ccc,
            mobile_no: rowc1[i].mobile_no,
        });
    }
    return list;
};

const modified_csr_committee_members_old = async (modify_id) => {
    var list = [];
    const _queryc1 = `SELECT member_id, full_name, designation, email_id, mobile_ccc, mobile_no 
    FROM modify_csr_member_old WHERE modify_id = ?`;
    const rowc1 = await db.sequelize.query(_queryc1, { replacements: [modify_id], type: QueryTypes.SELECT });
    for (let i = 0; rowc1 && i < rowc1.length; i++) {
        list.push({
            member_id: rowc1[i].member_id,
            full_name: rowc1[i].full_name,
            designation: rowc1[i].designation,
            email_id: rowc1[i].email_id,
            mobile_ccc: rowc1[i].mobile_ccc,
            mobile_no: rowc1[i].mobile_no,
        });
    }
    return list;
};

const project_purpose_ignore_list = async (entity_id) => {
    var list = [];
    const _query1 = `SELECT project_purpose_ignore FROM entity_type WHERE entity_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        if (row1[0].project_purpose_ignore && row1[0].project_purpose_ignore.length > 0) {
            for (let i = 0; i < row1[0].project_purpose_ignore.length; i++) {
                const _purpose_ignore = row1[0].project_purpose_ignore[i] != null && validator.isNumeric(row1[0].project_purpose_ignore[i].toString()) ? BigInt(row1[0].project_purpose_ignore[i]) : 0;
                if (_purpose_ignore > 0) {
                    list.push(_purpose_ignore);
                }
            }
        }
    }
    return list;
};

const project_visible_to_ia_list = async (visible_ia_list) => {
    var list = [];
    const _querySelIA = `SELECT ROW_NUMBER() OVER(ORDER BY um.reg_id DESC) AS sr_no,
    um.unique_id, um.first_name, um.middle_name, um.last_name, um.email_id, um.mobile_no, um.company_name, um.registration_no,
    rt.reg_type_name AS registered_as, c.country_name, s.state_name, d.district_name, b.block_name, um.pin_code,
    um.is_enabled, um.approve_status, um.approved_date, um.rejected_date
    FROM user_master um LEFT OUTER JOIN entity_reg_type_mast rt ON um.registered_as_id = rt.reg_type_id 
    LEFT OUTER JOIN countries c ON um.country_id = c.country_id LEFT OUTER JOIN states s ON um.state_id = s.state_id
    LEFT OUTER JOIN districts d ON um.district_id = d.district_id LEFT OUTER JOIN blocks b ON um.block_id = b.block_id
    WHERE um.is_deleted = false AND COALESCE(um.approve_status, 0) = 1 AND um.reg_id IN (?)`;
    const rowSelIA = await db.sequelize.query(_querySelIA, { replacements: [visible_ia_list], type: QueryTypes.SELECT });
    for (let i = 0; rowSelIA && i < rowSelIA.length; i++) {
        const eleItem = rowSelIA[i];
        list.push({
            sr_no: eleItem.sr_no,
            id: eleItem.unique_id,
            first_name: eleItem.first_name,
            middle_name: eleItem.middle_name,
            last_name: eleItem.last_name,
            email_id: eleItem.email_id,
            mobile_no: eleItem.mobile_no,
            company_name: eleItem.company_name,
            registered_as: eleItem.registered_as,
            country_name: eleItem.country_name,
            state_name: eleItem.state_name,
            district_name: eleItem.district_name,
            block_name: eleItem.block_name,
            pin_code: eleItem.pin_code,
            registration_no: eleItem.registration_no,
            is_enabled: eleItem.is_enabled,
            approve_status: eleItem.approve_status,
            approved_date: eleItem.approved_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(eleItem.approved_date)) : "",
            rejected_date: eleItem.rejected_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(eleItem.rejected_date)) : "",
        });
    }
    return list;
};



const project_document_uploaded = async (project_id) => {
    var list = [];
    const _query1 = `SELECT doc_file_id, document_id, original_file_name, new_file_name, gcp_file_path FROM project_document WHERE project_id = ? AND is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [project_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            file_id: row1[i].doc_file_id,
            document_id: row1[i].document_id,
            file_name: row1[i].original_file_name,
            new_name: row1[i].new_file_name,
            file_path: row1[i].gcp_file_path,
        });
    }
    return list;
};

const project_document_view_uploaded = async (project_id) => {
    var list = [];
    const _query1 = `SELECT pd.doc_file_id, dm.doc_name, pd.original_file_name, pd.new_file_name, pd.gcp_file_path 
    FROM project_document pd LEFT OUTER JOIN rfp_doc_mast dm ON pd.document_id = dm.document_id WHERE pd.project_id = ? AND pd.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [project_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            file_id: row1[i].doc_file_id,
            doc_name: row1[i].doc_name,
            file_name: row1[i].original_file_name,
            new_name: row1[i].new_file_name,
            file_path: row1[i].gcp_file_path,
        });
    }
    return list;
};

const project_document_signed_url = async (project_unique_id, file_id) => {
    var results = { status: false, msg: "", doc_name: "", file_name: "", new_name: "", file_path: "", file_url: "", };
    const _query1 = `SELECT pc.unique_id AS project_unique_id, dm.doc_name, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM project_document ud INNER JOIN project_created pc ON ud.project_id = pc.project_id INNER JOIN rfp_doc_mast dm ON ud.document_id = dm.document_id
        WHERE ud.doc_file_id = ? AND ud.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [file_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        if (project_unique_id.toLowerCase() == row1[0].project_unique_id.toLowerCase()) {
            const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
            results.status = true;
            results.doc_name = row1[0].doc_name;
            results.file_name = row1[0].original_file_name;
            results.new_name = row1[0].new_file_name;
            results.file_path = row1[0].gcp_file_path;
            results.file_url = resp;
        } else {
            results.msg = "Invalid project id of document.";
        }
    } else {
        results.msg = "Document details not found.";
    }
    return results;
};

const project_scope_of_work_data = async (project_id) => {
    var my_scope_of_work = [];
    const _querySelMil = `SELECT m.milestone_id, m.milestone_no, m.milestone_name, m.sort_order FROM project_milestone m WHERE m.project_id = ? 
    AND m.is_deleted = false ORDER BY CASE WHEN COALESCE(m.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(m.sort_order, 0) END`;
    const rowSelMil = await db.sequelize.query(_querySelMil, { replacements: [project_id], type: QueryTypes.SELECT });
    for (let i = 0; rowSelMil && i < rowSelMil.length; i++) {
        const eleMil = rowSelMil[i]; var db_delivery_list = [];
        const _querySelDel = `SELECT d.delivery_id, d.delivery_no, d.delivery_name, d.sort_order FROM project_delivery d WHERE d.milestone_id = ? 
        AND d.is_deleted = false ORDER BY CASE WHEN COALESCE(d.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(d.sort_order, 0) END`;
        const rowSelDel = await db.sequelize.query(_querySelDel, { replacements: [eleMil.milestone_id], type: QueryTypes.SELECT });
        for (let k = 0; rowSelDel && k < rowSelDel.length; k++) {
            const eleDel = rowSelDel[k]; var db_activity_list = [];
            const _querySelAct = `SELECT a.activity_id, a.activity_no, a.activity_name, a.sort_order FROM project_activity a WHERE a.delivery_id = ? 
            AND a.is_deleted = false ORDER BY CASE WHEN COALESCE(a.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(a.sort_order, 0) END`;
            const rowSelAct = await db.sequelize.query(_querySelAct, { replacements: [eleDel.delivery_id], type: QueryTypes.SELECT });
            for (let l = 0; rowSelAct && l < rowSelAct.length; l++) {
                const eleAct = rowSelAct[l];
                db_activity_list.push({
                    activity_id: eleAct.activity_id,
                    activity_name: eleAct.activity_name,
                    sort_order: eleAct.sort_order,
                });
            }
            db_delivery_list.push({
                delivery_id: eleDel.delivery_id,
                delivery_name: eleDel.delivery_name,
                sort_order: eleDel.sort_order,
                activity: db_activity_list,
            });
        }
        my_scope_of_work.push({
            milestone_id: eleMil.milestone_id,
            milestone_name: eleMil.milestone_name,
            sort_order: eleMil.sort_order,
            delivery: db_delivery_list,
        });
    }
    return my_scope_of_work;
};

const project_scope_of_work_view_data = async (project_id) => {
    var my_scope_of_work = [];
    const _querySelMil = `SELECT m.milestone_id, m.milestone_no, m.milestone_name FROM project_milestone m WHERE m.project_id = ? AND m.is_deleted = false
    ORDER BY CASE WHEN COALESCE(m.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(m.sort_order, 0) END`;
    const rowSelMil = await db.sequelize.query(_querySelMil, { replacements: [project_id], type: QueryTypes.SELECT });
    for (let i = 0; rowSelMil && i < rowSelMil.length; i++) {
        const eleMil = rowSelMil[i]; var db_delivery_list = [];
        const _querySelDel = `SELECT d.delivery_id, d.delivery_no, d.delivery_name FROM project_delivery d WHERE d.milestone_id = ? AND d.is_deleted = false 
        ORDER BY CASE WHEN COALESCE(d.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(d.sort_order, 0) END`;
        const rowSelDel = await db.sequelize.query(_querySelDel, { replacements: [eleMil.milestone_id], type: QueryTypes.SELECT });
        for (let k = 0; rowSelDel && k < rowSelDel.length; k++) {
            const eleDel = rowSelDel[k]; var db_activity_list = [];
            const _querySelAct = `SELECT a.activity_no, a.activity_name FROM project_activity a WHERE a.delivery_id = ? AND a.is_deleted = false 
            ORDER BY CASE WHEN COALESCE(a.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(a.sort_order, 0) END`;
            const rowSelAct = await db.sequelize.query(_querySelAct, { replacements: [eleDel.delivery_id], type: QueryTypes.SELECT });
            for (let l = 0; rowSelAct && l < rowSelAct.length; l++) {
                const eleAct = rowSelAct[l];
                db_activity_list.push({
                    activity_no: eleAct.activity_no,
                    activity_name: eleAct.activity_name,
                });
            }
            db_delivery_list.push({
                delivery_no: eleDel.delivery_no,
                delivery_name: eleDel.delivery_name,
                activity: db_activity_list,
            });
        }
        my_scope_of_work.push({
            milestone_no: eleMil.milestone_no,
            milestone_name: eleMil.milestone_name,
            delivery: db_delivery_list,
        });
    }
    return my_scope_of_work;
};

const project_questionnaire_data = async (project_id) => {
    var list = [];
    const _querySelQues = `SELECT q.que_id, q.type_id, q.que_text, q.que_options, q.scale_start_point, q.scale_end_point, q.scale_start_text,
    q.scale_end_text, q.scoring_parameters, q.max_score, q.weightage, q.sort_order FROM project_question q WHERE q.project_id = ? 
    AND q.is_deleted = false ORDER BY CASE WHEN COALESCE(q.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(q.sort_order, 0) END`;
    const rowSelQues = await db.sequelize.query(_querySelQues, { replacements: [project_id], type: QueryTypes.SELECT });
    for (let i = 0; rowSelQues && i < rowSelQues.length; i++) {
        const eleQue = rowSelQues[i];
        list.push({
            que_id: eleQue.que_id,
            type_id: eleQue.type_id,
            que_text: eleQue.que_text,
            ans_text: '',
            options: JSON.parse(eleQue.que_options),
            scale_start_point: eleQue.scale_start_point,
            scale_end_point: eleQue.scale_end_point,
            scale_start_text: eleQue.scale_start_text,
            scale_end_text: eleQue.scale_end_text,
            scale_selected: 0,
            scoring_parameters: eleQue.scoring_parameters,
            max_score: eleQue.max_score,
            weightage: eleQue.weightage,
            sort_order: eleQue.sort_order,
            eligible_score: '',
        });
    }
    return list;
};



const project_appl_questionnaire_data = async (apply_id) => {
    var list = [];
    const _querySelQues = `SELECT q.que_id, q.type_id, q.que_text, q.ans_text, q.que_options, q.scale_start_point, q.scale_end_point, q.scale_start_text, 
    q.scale_end_text, q.scale_selected, q.scoring_parameters, q.max_score, q.weightage, q.sort_order, q.eligible_score FROM project_appl_ques q WHERE q.apply_id = ?
    ORDER BY CASE WHEN COALESCE(q.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(q.sort_order, 0) END`;
    const rowSelQues = await db.sequelize.query(_querySelQues, { replacements: [apply_id], type: QueryTypes.SELECT });
    for (let i = 0; rowSelQues && i < rowSelQues.length; i++) {
        const eleQue = rowSelQues[i];
        const _scale_selected = eleQue.scale_selected != null && validator.isNumeric(eleQue.scale_selected.toString()) ? parseInt(eleQue.scale_selected) : 0;
        const _max_score = eleQue.max_score != null && validator.isNumeric(eleQue.max_score.toString()) ? parseFloat(eleQue.max_score) : 0;
        const _weightage = eleQue.weightage != null && validator.isNumeric(eleQue.weightage.toString()) ? parseFloat(eleQue.weightage) : 0;
        const _eligible_score = eleQue.eligible_score != null && validator.isNumeric(eleQue.eligible_score.toString()) ? parseFloat(eleQue.eligible_score) : 0;

        list.push({
            sr_no: (i + 1),
            type_id: eleQue.type_id,
            que_text: eleQue.que_text,
            ans_text: eleQue.ans_text,
            options: JSON.parse(eleQue.que_options),
            scale_start_point: eleQue.scale_start_point,
            scale_end_point: eleQue.scale_end_point,
            scale_start_text: eleQue.scale_start_text,
            scale_end_text: eleQue.scale_end_text,
            scale_selected: _scale_selected,
            scoring_parameters: eleQue.scoring_parameters,
            max_score: _max_score,
            weightage: _weightage,
            eligible_score: _eligible_score,
        });
    }
    return list;
};

const project_appl_proposal_docs_data = async (apply_id) => {
    var list = [];
    const _querySelDocs = `SELECT f.doc_file_id, f.original_file_name, f.new_file_name, f.gcp_file_path
    FROM project_appl_files f WHERE f.apply_id = ? AND f.is_deleted = false`;
    const rowSelDocs = await db.sequelize.query(_querySelDocs, { replacements: [apply_id], type: QueryTypes.SELECT });
    for (let i = 0; rowSelDocs && i < rowSelDocs.length; i++) {
        const eleDoc = rowSelDocs[i];
        list.push({
            file_id: eleDoc.doc_file_id,
            file_name: eleDoc.original_file_name,
            new_name: eleDoc.new_file_name,
            file_path: eleDoc.gcp_file_path,
        });
    }
    return list;
};

const project_appl_proposal_doc_signed_url = async (apply_unique_id, file_id) => {
    var results = { status: false, msg: "", doc_name: "", file_name: "", new_name: "", file_path: "", file_url: "", };
    const _query1 = `SELECT pc.unique_id AS apply_unique_id, ud.original_file_name, ud.new_file_name, ud.gcp_file_path
        FROM project_appl_files ud INNER JOIN project_appl_mast pc ON ud.apply_id = pc.apply_id
        WHERE ud.doc_file_id = ? AND ud.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [file_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0 && apply_unique_id.toLowerCase() == row1[0].apply_unique_id.toLowerCase()) {
        const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_file_path);
        results.status = true;
        results.file_name = row1[0].original_file_name;
        results.new_name = row1[0].new_file_name;
        results.file_path = row1[0].gcp_file_path;
        results.file_url = resp;
    } else {
        results.msg = "Document details not found.";
    }
    return results;
};

const project_appl_stats_add = async (apply_id, apply_status, remark_text, updated_by, updated_date) => {
    const _queryAdd = `INSERT INTO project_appl_stats(apply_id, apply_status, updated_by, updated_date, remark_text) VALUES(?, ?, ?, ?, ?) RETURNING "stat_id"`;
    const _replAdd = [apply_id, apply_status, updated_by, updated_date, remark_text];
    const [rowAdd] = await db.sequelize.query(_queryAdd, { replacements: _replAdd, type: QueryTypes.INSERT, returning: true });
    const new_qid = (rowAdd && rowAdd.length > 0 && rowAdd[0] ? rowAdd[0].stat_id : 0);
    return new_qid;
};

const project_appl_stats_list = async (apply_id) => {
    var list = [];
    const _query = `SELECT apply_status, updated_date, remark_text FROM project_appl_stats WHERE apply_id = ?`;
    const row = await db.sequelize.query(_query, { replacements: [apply_id], type: QueryTypes.SELECT });
    for (let i = 0; row && i < row.length; i++) {
        list.push({
            apply_status: row[i].apply_status,
            updated_date: row[i].updated_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row[i].updated_date)) : "",
            remark_text: row[i].remark_text,
        });
    }
    return list;
};

const project_total_fund_raised = async (_project_id) => {
    var fund_raised = 0;
    const _querySum = `SELECT COALESCE(SUM(COALESCE(total_amount, 0))) AS fund_raised FROM project_payment_fund WHERE project_id = ? AND is_success = true`;
    const rowSum = await db.sequelize.query(_querySum, { replacements: [_project_id], type: QueryTypes.SELECT });
    if (rowSum && rowSum.length > 0) {
        fund_raised = rowSum[0].fund_raised != null && validator.isNumeric(rowSum[0].fund_raised.toString()) ? parseFloat(parseFloat(rowSum[0].fund_raised).toFixed(2)) : 0;
    }
    return fund_raised;
};

const entity_has_funded_to_project = async (reg_id, project_id) => {
    var paid_record = 0;
    const _queryChkFunded = `SELECT COUNT(1) AS paid_record FROM project_payment_fund WHERE paid_by_reg_id = ? AND project_id = ? AND is_success = true`;
    const rowChkFunded = await db.sequelize.query(_queryChkFunded, { replacements: [reg_id, project_id], type: QueryTypes.SELECT });
    if (rowChkFunded && rowChkFunded.length > 0) { paid_record = rowChkFunded[0].paid_record; }
    return paid_record;
};

const is_project_awarded_to_ia = async (_project_id) => {
    var status = false;
    const _query = `SELECT apply_id FROM project_appl_mast WHERE project_id = ? AND apply_status = 1`;
    const row = await db.sequelize.query(_query, { replacements: [_project_id], type: QueryTypes.SELECT });
    if (row && row.length > 0) {
        status = true;
    }
    return status;
};

const is_project_accepted_by_ia = async (_project_id) => {
    var status = false;
    const _query = `SELECT apply_id FROM project_appl_mast WHERE project_id = ? AND apply_status = 3`;
    const row = await db.sequelize.query(_query, { replacements: [_project_id], type: QueryTypes.SELECT });
    if (row && row.length > 0) {
        status = true;
    }
    return status;
};

const uam_permission_menus = async (entity_id, role_id) => {
    var list = [];
    const _query1 = `SELECT p.menu_id, m.menu_name, m.is_visible, m.parent_id,
    COALESCE((SELECT rp.allowed FROM role_permit rp WHERE rp.menu_id = p.menu_id AND rp.role_id = :role_id), false) AS allowed
    FROM entity_menu_permit p INNER JOIN entity_menu_master m ON p.menu_id = m.menu_id 
    WHERE p.entity_id = :entity_id AND p.allowed = true AND m.admin_only = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: { role_id: role_id, entity_id: entity_id }, type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        const elePerm = row1[i];
        list.push({
            menu_id: elePerm.menu_id,
            menu_name: elePerm.menu_name,
            is_visible: elePerm.is_visible,
            parent_id: elePerm.parent_id,
            allowed: elePerm.allowed,
        });
    }
    return list;
};

const uam_role_dropdown_list = async (reg_id) => {
    var list = [];
    const _query1 = `SELECT role_id, role_name FROM role_master WHERE reg_id = ? AND is_approved = true AND is_deleted = false AND is_enabled = true`;
    const row1 = await db.sequelize.query(_query1, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        const elePerm = row1[i];
        list.push({
            role_id: elePerm.role_id,
            role_name: elePerm.role_name,
        });
    }
    return list;
};

const uam_role_login_status = async (role_id) => {
    const _query1 = `SELECT is_enabled FROM role_master WHERE role_id = ? AND is_approved = true AND is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [role_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const is_enabled = row1[0].is_enabled && row1[0].is_enabled == true ? true : false;
        if (is_enabled) {
            return 1;
        }
        return -1;
    }
    return 0;
};

const remove_all_sessions_by_user = async (user_id) => {
    var aft_rows = 0;

    return aft_rows;
};

const remove_all_sessions_by_role = async (role_id) => {
    var aft_rows = 0;

    return aft_rows;
};

const dynamic_field_values_get = async (reg_id) => {
    var list = [];
    const _query4 = `SELECT static_field_id, user_value FROM user_field_values WHERE reg_id = ?`;
    const row4 = await db.sequelize.query(_query4, { replacements: [reg_id], type: QueryTypes.SELECT });
    for (let i = 0; row4 && i < row4.length; i++) {
        const serEle = row4[i];
        list.push({
            field_id: serEle.static_field_id,
            user_value: serEle.user_value,
        });
    }
    return list;
};

const monitoring_looking_ia_milestone_doc_get_url = async (accepted_id, doc_type, field_type, field_id) => {
    var results = { status: false, msg: "", doc_name: "", file_name: "", new_name: "", file_path: "", file_url: "", };

    var select_field = '';
    if (doc_type == 'completion') { select_field = ' completion_file_name AS file_name, completion_new_name AS new_name, completion_gcp_path AS gcp_path '; }
    if (doc_type == 'other') { select_field = ' other_file_name AS file_name, other_new_name AS new_name, other_gcp_path AS gcp_path '; }
    if (doc_type == 'beneficiary') { select_field = ' beneficiary_file_name AS file_name, beneficiary_new_name AS new_name, beneficiary_gcp_path AS gcp_path '; }

    var _query1 = '';
    if (field_type == 'milestone') { _query1 = `SELECT ${select_field} FROM project_track_milestone WHERE accepted_id = ? AND milestone_id = ?`; }
    if (field_type == 'delivery') { _query1 = `SELECT ${select_field} FROM project_track_delivery WHERE accepted_id = ? AND delivery_id = ?`; }
    if (field_type == 'activity') { _query1 = `SELECT ${select_field} FROM project_track_activity WHERE accepted_id = ? AND activity_id = ?`; }

    const row1 = await db.sequelize.query(_query1, { replacements: [accepted_id, field_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_path);
        results.status = true;
        results.file_name = row1[0].file_name;
        results.new_name = row1[0].new_name;
        results.file_path = row1[0].gcp_path;
        results.file_url = resp;
    } else {
        results.msg = "Document details not found.";
    }
    return results;
};

const monitoring_crowd_fund_milestone_doc_get_url = async (project_id, doc_type, field_type, field_id) => {
    var results = { status: false, msg: "", doc_name: "", file_name: "", new_name: "", file_path: "", file_url: "", };

    var select_field = '';
    if (doc_type == 'completion') { select_field = ' completion_file_name AS file_name, completion_new_name AS new_name, completion_gcp_path AS gcp_path '; }
    if (doc_type == 'other') { select_field = ' other_file_name AS file_name, other_new_name AS new_name, other_gcp_path AS gcp_path '; }
    if (doc_type == 'beneficiary') { select_field = ' beneficiary_file_name AS file_name, beneficiary_new_name AS new_name, beneficiary_gcp_path AS gcp_path '; }

    var _query1 = '';
    if (field_type == 'milestone') { _query1 = `SELECT ${select_field} FROM project_track_milestone WHERE project_id = ? AND milestone_id = ?`; }
    if (field_type == 'delivery') { _query1 = `SELECT ${select_field} FROM project_track_delivery WHERE project_id = ? AND delivery_id = ?`; }
    if (field_type == 'activity') { _query1 = `SELECT ${select_field} FROM project_track_activity WHERE project_id = ? AND activity_id = ?`; }

    const row1 = await db.sequelize.query(_query1, { replacements: [project_id, field_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const resp = await cloudStorageModule.GenerateSignedUrl(row1[0].gcp_path);
        results.status = true;
        results.file_name = row1[0].file_name;
        results.new_name = row1[0].new_name;
        results.file_path = row1[0].gcp_path;
        results.file_url = resp;
    } else {
        results.msg = "Document details not found.";
    }
    return results;
};

module.exports = {
    search_entities,
    profile_validation_field,
    user_master_get_id,
    admin_account_view_list,
    expertise_areas,
    expertise_area_names,
    services,
    bank_accounts,
    entity_document_uploaded,
    entity_document_signed_url,
    user_acc_document_uploaded,
    user_acc_document_signed_url,
    csr_docs_document_uploaded,
    csr_docs_document_signed_url,
    board_members,
    csr_committee_members,

    modified_entity_document_uploaded,
    modified_entity_document_uploaded_old,
    modified_user_acc_document_uploaded,
    modified_user_acc_document_uploaded_old,
    modified_csr_docs_document_uploaded,
    modified_csr_docs_document_uploaded_old,
    modified_expertise_area_names,
    modified_expertise_area_names_old,
    modified_services,
    modified_services_old,
    modified_bank_accounts,
    modified_bank_accounts_old,
    modified_board_members,
    modified_board_members_old,
    modified_csr_committee_members,
    modified_csr_committee_members_old,

    project_purpose_ignore_list,
    project_visible_to_ia_list,
    project_document_uploaded,
    project_document_view_uploaded,
    project_document_signed_url,
    project_scope_of_work_data,
    project_scope_of_work_view_data,
    project_questionnaire_data,
    project_appl_questionnaire_data,
    project_appl_proposal_docs_data,
    project_appl_proposal_doc_signed_url,

    project_appl_stats_add,
    project_appl_stats_list,
    project_total_fund_raised,
    entity_has_funded_to_project,
    is_project_awarded_to_ia,
    is_project_accepted_by_ia,

    uam_permission_menus,
    uam_role_dropdown_list,
    uam_role_login_status,
    remove_all_sessions_by_user,
    remove_all_sessions_by_role,
    dynamic_field_values_get,
    monitoring_looking_ia_milestone_doc_get_url,
    monitoring_crowd_fund_milestone_doc_get_url,
};