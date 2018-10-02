'use strict';

const Web3 = require('web3');

async function deploy(provider) {
    var tokenInterface;
    var tokenContract;

    const web3 = new Web3(provider);

    const accounts = await web3.eth.getAccounts();
    
    try {
        const compiledController = require('../build/SecurityController.json');
        const controller = await new web3.eth.Contract(JSON.parse(compiledController.interface))
            .deploy({ data: compiledController.bytecode })
            .send({ from: accounts[0], gas: '7000000' });
        tokenInterface = controller.options.address;

        await controller.methods.createToken("Test", "TST").send({ from: accounts[0], gas: '7000000' });
        const token = await controller.methods.deployedToken().call();
        tokenContract = token;
    } catch (e) {
        console.log('Error: ', e.message);
        throw e;
    } finally {
        return { tokenInterface, tokenContract };
    }
}

module.exports = deploy;