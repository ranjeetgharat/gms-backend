const _logger = require('../logger/winston').logger;
const db = require('../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
var validator = require('validator');
const { emailTemplate, emailTags } = require('../constants/emailConfig');
const emailer = require('../utilities/emailer');
const crypto = require('crypto');
const jws = require('jws');
const jwt = require('jsonwebtoken');

const country_calling_code = async () => {
    var list = [];
    list.push('+91');
    return list;
};

const entity_dynamic_form_fields = async (entity_id) => {
    var list = [];
    const _query = `SELECT jsonb_build_object('field_id', f.static_field_id, 'section_id', f.section_name, 'field_type', f.field_type, 'reg_type', f.flow_by_reg_type_id,
    'lable_name', CASE WHEN LENGTH(COALESCE(m.label_text, '')) > 0 THEN m.label_text ELSE f.field_label END,
    'lable_lng_key', CASE WHEN LENGTH(COALESCE(m.label_lng_key, '')) > 0 THEN m.label_lng_key ELSE f.field_lng_key END, 
    'placeholder_text', f.placeholder_text, 'placeholder_lng_key', f.placeholder_lng_key, 'is_required', COALESCE(m.is_required, false),
    'field_values', f.field_values, 'user_value', '', 'validations', coalesce(v.validations, '[]')) as row_data
    FROM reg_static_field_item f
    LEFT JOIN LATERAL (
        SELECT COALESCE(em.entity_id, 0) AS entity_id, em.is_required, em.label_text, em.label_lng_key 
        FROM reg_static_field_map_entity em WHERE em.static_field_id = f.static_field_id AND em.entity_id = :entity_id
        FETCH FIRST 1 ROW ONLY
    ) m ON true
    LEFT JOIN LATERAL (	
        SELECT jsonb_agg(jsonb_build_object('vld_type_id', v.vld_type_id, 'pattern_value', v.pattern_value)) as validations
        FROM reg_static_field_validation v WHERE v.static_field_id = f.static_field_id	
    ) as v on true
    WHERE m.entity_id = :entity_id AND f.is_static = false AND f.is_enabled = true AND f.is_deleted = false`;
    const row = await db.sequelize.query(_query, { replacements: { entity_id: entity_id }, type: QueryTypes.SELECT });
    for (let i = 0; row && i < row.length; i++) {
        list.push(row[i].row_data);
    }
    return list;
};

const entity_dynamic_form_fields_by_reg_type_id = async (entity_id, reg_type_id) => {
    var list = [];
    const _query = `SELECT jsonb_build_object('field_id', f.static_field_id, 'section_id', f.section_name, 'field_type', f.field_type, 'reg_type', f.flow_by_reg_type_id,
    'lable_name', CASE WHEN LENGTH(COALESCE(m.label_text, '')) > 0 THEN m.label_text ELSE f.field_label END,
    'lable_lng_key', CASE WHEN LENGTH(COALESCE(m.label_lng_key, '')) > 0 THEN m.label_lng_key ELSE f.field_lng_key END, 
    'placeholder_text', f.placeholder_text, 'placeholder_lng_key', f.placeholder_lng_key, 'is_required', COALESCE(m.is_required, false),
    'field_values', f.field_values, 'user_value', '', 'validations', coalesce(v.validations, '[]')) as row_data
    FROM reg_static_field_item f
    LEFT JOIN LATERAL (
        SELECT COALESCE(em.entity_id, 0) AS entity_id, em.is_required, em.label_text, em.label_lng_key 
        FROM reg_static_field_map_entity em WHERE em.static_field_id = f.static_field_id AND em.entity_id = :entity_id AND em.reg_type_id = :reg_type_id
        FETCH FIRST 1 ROW ONLY
    ) m ON true
    LEFT JOIN LATERAL (	
        SELECT jsonb_agg(jsonb_build_object('vld_type_id', v.vld_type_id, 'pattern_value', v.pattern_value)) as validations
        FROM reg_static_field_validation v WHERE v.static_field_id = f.static_field_id	
    ) as v on true
    WHERE m.entity_id = :entity_id AND f.flow_by_reg_type_id = true AND f.is_static = false AND f.is_enabled = true AND f.is_deleted = false`;
    const row = await db.sequelize.query(_query, { replacements: { entity_id: entity_id, reg_type_id: reg_type_id }, type: QueryTypes.SELECT });
    for (let i = 0; row && i < row.length; i++) {
        list.push(row[i].row_data);
    }
    return list;
};

const entity_type_get = async (entity_id) => {
    const _query1 = `SELECT entity_name, is_individual, platform_fee_enabled, auto_approve_enabled
    FROM entity_type WHERE entity_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return row1[0];
    }
    return null;
};

const entity_permissions = async (entity_id, reg_id, is_admin, role_id) => {
    var permissions = [];
    if (is_admin) {
        const _query1 = `SELECT m.menu_id, m.is_visible, m.parent_id,
        COALESCE((SELECT allowed FROM entity_menu_permit p WHERE p.menu_id = m.menu_id AND p.entity_id = ? LIMIT 1), false) AS allowed
        FROM entity_menu_master m`;
        const row1 = await db.sequelize.query(_query1, { replacements: [entity_id], type: QueryTypes.SELECT });
        for (let i = 0; row1 && i < row1.length; i++) {
            permissions.push({
                id: row1[i].menu_id,
                visible: row1[i].is_visible,
                p_id: row1[i].parent_id,
                allowed: row1[i].allowed,
            });
        }
    } else {
        const _query1 = `SELECT m.menu_id, m.is_visible, m.parent_id, p.allowed
        FROM role_permit p INNER JOIN entity_menu_master m ON p.menu_id = m.menu_id WHERE p.role_id = ?`;
        const row1 = await db.sequelize.query(_query1, { replacements: [role_id], type: QueryTypes.SELECT });
        for (let i = 0; row1 && i < row1.length; i++) {
            permissions.push({
                id: row1[i].menu_id,
                visible: row1[i].is_visible,
                p_id: row1[i].parent_id,
                allowed: row1[i].allowed,
            });
        }
    }
    return permissions;
};

const protean_user_permissions = async (role_id) => {
    var permissions = []; var is_editable = true;
    const _query0 = `SELECT is_editable FROM adm_role WHERE role_id = ?`;
    const row0 = await db.sequelize.query(_query0, { replacements: [role_id], type: QueryTypes.SELECT });
    if (row0 && row0.length > 0) {
        is_editable = row0[0].is_editable && row0[0].is_editable == true ? true : false;
    }
    const _query1 = `SELECT m.menu_id, m.is_visible, m.parent_id,
    COALESCE((SELECT allowed FROM adm_menu_permit p WHERE p.menu_id = m.menu_id AND p.role_id = ? LIMIT 1), false) AS allowed
    FROM adm_menu_master m`;
    const row1 = await db.sequelize.query(_query1, { replacements: [role_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        permissions.push({
            id: row1[i].menu_id,
            visible: row1[i].is_visible,
            p_id: row1[i].parent_id,
            allowed: (is_editable ? row1[i].allowed : true),
        });
    }
    return permissions;
};

const email_template_get = async (template_id) => {
    const _query1 = `SELECT template_name, subject, body_text, is_enabled
    FROM email_template WHERE template_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [template_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return row1[0];
    }
    return null;
};

const sms_template_get = async (template_id) => {
    const _query1 = `SELECT template_name, message_text, is_enabled
    FROM sms_template WHERE template_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [template_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return row1[0];
    }
    return null;
};

const country_dropdown = async () => {
    var countries = [];
    const _query1 = `SELECT country_id, country_name, country_code, is_default 
    FROM countries WHERE is_enabled = true AND is_deleted = false ORDER BY country_name`;
    const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        countries.push({
            country_id: row1[i].country_id,
            country_name: row1[i].country_name,
            country_code: row1[i].country_code,
            is_default: row1[i].is_default,
        });
    }
    return countries;
};

const state_dropdown = async (country_id) => {
    var states = [];
    const _query1 = `SELECT state_id, state_name, state_code FROM states 
    WHERE country_id = ? AND is_enabled = true AND is_deleted = false ORDER BY state_name`;
    const row1 = await db.sequelize.query(_query1, { replacements: [country_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        states.push({
            state_id: row1[i].state_id,
            state_name: row1[i].state_name,
            state_code: row1[i].state_code,
        });
    }
    return states;
};

const district_dropdown = async (state_id) => {
    var districts = [];
    const _query1 = `SELECT district_id, district_name, district_code 
    FROM districts WHERE state_id = ? AND is_enabled = true AND is_deleted = false ORDER BY district_name`;
    const row1 = await db.sequelize.query(_query1, { replacements: [state_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        districts.push({
            district_id: row1[i].district_id,
            district_name: row1[i].district_name,
            district_code: row1[i].district_code,
        });
    }
    return districts;
};

const block_dropdown = async (district_id) => {
    var blocks = [];
    const _query1 = `SELECT block_id, block_name, pin_codes FROM blocks 
    WHERE district_id = ? AND is_enabled = true AND is_deleted = false ORDER BY block_name`;
    const row1 = await db.sequelize.query(_query1, { replacements: [district_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        var _pin_codes = [];
        if (row1[i].pin_codes && row1[i].pin_codes.length > 0) {
            _pin_codes = row1[i].pin_codes.split(',');
        }
        blocks.push({
            block_id: row1[i].block_id,
            block_name: row1[i].block_name,
            pin_codes: _pin_codes,
        });
    }
    return blocks;
};

const banks_dropdown = async () => {
    var banks = [];
    const _query1 = `SELECT bank_id, bank_name, bank_code FROM bank_mast WHERE is_deleted = false AND is_enabled = true`;
    const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        banks.push({
            bank_id: row1[i].bank_id,
            bank_name: row1[i].bank_name,
        });
    }
    return banks;
};

const is_mobile_registered = async (_mobile_no) => {
    const _query1 = `SELECT u.reg_id AS id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.mobile_no, '')) > 0 AND LOWER(u.mobile_no) = LOWER(:mobile_no)
    UNION ALL
    SELECT a.reg_id AS id FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE u.is_deleted = false AND a.is_deleted = false
    AND LENGTH(COALESCE(a.mobile_no, '')) > 0 AND LOWER(a.mobile_no) = LOWER(:mobile_no)`;
    const row1 = await db.sequelize.query(_query1, { replacements: { mobile_no: _mobile_no }, type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return true;
    }
    return false;
};

const is_email_registered = async (_email_id) => {
    const _query2 = `SELECT u.reg_id AS id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.email_id, '')) > 0 AND LOWER(u.email_id) = LOWER(:email_id)
    UNION ALL
    SELECT a.reg_id AS id FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE u.is_deleted = false AND a.is_deleted = false
    AND LENGTH(COALESCE(a.email_id, '')) > 0 AND LOWER(a.email_id) = LOWER(:email_id)`;
    const row2 = await db.sequelize.query(_query2, { replacements: { email_id: _email_id }, type: QueryTypes.SELECT });
    if (row2 && row2.length > 0) {
        return true;
    }
    return false;
};

const check_account_mobile_registered = async (_user_id, _mobile_no) => {
    const _query1 = `SELECT u.reg_id AS id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.mobile_no, '')) > 0 AND LOWER(u.mobile_no) = LOWER(:mobile_no)
    UNION ALL
    SELECT a.reg_id AS id FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE u.is_deleted = false AND a.is_deleted = false
    AND LENGTH(COALESCE(a.mobile_no, '')) > 0 AND LOWER(a.mobile_no) = LOWER(:mobile_no) AND a.user_id <> :user_id`;
    const row1 = await db.sequelize.query(_query1, { replacements: { mobile_no: _mobile_no, user_id: _user_id }, type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return true;
    }
    return false;
};

const check_account_email_registered = async (_user_id, _email_id) => {
    const _query1 = `SELECT u.reg_id AS id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.email_id, '')) > 0 AND LOWER(u.email_id) = LOWER(:email_id)
    UNION ALL
    SELECT a.reg_id AS id FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE u.is_deleted = false AND a.is_deleted = false
    AND LENGTH(COALESCE(a.email_id, '')) > 0 AND LOWER(a.email_id) = LOWER(:email_id) AND a.user_id <> :user_id`;
    const row1 = await db.sequelize.query(_query1, { replacements: { email_id: _email_id, user_id: _user_id }, type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        return true;
    }
    return false;
};

const ifsc_code_search = async (ifsc_code) => {
    var codes = [];
    if (ifsc_code.length > 2) {
        const _query1 = `SELECT c.branch_id, c.ifsc_code, m.bank_name, c.branch_name
        FROM bank_branch c INNER JOIN bank_mast m ON c.bank_id = m.bank_id
        WHERE c.is_deleted = false AND m.is_deleted = false AND c.is_enabled = true AND m.is_enabled = true
        AND LOWER(c.ifsc_code) LIKE LOWER(:search_text) ORDER BY c.ifsc_code LIMIT 10`;
        const row1 = await db.sequelize.query(_query1, { replacements: { search_text: ifsc_code + '%', }, type: QueryTypes.SELECT });
        for (let i = 0; row1 && i < row1.length; i++) {
            codes.push({
                branch_id: row1[i].branch_id,
                ifsc_code: row1[i].ifsc_code,
                bank: row1[i].bank_name,
                branch: row1[i].branch_name,
            });
        }
    }
    return codes;
};

const search_parent_entity = async (_org_type_id, _unique_id, _company_name, _pin_code) => {
    var list = [];
    const _query1 = `SELECT u.reg_id, u.reg_no, u.company_name, ls.state_name, ld.district_name, u.pin_code
    FROM user_master u LEFT OUTER JOIN states ls ON u.state_id = ls.state_id
    LEFT OUTER JOIN districts ld ON u.district_id = ld.district_id    
    WHERE u.entity_id IN (
        SELECT unnest(m.parent_entity) FROM parent_orgs_mapp m WHERE m.org_type_id = :org_type_id
    ) AND u.is_deleted = false AND u.is_enabled = true AND u.approve_status = 1
    AND LOWER(u.reg_no) LIKE LOWER(:reg_no)
    AND LOWER(u.company_name) LIKE LOWER(:company_name)
    AND LOWER(u.pin_code) LIKE LOWER(:pin_code) 
    LIMIT 10`;
    const row1 = await db.sequelize.query(_query1, {
        replacements: {
            org_type_id: _org_type_id,
            reg_no: _unique_id + '%',
            company_name: _company_name + '%',
            pin_code: _pin_code + '%',
        }, type: QueryTypes.SELECT
    });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            reg_id: row1[i].reg_id,
            reg_no: (row1[i].reg_no ? row1[i].reg_no : ''),
            company: row1[i].company_name,
            state: row1[i].state_name,
            district: row1[i].district_name,
            pin_code: row1[i].pin_code,
        });
    }
    return list;
};

const send_entity_registration_email = async (reg_id) => {
    const _query1 = `SELECT u.entity_id, em.entity_name, u.added_date, u.is_enabled, u.approve_status, u.approved_date, u.approved_remark,
    u.first_name, u.middle_name, u.last_name, u.email_id, u.mobile_no, u.pan_no, po.org_type_name,
    u.company_name, et.reg_type_name AS registered_as, u.address_1, u.address_2, u.address_3, c.country_name, s.state_name, 
    d.district_name, b.block_name, u.pin_code, u.contact_no,
    u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no, u.mca_csr_f1_reg_no,
    u.fcra_no_with_status, u.fin_audit_rpt_filed, u.ack_no

    FROM user_master u LEFT OUTER JOIN countries c ON u.country_id = c.country_id LEFT OUTER JOIN states s ON
    u.state_id = s.state_id LEFT OUTER JOIN districts d ON u.district_id = d.district_id LEFT OUTER JOIN blocks b
    ON u.block_id = b.block_id LEFT OUTER JOIN entity_reg_type_mast et ON u.registered_as_id = et.reg_type_id
    LEFT OUTER JOIN parent_orgs_mast po ON u.org_type_id = po.org_type_id LEFT OUTER JOIN entity_type em ON u.entity_id = em.entity_id

    WHERE u.reg_id = ? AND u.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [reg_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const _entity_id = row1[0].entity_id && validator.isNumeric(row1[0].entity_id.toString()) ? BigInt(row1[0].entity_id) : 0;
        var template_id = 0;
        switch (_entity_id.toString()) {
            case '1': template_id = emailTemplate.ENTITY_REG_SUCCESS_1; break;
            case '2': template_id = emailTemplate.ENTITY_REG_SUCCESS_2; break;
            case '3': template_id = emailTemplate.ENTITY_REG_SUCCESS_3; break;
            case '4': template_id = emailTemplate.ENTITY_REG_SUCCESS_4; break;
            case '5': template_id = emailTemplate.ENTITY_REG_SUCCESS_5; break;
            case '6': template_id = emailTemplate.ENTITY_REG_SUCCESS_6; break;
            case '7': template_id = emailTemplate.ENTITY_REG_SUCCESS_7; break;
        }
        if (template_id > 0) {
            const template = await email_template_get(template_id);
            if (template && template != null) {
                var mail_subject = template.subject && template.subject.length > 0 ? template.subject : "";
                var mail_body_text = template.body_text && template.body_text.length > 0 ? template.body_text : "";
                var full_name_array = [];
                if (row1[0].first_name && row1[0].first_name.length > 0) { full_name_array.push(row1[0].first_name); }
                if (row1[0].middle_name && row1[0].middle_name.length > 0) { full_name_array.push(row1[0].middle_name); }
                if (row1[0].last_name && row1[0].last_name.length > 0) { full_name_array.push(row1[0].last_name); }

                mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                mail_subject = mail_subject.replaceAll(emailTags.ENTITY_TYPE, row1[0].entity_name);
                mail_subject = mail_subject.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                mail_subject = mail_subject.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                mail_subject = mail_subject.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                mail_subject = mail_subject.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                mail_subject = mail_subject.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                mail_subject = mail_subject.replaceAll(emailTags.PAN_NO, row1[0].pan_no);
                mail_subject = mail_subject.replaceAll(emailTags.COMPANY_NAME, row1[0].company_name);
                mail_subject = mail_subject.replaceAll(emailTags.COMPANY_PAN, row1[0].company_pan_no);
                mail_subject = mail_subject.replaceAll(emailTags.GSTIN_NO, row1[0].gstin_no);
                mail_subject = mail_subject.replaceAll(emailTags.CIN_NO, row1[0].cin_no);
                mail_subject = mail_subject.replaceAll(emailTags.REGISTRATION_NO, row1[0].registration_no);
                mail_subject = mail_subject.replaceAll(emailTags.ACK_NO, row1[0].ack_no);

                mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                mail_body_text = mail_body_text.replaceAll(emailTags.ENTITY_TYPE, row1[0].entity_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                mail_body_text = mail_body_text.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                mail_body_text = mail_body_text.replaceAll(emailTags.PAN_NO, row1[0].pan_no);
                mail_body_text = mail_body_text.replaceAll(emailTags.COMPANY_NAME, row1[0].company_name);
                mail_body_text = mail_body_text.replaceAll(emailTags.COMPANY_PAN, row1[0].company_pan_no);
                mail_body_text = mail_body_text.replaceAll(emailTags.GSTIN_NO, row1[0].gstin_no);
                mail_body_text = mail_body_text.replaceAll(emailTags.CIN_NO, row1[0].cin_no);
                mail_body_text = mail_body_text.replaceAll(emailTags.REGISTRATION_NO, row1[0].registration_no);
                mail_body_text = mail_body_text.replaceAll(emailTags.ACK_NO, row1[0].ack_no);

                var mailOptions = {
                    from: process.env.MAIL_SENDER,
                    to: row1[0].email_id,
                    subject: mail_subject,
                    html: mail_body_text,
                }
                var mail_success = false;
                try {
                    await emailer.sendMail(mailOptions);
                    mail_success = true;
                } catch (err) {
                    _logger.error(err.stack);
                }
                if (mail_success) {
                    return 1;
                } else {
                    return -3; // sending failed
                }
            } else {
                return -2;// template not found
            }
        } else {
            return -1; // template not mapped
        }
    }
    return 0;
};

const send_entity_approval_email = async (reg_id) => {
    const _query1 = `SELECT u.entity_id, em.entity_name, u.added_date, u.is_enabled, u.approve_status, u.approved_date, u.approved_remark,
    u.first_name, u.middle_name, u.last_name, u.email_id, u.mobile_no, u.pan_no, po.org_type_name,
    u.company_name, et.reg_type_name AS registered_as, u.address_1, u.address_2, u.address_3, c.country_name, s.state_name, 
    d.district_name, b.block_name, u.pin_code, u.contact_no,
    u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no, u.mca_csr_f1_reg_no,
    u.fcra_no_with_status, u.fin_audit_rpt_filed

    FROM user_master u LEFT OUTER JOIN countries c ON u.country_id = c.country_id LEFT OUTER JOIN states s ON
    u.state_id = s.state_id LEFT OUTER JOIN districts d ON u.district_id = d.district_id LEFT OUTER JOIN blocks b
    ON u.block_id = b.block_id LEFT OUTER JOIN entity_reg_type_mast et ON u.registered_as_id = et.reg_type_id
    LEFT OUTER JOIN parent_orgs_mast po ON u.org_type_id = po.org_type_id LEFT OUTER JOIN entity_type em ON u.entity_id = em.entity_id

    WHERE u.reg_id = ? AND u.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [reg_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const _approve_status = row1[0].approve_status && validator.isNumeric(row1[0].approve_status.toString()) ? parseInt(row1[0].approve_status) : 0;
        if (_approve_status.toString() == '1') {
            const _entity_id = row1[0].entity_id && validator.isNumeric(row1[0].entity_id.toString()) ? BigInt(row1[0].entity_id) : 0;
            var template_id = 0;
            switch (_entity_id.toString()) {
                case '1': template_id = emailTemplate.ENTITY_APPROVAL_1; break;
                case '2': template_id = emailTemplate.ENTITY_APPROVAL_2; break;
                case '3': template_id = emailTemplate.ENTITY_APPROVAL_3; break;
                case '4': template_id = emailTemplate.ENTITY_APPROVAL_4; break;
                case '5': template_id = emailTemplate.ENTITY_APPROVAL_5; break;
                case '6': template_id = emailTemplate.ENTITY_APPROVAL_6; break;
                case '7': template_id = emailTemplate.ENTITY_APPROVAL_7; break;
            }
            if (template_id > 0) {
                const template = await email_template_get(template_id);
                if (template && template != null) {
                    var mail_subject = template.subject && template.subject.length > 0 ? template.subject : "";
                    var mail_body_text = template.body_text && template.body_text.length > 0 ? template.body_text : "";
                    var full_name_array = [];
                    if (row1[0].first_name && row1[0].first_name.length > 0) { full_name_array.push(row1[0].first_name); }
                    if (row1[0].middle_name && row1[0].middle_name.length > 0) { full_name_array.push(row1[0].middle_name); }
                    if (row1[0].last_name && row1[0].last_name.length > 0) { full_name_array.push(row1[0].last_name); }

                    mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_subject = mail_subject.replaceAll(emailTags.ENTITY_TYPE, row1[0].entity_name);
                    mail_subject = mail_subject.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                    mail_subject = mail_subject.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                    mail_subject = mail_subject.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                    mail_subject = mail_subject.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                    mail_subject = mail_subject.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                    mail_subject = mail_subject.replaceAll(emailTags.PAN_NO, row1[0].pan_no);
                    mail_subject = mail_subject.replaceAll(emailTags.COMPANY_NAME, row1[0].company_name);
                    mail_subject = mail_subject.replaceAll(emailTags.COMPANY_PAN, row1[0].company_pan_no);
                    mail_subject = mail_subject.replaceAll(emailTags.GSTIN_NO, row1[0].gstin_no);
                    mail_subject = mail_subject.replaceAll(emailTags.CIN_NO, row1[0].cin_no);
                    mail_subject = mail_subject.replaceAll(emailTags.REGISTRATION_NO, row1[0].registration_no);

                    mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_body_text = mail_body_text.replaceAll(emailTags.ENTITY_TYPE, row1[0].entity_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.PAN_NO, row1[0].pan_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.COMPANY_NAME, row1[0].company_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.COMPANY_PAN, row1[0].company_pan_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.GSTIN_NO, row1[0].gstin_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.CIN_NO, row1[0].cin_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.REGISTRATION_NO, row1[0].registration_no);

                    var mailOptions = {
                        from: process.env.MAIL_SENDER,
                        to: row1[0].email_id,
                        subject: mail_subject,
                        html: mail_body_text,
                    }
                    var mail_success = false;
                    try {
                        await emailer.sendMail(mailOptions);
                        mail_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }
                }
            }
            const _query2 = `SELECT user_id FROM user_account WHERE reg_id = ? AND is_deleted = false AND is_activated = false`;
            const row2 = await db.sequelize.query(_query2, { replacements: [reg_id], type: QueryTypes.SELECT });
            for (let k = 0; row2 && k < row2.length; k++) {
                await send_entity_user_activation(row2[k].user_id);
            }
        }
    }
};

const send_entity_reject_email = async (reg_id) => {
    const _query1 = `SELECT u.unique_id, u.entity_id, em.entity_name, u.added_date, u.is_enabled, u.approve_status, 
    u.approved_date, u.approved_remark, u.rejected_date, u.rejected_remark, u.reject_resume_token,
    u.first_name, u.middle_name, u.last_name, u.email_id, u.mobile_no, u.pan_no, po.org_type_name,
    u.company_name, et.reg_type_name AS registered_as, u.address_1, u.address_2, u.address_3, c.country_name, s.state_name, 
    d.district_name, b.block_name, u.pin_code, u.contact_no,
    u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no, u.mca_csr_f1_reg_no,
    u.fcra_no_with_status, u.fin_audit_rpt_filed

    FROM user_master u LEFT OUTER JOIN countries c ON u.country_id = c.country_id LEFT OUTER JOIN states s ON
    u.state_id = s.state_id LEFT OUTER JOIN districts d ON u.district_id = d.district_id LEFT OUTER JOIN blocks b
    ON u.block_id = b.block_id LEFT OUTER JOIN entity_reg_type_mast et ON u.registered_as_id = et.reg_type_id
    LEFT OUTER JOIN parent_orgs_mast po ON u.org_type_id = po.org_type_id LEFT OUTER JOIN entity_type em ON u.entity_id = em.entity_id

    WHERE u.reg_id = ? AND u.is_deleted = false`;
    const row1 = await db.sequelize.query(_query1, { replacements: [reg_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const _approve_status = row1[0].approve_status && validator.isNumeric(row1[0].approve_status.toString()) ? parseInt(row1[0].approve_status) : 0;
        if (_approve_status.toString() == '2') {
            const _entity_id = row1[0].entity_id && validator.isNumeric(row1[0].entity_id.toString()) ? BigInt(row1[0].entity_id) : 0;
            var template_id = 0;
            switch (_entity_id.toString()) {
                case '1': template_id = emailTemplate.ENTITY_REJECTION_1; break;
                case '2': template_id = emailTemplate.ENTITY_REJECTION_2; break;
                case '3': template_id = emailTemplate.ENTITY_REJECTION_3; break;
                case '4': template_id = emailTemplate.ENTITY_REJECTION_4; break;
                case '5': template_id = emailTemplate.ENTITY_REJECTION_5; break;
                case '6': template_id = emailTemplate.ENTITY_REJECTION_6; break;
                case '7': template_id = emailTemplate.ENTITY_REJECTION_7; break;
            }
            if (template_id > 0) {
                const template = await email_template_get(template_id);
                if (template && template != null) {
                    var mail_subject = template.subject && template.subject.length > 0 ? template.subject : "";
                    var mail_body_text = template.body_text && template.body_text.length > 0 ? template.body_text : "";
                    var full_name_array = [];
                    if (row1[0].first_name && row1[0].first_name.length > 0) { full_name_array.push(row1[0].first_name); }
                    if (row1[0].middle_name && row1[0].middle_name.length > 0) { full_name_array.push(row1[0].middle_name); }
                    if (row1[0].last_name && row1[0].last_name.length > 0) { full_name_array.push(row1[0].last_name); }

                    const tempTknData = { id: row1[0].unique_id, key: row1[0].reject_resume_token };
                    const link_data = { page: 'registration_reject_resume', token: Buffer.from(JSON.stringify(tempTknData), 'utf8').toString('base64') };
                    const encoded_data = encodeURIComponent(Buffer.from(JSON.stringify(link_data), 'utf8').toString('base64'));
                    const link_url = process.env.FRONT_SITE_URL + 'email/' + encoded_data;

                    mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_subject = mail_subject.replaceAll(emailTags.ENTITY_TYPE, row1[0].entity_name);
                    mail_subject = mail_subject.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                    mail_subject = mail_subject.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                    mail_subject = mail_subject.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                    mail_subject = mail_subject.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                    mail_subject = mail_subject.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                    mail_subject = mail_subject.replaceAll(emailTags.PAN_NO, row1[0].pan_no);
                    mail_subject = mail_subject.replaceAll(emailTags.COMPANY_NAME, row1[0].company_name);
                    mail_subject = mail_subject.replaceAll(emailTags.COMPANY_PAN, row1[0].company_pan_no);
                    mail_subject = mail_subject.replaceAll(emailTags.GSTIN_NO, row1[0].gstin_no);
                    mail_subject = mail_subject.replaceAll(emailTags.CIN_NO, row1[0].cin_no);
                    mail_subject = mail_subject.replaceAll(emailTags.REGISTRATION_NO, row1[0].registration_no);
                    mail_subject = mail_subject.replaceAll(emailTags.REJECT_REMARK, row1[0].rejected_remark);
                    mail_subject = mail_subject.replaceAll(emailTags.REJECT_RESUME_LINK, link_url);

                    mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_body_text = mail_body_text.replaceAll(emailTags.ENTITY_TYPE, row1[0].entity_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FIRST_NAME, row1[0].first_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MIDDLE_NAME, row1[0].middle_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.LAST_NAME, row1[0].last_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, row1[0].email_id);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MOBILE_NO, row1[0].mobile_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.PAN_NO, row1[0].pan_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.COMPANY_NAME, row1[0].company_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.COMPANY_PAN, row1[0].company_pan_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.GSTIN_NO, row1[0].gstin_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.CIN_NO, row1[0].cin_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.REGISTRATION_NO, row1[0].registration_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.REJECT_REMARK, row1[0].rejected_remark);
                    mail_body_text = mail_body_text.replaceAll(emailTags.REJECT_RESUME_LINK, link_url);

                    var mailOptions = {
                        from: process.env.MAIL_SENDER,
                        to: row1[0].email_id,
                        subject: mail_subject,
                        html: mail_body_text,
                    }
                    var mail_success = false;
                    try {
                        await emailer.sendMail(mailOptions);
                        mail_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }
                }
            }
        }
    }
};

const send_entity_user_activation = async (user_id) => {
    const _query4 = `SELECT a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, d.design_name, a.is_activated, a.re_activation_required
    FROM user_account a LEFT OUTER JOIN designation_mast d ON a.design_id = d.design_id WHERE a.user_id = ? AND a.is_deleted = false`;
    const row4 = await db.sequelize.query(_query4, { replacements: [user_id], type: QueryTypes.SELECT });
    if (row4 && row4.length > 0) {

        if (row4[0].is_activated && row4[0].is_activated == true) {
            return -1;      /*Already activated*/
        }
        const uuid = crypto.randomUUID();
        const link_data = { page: 'entity_user_activate', token: uuid.toString(), };
        const encoded_data = encodeURIComponent(Buffer.from(JSON.stringify(link_data), 'utf8').toString('base64'));
        var link_url = process.env.FRONT_SITE_URL + 'email/' + encoded_data;

        const _query1 = `INSERT INTO user_link_act(unique_id, user_id, sent_date, email_id, mobile_no, re_activation_required) VALUES (?, ?, ?, ?, ?, ?) RETURNING "link_id"`;
        const [row1] = await db.sequelize.query(_query1, { replacements: [uuid, user_id, new Date(), row4[0].email_id, row4[0].mobile_no, row4[0].re_activation_required], type: QueryTypes.INSERT });
        const link_id = (row1 && row1.length > 0 && row1[0] ? row1[0].link_id : 0);
        if (link_id > 0) {
            const tpltUser = await email_template_get(emailTemplate.ENTITY_USER_ACTIVATION_LINK);
            if (tpltUser && tpltUser != null) {
                if (tpltUser.is_enabled) {
                    var mail_subject = tpltUser.subject && tpltUser.subject.length > 0 ? tpltUser.subject : "";
                    var mail_body_text = tpltUser.body_text && tpltUser.body_text.length > 0 ? tpltUser.body_text : "";
                    var full_name_array = [];
                    if (row4[0].first_name && row4[0].first_name.length > 0) { full_name_array.push(row4[0].first_name); }
                    if (row4[0].middle_name && row4[0].middle_name.length > 0) { full_name_array.push(row4[0].middle_name); }
                    if (row4[0].last_name && row4[0].last_name.length > 0) { full_name_array.push(row4[0].last_name); }

                    mail_subject = mail_subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_subject = mail_subject.replaceAll(emailTags.ACTIVATION_LINK, link_url);
                    mail_subject = mail_subject.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                    mail_subject = mail_subject.replaceAll(emailTags.MIDDLE_NAME, row4[0].middle_name);
                    mail_subject = mail_subject.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                    mail_subject = mail_subject.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_subject = mail_subject.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                    mail_subject = mail_subject.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                    mail_subject = mail_subject.replaceAll(emailTags.DESIGNATION, row4[0].design_name);

                    mail_body_text = mail_body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                    mail_body_text = mail_body_text.replaceAll(emailTags.ACTIVATION_LINK, link_url);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MIDDLE_NAME, row4[0].middle_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                    mail_body_text = mail_body_text.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                    mail_body_text = mail_body_text.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                    mail_body_text = mail_body_text.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                    mail_body_text = mail_body_text.replaceAll(emailTags.DESIGNATION, row4[0].design_name);

                    var mailOptions = {
                        from: process.env.MAIL_SENDER, // sender address
                        to: row4[0].email_id, // list of receivers
                        subject: mail_subject, // Subject line 
                        html: mail_body_text, // html body
                    }
                    var is_success = false;
                    try {
                        await emailer.sendMail(mailOptions);
                        is_success = true;
                    } catch (err) {
                        _logger.error(err.stack);
                    }
                    if (is_success) {
                        return 1;
                    } else {
                        return 0; /* Sending fail*/
                    }
                } else {
                    return -4;      /*Templete is disabled*/
                }
            } else {
                return -3;      /*Templete not found*/
            }
        }
        else {
            return -2;     /*Unable to add invite link uuid*/
        }
    }
    return 0;       /*admin data not found*/
};

const send_entity_user_reset = async (user_id) => {
    const _query4 = `SELECT em.entity_name, 
    a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, d.design_name, a.is_activated
    FROM user_account a LEFT OUTER JOIN designation_mast d ON a.design_id = d.design_id
    INNER JOIN user_master u ON a.reg_id = u.reg_id LEFT OUTER JOIN entity_type em ON u.entity_id = em.entity_id
    WHERE a.user_id = ? AND a.is_deleted = false`;
    const row4 = await db.sequelize.query(_query4, { replacements: [user_id], type: QueryTypes.SELECT });
    if (row4 && row4.length > 0) {
        if (row4[0].is_activated && row4[0].is_activated == true) {
            const uuid = crypto.randomUUID();
            const link_data = { page: 'entity_user_reset', token: uuid.toString(), };
            const encoded_data = encodeURIComponent(Buffer.from(JSON.stringify(link_data), 'utf8').toString('base64'));
            var reset_link = process.env.FRONT_SITE_URL + 'email/' + encoded_data;

            const _query1 = `INSERT INTO user_link_reset(unique_id, user_id, sent_date) VALUES (?, ?, ?) RETURNING "reset_id"`;
            const [row1] = await db.sequelize.query(_query1, { replacements: [uuid, user_id, new Date()], type: QueryTypes.INSERT });
            const reset_id = (row1 && row1.length > 0 && row1[0] ? row1[0].reset_id : 0);
            if (reset_id > 0) {
                const rowT = await db.sequelize.query(`SELECT subject, body_text, is_enabled FROM email_template WHERE template_id = ?`,
                    { replacements: [emailTemplate.ENTITY_RESET_PASS_LINK], type: QueryTypes.SELECT });
                if (rowT && rowT.length > 0) {
                    if (rowT[0].is_enabled) {
                        var subject = rowT[0].subject && rowT[0].subject.length > 0 ? rowT[0].subject : "";
                        var body_text = rowT[0].body_text && rowT[0].body_text.length > 0 ? rowT[0].body_text : "";
                        var full_name_array = [];
                        if (row4[0].first_name && row4[0].first_name.length > 0) { full_name_array.push(row4[0].first_name); }
                        if (row4[0].middle_name && row4[0].middle_name.length > 0) { full_name_array.push(row4[0].middle_name); }
                        if (row4[0].last_name && row4[0].last_name.length > 0) { full_name_array.push(row4[0].last_name); }

                        subject = subject.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                        subject = subject.replaceAll(emailTags.ENTITY_TYPE, row4[0].entity_name);
                        subject = subject.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                        subject = subject.replaceAll(emailTags.MIDDLE_NAME, row4[0].middle_name);
                        subject = subject.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                        subject = subject.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                        subject = subject.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                        subject = subject.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                        subject = subject.replaceAll(emailTags.DESIGNATION, row4[0].design_name);

                        body_text = body_text.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
                        body_text = body_text.replaceAll(emailTags.ENTITY_TYPE, row4[0].entity_name);
                        body_text = body_text.replaceAll(emailTags.FIRST_NAME, row4[0].first_name);
                        body_text = body_text.replaceAll(emailTags.MIDDLE_NAME, row4[0].middle_name);
                        body_text = body_text.replaceAll(emailTags.LAST_NAME, row4[0].last_name);
                        body_text = body_text.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
                        body_text = body_text.replaceAll(emailTags.EMAIL_ID, row4[0].email_id);
                        body_text = body_text.replaceAll(emailTags.MOBILE_NO, row4[0].mobile_no);
                        body_text = body_text.replaceAll(emailTags.DESIGNATION, row4[0].design_name);
                        body_text = body_text.replaceAll(emailTags.RESET_LINK, reset_link);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER, // sender address
                            to: row4[0].email_id, // list of receivers
                            subject: subject, // Subject line 
                            html: body_text, // html body
                        }
                        var is_success = false;
                        try {
                            await emailer.sendMail(mailOptions);
                            is_success = true;
                        } catch (err) {
                            _logger.error(err.stack);
                        }
                        if (is_success) {
                            return 1;
                        } else {
                            return 0; /* Sending fail*/
                        }
                    } else {
                        return -4;      /*Templete is disabled*/
                    }
                } else {
                    return -3;      /*Templete not found*/
                }
            }
            else {
                return -2;     /*Unable to add reset link uuid*/
            }
        } else {
            return -1;      /*account not activated*/
        }
    }
    return 0;       /*admin data not found*/
}

const accreditation_level_list = async () => {
    var list = [];
    const _query1 = `SELECT level_id, level_name FROM accreditation_level ORDER BY level_rank`;
    const row1 = await db.sequelize.query(_query1, { replacements: [], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            level_id: row1[i].level_id,
            level_name: row1[i].level_name,
        });
    }
    return list;
};

const accreditation_question_list = async (level_id) => {
    var list = [];
    const _query1 = `SELECT aq.que_id, aq.que_text FROM accreditation_question aq WHERE ? IN (SELECT UNNEST(aq.applicable_levels)) 
    AND aq.is_enabled = true AND aq.is_deleted = false
    ORDER BY CASE WHEN COALESCE(aq.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(aq.sort_order, 0) END, aq.que_id DESC`;
    const row1 = await db.sequelize.query(_query1, { replacements: [level_id], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            que_id: row1[i].que_id,
            que_text: row1[i].que_text,
        });
    }
    return list;
};

const accreditation_document_list = async (level_id) => {
    var documents = [];
    const _query1 = `SELECT d.document_id, d.doc_name, d.doc_lng_key, d.file_type_allowed, d.file_max_size, m.is_required 
    FROM accreditation_doc_mast d INNER JOIN accreditation_doc_mapp m ON d.document_id = m.document_id
    WHERE m.level_id = ? AND d.is_enabled = true AND d.is_deleted = false
    ORDER BY CASE WHEN COALESCE(d.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(d.sort_order, 0) END, d.document_id DESC`;
    const row1 = await db.sequelize.query(_query1, { replacements: [level_id], type: QueryTypes.SELECT });
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

const project_thematic_area_list = async () => {
    var list = [];
    const _query0 = `SELECT m.thematic_id, m.thematic_name FROM thematic_area m WHERE m.is_enabled = true AND m.is_deleted = false
    ORDER BY CASE WHEN COALESCE(m.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(m.sort_order, 0) END`;
    const row0 = await db.sequelize.query(_query0, { replacements: [], type: QueryTypes.SELECT });
    for (let i = 0; row0 && i < row0.length; i++) {
        list.push({
            id: row0[i].thematic_id,
            name: row0[i].thematic_name,
        });
    }
    return list;
};

const project_sdg_goals_list = async () => {
    var list = [];
    const _query1 = `SELECT m.goal_id, m.goal_name FROM sdg_goals m WHERE m.is_enabled = true AND m.is_deleted = false
    ORDER BY CASE WHEN COALESCE(m.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(m.sort_order, 0) END`;
    const row1 = await db.sequelize.query(_query1, { replacements: [], type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push({
            id: row1[i].goal_id,
            name: row1[i].goal_name,
        });
    }
    return list;
};

const project_rfp_document_list = async (purpose_id) => {
    var list = [];
    const _query2 = `SELECT d.document_id, d.doc_name, d.doc_lng_key, d.file_type_allowed, d.file_max_size, m.is_required 
    FROM rfp_doc_mast d INNER JOIN rfp_doc_mapp m ON d.document_id = m.document_id WHERE m.purpose_id = ? AND d.is_enabled = true AND d.is_deleted = false
    ORDER BY CASE WHEN COALESCE(d.sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(d.sort_order, 0) END, d.document_id DESC`;
    const row2 = await db.sequelize.query(_query2, { replacements: [purpose_id], type: QueryTypes.SELECT });
    for (let i = 0; row2 && i < row2.length; i++) {
        var file_type_allowed = [];
        if (row2[i].file_type_allowed && row2[i].file_type_allowed.length > 0) {
            const file_type_allowed_array = row2[i].file_type_allowed.split(',');
            for (let k = 0; file_type_allowed_array && k < file_type_allowed_array.length; k++) {
                if (file_type_allowed_array[k] && file_type_allowed_array[k].trim().length > 0) {
                    file_type_allowed.push(file_type_allowed_array[k].trim());
                }
            }
        }
        var _file_max_size = row2[i].file_max_size != null && validator.isNumeric(row2[i].file_max_size.toString()) ? BigInt(row2[i].file_max_size) : 0;
        list.push({
            document_id: row2[i].document_id,
            doc_name: row2[i].doc_name,
            doc_lng_key: row2[i].doc_lng_key,
            file_type_allowed: file_type_allowed,
            file_max_size: _file_max_size,
            is_required: row2[i].is_required,
        });
    }
    return list;
};

const project_sdg_goals_get_by_ids = async (ids) => {
    var list = [];
    const _query = `SELECT goal_name FROM sdg_goals WHERE goal_id IN (?)`;
    const row = await db.sequelize.query(_query, { replacements: [ids], type: QueryTypes.SELECT });
    for (let i = 0; row && i < row.length; i++) {
        list.push(row[i].goal_name);
    }
    return list;
};

const project_dynamic_field_form = async () => {
    var list = [];
    const _query = `SELECT jsonb_build_object('field_id', f.field_id, 'field_type', f.field_type, 'lable_name', f.lable_name,
    'lable_lng_key', f.lable_lng_key, 'placeholder_text', f.placeholder_text, 'placeholder_lng_key', f.placeholder_lng_key,
    'field_values', f.field_values, 'user_value', '', 'validations', coalesce(v.validations, '[]')) as row_data
    FROM project_field_mast f
    LEFT JOIN LATERAL (	
        SELECT jsonb_agg(jsonb_build_object('vld_type_id', v.vld_type_id, 'pattern_value', v.pattern_value)) as validations
        FROM project_field_validation v WHERE v.field_id = f.field_id	
    ) as v on true
    WHERE f.is_enabled = true AND f.is_deleted = false`;
    const row = await db.sequelize.query(_query, { type: QueryTypes.SELECT });
    for (let i = 0; row && i < row.length; i++) {
        list.push(row[i].row_data);
    }
    return list;
};

const project_dynamic_field_values = async (project_id) => {
    var list = [];
    const _query = `SELECT field_id, user_value FROM project_field_value WHERE project_id = ?`;
    const row = await db.sequelize.query(_query, { replacements: [project_id], type: QueryTypes.SELECT });
    for (let i = 0; row && i < row.length; i++) {
        list.push({
            field_id: row[i].field_id,
            user_value: row[i].user_value,
        });
    }
    return list;
}

const project_dynamic_field_data = async (project_id) => {
    var list = [];
    const _query = `SELECT f.field_type, f.lable_name, v.user_value 
    FROM project_field_value v INNER JOIN project_field_mast f ON v.field_id = f.field_id WHERE v.project_id = ?`;
    const row = await db.sequelize.query(_query, { replacements: [project_id], type: QueryTypes.SELECT });
    for (let i = 0; row && i < row.length; i++) {
        list.push({
            field_type: row[i].field_type,
            lable_name: row[i].lable_name,
            user_value: row[i].user_value,
        });
    }
    return list;
}

const project_charges_config_data = async (project_type) => {
    var data = { pg_charges: 0, pg_amt_type: 0, protean_fees: 0, pf_amt_type: 0, tax_charges: 0, tax_amt_type: 0, };
    const _query = `SELECT pg_charges, pg_amt_type, protean_fees, pf_amt_type, tax_charges, tax_amt_type 
    FROM project_charge_config WHERE LOWER(project_type) = LOWER(?)`;
    const row = await db.sequelize.query(_query, { replacements: [project_type], type: QueryTypes.SELECT });
    if (row && row.length > 0) {
        const _pg_charges = row[0].pg_charges != null && validator.isNumeric(row[0].pg_charges.toString()) ? parseFloat(row[0].pg_charges) : 0;
        const _pg_amt_type = row[0].pg_amt_type != null && validator.isNumeric(row[0].pg_amt_type.toString()) ? parseInt(row[0].pg_amt_type) : 0;
        const _protean_fees = row[0].protean_fees != null && validator.isNumeric(row[0].protean_fees.toString()) ? parseFloat(row[0].protean_fees) : 0;
        const _pf_amt_type = row[0].pf_amt_type != null && validator.isNumeric(row[0].pf_amt_type.toString()) ? parseInt(row[0].pf_amt_type) : 0;
        const _tax_charges = row[0].tax_charges != null && validator.isNumeric(row[0].tax_charges.toString()) ? parseFloat(row[0].tax_charges) : 0;
        const _tax_amt_type = row[0].tax_amt_type != null && validator.isNumeric(row[0].tax_amt_type.toString()) ? parseInt(row[0].tax_amt_type) : 0;

        data.pg_charges = _pg_charges;
        data.pg_amt_type = _pg_amt_type;
        data.protean_fees = _protean_fees;
        data.pf_amt_type = _pf_amt_type;
        data.tax_charges = _tax_charges;
        data.tax_amt_type = _tax_amt_type;
    }
    return data;
}

const payment_order_id_new = async () => {
    var order_id = '';
    const row = await db.sequelize.query(`SELECT nextval('seq_random_payment_id') as order_id`,
        { type: QueryTypes.SELECT });
    if (row && row.length > 0) {
        order_id = row[0].order_id.toString().padStart(7, '0');
    }
    return order_id;
}


module.exports = {
    country_calling_code,
    entity_dynamic_form_fields,
    entity_dynamic_form_fields_by_reg_type_id,
    entity_type_get,
    entity_permissions,
    protean_user_permissions,
    email_template_get,
    sms_template_get,
    country_dropdown,
    state_dropdown,
    district_dropdown,
    block_dropdown,
    banks_dropdown,
    is_mobile_registered,
    is_email_registered,
    check_account_mobile_registered,
    check_account_email_registered,
    ifsc_code_search,
    search_parent_entity,
    send_entity_registration_email,
    send_entity_approval_email,
    send_entity_reject_email,
    send_entity_user_activation,
    send_entity_user_reset,

    accreditation_level_list,
    accreditation_question_list,
    accreditation_document_list,

    project_thematic_area_list,
    project_sdg_goals_list,
    project_rfp_document_list,
    project_sdg_goals_get_by_ids,
    project_dynamic_field_form,
    project_dynamic_field_values,
    project_dynamic_field_data,

    project_charges_config_data,
    payment_order_id_new,
};