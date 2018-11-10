'use strict';

const hash = require('./hash');

async function setup(web3, accounts) {
    const compiledToken = require('../build/SecurityToken.json');
    const tokenContract = await new web3.eth.Contract(JSON.parse(compiledToken.interface))
        .deploy({ data: compiledToken.bytecode, arguments: ['Test', 'TST'] })
        .send({ from: accounts[0], gas: '7000000' });

    const infoHash = hash('Test');

    // Whitelist accounts
    await tokenContract.methods.addVerified(accounts[1], infoHash).send({ from: accounts[0], gas: '1000000' });
    await tokenContract.methods.addVerified(accounts[2], infoHash).send({ from: accounts[0], gas: '1000000' });
    await tokenContract.methods.addVerified(accounts[3], infoHash).send({ from: accounts[0], gas: '1000000' });

    // Issue shares
    await tokenContract.methods.issue(accounts[1], 100).send({ from: accounts[0], gas: '1000000' });
    await tokenContract.methods.issue(accounts[2], 200).send({ from: accounts[0], gas: '1000000' });

    return tokenContract;
}

module.exports = setup;
