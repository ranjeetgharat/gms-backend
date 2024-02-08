const smsTemplate = {
    'ENTITY_OTP_ON_REGISTRATION': 1,
    'ENTITY_LOGIN_WITH_OTP': 2,
};

const smsTags = {
    FIRST_NAME: '{FIRST_NAME}',
    MIDDLE_NAME: '{MIDDLE_NAME}',
    LAST_NAME: '{LAST_NAME}',
    FULL_NAME: '{FULL_NAME}',
    EMAIL_ID: '{EMAIL_ID}',
    MOBILE_NO: '{MOBILE_NO}',
    ENTITY_TYPE: '{ENTITY_TYPE}',
    OTP_CODE: '{OTP_CODE}',
};

module.exports = { smsTemplate: smsTemplate, smsTags: smsTags };