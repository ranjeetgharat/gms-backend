/**
 * @desc    Send any success response
 *
 * @param   {string} message
 * @param   {object | array} results
 * @param   {number} statusCode
 */
exports.success = (status, statusCode, message, results) => {
    return {
        message,
        status: status,
        code: statusCode,
        results: results
    };
};