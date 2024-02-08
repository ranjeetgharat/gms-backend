const otp_length = 6;
const project_purpose = [
    { id: 1, name: 'Looking For IA' },
    { id: 2, name: 'Looking For Funds' },
];
const project_funding_option = [
    { id: 1, name: 'Grant under CSR', short_name: 'Grant CSR' },
    { id: 2, name: 'Crowd funding from Philanthropist', short_name: 'Crowd Funding' },
];
const project_mapped_under = [
    { id: 'SDG', name: 'SDG' },
    { id: 'ESG', name: 'ESG' },
    { id: 'Both', name: 'Both' },
];
const project_question_types = [
    { id: 1, name: 'Multiple Choice' },
    { id: 2, name: 'Multiple Select' },
    { id: 3, name: 'Short Answer' },
    { id: 4, name: 'Long Answer' },
    { id: 5, name: 'Linear Scale' },
];

const project_charge_config_types = [
    { id: 'LOOKING_IA_INT', name: 'Looking For IA (Internal)' },
    { id: 'LOOKING_IA_EXT', name: 'Looking For IA (External)' },
    { id: 'GRANT_CSR', name: 'Grant Under CSR' },
    { id: 'CROWD_FUNDING', name: 'Crowd Funding' },
];

const proj_payment_order_id_int_prefix = 'INT';
const proj_payment_order_id_ext_prefix = 'EXT';
const proj_payment_order_id_csr_prefix = 'CSR';
const proj_payment_order_id_funding_prefix = 'CFD';
const payment_api_order_date_format = 'yyyy-MM-ddThh:mm:ssO';
const proj_payment_retry_count = 0;

const textbox_date_api_format = 'dd/MM/yyyy';

const entity_registration_section = [
    { id: 'ID_USER', name: 'Initiator Details - User Data' },
    { id: 'CD_BASIC', name: 'Company Details - Basic' },
    { id: 'CD_ADDR', name: 'Company Details - Address' },
    { id: 'ED_IDN', name: 'Enrolment Details - Identification' },
];
const entity_reg_success_msg = `Your registration request has been send successfully and approval/rejection of your registration will be informed to you via email.`;

module.exports = {
    otp_length,
    project_purpose,
    project_funding_option,
    project_mapped_under,
    project_question_types,
    project_charge_config_types,

    proj_payment_order_id_int_prefix,
    proj_payment_order_id_ext_prefix,
    proj_payment_order_id_csr_prefix,
    proj_payment_order_id_funding_prefix,
    payment_api_order_date_format,
    proj_payment_retry_count,

    textbox_date_api_format,

    entity_registration_section,
    entity_reg_success_msg,
};