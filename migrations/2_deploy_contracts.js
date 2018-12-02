var SecurityToken = artifacts.require("./SecurityToken.sol");

module.exports = function(deployer) {
  deployer.deploy(SecurityToken, "Test", "TST");
};
