pragma solidity ^0.4.24;

import "../helpers/Ownable.sol";
import "../token/SecurityToken.sol";

contract SecurityController is Ownable {
    address public deployedToken;
    address public manager;

    SecurityToken token;
    bool public deployed;
    bool public migrated;
    bool public closed;

    event Freeze();

    event Lock(address indexed locked);

    event Migrate();
    
    event Ready();
    
    event Deployed(address indexed tokenContract);
    
    modifier notClosed() {
        require(!closed, "This contract has migrated. Please use the new interface.");
        _;
    }
    
    modifier isDeployed() {
        require(deployed, "Your token contract has not yet been deployed. Call createOffering to deploy it.");
        _;
    }

    modifier notMigrated() {
        require(!migrated, "You have already finished migration.");
        _;
    }

    constructor() public {
        super.initialize(msg.sender);
        deployed = false;
        migrated = false;
        closed = false;
    }
    
    function() public payable {
        revert("This contract does not accept payments.");
    }

    /**
    * This function will create the ERC-884 contract with the chosen name and symbol.
    * @param _name will be the name of the token contract
    * @param _symbol will be the symbol/ticker for the token contract
    */
    function createToken(string _name, string _symbol) public onlyOwner {
        if (!deployed) {
            address newToken = new SecurityToken(_name, _symbol);
            token = SecurityToken(newToken);
            deployedToken = newToken;
            token.initialize(address(this));
            deployed = true;
            emit Deployed(newToken);
        } else {
            revert("Contract already deployed an offering. If you would like to start another offering, please start up a new instance of this interface.");
        }
    }

    /** 
    * A simple function to retrieve the address of the token contract deployed by this controller.
    * @return the address of the token contract
    */
    function getOfferingAddress() public view notClosed isDeployed returns (address) {
        return deployedToken;
    }

    /** 
    * Simple function to issue shares.
    * @param _to is the address which will receive the shares
    * @param _amount is the amount of shares received by the address
    * @return a bool indicating success
    */
    function issue(address _to, uint256 _amount) public onlyOwner notClosed isDeployed returns (bool) {
        return token.mint(_to, _amount);
    }

    /** 
    * This function allows whitelisting ethereum addresses for receiving, holding and transfering shares.
    * @param _addr is the address which will be whitelisted
    * @param _data is the KYC data for the specific address. This data will be hashed and stored in the contract,
    * allowing regulators to cross-check the off-chain database with the contract
    */
    function whitelist(address _addr, string _data) public onlyOwner notClosed isDeployed {
        bytes32 hash = keccak256(abi.encodePacked(_data));
        token.addVerified(_addr, hash);
    }

    /**
    * This function allows for easy cross-checking with the smart contract database of information hashes.
    * @param _addr is the address that will be looked up
    * @param _data is the KYC data for the specific address. This will be hashed and passed into the hasHash function.
    * @return a bool indicated success or failure. 
    */
    function check(address _addr, string _data) public view notClosed isDeployed returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(_data));
        return token.hasHash(_addr, hash);
    }

    /** 
    * A function to remove someone from the whitelist.
    * @param _addr is the address that will be removed
    */
    function removeWhitelist(address _addr) public onlyOwner notClosed isDeployed {
        token.removeVerified(_addr);
    }

    /** 
    * A function to freeze any and all transfers within the token contract.
    */
    function freeze() public onlyOwner notClosed isDeployed returns (bool) {
        emit Freeze();
        return token.freeze();
    }

    /**
    * A function to freeze funds of a single account holder.
    */
    function lock(address _addr) public onlyOwner notClosed isDeployed returns (bool) {
        emit Lock(_addr);
        return token.lock(_addr);

    }

    /**
    * A function for the administrator to transfer anyone's tokens at any time.
    */
    function masterTransfer(address _from, address _to, uint256 _amount) public onlyOwner notClosed isDeployed {
        token.masterTransfer(_from, _to, _amount);
    }

    /**
    * A function to burn an account's tokens.
    */
    function burn(address _from, uint256 _amount) public onlyOwner notClosed isDeployed {
        token.burn(_from, _amount);
    }

    /** 
    * A function which, after migrating from another contract/blockchain, will allow the deployer to populate
    * this new contract with all the old data.
    * @param _address is the address of the migrated shareholder
    * @param _data is the data of the shareholder
    * @param _balance is the balance of the shareholder before migration point
    */
    function migrate(address _address, string _data, uint _balance) public onlyOwner notClosed isDeployed notMigrated {
        bytes32 hash = keccak256(abi.encodePacked(_data));
        token.addVerified(_address, hash);
        if (_balance > 0) {
            token.mint(_address, _balance);
        }
    }
    
    /** 
    * A function that signals the completion of setup and migration, hands the controls off to the owner,
    * and signals the off-chain applications to begin running.
    * @param _newOwner should be the address of the owner
    */
    function finishMigration(address _newOwner) public onlyOwner notClosed isDeployed notMigrated {
        if (_newOwner != address(0) && _newOwner != owner) {
            super.transferOwnership(_newOwner);
        }
        migrated = true;
        emit Ready();
    }

    /** 
    * A function to invoke migration to another contract/blockchain. Freezes the current contract, signals
    * the off-chain apps to begin migration, and then selfdestructs.
    */
    function closeForMigration() public onlyOwner notClosed isDeployed {
        emit Migrate();
        closed = true;
        token.freezeSuper();
        selfdestruct(manager);
    }
}