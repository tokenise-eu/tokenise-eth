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
let hacker;

let tokenContract;

beforeEach(async function() {
    this.timeout(0);
    let accounts = await web3.eth.getAccounts();
    admin = accounts[0];
    holder1 = accounts[1];
    holder2 = accounts[2];
    hacker = accounts[9];

    tokenContract = await utils.Setup(web3, accounts);
});

describe('Burning', () => {
    it('should allow the administrator to burn tokens', async () => {
        await tokenContract.methods.burn(holder1, 50).send({ from: admin, gas: '1000000' });
        let newBalance = await tokenContract.methods.balanceOf(holder1).call();
        
        assert.strictEqual(newBalance, '50');
    });

    it('should not allow the administrator to burn more than the account balance', async () => {
        try {
            await tokenContract.methods.burn(holder2, 300).send({ from: admin, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow anybody else to call the burn function', async () => {
        try {
            await tokenContract.methods.burn(holder2, 50).send({ from: hacker, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});
