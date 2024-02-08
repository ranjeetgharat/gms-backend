const fileTypes = require('../constants/fileTypeList');
const signUpService = require('../services/home/signUpService');
const accountService = require('../services/home/accountService');
const paymentService = require('../services/home/paymentService');
const multer = require('multer');
const path = require('path');
const { random_key } = require('../utilities/utils');
const { signUpRateLimit } = require('../middleware/rateLimiter');

module.exports = ({ config }) => {
    const router = config.express.Router();

    router.get('/sign_up/entities', async (req, res, next) => {
        return signUpService.entities(req, res, next);
    });
    router.post('/sign_up/form_data', async (req, res, next) => {
        return signUpService.form_data(req, res, next);
    });
    router.post('/sign_up/resume_data', async (req, res, next) => {
        return signUpService.resume_data(req, res, next);
    });
    router.post('/sign_up/states', async (req, res, next) => {
        return signUpService.states(req, res, next);
    });
    router.post('/sign_up/districts', async (req, res, next) => {
        return signUpService.districts(req, res, next);
    });
    router.post('/sign_up/blocks', async (req, res, next) => {
        return signUpService.blocks(req, res, next);
    });
    router.post('/sign_up/check_pan_no', async (req, res, next) => {
        return signUpService.check_pan_no(req, res, next);
    });
    router.post('/sign_up/validate_initiator', async (req, res, next) => {
        return signUpService.validate_initiator(req, res, next);
    });
    router.post('/sign_up/resend_mobile_otp', async (req, res, next) => {
        return signUpService.resend_mobile_otp(req, res, next);
    });
    router.post('/sign_up/resend_email_otp', async (req, res, next) => {
        return signUpService.resend_email_otp(req, res, next);
    });
    router.post('/sign_up/verify_otp_codes', async (req, res, next) => {
        return signUpService.verify_otp_codes(req, res, next);
    });
    router.post('/sign_up/check_company_pan_no', async (req, res, next) => {
        return signUpService.check_company_pan_no(req, res, next);
    });
    router.post('/sign_up/check_gstin_no', async (req, res, next) => {
        return signUpService.check_gstin_no(req, res, next);
    });
    router.post('/sign_up/check_cin_no', async (req, res, next) => {
        return signUpService.check_cin_no(req, res, next);
    });
    router.post('/sign_up/search_parent_entity', async (req, res, next) => {
        return signUpService.search_parent_entity(req, res, next);
    });
    router.post('/sign_up/validate_details', async (req, res, next) => {
        return signUpService.validate_details(req, res, next);
    });
    router.post('/sign_up/check_ifsc_code', async (req, res, next) => {
        return signUpService.check_ifsc_code(req, res, next);
    });
    router.post('/sign_up/ifsc_code_search', async (req, res, next) => {
        return signUpService.ifsc_code_search(req, res, next);
    });
    router.post('/sign_up/validate_enrolment_detail', async (req, res, next) => {
        return signUpService.validate_enrolment_detail(req, res, next);
    });
    router.post('/sign_up/validate_bank_detail', async (req, res, next) => {
        return signUpService.validate_bank_detail(req, res, next);
    });
    router.post('/sign_up/validate_user_detail', async (req, res, next) => {
        return signUpService.validate_user_detail(req, res, next);
    });
    
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

    router.post('/sign_up/submit_detail', signUpRateLimit, upload.any(), async (req, res, next) => {
        return signUpService.submit_detail(req, res, next);
    });
    router.get('/entity/entities', async (req, res, next) => {
        return accountService.entities(req, res, next);
    });
    router.post('/entity/login', async (req, res, next) => {
        return accountService.login(req, res, next);
    });
    router.post('/account/login_otp_get', async (req, res, next) => {
        return accountService.login_otp_get(req, res, next);
    });
    router.post('/account/login_otp_resend', async (req, res, next) => {
        return accountService.login_otp_resend(req, res, next);
    });
    router.post('/account/login_otp_check', async (req, res, next) => {
        return accountService.login_otp_check(req, res, next);
    });
    router.post('/entity/reset_pass_request', async (req, res, next) => {
        return accountService.reset_pass_request(req, res, next);
    });
    router.post('/entity/reset_pass_check', async (req, res, next) => {
        return accountService.reset_pass_check(req, res, next);
    });
    router.post('/entity/reset_pass_update', async (req, res, next) => {
        return accountService.reset_pass_update(req, res, next);
    });
    router.post('/entity/new_pass_check', async (req, res, next) => {
        return accountService.new_pass_check(req, res, next);
    });
    router.post('/entity/new_pass_update', async (req, res, next) => {
        return accountService.new_pass_update(req, res, next);
    });
    router.post('/sign_up/testing', upload.any(), async (req, res, next) => {
        return signUpService.testing(req, res, next);
    });
    /***********************************************************/
    router.post('/bill_desk_response', async (req, res, next) => {
        return paymentService.bill_desk_response(req, res, next);
    });
    return router;
};