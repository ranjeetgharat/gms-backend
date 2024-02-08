const _logger = require('../logger/winston').logger;
const db = require('../database/postgresql_db');
const { QueryTypes } = require('sequelize');
const adminService = require('../services/admin/adminService');
const languageService = require('../services/admin/languageService');
const entityTypeService = require('../services/admin/entityTypeService');
const designationService = require('../services/admin/designationService');
const documentService = require('../services/admin/documentService');
const expertiseAreaService = require('../services/admin/expertiseAreaService');
const parentOrgsService = require('../services/admin/parentOrgsService');
const userAccDocService = require('../services/admin/userAccDocService');
const csrPolicyDocsService = require('../services/admin/csrPolicyDocsService');
const rfpDocService = require('../services/admin/rfpDocService');
const projectFieldsService = require('../services/admin/projectFieldsService');
const projectChargesService = require('../services/admin/projectChargesService');
const accreditationDocService = require('../services/admin/accreditationDocService');
const accreditationLevelService = require('../services/admin/accreditationLevelService');
const accreditationQuesService = require('../services/admin/accreditationQuesService');
const entityRegTypeService = require('../services/admin/entityRegTypeService');
const adminUsersService = require('../services/admin/adminUsersService');
const rolesService = require('../services/admin/rolesService');
const countriesService = require('../services/admin/countriesService');
const statesService = require('../services/admin/statesService');
const districtsService = require('../services/admin/districtsService');
const blocksService = require('../services/admin/blocksService');
const termConditionService = require('../services/admin/termConditionService');
const bankMastService = require('../services/admin/bankMastService');
const bankBranchService = require('../services/admin/bankBranchService');
const templateService = require('../services/admin/templateService');
const userMasterService = require('../services/admin/userMasterService');
const servicesService = require('../services/admin/servicesService');
const projectService = require('../services/admin/projectService');
const jwtAdmin = require('../middleware/jwtAdmin');

module.exports = ({ config }) => {
    const router = config.express.Router();

    router.post('/admin/login', (req, res, next) => {
        return adminService.login(req, res, next);
    });
    router.post('/admin/refresh_token', (req, res, next) => {
        return adminService.refresh_token(req, res, next);
    });
    router.post('/admin/logout', jwtAdmin, (req, res, next) => {
        return adminService.logout(req, res, next);
    });
    router.post('/admin/reset_pass_request', (req, res, next) => {
        return adminService.reset_pass_request(req, res, next);
    });
    router.post('/admin/reset_pass_check', (req, res, next) => {
        return adminService.reset_pass_check(req, res, next);
    });
    router.post('/admin/reset_pass_update', (req, res, next) => {
        return adminService.reset_pass_update(req, res, next);
    });
    router.post('/admin/new_pass_check', (req, res, next) => {
        return adminService.new_pass_check(req, res, next);
    });
    router.post('/admin/new_pass_update', (req, res, next) => {
        return adminService.new_pass_update(req, res, next);
    });
    router.post('/admin/dashboard', jwtAdmin, (req, res, next) => {
        return adminService.dashboard(req, res, next);
    });
    router.post('/admin/change_password', jwtAdmin, (req, res, next) => {
        return adminService.change_password(req, res, next);
    });
    /************ LOCALES LANGUAGE *****************/
    router.post('/admin/language_locales_get', jwtAdmin, (req, res, next) => {
        return languageService.language_locales_get(req, res, next);
    });
    router.post('/admin/language_locales_set', jwtAdmin, (req, res, next) => {
        return languageService.language_locales_set(req, res, next);
    });
    /************ ENTITY TYPES *****************/
    router.post('/admin/entity_type_list', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_type_list(req, res, next);
    });
    router.post('/admin/entity_type_reg_toggle', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_type_reg_toggle(req, res, next);
    });
    router.post('/admin/entity_type_dropdown', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_type_dropdown(req, res, next);
    });
    router.post('/admin/entity_type_manage_view', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_type_manage_view(req, res, next);
    });
    router.post('/admin/entity_prerequisite_update', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_prerequisite_update(req, res, next);
    });
    router.post('/admin/entity_prerequisite_toggle', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_prerequisite_toggle(req, res, next);
    });
    router.post('/admin/entity_platform_fee_update', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_platform_fee_update(req, res, next);
    });
    router.post('/admin/entity_platform_fee_toggle', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_platform_fee_toggle(req, res, next);
    });
    router.post('/admin/entity_type_auto_approve_toggle', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_type_auto_approve_toggle(req, res, next);
    });
    router.post('/admin/entity_registration_form_update', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_registration_form_update(req, res, next);
    });
    router.post('/admin/entity_permission_list', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_permission_list(req, res, next);
    });
    router.post('/admin/entity_permission_update', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_permission_update(req, res, next);
    });
    router.post('/admin/entity_dynamic_field_item_search', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_dynamic_field_item_search(req, res, next);
    });
    router.post('/admin/entity_dynamic_field_item_form_data', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_dynamic_field_item_form_data(req, res, next);
    });
    router.post('/admin/entity_dynamic_field_item_add_new', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_dynamic_field_item_add_new(req, res, next);
    });
    router.post('/admin/entity_dynamic_field_item_edit_data', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_dynamic_field_item_edit_data(req, res, next);
    });
    router.post('/admin/entity_dynamic_field_item_update', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_dynamic_field_item_update(req, res, next);
    });
    router.post('/admin/entity_dynamic_field_item_toggle', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_dynamic_field_item_toggle(req, res, next);
    });
    router.post('/admin/entity_dynamic_field_item_delete', jwtAdmin, (req, res, next) => {
        return entityTypeService.entity_dynamic_field_item_delete(req, res, next);
    });
    /************ DESIGNATION *****************/
    router.post('/admin/designation_list', jwtAdmin, (req, res, next) => {
        return designationService.designation_list(req, res, next);
    });
    router.post('/admin/designation_get', jwtAdmin, (req, res, next) => {
        return designationService.designation_get(req, res, next);
    });
    router.post('/admin/designation_new', jwtAdmin, (req, res, next) => {
        return designationService.designation_new(req, res, next);
    });
    router.post('/admin/designation_update', jwtAdmin, (req, res, next) => {
        return designationService.designation_update(req, res, next);
    });
    router.post('/admin/designation_toggle', jwtAdmin, (req, res, next) => {
        return designationService.designation_toggle(req, res, next);
    });
    router.post('/admin/designation_delete', jwtAdmin, (req, res, next) => {
        return designationService.designation_delete(req, res, next);
    });
    /************ DOCUMENTS *****************/
    router.post('/admin/document_list', jwtAdmin, (req, res, next) => {
        return documentService.document_list(req, res, next);
    });
    router.post('/admin/document_get', jwtAdmin, (req, res, next) => {
        return documentService.document_get(req, res, next);
    });
    router.post('/admin/document_new', jwtAdmin, (req, res, next) => {
        return documentService.document_new(req, res, next);
    });
    router.post('/admin/document_update', jwtAdmin, (req, res, next) => {
        return documentService.document_update(req, res, next);
    });
    router.post('/admin/document_toggle', jwtAdmin, (req, res, next) => {
        return documentService.document_toggle(req, res, next);
    });
    router.post('/admin/document_delete', jwtAdmin, (req, res, next) => {
        return documentService.document_delete(req, res, next);
    });
    /************ USER ACC DOCUMENTS *****************/
    router.post('/admin/user_acc_doc_mst_list', jwtAdmin, (req, res, next) => {
        return userAccDocService.user_acc_doc_mst_list(req, res, next);
    });
    router.post('/admin/user_acc_doc_mst_get', jwtAdmin, (req, res, next) => {
        return userAccDocService.user_acc_doc_mst_get(req, res, next);
    });
    router.post('/admin/user_acc_doc_mst_new', jwtAdmin, (req, res, next) => {
        return userAccDocService.user_acc_doc_mst_new(req, res, next);
    });
    router.post('/admin/user_acc_doc_mst_update', jwtAdmin, (req, res, next) => {
        return userAccDocService.user_acc_doc_mst_update(req, res, next);
    });
    router.post('/admin/user_acc_doc_mst_toggle', jwtAdmin, (req, res, next) => {
        return userAccDocService.user_acc_doc_mst_toggle(req, res, next);
    });
    router.post('/admin/user_acc_doc_mst_delete', jwtAdmin, (req, res, next) => {
        return userAccDocService.user_acc_doc_mst_delete(req, res, next);
    });
    /************ CSR POLICY DOCUMENTS *****************/
    router.post('/admin/csr_policy_docs_list', jwtAdmin, (req, res, next) => {
        return csrPolicyDocsService.csr_policy_docs_list(req, res, next);
    });
    router.post('/admin/csr_policy_docs_get', jwtAdmin, (req, res, next) => {
        return csrPolicyDocsService.csr_policy_docs_get(req, res, next);
    });
    router.post('/admin/csr_policy_docs_new', jwtAdmin, (req, res, next) => {
        return csrPolicyDocsService.csr_policy_docs_new(req, res, next);
    });
    router.post('/admin/csr_policy_docs_update', jwtAdmin, (req, res, next) => {
        return csrPolicyDocsService.csr_policy_docs_update(req, res, next);
    });
    router.post('/admin/csr_policy_docs_toggle', jwtAdmin, (req, res, next) => {
        return csrPolicyDocsService.csr_policy_docs_toggle(req, res, next);
    });
    router.post('/admin/csr_policy_docs_delete', jwtAdmin, (req, res, next) => {
        return csrPolicyDocsService.csr_policy_docs_delete(req, res, next);
    });
    /************ PROJECT CONFIGURATION *****************/
    router.post('/admin/rfp_doc_mast_list', jwtAdmin, (req, res, next) => {
        return rfpDocService.rfp_doc_mast_list(req, res, next);
    });
    router.post('/admin/rfp_doc_mast_get', jwtAdmin, (req, res, next) => {
        return rfpDocService.rfp_doc_mast_get(req, res, next);
    });
    router.post('/admin/rfp_doc_mast_new', jwtAdmin, (req, res, next) => {
        return rfpDocService.rfp_doc_mast_new(req, res, next);
    });
    router.post('/admin/rfp_doc_mast_update', jwtAdmin, (req, res, next) => {
        return rfpDocService.rfp_doc_mast_update(req, res, next);
    });
    router.post('/admin/rfp_doc_mast_toggle', jwtAdmin, (req, res, next) => {
        return rfpDocService.rfp_doc_mast_toggle(req, res, next);
    });
    router.post('/admin/rfp_doc_mast_delete', jwtAdmin, (req, res, next) => {
        return rfpDocService.rfp_doc_mast_delete(req, res, next);
    });

    router.post('/admin/project_field_item_search', jwtAdmin, (req, res, next) => {
        return projectFieldsService.project_field_item_search(req, res, next);
    });
    router.post('/admin/project_field_item_form_data', jwtAdmin, (req, res, next) => {
        return projectFieldsService.project_field_item_form_data(req, res, next);
    });
    router.post('/admin/project_field_item_add_new', jwtAdmin, (req, res, next) => {
        return projectFieldsService.project_field_item_add_new(req, res, next);
    });
    router.post('/admin/project_field_item_edit_data', jwtAdmin, (req, res, next) => {
        return projectFieldsService.project_field_item_edit_data(req, res, next);
    });
    router.post('/admin/project_field_item_update', jwtAdmin, (req, res, next) => {
        return projectFieldsService.project_field_item_update(req, res, next);
    });
    router.post('/admin/project_field_item_toggle', jwtAdmin, (req, res, next) => {
        return projectFieldsService.project_field_item_toggle(req, res, next);
    });
    router.post('/admin/project_field_item_delete', jwtAdmin, (req, res, next) => {
        return projectFieldsService.project_field_item_delete(req, res, next);
    });
    router.post('/admin/project_charge_config_list', jwtAdmin, (req, res, next) => {
        return projectChargesService.project_charge_config_list(req, res, next);
    });
    router.post('/admin/project_charge_config_update', jwtAdmin, (req, res, next) => {
        return projectChargesService.project_charge_config_update(req, res, next);
    });
    /************ ACCREDITION LEVELS *****************/
    router.post('/admin/accreditation_level_dropdown', jwtAdmin, (req, res, next) => {
        return accreditationLevelService.accreditation_level_dropdown(req, res, next);
    });
    /************ ACCREDITION QUESTIONS *****************/
    router.post('/admin/accreditation_question_list', jwtAdmin, (req, res, next) => {
        return accreditationQuesService.accreditation_question_list(req, res, next);
    });
    router.post('/admin/accreditation_question_get', jwtAdmin, (req, res, next) => {
        return accreditationQuesService.accreditation_question_get(req, res, next);
    });
    router.post('/admin/accreditation_question_new', jwtAdmin, (req, res, next) => {
        return accreditationQuesService.accreditation_question_new(req, res, next);
    });
    router.post('/admin/accreditation_question_update', jwtAdmin, (req, res, next) => {
        return accreditationQuesService.accreditation_question_update(req, res, next);
    });
    router.post('/admin/accreditation_question_toggle', jwtAdmin, (req, res, next) => {
        return accreditationQuesService.accreditation_question_toggle(req, res, next);
    });
    router.post('/admin/accreditation_question_delete', jwtAdmin, (req, res, next) => {
        return accreditationQuesService.accreditation_question_delete(req, res, next);
    });
    /************ ACCREDITION DOCUMENTS *****************/
    router.post('/admin/accreditation_doc_mast_list', jwtAdmin, (req, res, next) => {
        return accreditationDocService.accreditation_doc_mast_list(req, res, next);
    });
    router.post('/admin/accreditation_doc_mast_get', jwtAdmin, (req, res, next) => {
        return accreditationDocService.accreditation_doc_mast_get(req, res, next);
    });
    router.post('/admin/accreditation_doc_mast_new', jwtAdmin, (req, res, next) => {
        return accreditationDocService.accreditation_doc_mast_new(req, res, next);
    });
    router.post('/admin/accreditation_doc_mast_update', jwtAdmin, (req, res, next) => {
        return accreditationDocService.accreditation_doc_mast_update(req, res, next);
    });
    router.post('/admin/accreditation_doc_mast_toggle', jwtAdmin, (req, res, next) => {
        return accreditationDocService.accreditation_doc_mast_toggle(req, res, next);
    });
    router.post('/admin/accreditation_doc_mast_delete', jwtAdmin, (req, res, next) => {
        return accreditationDocService.accreditation_doc_mast_delete(req, res, next);
    });
    /************ AREA OF EXPERTISE *****************/
    router.post('/admin/expertise_area_list', jwtAdmin, (req, res, next) => {
        return expertiseAreaService.expertise_area_list(req, res, next);
    });
    router.post('/admin/expertise_area_get', jwtAdmin, (req, res, next) => {
        return expertiseAreaService.expertise_area_get(req, res, next);
    });
    router.post('/admin/expertise_area_new', jwtAdmin, (req, res, next) => {
        return expertiseAreaService.expertise_area_new(req, res, next);
    });
    router.post('/admin/expertise_area_update', jwtAdmin, (req, res, next) => {
        return expertiseAreaService.expertise_area_update(req, res, next);
    });
    router.post('/admin/expertise_area_toggle', jwtAdmin, (req, res, next) => {
        return expertiseAreaService.expertise_area_toggle(req, res, next);
    });
    router.post('/admin/expertise_area_delete', jwtAdmin, (req, res, next) => {
        return expertiseAreaService.expertise_area_delete(req, res, next);
    });
    /************ PARENT ORGANIZATION *****************/
    router.post('/admin/parent_orgs_list', jwtAdmin, (req, res, next) => {
        return parentOrgsService.parent_orgs_list(req, res, next);
    });
    router.post('/admin/parent_orgs_get', jwtAdmin, (req, res, next) => {
        return parentOrgsService.parent_orgs_get(req, res, next);
    });
    router.post('/admin/parent_orgs_new', jwtAdmin, (req, res, next) => {
        return parentOrgsService.parent_orgs_new(req, res, next);
    });
    router.post('/admin/parent_orgs_update', jwtAdmin, (req, res, next) => {
        return parentOrgsService.parent_orgs_update(req, res, next);
    });
    router.post('/admin/parent_orgs_toggle', jwtAdmin, (req, res, next) => {
        return parentOrgsService.parent_orgs_toggle(req, res, next);
    });
    router.post('/admin/parent_orgs_delete', jwtAdmin, (req, res, next) => {
        return parentOrgsService.parent_orgs_delete(req, res, next);
    });
    /************ ENTITY REG AS TYPE *****************/
    router.post('/admin/entity_reg_type_list', jwtAdmin, (req, res, next) => {
        return entityRegTypeService.entity_reg_type_list(req, res, next);
    });
    router.post('/admin/entity_reg_type_get', jwtAdmin, (req, res, next) => {
        return entityRegTypeService.entity_reg_type_get(req, res, next);
    });
    router.post('/admin/entity_reg_type_new', jwtAdmin, (req, res, next) => {
        return entityRegTypeService.entity_reg_type_new(req, res, next);
    });
    router.post('/admin/entity_reg_type_update', jwtAdmin, (req, res, next) => {
        return entityRegTypeService.entity_reg_type_update(req, res, next);
    });
    router.post('/admin/entity_reg_type_toggle', jwtAdmin, (req, res, next) => {
        return entityRegTypeService.entity_reg_type_toggle(req, res, next);
    });
    router.post('/admin/entity_reg_type_delete', jwtAdmin, (req, res, next) => {
        return entityRegTypeService.entity_reg_type_delete(req, res, next);
    });
    /************ COUNTRIES *****************/
    router.post('/admin/country_list', jwtAdmin, (req, res, next) => {
        return countriesService.country_list(req, res, next);
    });
    router.post('/admin/country_get', jwtAdmin, (req, res, next) => {
        return countriesService.country_get(req, res, next);
    });
    router.post('/admin/country_new', jwtAdmin, (req, res, next) => {
        return countriesService.country_new(req, res, next);
    });
    router.post('/admin/country_update', jwtAdmin, (req, res, next) => {
        return countriesService.country_update(req, res, next);
    });
    router.post('/admin/country_toggle', jwtAdmin, (req, res, next) => {
        return countriesService.country_toggle(req, res, next);
    });
    router.post('/admin/country_delete', jwtAdmin, (req, res, next) => {
        return countriesService.country_delete(req, res, next);
    });
    router.post('/admin/country_dropdown', jwtAdmin, (req, res, next) => {
        return countriesService.country_dropdown(req, res, next);
    });
    /************ STATES *****************/
    router.post('/admin/state_list', jwtAdmin, (req, res, next) => {
        return statesService.state_list(req, res, next);
    });
    router.post('/admin/state_get', jwtAdmin, (req, res, next) => {
        return statesService.state_get(req, res, next);
    });
    router.post('/admin/state_new', jwtAdmin, (req, res, next) => {
        return statesService.state_new(req, res, next);
    });
    router.post('/admin/state_update', jwtAdmin, (req, res, next) => {
        return statesService.state_update(req, res, next);
    });
    router.post('/admin/state_toggle', jwtAdmin, (req, res, next) => {
        return statesService.state_toggle(req, res, next);
    });
    router.post('/admin/state_delete', jwtAdmin, (req, res, next) => {
        return statesService.state_delete(req, res, next);
    });
    router.post('/admin/state_dropdown', jwtAdmin, (req, res, next) => {
        return statesService.state_dropdown(req, res, next);
    });
    /************ DISTRICTS *****************/
    router.post('/admin/district_list', jwtAdmin, (req, res, next) => {
        return districtsService.district_list(req, res, next);
    });
    router.post('/admin/district_get', jwtAdmin, (req, res, next) => {
        return districtsService.district_get(req, res, next);
    });
    router.post('/admin/district_new', jwtAdmin, (req, res, next) => {
        return districtsService.district_new(req, res, next);
    });
    router.post('/admin/district_update', jwtAdmin, (req, res, next) => {
        return districtsService.district_update(req, res, next);
    });
    router.post('/admin/district_toggle', jwtAdmin, (req, res, next) => {
        return districtsService.district_toggle(req, res, next);
    });
    router.post('/admin/district_delete', jwtAdmin, (req, res, next) => {
        return districtsService.district_delete(req, res, next);
    });
    router.post('/admin/district_dropdown', jwtAdmin, (req, res, next) => {
        return districtsService.district_dropdown(req, res, next);
    });
    /************ BLOCK/TALUKA *****************/
    router.post('/admin/block_list', jwtAdmin, (req, res, next) => {
        return blocksService.block_list(req, res, next);
    });
    router.post('/admin/block_get', jwtAdmin, (req, res, next) => {
        return blocksService.block_get(req, res, next);
    });
    router.post('/admin/block_new', jwtAdmin, (req, res, next) => {
        return blocksService.block_new(req, res, next);
    });
    router.post('/admin/block_update', jwtAdmin, (req, res, next) => {
        return blocksService.block_update(req, res, next);
    });
    router.post('/admin/block_toggle', jwtAdmin, (req, res, next) => {
        return blocksService.block_toggle(req, res, next);
    });
    router.post('/admin/block_delete', jwtAdmin, (req, res, next) => {
        return blocksService.block_delete(req, res, next);
    });
    router.post('/admin/block_dropdown', jwtAdmin, (req, res, next) => {
        return blocksService.block_dropdown(req, res, next);
    });
    /************ SERVICES *****************/
    router.post('/admin/services_head_list', jwtAdmin, (req, res, next) => {
        return servicesService.services_head_list(req, res, next);
    });
    router.post('/admin/services_head_get', jwtAdmin, (req, res, next) => {
        return servicesService.services_head_get(req, res, next);
    });
    router.post('/admin/services_head_new', jwtAdmin, (req, res, next) => {
        return servicesService.services_head_new(req, res, next);
    });
    router.post('/admin/services_head_update', jwtAdmin, (req, res, next) => {
        return servicesService.services_head_update(req, res, next);
    });
    router.post('/admin/services_head_toggle', jwtAdmin, (req, res, next) => {
        return servicesService.services_head_toggle(req, res, next);
    });
    router.post('/admin/services_head_delete', jwtAdmin, (req, res, next) => {
        return servicesService.services_head_delete(req, res, next);
    });
    router.post('/admin/services_head_dropdown', jwtAdmin, (req, res, next) => {
        return servicesService.services_head_dropdown(req, res, next);
    });
    router.post('/admin/services_category_list', jwtAdmin, (req, res, next) => {
        return servicesService.services_category_list(req, res, next);
    });
    router.post('/admin/services_category_get', jwtAdmin, (req, res, next) => {
        return servicesService.services_category_get(req, res, next);
    });
    router.post('/admin/services_category_new', jwtAdmin, (req, res, next) => {
        return servicesService.services_category_new(req, res, next);
    });
    router.post('/admin/services_category_update', jwtAdmin, (req, res, next) => {
        return servicesService.services_category_update(req, res, next);
    });
    router.post('/admin/services_category_toggle', jwtAdmin, (req, res, next) => {
        return servicesService.services_category_toggle(req, res, next);
    });
    router.post('/admin/services_category_delete', jwtAdmin, (req, res, next) => {
        return servicesService.services_category_delete(req, res, next);
    });
    router.post('/admin/services_category_dropdown', jwtAdmin, (req, res, next) => {
        return servicesService.services_category_dropdown(req, res, next);
    });
    router.post('/admin/services_sub_cat_list', jwtAdmin, (req, res, next) => {
        return servicesService.services_sub_cat_list(req, res, next);
    });
    router.post('/admin/services_sub_cat_get', jwtAdmin, (req, res, next) => {
        return servicesService.services_sub_cat_get(req, res, next);
    });
    router.post('/admin/services_sub_cat_new', jwtAdmin, (req, res, next) => {
        return servicesService.services_sub_cat_new(req, res, next);
    });
    router.post('/admin/services_sub_cat_update', jwtAdmin, (req, res, next) => {
        return servicesService.services_sub_cat_update(req, res, next);
    });
    router.post('/admin/services_sub_cat_toggle', jwtAdmin, (req, res, next) => {
        return servicesService.services_sub_cat_toggle(req, res, next);
    });
    router.post('/admin/services_sub_cat_delete', jwtAdmin, (req, res, next) => {
        return servicesService.services_sub_cat_delete(req, res, next);
    });
    /************ TERMS AND CONDITIONS *****************/
    router.post('/admin/term_condition_list', jwtAdmin, (req, res, next) => {
        return termConditionService.term_condition_list(req, res, next);
    });
    router.post('/admin/term_condition_get', jwtAdmin, (req, res, next) => {
        return termConditionService.term_condition_get(req, res, next);
    });
    router.post('/admin/term_condition_new', jwtAdmin, (req, res, next) => {
        return termConditionService.term_condition_new(req, res, next);
    });
    router.post('/admin/term_condition_update', jwtAdmin, (req, res, next) => {
        return termConditionService.term_condition_update(req, res, next);
    });
    router.post('/admin/term_condition_toggle', jwtAdmin, (req, res, next) => {
        return termConditionService.term_condition_toggle(req, res, next);
    });
    router.post('/admin/term_condition_delete', jwtAdmin, (req, res, next) => {
        return termConditionService.term_condition_delete(req, res, next);
    });
    /************ BANK MASTER *****************/
    router.post('/admin/bank_list', jwtAdmin, (req, res, next) => {
        return bankMastService.bank_list(req, res, next);
    });
    router.post('/admin/bank_get', jwtAdmin, (req, res, next) => {
        return bankMastService.bank_get(req, res, next);
    });
    router.post('/admin/bank_new', jwtAdmin, (req, res, next) => {
        return bankMastService.bank_new(req, res, next);
    });
    router.post('/admin/bank_update', jwtAdmin, (req, res, next) => {
        return bankMastService.bank_update(req, res, next);
    });
    router.post('/admin/bank_toggle', jwtAdmin, (req, res, next) => {
        return bankMastService.bank_toggle(req, res, next);
    });
    router.post('/admin/bank_delete', jwtAdmin, (req, res, next) => {
        return bankMastService.bank_delete(req, res, next);
    });
    router.post('/admin/bank_dropdown', jwtAdmin, (req, res, next) => {
        return bankMastService.bank_dropdown(req, res, next);
    });
    router.post('/admin/ifsc_code_list', jwtAdmin, (req, res, next) => {
        return bankBranchService.ifsc_code_list(req, res, next);
    });
    router.post('/admin/ifsc_code_get', jwtAdmin, (req, res, next) => {
        return bankBranchService.ifsc_code_get(req, res, next);
    });
    router.post('/admin/ifsc_code_new', jwtAdmin, (req, res, next) => {
        return bankBranchService.ifsc_code_new(req, res, next);
    });
    router.post('/admin/ifsc_code_update', jwtAdmin, (req, res, next) => {
        return bankBranchService.ifsc_code_update(req, res, next);
    });
    router.post('/admin/ifsc_code_toggle', jwtAdmin, (req, res, next) => {
        return bankBranchService.ifsc_code_toggle(req, res, next);
    });
    router.post('/admin/ifsc_code_delete', jwtAdmin, (req, res, next) => {
        return bankBranchService.ifsc_code_delete(req, res, next);
    });
    /************ MANAGE USERS *****************/
    router.post('/admin/user_list', jwtAdmin, (req, res, next) => {
        return adminUsersService.user_list(req, res, next);
    });
    router.post('/admin/user_get', jwtAdmin, (req, res, next) => {
        return adminUsersService.user_get(req, res, next);
    });
    router.post('/admin/user_new', jwtAdmin, (req, res, next) => {
        return adminUsersService.user_new(req, res, next);
    });
    router.post('/admin/user_toggle', jwtAdmin, (req, res, next) => {
        return adminUsersService.user_toggle(req, res, next);
    });
    router.post('/admin/user_delete', jwtAdmin, (req, res, next) => {
        return adminUsersService.user_delete(req, res, next);
    });
    router.post('/admin/user_invite', jwtAdmin, (req, res, next) => {
        return adminUsersService.user_invite(req, res, next);
    });
    /************ MANAGE ROLES *****************/
    router.post('/admin/role_list', jwtAdmin, (req, res, next) => {
        return rolesService.role_list(req, res, next);
    });
    router.post('/admin/role_get', jwtAdmin, (req, res, next) => {
        return rolesService.role_get(req, res, next);
    });
    router.post('/admin/role_new', jwtAdmin, (req, res, next) => {
        return rolesService.role_new(req, res, next);
    });
    router.post('/admin/role_update', jwtAdmin, (req, res, next) => {
        return rolesService.role_update(req, res, next);
    });
    router.post('/admin/role_toggle', jwtAdmin, (req, res, next) => {
        return rolesService.role_toggle(req, res, next);
    });
    router.post('/admin/role_delete', jwtAdmin, (req, res, next) => {
        return rolesService.role_delete(req, res, next);
    });
    router.post('/admin/role_dropdown', jwtAdmin, (req, res, next) => {
        return rolesService.role_dropdown(req, res, next);
    });
    router.post('/admin/protean_role_permission_list', jwtAdmin, (req, res, next) => {
        return rolesService.protean_role_permission_list(req, res, next);
    });
    router.post('/admin/protean_role_permission_update', jwtAdmin, (req, res, next) => {
        return rolesService.protean_role_permission_update(req, res, next);
    });
    /************ EMAIL - SMS TEMPLATES *****************/
    router.post('/admin/email_template_list', jwtAdmin, (req, res, next) => {
        return templateService.email_template_list(req, res, next);
    });
    router.post('/admin/email_template_get', jwtAdmin, (req, res, next) => {
        return templateService.email_template_get(req, res, next);
    });
    router.post('/admin/email_template_set', jwtAdmin, (req, res, next) => {
        return templateService.email_template_set(req, res, next);
    });
    router.post('/admin/sms_template_list', jwtAdmin, (req, res, next) => {
        return templateService.sms_template_list(req, res, next);
    });
    router.post('/admin/sms_template_get', jwtAdmin, (req, res, next) => {
        return templateService.sms_template_get(req, res, next);
    });
    router.post('/admin/sms_template_set', jwtAdmin, (req, res, next) => {
        return templateService.sms_template_set(req, res, next);
    });
    /************ ENTITY REGISTRATION *****************/
    router.post('/admin/entity_registration_list', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_registration_list(req, res, next);
    });
    router.post('/admin/entity_registration_details', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_registration_details(req, res, next);
    });
    router.post('/admin/entity_registration_approve', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_registration_approve(req, res, next);
    });
    router.post('/admin/entity_registration_reject', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_registration_reject(req, res, next);
    });
    router.post('/admin/entity_user_account_toggle', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_user_account_toggle(req, res, next);
    });
    router.post('/admin/entity_user_activation_link', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_user_activation_link(req, res, next);
    });
    router.post('/admin/entity_change_request_list', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_change_request_list(req, res, next);
    });
    router.post('/admin/entity_change_request_details', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_change_request_details(req, res, next);
    });
    router.post('/admin/entity_change_request_approve', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_change_request_approve(req, res, next);
    });
    router.post('/admin/entity_change_request_reject', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_change_request_reject(req, res, next);
    });
    router.post('/admin/entity_enrolment_document_get_url', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_enrolment_document_get_url(req, res, next);
    });
    router.post('/admin/entity_admin_account_doc_get_url', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_admin_account_doc_get_url(req, res, next);
    });
    router.post('/admin/entity_csr_policy_doc_get_url', jwtAdmin, (req, res, next) => {
        return userMasterService.entity_csr_policy_doc_get_url(req, res, next);
    });
    /************ PROJECT MANAGEMENT *****************/
    router.post('/admin/project_purpose_dropdown', jwtAdmin, (req, res, next) => {
        return projectService.project_purpose_dropdown(req, res, next);
    });
    router.post('/admin/project_funding_option_dropdown', jwtAdmin, (req, res, next) => {
        return projectService.project_funding_option_dropdown(req, res, next);
    });
    router.post('/admin/project_rfp_document_get_url', jwtAdmin, (req, res, next) => {
        return projectService.project_rfp_document_get_url(req, res, next);
    });
    router.post('/admin/project_proposal_doc_get_url', jwtAdmin, (req, res, next) => {
        return projectService.project_proposal_doc_get_url(req, res, next);
    });

    router.post('/admin/project_created_list', jwtAdmin, (req, res, next) => {
        return projectService.project_created_list(req, res, next);
    });
    router.post('/admin/project_created_detail', jwtAdmin, (req, res, next) => {
        return projectService.project_created_detail(req, res, next);
    });
    router.post('/admin/project_floated_list', jwtAdmin, (req, res, next) => {
        return projectService.project_floated_list(req, res, next);
    });
    router.post('/admin/project_floated_detail', jwtAdmin, (req, res, next) => {
        return projectService.project_floated_detail(req, res, next);
    });
    router.post('/admin/project_awarded_list', jwtAdmin, (req, res, next) => {
        return projectService.project_awarded_list(req, res, next);
    });
    router.post('/admin/project_awarded_detail', jwtAdmin, (req, res, next) => {
        return projectService.project_awarded_detail(req, res, next);
    });
    router.post('/admin/project_fund_transfer_agency_list', jwtAdmin, (req, res, next) => {
        return projectService.project_fund_transfer_agency_list(req, res, next);
    });
    router.post('/admin/project_fund_transfer_agency_projects', jwtAdmin, (req, res, next) => {
        return projectService.project_fund_transfer_agency_projects(req, res, next);
    });
    router.post('/admin/project_fund_transfer_ext_payments', jwtAdmin, (req, res, next) => {
        return projectService.project_fund_transfer_ext_payments(req, res, next);
    });
    router.post('/admin/monitoring_looking_ia_project_list', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_looking_ia_project_list(req, res, next);
    });
    router.post('/admin/monitoring_looking_ia_project_view', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_looking_ia_project_view(req, res, next);
    });
    router.post('/admin/monitoring_looking_ia_milestone_list', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_looking_ia_milestone_list(req, res, next);
    });
    router.post('/admin/monitoring_looking_ia_milestone_view', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_looking_ia_milestone_view(req, res, next);
    });
    router.post('/admin/monitoring_looking_ia_milestone_doc_get_url', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_looking_ia_milestone_doc_get_url(req, res, next);
    });
    router.post('/admin/monitoring_crowd_fund_project_list', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_crowd_fund_project_list(req, res, next);
    });
    router.post('/admin/monitoring_crowd_fund_project_view', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_crowd_fund_project_view(req, res, next);
    });
    router.post('/admin/monitoring_crowd_fund_milestone_list', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_crowd_fund_milestone_list(req, res, next);
    });
    router.post('/admin/monitoring_crowd_fund_milestone_view', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_crowd_fund_milestone_view(req, res, next);
    });
    router.post('/admin/monitoring_crowd_fund_milestone_reject', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_crowd_fund_milestone_reject(req, res, next);
    });
    router.post('/admin/monitoring_crowd_fund_milestone_accept', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_crowd_fund_milestone_accept(req, res, next);
    });
    router.post('/admin/monitoring_crowd_fund_milestone_doc_get_url', jwtAdmin, (req, res, next) => {
        return projectService.monitoring_crowd_fund_milestone_doc_get_url(req, res, next);
    });
    return router;
};