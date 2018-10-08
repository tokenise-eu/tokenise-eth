'use strict';

const ganache = require('ganache-cli');
const provider = ganache.provider({ gasLimit: 10000000 });
const Web3 = require('web3');
const web3 = new Web3(provider);

const scripts = require('../scripts');

const assert = require('assert');

let deployer;
let manager;
let holder1;
let holder2;
let whitelisted;
let hacker;

let controller;
let tokenContract;

beforeEach(async function() {
    this.timeout(0);
    let accounts = await web3.eth.getAccounts();
    deployer = accounts[0];
    manager = accounts[1];
    holder1 = accounts[2];
    holder2 = accounts[3];
    whitelisted = accounts[4];
    hacker = accounts[9];

    let result = await scripts.Deploy(provider);
    let controllerAddress = result.tokenInterface;
    let tokenContractAddress = result.tokenContract;

    const compiledController = require('../build/SecurityController.json');
    const compiledToken = require('../build/SecurityToken.json');

    controller = new web3.eth.Contract(JSON.parse(compiledController.interface), controllerAddress);
    tokenContract = new web3.eth.Contract(JSON.parse(compiledToken.interface), tokenContractAddress);

    // Whitelist accounts
    await controller.methods.whitelist(holder1, 'Test').send({ from: deployer, gas: '1000000' });
    await controller.methods.whitelist(holder2, 'Test').send({ from: deployer, gas: '1000000' });
    await controller.methods.whitelist(whitelisted, 'Test').send({ from: deployer, gas: '1000000' });

    // Issue shares
    await controller.methods.issue(holder1, 100).send({ from: deployer, gas: '1000000' });
    await controller.methods.issue(holder2, 200).send({ from: deployer, gas: '1000000' });

    // Hand off to manager
    await scripts.Migrate(controller, deployer, manager);
});

describe('Transfers', () => {
    it('should allow transfers between whitelisted accounts', async () => {
        try {
            await tokenContract.methods.transfer(whitelisted, 50).send({ from: holder2, gas: '1000000' });
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
        assert.equal(holder2Balance, 150);

        let whitelistedBalance = await tokenContract.methods.balanceOf(whitelisted).call();
        assert.equal(whitelistedBalance, 50);
    });

    it('should not allow transfers between whitelisted accounts and non-whitelisted accounts', async () => {
        try {
            await tokenContract.methods.transfer(hacker, 50).send({ from: holder2, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});

describe('Locking', () => {
    beforeEach(async () => {
        await controller.methods.lock(holder1).send({ from: manager, gas: '1000000' });
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
        await controller.methods.freeze().send({ from: manager, gas: '1000000' });
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