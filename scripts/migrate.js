'use strict';

const Web3 = require('web3');

async function migrate(provider, controller, manager, addresses, data) {
    const web3 = new Web3(provider);
    const accounts = await web3.eth.getAccounts();
    if (!addresses && !data) {
        await controller.methods.finishMigration(manager).send({ from: accounts[0], gas: '1000000' });
    } else {
        if (typeof addresses !== Array || typeof data !== Array) {
            throw TypeError('Migration information needs to be in array form');
        } else {
            //
            await controller.methods.finishMigration(manager).send({ from: accounts[0], gas: '1000000' });
        }
    }
}

module.exports = migrate;