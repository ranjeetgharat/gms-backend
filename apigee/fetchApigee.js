const _logger = require('../logger/winston').logger;
const { fetch } = require('cross-fetch');
const crypto = require('crypto');
const forge = require('node-forge');
const db = require('../database/postgresql_db');
const { Sequelize, QueryTypes } = require('sequelize');

const get_oauth_token = async () => {
    try {
        const response = await fetch(process.env.APIGEE_ENDPOINT + 'v1/oauth/token', {
            method: "POST",
            headers: {
                Authorization: "Basic " + btoa(process.env.APIGEE_API_KEY + ":" + process.env.APIGEE_SECRET_KEY) + "",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });
        const data = await response.json();
        return data.access_token;
    } catch (err) {
        _logger.error(err.stack);
        return "";
    }
}

const validate_pan_card = async (pan_no) => {
    var data = { status: false, data: '', msg: '', };
    try {
        /*
        const raw_json = { "UserID": "V0136601", "PAN": [pan_no] };
        const raw_data = encryptApigee(JSON.stringify(raw_json));
        const payload_data = {
            data: raw_data.data,
            version: "1.0.0",
            symmetricKey: raw_data.key,
            hash: raw_data.hash,
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
        };
        const oauth_token = await get_oauth_token();
        const response = await fetch(process.env.APIGEE_ENDPOINT + 'api/v1/pan/verification', {
            method: "POST",
            headers: {
                apikey: `${process.env.APIGEE_API_KEY}`,
                Authorization: `Bearer ${oauth_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload_data),
        });
        if (response.status == 200) {
            const response_data = await response.json();
            const decryptedStr = decryptApigee(response_data.data, response_data.symmetricKey, response_data.hash);
            console.log('decryptedStr');
            console.log(decryptedStr);
            console.log('decryptedStr');
            const decryptedData = JSON.parse(decryptedStr);
            if (decryptedData.subCode == "200") {
                data.status = true;
                data.data = JSON.stringify({
                    bank: decryptedData.data.bank,
                    branch: decryptedData.data.branch,
                });
            } else {
                data.msg = decryptedData.message;
            }
        } else {
            try {
                const response_data = await response.json();
                const decryptedStr = decryptApigee(response_data.data, response_data.symmetricKey, response_data.hash);
                console.log('decryptedStr');
                console.log(decryptedStr);
                console.log('decryptedStr');
                const decryptedData = JSON.parse(decryptedStr);
                data.msg = decryptedData.error_description;
            } catch (_) {
                data.msg = response.statusText;
            }
        }
*/
        data.status = true;
    } catch (err) {
        _logger.error(err.stack);
    }
    return data;
};

const validate_gstin_no = async (gstin_no) => {
    var data = { status: false, data: '', msg: '', };
    try {
        //const oauth_token = await get_oauth_token();
        data.status = true;
    } catch (err) {
        _logger.error(err.stack);
    }
    return data;
};

const validate_cin_no = async (cin_no) => {
    var data = { status: false, data: '', msg: '', };
    try {
        //const oauth_token = await get_oauth_token();
        data.status = true;
    } catch (err) {
        _logger.error(err.stack);
    }
    return data;
};

const validate_ifsc_code = async (ifsc_code) => {
    var data = { status: false, data: '', msg: '', };
    try {
        /*
        const raw_json = { "ifsc": ifsc_code };
        const raw_data = encryptApigee(JSON.stringify(raw_json));
        const payload_data = {
            data: raw_data.data,
            version: "1.0.0",
            symmetricKey: raw_data.key,
            hash: raw_data.hash,
            timestamp: new Date().toISOString(),
            requestId: crypto.randomUUID(),
        };
        const oauth_token = await get_oauth_token();
        const response = await fetch(process.env.APIGEE_ENDPOINT + 'api/v1/ifsc/ifscVerification', {
            method: "POST",
            headers: {
                apikey: `${process.env.APIGEE_API_KEY}`,
                Authorization: `Bearer ${oauth_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload_data),
        });
        if (response.status == 200) {
            const response_data = await response.json();
            const decryptedStr = decryptApigee(response_data.data, response_data.symmetricKey, response_data.hash);
            const decryptedData = JSON.parse(decryptedStr);
            if (decryptedData.subCode == "200") {
                data.status = true;
                data.data = JSON.stringify({
                    bank: decryptedData.data.bank,
                    branch: decryptedData.data.branch,
                });
            } else {
                data.msg = decryptedData.message;
            }
        } else {
            try {
                const response_data = await response.json();
                const decryptedStr = decryptApigee(response_data.data, response_data.symmetricKey, response_data.hash);
                const decryptedData = JSON.parse(decryptedStr);
                data.msg = decryptedData.error_description;
            } catch (_) {
                data.msg = response.statusText;
            }
        }
        */
        const _query1 = `SELECT i.ifsc_code, i.branch_name, b.bank_name FROM bank_branch i LEFT OUTER JOIN bank_mast b ON i.bank_id = b.bank_id 
        WHERE LOWER(i.ifsc_code) = LOWER(?) AND i.is_deleted = false AND b.is_deleted = false`;
        const row1 = await db.sequelize.query(_query1, { replacements: [ifsc_code], type: QueryTypes.SELECT });
        if (row1 && row1.length > 0) {
            data.status = true;
            data.data = JSON.stringify({ ifsc_code: row1[0].ifsc_code, bank: row1[0].bank_name, branch: row1[0].branch_name });
        } else {
            data.msg = 'IFSC code verification failed.';
        }
    } catch (err) {
        _logger.error(err.stack);
    }
    return data;
};

const validate_bank_acc_number = async (account_no, account_type, ifsc_code) => {
    var data = { status: false, data: '', msg: '', };
    try {
        /*
         const raw_json = { "requestId": "P270720231551", "accountNo": account_no, "ifscCode": ifsc_code };
         console.log(JSON.stringify(raw_json))
         const raw_data = encryptApigee(JSON.stringify(raw_json));        
         const payload_data = {
             data: raw_data.data,
             version: "1.0.0",
             symmetricKey: raw_data.key,
             hash: raw_data.hash,
             timestamp: new Date().toISOString(),
             requestId: crypto.randomUUID(),
         };
         console.log(JSON.stringify(payload_data))
         const oauth_token = await get_oauth_token();
         const response = await fetch(process.env.APIGEE_ENDPOINT + 'api/v1/imps/p2a/pennyLess', {
             method: "POST",
             headers: {
                 apikey: `${process.env.APIGEE_API_KEY}`,
                 Authorization: `Bearer ${oauth_token}`,
                 "Content-Type": "application/json",
             },
             body: JSON.stringify(payload_data),
         });        
         if (response.status == 200) {
             const response_data = await response.json();
             console.log(JSON.stringify(response_data))
             const decryptedStr = decryptApigee(response_data.data, response_data.symmetricKey, response_data.hash);
             console.log('decryptedStr');
             console.log(decryptedStr);
             console.log('decryptedStr');
             const decryptedData = JSON.parse(decryptedStr);
             if (decryptedData.subCode == "200") {
                 data.status = true;
                 data.data = JSON.stringify({
                     bank: decryptedData.data.bank,
                     branch: decryptedData.data.branch,
                 });
             } else {
                 data.msg = decryptedData.message;
             }
         } else {
             try {
                 const response_data = await response.json();
                 const decryptedStr = decryptApigee(response_data.data, response_data.symmetricKey, response_data.hash);
                 console.log('decryptedStr');
                 console.log(decryptedStr);
                 console.log('decryptedStr');
                 const decryptedData = JSON.parse(decryptedStr);
                 data.msg = decryptedData.error_description;
             } catch (_) {
                 data.msg = response.statusText;
             }
         }
         */
        data.status = true;
    } catch (err) {
        _logger.error(err.stack);
    }
    return data;
};

const random_key = (length) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, charset.length);
        key += charset[randomIndex]
    }
    return key;
};

let encPrivateKeyString = `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQB0Y38WG5cXL1SIezFBFFqAa/VgnCdWTiSa5h9JaUOFBGPOkZJ+
FuQ8zm0NpRwv5wQbjGOYg8ajTT2wQQSTJQR4xrs0lPFoa+401US0wWurWeVt3OP9
csT35gChsSDfbvBRlB12e9er6AimUxx1DBnIaaJy8pf5OQaC6QIzBZtgNVdxFNPx
ZdfM47ggfhX5rBkGoOgGDaPbSl1nDEjHwSfbNFRJIMWzM25Ma7XBvLB58bcJyUXo
/n9fECH8w+3tIF2HAP0jkk2aEIC6ew6a8mk4GDZE7psdMDIFeRnrDQHCFN1X/GoI
tTyDeKTKF0f+9/o73JkRfYLAK+JZQ0rQN463AgMBAAECggEAKSkaw63END3XzmCK
3bIeA3aqk50FyF7gUSt6+xJP/5W62k3fGdpsoxh5tq6ilkpDyJ5QhpprwErLuy5z
OLqJp1DY2dKmwUASQPr/TlFtC29CVSUeN/7Dq8vag1RKBNqOALu547IOZswrau7P
jJFX+Olquu4SUuAY7mkLDxI3jcEzQIFJv46nbDorRr3+QuKjR0VeSmnoxoXRK/5T
NZ1rrZH/IMSFxGUJzbMT2FexMikrw4qT7/6HtKVjPQ02j8/dpmpMVaMyrT6dXef2
tM6RmDLvLj6dEh1ua4V8OnTmlxbOEe4WaHbsUmn5TEx1LlGiY9og/xtrjcRn8KfJ
ZYnQcQKBgQDQjMmC9u8cWuEEp47GuYH/KJ11Mi/wlpq7cCVNjfOsLjoPh0MQIoOw
RvCEKUj2+i6i3Ke668ojYd/3W5VFvLdIvNVA8NJTwfFm+mvDxmAhSa+kan4BCgVy
oQp0AtCmcd2rmLHAW1lMt4OMT8pSbsyRM5zmkSYnjD86V0yA+Z6ciQKBgQCO3q1a
UD/NsZeyyd9tG5gZx6Z+udc8kb5WZ52Mj/Bk/QyvRWB4X9iCPxWf/W879VNYE2Qy
YyjlwbrEEWNIHZs+lSGZJAgQ5vacwR3Pbu2k9V9POaowc00G2IJ9Cip5Px+7aM3e
Jd9HwkGZdppkuhP2y4PqYKiIa7ciIueOY16BPwKBgQCJ48yJL0RB90S4kyEv/BAb
6XrStnBEHxAHxsqjUKxAt//jrIeG74sqznzQpYt84UZcoJC2YpiwdFJldsRn67M0
AMbvvUsT3jQC5qjCNTPyToo3p8HQZhPcCuaidgoHQ1pRzxAYI04UD3KHH2qivme7
yeh/+pDDrVNQ+8+1p1ZcIQKBgEeTVaPWanChlU9UBaRC28umk0oPzr4gggwFsw+V
mSjvAajZiAAmfHCcLDhQHqcaO9v3Mw5vUTDyAqBx2ZxqgLk0u3VecNAO9eQId+fR
OiuXZl1plVLaoO9aDt2X9zlxH3OjiOfPb3Ii5vx8R9NIyfGtefQ04pod5MysUfeq
3tC/AoGAU70tRwJBOf46YigoicHvTpUQfJrHtDc+gCRXYGokBg0qM5o+Rh88NB1b
sDhcBmBA4rrML9mVF6xzj9TvYlt14XFpwT5uLdj/CAb1Ti/psiU/cykoHvUnK0+y
wbvg9NIdPXJUp0jOg2hWnc6ZkNPorEnNTjEhTA5QzOdD2bU/ENI=
-----END RSA PRIVATE KEY-----`;

let encPublicKeyString = `-----BEGIN PUBLIC KEY-----
MIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBw7Zq8McjphWnzjTN8T/0H
ukitNqWKSTIu6RWQP7OcuEuNQKTLE4Y5Cv+6gPoQslixD1KxHehJ7rqrm0lgGfL3
DVv5ljzNSzp+mYHwRaBghplXqjasE2BrI5uHwNMXgaZXbL8UZbNUrTjsdsSjcFrI
5XUhrsUPimlgO+4p2lh6w5vvlmSAZKCddOwCxvRrZ3IG7/aVPfftSTsLCU8Lkezt
crqSwTTq3MrO46kRsW9vX/VJLr9VShfbdV1VHPPDXKIhut2jlNmDpXWczssWQ311
h13+ZAVs9uKH/O7t88hwloSZDI77avbF2X4HmRYgRDfXBDe7JW6c0eeF8S8AGCSZ
AgMBAAE=
-----END PUBLIC KEY-----`;

function encryptApigee(plainText) {
    var sskey = random_key(16);
    var sskeyBytes = Buffer.from(sskey, 'utf8');
    const publicKey = forge.pki.publicKeyFromPem(encPublicKeyString);

    const encData = publicKey.encrypt(sskeyBytes, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: {
            md: forge.md.sha256.create()
        }
    });
    const encryptedHex = forge.util.bytesToHex(encData);
    const encryptedKey = Buffer.from(encryptedHex, 'hex').toString('base64');

    const plainSymmetricKey = sskey;
    const encryptedData = encrypt(plainText, plainSymmetricKey);

    const plainSymmetricKeyReceived = sskey;
    const result = calculateHmacSHA256(plainSymmetricKeyReceived, plainText);

    return {
        key: encryptedKey,
        data: encryptedData,
        hash: result,
    };
}

function decryptApigee(EncData, encryptedKEY, hash) {
    const privateKey = forge.pki.privateKeyFromPem(encPrivateKeyString);
    const decryptedBytes = privateKey.decrypt(Buffer.from(encryptedKEY, 'base64'), 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: {
            md: forge.md.sha256.create()
        }
    });
    const decryptedData = decrypt(EncData, decryptedBytes.toString());
    const result = calculateHmacSHA256(decryptedBytes.toString(), decryptedData);
    if (result == hash) {
        return decryptedData;
    }
    else {
        return null;
    }
}

function calculateHmacSHA256(plainSymmetricKeyReceived, encryptedData) {
    const hasher = crypto.createHmac('sha256', Buffer.from(plainSymmetricKeyReceived));
    const hash = hasher.update(encryptedData).digest('base64');
    return hash;
}

function getRandomBytes(length) {
    return crypto.randomBytes(length);
}

function getAESKeyFromPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 65536, 32, 'sha256');
}

function encrypt(plainText, plainSymmetricKey) {
    const salt = getRandomBytes(16);
    const iv = getRandomBytes(12);
    const aesKeyFromPassword = getAESKeyFromPassword(Buffer.from(plainSymmetricKey), salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', aesKeyFromPassword, iv);
    const cipherText = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const cipherTextWithIvSalt = Buffer.concat([iv, salt, cipherText, tag]);

    return cipherTextWithIvSalt.toString('base64');
}

function decrypt(data, plainSymmetricKey) {
    const decodedData = Buffer.from(data, 'base64');
    const iv = decodedData.slice(0, 12); // IV length is 12 bytes
    const salt = decodedData.slice(12, 28); // Salt length is 16 bytes
    const cipherText = decodedData.slice(28);  // remaining data

    const aesKeyFromPassword = getAESKeyFromPassword(Buffer.from(plainSymmetricKey), salt);

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyFromPassword, iv);

    decipher.setAuthTag(cipherText.slice(cipherText.length - 16)); // Auth tag length is 16 bytes

    const encryptedData = Buffer.concat([cipherText.slice(0, cipherText.length - 16)]);


    const decryptedData = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
    ]);

    return decryptedData.toString('utf8');
}

module.exports = {
    validate_pan_card,
    validate_gstin_no,
    validate_cin_no,
    validate_ifsc_code,
    validate_bank_acc_number,
};