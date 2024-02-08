const _logger = require('../logger/winston').logger;
const db = require('../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');
var validator = require('validator');
const crypto = require('crypto');
const registrationModule = require('./registrationModule');
const cloudStorageModule = require('./cloudStorageModule');
var dateFormat = require('date-format');
const utils = require('../utilities/utils');

const attribute_type_list = async () => {
    var list = [];
    const row1 = await db.sequelize.query(`SELECT type_text FROM attribute_type`, { type: QueryTypes.SELECT });
    for (let i = 0; row1 && i < row1.length; i++) {
        list.push(row1[i].type_text);
    }
    return list;
};

const attribute_validation_list = async () => {
    var list = [];
    const _query2 = `SELECT vld_type_id, vld_type_name, applicable_for, input_required, description FROM attribute_validation`;
    const row2 = await db.sequelize.query(_query2, { type: QueryTypes.SELECT });
    for (let i = 0; row2 && i < row2.length; i++) {
        var applicable_for = [];
        if (row2[i].applicable_for && row2[i].applicable_for.length > 0) {
            const applicable_for_list = row2[i].applicable_for.split(',').join('|');
            const applicable_for_array = applicable_for_list.split('|');
            for (let j = 0; applicable_for_array && j < applicable_for_array.length; j++) {
                const _e = applicable_for_array[j];
                if (_e && _e.length > 0) {
                    applicable_for.push(_e.trim());
                }
            }
        }
        list.push({
            vld_type_id: row2[i].vld_type_id,
            vld_type_name: row2[i].vld_type_name,
            applicable_for: applicable_for,
            input_required: row2[i].input_required,
            description: (row2[i].description ? row2[i].description : ""),
        });
    }
    return list;
};





module.exports = {
    attribute_type_list,
    attribute_validation_list,
};