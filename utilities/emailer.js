const nodemailer = require("nodemailer");

const emailTransporter = nodemailer.createTransport({
    host: process.env.MAIL_SMTP,
    port: parseInt(process.env.MAIL_PORT),
    secure: ((process.env.MAIL_SSL_ENABLE).toLowerCase() == 'true'),
    auth: {
        user: process.env.MAIL_EMAIL_ID,
        pass: process.env.MAIL_PASSWORD
    }
});

module.exports = emailTransporter;