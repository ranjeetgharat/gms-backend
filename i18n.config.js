const { I18n } = require('i18n');
const path = require('path');

const i18n = new I18n({
    locales: ['en', 'hin', 'mar'],
    defaultLocale: 'en',
    header: 'accept-language',
    autoReload: true,
    updateFiles: false,
    directory: path.join('./', 'locales')
});

module.exports = i18n;
