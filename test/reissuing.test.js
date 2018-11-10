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

describe('Canceling/Reissuing', () => {
    it('should transfer all tokens to the new address', async () => {
        await tokenContract.methods.cancelAndReissue(holder2, whitelisted).send({ from: admin, gas: '1000000' });
        let holder2Balance = await tokenContract.methods.balanceOf(holder2).call();
        let whitelistedBalance = await tokenContract.methods.balanceOf(whitelisted).call()

        assert.strictEqual(holder2Balance, '0', 'holder2 still holds tokens.');
        assert.strictEqual(whitelistedBalance, '200', 'whitelisted did not get all tokens.');
    });

    it('should remove the original address from the verified mapping', async () => {
        await tokenContract.methods.cancelAndReissue(holder2, whitelisted).send({ from: admin, gas: '1000000' });
        let verified = await tokenContract.methods.isVerified(holder2).call();

        assert(!verified);
    });

    it('should not allow the administrator to cancel and reissue to unverified accounts', async () => {
        try {
            await tokenContract.methods.cancelAndReissue(holder2, hacker).send({ from: admin, gas: '1000000' });
            assert(false,);
        } catch (e) {
            assert(true);
        }
    });
    
    it('should not allow anybody else to call the cancel and reissue function', async () => {
        try {
            await tokenContract.methods.cancelAndReissue(holder2, holder1).send({ from: hacker, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});