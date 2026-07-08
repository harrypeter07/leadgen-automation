const pino = require('pino');

// Deliberately NOT using pino-pretty transport here — it's an extra dependency
// that isn't installed by default (see package.json), and a missing transport
// module would crash the logger itself on boot. Plain JSON logs are fine for
// Railway's log viewer; add pino-pretty locally later if you want colorized
// dev output, but don't make it a runtime dependency of this service.
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

module.exports = logger;
