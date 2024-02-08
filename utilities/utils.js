require("dotenv").config()
const crypto = require('crypto');
const uuid = require('uuid');
var validator = require('validator');
const { validationTypes } = require("../constants/validationTypes");
const correlator = require('express-correlation-id');

function db_date_to_ist(now) {
    // if (now) {
    //     const currentTimeInIST = new Date(now.getTime() + Constants.istOffsetMinutes * 60 * 1000);
    //     return currentTimeInIST;
    // }
    return now;
}

function parse_api_date_string(str) {
    if (str != null && str.length > 0) {
        try {
            const tmp = str.split('/').join('-');
            const [day, month, year] = tmp.split('-');
            const date = new Date(+year, month - 1, day);
            return date;
        } catch (_) {
            return null;
        }
    }
    return null;
}

function isUUID(str) {
    if (str != null && str.length > 0) {
        return uuid.validate(str);
    }
    return false;
}

function is_valid_ipv4(ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipv4Pattern.test(ip);
}

function is_valid_ipv6(ip) {
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv6Pattern.test(ip);
}

function is_valid_ip(ip) {
    return is_valid_ipv4(ip) || is_valid_ipv6(ip);
}

function is_mobile_no(number) {
    const pattern = /^[6-9]{1}[0-9]{9}$/;
    return pattern.test(number);
}

function is_pin_code(number) {
    const pattern = /^[0-9]{6}$/;
    return pattern.test(number);
}

function is_pan_no(number) {
    const pattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return pattern.test(number);
}

function is_gstn_no(number) {
    const pattern = /^([0][1-9]|[1-2][0-9]|[3][0-7])([a-zA-Z]{5}[0-9]{4}[a-zA-Z]{1}[1-9a-zA-Z]{1}[zZ]{1}[0-9a-zA-Z]{1})+$/;
    return pattern.test(number);
}

function is_cin_no(number) {
    const pattern = /^[L/U]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
    return pattern.test(number);
}

function is_ifsc_code(number) {
    const pattern = /^[A-Z]{4}[0]{1}[0-9]{6}$/;
    return pattern.test(number);
}

function is_bank_account_no(number) {
    const pattern = /^\d{9,18}$/;
    return pattern.test(number);
}

function slugify_url(url) {
    return url.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
}

function check_in_entity(e, list) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].toString() == e.toString()) {
            return true;
        }
    }
    return false;
}

function check_in_array(val, list) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].toString() == val.toString()) {
            return true;
        }
    }
    return false;
}

function build_query_obj(query, replacements) {
    const finalizedQuery = query.replace(/:(\w+)/g, (match, placeholder) => {
        return replacements[placeholder] !== undefined ? replacements[placeholder] : match;
    });
    return finalizedQuery;
}

function build_query_array(query, replacements) {
    let currentIndex = 0;
    const finalizedQuery = query.replace(/\?/g, () => {
        const replacementValue = replacements[currentIndex++];
        return db.sequelize.escape(replacementValue); // Escaping the value for proper formatting
    });
    return finalizedQuery;
}

const random_key = (length) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, charset.length);
        key += charset[randomIndex]
    }
    return key;
};

const random_int = (length) => {
    return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1) - 1));
}

const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

const bytes_to_readable = (x) => {
    let l = 0, n = parseInt(x, 10) || 0;
    while (n >= 1024 && ++l) {
        n = n / 1024;
    }
    return (n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
};

function accred_request_status_text(status) {
    var _status = status && validator.isNumeric(status.toString()) ? parseInt(status) : 0;
    if (_status == 0) {
        return "Pending";
    }
    if (_status == 1) {
        return "Approved";
    }
    if (_status == 2) {
        return "Rejected";
    }
    if (_status == 3) {
        return "Cancelled";
    }
    return "Unknown";
}

function accred_request_status_color(status) {
    var _status = status && validator.isNumeric(status.toString()) ? parseInt(status) : 0;
    if (_status == 0) {
        return "#212529";
    }
    if (_status == 1) {
        return "#008000";
    }
    if (_status == 2 || _status == 3) {
        return "#ff0000";
    }
    return "#212529";
}

function role_status_text(status) {
    var _status = status && validator.isNumeric(status.toString()) ? parseInt(status) : 0;
    if (_status == 0) {
        return "Pending";
    }
    if (_status == 1) {
        return "Approved";
    }
    if (_status == 2) {
        return "Rejected";
    }
    if (_status == 3) {
        return "Cancelled";
    }
    return "Unknown";
}

function role_status_color(status) {
    var _status = status && validator.isNumeric(status.toString()) ? parseInt(status) : 0;
    if (_status == 0) {
        return "#212529";
    }
    if (_status == 1) {
        return "#008000";
    }
    if (_status == 2 || _status == 3) {
        return "#ff0000";
    }
    return "#212529";
}

const has_entity_permission = (PageId, permissions) => {
    if (!PageId) {
        return false;
    }
    for (let i = 0; permissions !== null && i < permissions.length; i++) {
        if (permissions[i].id.toString() === PageId.toString()) {
            return permissions[i].allowed;
        }
    }
    return false;
}

function project_apply_status_text(status) {
    var _status = status && validator.isNumeric(status.toString()) ? parseInt(status) : 0;
    if (_status == 0) {
        return "Pending";
    }
    if (_status == 1) {
        return "Awarded";
    }
    if (_status == 2) {
        return "Rejected";
    }
    if (_status == 3) {
        return "Accepted";
    }
    if (_status == 4) {
        return "Rejected";
    }
    return "Unknown";
}

function check_field_validations(validations, _user_value, field_type, field_values, lable_name) {
    var result = { has_error: false, error_msg: '' };
    for (let v = 0; validations && v < validations.length; v++) {
        if (validations[v].vld_type_id.toString() == validationTypes.REQUIRED.toString()) {
            if (_user_value.length <= 0) {
                result.has_error = true; result.error_msg = capabilities_first_letter(lable_name) + ' is mandatory.'; break;
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.MAX_LENGTH.toString()) {
            const maxLen = validations[v].pattern_value != null && validator.isNumeric(validations[v].pattern_value.toString()) ? parseInt(validations[v].pattern_value) : 0;
            if (maxLen > 0 && _user_value.length > maxLen) {
                result.has_error = true; result.error_msg = capabilities_first_letter(lable_name) + ' should not be more than ' + maxLen.toString() + ' character.'; break;
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.MIN_LENGTH.toString()) {
            const minLen = validations[v].pattern_value != null && validator.isNumeric(validations[v].pattern_value.toString()) ? parseInt(validations[v].pattern_value) : 0;
            if (minLen > 0 && _user_value.length < minLen) {
                result.has_error = true; result.error_msg = capabilities_first_letter(lable_name) + ' should not be less than ' + minLen.toString() + ' character.'; break;
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.NUMBER_ONLY.toString()) {
            if (_user_value.length > 0) {
                var t = [..._user_value].every(c => '0123456789'.includes(c));
                if (!t) {
                    result.has_error = true; result.error_msg = 'Only number allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.DECIMAL.toString()) {
            if (_user_value.length > 0) {
                const t = _user_value && validator.isNumeric(_user_value.toString()) ? parseFloat(_user_value) : 0;
                if (t <= 0) {
                    result.has_error = true; result.error_msg = 'Only decimal number allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.LETTERS_ONLY.toString()) {
            if (_user_value.length > 0) {
                const pattern = /^[a-zA-Z]+$/;
                if (!pattern.test(_user_value)) {
                    result.has_error = true; result.error_msg = 'Only letters without space allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.LETTERS_SPACE.toString()) {
            if (_user_value.length > 0) {
                const pattern = /^[a-zA-Z ]+$/;
                if (!pattern.test(_user_value)) {
                    result.has_error = true; result.error_msg = 'Only letters with space allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.EMAIL_ADDRESS.toString()) {
            if (_user_value.length > 0) {
                if (!validator.isEmail(_user_value)) {
                    result.has_error = true; result.error_msg = "Please enter correct email id for " + lable_name.toLowerCase() + "."; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.PATTERN.toString()) {
            if (_user_value.length > 0) {
                const pattern = new RegExp(validations[v].pattern_value);
                if (!pattern.test(_user_value)) {
                    result.has_error = true; result.error_msg = 'Invalid value for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.WEBSITE_URL.toString()) {
            if (_user_value.length > 0) {
                if (!validator.isURL(_user_value)) {
                    result.has_error = true; result.error_msg = 'Enter correct url for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
    }
    if (_user_value.length > 0) {
        if (field_type.toLowerCase() == 'select') {
            var _isMatch = false; var options = []; try { options = JSON.parse(field_values); } catch (_) { }
            for (let i = 0; options && i < options.length; i++) {
                if (options[i].trim().toLowerCase() == _user_value.trim().toLowerCase()) {
                    _isMatch = true; break;
                }
            }
            if (!_isMatch) {
                result.has_error = true; result.error_msg = 'Invalid value for ' + lable_name.toLowerCase() + '.';
            }
        }
    }
    return result;
}

function check_field_validations_skip_req(validations, _user_value, field_type, field_values, lable_name) {
    var result = { has_error: false, error_msg: '' };
    for (let v = 0; validations && v < validations.length; v++) {
        if (validations[v].vld_type_id.toString() == validationTypes.MAX_LENGTH.toString()) {
            const maxLen = validations[v].pattern_value != null && validator.isNumeric(validations[v].pattern_value.toString()) ? parseInt(validations[v].pattern_value) : 0;
            if (maxLen > 0 && _user_value.length > maxLen) {
                result.has_error = true; result.error_msg = capabilities_first_letter(lable_name) + ' should not be more than ' + maxLen.toString() + ' character.'; break;
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.MIN_LENGTH.toString()) {
            const minLen = validations[v].pattern_value != null && validator.isNumeric(validations[v].pattern_value.toString()) ? parseInt(validations[v].pattern_value) : 0;
            if (minLen > 0 && _user_value.length < minLen) {
                result.has_error = true; result.error_msg = capabilities_first_letter(lable_name) + ' should not be less than ' + minLen.toString() + ' character.'; break;
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.NUMBER_ONLY.toString()) {
            if (_user_value.length > 0) {
                var t = [..._user_value].every(c => '0123456789'.includes(c));
                if (!t) {
                    result.has_error = true; result.error_msg = 'Only number allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.DECIMAL.toString()) {
            if (_user_value.length > 0) {
                const t = _user_value && validator.isNumeric(_user_value.toString()) ? parseFloat(_user_value) : 0;
                if (t <= 0) {
                    result.has_error = true; result.error_msg = 'Only decimal number allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.LETTERS_ONLY.toString()) {
            if (_user_value.length > 0) {
                const pattern = /^[a-zA-Z]+$/;
                if (!pattern.test(_user_value)) {
                    result.has_error = true; result.error_msg = 'Only letters without space allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.LETTERS_SPACE.toString()) {
            if (_user_value.length > 0) {
                const pattern = /^[a-zA-Z ]+$/;
                if (!pattern.test(_user_value)) {
                    result.has_error = true; result.error_msg = 'Only letters with space allowed for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.EMAIL_ADDRESS.toString()) {
            if (_user_value.length > 0) {
                if (!validator.isEmail(_user_value)) {
                    result.has_error = true; result.error_msg = "Please enter correct email id for " + lable_name.toLowerCase() + "."; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.PATTERN.toString()) {
            if (_user_value.length > 0) {
                const pattern = new RegExp(validations[v].pattern_value);
                if (!pattern.test(_user_value)) {
                    result.has_error = true; result.error_msg = 'Invalid value for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
        if (validations[v].vld_type_id.toString() == validationTypes.WEBSITE_URL.toString()) {
            if (_user_value.length > 0) {
                if (!validator.isURL(_user_value)) {
                    result.has_error = true; result.error_msg = 'Enter correct url for ' + lable_name.toLowerCase() + '.'; break;
                }
            }
        }
    }
    if (_user_value.length > 0) {
        if (field_type.toLowerCase() == 'select') {
            var _isMatch = false; var options = []; try { options = JSON.parse(field_values); } catch (_) { }
            for (let i = 0; options && i < options.length; i++) {
                if (options[i].trim().toLowerCase() == _user_value.trim().toLowerCase()) {
                    _isMatch = true; break;
                }
            }
            if (!_isMatch) {
                result.has_error = true; result.error_msg = 'Invalid value for ' + lable_name.toLowerCase() + '.';
            }
        }
    }
    return result;
}

function capabilities_first_letter(s) {
    if (s && s.length > 0) {
        if (s.length > 1) {
            return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        }
        return s.charAt(0).toUpperCase();
    }
    return s;
}

function numberWithIndianFormat(x) {
    const numStr = x != null && x.toString().length > 0 ? String(x).replace(/,/g, '') : '';
    if (numStr.length > 0) {
        const numVal = numStr != null && validator.isNumeric(numStr.toString()) ? parseFloat(parseFloat(numStr).toFixed(2)) : 0;
        try {
            const formattedAmount = numVal.toLocaleString('en-IN', {
                currency: 'INR'
            });
            return formattedAmount;
        } catch (_) {
            return x;
        }
    } else {
        return x;
    }
}

function bill_desk_logger_obj(ip_address, message, data) {
    return JSON.stringify({
        correlation_id: correlator.getId(),
        ip_addr: ip_address,
        date_time: new Date(),
        gateway: 'bill-desk',
        message: message,
        data: data,
    });
}

function entity_reg_status_txt(status) {
    var _status = status != null && validator.isNumeric(status.toString()) ? parseInt(status) : -1;
    if (_status == 0) {
        return "Pending";
    }
    if (_status == 1) {
        return "Approved";
    }
    if (_status == 2) {
        return "Rejected";
    }
    if (_status == 3) {
        return "Resubmitted";
    }
    return "Unknown";
}

function entity_reg_status_html(status) {
    var _status = status != null && validator.isNumeric(status.toString()) ? parseInt(status) : -1;
    if (_status == 0) {
        return '<span style="color:#4489e4;">Pending</span>';
    }
    if (_status == 1) {
        return '<span style="color:#47ad77;">Approved</span>';
    }
    if (_status == 2) {
        return '<span style="color:#d03f3f;">Rejected</span>';
    }
    if (_status == 3) {
        return '<span style="color:#fd7e14;">Resubmitted</span>';
    }
    return '<span style="color:#212529;">Unknown</span>';
}

module.exports = {
    db_date_to_ist,
    parse_api_date_string,
    isUUID,
    is_valid_ip,
    is_mobile_no,
    is_pin_code,
    is_pan_no,
    is_gstn_no,
    is_cin_no,
    is_ifsc_code,
    is_bank_account_no,
    slugify_url,
    check_in_entity,
    check_in_array,
    build_query_obj,
    build_query_array,
    random_key,
    random_int,
    bytes_to_readable,
    accred_request_status_text,
    accred_request_status_color,
    role_status_text,
    role_status_color,
    has_entity_permission,
    project_apply_status_text,
    check_field_validations,
    check_field_validations_skip_req,
    capabilities_first_letter,
    numberWithIndianFormat,
    bill_desk_logger_obj,
    entity_reg_status_txt,
    entity_reg_status_html,
};