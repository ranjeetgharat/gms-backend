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
const cloudStorageModule = require('../../modules/cloudStorageModule');
const { default: fetch } = require('cross-fetch');

const entity_registration_list = async (req, res, next) => {
    const { page_no, search_text, entity_id, approve_status, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _entity_id = entity_id != null && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        var _approve_status = (approve_status != null && validator.isNumeric(approve_status.toString())) ? parseInt(approve_status) : -1;
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;

        var _sql_condition = '';
        if (_search_text.length > 0) {
            _sql_condition += ' AND (LOWER(u.email_id) LIKE LOWER(:search_text) OR LOWER(u.mobile_no) LIKE LOWER(:search_text) OR ' +
                ' LOWER(u.company_name) LIKE LOWER(:search_text) OR LOWER(u.pan_no) LIKE LOWER(:search_text) OR LOWER(u.company_pan_no) LIKE LOWER(:search_text)) ';
        }
        if (_approve_status >= 0) { _sql_condition += ' AND u.approve_status = :approve_status '; }
        if (_country_id > 0) { _sql_condition += ' AND u.country_id = :country_id '; }
        if (_state_id > 0) { _sql_condition += ' AND u.state_id = :state_id '; }
        if (_district_id > 0) { _sql_condition += ' AND u.district_id = :district_id '; }
        if (_block_id > 0) { _sql_condition += ' AND u.block_id = :block_id '; }


        const _query0 = `SELECT count(1) AS total_record FROM user_master u 
        WHERE u.entity_id = :entity_id AND u.is_deleted = false ${_sql_condition}`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                entity_id: _entity_id,
                search_text: '%' + _search_text + '%',
                approve_status: _approve_status,
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY u.reg_id DESC) AS sr_no,
        u.reg_id, u.added_date, u.first_name, u.middle_name, u.last_name, u.email_id, u.mobile_no, u.pan_no, po.org_type_name,
        u.company_name, et.reg_type_name AS registered_as, c.country_name, s.state_name, d.district_name, b.block_name, u.pin_code,
        u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no,

        u.is_enabled, u.approve_status, u.approved_date, u.rejected_date
	    
        FROM user_master u LEFT OUTER JOIN countries c ON u.country_id = c.country_id LEFT OUTER JOIN states s ON
        u.state_id = s.state_id LEFT OUTER JOIN districts d ON u.district_id = d.district_id LEFT OUTER JOIN blocks b
        ON u.block_id = b.block_id LEFT OUTER JOIN entity_reg_type_mast et ON u.registered_as_id = et.reg_type_id
        LEFT OUTER JOIN parent_orgs_mast po ON u.org_type_id = po.org_type_id 

        WHERE u.entity_id = :entity_id AND u.is_deleted = false ${_sql_condition} LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                entity_id: _entity_id,
                search_text: '%' + _search_text + '%',
                approve_status: _approve_status,
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
                reg_id: row1[i].reg_id,
                added_date: row1[i].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].added_date)) : "",
                first_name: row1[i].first_name,
                middle_name: row1[i].middle_name,
                last_name: row1[i].last_name,
                email_id: row1[i].email_id,
                mobile_no: row1[i].mobile_no,
                pan_no: row1[i].pan_no,
                org_type_name: row1[i].org_type_name,
                company_name: row1[i].company_name,
                registered_as: row1[i].registered_as,
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
                company_pan_no: row1[i].company_pan_no,
                gstin_no: row1[i].gstin_no,
                cin_no: row1[i].cin_no,
                registration_no: row1[i].registration_no,
                it_80g_reg_no: row1[i].it_80g_reg_no,
                it_12a_reg_no: row1[i].it_12a_reg_no,
                darpan_reg_no: row1[i].darpan_reg_no,
                is_enabled: row1[i].is_enabled,
                approve_status: row1[i].approve_status,
                status_htm: utils.entity_reg_status_html(row1[i].approve_status),
                approved_date: row1[i].approved_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].approved_date)) : "",
                rejected_date: row1[i].rejected_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].rejected_date)) : "",
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

const entity_registration_details = async (req, res, next) => {
    const { reg_id } = req.body;
    try {
        var _reg_id = reg_id && validator.isNumeric(reg_id.toString()) ? BigInt(reg_id) : 0;

        const _query0 = `SELECT u.entity_id, em.entity_name, em.admin_page_link,
        u.added_date, u.is_enabled, u.approve_status, u.approved_date, u.rejected_date,
        u.first_name, u.middle_name, u.last_name, u.email_id, u.mobile_no, u.pan_no, po.org_type_name,
        u.company_name, et.reg_type_name AS registered_as, u.address_1, u.address_2, u.address_3, c.country_name, s.state_name, 
        d.district_name, b.block_name, u.pin_code, u.contact_no,
        u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no, u.mca_csr_f1_reg_no,
        u.fcra_no_with_status, u.fcra_no_status, u.fin_audit_rpt_filed,
        (SELECT string_agg(expertise_name, ', ') FROM user_expertise iex INNER JOIN expertise_area_mast iem 
        ON iex.expertise_area_id = iem.expertise_area_id WHERE iex.reg_id = u.reg_id) AS expertise_name,
        COALESCE((SELECT tmp.company_name FROM user_master tmp WHERE tmp.reg_id = COALESCE(u.parent_org_id, 0)), '') AS parent_org_name

        FROM user_master u LEFT OUTER JOIN countries c ON u.country_id = c.country_id LEFT OUTER JOIN states s ON
        u.state_id = s.state_id LEFT OUTER JOIN districts d ON u.district_id = d.district_id LEFT OUTER JOIN blocks b
        ON u.block_id = b.block_id LEFT OUTER JOIN entity_reg_type_mast et ON u.registered_as_id = et.reg_type_id
        LEFT OUTER JOIN parent_orgs_mast po ON u.org_type_id = po.org_type_id 
        LEFT OUTER JOIN entity_type em ON u.entity_id = em.entity_id

        WHERE u.reg_id = ? AND u.is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_reg_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity registration details not found.", null));
        }
        var bank_details = [];
        const _query5 = `SELECT b.ifsc_code, b.bank_other, b.branch_other, b.account_type, b.account_no, b.re_account_no
        FROM user_bank b WHERE b.reg_id = ? AND b.is_deleted = false ORDER BY b.ubank_id`;
        const row5 = await db.sequelize.query(_query5, { replacements: [_reg_id], type: QueryTypes.SELECT });
        for (let i = 0; row5 && i < row5.length; i++) {
            const bank = row5[i];
            var _account_type = bank.account_type && validator.isNumeric(bank.account_type.toString()) ? parseInt(bank.account_type) : 0;
            var _account_type_str = (_account_type == 1 ? "Saving" : (_account_type == 2 ? "Current" : "-"));
            bank_details.push({
                ubank_id: bank.ubank_id,
                ifsc_code: bank.ifsc_code,
                bank_name: bank.bank_other,
                branch_name: bank.branch_other,
                account_type: _account_type_str,
                account_no: bank.account_no,
                re_account_no: bank.re_account_no,
            });
        }
        var user_details = [];
        const _query1 = `SELECT a.user_id, a.first_name, a.middle_name, a.last_name, a.email_id, a.mobile_no, d.design_name, a.is_enabled, 
        a.is_activated, a.activate_date FROM user_account a LEFT OUTER JOIN designation_mast d ON a.design_id = d.design_id 
        WHERE a.reg_id = ? AND a.is_deleted = false ORDER BY is_admin DESC`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_reg_id], type: QueryTypes.SELECT });
        for (let i = 0; row1 && i < row1.length; i++) {
            user_details.push({
                user_id: row1[i].user_id,
                first_name: row1[i].first_name,
                middle_name: row1[i].middle_name,
                last_name: row1[i].last_name,
                email_id: row1[i].email_id,
                mobile_no: row1[i].mobile_no,
                design_name: row1[i].design_name,
                is_enabled: row1[i].is_enabled,
                is_activated: row1[i].is_activated,
                activate_date: row1[i].activate_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].activate_date)) : "",
            });
        }
        var documents = [];
        const _query6 = `SELECT ud.doc_file_id, dm.document_id, dm.doc_name, ud.original_file_name, ud.new_file_name, ud.uploaded_date
        FROM user_document ud INNER JOIN document_mast dm ON ud.document_id = dm.document_id
        WHERE ud.reg_id = ? AND ud.is_deleted = false`;
        const row6 = await db.sequelize.query(_query6, { replacements: [_reg_id], type: QueryTypes.SELECT });
        for (let i = 0; row6 && i < row6.length; i++) {
            const doc_ele = row6[i];
            documents.push({
                doc_file_id: doc_ele.doc_file_id,
                document_id: doc_ele.document_id,
                doc_name: doc_ele.doc_name,
                original_file_name: doc_ele.original_file_name,
                new_file_name: doc_ele.new_file_name,
                uploaded_date: doc_ele.uploaded_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(doc_ele.uploaded_date)) : "",
            });
        }
        var services = [];
        const _query7 = `SELECT us.u_serv_id, h.head_name, c.category_name, sc.sub_cat_name, us.range_size, us.price 
        FROM user_services us INNER JOIN services_sub_cat sc ON us.sub_cat_id = sc.sub_cat_id
        LEFT OUTER JOIN services_category c ON sc.category_id = c.category_id
        LEFT OUTER JOIN services_head h ON c.head_id = h.head_id
        WHERE us.reg_id = ? AND us.is_deleted = false`;
        const row7 = await db.sequelize.query(_query7, { replacements: [_reg_id], type: QueryTypes.SELECT });
        for (let i = 0; row7 && i < row7.length; i++) {
            const serEle = row7[i];
            const price = serEle.price && validator.isNumeric(serEle.price) ? parseFloat(serEle.price) : 0;
            services.push({
                u_serv_id: serEle.u_serv_id,
                head_name: serEle.head_name,
                category_name: serEle.category_name,
                sub_cat_name: serEle.sub_cat_name,
                range_size: serEle.range_size,
                price: price,
            });
        }

        var dynamic_values = [];
        const _queryDynSel = `SELECT fi.field_type, fi.field_label AS label_name, fi.section_name, uv.user_value
        FROM user_field_values uv INNER JOIN reg_static_field_item fi ON uv.static_field_id = fi.static_field_id
        WHERE uv.reg_id = ?`;
        const rowDynSel = await db.sequelize.query(_queryDynSel, { replacements: [_reg_id], type: QueryTypes.SELECT });
        for (let i = 0; rowDynSel && i < rowDynSel.length; i++) {
            const eleDyn = rowDynSel[i];
            dynamic_values.push({
                field_type: eleDyn.field_type,
                label_name: eleDyn.label_name,
                section_id: eleDyn.section_name,
                user_value: eleDyn.user_value,
            });
        }

        var approval_logs = [];
        const _queryApprLog = `SELECT l.approve_status, l.status_date, l.status_remark, COALESCE(a.full_name, 'Self by entity') AS full_name, COALESCE(a.email_id, 'Self by entity') AS email_id
        FROM user_stat_log l 
        LEFT JOIN LATERAL (
            SELECT TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')) AS full_name, a.email_id FROM adm_user a WHERE a.account_id = l.status_by LIMIT 1
        ) AS a ON true WHERE l.reg_id = ?`;
        const rowApprLog = await db.sequelize.query(_queryApprLog, { replacements: [_reg_id], type: QueryTypes.SELECT });
        for (let i = 0; rowApprLog && i < rowApprLog.length; i++) {
            const status = rowApprLog[i].approve_status != null && validator.isNumeric(rowApprLog[i].approve_status.toString()) ? parseInt(rowApprLog[i].approve_status.toString()) : (-1);
            const status_txt = utils.entity_reg_status_html(status);
            approval_logs.push({
                status_id: status,
                status_htm: status_txt,
                date: rowApprLog[i].status_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(rowApprLog[i].status_date)) : "",
                remark: rowApprLog[i].status_remark,
                full_name: rowApprLog[i].full_name,
                email_id: rowApprLog[i].email_id,
            });
        }

        const results = {
            entity_id: row0[0].entity_id,
            entity_name: row0[0].entity_name,
            admin_page_link: row0[0].admin_page_link,
            added_date: row0[0].added_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row0[0].added_date)) : "",
            is_enabled: row0[0].is_enabled,
            approve_status: row0[0].approve_status,
            approved_date: row0[0].approved_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row0[0].approved_date)) : "",
            rejected_date: row0[0].rejected_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row0[0].rejected_date)) : "",
            first_name: row0[0].first_name,
            middle_name: row0[0].middle_name,
            last_name: row0[0].last_name,
            email_id: row0[0].email_id,
            mobile_no: row0[0].mobile_no,
            pan_no: row0[0].pan_no,
            company_name: row0[0].company_name,
            registered_as: row0[0].registered_as,
            org_type_name: row0[0].org_type_name,
            parent_org_name: row0[0].parent_org_name,
            address_1: row0[0].address_1,
            address_2: row0[0].address_2,
            address_3: row0[0].address_3,
            country_name: row0[0].country_name,
            state_name: row0[0].state_name,
            district_name: row0[0].district_name,
            block_name: row0[0].block_name,
            pin_code: row0[0].pin_code,
            contact_no: row0[0].contact_no,
            company_pan_no: row0[0].company_pan_no,
            gstin_no: row0[0].gstin_no,
            cin_no: row0[0].cin_no,
            registration_no: row0[0].registration_no,
            it_80g_reg_no: row0[0].it_80g_reg_no,
            it_12a_reg_no: row0[0].it_12a_reg_no,
            darpan_reg_no: row0[0].darpan_reg_no,
            mca_csr_f1_reg_no: row0[0].mca_csr_f1_reg_no,
            fcra_no_with_status: row0[0].fcra_no_with_status,
            fcra_no_status: row0[0].fcra_no_status,
            expertise_name: row0[0].expertise_name,
            fin_audit_rpt_filed: row0[0].fin_audit_rpt_filed,
            bank_details: bank_details,
            user_details: user_details,
            documents: documents,
            services: services,
            dynamic_values: dynamic_values,
            approval_logs: approval_logs,
        };
        return res.status(200).json(success(true, res.statusCode, "", results));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_registration_approve = async (req, res, next) => {
    const { reg_id, remark } = req.body;
    try {
        const _reg_id = reg_id && validator.isNumeric(reg_id.toString()) ? BigInt(reg_id) : 0;

        const _query0 = `SELECT reg_id, entity_id, approve_status FROM user_master WHERE reg_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_reg_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity registration details not found.", null));
        }
        const _approve_status = row0[0].approve_status && validator.isNumeric(row0[0].approve_status.toString()) ? parseInt(row0[0].approve_status) : 0;
        var canApprove = false; if (utils.check_in_array(_approve_status, [0, 3])) { canApprove = true; }
        if (!canApprove) {
            return res.status(200).json(success(false, res.statusCode, "Registration status is already changed.", null));
        }
        const _approved_remark = (remark && remark.length > 0) ? remark.trim() : "";
        if (_approved_remark.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter approval remark.", null));
        }
        const currDate = new Date();
        const _query61 = `UPDATE user_master SET approve_status = 1, approved_date = ?, approved_by = ?, approved_remark = ? WHERE reg_id = ?`;
        const [, i] = await db.sequelize.query(_query61, { replacements: [currDate, req.token_data.account_id, _approved_remark, _reg_id], type: QueryTypes.UPDATE });
        if (i > 0) {
            const _query62 = `INSERT INTO user_stat_log(reg_id, approve_status, status_by, status_date, status_remark) VALUES(?, ?, ?, ?, ?)`;
            const rep62 = [_reg_id, 1, req.token_data.account_id, currDate, _approved_remark];
            await db.sequelize.query(_query62, { replacements: rep62, type: QueryTypes.INSERT });

            setTimeout(async () => {
                await commonModule.send_entity_approval_email(_reg_id);
            }, 0);

            return res.status(200).json(success(true, res.statusCode, "Registration approved successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to approve, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_registration_reject = async (req, res, next) => {
    const { reg_id, remark } = req.body;
    try {
        const _reg_id = reg_id && validator.isNumeric(reg_id.toString()) ? BigInt(reg_id) : 0;

        const _query0 = `SELECT reg_id, entity_id, approve_status FROM user_master WHERE reg_id = ? AND is_deleted = false`;
        const row0 = await db.sequelize.query(_query0, { replacements: [_reg_id], type: QueryTypes.SELECT });
        if (!row0 || row0.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Entity registration details not found.", null));
        }
        const _approve_status = row0[0].approve_status && validator.isNumeric(row0[0].approve_status.toString()) ? parseInt(row0[0].approve_status) : 0;
        var canApprove = false; if (utils.check_in_array(_approve_status, [0, 3])) { canApprove = true; }
        if (!canApprove) {
            return res.status(200).json(success(false, res.statusCode, "Registration status is already changed.", null));
        }
        const _approved_remark = (remark && remark.length > 0) ? remark.trim() : "";
        if (_approved_remark.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Please enter reject remark.", null));
        }
        const currDate = new Date(); const reject_resume_token = crypto.randomUUID();
        const _query61 = `UPDATE user_master SET reject_resume_token = ?, approve_status = 2, rejected_date = ?, rejected_by = ?, rejected_remark = ? WHERE reg_id = ?`;
        const [, i] = await db.sequelize.query(_query61, { replacements: [reject_resume_token, currDate, req.token_data.account_id, _approved_remark, _reg_id], type: QueryTypes.UPDATE });
        if (i > 0) {
            const _query62 = `INSERT INTO user_stat_log(reg_id, approve_status, status_by, status_date, status_remark) VALUES(?, ?, ?, ?, ?)`;
            const rep62 = [_reg_id, 2, req.token_data.account_id, currDate, _approved_remark];
            await db.sequelize.query(_query62, { replacements: rep62, type: QueryTypes.INSERT });

            setTimeout(async () => {
                await commonModule.send_entity_reject_email(_reg_id);
            }, 0);

            return res.status(200).json(success(true, res.statusCode, "Registration rejected successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to reject, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_user_account_toggle = async (req, res, next) => {
    const { user_id } = req.body;
    try {
        var _user_id = user_id && validator.isNumeric(user_id.toString()) ? BigInt(user_id) : 0;

        const _query1 = `SELECT user_id, is_enabled, is_activated, reg_id FROM user_account WHERE user_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_user_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "User account details not found.", null));
        }
        var is_activated = row1[0].is_activated && row1[0].is_activated == true ? true : false;
        if (!is_activated) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "User account is not yet activated.", null));
        }

        const _query6 = `SELECT approve_status FROM user_master WHERE reg_id = ? AND is_deleted = false`;
        const row6 = await db.sequelize.query(_query6, { replacements: [row1[0].reg_id], type: QueryTypes.SELECT });
        if (!row6 || row6.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Entity registration details not found.", null));
        }
        var _approve_status = row6[0].approve_status && validator.isNumeric(row6[0].approve_status.toString()) ? parseInt(row6[0].approve_status) : 0;
        if (_approve_status != 1) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Entity registration is not yet approved.", null));
        }

        const _query2 = `UPDATE user_account SET is_enabled = CASE WHEN is_enabled = true THEN false ELSE true END, modify_date = ?, modify_by = ? WHERE user_id = ?`;
        const _replacements2 = [new Date(), req.token_data.account_id, _user_id];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Status changed successfully.", null));
        } else {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Unable to change, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_user_activation_link = async (req, res, next) => {
    const { user_id } = req.body;
    try {
        var _user_id = user_id && validator.isNumeric(user_id.toString()) ? BigInt(user_id) : 0;

        const _query1 = `SELECT user_id, is_enabled, is_activated, reg_id FROM user_account WHERE user_id = ? AND is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_user_id], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "User account details not found.", null));
        }
        var is_activated = row1[0].is_activated && row1[0].is_activated == true ? true : false;
        if (is_activated) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "User account is already activated.", null));
        }

        const _query6 = `SELECT approve_status FROM user_master WHERE reg_id = ? AND is_deleted = false`;
        const row6 = await db.sequelize.query(_query6, { replacements: [row1[0].reg_id], type: QueryTypes.SELECT });
        if (!row6 || row6.length <= 0) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Entity registration details not found.", null));
        }
        var _approve_status = row6[0].approve_status && validator.isNumeric(row6[0].approve_status.toString()) ? parseInt(row6[0].approve_status) : 0;
        if (_approve_status != 1) {
            return res.status(200).json(success(false, apiStatus.RELOAD_PAGE, "Entity registration is not yet approved.", null));
        }
        const i = await commonModule.send_entity_user_activation(_user_id);
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Activation link sent successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Sending failure, Please try again.", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_change_request_list = async (req, res, next) => {
    const { page_no, search_text, entity_id, request_status, country_id, state_id, district_id, block_id } = req.body;
    try {
        var _page_no = page_no != null && validator.isNumeric(page_no.toString()) ? parseInt(page_no) : 0; if (_page_no <= 0) { _page_no = 1; }
        var _search_text = search_text != null && search_text.length > 0 ? search_text : "";
        var _entity_id = entity_id != null && validator.isNumeric(entity_id.toString()) ? BigInt(entity_id) : 0;
        var _request_status = (request_status != null && validator.isNumeric(request_status.toString())) ? parseInt(request_status.toString()) : -1;
        var _country_id = country_id != null && validator.isNumeric(country_id.toString()) ? BigInt(country_id) : 0;
        var _state_id = state_id != null && validator.isNumeric(state_id.toString()) ? BigInt(state_id) : 0;
        var _district_id = district_id != null && validator.isNumeric(district_id.toString()) ? BigInt(district_id) : 0;
        var _block_id = block_id != null && validator.isNumeric(block_id.toString()) ? BigInt(block_id) : 0;
        var _request_status_array = [];
        if (_request_status < 0) {
            _request_status_array.push(0);
            _request_status_array.push(1);
            _request_status_array.push(2);
            _request_status_array.push(3);
        } else {
            _request_status_array.push(_request_status);
        }

        const _query0 = `SELECT count(1) AS total_record 
        FROM modify_master mm INNER JOIN user_master u ON mm.reg_id = u.reg_id
        WHERE (LOWER(u.email_id) LIKE LOWER(:search_text) OR LOWER(u.mobile_no) LIKE LOWER(:search_text) OR LOWER(u.pan_no)
        LIKE LOWER(:search_text) OR LOWER(u.company_pan_no) LIKE LOWER(:search_text) OR LOWER(u.company_name) LIKE LOWER(:search_text))
        AND mm.request_status IN (:request_status)
        AND u.entity_id >= CASE WHEN :entity_id > 0 THEN :entity_id ELSE 0 END
        AND u.entity_id <= CASE WHEN :entity_id > 0 THEN :entity_id ELSE 9223372036854775807 END
        AND u.country_id >= CASE WHEN :country_id > 0 THEN :country_id ELSE 0 END
        AND u.country_id <= CASE WHEN :country_id > 0 THEN :country_id ELSE 9223372036854775807 END
        AND u.state_id >= CASE WHEN :state_id > 0 THEN :state_id ELSE 0 END
        AND u.state_id <= CASE WHEN :state_id > 0 THEN :state_id ELSE 9223372036854775807 END
        AND u.district_id >= CASE WHEN :district_id > 0 THEN :district_id ELSE 0 END
        AND u.district_id <= CASE WHEN :district_id > 0 THEN :district_id ELSE 9223372036854775807 END
        AND u.block_id >= CASE WHEN :block_id > 0 THEN :block_id ELSE 0 END
        AND u.block_id <= CASE WHEN :block_id > 0 THEN :block_id ELSE 9223372036854775807 END`;
        const row0 = await db.sequelize.query(_query0, {
            replacements: {
                entity_id: _entity_id,
                search_text: '%' + _search_text + '%',
                request_status: _request_status_array,
                country_id: _country_id,
                state_id: _state_id,
                district_id: _district_id,
                block_id: _block_id,
            }, type: QueryTypes.SELECT
        });
        var total_record = 0; if (row0 && row0.length > 0) { total_record = row0[0].total_record; }

        const _query1 = `SELECT ROW_NUMBER() OVER(ORDER BY mm.modify_id DESC) AS sr_no, mm.modify_id, mm.request_date, etm.entity_name,
        mm.request_status, mm.approved_by, mm.approved_date, mm.approve_remark, mm.rejected_by, mm.rejected_date, mm.reject_remark,
        
        u.first_name, u.middle_name, u.last_name, u.email_id, u.mobile_no, u.pan_no, po.org_type_name,
        u.company_name, et.reg_type_name AS registered_as, c.country_name, s.state_name, d.district_name, b.block_name, u.pin_code,
        u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no       
	    
        FROM modify_master mm INNER JOIN user_master u ON mm.reg_id = u.reg_id LEFT OUTER JOIN countries c ON u.country_id = c.country_id 
        LEFT OUTER JOIN states s ON u.state_id = s.state_id LEFT OUTER JOIN districts d ON u.district_id = d.district_id LEFT OUTER JOIN blocks b
        ON u.block_id = b.block_id LEFT OUTER JOIN entity_reg_type_mast et ON u.registered_as_id = et.reg_type_id LEFT OUTER JOIN 
        parent_orgs_mast po ON u.org_type_id = po.org_type_id LEFT OUTER JOIN entity_type etm ON u.entity_id = etm.entity_id

        WHERE (LOWER(u.email_id) LIKE LOWER(:search_text) OR LOWER(u.mobile_no) LIKE LOWER(:search_text) OR LOWER(u.pan_no)
        LIKE LOWER(:search_text) OR LOWER(u.company_pan_no) LIKE LOWER(:search_text) OR LOWER(u.company_name) LIKE LOWER(:search_text))
        AND mm.request_status IN (:request_status)
        AND u.entity_id >= CASE WHEN :entity_id > 0 THEN :entity_id ELSE 0 END
        AND u.entity_id <= CASE WHEN :entity_id > 0 THEN :entity_id ELSE 9223372036854775807 END
        AND u.country_id >= CASE WHEN :country_id > 0 THEN :country_id ELSE 0 END
        AND u.country_id <= CASE WHEN :country_id > 0 THEN :country_id ELSE 9223372036854775807 END
        AND u.state_id >= CASE WHEN :state_id > 0 THEN :state_id ELSE 0 END
        AND u.state_id <= CASE WHEN :state_id > 0 THEN :state_id ELSE 9223372036854775807 END
        AND u.district_id >= CASE WHEN :district_id > 0 THEN :district_id ELSE 0 END
        AND u.district_id <= CASE WHEN :district_id > 0 THEN :district_id ELSE 9223372036854775807 END
        AND u.block_id >= CASE WHEN :block_id > 0 THEN :block_id ELSE 0 END
        AND u.block_id <= CASE WHEN :block_id > 0 THEN :block_id ELSE 9223372036854775807 END

        LIMIT :page_size OFFSET ((:page_no - 1) * :page_size)`;
        const row1 = await db.sequelize.query(_query1, {
            replacements: {
                entity_id: _entity_id,
                search_text: '%' + _search_text + '%',
                request_status: _request_status_array,
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
                modify_id: row1[i].modify_id,
                request_date: row1[i].request_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].request_date)) : "",
                entity_name: row1[i].entity_name,
                first_name: row1[i].first_name,
                middle_name: row1[i].middle_name,
                last_name: row1[i].last_name,
                email_id: row1[i].email_id,
                mobile_no: row1[i].mobile_no,
                pan_no: row1[i].pan_no,
                org_type_name: (row1[i].org_type_name ? row1[i].org_type_name : ""),
                company_name: row1[i].company_name,
                registered_as: row1[i].registered_as,
                country_name: row1[i].country_name,
                state_name: row1[i].state_name,
                district_name: row1[i].district_name,
                block_name: row1[i].block_name,
                pin_code: row1[i].pin_code,
                company_pan_no: row1[i].company_pan_no,
                gstin_no: row1[i].gstin_no,
                cin_no: row1[i].cin_no,
                registration_no: row1[i].registration_no,
                it_80g_reg_no: row1[i].it_80g_reg_no,
                it_12a_reg_no: row1[i].it_12a_reg_no,
                darpan_reg_no: row1[i].darpan_reg_no,
                request_status: row1[i].request_status,
                request_status_text: (row1[i].request_status == 1 ? "Approved" : (row1[i].request_status == 2 ? "Rejected" : (row1[i].request_status == 0 ? "Pending" : (row1[i].request_status == 3 ? "Cancelled" : "Unknown")))),
                request_status_color: (row1[i].request_status == 1 ? "#008000" : (row1[i].request_status == 2 ? "#ff0000" : (row1[i].request_status == 0 ? "#000000" : (row1[i].request_status == 3 ? "#ff0000" : "#000000")))),
                approved_date: row1[i].approved_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].approved_date)) : "",
                rejected_date: row1[i].rejected_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[i].rejected_date)) : "",
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

const entity_change_request_details = async (req, res, next) => {
    const { modify_id } = req.body;
    try {
        var _modify_id = modify_id && validator.isNumeric(modify_id.toString()) ? BigInt(modify_id) : 0;

        const _queryModDataMst = `SELECT mm.user_id, mm.reg_id, mm.request_date, mm.request_status, mm.approved_by, mm.approved_date, mm.approve_remark, mm.rejected_by, mm.rejected_date, mm.reject_remark,
        mm.first_name, mm.middle_name, mm.last_name, mm.pan_no, 
        mm.company_name, mm.registered_as_id, mm.org_type_id, mm.parent_org_id, 
        COALESCE((SELECT tmp.reg_type_name FROM entity_reg_type_mast tmp WHERE tmp.reg_type_id = COALESCE(mm.registered_as_id, 0) LIMIT 1), '') AS registered_as_name,
        COALESCE((SELECT tmp.org_type_name FROM parent_orgs_mast tmp WHERE tmp.org_type_id = COALESCE(mm.org_type_id, 0) LIMIT 1), '') AS org_type_name,
        COALESCE((SELECT tmp.company_name FROM user_master tmp WHERE tmp.reg_id = COALESCE(mm.parent_org_id, 0) LIMIT 1), '') AS parent_org_name,
        mm.address_1, mm.address_2, mm.address_3, mm.pin_code, mm.contact_no, 
        COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(mm.country_id, 0) LIMIT 1), '') AS country_name,
        COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(mm.state_id, 0) LIMIT 1), '') AS state_name,
        COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(mm.district_id, 0) LIMIT 1), '') AS district_name,
        COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(mm.block_id, 0) LIMIT 1), '') AS block_name,
        mm.company_pan_no, mm.gstin_no, mm.cin_no, mm.registration_no, mm.it_80g_reg_no, mm.it_12a_reg_no, mm.darpan_reg_no, mm.mca_csr_f1_reg_no, mm.fcra_no_with_status, mm.fcra_no_status, mm.fin_audit_rpt_filed,
        mm.acc_first_name, mm.acc_middle_name, mm.acc_last_name, mm.acc_design_id, mm.acc_pan_no,
        COALESCE((SELECT tmp.design_name FROM designation_mast tmp WHERE tmp.design_id = COALESCE(mm.acc_design_id, 0) LIMIT 1), '') AS acc_design_name,
        mm.acc_pa_address1, mm.acc_pa_address2, mm.acc_pa_address3, mm.acc_pa_pin_code,
        COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(mm.acc_pa_country_id, 0) LIMIT 1), '') AS acc_pa_country_name,
        COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(mm.acc_pa_state_id, 0) LIMIT 1), '') AS acc_pa_state_name,
        COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(mm.acc_pa_district_id, 0) LIMIT 1), '') AS acc_pa_district_name,
        COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(mm.acc_pa_block_id, 0) LIMIT 1), '') AS acc_pa_block_name,
        mm.acc_ca_same_pa, mm.acc_ca_address1, mm.acc_ca_address2, mm.acc_ca_address3, mm.acc_ca_pin_code,
        COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(mm.acc_ca_country_id, 0) LIMIT 1), '') AS acc_ca_country_name,
        COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(mm.acc_ca_state_id, 0) LIMIT 1), '') AS acc_ca_state_name,
        COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(mm.acc_ca_district_id, 0) LIMIT 1), '') AS acc_ca_district_name,
        COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(mm.acc_ca_block_id, 0) LIMIT 1), '') AS acc_ca_block_name,
        mm.brief_csr_policy,        
        mm.mod_initiator_user, mm.mod_company_basic, mm.mod_company_address, mm.mod_enrolment_identification, mm.mod_enrolment_document, mm.mod_enrolment_banks, mm.mod_admin_basic, mm.mod_admin_perm_addr, mm.mod_admin_curr_addr, 
        mm.mod_admin_document, mm.mod_board_member, mm.mod_csr_company, mm.mod_csr_committee
        FROM modify_master mm WHERE mm.modify_id = ?`;
        const rowModDataMst = await db.sequelize.query(_queryModDataMst, { replacements: [_modify_id], type: QueryTypes.SELECT });
        if (rowModDataMst && rowModDataMst.length > 0) {
            const _queryPrevData = `SELECT u.entity_id, u.form_static_fields_json, u.first_name, u.middle_name, u.last_name, u.pan_no,
            u.company_name, u.registered_as_id, u.org_type_id, u.parent_org_id,
            COALESCE((SELECT tmp.reg_type_name FROM entity_reg_type_mast tmp WHERE tmp.reg_type_id = COALESCE(u.registered_as_id, 0) LIMIT 1), '') AS registered_as_name,
            COALESCE((SELECT tmp.org_type_name FROM parent_orgs_mast tmp WHERE tmp.org_type_id = COALESCE(u.org_type_id, 0) LIMIT 1), '') AS org_type_name,
            COALESCE((SELECT tmp.company_name FROM user_master tmp WHERE tmp.reg_id = COALESCE(u.parent_org_id, 0) LIMIT 1), '') AS parent_org_name,
            u.address_1, u.address_2, u.address_3, u.pin_code, u.contact_no,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(u.country_id, 0) LIMIT 1), '') AS country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(u.state_id, 0) LIMIT 1), '') AS state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(u.district_id, 0) LIMIT 1), '') AS district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(u.block_id, 0) LIMIT 1), '') AS block_name,            
            u.company_pan_no, u.gstin_no, u.cin_no, u.registration_no, u.it_80g_reg_no, u.it_12a_reg_no, u.darpan_reg_no, u.mca_csr_f1_reg_no, u.fcra_no_with_status, u.fcra_no_status, u.fin_audit_rpt_filed,
            u.acc_first_name, u.acc_middle_name, u.acc_last_name, u.acc_design_id, u.acc_pan_no,
            COALESCE((SELECT tmp.design_name FROM designation_mast tmp WHERE tmp.design_id = COALESCE(u.acc_design_id, 0) LIMIT 1), '') AS acc_design_name,
            u.acc_pa_address1, u.acc_pa_address2, u.acc_pa_address3, u.acc_pa_pin_code,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(u.acc_pa_country_id, 0) LIMIT 1), '') AS acc_pa_country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(u.acc_pa_state_id, 0) LIMIT 1), '') AS acc_pa_state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(u.acc_pa_district_id, 0) LIMIT 1), '') AS acc_pa_district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(u.acc_pa_block_id, 0) LIMIT 1), '') AS acc_pa_block_name,
            u.acc_ca_same_pa, u.acc_ca_address1, u.acc_ca_address2, u.acc_ca_address3, u.acc_ca_pin_code,
            COALESCE((SELECT t.country_name FROM countries t WHERE t.country_id = COALESCE(u.acc_ca_country_id, 0) LIMIT 1), '') AS acc_ca_country_name,
            COALESCE((SELECT t.state_name FROM states t WHERE t.state_id = COALESCE(u.acc_ca_state_id, 0) LIMIT 1), '') AS acc_ca_state_name,
            COALESCE((SELECT t.district_name FROM districts t WHERE t.district_id = COALESCE(u.acc_ca_district_id, 0) LIMIT 1), '') AS acc_ca_district_name,
            COALESCE((SELECT t.block_name FROM blocks t WHERE t.block_id = COALESCE(u.acc_ca_block_id, 0) LIMIT 1), '') AS acc_ca_block_name,
            u.brief_csr_policy
            FROM modify_master_old u WHERE u.modify_id = ?`
            const rowPrevData = await db.sequelize.query(_queryPrevData, { replacements: [_modify_id], type: QueryTypes.SELECT });

            if (rowPrevData && rowPrevData.length > 0) {
                const prevData = rowPrevData[0]; const modData = rowModDataMst[0];

                const form_static_fields = await entityDataModule.profile_validation_field(prevData.entity_id, prevData.form_static_fields_json);

                var _mod_initiator_user = false; var _mod_company_basic = false; var _mod_company_address = false;
                var _mod_enrolment_identification = false; var _mod_enrolment_document = false; var _mod_enrolment_banks = false; var _mod_admin_basic = false; var _mod_admin_perm_addr = false;
                var _mod_admin_curr_addr = false; var _mod_admin_document = false; var _mod_board_member = false; var _mod_csr_company = false; var _mod_csr_committee = false;

                _mod_initiator_user = (modData.mod_initiator_user ? modData.mod_initiator_user : false);
                _mod_company_basic = (modData.mod_company_basic ? modData.mod_company_basic : false);
                _mod_company_address = (modData.mod_company_address ? modData.mod_company_address : false);
                _mod_enrolment_identification = (modData.mod_enrolment_identification ? modData.mod_enrolment_identification : false);
                _mod_enrolment_document = (modData.mod_enrolment_document ? modData.mod_enrolment_document : false);
                _mod_enrolment_banks = (modData.mod_enrolment_banks ? modData.mod_enrolment_banks : false);
                _mod_admin_basic = (modData.mod_admin_basic ? modData.mod_admin_basic : false);
                _mod_admin_perm_addr = (modData.mod_admin_perm_addr ? modData.mod_admin_perm_addr : false);
                _mod_admin_curr_addr = (modData.mod_admin_curr_addr ? modData.mod_admin_curr_addr : false);
                _mod_admin_document = (modData.mod_admin_document ? modData.mod_admin_document : false);
                _mod_board_member = (modData.mod_board_member ? modData.mod_board_member : false);
                _mod_csr_company = (modData.mod_csr_company ? modData.mod_csr_company : false);
                _mod_csr_committee = (modData.mod_csr_committee ? modData.mod_csr_committee : false);

                const _request_status = modData.request_status && validator.isNumeric(modData.request_status.toString()) ? parseInt(modData.request_status) : 0;

                var initiator_user_old = null; var initiator_user_new = null;
                if (_mod_initiator_user) {
                    initiator_user_old = {
                        first_name: prevData.first_name,
                        middle_name: prevData.middle_name,
                        last_name: prevData.last_name,
                        pan_no: prevData.pan_no,
                    };
                    initiator_user_new = {
                        first_name: modData.first_name,
                        middle_name: modData.middle_name,
                        last_name: modData.last_name,
                        pan_no: modData.pan_no,
                    };
                }
                var company_basic_old = null; var company_basic_new = null;
                if (_mod_company_basic) {
                    company_basic_old = {
                        company_name: prevData.company_name,
                        registered_as: prevData.registered_as_name,
                        parent_entity: prevData.org_type_name,
                        parent_name: prevData.parent_org_name,
                    };
                    company_basic_new = {
                        company_name: modData.company_name,
                        registered_as: modData.registered_as_name,
                        parent_entity: modData.org_type_name,
                        parent_name: modData.parent_org_name,
                    };
                }
                var company_address_old = null; var company_address_new = null;
                if (_mod_company_address) {
                    company_address_old = {
                        address_1: prevData.address_1,
                        address_2: prevData.address_2,
                        address_3: prevData.address_3,
                        country_name: prevData.country_name,
                        state_name: prevData.state_name,
                        district_name: prevData.district_name,
                        block_name: prevData.block_name,
                        pin_code: prevData.pin_code,
                        contact_no: prevData.contact_no,
                    };
                    company_address_new = {
                        address_1: modData.address_1,
                        address_2: modData.address_2,
                        address_3: modData.address_3,
                        country_name: modData.country_name,
                        state_name: modData.state_name,
                        district_name: modData.district_name,
                        block_name: modData.block_name,
                        pin_code: modData.pin_code,
                        contact_no: modData.contact_no,
                    };
                }
                var enrolment_identification_old = null; var enrolment_identification_new = null;
                if (_mod_enrolment_identification) {
                    enrolment_identification_old = {
                        company_pan_no: prevData.company_pan_no,
                        gstin_no: prevData.gstin_no,
                        cin_no: prevData.cin_no,
                        registration_no: prevData.registration_no,
                        it_80g_reg_no: prevData.it_80g_reg_no,
                        it_12a_reg_no: prevData.it_12a_reg_no,
                        darpan_reg_no: prevData.darpan_reg_no,
                        mca_csr_f1_reg_no: prevData.mca_csr_f1_reg_no,
                        fcra_no_with_status: prevData.fcra_no_with_status,
                        fcra_no_status: prevData.fcra_no_status,
                        fin_audit_rpt_filed: prevData.fin_audit_rpt_filed,
                        expertise_area: await entityDataModule.modified_expertise_area_names_old(_modify_id),
                        services: await entityDataModule.modified_services_old(_modify_id),
                    };
                    enrolment_identification_new = {
                        company_pan_no: modData.company_pan_no,
                        gstin_no: modData.gstin_no,
                        cin_no: modData.cin_no,
                        registration_no: modData.registration_no,
                        it_80g_reg_no: modData.it_80g_reg_no,
                        it_12a_reg_no: modData.it_12a_reg_no,
                        darpan_reg_no: modData.darpan_reg_no,
                        mca_csr_f1_reg_no: modData.mca_csr_f1_reg_no,
                        fcra_no_with_status: modData.fcra_no_with_status,
                        fcra_no_status: modData.fcra_no_status,
                        fin_audit_rpt_filed: modData.fin_audit_rpt_filed,
                        expertise_area: await entityDataModule.modified_expertise_area_names(_modify_id),
                        services: await entityDataModule.modified_services(_modify_id),
                    };
                }

                var enrolment_document_old = []; var enrolment_document_new = [];
                if (_mod_enrolment_document) {
                    const document_list = await registrationModule.documents(prevData.entity_id);
                    const tmpModDocUp = await entityDataModule.modified_entity_document_uploaded(_modify_id);
                    const tmpEntDocs = await entityDataModule.modified_entity_document_uploaded_old(_modify_id);

                    for (let hy = 0; tmpModDocUp && hy < tmpModDocUp.length; hy++) {
                        var doc_name = '';
                        for (let ui = 0; document_list && ui < document_list.length; ui++) {
                            if (document_list[ui].document_id.toString() == tmpModDocUp[hy].document_id.toString()) {
                                doc_name = document_list[ui].doc_name; break;
                            }
                        }
                        if (tmpModDocUp[hy].to_delete) {
                            enrolment_document_new.push({
                                file_id: 0,
                                document_id: tmpModDocUp[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpModDocUp[hy].file_name,
                                new_name: tmpModDocUp[hy].new_name,
                                file_path: tmpModDocUp[hy].file_path,
                                file_status: "Delete",
                            });
                        } else {
                            var to_update = false;
                            for (let ui = 0; tmpEntDocs && ui < tmpEntDocs.length; ui++) {
                                if (tmpEntDocs[ui].document_id.toString() == tmpModDocUp[hy].document_id.toString()) {
                                    to_update = true; break;
                                }
                            }
                            enrolment_document_new.push({
                                file_id: 0,
                                document_id: tmpModDocUp[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpModDocUp[hy].file_name,
                                new_name: tmpModDocUp[hy].new_name,
                                file_path: tmpModDocUp[hy].file_path,
                                file_status: (to_update ? "Update" : "Add New"),
                            });
                        }
                    }
                    for (let hy = 0; tmpEntDocs && hy < tmpEntDocs.length; hy++) {
                        var is_exists = false;
                        for (let ui = 0; enrolment_document_new && ui < enrolment_document_new.length; ui++) {
                            if (enrolment_document_new[ui].document_id.toString() == tmpEntDocs[hy].document_id.toString()) {
                                is_exists = true; break;
                            }
                        }
                        if (!is_exists) {
                            var doc_name = '';
                            for (let ui = 0; document_list && ui < document_list.length; ui++) {
                                if (document_list[ui].document_id.toString() == tmpEntDocs[hy].document_id.toString()) {
                                    doc_name = document_list[ui].doc_name; break;
                                }
                            }
                            enrolment_document_new.push({
                                file_id: tmpEntDocs[hy].file_id,
                                document_id: tmpEntDocs[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpEntDocs[hy].file_name,
                                new_name: tmpEntDocs[hy].new_name,
                                file_path: tmpEntDocs[hy].file_path,
                                file_status: "Keep as it is.",
                            });
                        }
                    }

                    for (let hy = 0; tmpEntDocs && hy < tmpEntDocs.length; hy++) {
                        var doc_name = '';
                        for (let ui = 0; document_list && ui < document_list.length; ui++) {
                            if (document_list[ui].document_id.toString() == tmpEntDocs[hy].document_id.toString()) {
                                doc_name = document_list[ui].doc_name; break;
                            }
                        }
                        enrolment_document_old.push({
                            file_id: tmpEntDocs[hy].file_id,
                            document_id: tmpEntDocs[hy].document_id,
                            doc_name: doc_name,
                            file_name: tmpEntDocs[hy].file_name,
                            new_name: tmpEntDocs[hy].new_name,
                            file_path: tmpEntDocs[hy].file_path,
                        });
                    }
                }

                var enrolment_banks_old = []; var enrolment_banks_new = [];
                if (_mod_enrolment_banks) {
                    enrolment_banks_old = await entityDataModule.modified_bank_accounts_old(_modify_id);
                    enrolment_banks_new = await entityDataModule.modified_bank_accounts(_modify_id);
                }

                var admin_basic_old = null; var admin_basic_new = null;
                if (_mod_admin_basic) {
                    admin_basic_old = {
                        first_name: prevData.acc_first_name,
                        middle_name: prevData.acc_middle_name,
                        last_name: prevData.acc_last_name,
                        design_name: prevData.acc_design_name,
                        pan_no: prevData.acc_pan_no,
                    };
                    admin_basic_new = {
                        first_name: modData.acc_first_name,
                        middle_name: modData.acc_middle_name,
                        last_name: modData.acc_last_name,
                        design_name: modData.acc_design_name,
                        pan_no: modData.acc_pan_no,
                    };
                }
                var admin_perm_addr_old = null; var admin_perm_addr_new = null;
                if (_mod_admin_perm_addr) {
                    admin_perm_addr_old = {
                        pa_address1: prevData.acc_pa_address1,
                        pa_address2: prevData.acc_pa_address2,
                        pa_address3: prevData.acc_pa_address3,
                        pa_country_name: prevData.acc_pa_country_name,
                        pa_state_name: prevData.acc_pa_state_name,
                        pa_district_name: prevData.acc_pa_district_name,
                        pa_block_name: prevData.acc_pa_block_name,
                        pa_pin_code: prevData.acc_pa_pin_code,
                    };
                    admin_perm_addr_new = {
                        pa_address1: modData.acc_pa_address1,
                        pa_address2: modData.acc_pa_address2,
                        pa_address3: modData.acc_pa_address3,
                        pa_country_name: modData.acc_pa_country_name,
                        pa_state_name: modData.acc_pa_state_name,
                        pa_district_name: modData.acc_pa_district_name,
                        pa_block_name: modData.acc_pa_block_name,
                        pa_pin_code: modData.acc_pa_pin_code,
                    };
                }
                var admin_curr_addr_old = null; var admin_curr_addr_new = null;
                if (_mod_admin_curr_addr) {
                    admin_curr_addr_old = {
                        ca_same_pa: prevData.acc_ca_same_pa,
                        ca_address1: prevData.acc_ca_address1,
                        ca_address2: prevData.acc_ca_address2,
                        ca_address3: prevData.acc_ca_address3,
                        ca_country_name: prevData.acc_ca_country_name,
                        ca_state_name: prevData.acc_ca_state_name,
                        ca_district_name: modData.acc_ca_district_name,
                        ca_block_name: prevData.acc_ca_block_name,
                        ca_pin_code: prevData.acc_ca_pin_code,
                    };
                    admin_curr_addr_new = {
                        ca_same_pa: modData.acc_ca_same_pa,
                        ca_address1: modData.acc_ca_address1,
                        ca_address2: modData.acc_ca_address2,
                        ca_address3: modData.acc_ca_address3,
                        ca_country_name: modData.acc_ca_country_name,
                        ca_state_name: modData.acc_ca_state_name,
                        ca_district_name: modData.acc_ca_district_name,
                        ca_block_name: modData.acc_ca_block_name,
                        ca_pin_code: modData.acc_ca_pin_code,
                    };
                }
                var admin_document_old = []; var admin_document_new = [];
                if (_mod_admin_document) {
                    const user_docs_list = await registrationModule.user_acc_documents(prevData.entity_id);
                    const tmpModAdmDocUp = await entityDataModule.modified_user_acc_document_uploaded(_modify_id);
                    const tmpAdmDocs = await entityDataModule.modified_user_acc_document_uploaded_old(_modify_id);

                    for (let hy = 0; tmpModAdmDocUp && hy < tmpModAdmDocUp.length; hy++) {
                        var doc_name = '';
                        for (let ui = 0; user_docs_list && ui < user_docs_list.length; ui++) {
                            if (user_docs_list[ui].document_id.toString() == tmpModAdmDocUp[hy].document_id.toString()) {
                                doc_name = user_docs_list[ui].doc_name; break;
                            }
                        }
                        if (tmpModAdmDocUp[hy].to_delete) {
                            admin_document_new.push({
                                file_id: 0,
                                document_id: tmpModAdmDocUp[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpModAdmDocUp[hy].file_name,
                                new_name: tmpModAdmDocUp[hy].new_name,
                                file_path: tmpModAdmDocUp[hy].file_path,
                                file_status: "Delete",
                            });
                        } else {
                            var to_update = false;
                            for (let ui = 0; tmpAdmDocs && ui < tmpAdmDocs.length; ui++) {
                                if (tmpAdmDocs[ui].document_id.toString() == tmpModAdmDocUp[hy].document_id.toString()) {
                                    to_update = true; break;
                                }
                            }
                            admin_document_new.push({
                                file_id: 0,
                                document_id: tmpModAdmDocUp[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpModAdmDocUp[hy].file_name,
                                new_name: tmpModAdmDocUp[hy].new_name,
                                file_path: tmpModAdmDocUp[hy].file_path,
                                file_status: (to_update ? "Update" : "Add New"),
                            });
                        }
                    }
                    for (let hy = 0; tmpAdmDocs && hy < tmpAdmDocs.length; hy++) {
                        var is_exists = false;
                        for (let ui = 0; admin_document_new && ui < admin_document_new.length; ui++) {
                            if (admin_document_new[ui].document_id.toString() == tmpAdmDocs[hy].document_id.toString()) {
                                is_exists = true; break;
                            }
                        }
                        if (!is_exists) {
                            var doc_name = '';
                            for (let ui = 0; user_docs_list && ui < user_docs_list.length; ui++) {
                                if (user_docs_list[ui].document_id.toString() == tmpAdmDocs[hy].document_id.toString()) {
                                    doc_name = user_docs_list[ui].doc_name; break;
                                }
                            }
                            admin_document_new.push({
                                file_id: tmpAdmDocs[hy].file_id,
                                document_id: tmpAdmDocs[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpAdmDocs[hy].file_name,
                                new_name: tmpAdmDocs[hy].new_name,
                                file_path: tmpAdmDocs[hy].file_path,
                                file_status: "Keep as it is.",
                            });
                        }
                    }
                    for (let hy = 0; tmpAdmDocs && hy < tmpAdmDocs.length; hy++) {
                        var doc_name = '';
                        for (let ui = 0; user_docs_list && ui < user_docs_list.length; ui++) {
                            if (user_docs_list[ui].document_id.toString() == tmpAdmDocs[hy].document_id.toString()) {
                                doc_name = user_docs_list[ui].doc_name; break;
                            }
                        }
                        admin_document_old.push({
                            file_id: tmpAdmDocs[hy].file_id,
                            document_id: tmpAdmDocs[hy].document_id,
                            doc_name: doc_name,
                            file_name: tmpAdmDocs[hy].file_name,
                            new_name: tmpAdmDocs[hy].new_name,
                            file_path: tmpAdmDocs[hy].file_path,
                        });
                    }
                }

                var board_member_old = []; var board_member_new = [];
                if (_mod_board_member) {
                    board_member_old = await entityDataModule.modified_board_members_old(_modify_id);
                    board_member_new = await entityDataModule.modified_board_members(_modify_id);
                }
                var csr_company_old = null; var csr_company_new = null;
                var csr_company_docs_old = []; var csr_company_docs_new = [];
                if (_mod_csr_company) {
                    const csr_policy_docs_list = await registrationModule.csr_policy_documents(prevData.entity_id);
                    const tmpModCsrDocUp = await entityDataModule.modified_csr_docs_document_uploaded(_modify_id);
                    const tmpCsrDocs = await entityDataModule.modified_csr_docs_document_uploaded_old(_modify_id);

                    for (let hy = 0; tmpModCsrDocUp && hy < tmpModCsrDocUp.length; hy++) {
                        var doc_name = '';
                        for (let ui = 0; csr_policy_docs_list && ui < csr_policy_docs_list.length; ui++) {
                            if (csr_policy_docs_list[ui].document_id.toString() == tmpModCsrDocUp[hy].document_id.toString()) {
                                doc_name = csr_policy_docs_list[ui].doc_name; break;
                            }
                        }
                        if (tmpModCsrDocUp[hy].to_delete) {
                            csr_company_docs_new.push({
                                file_id: 0,
                                document_id: tmpModCsrDocUp[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpModCsrDocUp[hy].file_name,
                                new_name: tmpModCsrDocUp[hy].new_name,
                                file_path: tmpModCsrDocUp[hy].file_path,
                                file_status: "Delete",
                            });
                        } else {
                            var to_update = false;
                            for (let ui = 0; tmpCsrDocs && ui < tmpCsrDocs.length; ui++) {
                                if (tmpCsrDocs[ui].document_id.toString() == tmpModCsrDocUp[hy].document_id.toString()) {
                                    to_update = true; break;
                                }
                            }
                            csr_company_docs_new.push({
                                file_id: 0,
                                document_id: tmpModCsrDocUp[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpModCsrDocUp[hy].file_name,
                                new_name: tmpModCsrDocUp[hy].new_name,
                                file_path: tmpModCsrDocUp[hy].file_path,
                                file_status: (to_update ? "Update" : "Add New"),
                            });
                        }
                    }
                    for (let hy = 0; tmpCsrDocs && hy < tmpCsrDocs.length; hy++) {
                        var is_exists = false;
                        for (let ui = 0; csr_company_docs_new && ui < csr_company_docs_new.length; ui++) {
                            if (csr_company_docs_new[ui].document_id.toString() == tmpCsrDocs[hy].document_id.toString()) {
                                is_exists = true; break;
                            }
                        }
                        if (!is_exists) {
                            var doc_name = '';
                            for (let ui = 0; csr_policy_docs_list && ui < csr_policy_docs_list.length; ui++) {
                                if (csr_policy_docs_list[ui].document_id.toString() == tmpCsrDocs[hy].document_id.toString()) {
                                    doc_name = csr_policy_docs_list[ui].doc_name; break;
                                }
                            }
                            csr_company_docs_new.push({
                                file_id: tmpCsrDocs[hy].file_id,
                                document_id: tmpCsrDocs[hy].document_id,
                                doc_name: doc_name,
                                file_name: tmpCsrDocs[hy].file_name,
                                new_name: tmpCsrDocs[hy].new_name,
                                file_path: tmpCsrDocs[hy].file_path,
                                file_status: "Keep as it is.",
                            });
                        }
                    }
                    for (let hy = 0; tmpCsrDocs && hy < tmpCsrDocs.length; hy++) {
                        var doc_name = '';
                        for (let ui = 0; csr_policy_docs_list && ui < csr_policy_docs_list.length; ui++) {
                            if (csr_policy_docs_list[ui].document_id.toString() == tmpCsrDocs[hy].document_id.toString()) {
                                doc_name = csr_policy_docs_list[ui].doc_name; break;
                            }
                        }
                        csr_company_docs_old.push({
                            file_id: tmpCsrDocs[hy].file_id,
                            document_id: tmpCsrDocs[hy].document_id,
                            doc_name: doc_name,
                            file_name: tmpCsrDocs[hy].file_name,
                            new_name: tmpCsrDocs[hy].new_name,
                            file_path: tmpCsrDocs[hy].file_path,
                        });
                    }
                    csr_company_old = {
                        brief_csr_policy: prevData.brief_csr_policy,
                        csr_policy_docs: csr_company_docs_old,
                    };
                    csr_company_new = {
                        brief_csr_policy: modData.brief_csr_policy,
                        csr_policy_docs: csr_company_docs_new,
                    };
                }
                var csr_committee_old = []; var csr_committee_new = [];
                if (_mod_csr_committee) {
                    csr_committee_old = await entityDataModule.modified_csr_committee_members_old(_modify_id);
                    csr_committee_new = await entityDataModule.modified_csr_committee_members(_modify_id);
                }

                const results = {
                    request_date: modData.request_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(modData.request_date)) : "",
                    request_status: _request_status,
                    approved_date: modData.approved_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(modData.approved_date)) : "",
                    approve_remark: (modData.approve_remark ? modData.approve_remark : ""),
                    rejected_date: modData.rejected_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(modData.rejected_date)) : "",
                    reject_remark: (modData.reject_remark ? modData.reject_remark : ""),

                    form_static_fields: form_static_fields,

                    initiator_user: { old: initiator_user_old, new: initiator_user_new, },
                    company_basic: { old: company_basic_old, new: company_basic_new, },
                    company_address: { old: company_address_old, new: company_address_new },
                    enrolment_identification: { old: enrolment_identification_old, new: enrolment_identification_new },
                    enrolment_document: { old: enrolment_document_old, new: enrolment_document_new },
                    enrolment_banks: { old: enrolment_banks_old, new: enrolment_banks_new },
                    admin_basic: { old: admin_basic_old, new: admin_basic_new },
                    admin_perm_addr: { old: admin_perm_addr_old, new: admin_perm_addr_new },
                    admin_curr_addr: { old: admin_curr_addr_old, new: admin_curr_addr_new },
                    admin_document: { old: admin_document_old, new: admin_document_new },
                    board_member: { old: board_member_old, new: board_member_new },
                    csr_company: { old: csr_company_old, new: csr_company_new },
                    csr_committee: { old: csr_committee_old, new: csr_committee_new },

                    modified_section: {
                        initiator_user: _mod_initiator_user,
                        company_basic: _mod_company_basic,
                        company_address: _mod_company_address,
                        enrolment_identification: _mod_enrolment_identification,
                        enrolment_document: _mod_enrolment_document,
                        enrolment_banks: _mod_enrolment_banks,
                        admin_basic: _mod_admin_basic,
                        admin_perm_addr: _mod_admin_perm_addr,
                        admin_curr_addr: _mod_admin_curr_addr,
                        admin_document: _mod_admin_document,
                        board_member: _mod_board_member,
                        csr_company: _mod_csr_company,
                        csr_committee: _mod_csr_committee,
                    }
                };
                return res.status(200).json(success(true, res.statusCode, "", results));
            } else {
                return res.status(200).json(success(false, res.statusCode, 'Profile details not found, Please try again.', null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, 'Entity profile change request not found, Please try again.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_change_request_approve = async (req, res, next) => {
    const { modify_id, remark } = req.body;
    try {
        const _modify_id = modify_id && validator.isNumeric(modify_id.toString()) ? BigInt(modify_id) : 0;
        const _remark = (remark && remark.length > 0) ? remark.trim() : "";

        const _queryModDataMst = `SELECT u.entity_id, mm.account_id, mm.user_id, u.reg_id, u.form_static_fields_json, mm.request_status,
        mm.first_name, mm.middle_name, mm.last_name, mm.pan_no, 
        mm.company_name, mm.registered_as_id, mm.org_type_id, mm.parent_org_id, mm.address_1, mm.address_2, mm.address_3, mm.country_id, mm.state_id, mm.district_id, mm.block_id, mm.pin_code, mm.contact_no, 
        mm.company_pan_no, mm.gstin_no, mm.cin_no, mm.registration_no, mm.it_80g_reg_no, mm.it_12a_reg_no, mm.darpan_reg_no, mm.mca_csr_f1_reg_no, mm.fcra_no_with_status, mm.fcra_no_status, mm.fin_audit_rpt_filed, mm.brief_csr_policy,
        mm.acc_first_name, mm.acc_middle_name, mm.acc_last_name, mm.acc_design_id, mm.acc_pan_no, mm.acc_pa_address1, mm.acc_pa_address2, mm.acc_pa_address3, mm.acc_pa_country_id, mm.acc_pa_state_id, mm.acc_pa_district_id, mm.acc_pa_block_id,
        mm.acc_pa_pin_code, mm.acc_ca_same_pa, mm.acc_ca_address1, mm.acc_ca_address2, mm.acc_ca_address3, mm.acc_ca_country_id, mm.acc_ca_state_id, mm.acc_ca_district_id, mm.acc_ca_block_id, mm.acc_ca_pin_code,
        mm.mod_initiator_user, mm.mod_company_basic, mm.mod_company_address, mm.mod_enrolment_identification, mm.mod_enrolment_document, mm.mod_enrolment_banks, mm.mod_admin_basic, mm.mod_admin_perm_addr, mm.mod_admin_curr_addr, 
        mm.mod_admin_document, mm.mod_board_member, mm.mod_csr_company, mm.mod_csr_committee
        FROM modify_master mm INNER JOIN user_master u ON mm.reg_id = u.reg_id WHERE mm.modify_id = ?`;
        const rowModDataMst = await db.sequelize.query(_queryModDataMst, { replacements: [_modify_id], type: QueryTypes.SELECT });
        if (rowModDataMst && rowModDataMst.length > 0) {
            const modData = rowModDataMst[0];
            const _request_status = modData.request_status && validator.isNumeric(modData.request_status.toString()) ? parseInt(modData.request_status) : 0;
            if (_request_status != 0) {
                return res.status(200).json(success(false, res.statusCode, "Entity profile change request is already " + (_request_status == 1 ? "approved" : "rejected") + ".", null));
            }
            if (_remark.length <= 0) {
                return res.status(200).json(success(false, res.statusCode, "Please enter remark to approve profile change request.", null));
            }

            const form_static_fields = await entityDataModule.profile_validation_field(modData.entity_id, modData.form_static_fields_json);

            var _mod_initiator_user = false; var _mod_company_basic = false; var _mod_company_address = false; var _mod_enrolment_identification = false;
            var _mod_enrolment_document = false; var _mod_enrolment_banks = false; var _mod_admin_basic = false; var _mod_admin_perm_addr = false;
            var _mod_admin_curr_addr = false; var _mod_admin_document = false; var _mod_board_member = false; var _mod_csr_company = false; var _mod_csr_committee = false;

            _mod_initiator_user = (modData.mod_initiator_user ? modData.mod_initiator_user : false);
            _mod_company_basic = (modData.mod_company_basic ? modData.mod_company_basic : false);
            _mod_company_address = (modData.mod_company_address ? modData.mod_company_address : false);
            _mod_enrolment_identification = (modData.mod_enrolment_identification ? modData.mod_enrolment_identification : false);
            _mod_enrolment_document = (modData.mod_enrolment_document ? modData.mod_enrolment_document : false);
            _mod_enrolment_banks = (modData.mod_enrolment_banks ? modData.mod_enrolment_banks : false);
            _mod_admin_basic = (modData.mod_admin_basic ? modData.mod_admin_basic : false);
            _mod_admin_perm_addr = (modData.mod_admin_perm_addr ? modData.mod_admin_perm_addr : false);
            _mod_admin_curr_addr = (modData.mod_admin_curr_addr ? modData.mod_admin_curr_addr : false);
            _mod_admin_document = (modData.mod_admin_document ? modData.mod_admin_document : false);
            _mod_board_member = (modData.mod_board_member ? modData.mod_board_member : false);
            _mod_csr_company = (modData.mod_csr_company ? modData.mod_csr_company : false);
            _mod_csr_committee = (modData.mod_csr_committee ? modData.mod_csr_committee : false);

            //#region Validate data with database for dedupe process
            if (_mod_initiator_user) {
                const _pan_no = (modData.pan_no && modData.pan_no.length > 0) ? modData.pan_no.trim().toUpperCase() : "";
                if (_pan_no.length > 0) {
                    const _query3 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:pan_no)`;
                    const row3 = await db.sequelize.query(_query3, { replacements: { reg_id: modData.reg_id, pan_no: _pan_no }, type: QueryTypes.SELECT });
                    if (row3 && row3.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Initiator PAN number is already registered.", null));
                    }
                }
            }
            if (_mod_enrolment_identification) {
                const _company_pan_no = (modData.company_pan_no && modData.company_pan_no.length > 0) ? modData.company_pan_no.trim().toUpperCase() : "";
                if (_company_pan_no.length > 0) {
                    const _query4 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:company_pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:company_pan_no)`;
                    const row4 = await db.sequelize.query(_query4, { replacements: { reg_id: modData.reg_id, company_pan_no: _company_pan_no }, type: QueryTypes.SELECT });
                    if (row4 && row4.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Company PAN number is already registered.", null));
                    }
                }
                const _gstin_no = (modData.gstin_no && modData.gstin_no.length > 0) ? modData.gstin_no.trim().toUpperCase() : "";
                if (_gstin_no.length > 0) {
                    const _query5 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.gstin_no, '')) > 0 AND LOWER(u.gstin_no) = LOWER(:gstin_no)`;
                    const row5 = await db.sequelize.query(_query5, { replacements: { reg_id: modData.reg_id, gstin_no: _gstin_no }, type: QueryTypes.SELECT });
                    if (row5 && row5.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "GSTIN number is already registered.", null));
                    }
                }
                const _cin_no = (modData.cin_no && modData.cin_no.length > 0) ? modData.cin_no.trim().toUpperCase() : "";
                if (_cin_no.length > 0) {
                    const _query6 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.cin_no, '')) > 0 AND LOWER(u.cin_no) = LOWER(:cin_no)`;
                    const row6 = await db.sequelize.query(_query6, { replacements: { reg_id: modData.reg_id, cin_no: _cin_no }, type: QueryTypes.SELECT });
                    if (row6 && row6.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Company identification number is already registered.", null));
                    }
                }
                const _registration_no = (modData.registration_no && modData.registration_no.length > 0) ? modData.registration_no.trim() : "";
                if (_registration_no.length > 0) {
                    const _query501 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.registration_no, '')) > 0 AND LOWER(u.registration_no) = LOWER(:registration_no)`;
                    const row501 = await db.sequelize.query(_query501, { replacements: { reg_id: modData.reg_id, registration_no: _registration_no }, type: QueryTypes.SELECT });
                    if (row501 && row501.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Registration number is already registered.", null));
                    }
                }
                const _it_80g_reg_no = (modData.it_80g_reg_no && modData.it_80g_reg_no.length > 0) ? modData.it_80g_reg_no.trim() : "";
                if (_it_80g_reg_no.length > 0) {
                    const _query502 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.it_80g_reg_no, '')) > 0 AND LOWER(u.it_80g_reg_no) = LOWER(:it_80g_reg_no)`;
                    const row502 = await db.sequelize.query(_query502, { replacements: { reg_id: modData.reg_id, it_80g_reg_no: _it_80g_reg_no }, type: QueryTypes.SELECT });
                    if (row502 && row502.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Income tax 18G registration no. is already registered.", null));
                    }
                }
                const _it_12a_reg_no = (modData.it_12a_reg_no && modData.it_12a_reg_no.length > 0) ? modData.it_12a_reg_no.trim() : "";
                if (_it_12a_reg_no.length > 0) {
                    const _query503 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.it_12a_reg_no, '')) > 0 AND LOWER(u.it_12a_reg_no) = LOWER(:it_12a_reg_no)`;
                    const row503 = await db.sequelize.query(_query503, { replacements: { reg_id: modData.reg_id, it_12a_reg_no: _it_12a_reg_no }, type: QueryTypes.SELECT });
                    if (row503 && row503.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Income tax 12A registration no. is already registered.", null));
                    }
                }
                const _darpan_reg_no = (modData.darpan_reg_no && modData.darpan_reg_no.length > 0) ? modData.darpan_reg_no.trim() : "";
                if (_darpan_reg_no.length > 0) {
                    const _query504 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.darpan_reg_no, '')) > 0 AND LOWER(u.darpan_reg_no) = LOWER(:darpan_reg_no)`;
                    const row504 = await db.sequelize.query(_query504, { replacements: { reg_id: modData.reg_id, darpan_reg_no: _darpan_reg_no }, type: QueryTypes.SELECT });
                    if (row504 && row504.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "NGO DARPAN registration no/id is already registered.", null));
                    }
                }
                const _mca_csr_f1_reg_no = (modData.mca_csr_f1_reg_no && modData.mca_csr_f1_reg_no.length > 0) ? modData.mca_csr_f1_reg_no.trim() : "";
                if (_mca_csr_f1_reg_no.length > 0) {
                    const _query505 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND u.reg_id <> :reg_id AND LENGTH(COALESCE(u.mca_csr_f1_reg_no, '')) > 0 AND LOWER(u.mca_csr_f1_reg_no) = LOWER(:mca_csr_f1_reg_no)`;
                    const row505 = await db.sequelize.query(_query505, { replacements: { reg_id: modData.reg_id, mca_csr_f1_reg_no: _mca_csr_f1_reg_no }, type: QueryTypes.SELECT });
                    if (row505 && row505.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "MCA CSR form 1 registration no. is already registered.", null));
                    }
                }
            }
            if (_mod_admin_basic) {
                const _acc_pan_no = (modData.acc_pan_no && modData.acc_pan_no.length > 0) ? modData.acc_pan_no.trim().toUpperCase() : "";
                if (_acc_pan_no.length > 0) {
                    const _query3 = `SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.company_pan_no, '')) > 0 AND LOWER(u.company_pan_no) = LOWER(:pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_master u WHERE u.is_deleted = false AND LENGTH(COALESCE(u.pan_no, '')) > 0 AND LOWER(u.pan_no) = LOWER(:pan_no)
                    UNION ALL
                    SELECT u.reg_id FROM user_account a INNER JOIN user_master u ON a.reg_id = u.reg_id WHERE u.is_deleted = false AND a.is_deleted = false AND a.user_id <> :user_id
                    AND LENGTH(COALESCE(a.pan_no, '')) > 0 AND LOWER(a.pan_no) = LOWER(:pan_no)`;
                    const row3 = await db.sequelize.query(_query3, { replacements: { user_id: modData.user_id, pan_no: _acc_pan_no }, type: QueryTypes.SELECT });
                    if (row3 && row3.length > 0) {
                        return res.status(200).json(success(false, res.statusCode, "Admin PAN number is already registered.", null));
                    }
                }
            }
            //#endregion

            var _queryUserMaster = `UPDATE user_master SET `;
            var statementUserMaster = [];
            var replacementUserMaster = [modData.account_id, new Date(), modData.reg_id];

            if (_mod_initiator_user) {
                statementUserMaster.unshift(`first_name = ?`); replacementUserMaster.unshift(modData.first_name);
                statementUserMaster.unshift(`middle_name = ?`); replacementUserMaster.unshift(modData.middle_name);
                statementUserMaster.unshift(`last_name = ?`); replacementUserMaster.unshift(modData.last_name);
                statementUserMaster.unshift(`pan_no = ?`); replacementUserMaster.unshift(modData.pan_no);
            }
            if (_mod_company_basic) {
                statementUserMaster.unshift(`company_name = ?`); replacementUserMaster.unshift(modData.company_name);
                statementUserMaster.unshift(`registered_as_id = ?`); replacementUserMaster.unshift(modData.registered_as_id);
                statementUserMaster.unshift(`org_type_id = ?`); replacementUserMaster.unshift(modData.org_type_id);
                statementUserMaster.unshift(`parent_org_id = ?`); replacementUserMaster.unshift(modData.parent_org_id);
            }
            if (_mod_company_address) {
                statementUserMaster.unshift(`address_1 = ?`); replacementUserMaster.unshift(modData.address_1);
                statementUserMaster.unshift(`address_2 = ?`); replacementUserMaster.unshift(modData.address_2);
                statementUserMaster.unshift(`address_3 = ?`); replacementUserMaster.unshift(modData.address_3);
                statementUserMaster.unshift(`country_id = ?`); replacementUserMaster.unshift(modData.country_id);
                statementUserMaster.unshift(`state_id = ?`); replacementUserMaster.unshift(modData.state_id);
                statementUserMaster.unshift(`district_id = ?`); replacementUserMaster.unshift(modData.district_id);
                statementUserMaster.unshift(`block_id = ?`); replacementUserMaster.unshift(modData.block_id);
                statementUserMaster.unshift(`pin_code = ?`); replacementUserMaster.unshift(modData.pin_code);
                statementUserMaster.unshift(`contact_no = ?`); replacementUserMaster.unshift(modData.contact_no);
            }
            if (_mod_enrolment_identification) {
                statementUserMaster.unshift(`company_pan_no = ?`); replacementUserMaster.unshift(modData.company_pan_no);
                statementUserMaster.unshift(`gstin_no = ?`); replacementUserMaster.unshift(modData.gstin_no);
                statementUserMaster.unshift(`cin_no = ?`); replacementUserMaster.unshift(modData.cin_no);
                statementUserMaster.unshift(`registration_no = ?`); replacementUserMaster.unshift(modData.registration_no);
                statementUserMaster.unshift(`it_80g_reg_no = ?`); replacementUserMaster.unshift(modData.it_80g_reg_no);
                statementUserMaster.unshift(`it_12a_reg_no = ?`); replacementUserMaster.unshift(modData.it_12a_reg_no);
                statementUserMaster.unshift(`darpan_reg_no = ?`); replacementUserMaster.unshift(modData.darpan_reg_no);
                statementUserMaster.unshift(`mca_csr_f1_reg_no = ?`); replacementUserMaster.unshift(modData.mca_csr_f1_reg_no);
                statementUserMaster.unshift(`fcra_no_with_status = ?`); replacementUserMaster.unshift(modData.fcra_no_with_status);
                statementUserMaster.unshift(`fcra_no_status = ?`); replacementUserMaster.unshift(modData.fcra_no_status);
                statementUserMaster.unshift(`fin_audit_rpt_filed = ?`); replacementUserMaster.unshift(modData.fin_audit_rpt_filed);
            }
            if (_mod_csr_company) {
                statementUserMaster.unshift(`brief_csr_policy = ?`); replacementUserMaster.unshift(modData.brief_csr_policy);
            }
            if (statementUserMaster.length > 0) {
                _queryUserMaster += statementUserMaster.join(', ') + `, modify_by = ?, modify_date = ? WHERE reg_id = ?`;
            } else {
                _queryUserMaster += ` modify_by = ?, modify_date = ? WHERE reg_id = ?`;
            }
            const [, uID] = await db.sequelize.query(_queryUserMaster, { replacements: replacementUserMaster, type: QueryTypes.UPDATE });
            if (uID > 0) {
                if (_mod_enrolment_identification) {
                    const _queryUserExpertise = `DELETE FROM user_expertise WHERE reg_id = :reg_id;
                    INSERT INTO user_expertise(reg_id, expertise_area_id)
                    SELECT :reg_id, expertise_area_id FROM modify_expertise WHERE modify_id = :modify_id`;
                    await db.sequelize.query(_queryUserExpertise, { replacements: { reg_id: modData.reg_id, modify_id: _modify_id }, type: QueryTypes.INSERT });

                    const _modServices = await entityDataModule.modified_services(_modify_id); var tempUserServIds = [];
                    for (let aq = 0; _modServices && aq < _modServices.length; aq++) {
                        const eleSer = _modServices[aq];
                        const _userServId = eleSer.u_serv_id && validator.isNumeric(eleSer.u_serv_id.toString()) ? BigInt(eleSer.u_serv_id) : 0;
                        if (_userServId > 0) {
                            const _queryUserServicesUp = `UPDATE user_services SET head_id = ?, category_id = ?, sub_cat_id = ?, range_size = ?, price = ?, modify_by = ?, modify_date = ? WHERE u_serv_id = ?`;
                            const _repUserServicesUp = [eleSer.head_id, eleSer.category_id, eleSer.sub_cat_id, eleSer.range_size, eleSer.price, modData.account_id, new Date(), _userServId];
                            await db.sequelize.query(_queryUserServicesUp, { replacements: _repUserServicesUp, type: QueryTypes.UPDATE });
                            tempUserServIds.push(_userServId);
                        } else {
                            const _queryUserServicesIn = `INSERT INTO user_services(reg_id, head_id, category_id, sub_cat_id, range_size, price, added_by, added_date)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING "u_serv_id"`;
                            const _repUserServicesIn = [modData.reg_id, eleSer.head_id, eleSer.category_id, eleSer.sub_cat_id, eleSer.range_size, eleSer.price, modData.account_id, new Date()];
                            const [rowUserServicesIn] = await db.sequelize.query(_queryUserServicesIn, { replacements: _repUserServicesIn, type: QueryTypes.INSERT });
                            const t_u_serv_id = (rowUserServicesIn && rowUserServicesIn.length > 0 && rowUserServicesIn[0] ? rowUserServicesIn[0].u_serv_id : 0);
                            if (t_u_serv_id > 0) {
                                tempUserServIds.push(t_u_serv_id);
                            }
                        }
                    }
                    if (tempUserServIds.length > 0) {
                        const _queryUserServicesDel = `UPDATE user_services SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false AND u_serv_id NOT IN (?)`;
                        await db.sequelize.query(_queryUserServicesDel, { replacements: [modData.account_id, new Date(), modData.reg_id, tempUserServIds], type: QueryTypes.UPDATE });
                    } else {
                        const _queryUserServicesDelAll = `UPDATE user_services SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false`;
                        await db.sequelize.query(_queryUserServicesDelAll, { replacements: [modData.account_id, new Date(), modData.reg_id], type: QueryTypes.UPDATE });
                    }
                }

                if (_mod_enrolment_document) {
                    const tmpModDocUp = await entityDataModule.modified_entity_document_uploaded(_modify_id);
                    for (let ki = 0; tmpModDocUp && ki < tmpModDocUp.length; ki++) {
                        if (tmpModDocUp[ki].to_delete) {
                            const _queryDocDel = `UPDATE user_document SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND document_id = ? AND is_deleted = false`;
                            await db.sequelize.query(_queryDocDel, { replacements: [modData.account_id, new Date(), modData.reg_id, tmpModDocUp[ki].document_id], type: QueryTypes.UPDATE });
                        } else {
                            var movedGcpPath = tmpModDocUp[ki].file_path; var movedGcpResp = tmpModDocUp[ki].gcp_resp;
                            const _newGcpPath = 'entity/' + modData.reg_id.toString() + '/' + tmpModDocUp[ki].new_name;
                            try {
                                const moveRsp = await cloudStorageModule.CopyFile(tmpModDocUp[ki].file_path, _newGcpPath);
                                movedGcpPath = _newGcpPath; movedGcpResp = JSON.stringify(moveRsp);
                            } catch (_) {

                            }
                            const _queryDocSel = `SELECT doc_file_id FROM user_document WHERE reg_id = ? AND document_id = ? AND is_deleted = false`;
                            const rowDocSel = await db.sequelize.query(_queryDocSel, { replacements: [modData.reg_id, tmpModDocUp[ki].document_id], type: QueryTypes.SELECT });
                            if (rowDocSel && rowDocSel.length > 0) {
                                const _queryDocUp = `UPDATE user_document SET original_file_name = ?, new_file_name = ?, gcp_file_path = ?, gcp_response_data = ?,
                                cloud_file_stored = ?, modify_by = ?, modify_date = ? WHERE doc_file_id = ?`;
                                await db.sequelize.query(_queryDocUp, {
                                    replacements: [tmpModDocUp[ki].file_name, tmpModDocUp[ki].new_name, movedGcpPath, movedGcpResp, true, modData.account_id,
                                    new Date(), rowDocSel[0].doc_file_id], type: QueryTypes.UPDATE
                                });
                            } else {
                                const _queryDocIn = `INSERT INTO user_document(reg_id, document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data, 
                                    cloud_file_stored, uploaded_by, uploaded_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                                await db.sequelize.query(_queryDocIn, {
                                    replacements: [modData.reg_id, tmpModDocUp[ki].document_id, tmpModDocUp[ki].file_name, tmpModDocUp[ki].new_name, movedGcpPath,
                                        movedGcpResp, true, modData.account_id, new Date()], type: QueryTypes.INSERT
                                });
                            }
                        }
                    }
                }

                if (_mod_enrolment_banks) {
                    const _modBanks = await entityDataModule.modified_bank_accounts(_modify_id); var tempBankIds = [];
                    for (let aq = 0; _modBanks && aq < _modBanks.length; aq++) {
                        const eleBank = _modBanks[aq];
                        const _userBankId = eleBank.ubank_id && validator.isNumeric(eleBank.ubank_id.toString()) ? BigInt(eleBank.ubank_id) : 0;
                        if (_userBankId > 0) {
                            const _queryUserBanksUp = `UPDATE user_bank SET ifsc_code = ?, bank_id = ?, bank_other = ?, branch_id = ?, branch_other = ?, 
                            account_type = ?, account_no = ?, re_account_no = ?, modify_by = ?, modify_date = ? WHERE ubank_id = ?`;
                            const _repUserBankUp = [eleBank.ifsc_code, eleBank.bank_id, eleBank.bank_name, eleBank.branch_id, eleBank.bank_branch,
                            eleBank.account_type, eleBank.account_no, eleBank.re_account_no, modData.account_id, new Date(), _userBankId];
                            await db.sequelize.query(_queryUserBanksUp, { replacements: _repUserBankUp, type: QueryTypes.UPDATE });
                            tempBankIds.push(_userBankId);
                        } else {
                            const _queryUserBankIn = `INSERT INTO user_bank(reg_id, ifsc_code, bank_id, bank_other, branch_id, branch_other, account_type, account_no, re_account_no, 
                                consent_provided, added_by, added_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING "ubank_id"`;
                            const _repUserBankIn = [modData.reg_id, eleBank.ifsc_code, eleBank.bank_id, eleBank.bank_name, eleBank.branch_id, eleBank.bank_branch,
                            eleBank.account_type, eleBank.account_no, eleBank.re_account_no, true, modData.account_id, new Date()];
                            const [rowUserBankIn] = await db.sequelize.query(_queryUserBankIn, { replacements: _repUserBankIn, type: QueryTypes.INSERT });
                            const t_ubank_id = (rowUserBankIn && rowUserBankIn.length > 0 && rowUserBankIn[0] ? rowUserBankIn[0].ubank_id : 0);
                            if (t_ubank_id > 0) {
                                tempBankIds.push(t_ubank_id);
                            }
                        }
                    }
                    if (tempBankIds.length > 0) {
                        const _queryBankDel = `UPDATE user_bank SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false AND ubank_id NOT IN (?)`;
                        await db.sequelize.query(_queryBankDel, { replacements: [modData.account_id, new Date(), modData.reg_id, tempBankIds], type: QueryTypes.UPDATE });
                    } else {
                        const _queryBankDelAll = `UPDATE user_bank SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false`;
                        await db.sequelize.query(_queryBankDelAll, { replacements: [modData.account_id, new Date(), modData.reg_id], type: QueryTypes.UPDATE });
                    }
                }

                var _queryUserAccount = `UPDATE user_account SET `;
                var statementUserAccount = [];
                var replacementUserAccount = [modData.account_id, new Date(), modData.user_id];

                if (_mod_admin_basic) {
                    statementUserAccount.unshift(`first_name = ?`); replacementUserAccount.unshift(modData.acc_first_name);
                    statementUserAccount.unshift(`middle_name = ?`); replacementUserAccount.unshift(modData.acc_middle_name);
                    statementUserAccount.unshift(`last_name = ?`); replacementUserAccount.unshift(modData.acc_last_name);
                    statementUserAccount.unshift(`design_id = ?`); replacementUserAccount.unshift(modData.acc_design_id);
                    statementUserAccount.unshift(`pan_no = ?`); replacementUserAccount.unshift(modData.acc_pan_no);
                }
                if (_mod_admin_perm_addr) {
                    statementUserAccount.unshift(`pa_address1 = ?`); replacementUserAccount.unshift(modData.acc_pa_address1);
                    statementUserAccount.unshift(`pa_address2 = ?`); replacementUserAccount.unshift(modData.acc_pa_address2);
                    statementUserAccount.unshift(`pa_address3 = ?`); replacementUserAccount.unshift(modData.acc_pa_address3);
                    statementUserAccount.unshift(`pa_country_id = ?`); replacementUserAccount.unshift(modData.acc_pa_country_id);
                    statementUserAccount.unshift(`pa_state_id = ?`); replacementUserAccount.unshift(modData.acc_pa_state_id);
                    statementUserAccount.unshift(`pa_district_id = ?`); replacementUserAccount.unshift(modData.acc_pa_district_id);
                    statementUserAccount.unshift(`pa_block_id = ?`); replacementUserAccount.unshift(modData.acc_pa_block_id);
                    statementUserAccount.unshift(`pa_pin_code = ?`); replacementUserAccount.unshift(modData.acc_pa_pin_code);
                }
                if (_mod_admin_curr_addr) {
                    statementUserAccount.unshift(`ca_same_pa = ?`); replacementUserAccount.unshift(modData.acc_ca_same_pa);
                    statementUserAccount.unshift(`ca_address1 = ?`); replacementUserAccount.unshift(modData.acc_ca_address1);
                    statementUserAccount.unshift(`ca_address2 = ?`); replacementUserAccount.unshift(modData.acc_ca_address2);
                    statementUserAccount.unshift(`ca_address3 = ?`); replacementUserAccount.unshift(modData.acc_ca_address3);
                    statementUserAccount.unshift(`ca_country_id = ?`); replacementUserAccount.unshift(modData.acc_ca_country_id);
                    statementUserAccount.unshift(`ca_state_id = ?`); replacementUserAccount.unshift(modData.acc_ca_state_id);
                    statementUserAccount.unshift(`ca_district_id = ?`); replacementUserAccount.unshift(modData.acc_ca_district_id);
                    statementUserAccount.unshift(`ca_block_id = ?`); replacementUserAccount.unshift(modData.acc_ca_block_id);
                    statementUserAccount.unshift(`ca_pin_code = ?`); replacementUserAccount.unshift(modData.acc_ca_pin_code);
                }
                if (statementUserAccount.length > 0) {
                    _queryUserAccount += statementUserAccount.join(', ') + `, modify_by = ?, modify_date = ? WHERE user_id = ?`;
                    await db.sequelize.query(_queryUserAccount, { replacements: replacementUserAccount, type: QueryTypes.UPDATE });
                }

                if (_mod_admin_document) {
                    const tmpModAdmDocUp = await entityDataModule.modified_user_acc_document_uploaded(_modify_id);
                    for (let ki = 0; tmpModAdmDocUp && ki < tmpModAdmDocUp.length; ki++) {
                        if (tmpModAdmDocUp[ki].to_delete) {
                            const _queryAdmDocDel = `UPDATE user_acc_doc_upload SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE user_id = ? AND document_id = ? AND is_deleted = false`;
                            await db.sequelize.query(_queryAdmDocDel, { replacements: [modData.account_id, new Date(), modData.user_id, tmpModAdmDocUp[ki].document_id], type: QueryTypes.UPDATE });
                        } else {
                            var movedGcpPath = tmpModAdmDocUp[ki].file_path; var movedGcpResp = tmpModAdmDocUp[ki].gcp_resp;
                            const _newGcpPath = 'entity/' + modData.reg_id.toString() + '/' + tmpModAdmDocUp[ki].new_name;
                            try {
                                const moveRsp = await cloudStorageModule.CopyFile(tmpModAdmDocUp[ki].file_path, _newGcpPath);
                                movedGcpPath = _newGcpPath; movedGcpResp = JSON.stringify(moveRsp);
                            } catch (_) {

                            }
                            const _queryAdmDocSel = `SELECT doc_file_id FROM user_acc_doc_upload WHERE user_id = ? AND document_id = ? AND is_deleted = false`;
                            const rowAdmDocSel = await db.sequelize.query(_queryAdmDocSel, { replacements: [modData.user_id, tmpModAdmDocUp[ki].document_id], type: QueryTypes.SELECT });
                            if (rowAdmDocSel && rowAdmDocSel.length > 0) {
                                const _queryAdmDocUp = `UPDATE user_acc_doc_upload SET original_file_name = ?, new_file_name = ?, gcp_file_path = ?, gcp_response_data = ?,
                                cloud_file_stored = ?, modify_by = ?, modify_date = ? WHERE doc_file_id = ?`;
                                await db.sequelize.query(_queryAdmDocUp, {
                                    replacements: [tmpModAdmDocUp[ki].file_name, tmpModAdmDocUp[ki].new_name, movedGcpPath,
                                        movedGcpResp, true, modData.account_id, new Date(), rowAdmDocSel[0].doc_file_id], type: QueryTypes.UPDATE
                                });
                            } else {
                                const _queryAdmDocIn = `INSERT INTO user_acc_doc_upload(user_id, document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data, 
                                    cloud_file_stored, uploaded_by, uploaded_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                                await db.sequelize.query(_queryAdmDocIn, {
                                    replacements: [modData.user_id, tmpModAdmDocUp[ki].document_id, tmpModAdmDocUp[ki].file_name, tmpModAdmDocUp[ki].new_name, movedGcpPath,
                                        movedGcpResp, true, modData.account_id, new Date()], type: QueryTypes.INSERT
                                });
                            }
                        }
                    }
                }

                if (_mod_board_member) {
                    const _modBoardMems = await entityDataModule.modified_board_members(_modify_id); var tempBoardMemIds = [];
                    for (let aq = 0; _modBoardMems && aq < _modBoardMems.length; aq++) {
                        const eleBoardMem = _modBoardMems[aq];
                        const _memberId = eleBoardMem.member_id && validator.isNumeric(eleBoardMem.member_id.toString()) ? BigInt(eleBoardMem.member_id) : 0;
                        if (_memberId > 0) {
                            const _queryBoardMemUp = `UPDATE user_board_member SET full_name = ?, designation = ?, email_id = ?, mobile_ccc = ?, mobile_no = ?, modify_by = ?, modify_date = ? WHERE member_id = ?`;
                            const _repBoardMemUp = [eleBoardMem.full_name, eleBoardMem.designation, eleBoardMem.email_id, eleBoardMem.mobile_ccc, eleBoardMem.mobile_no, modData.account_id, new Date(), _memberId];
                            await db.sequelize.query(_queryBoardMemUp, { replacements: _repBoardMemUp, type: QueryTypes.UPDATE });
                            tempBoardMemIds.push(_memberId);
                        } else {
                            const _queryBoardMemIn = `INSERT INTO user_board_member(reg_id, full_name, designation, email_id, mobile_ccc, mobile_no, added_by, added_date)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING "member_id"`;
                            const _repBoardMemIn = [modData.reg_id, eleBoardMem.full_name, eleBoardMem.designation, eleBoardMem.email_id, eleBoardMem.mobile_ccc, eleBoardMem.mobile_no, modData.account_id, new Date()];
                            const [rowBoardMemIn] = await db.sequelize.query(_queryBoardMemIn, { replacements: _repBoardMemIn, type: QueryTypes.INSERT });
                            const t_member_id = (rowBoardMemIn && rowBoardMemIn.length > 0 && rowBoardMemIn[0] ? rowBoardMemIn[0].member_id : 0);
                            if (t_member_id > 0) {
                                tempBoardMemIds.push(t_member_id);
                            }
                        }
                    }
                    if (tempBoardMemIds.length > 0) {
                        const _queryBoardMemDel = `UPDATE user_board_member SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false AND member_id NOT IN (?)`;
                        await db.sequelize.query(_queryBoardMemDel, { replacements: [modData.account_id, new Date(), modData.reg_id, tempBoardMemIds], type: QueryTypes.UPDATE });
                    } else {
                        const _queryBoardMemDelAll = `UPDATE user_board_member SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false`;
                        await db.sequelize.query(_queryBoardMemDelAll, { replacements: [modData.account_id, new Date(), modData.reg_id], type: QueryTypes.UPDATE });
                    }
                }

                if (_mod_csr_company) {
                    const tmpModCsrDocUp = await entityDataModule.modified_csr_docs_document_uploaded(_modify_id);
                    for (let ki = 0; tmpModCsrDocUp && ki < tmpModCsrDocUp.length; ki++) {
                        if (tmpModCsrDocUp[ki].to_delete) {
                            const _queryCsrDocDel = `UPDATE user_csr_policy_docs SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND document_id = ? AND is_deleted = false`;
                            await db.sequelize.query(_queryCsrDocDel, { replacements: [modData.account_id, new Date(), modData.reg_id, tmpModCsrDocUp[ki].document_id], type: QueryTypes.UPDATE });
                        } else {
                            var movedGcpPath = tmpModCsrDocUp[ki].file_path; var movedGcpResp = tmpModCsrDocUp[ki].gcp_resp;
                            const _newGcpPath = 'entity/' + modData.reg_id.toString() + '/' + tmpModCsrDocUp[ki].new_name;
                            try {
                                const moveRsp = await cloudStorageModule.CopyFile(tmpModCsrDocUp[ki].file_path, _newGcpPath);
                                movedGcpPath = _newGcpPath; movedGcpResp = JSON.stringify(moveRsp);
                            } catch (_) {

                            }
                            const _queryCsrDocSel = `SELECT doc_file_id FROM user_csr_policy_docs WHERE reg_id = ? AND document_id = ? AND is_deleted = false`;
                            const rowCsrDocSel = await db.sequelize.query(_queryCsrDocSel, { replacements: [modData.reg_id, tmpModCsrDocUp[ki].document_id], type: QueryTypes.SELECT });
                            if (rowCsrDocSel && rowCsrDocSel.length > 0) {
                                const _queryCsrDocUp = `UPDATE user_csr_policy_docs SET original_file_name = ?, new_file_name = ?, gcp_file_path = ?, gcp_response_data = ?,
                                cloud_file_stored = ?, modify_by = ?, modify_date = ? WHERE doc_file_id = ?`;
                                await db.sequelize.query(_queryCsrDocUp, {
                                    replacements: [tmpModCsrDocUp[ki].file_name, tmpModCsrDocUp[ki].new_name, movedGcpPath,
                                        movedGcpResp, true, modData.account_id, new Date(), rowCsrDocSel[0].doc_file_id], type: QueryTypes.UPDATE
                                });
                            } else {
                                const _queryCsrDocIn = `INSERT INTO user_csr_policy_docs(reg_id, document_id, original_file_name, new_file_name, gcp_file_path, gcp_response_data, 
                                    cloud_file_stored, uploaded_by, uploaded_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                                await db.sequelize.query(_queryCsrDocIn, {
                                    replacements: [modData.reg_id, tmpModCsrDocUp[ki].document_id, tmpModCsrDocUp[ki].file_name, tmpModCsrDocUp[ki].new_name, movedGcpPath,
                                        movedGcpResp, true, modData.account_id, new Date()], type: QueryTypes.INSERT
                                });
                            }
                        }
                    }
                }

                if (_mod_csr_committee) {
                    const _modCsrMems = await entityDataModule.modified_csr_committee_members(_modify_id); var tempCsrMemIds = [];
                    for (let aq = 0; _modCsrMems && aq < _modCsrMems.length; aq++) {
                        const eleCsrMem = _modCsrMems[aq];
                        const _memberId = eleCsrMem.member_id && validator.isNumeric(eleCsrMem.member_id.toString()) ? BigInt(eleCsrMem.member_id) : 0;
                        if (_memberId > 0) {
                            const _queryCsrMemUp = `UPDATE user_csr_member SET full_name = ?, designation = ?, email_id = ?, mobile_ccc = ?, mobile_no = ?, modify_by = ?, modify_date = ? WHERE member_id = ?`;
                            const _repCsrMemUp = [eleCsrMem.full_name, eleCsrMem.designation, eleCsrMem.email_id, eleCsrMem.mobile_ccc, eleCsrMem.mobile_no, modData.account_id, new Date(), _memberId];
                            await db.sequelize.query(_queryCsrMemUp, { replacements: _repCsrMemUp, type: QueryTypes.UPDATE });
                            tempCsrMemIds.push(_memberId);
                        } else {
                            const _queryCsrMemIn = `INSERT INTO user_csr_member(reg_id, full_name, designation, email_id, mobile_ccc, mobile_no, added_by, added_date)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING "member_id"`;
                            const _repCsrMemIn = [modData.reg_id, eleCsrMem.full_name, eleCsrMem.designation, eleCsrMem.email_id, eleCsrMem.mobile_ccc, eleCsrMem.mobile_no, modData.account_id, new Date()];
                            const [rowCsrMemIn] = await db.sequelize.query(_queryCsrMemIn, { replacements: _repCsrMemIn, type: QueryTypes.INSERT });
                            const t_member_id = (rowCsrMemIn && rowCsrMemIn.length > 0 && rowCsrMemIn[0] ? rowCsrMemIn[0].member_id : 0);
                            if (t_member_id > 0) {
                                tempCsrMemIds.push(t_member_id);
                            }
                        }
                    }
                    if (tempCsrMemIds.length > 0) {
                        const _queryCsrMemDel = `UPDATE user_csr_member SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false AND member_id NOT IN (?)`;
                        await db.sequelize.query(_queryCsrMemDel, { replacements: [modData.account_id, new Date(), modData.reg_id, tempCsrMemIds], type: QueryTypes.UPDATE });
                    } else {
                        const _queryCsrMemDelAll = `UPDATE user_csr_member SET is_deleted = true, deleted_by = ?, deleted_date = ? WHERE reg_id = ? AND is_deleted = false`;
                        await db.sequelize.query(_queryCsrMemDelAll, { replacements: [modData.account_id, new Date(), modData.reg_id], type: QueryTypes.UPDATE });
                    }
                }

                /*------------------------------------------------------------------------------------*/

                const _queryMis2 = `UPDATE modify_master SET request_status = 1, approved_by = ?, approved_date = ?, approve_remark = ? WHERE modify_id = ?`;
                const _replacementsMis2 = [req.token_data.account_id, new Date(), _remark, _modify_id];
                const [, mIs] = await db.sequelize.query(_queryMis2, { replacements: _replacementsMis2, type: QueryTypes.UPDATE });
                if (mIs > 0) {
                    return res.status(200).json(success(true, res.statusCode, "Approved successfully.", null));
                } else {
                    return res.status(200).json(success(false, res.statusCode, "Unable to update status, Please try again", null));
                }
            } else {
                return res.status(200).json(success(false, res.statusCode, 'Unable to update profile, Please try again.', null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, 'Entity profile change request not found, Please try again.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_change_request_reject = async (req, res, next) => {
    const { modify_id, remark } = req.body;
    try {
        const _modify_id = modify_id && validator.isNumeric(modify_id.toString()) ? BigInt(modify_id) : 0;
        const _remark = (remark && remark.length > 0) ? remark.trim() : "";

        const _queryModDataMst = `SELECT mm.request_status FROM modify_master mm WHERE mm.modify_id = ?`;
        const rowModDataMst = await db.sequelize.query(_queryModDataMst, { replacements: [_modify_id], type: QueryTypes.SELECT });
        if (rowModDataMst && rowModDataMst.length > 0) {
            const _request_status = rowModDataMst[0].request_status && validator.isNumeric(rowModDataMst[0].request_status.toString()) ? parseInt(rowModDataMst[0].request_status) : 0;
            if (_request_status != 0) {
                return res.status(200).json(success(false, res.statusCode, "Entity profile change request is already " + (_request_status == 1 ? "Approved" : "Rejected") + ".", null));
            }
            if (_remark.length <= 0) {
                return res.status(200).json(success(false, res.statusCode, "Please enter remark to reject profile change request.", null));
            }

            const _query2 = `UPDATE modify_master SET request_status = 2, rejected_by = ?, rejected_date = ?, reject_remark = ? WHERE modify_id = ?`;
            const _replacements2 = [req.token_data.account_id, new Date(), _remark, _modify_id];
            const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
            if (i > 0) {
                return res.status(200).json(success(true, res.statusCode, "Rejected successfully.", null));
            } else {
                return res.status(200).json(success(false, res.statusCode, "Unable to update status, Please try again", null));
            }
        } else {
            return res.status(200).json(success(false, res.statusCode, 'Entity profile change request not found, Please try again.', null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_enrolment_document_get_url = async (req, res, next) => {
    const { modify_id, file_id, document_id } = req.body;
    try {
        const _modify_id = modify_id && validator.isNumeric(modify_id.toString()) ? BigInt(modify_id) : 0;
        const _file_id = file_id && validator.isNumeric(file_id.toString()) ? BigInt(file_id) : 0;
        const _document_id = document_id && validator.isNumeric(document_id.toString()) ? BigInt(document_id) : 0;

        const resp = await entityDataModule.entity_document_signed_url(_modify_id, _file_id, _document_id);

        return res.status(200).json(success(true, res.statusCode, "", resp));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_admin_account_doc_get_url = async (req, res, next) => {
    const { modify_id, file_id, document_id } = req.body;
    try {
        const _modify_id = modify_id && validator.isNumeric(modify_id.toString()) ? BigInt(modify_id) : 0;
        const _file_id = file_id && validator.isNumeric(file_id.toString()) ? BigInt(file_id) : 0;
        const _document_id = document_id && validator.isNumeric(document_id.toString()) ? BigInt(document_id) : 0;

        const resp = await entityDataModule.user_acc_document_signed_url(_modify_id, _file_id, _document_id);

        return res.status(200).json(success(true, res.statusCode, "", resp));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const entity_csr_policy_doc_get_url = async (req, res, next) => {
    const { modify_id, file_id, document_id } = req.body;
    try {
        const _modify_id = modify_id && validator.isNumeric(modify_id.toString()) ? BigInt(modify_id) : 0;
        const _file_id = file_id && validator.isNumeric(file_id.toString()) ? BigInt(file_id) : 0;
        const _document_id = document_id && validator.isNumeric(document_id.toString()) ? BigInt(document_id) : 0;

        const resp = await entityDataModule.csr_docs_document_signed_url(_modify_id, _file_id, _document_id);

        return res.status(200).json(success(true, res.statusCode, "", resp));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};


module.exports = {
    entity_registration_list,
    entity_registration_details,
    entity_registration_approve,
    entity_registration_reject,
    entity_user_account_toggle,
    entity_user_activation_link,
    entity_change_request_list,
    entity_change_request_details,
    entity_change_request_approve,
    entity_change_request_reject,

    entity_enrolment_document_get_url,
    entity_admin_account_doc_get_url,
    entity_csr_policy_doc_get_url,
};