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

    // Hand off to manager
    await scripts.Migrate(controller, deployer, manager);

    // Whitelist accounts
    await controller.methods.whitelist(holder1, 'Test').send({ from: manager, gas: '1000000' });
    await controller.methods.whitelist(holder2, 'Test').send({ from: manager, gas: '1000000' });
    await controller.methods.whitelist(whitelisted, 'Test').send({ from: manager, gas: '1000000' });

    // Issue shares
    await controller.methods.issue(holder1, 100).send({ from: manager, gas: '1000000' });
    await controller.methods.issue(holder2, 200).send({ from: manager, gas: '1000000' });
});

describe('Whitelisting', () => {
    it('should list holders appropriately', async () => {
        let isHolder1 = await tokenContract.methods.isHolder(holder1).call();
        let isHolder2 = await tokenContract.methods.isHolder(holder2).call();
        let isHolder3 = await tokenContract.methods.isHolder(whitelisted).call();
        let isHolder4 = await tokenContract.methods.isHolder(hacker).call();

        assert(isHolder1 == true 
            && isHolder2 == true 
            && isHolder3 == false 
            && isHolder4 == false);
    });

    it('should list verified addresses appropriately', async () => {
        let isVerified1 = await tokenContract.methods.isVerified(holder1).call();
        let isVerified2 = await tokenContract.methods.isVerified(holder2).call();
        let isVerified3 = await tokenContract.methods.isVerified(whitelisted).call();
        let isVerified4 = await tokenContract.methods.isVerified(hacker).call();

        assert(isVerified1 == true 
            && isVerified2 == true 
            && isVerified3 == true 
            && isVerified4 == false);
    });

    it('should list the correct balances', async () => {
        let holder1Balance = await tokenContract.methods.balanceOf(holder1).call();
        let holder2Balance = await tokenContract.methods.balanceOf(holder2).call();
        let whitelistedBalance = await tokenContract.methods.balanceOf(whitelisted).call();

        assert.equal(holder1Balance, 100);
        assert.equal(holder2Balance, 200);
        assert.equal(whitelistedBalance, 0);
    });
});