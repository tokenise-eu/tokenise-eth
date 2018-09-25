'use strict';

const path = require('path');
const solc = require('solc');
const fs = require('fs-extra');

function compile() {
	const buildPath = path.resolve(__dirname, '..', 'build');
	fs.removeSync(buildPath);

	const masterPath = path.resolve(__dirname, '..', 'contracts', 'master', 'Master.sol');
	
	const source = fs.readFileSync(masterPath, 'utf8');
	const output = solc.compile(source, 1).contracts;

	fs.ensureDirSync(buildPath);

	for (let contract in output) {
		fs.outputJsonSync(
			path.resolve(buildPath, contract.replace(':','') + '.json'),
			output[contract]
		);
	}
}

module.exports = compile;