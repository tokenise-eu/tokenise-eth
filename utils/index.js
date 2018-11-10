'use strict';

const compile = require('./compile');
const migrate = require('./migrate');
const hash = require('./hash');
const setup = require('./setup');

module.exports = {
    Compile: compile,
    Migrate: migrate,
    Hash: hash,
    Setup: setup,
}
