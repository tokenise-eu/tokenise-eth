'use strict';

const deploy = require('./deploy');
const migrate = require('./migrate');

module.exports = {
    Deploy: deploy,
    Migrate: migrate,
}