const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
var validator = require('validator');
const { apiStatus } = require("../../constants/apiStatus");
const constants = require('../../constants/constants');

const project_charge_config_list = async (req, res, next) => {
    try {
        const _query1 = `SELECT pcc.project_type, pcc.pg_charges, pcc.pg_amt_type, pcc.protean_fees, pcc.pf_amt_type, 
        pcc.tax_charges, pcc.tax_amt_type, pcc.modify_date FROM project_charge_config pcc`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; i < constants.project_charge_config_types.length; i++) {
            const eleTyp = constants.project_charge_config_types[i];
            for (let j = 0; row1 && j < row1.length; j++) {
                if (row1[j].project_type.toLowerCase() == eleTyp.id.toLowerCase()) {
                    const pg_charges = row1[j].pg_charges != null && validator.isNumeric(row1[j].pg_charges.toString()) ? parseFloat(row1[j].pg_charges) : 0;
                    const pg_amt_type = row1[j].pg_amt_type != null && validator.isNumeric(row1[j].pg_amt_type.toString()) ? parseInt(row1[j].pg_amt_type) : 0;
                    const protean_fees = row1[j].protean_fees != null && validator.isNumeric(row1[j].protean_fees.toString()) ? parseFloat(row1[j].protean_fees) : 0;
                    const pf_amt_type = row1[j].pf_amt_type != null && validator.isNumeric(row1[j].pf_amt_type.toString()) ? parseInt(row1[j].pf_amt_type) : 0;
                    const tax_charges = row1[j].tax_charges != null && validator.isNumeric(row1[j].tax_charges.toString()) ? parseFloat(row1[j].tax_charges) : 0;
                    const tax_amt_type = row1[j].tax_amt_type != null && validator.isNumeric(row1[j].tax_amt_type.toString()) ? parseInt(row1[j].tax_amt_type) : 0;

                    list.push({
                        project_type: eleTyp.id,
                        display_name: eleTyp.name,
                        pg_charges: pg_charges,
                        pg_amt_type: pg_amt_type,
                        protean_fees: protean_fees,
                        pf_amt_type: pf_amt_type,
                        tax_charges: tax_charges,
                        tax_amt_type: tax_amt_type,
                        modify_date: row1[j].modify_date ? dateFormat(process.env.DATE_FORMAT, utils.db_date_to_ist(row1[j].modify_date)) : "",
                    });
                    break;
                }
            }

        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

const project_charge_config_update = async (req, res, next) => {
    const { project_type, pg_charges, pg_amt_type, protean_fees, pf_amt_type, tax_charges, tax_amt_type } = req.body;
    try {
        const _project_type = project_type != null && project_type.length > 0 ? project_type.trim() : "";
        const _query1 = `SELECT project_type FROM project_charge_config WHERE LOWER(project_type) = LOWER(?)`;
        const row1 = await db.sequelize.query(_query1, { replacements: [_project_type], type: QueryTypes.SELECT });
        if (!row1 || row1.length <= 0) {
            return res.status(200).json(success(false, res.statusCode, "Project type details not found.", null));
        }
        const _pg_charges = pg_charges != null && validator.isNumeric(pg_charges.toString()) ? parseFloat(parseFloat(pg_charges).toFixed(2)) : 0;
        const _pg_amt_type = pg_amt_type != null && validator.isNumeric(pg_amt_type.toString()) ? parseInt(pg_amt_type) : 0;
        if (!utils.check_in_array(_pg_amt_type, [0, 1])) {
            return res.status(200).json(success(false, res.statusCode, "Invalid PG charges amount type.", null));
        }
        const _protean_fees = protean_fees != null && validator.isNumeric(protean_fees.toString()) ? parseFloat(parseFloat(protean_fees).toFixed(2)) : 0;
        const _pf_amt_type = pf_amt_type != null && validator.isNumeric(pf_amt_type.toString()) ? parseInt(pf_amt_type) : 0;
        if (!utils.check_in_array(_pf_amt_type, [0, 1])) {
            return res.status(200).json(success(false, res.statusCode, "Invalid protean fees amount type.", null));
        }
        const _tax_charges = tax_charges != null && validator.isNumeric(tax_charges.toString()) ? parseFloat(parseFloat(tax_charges).toFixed(2)) : 0;
        const _tax_amt_type = tax_amt_type != null && validator.isNumeric(tax_amt_type.toString()) ? parseInt(tax_amt_type) : 0;
        if (!utils.check_in_array(_tax_amt_type, [0, 1])) {
            return res.status(200).json(success(false, res.statusCode, "Invalid taxes amount type.", null));
        }

        const _query2 = `UPDATE project_charge_config SET pg_charges = ?, pg_amt_type = ?, protean_fees = ?, pf_amt_type = ?,
        tax_charges = ?, tax_amt_type = ?, modify_by = ?, modify_date = ? WHERE LOWER(project_type) = LOWER(?)`;
        const _replacements2 = [_pg_charges, _pg_amt_type, _protean_fees, _pf_amt_type, _tax_charges, _tax_amt_type,
            req.token_data.account_id, new Date(), _project_type];
        const [, i] = await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
        if (i > 0) {
            return res.status(200).json(success(true, res.statusCode, "Updated successfully.", null));
        } else {
            return res.status(200).json(success(false, res.statusCode, "Unable to update, Please try again", null));
        }
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
}

module.exports = {
    project_charge_config_list,
    project_charge_config_update,
};