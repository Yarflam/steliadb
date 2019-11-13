require('regenerator-runtime');
const SteliaDb = require('./steliadb');

/* Browser Support */
if (typeof window !== 'undefined') {
    window.SteliaDb = SteliaDb;
}
