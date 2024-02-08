require('dotenv').config(); // SUPPORT .ENV FILES
const express = require('express'); // BRING IN EXPRESS
const app = express(); // INITILIZE APP
const helmet = require("helmet");
const path = require('path');
const bodyParser = require('body-parser');
const correlator = require('express-correlation-id');
const _logger = require('./logger/winston').logger;
const requestLogger = require('./middleware/requestLogger');
const http = require('http'); // CORE MODULE, USED TO CREATE THE HTTP SERVER
const server = http.createServer(app); // CREATE HTTP SERVER USING APP
const port = process.env.PORT || '3001'; // INITIALIZE DEFAULT PORT OR PORT FROM ENVIRONMENT VARIABLE
process.env.TZ = "Asia/Kolkata";
BigInt.prototype.toJSON = function () { return this.toString() }

// CORS
const cors = require('cors');
app.use(cors());

// Multilingual SETUP
const i18n = require('./i18n.config');
app.use(i18n.init);


// VIEW ENGINE SETUP
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ limit: '50mb', extended: false })); // PARSE application/x-www-form-urlencoded
app.use(bodyParser.json({ limit: '50mb' })); // PARSE application/json

// USE STATIC FILES (CSS, JS, IMAGES)
app.use(express.static(path.join(__dirname, 'public')));

// USE STATIC FILES (uploads)
app.use("/uploads", express.static(path.join(__dirname, 'uploads')));



// SECURITY
app.disable('x-powered-by');
app.use(helmet.frameguard({ action: 'deny' }));



// middleware here
app.use(correlator());
app.use(requestLogger);

// ROUTES
const apiRoutes = require('./routes/index');
app.use('/', apiRoutes({ express }));

// DATABASE INITIALIZATION
const db = require('./database/postgresql_db');
db.initialize().catch((err) => {
  console.error('Failed to connect to the database:', err);
  process.exit(1); // TERMINATE THE APPLICATION IF THE DATABASE CONNECTION FAILS
});


if (parseInt(process.env.REDIS_ENABLED) > 0) {
  const redisDB = require('./database/redis_cache_db');
  redisDB.connect().then(() => {
    console.log('Redis cache connected successfully.');
  }).catch((err) => {
    console.error('Failed to connect to the redis cache:', err);
    process.exit(1); // TERMINATE THE APPLICATION IF THE REDIS CONNECTION FAILS
  });
}

/*
* START SERVER
*/

// SET THE PORT
app.set('port', port);

// LISTEN ON SPECIFIED PORT
server.listen(port);

// LOG WHICH PORT THE SERVER IS RUNNING ON
console.log('Server listening on port ' + port);

// ERROR HANDLER
app.use((err, req, res, next) => {
  try { _logger.error(err.stack); } catch (_) { }
  res.status(err.status || 500).send(err.stack);
});

// SCHEDULE JOBS

const schedule = require('node-schedule');
schedule.scheduleJob('0 0 */1 * * *', function () {
  console.log('The answer to life, the universe, and everything!');
});

process.on('SIGINT', function () {
  schedule.gracefulShutdown()
    .then(() => process.exit(0))
});

// EXPORT APP
module.exports = app;
