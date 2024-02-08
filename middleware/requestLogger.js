const _logger = require('../logger/winston').logger;
const log_request = require('../logger/winston').log_request;
const correlator = require('express-correlation-id');
const requestIp = require('request-ip');
const utils = require("../utilities/utils");
const { PassThrough } = require('stream');
var validator = require('validator');

const canSkipLogging = (url) => {
    return utils.check_in_array(url, [
        '/sign_up/entities',
        '/entity/entities',
        '/admin/project_purpose_dropdown',
    ]);
}

const header_to_log = ['X-Access-Token', 'X-Auth-Key', 'X-Api-Key'];

const requestLogger = (req, res, next) => {
    if (!canSkipLogging(req.url)) {
        const defaultWrite = res.write.bind(res);
        const defaultEnd = res.end.bind(res);
        const ps = new PassThrough();
        const chunks = [];
        ps.on('data', data => {
            chunks.push(data);
        });
        res.write = (...args) => {
            ps.write(...args);
            defaultWrite(...args);
        };
        res.end = (...args) => {
            ps.end(...args);
            defaultEnd(...args);
        };
        res.on('finish', () => {
            try {
                var token_id = 0; var account_id = 0; var ip_address = ''; var user_type = 0; var table_id = 0;
                if (req.token_data && req.token_data != null) {
                    token_id = req.token_data.token_id != null ? req.token_data.token_id : 0;
                    account_id = req.token_data.account_id != null ? req.token_data.account_id : 0;
                   
                    var admin_id = req.token_data.admin_id != null ? req.token_data.admin_id : 0;
                    if (admin_id > 0) { table_id = admin_id; user_type = 1; }
                    
                    var user_id = req.token_data.user_id != null ? req.token_data.user_id : 0;
                    if (user_id > 0) { table_id = user_id; user_type = 2; }
                }
                try { const clientIp = requestIp.getClientIp(req); ip_address = clientIp; } catch { }
                var resp_data = ''; const _contentType = res.get('Content-type').toLowerCase();
                if (utils.check_in_array(_contentType, ['application/json; charset=utf-8', 'application/json', 'application/xml; charset=utf-8',
                    'application/xml', 'text/html; charset=utf-8', 'text/html'])) {
                    resp_data = Buffer.concat(chunks).toString();
                }
                var headers = {};
                for (let i = 0; i < header_to_log.length; i++) {
                    try {
                        const val = req.get(header_to_log[i]);
                        if (val && val.length > 0) {
                            headers[header_to_log[i]] = val;
                        }
                    } catch (_) {
                    }
                }
                const logData = {
                    correlation_id: correlator.getId(),
                    ip_addr: ip_address,
                    date_time: new Date(),
                    token_id: token_id,
                    account_id: account_id,
                    user_type: user_type,
                    user_id: table_id,
                    url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
                    referrer: req.get('Referrer'),
                    userAgent: req.get('User-Agent'),
                    headers: headers,
                    method: req.method,
                    payload: JSON.stringify(req.body),
                    response: resp_data,
                    status: res.statusCode,
                };

                log_request.info(JSON.stringify(logData));

            } catch (err) {
                try { _logger.error(err.stack); } catch (_) { }
            }
        });
    }
    next();
};

module.exports = requestLogger;