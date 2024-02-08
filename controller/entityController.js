const entityService = require('../services/home/entityService');
const jwtEntity = require('../middleware/jwtEntity');
const multer = require('multer');
const path = require('path');
const { random_key } = require('../utilities/utils');
const fileTypes = require('../constants/fileTypeList');

module.exports = ({ config }) => {
    const router = config.express.Router();

    const storage = multer.diskStorage({
        destination: function (req, file, cb) { cb(null, 'uploads/'); },
        filename: function (req, file, cb) { cb(null, random_key(10) + Date.now() + path.extname(file.originalname)); },
    });

    function fileFilter(req, file, cb) {
        const allowedExtensions = fileTypes;
        // Check if the file extension is in the allowedExtensions array
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(fileExtension)) {
            cb(null, true); // Accept the file
        } else {
            cb(new Error('Invalid file extension.'), false); // Reject the file
        }
    }

    const upload = multer({ storage: storage, fileFilter: fileFilter, });

    router.post('/entity/countries', jwtEntity, async (req, res, next) => {
        return entityService.countries(req, res, next);
    });
    router.post('/entity/states', jwtEntity, async (req, res, next) => {
        return entityService.states(req, res, next);
    });
    router.post('/entity/districts', jwtEntity, async (req, res, next) => {
        return entityService.districts(req, res, next);
    });
    router.post('/entity/blocks', jwtEntity, async (req, res, next) => {
        return entityService.blocks(req, res, next);
    });
    router.post('/entity/ifsc_code_search', jwtEntity, async (req, res, next) => {
        return entityService.ifsc_code_search(req, res, next);
    });
    router.post('/entity/check_ifsc_code', jwtEntity, async (req, res, next) => {
        return entityService.check_ifsc_code(req, res, next);
    });

    router.post('/entity/logout', jwtEntity, async (req, res, next) => {
        return entityService.logout(req, res, next);
    });
    router.post('/entity/dashboard', jwtEntity, async (req, res, next) => {
        return entityService.dashboard(req, res, next);
    });
    router.post('/entity/password', jwtEntity, async (req, res, next) => {
        return entityService.password(req, res, next);
    });
    router.post('/entity/profile_data', jwtEntity, async (req, res, next) => {
        return entityService.profile_data(req, res, next);
    });
    router.post('/entity/search_parent_entity', jwtEntity, async (req, res, next) => {
        return entityService.search_parent_entity(req, res, next);
    });
    router.post('/entity/validate_initiator', jwtEntity, async (req, res, next) => {
        return entityService.validate_initiator(req, res, next);
    });
    router.post('/entity/validate_company', jwtEntity, async (req, res, next) => {
        return entityService.validate_company(req, res, next);
    });
    router.post('/entity/validate_enrolment', jwtEntity, async (req, res, next) => {
        return entityService.validate_enrolment(req, res, next);
    });
    router.post('/entity/validate_admin', jwtEntity, async (req, res, next) => {
        return entityService.validate_admin(req, res, next);
    });
    router.post('/entity/validate_board_member', jwtEntity, async (req, res, next) => {
        return entityService.validate_board_member(req, res, next);
    });
    router.post('/entity/validate_csr_committee', jwtEntity, async (req, res, next) => {
        return entityService.validate_csr_committee(req, res, next);
    });
    router.post('/entity/profile_update', upload.any(), jwtEntity, async (req, res, next) => {
        return entityService.profile_update(req, res, next);
    });
    router.post('/entity/profile_request_cancel', jwtEntity, async (req, res, next) => {
        return entityService.profile_request_cancel(req, res, next);
    });
    router.post('/entity/enrolment_document_get_url', jwtEntity, async (req, res, next) => {
        return entityService.enrolment_document_get_url(req, res, next);
    });
    router.post('/entity/admin_account_doc_get_url', jwtEntity, async (req, res, next) => {
        return entityService.admin_account_doc_get_url(req, res, next);
    });
    router.post('/entity/csr_policy_doc_get_url', jwtEntity, async (req, res, next) => {
        return entityService.csr_policy_doc_get_url(req, res, next);
    });
    router.post('/entity/search_corporate', jwtEntity, async (req, res, next) => {
        return entityService.search_corporate(req, res, next);
    });
    router.post('/entity/search_foundation', jwtEntity, async (req, res, next) => {
        return entityService.search_foundation(req, res, next);
    });
    router.post('/entity/search_philanthropist', jwtEntity, async (req, res, next) => {
        return entityService.search_philanthropist(req, res, next);
    });
    router.post('/entity/search_implementing_agency', jwtEntity, async (req, res, next) => {
        return entityService.search_implementing_agency(req, res, next);
    });
    router.post('/entity/search_accreditation_agency', jwtEntity, async (req, res, next) => {
        return entityService.search_accreditation_agency(req, res, next);
    });
    router.post('/entity/search_vendor', jwtEntity, async (req, res, next) => {
        return entityService.search_vendor(req, res, next);
    });
    router.post('/entity/search_consultant', jwtEntity, async (req, res, next) => {
        return entityService.search_consultant(req, res, next);
    });
    router.post('/entity/view_profile', jwtEntity, async (req, res, next) => {
        return entityService.view_profile(req, res, next);
    });
    /***********************************************************/
    router.post('/entity/project_create_form_data', jwtEntity, async (req, res, next) => {
        return entityService.project_create_form_data(req, res, next);
    });
    router.post('/entity/project_create_search_ia', jwtEntity, async (req, res, next) => {
        return entityService.project_create_search_ia(req, res, next);
    });
    router.post('/entity/project_create_save_details', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.project_create_save_details(req, res, next);
    });
    router.post('/entity/project_create_save_milestones', jwtEntity, async (req, res, next) => {
        return entityService.project_create_save_milestones(req, res, next);
    });
    router.post('/entity/project_create_save_questionnaire', jwtEntity, async (req, res, next) => {
        return entityService.project_create_save_questionnaire(req, res, next);
    });
    router.post('/entity/project_create_save_rfp_details', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.project_create_save_rfp_details(req, res, next);
    });
    router.post('/entity/project_float_for_discovery', jwtEntity, async (req, res, next) => {
        return entityService.project_float_for_discovery(req, res, next);
    });
    router.post('/entity/project_created_list', jwtEntity, async (req, res, next) => {
        return entityService.project_created_list(req, res, next);
    });
    router.post('/entity/project_created_delete', jwtEntity, async (req, res, next) => {
        return entityService.project_created_delete(req, res, next);
    });
    router.post('/entity/project_ia_selection_floated_list', jwtEntity, async (req, res, next) => {
        return entityService.project_ia_selection_floated_list(req, res, next);
    });
    router.post('/entity/project_ia_selection_appl_list', jwtEntity, async (req, res, next) => {
        return entityService.project_ia_selection_appl_list(req, res, next);
    });
    router.post('/entity/project_ia_selection_appl_view', jwtEntity, async (req, res, next) => {
        return entityService.project_ia_selection_appl_view(req, res, next);
    });
    router.post('/entity/project_ia_selection_appl_reject', jwtEntity, async (req, res, next) => {
        return entityService.project_ia_selection_appl_reject(req, res, next);
    });
    router.post('/entity/project_ia_selection_appl_award', jwtEntity, async (req, res, next) => {
        return entityService.project_ia_selection_appl_award(req, res, next);
    });
    router.post('/entity/project_crowd_funding_view_list', jwtEntity, async (req, res, next) => {
        return entityService.project_crowd_funding_view_list(req, res, next);
    });
    router.post('/entity/project_crowd_funding_view_details', jwtEntity, async (req, res, next) => {
        return entityService.project_crowd_funding_view_details(req, res, next);
    });
    router.post('/entity/project_fund_transfer_agency_list', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_agency_list(req, res, next);
    });
    router.post('/entity/project_fund_transfer_agency_projects', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_agency_projects(req, res, next);
    });
    router.post('/entity/project_fund_transfer_int_milestone_list', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_int_milestone_list(req, res, next);
    });
    router.post('/entity/project_fund_transfer_int_milestone_payments', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_int_milestone_payments(req, res, next);
    });
    router.post('/entity/project_fund_transfer_int_milestone_pay_get', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_int_milestone_pay_get(req, res, next);
    });
    router.post('/entity/project_fund_transfer_int_milestone_pay_chk', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_int_milestone_pay_chk(req, res, next);
    });
    router.post('/entity/project_fund_transfer_ext_payments', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_ext_payments(req, res, next);
    });
    router.post('/entity/project_fund_transfer_ext_pay_get', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_ext_pay_get(req, res, next);
    });
    router.post('/entity/project_fund_transfer_ext_pay_chk', jwtEntity, async (req, res, next) => {
        return entityService.project_fund_transfer_ext_pay_chk(req, res, next);
    });
    router.post('/entity/project_proposal_doc_get_url', jwtEntity, async (req, res, next) => {
        return entityService.project_proposal_doc_get_url(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_project_list', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_looking_ia_project_list(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_project_view', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_looking_ia_project_view(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_milestone_list', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_looking_ia_milestone_list(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_milestone_view', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_looking_ia_milestone_view(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_milestone_save', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.monitoring_looking_ia_milestone_save(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_milestone_send', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.monitoring_looking_ia_milestone_send(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_milestone_doc_get_url', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_looking_ia_milestone_doc_get_url(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_milestone_reject', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_looking_ia_milestone_reject(req, res, next);
    });
    router.post('/entity/monitoring_looking_ia_milestone_accept', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_looking_ia_milestone_accept(req, res, next);
    });
    router.post('/entity/monitoring_crowd_fund_project_list', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_crowd_fund_project_list(req, res, next);
    });
    router.post('/entity/monitoring_crowd_fund_project_view', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_crowd_fund_project_view(req, res, next);
    });
    router.post('/entity/monitoring_crowd_fund_milestone_list', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_crowd_fund_milestone_list(req, res, next);
    });
    router.post('/entity/monitoring_crowd_fund_milestone_view', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_crowd_fund_milestone_view(req, res, next);
    });
    router.post('/entity/monitoring_crowd_fund_milestone_save', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.monitoring_crowd_fund_milestone_save(req, res, next);
    });
    router.post('/entity/monitoring_crowd_fund_milestone_send', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.monitoring_crowd_fund_milestone_send(req, res, next);
    });
    router.post('/entity/monitoring_crowd_fund_milestone_doc_get_url', jwtEntity, async (req, res, next) => {
        return entityService.monitoring_crowd_fund_milestone_doc_get_url(req, res, next);
    });





    router.post('/entity/project_discovery_thematic_areas', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_thematic_areas(req, res, next);
    });
    router.post('/entity/project_discovery_search', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_search(req, res, next);
    });
    router.post('/entity/project_discovery_detail', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_detail(req, res, next);
    });
    router.post('/entity/project_rfp_document_get_url', jwtEntity, async (req, res, next) => {
        return entityService.project_rfp_document_get_url(req, res, next);
    });
    router.post('/entity/project_discovery_apply_check', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_apply_check(req, res, next);
    });
    router.post('/entity/project_discovery_apply_submit', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.project_discovery_apply_submit(req, res, next);
    });
    router.post('/entity/project_discovery_apply_list', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_apply_list(req, res, next);
    });
    router.post('/entity/project_discovery_apply_view', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_apply_view(req, res, next);
    });
    router.post('/entity/project_discovery_apply_reject', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_apply_reject(req, res, next);
    });
    router.post('/entity/project_discovery_apply_accept', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_apply_accept(req, res, next);
    });
    router.post('/entity/project_discovery_donate_payments', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_donate_payments(req, res, next);
    });
    router.post('/entity/project_discovery_donate_pay_get', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_donate_pay_get(req, res, next);
    });
    router.post('/entity/project_discovery_donate_pay_chk', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_donate_pay_chk(req, res, next);
    });
    router.post('/entity/project_discovery_donate_history', jwtEntity, async (req, res, next) => {
        return entityService.project_discovery_donate_history(req, res, next);
    });
    router.post('/entity/discovery_monitoring_project_list', jwtEntity, async (req, res, next) => {
        return entityService.discovery_monitoring_project_list(req, res, next);
    });
    router.post('/entity/discovery_monitoring_project_view', jwtEntity, async (req, res, next) => {
        return entityService.discovery_monitoring_project_view(req, res, next);
    });
    router.post('/entity/discovery_monitoring_milestone_list', jwtEntity, async (req, res, next) => {
        return entityService.discovery_monitoring_milestone_list(req, res, next);
    });
    router.post('/entity/discovery_monitoring_milestone_view', jwtEntity, async (req, res, next) => {
        return entityService.discovery_monitoring_milestone_view(req, res, next);
    });
    router.post('/entity/discovery_monitoring_milestone_doc_get_url', jwtEntity, async (req, res, next) => {
        return entityService.discovery_monitoring_milestone_doc_get_url(req, res, next);
    });
    /***********************************************************/
    router.post('/entity/accreditation_initiate_search', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_initiate_search(req, res, next);
    });
    router.post('/entity/accreditation_req_initiate', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_req_initiate(req, res, next);
    });
    router.post('/entity/accreditation_req_submit', jwtEntity, upload.any(), async (req, res, next) => {
        return entityService.accreditation_req_submit(req, res, next);
    });
    router.post('/entity/accreditation_request_list', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_request_list(req, res, next);
    });
    router.post('/entity/accreditation_request_search', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_request_search(req, res, next);
    });
    router.post('/entity/accreditation_request_detail', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_request_detail(req, res, next);
    });
    router.post('/entity/accreditation_req_doc_get_url', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_req_doc_get_url(req, res, next);
    });
    router.post('/entity/accreditation_request_approve', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_request_approve(req, res, next);
    });
    router.post('/entity/accreditation_request_reject', jwtEntity, async (req, res, next) => {
        return entityService.accreditation_request_reject(req, res, next);
    });
    /***********************************************************/
    router.post('/entity/uam_role_created', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_created(req, res, next);
    });
    router.post('/entity/uam_role_form_data', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_form_data(req, res, next);
    });
    router.post('/entity/uam_role_create_new', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_create_new(req, res, next);
    });
    router.post('/entity/uam_role_edit_data', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_edit_data(req, res, next);
    });
    router.post('/entity/uam_role_update', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_update(req, res, next);
    });
    router.post('/entity/uam_role_delete', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_delete(req, res, next);
    });
    router.post('/entity/uam_role_toggle', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_toggle(req, res, next);
    });
    router.post('/entity/uam_role_pending', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_pending(req, res, next);
    });
    router.post('/entity/uam_role_view', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_view(req, res, next);
    });
    router.post('/entity/uam_role_approve', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_approve(req, res, next);
    });
    router.post('/entity/uam_role_reject', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_reject(req, res, next);
    });
    router.post('/entity/uam_role_dropdown', jwtEntity, async (req, res, next) => {
        return entityService.uam_role_dropdown(req, res, next);
    });
    router.post('/entity/uam_user_created', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_created(req, res, next);
    });
    router.post('/entity/uam_user_form_data', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_form_data(req, res, next);
    });
    router.post('/entity/uam_user_create_new', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_create_new(req, res, next);
    });
    router.post('/entity/uam_user_edit_data', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_edit_data(req, res, next);
    });
    router.post('/entity/uam_user_update', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_update(req, res, next);
    });
    router.post('/entity/uam_user_delete', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_delete(req, res, next);
    });
    router.post('/entity/uam_user_toggle', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_toggle(req, res, next);
    });
    router.post('/entity/uam_user_pending', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_pending(req, res, next);
    });
    router.post('/entity/uam_user_view', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_view(req, res, next);
    });
    router.post('/entity/uam_user_approve', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_approve(req, res, next);
    });
    router.post('/entity/uam_user_reject', jwtEntity, async (req, res, next) => {
        return entityService.uam_user_reject(req, res, next);
    });

    /***********************************************************/

    return router;
};