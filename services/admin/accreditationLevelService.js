const _logger = require('../../logger/winston').logger;
const db = require('../../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
const { success } = require("../../model/responseModel");
var dateFormat = require('date-format');
const utils = require('../../utilities/utils');
const { apiStatus } = require('../../constants/apiStatus');
var validator = require('validator');

const accreditation_level_dropdown = async (req, res, next) => {
    const { } = req.body;
    try {
        const _query1 = `SELECT level_id, level_name FROM accreditation_level ORDER BY level_rank`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        var list = [];
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                level_id: row1[i].level_id,
                level_name: row1[i].level_name,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    accreditation_level_dropdown,
};
