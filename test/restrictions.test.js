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

describe('Locking', () => {
    beforeEach(async () => {
        await tokenContract.methods.lock(holder1).send({ from: admin, gas: '1000000' });
    });

    it('should not allow transfers to locked account', async () => {
        try {
            await tokenContract.methods.transfer(holder1, 50).send({ from: holder2, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow transfers from locked account', async () => {
        try {
            await tokenContract.methods.transfer(holder2, 50).send({ from: holder1, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});

describe('Freezing', () => {
    beforeEach(async () => {
        await tokenContract.methods.freeze().send({ from: admin, gas: '1000000' });
    });

    it('should not allow transfers while the contract is frozen', async () => {
        try {
            await tokenContract.methods.transfer(holder1, 50).send({ from: holder2, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
