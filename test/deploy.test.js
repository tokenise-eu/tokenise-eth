'use strict';

const ganache = require('ganache-cli');
const provider = ganache.provider({ gasLimit: 10000000 });
const Web3 = require('web3');
const web3 = new Web3(provider);

const scripts = require('../scripts');

const assert = require('assert');

let deployer;
let manager;

let controller;

beforeEach(async function() {
    this.timeout(0);
    let accounts = await web3.eth.getAccounts();
    deployer = accounts[0];
    manager = accounts[1];

    let result = await scripts.Deploy(provider);
    let controllerAddress = result.tokenInterface;

    const compiledController = require('../build/SecurityController.json');
    controller = new web3.eth.Contract(JSON.parse(compiledController.interface), controllerAddress);
});

describe('Deployment', () => {   
    it('should initially belong to deployer module', async () => {
        let owner = await controller.methods.owner().call();
        assert.equal(owner, deployer);
    });

    it('should be transferable', async () => {
        await controller.methods.finishMigration(manager).send({ from: deployer, gas: '1000000' });
        let owner = await controller.methods.owner().call();
        assert.equal(owner, manager);
    });

    it('should allow the manager to interact with the token contract after deployment', async () => {
        await controller.methods.finishMigration(manager).send({ from: deployer, gas: '1000000' });

        try {
            await controller.methods.freeze().send({ from: manager, gas: '1000000' });
            assert(true);
        } catch (e) {
            console.log(e.message);
            assert(false);
        }
    });
});