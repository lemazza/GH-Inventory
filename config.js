'use strict';

exports.DATABASE_URL = process.env.DATABASE_URL  ||  'mongodb://lemazza:12r46a@ds123675.mlab.com:23675/gh-inventory-db';
exports.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'mongodb://localhost/test-movieDb';


exports.PORT = process.env.PORT || 1800;

