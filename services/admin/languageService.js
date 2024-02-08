const _logger = require('../../logger/winston').logger;
const { success } = require("../../model/responseModel");
const path = require('path');
const fs = require('fs');
const { Sequelize, QueryTypes } = require('sequelize');

const language_locales_get = async (req, res, next) => {
    try {
        var list = [];
        const _query1 = `SELECT key_text, lng_en, lng_hin, lng_mar FROM language_locales
        ORDER BY CASE WHEN COALESCE(sort_order, 0) <= 0 THEN 9223372036854775807 ELSE COALESCE(sort_order, 0) END`;
        const row1 = await db.sequelize.query(_query1, { type: QueryTypes.SELECT });
        for (let i = 0; row1 && i < row1.length; i++) {
            list.push({
                key: row1[i].key_text,
                en: row1[i].lng_en,
                hin: row1[i].lng_hin,
                mar: row1[i].lng_mar,
                editing: false,
            });
        }
        return res.status(200).json(success(true, res.statusCode, "", list));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

const language_locales_set = async (req, res, next) => {
    const { values } = req.body;
    try {
        var en = {};
        var hin = {};
        var mar = {};

        for (let i = 0; i < values.length; i++) {
            en[values[i].key.trim()] = values[i].en;
            hin[values[i].key.trim()] = values[i].hin;
            mar[values[i].key.trim()] = values[i].mar;
        }
        const _fileEn = path.join(path.join(__dirname, '../../locales'), 'en.json');
        const _fileHin = path.join(path.join(__dirname, '../../locales'), 'hin.json');
        const _fileMar = path.join(path.join(__dirname, '../../locales'), 'mar.json');

        fs.writeFileSync(_fileEn, JSON.stringify(en, null, 4), 'utf-8');
        fs.writeFileSync(_fileHin, JSON.stringify(hin, null, 4), 'utf-8');
        fs.writeFileSync(_fileMar, JSON.stringify(mar, null, 4), 'utf-8');

        var key_ids = [];

        for (let i = 0; i < values.length; i++) {
            const _query1 = `SELECT key_id FROM language_locales WHERE LOWER(key_text) = LOWER(?)`;
            const row1 = await db.sequelize.query(_query1, { replacements: [values[i].key.trim()], type: QueryTypes.SELECT });
            if (row1 && row1.length > 0) {
                const _query2 = `UPDATE language_locales SET sort_order = ?, lng_en = ?, lng_hin = ?, lng_mar = ? WHERE LOWER(key_text) = LOWER(?)`;
                const _replacements2 = [(i + 1), values[i].en, values[i].hin, values[i].mar, values[i].key.trim()];
                await db.sequelize.query(_query2, { replacements: _replacements2, type: QueryTypes.UPDATE });
                key_ids.push(row1[0].key_id);
            } else {
                const _query5 = `INSERT INTO language_locales(key_text, sort_order, lng_en, lng_hin, lng_mar) VALUES (?, ?, ?, ?, ?) RETURNING "key_id"`;
                const _replacements5 = [values[i].key.trim(), (i + 1), values[i].en, values[i].hin, values[i].mar];
                const [rowOut] = await db.sequelize.query(_query5, { replacements: _replacements5, type: QueryTypes.INSERT });
                const key_id = (rowOut && rowOut.length > 0 && rowOut[0] ? rowOut[0].key_id : 0);
                if (key_id > 0) {
                    key_ids.push(key_id);
                }
            }
        }

        const _query_16 = `DELETE FROM language_locales WHERE key_id NOT IN (?)`;
        await db.sequelize.query(_query_16, { replacements: [key_ids], type: QueryTypes.DELETE });

        return res.status(200).json(success(true, res.statusCode, "Saved successfully.", null));
    } catch (err) {
        _logger.error(err.stack);
        return res.status(200).json(success(false, res.statusCode, err.message, null));
    }
};

module.exports = {
    language_locales_get,
    language_locales_set,
};