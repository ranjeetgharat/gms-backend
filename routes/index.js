const express = require('express');
const homeController = require('../controller/homeController');
const entityController = require('../controller/entityController');
const adminController = require('../controller/adminController');

const routerInitialize = (config) => {
    const router = express.Router();
    router.use('/', homeController({ config }));
    router.use('/', entityController({ config }));
    router.use('/', adminController({ config }));

    return router;
}

module.exports = routerInitialize;
