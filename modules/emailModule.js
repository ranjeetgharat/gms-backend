const _logger = require('../logger/winston').logger;
const db = require('../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
var validator = require('validator');
const { emailTemplate, emailTags } = require('../constants/emailConfig');
const emailer = require('../utilities/emailer');
const utils = require('../utilities/utils');
const crypto = require('crypto');
const commonModule = require('./commonModule');
const entityDataModule = require('./entityDataModule');
var dateFormat = require('date-format');

const email_datetime_format = 'dd, MMM yyyy hh:mm';

const payment_bcc_emails = () => {
    const emails = process.env.PAYMENT_BCC_EMAIL;
    if (emails && emails.length > 0) {
        var temp = [];
        const emails_list = emails.split(',').join('|');
        const emails_list_array = emails_list.split('|');
        for (let i = 0; i < emails_list_array.length; i++) {
            if (emails_list_array[i] && emails_list_array[i].length > 0) {
                if (validator.isEmail(emails_list_array[i])) {
                    temp.push(emails_list_array[i]);
                }
            }
        }
        if (temp.length > 0) {
            return temp.join(', ');
        }
    }
    return '';
}

const project_payment_internal = async (order_id) => {
    const _query1 = `SELECT o.order_id, o.payment_date, o.is_success, o.total_amount, o.pg_charges, o.protean_fees, 
    o.tax_amount, o.net_amount, o.bank_ref_no, o.transactionid,
    p.project_no, p.project_name, p.project_cost, m.milestone_no, m.milestone_name,
    uo.reg_id AS uo_reg_id, uo.company_name AS uo_company_name,
    ia.reg_id AS ia_reg_id, ia.company_name AS ia_company_name
    FROM project_payment_int o INNER JOIN project_accepted a ON o.accepted_id = a.accepted_id
    INNER JOIN project_created p ON o.project_id = p.project_id
    INNER JOIN project_milestone m ON o.milestone_id = m.milestone_id
    INNER JOIN user_master uo ON a.owner_reg_id = uo.reg_id
    INNER JOIN user_master ia ON a.ia_reg_id = ia.reg_id
    WHERE o.order_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [order_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const rowData = row1[0];

        const _total_amount = rowData.total_amount != null && validator.isNumeric(rowData.total_amount.toString()) ? parseFloat(rowData.total_amount) : 0;
        const _pg_charges = rowData.pg_charges != null && validator.isNumeric(rowData.pg_charges.toString()) ? parseFloat(rowData.pg_charges) : 0;
        const _protean_fees = rowData.protean_fees != null && validator.isNumeric(rowData.protean_fees.toString()) ? parseFloat(rowData.protean_fees) : 0;
        const _tax_amount = rowData.tax_amount != null && validator.isNumeric(rowData.tax_amount.toString()) ? parseFloat(rowData.tax_amount) : 0;
        const _net_amount = rowData.net_amount != null && validator.isNumeric(rowData.net_amount.toString()) ? parseFloat(rowData.net_amount) : 0;
        const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(rowData.project_cost) : 0;
        const _is_success = rowData.is_success && rowData.is_success == true ? "Success" : "Failed";

        function fn_replace_str(_str) {
            _str = _str.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
            _str = _str.replaceAll(emailTags.ORDER_ID, rowData.order_id);
            _str = _str.replaceAll(emailTags.PAYMENT_DATETIME, dateFormat(email_datetime_format, rowData.payment_date));
            _str = _str.replaceAll(emailTags.PAYMENT_STATUS, _is_success);
            _str = _str.replaceAll(emailTags.TOTAL_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_total_amount));
            _str = _str.replaceAll(emailTags.PG_CHARGES, '₹ ' + utils.numberWithIndianFormat(_pg_charges));
            _str = _str.replaceAll(emailTags.PROTEAN_FEES, '₹ ' + utils.numberWithIndianFormat(_protean_fees));
            _str = _str.replaceAll(emailTags.TAXES_AMT, '₹ ' + utils.numberWithIndianFormat(_tax_amount));
            _str = _str.replaceAll(emailTags.NET_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_net_amount));
            _str = _str.replaceAll(emailTags.BANK_REF_NO, rowData.bank_ref_no);
            _str = _str.replaceAll(emailTags.TRANSACTION_ID, rowData.transactionid);
            _str = _str.replaceAll(emailTags.PROJECT_NO, rowData.project_no);
            _str = _str.replaceAll(emailTags.PROJECT_NAME, rowData.project_name);
            _str = _str.replaceAll(emailTags.PROJECT_COST, '₹ ' + utils.numberWithIndianFormat(_project_cost));
            _str = _str.replaceAll(emailTags.MILESTONE_NO, rowData.milestone_no);
            _str = _str.replaceAll(emailTags.MILESTONE_NAME, rowData.milestone_name);
            _str = _str.replaceAll(emailTags.PROJ_OWNER_COMPANY, rowData.uo_company_name);
            _str = _str.replaceAll(emailTags.PROJ_IA_COMPANY, rowData.ia_company_name);

            return _str;
        }

        function fn_replace_user(_str, _user) {
            var full_name_array = [];
            if (_user.first_name && _user.first_name.length > 0) { full_name_array.push(_user.first_name); }
            if (_user.middle_name && _user.middle_name.length > 0) { full_name_array.push(_user.middle_name); }
            if (_user.last_name && _user.last_name.length > 0) { full_name_array.push(_user.last_name); }

            _str = _str.replaceAll(emailTags.FIRST_NAME, _user.first_name);
            _str = _str.replaceAll(emailTags.MIDDLE_NAME, _user.middle_name);
            _str = _str.replaceAll(emailTags.LAST_NAME, _user.last_name);
            _str = _str.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
            _str = _str.replaceAll(emailTags.EMAIL_ID, _user.email_id);
            _str = _str.replaceAll(emailTags.MOBILE_NO, _user.mobile_no);
            _str = _str.replaceAll(emailTags.DESIGNATION, _user.design_name);

            return _str;
        }

        const uoT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_INT_TO_OWNER);
        if (uoT && uoT != null) {
            if (uoT.is_enabled && uoT.is_enabled == true) {
                const users1 = await entityDataModule.admin_account_view_list(rowData.uo_reg_id);
                if (users1 && users1.length > 0) {
                    for (let g = 0; g < users1.length; g++) {
                        const eleUsr = users1[g];

                        var mail_subject = uoT.subject && uoT.subject.length > 0 ? uoT.subject : "";
                        var mail_body_text = uoT.body_text && uoT.body_text.length > 0 ? uoT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
        const iaT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_INT_TO_IA);
        if (iaT && iaT != null) {
            if (iaT.is_enabled && iaT.is_enabled == true) {
                const users2 = await entityDataModule.admin_account_view_list(rowData.ia_reg_id);
                if (users2 && users2.length > 0) {
                    for (let g = 0; g < users2.length; g++) {
                        const eleUsr = users2[g];

                        var mail_subject = iaT.subject && iaT.subject.length > 0 ? iaT.subject : "";
                        var mail_body_text = iaT.body_text && iaT.body_text.length > 0 ? iaT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
    }
}

const project_payment_external = async (order_id) => {
    const _query1 = `SELECT o.order_id, o.payment_date, o.is_success, o.total_amount, o.pg_charges, o.protean_fees, 
    o.tax_amount, o.net_amount, o.bank_ref_no, o.transactionid,
    o.project_name, o.milestone_name,
    
    uo.reg_id AS uo_reg_id, uo.company_name AS uo_company_name,
    ia.reg_id AS ia_reg_id, ia.company_name AS ia_company_name
    
    FROM project_payment_ext o 
    INNER JOIN user_master uo ON o.paid_by_reg_id = uo.reg_id
    INNER JOIN user_master ia ON o.paid_to_reg_id = ia.reg_id
    WHERE o.order_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [order_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const rowData = row1[0];

        const _total_amount = rowData.total_amount != null && validator.isNumeric(rowData.total_amount.toString()) ? parseFloat(rowData.total_amount) : 0;
        const _pg_charges = rowData.pg_charges != null && validator.isNumeric(rowData.pg_charges.toString()) ? parseFloat(rowData.pg_charges) : 0;
        const _protean_fees = rowData.protean_fees != null && validator.isNumeric(rowData.protean_fees.toString()) ? parseFloat(rowData.protean_fees) : 0;
        const _tax_amount = rowData.tax_amount != null && validator.isNumeric(rowData.tax_amount.toString()) ? parseFloat(rowData.tax_amount) : 0;
        const _net_amount = rowData.net_amount != null && validator.isNumeric(rowData.net_amount.toString()) ? parseFloat(rowData.net_amount) : 0;
        const _is_success = rowData.is_success && rowData.is_success == true ? "Success" : "Failed";

        function fn_replace_str(_str) {
            _str = _str.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
            _str = _str.replaceAll(emailTags.ORDER_ID, rowData.order_id);
            _str = _str.replaceAll(emailTags.PAYMENT_DATETIME, dateFormat(email_datetime_format, rowData.payment_date));
            _str = _str.replaceAll(emailTags.PAYMENT_STATUS, _is_success);
            _str = _str.replaceAll(emailTags.TOTAL_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_total_amount));
            _str = _str.replaceAll(emailTags.PG_CHARGES, '₹ ' + utils.numberWithIndianFormat(_pg_charges));
            _str = _str.replaceAll(emailTags.PROTEAN_FEES, '₹ ' + utils.numberWithIndianFormat(_protean_fees));
            _str = _str.replaceAll(emailTags.TAXES_AMT, '₹ ' + utils.numberWithIndianFormat(_tax_amount));
            _str = _str.replaceAll(emailTags.NET_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_net_amount));
            _str = _str.replaceAll(emailTags.BANK_REF_NO, rowData.bank_ref_no);
            _str = _str.replaceAll(emailTags.TRANSACTION_ID, rowData.transactionid);
            _str = _str.replaceAll(emailTags.PROJECT_NAME, rowData.project_name);
            _str = _str.replaceAll(emailTags.MILESTONE_NAME, rowData.milestone_name);
            _str = _str.replaceAll(emailTags.PROJ_OWNER_COMPANY, rowData.uo_company_name);
            _str = _str.replaceAll(emailTags.PROJ_IA_COMPANY, rowData.ia_company_name);

            return _str;
        }

        function fn_replace_user(_str, _user) {
            var full_name_array = [];
            if (_user.first_name && _user.first_name.length > 0) { full_name_array.push(_user.first_name); }
            if (_user.middle_name && _user.middle_name.length > 0) { full_name_array.push(_user.middle_name); }
            if (_user.last_name && _user.last_name.length > 0) { full_name_array.push(_user.last_name); }

            _str = _str.replaceAll(emailTags.FIRST_NAME, _user.first_name);
            _str = _str.replaceAll(emailTags.MIDDLE_NAME, _user.middle_name);
            _str = _str.replaceAll(emailTags.LAST_NAME, _user.last_name);
            _str = _str.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
            _str = _str.replaceAll(emailTags.EMAIL_ID, _user.email_id);
            _str = _str.replaceAll(emailTags.MOBILE_NO, _user.mobile_no);
            _str = _str.replaceAll(emailTags.DESIGNATION, _user.design_name);

            return _str;
        }

        const uoT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_EXT_TO_OWNER);
        if (uoT && uoT != null) {
            if (uoT.is_enabled && uoT.is_enabled == true) {
                const users1 = await entityDataModule.admin_account_view_list(rowData.uo_reg_id);
                if (users1 && users1.length > 0) {
                    for (let g = 0; g < users1.length; g++) {
                        const eleUsr = users1[g];

                        var mail_subject = uoT.subject && uoT.subject.length > 0 ? uoT.subject : "";
                        var mail_body_text = uoT.body_text && uoT.body_text.length > 0 ? uoT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
        const iaT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_EXT_TO_IA);
        if (iaT && iaT != null) {
            if (iaT.is_enabled && iaT.is_enabled == true) {
                const users2 = await entityDataModule.admin_account_view_list(rowData.ia_reg_id);
                if (users2 && users2.length > 0) {
                    for (let g = 0; g < users2.length; g++) {
                        const eleUsr = users2[g];

                        var mail_subject = iaT.subject && iaT.subject.length > 0 ? iaT.subject : "";
                        var mail_body_text = iaT.body_text && iaT.body_text.length > 0 ? iaT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
    }
}

const project_payment_grant_csr = async (order_id) => {
    const _query1 = `SELECT o.order_id, o.payment_date, o.is_success, o.total_amount, o.pg_charges, o.protean_fees, 
    o.tax_amount, o.net_amount, o.bank_ref_no, o.transactionid,
    p.project_no, p.project_name,
    
    uo.reg_id AS uo_reg_id, uo.company_name AS uo_company_name,
    ia.reg_id AS ia_reg_id, ia.company_name AS ia_company_name, ia.first_name AS ia_first_name, ia.middle_name AS ia_middle_name,
    ia.last_name AS ia_last_name, ia.email_id AS ia_email_id, ia.mobile_no AS ia_mobile_no, ia.pan_no AS ia_pan_no
    
    FROM project_payment_fund o INNER JOIN project_created p ON o.project_id = p.project_id
    INNER JOIN user_master uo ON p.reg_id = uo.reg_id
    INNER JOIN user_master ia ON o.paid_by_reg_id = ia.reg_id
    WHERE o.order_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [order_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const rowData = row1[0];

        const _total_amount = rowData.total_amount != null && validator.isNumeric(rowData.total_amount.toString()) ? parseFloat(rowData.total_amount) : 0;
        const _pg_charges = rowData.pg_charges != null && validator.isNumeric(rowData.pg_charges.toString()) ? parseFloat(rowData.pg_charges) : 0;
        const _protean_fees = rowData.protean_fees != null && validator.isNumeric(rowData.protean_fees.toString()) ? parseFloat(rowData.protean_fees) : 0;
        const _tax_amount = rowData.tax_amount != null && validator.isNumeric(rowData.tax_amount.toString()) ? parseFloat(rowData.tax_amount) : 0;
        const _net_amount = rowData.net_amount != null && validator.isNumeric(rowData.net_amount.toString()) ? parseFloat(rowData.net_amount) : 0;
        const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(rowData.project_cost) : 0;
        const _is_success = rowData.is_success && rowData.is_success == true ? "Success" : "Failed";

        function fn_replace_str(_str) {
            _str = _str.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
            _str = _str.replaceAll(emailTags.ORDER_ID, rowData.order_id);
            _str = _str.replaceAll(emailTags.PAYMENT_DATETIME, dateFormat(email_datetime_format, rowData.payment_date));
            _str = _str.replaceAll(emailTags.PAYMENT_STATUS, _is_success);
            _str = _str.replaceAll(emailTags.TOTAL_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_total_amount));
            _str = _str.replaceAll(emailTags.PG_CHARGES, '₹ ' + utils.numberWithIndianFormat(_pg_charges));
            _str = _str.replaceAll(emailTags.PROTEAN_FEES, '₹ ' + utils.numberWithIndianFormat(_protean_fees));
            _str = _str.replaceAll(emailTags.TAXES_AMT, '₹ ' + utils.numberWithIndianFormat(_tax_amount));
            _str = _str.replaceAll(emailTags.NET_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_net_amount));
            _str = _str.replaceAll(emailTags.BANK_REF_NO, rowData.bank_ref_no);
            _str = _str.replaceAll(emailTags.TRANSACTION_ID, rowData.transactionid);
            _str = _str.replaceAll(emailTags.PROJECT_NO, rowData.project_no);
            _str = _str.replaceAll(emailTags.PROJECT_NAME, rowData.project_name);
            _str = _str.replaceAll(emailTags.PROJECT_COST, '₹ ' + utils.numberWithIndianFormat(_project_cost));
            _str = _str.replaceAll(emailTags.PROJ_OWNER_COMPANY, rowData.uo_company_name);
            _str = _str.replaceAll(emailTags.FUND_DONATE_COMPANY, rowData.ia_company_name);

            return _str;
        }

        function fn_replace_user(_str, _user) {
            var full_name_array = [];
            if (_user.first_name && _user.first_name.length > 0) { full_name_array.push(_user.first_name); }
            if (_user.middle_name && _user.middle_name.length > 0) { full_name_array.push(_user.middle_name); }
            if (_user.last_name && _user.last_name.length > 0) { full_name_array.push(_user.last_name); }

            _str = _str.replaceAll(emailTags.FIRST_NAME, _user.first_name);
            _str = _str.replaceAll(emailTags.MIDDLE_NAME, _user.middle_name);
            _str = _str.replaceAll(emailTags.LAST_NAME, _user.last_name);
            _str = _str.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
            _str = _str.replaceAll(emailTags.EMAIL_ID, _user.email_id);
            _str = _str.replaceAll(emailTags.MOBILE_NO, _user.mobile_no);
            _str = _str.replaceAll(emailTags.DESIGNATION, _user.design_name);

            return _str;
        }

        const uoT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_CSR_TO_OWNER);
        if (uoT && uoT != null) {
            if (uoT.is_enabled && uoT.is_enabled == true) {
                const users1 = await entityDataModule.admin_account_view_list(rowData.uo_reg_id);
                if (users1 && users1.length > 0) {
                    for (let g = 0; g < users1.length; g++) {
                        const eleUsr = users1[g];

                        var mail_subject = uoT.subject && uoT.subject.length > 0 ? uoT.subject : "";
                        var mail_body_text = uoT.body_text && uoT.body_text.length > 0 ? uoT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
        const iaT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_CSR_TO_DONOR);
        if (iaT && iaT != null) {
            if (iaT.is_enabled && iaT.is_enabled == true) {
                const users2 = await entityDataModule.admin_account_view_list(rowData.ia_reg_id);
                if (users2 && users2.length > 0) {
                    for (let g = 0; g < users2.length; g++) {
                        const eleUsr = users2[g];

                        var mail_subject = iaT.subject && iaT.subject.length > 0 ? iaT.subject : "";
                        var mail_body_text = iaT.body_text && iaT.body_text.length > 0 ? iaT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
    }
}

const project_payment_crowd_fund = async (order_id) => {
    const _query1 = `SELECT o.order_id, o.payment_date, o.is_success, o.total_amount, o.pg_charges, o.protean_fees, 
    o.tax_amount, o.net_amount, o.bank_ref_no, o.transactionid,
    p.project_no, p.project_name,
    
    uo.reg_id AS uo_reg_id, uo.company_name AS uo_company_name,
    ia.reg_id AS ia_reg_id, ia.company_name AS ia_company_name, ia.first_name AS ia_first_name, ia.middle_name AS ia_middle_name,
    ia.last_name AS ia_last_name, ia.email_id AS ia_email_id, ia.mobile_no AS ia_mobile_no, ia.pan_no AS ia_pan_no
    
    FROM project_payment_fund o INNER JOIN project_created p ON o.project_id = p.project_id
    INNER JOIN user_master uo ON p.reg_id = uo.reg_id
    INNER JOIN user_master ia ON o.paid_by_reg_id = ia.reg_id
    WHERE o.order_id = ?`;
    const row1 = await db.sequelize.query(_query1, { replacements: [order_id], type: QueryTypes.SELECT });
    if (row1 && row1.length > 0) {
        const rowData = row1[0];

        const _total_amount = rowData.total_amount != null && validator.isNumeric(rowData.total_amount.toString()) ? parseFloat(rowData.total_amount) : 0;
        const _pg_charges = rowData.pg_charges != null && validator.isNumeric(rowData.pg_charges.toString()) ? parseFloat(rowData.pg_charges) : 0;
        const _protean_fees = rowData.protean_fees != null && validator.isNumeric(rowData.protean_fees.toString()) ? parseFloat(rowData.protean_fees) : 0;
        const _tax_amount = rowData.tax_amount != null && validator.isNumeric(rowData.tax_amount.toString()) ? parseFloat(rowData.tax_amount) : 0;
        const _net_amount = rowData.net_amount != null && validator.isNumeric(rowData.net_amount.toString()) ? parseFloat(rowData.net_amount) : 0;
        const _project_cost = rowData.project_cost != null && validator.isNumeric(rowData.project_cost.toString()) ? parseFloat(rowData.project_cost) : 0;
        const _is_success = rowData.is_success && rowData.is_success == true ? "Success" : "Failed";

        function fn_replace_str(_str) {
            _str = _str.replaceAll(emailTags.SITE_URL, process.env.FRONT_SITE_URL);
            _str = _str.replaceAll(emailTags.ORDER_ID, rowData.order_id);
            _str = _str.replaceAll(emailTags.PAYMENT_DATETIME, dateFormat(email_datetime_format, rowData.payment_date));
            _str = _str.replaceAll(emailTags.PAYMENT_STATUS, _is_success);
            _str = _str.replaceAll(emailTags.TOTAL_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_total_amount));
            _str = _str.replaceAll(emailTags.PG_CHARGES, '₹ ' + utils.numberWithIndianFormat(_pg_charges));
            _str = _str.replaceAll(emailTags.PROTEAN_FEES, '₹ ' + utils.numberWithIndianFormat(_protean_fees));
            _str = _str.replaceAll(emailTags.TAXES_AMT, '₹ ' + utils.numberWithIndianFormat(_tax_amount));
            _str = _str.replaceAll(emailTags.NET_AMOUNT, '₹ ' + utils.numberWithIndianFormat(_net_amount));
            _str = _str.replaceAll(emailTags.BANK_REF_NO, rowData.bank_ref_no);
            _str = _str.replaceAll(emailTags.TRANSACTION_ID, rowData.transactionid);
            _str = _str.replaceAll(emailTags.PROJECT_NO, rowData.project_no);
            _str = _str.replaceAll(emailTags.PROJECT_NAME, rowData.project_name);
            _str = _str.replaceAll(emailTags.PROJECT_COST, '₹ ' + utils.numberWithIndianFormat(_project_cost));
            _str = _str.replaceAll(emailTags.PROJ_OWNER_COMPANY, rowData.uo_company_name);
            var ia_full_name_array = [];
            if (rowData.ia_first_name && rowData.ia_first_name.length > 0) { ia_full_name_array.push(rowData.ia_first_name); }
            if (rowData.ia_middle_name && rowData.ia_middle_name.length > 0) { ia_full_name_array.push(rowData.ia_middle_name); }
            if (rowData.ia_last_name && rowData.ia_last_name.length > 0) { ia_full_name_array.push(rowData.ia_last_name); }
            _str = _str.replaceAll(emailTags.FUNDING_BY_FIRST_NAME, rowData.ia_first_name);
            _str = _str.replaceAll(emailTags.FUNDING_BY_MIDDLE_NAME, rowData.ia_middle_name);
            _str = _str.replaceAll(emailTags.FUNDING_BY_LAST_NAME, rowData.ia_last_name);
            _str = _str.replaceAll(emailTags.FUNDING_BY_FULL_NAME, ia_full_name_array.join(' '));
            _str = _str.replaceAll(emailTags.FUNDING_BY_EMAIL_ID, rowData.ia_email_id);
            _str = _str.replaceAll(emailTags.FUNDING_BY_MOBILE_NO, rowData.ia_mobile_no);
            _str = _str.replaceAll(emailTags.FUNDING_BY_PAN_NO, rowData.ia_pan_no);

            return _str;
        }

        function fn_replace_user(_str, _user) {
            var full_name_array = [];
            if (_user.first_name && _user.first_name.length > 0) { full_name_array.push(_user.first_name); }
            if (_user.middle_name && _user.middle_name.length > 0) { full_name_array.push(_user.middle_name); }
            if (_user.last_name && _user.last_name.length > 0) { full_name_array.push(_user.last_name); }

            _str = _str.replaceAll(emailTags.FIRST_NAME, _user.first_name);
            _str = _str.replaceAll(emailTags.MIDDLE_NAME, _user.middle_name);
            _str = _str.replaceAll(emailTags.LAST_NAME, _user.last_name);
            _str = _str.replaceAll(emailTags.FULL_NAME, full_name_array.join(' '));
            _str = _str.replaceAll(emailTags.EMAIL_ID, _user.email_id);
            _str = _str.replaceAll(emailTags.MOBILE_NO, _user.mobile_no);
            _str = _str.replaceAll(emailTags.DESIGNATION, _user.design_name);

            return _str;
        }

        const uoT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_FUNDING_TO_OWNER);
        if (uoT && uoT != null) {
            if (uoT.is_enabled && uoT.is_enabled == true) {
                const users1 = await entityDataModule.admin_account_view_list(rowData.uo_reg_id);
                if (users1 && users1.length > 0) {
                    for (let g = 0; g < users1.length; g++) {
                        const eleUsr = users1[g];

                        var mail_subject = uoT.subject && uoT.subject.length > 0 ? uoT.subject : "";
                        var mail_body_text = uoT.body_text && uoT.body_text.length > 0 ? uoT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
        const iaT = await commonModule.email_template_get(emailTemplate.PROJ_PAYMENT_FUNDING_TO_DONOR);
        if (iaT && iaT != null) {
            if (iaT.is_enabled && iaT.is_enabled == true) {
                const users2 = await entityDataModule.admin_account_view_list(rowData.ia_reg_id);
                if (users2 && users2.length > 0) {
                    for (let g = 0; g < users2.length; g++) {
                        const eleUsr = users2[g];

                        var mail_subject = iaT.subject && iaT.subject.length > 0 ? iaT.subject : "";
                        var mail_body_text = iaT.body_text && iaT.body_text.length > 0 ? iaT.body_text : "";

                        mail_subject = fn_replace_user(fn_replace_str(mail_subject), eleUsr);
                        mail_body_text = fn_replace_user(fn_replace_str(mail_body_text), eleUsr);

                        var mailOptions = {
                            from: process.env.MAIL_SENDER,
                            to: eleUsr.email_id,
                            bcc: payment_bcc_emails(),
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
    }
}

module.exports = {
    project_payment_internal,
    project_payment_external,
    project_payment_grant_csr,
    project_payment_crowd_fund,
}