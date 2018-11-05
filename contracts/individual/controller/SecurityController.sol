pragma solidity 0.4.25;

import "../helpers/Ownable.sol";
import "../token/SecurityToken.sol";

/**
 * @title Security controller
 * The security controller acts as a bridge between the security token
 * and the administrator. It rounds up all the functions in a Security
 * token contract into a few neatly ordered functions for ease of use.
 * 
 * The security controller provides all functionality needed to manage a
 * security token without interfacing with the token contract directly.
 *
 * On top of this, the security controller provides functionality needed for
 * contract launch and contract migration. It works in tandem with the
 * tokenise off-chain applications in order to provide a fully compliant
 * security token standard, easily managable by clients.
 *
 * @dev https://github.com/tokenise-eu/tokenise-eth
 */
contract SecurityController is Ownable {

    address public deployedToken;
    address public manager;

    SecurityToken token;

    bool public deployed;
    bool public migrated;
    bool public closed;
    
    /**
     *  This event is emitted when a newly deployed token contract is properly
     *  populated with the data it needs, and is handed over from the deployer
     *  module to the administrator.
     */
    event Ready();
    
    /**
     *  This event is emitted when a token contract is deployed via the
     *  security controller. This event will signal the off-chain applications
     *  to set data migration in motion.
     *  @param tokenContract The address of the newly deployed token contract.
     */
    event Deployed(address indexed tokenContract);
    
    modifier notClosed() {
        assert(!closed);
        _;
    }
    
    modifier isDeployed() {
        assert(deployed);
        _;
    }

    modifier notMigrated() {
        assert(!migrated);
        _;
    }

    /**
     *  Initializes the controller.
     */
    constructor() 
        public 
    {
        super.initialize(msg.sender);
        deployed = false;
        migrated = false;
        closed = false;
    }
    
    /**
     *  Fallback function. Rejects payments and returns the spent gas.
     */
    function() 
        public 
        payable 
    {
        revert("This contract does not accept payments.");
    }

    /**
    *  Create the ERC-884 contract with the chosen name and symbol.
    *  @param _name The name of the token contract.
    *  @param _symbol The symbol/ticker for the token contract.
    */
    function createToken(string _name, string _symbol) 
        public 
        onlyOwner 
    {
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
    *  Issue an amount of shares to an address. Address must be verified in the token contract
    *  it's calling the function on.
    *  @param _to The address which will receive the shares.
    *  @param _amount The amount of shares received by the address.
    *  @return A boolean indicating if minting was successful.
    */
    function issue(address _to, uint256 _amount) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
        returns (bool) 
    {
        return token.mint(_to, _amount);
    }

    /** 
    *  Whitelist ethereum addres for receiving, holding and transfering shares. A string of holder information
    *  should be included to then be hashed and stored in the token contract. This information string
    *  should match the string of information in the off-chain database.
    *  @param _addr The address which will be whitelisted
    *  @param _data The KYC data for the specific address. This data will be hashed and stored in the contract,
    *  allowing regulators to cross-check the off-chain database with the contract by comparing hashes.
    */
    function whitelist(address _addr, string _data) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
    {
        bytes32 hash = keccak256(abi.encodePacked(_data));
        token.addVerified(_addr, hash);
    }

    /** 
    *  Remove someone from the whitelist. This will remove their address and information
    *  hash from the token contract.
    *  @param _addr The address that will be removed.
    */
    function removeWhitelist(address _addr) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
    {
        token.removeVerified(_addr);
    }

    /** 
    *  A toggle function to freeze any and all transfers within the token contract.
    *  @return A boolean indicating if funds are now frozen or unfrozen.
    */
    function freeze() 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
        returns (bool) 
    {
        return token.freeze();
    }

    /**
    *  A toggle function to freeze funds of a single account holder.
    *  @param _addr The address for which to lock/unlock funds.
    *  @return A boolean indicating if funds are now frozen or unfrozen for the holder.
    */
    function lock(address _addr) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
        returns (bool) 
    {
        return token.lock(_addr);
    }

    /**
    *  A function for the administrator to transfer anyone's tokens at any time.
    *  @param _from The address the tokens will be transferred form.
    *  @param _to The address the tokens will be transferred to.
    *  @param _amount The amount of tokens to send.
    */
    function masterTransfer(address _from, address _to, uint256 _amount) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
    {
        token.masterTransfer(_from, _to, _amount);
    }

    /**
    *  A function to burn an account's tokens.
    *  @param _from The address to burn the tokens from.
    *  @param _amount The amount of tokens to burn.
    */
    function burn(address _from, uint256 _amount) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
    {
        token.burn(_from, _amount);
    }

    /** 
    *  A function which, after migrating from another contract/blockchain, will allow the deployer to populate
    *  this new contract with all the old data.
    *  @param _address The address of the migrated shareholder.
    *  @param _data The data of the shareholder.
    *  @param _balance The balance of the shareholder before migration point.
    */
    function migrate(address _address, string _data, uint256 _balance) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
        notMigrated 
        returns (bool) 
    {
        bytes32 hash = keccak256(abi.encodePacked(_data));
        token.addVerified(_address, hash);
        if (_balance > 0) {
            // This will return false if verification failed, so we won't need to check it here.
            return token.mint(_address, _balance);
        }

        // Check if verification went through if account did not have any tokens.
        return token.isVerified(_address);
    }
    
    /** 
    *  A function that signals the completion of setup and migration, hands the controls off to the administrator,
    *  and signals the off-chain applications to begin running.
    *  @param _newOwner The address of the administrator.
    */
    function finishMigration(address _newOwner) 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
        notMigrated 
    {
        if (_newOwner != address(0) && _newOwner != owner) {
            super.transferOwnership(_newOwner);
        }

        migrated = true;
        emit Ready();
    }

    /** 
    *  A function to invoke migration to another contract/blockchain. Freezes the current contract, signals
    *  the off-chain apps to begin migration, and then selfdestructs.
    */
    function closeForMigration() 
        public 
        onlyOwner 
        notClosed 
        isDeployed 
    {
        closed = true;
        token.freezeSuper();
        selfdestruct(manager);
    }

    /** 
    *  Retrieve the address of the token contract deployed by this controller.
    *  @return The address of the token contract.
    */
    function getOfferingAddress() 
        public 
        view 
        notClosed 
        isDeployed 
        returns (address) 
    {
        return deployedToken;
    }

    /**
    *  This function allows for easy cross-checking with the smart contract database of information hashes.
    *  @param _addr The address that will be looked up
    *  @param _data The KYC data for the specific address. This will be hashed and passed into the hasHash function.
    *  @return A boolean indicating if a match was found. 
    */
    function check(address _addr, string _data) 
        public 
        view 
        notClosed 
        isDeployed 
        returns (bool) 
    {
        bytes32 hash = keccak256(abi.encodePacked(_data));
        return token.hasHash(_addr, hash);
    }
}
