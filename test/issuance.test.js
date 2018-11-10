'use strict';

const ganache = require('ganache-cli');
const provider = ganache.provider({ gasLimit: 10000000 });
const Web3 = require('web3');
const web3 = new Web3(provider);

const utils = require('../utils');

const assert = require('assert');

let admin;
let whitelisted;
let hacker;

let tokenContract;

beforeEach(async function() {
    this.timeout(0);
    let accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    whitelisted = accounts[3];
    hacker = accounts[9];

    tokenContract = await utils.Setup(web3, accounts);
});

describe('Issuance', () => {
    it('should allow the administrator to issue more tokens to verified accounts', async () => {
        await tokenContract.methods.issue(whitelisted, 500).send({ from: admin, gas: '1000000' });
        let balance = await tokenContract.methods.balanceOf(whitelisted).call();

        assert.strictEqual(balance, '500');
    });

    it('should not allow anybody else to issue tokens', async () => {
        try {
            await tokenContract.methods.issue(whitelisted, 500).send({ from: hacker, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow the administrator to issue tokens to an unverified account', async () => {
        try {
            await tokenContract.methods.issue(hacker, 500).send({ from: admin, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
