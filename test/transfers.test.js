'use strict';

const ganache = require('ganache-cli');
const provider = ganache.provider({ gasLimit: 10000000 });
const Web3 = require('web3');
const web3 = new Web3(provider);

const utils = require('../utils');

const assert = require('assert');

let admin;
let holder1;
let holder2;
let whitelisted;
let hacker;

let tokenContract;

beforeEach(async function() {
    this.timeout(0);
    let accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    holder1 = accounts[1];
    holder2 = accounts[2];
    whitelisted = accounts[3];
    hacker = accounts[9];

    tokenContract = await utils.Setup(web3, accounts);
});

describe('Transfers', () => {
    it('should allow transfers between verified accounts', async () => {
        try {
            await tokenContract.methods.transfer(whitelisted, 50).send({ from: holder2, gas: '1000000' });
            assert(true);
        } catch (e) {
            assert(false);
        }
    });

    it('should update holders after transfer', async () => {
        await tokenContract.methods.transfer(whitelisted, 50).send({ from: holder2, gas: '1000000' });

        let isHolderAfterTransfer = await tokenContract.methods.isHolder(whitelisted).call();
        assert(isHolderAfterTransfer);
    });

    it('should update balances after transfer', async () => {
        await tokenContract.methods.transfer(whitelisted, 50).send({ from: holder2, gas: '1000000' });

        let holder2Balance = await tokenContract.methods.balanceOf(holder2).call();
        assert.strictEqual(holder2Balance, '150', 'Contract did not update balance properly for holder2');

        let whitelistedBalance = await tokenContract.methods.balanceOf(whitelisted).call();
        assert.strictEqual(whitelistedBalance, '50', 'Contract did not update balance properly for whitelisted');
    });

    it('should not allow transfers to unverified accounts', async () => {
        try {
            await tokenContract.methods.transfer(hacker, 50).send({ from: holder2, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
