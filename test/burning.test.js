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

describe('Burning', () => {
    it('should allow the manager to burn tokens', async () => {
        let balance = await tokenContract.methods.balanceOf(holder1).call();
        console.log(balance);
        await controller.methods.burn(holder1, 50).send({ from: manager, gas: '1000000' });
        let newBalance = await tokenContract.methods.balanceOf(holder1).call();
        
        assert.equal(newBalance, 50);
    });

    it('should not allow the manager to burn more than the account balance', async () => {
        try {
            await controller.methods.burn(holder2, 300).send({ from: manager, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });

    it('should not allow anybody else to call the burn function', async () => {
        try {
            await controller.methods.burn(holder2, 50).send({ from: hacker, gas: '1000000' });
            assert(false);
        } catch (e) {
            assert(true);
        }
    });
});