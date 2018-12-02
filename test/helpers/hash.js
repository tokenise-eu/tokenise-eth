'use strict';

function hash(info) {
    return web3.utils.hexToBytes(web3.utils.soliditySha3(info));
}

module.exports = hash;