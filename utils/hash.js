'use strict';

const ganache = require('ganache-cli');
const provider = ganache.provider({ gasLimit: 10000000 });
const Web3 = require('web3');
const web3 = new Web3(provider);

function hash(info) {
    return web3.utils.hexToBytes(web3.utils.soliditySha3(info));
}

module.exports = hash;