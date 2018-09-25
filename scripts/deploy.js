'use strict';

const Web3 = require('web3');
const utils = require('../utils');

async function deploy(provider) {
    var tokenInterface;
    var tokenContract;

    const web3 = new Web3(provider);

    const accounts = await web3.eth.getAccounts();

    console.log('Compiling contracts...');
    try {
        utils.Compile();
    } catch (e) {
        console.log('Error, ', e);
        throw e;
    }
    console.log('Success!');
    
    console.log('Deploying contracts...');
    try {
        console.log('Deploying controller...');
        const compiledController = require('../build/SecurityController.json');
        const controller = await new web3.eth.Contract(JSON.parse(compiledController.interface))
            .deploy({ data: compiledController.bytecode })
            .send({ from: accounts[0], gas: '7000000' });
        tokenInterface = controller.options.address;
        console.log('Success!');

        console.log('Deploying token contract...');
        await controller.methods.createToken("Test", "TST").send({ from: accounts[0], gas: '1000000' });
        const token = await controller.methods.deployedToken().call();
        tokenContract = token;
        console.log('Success!');
    } catch (e) {
        console.log('Error, ', e);
        throw e;
    } finally {
        console.log('Deployment successful!');
        return tokenInterface, tokenContract;
    }
}

module.exports = deploy;