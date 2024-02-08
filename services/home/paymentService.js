const _logger = require('../../logger/winston').logger;
const log_payment = require('../../logger/winston').log_payment;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const jws = require('jws');
const emailModule = require('../../modules/emailModule');
const constants = require('../../constants/constants');
const correlator = require('express-correlation-id');
const requestIp = require('request-ip');
const utils = require('../../utilities/utils');

const bill_desk_response = async (req, res, next) => {
    const { transaction_response } = req.body;
    try {
        var ip_addr = ''; try { const clientIp = requestIp.getClientIp(req); ip_addr = clientIp; } catch { }

        log_bill_desk_payment('info', ip_addr, 'Response Received', req.body);

        const is_verified = jws.verify(transaction_response, "HS256", process.env.BILL_DESK_SECRETKEY);
        if (is_verified) {
            log_bill_desk_payment('info', ip_addr, 'Signature Verified', transaction_response);
            const success_data = jws.decode(transaction_response);
            if (success_data != null) {
                log_bill_desk_payment('info', ip_addr, 'Decrypted Transaction Data', success_data);
                var payloadData = null; try { payloadData = JSON.parse(success_data.payload); } catch (_) { }
                if (payloadData != null) {
                    log_bill_desk_payment('info', ip_addr, 'Transaction Payload Data', payloadData);

                    const orderid = (payloadData.orderid && payloadData.orderid.length > 0 ? payloadData.orderid : "");
                    const is_success = payloadData.auth_status.toString() == '0300' ? true : false;
                    const bank_ref_no = (payloadData.bank_ref_no && payloadData.bank_ref_no.length > 0 ? payloadData.bank_ref_no : "");
                    const transactionid = (payloadData.transactionid && payloadData.transactionid.length > 0 ? payloadData.transactionid : "");
                    const resp_error_type = (payloadData.transaction_error_type && payloadData.transaction_error_type.length > 0 ? payloadData.transaction_error_type : "");
                    const resp_error_code = (payloadData.transaction_error_code && payloadData.transaction_error_code.length > 0 ? payloadData.transaction_error_code : "");
                    const resp_error_desc = (payloadData.transaction_error_desc && payloadData.transaction_error_desc.length > 0 ? payloadData.transaction_error_desc : "");

                    log_bill_desk_payment('info', ip_addr, 'Transaction Status', 'Order ID: ' + orderid + ' status: ' + is_success.toString() + ' status code: ' + resp_error_code + ' description: ' + resp_error_desc);

                    const currDate = new Date();

                    const _queryInResp = `INSERT INTO project_payment_resp(order_id, response_date, response_data, response_payload, 
                        bank_ref_no, transactionid, resp_error_type, resp_error_code, resp_error_desc) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                    const _replInResp = [orderid, currDate, JSON.stringify(success_data), JSON.stringify(payloadData),
                        bank_ref_no, transactionid, resp_error_type, resp_error_code, resp_error_desc];
                    await db.sequelize.query(_queryInResp, { replacements: _replInResp, type: QueryTypes.INSERT });

                    if (orderid.startsWith(constants.proj_payment_order_id_int_prefix)) {
                        const _queryIntUp = `UPDATE project_payment_int SET is_success = ?, response_data_body = ?, response_data_signature = ?,
                        response_data_decoded = ?, response_data_payload = ?, bank_ref_no = ?, transactionid = ?, response_date = ?,
                        resp_error_type = ?, resp_error_code = ?, resp_error_desc = ? WHERE order_id = ?`;
                        const _replIntUp = [is_success, JSON.stringify(req.body), transaction_response,
                            JSON.stringify(success_data), JSON.stringify(payloadData), bank_ref_no, transactionid, currDate,
                            resp_error_type, resp_error_code, resp_error_desc, orderid];
                        await db.sequelize.query(_queryIntUp, { replacements: _replIntUp, type: QueryTypes.UPDATE });

                        setTimeout(async () => {
                            await emailModule.project_payment_internal(orderid);
                        }, 0);

                    }
                    if (orderid.startsWith(constants.proj_payment_order_id_ext_prefix)) {
                        const _queryIntUp = `UPDATE project_payment_ext SET is_success = ?, response_data_body = ?, response_data_signature = ?,
                        response_data_decoded = ?, response_data_payload = ?, bank_ref_no = ?, transactionid = ?, response_date = ?,
                        resp_error_type = ?, resp_error_code = ?, resp_error_desc = ? WHERE order_id = ?`;
                        const _replIntUp = [is_success, JSON.stringify(req.body), transaction_response,
                            JSON.stringify(success_data), JSON.stringify(payloadData), bank_ref_no, transactionid, currDate,
                            resp_error_type, resp_error_code, resp_error_desc, orderid];
                        await db.sequelize.query(_queryIntUp, { replacements: _replIntUp, type: QueryTypes.UPDATE });

                        setTimeout(async () => {
                            await emailModule.project_payment_external(orderid);
                        }, 0);

                    }
                    if (orderid.startsWith(constants.proj_payment_order_id_csr_prefix) ||
                        orderid.startsWith(constants.proj_payment_order_id_funding_prefix)) {
                        const _queryIntUp = `UPDATE project_payment_fund SET is_success = ?, response_data_body = ?, response_data_signature = ?,
                        response_data_decoded = ?, response_data_payload = ?, bank_ref_no = ?, transactionid = ?, response_date = ?,
                        resp_error_type = ?, resp_error_code = ?, resp_error_desc = ? WHERE order_id = ?`;
                        const _replIntUp = [is_success, JSON.stringify(req.body), transaction_response,
                            JSON.stringify(success_data), JSON.stringify(payloadData), bank_ref_no, transactionid, currDate,
                            resp_error_type, resp_error_code, resp_error_desc, orderid];
                        await db.sequelize.query(_queryIntUp, { replacements: _replIntUp, type: QueryTypes.UPDATE });

                        if (orderid.startsWith(constants.proj_payment_order_id_csr_prefix)) {
                            setTimeout(async () => {
                                await emailModule.project_payment_grant_csr(orderid);
                            }, 0);
                        }
                        if (orderid.startsWith(constants.proj_payment_order_id_funding_prefix)) {
                            setTimeout(async () => {
                                await emailModule.project_payment_crowd_fund(orderid);
                            }, 0);
                        }
                    }
                } else {
                    log_bill_desk_payment('error', ip_addr, 'Payload Data Found Empty/Null', transaction_response);
                }
            } else {
                log_bill_desk_payment('error', ip_addr, 'Decrypted Data Found Empty/Null', transaction_response);
            }
        } else {
            log_bill_desk_payment('error', ip_addr, 'Signature Verify Failed', transaction_response);
        }
    } catch (err) {
        try { _logger.error(err.stack); } catch (_) { }
    }
    return res.status(200).send('<body onload="window.close();"></body>');
};

function log_bill_desk_payment(level, ip_addr, message, data) {
    try {
        log_payment.log(level, utils.bill_desk_logger_obj(ip_addr, message, data))
    } catch (err) {
        try { _logger.error(err.stack); } catch (_) { }
    }
}

module.exports = {
    bill_desk_response,
    log_bill_desk_payment,
}