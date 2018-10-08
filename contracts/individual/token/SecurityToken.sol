pragma solidity ^0.4.24;

import "./ERC884.sol";
import "../ERC20/MintableToken.sol";

/**
 *  An `ERC20` compatible token that conforms to Delaware State Senate,
 *  149th General Assembly, Senate Bill No. 69: An act to Amend Title 8
 *  of the Delaware Code Relating to the General Corporation Law.
 *
 *  Implementation Details.
 *
 *  An implementation of this token standard SHOULD provide the following:
 *
 *  `name` - for use by wallets and exchanges.
 *  `symbol` - for use by wallets and exchanges.
 *
 *  In addition to the above the following optional `ERC20` function MUST be defined.
 *
 *  `decimals` — MUST return `0` as each token represents a single Share and Shares are non-divisible.
 *
 *  @dev Ref https://github.com/ethereum/EIPs/blob/master/EIPS/eip-884.md
 */
contract SecurityToken is ERC884, MintableToken {

    bytes32 constant private ZERO_BYTES = bytes32(0);
    address constant private ZERO_ADDRESS = address(0);

    uint256 public decimals = 0;
    string public name;
    string public symbol;

    mapping(address => bytes32) private verified;
    mapping(address => address) private cancellations;
    mapping(address => uint256) private holderIndices;
    mapping(address => bool) private locked;

    address[] private shareholders;

    bool private frozen = false;
    bool private closed = false;

    modifier isVerifiedAddress(address addr) {
        require(verified[addr] != ZERO_BYTES, "Not a valid address.");
        _;
    }

    modifier isShareholder(address addr) {
        require(holderIndices[addr] != 0, "Given address is not a shareholder.");
        _;
    }

    modifier isNotShareholder(address addr) {
        require(holderIndices[addr] == 0, "Given address is a shareholder");
        _;
    }

    modifier isNotCancelled(address addr) {
        require(cancellations[addr] == ZERO_ADDRESS, "Given address is cancelled.");
        _;
    }

    modifier isNotFrozen() {
        require(!frozen, "Contract is frozen.");
        _;
    }

    modifier isNotLocked(address _addr) {
        require(!locked[_addr], "Given address has been locked.");
        _;
    }
    
    modifier isNotClosed() {
        require(!closed, "This contract has migrated. Please update your pointers.");
        _;
    }

    constructor(string _name, string _symbol) public {
        name = _name;
        symbol = _symbol;
    }

    /**
     * As each token is minted it is added to the shareholders array.
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(address _to, uint256 _amount)
        public
        onlyOwner
        canMint
        isNotClosed
        isVerifiedAddress(_to)
        returns (bool)
    {
        // if the address does not already own share then
        // add the address to the shareholders array and record the index.
        updateShareholders(_to);
        return super.mint(_to, _amount);
    }

    /**
     *  The number of addresses that own tokens.
     *  @return the number of unique addresses that own tokens.
     */
    function holderCount()
        public
        view
        returns (uint)
    {
        return shareholders.length;
    }

    /**
     *  By counting the number of token holders using `holderCount`
     *  you can retrieve the complete list of token holders, one at a time.
     *  It MUST throw if `index >= holderCount()`.
     *  @param index The zero-based index of the holder.
     *  @return the address of the token holder with the given index.
     */
    function holderAt(uint256 index)
        public
        onlyOwner
        view
        returns (address)
    {
        require(index < shareholders.length, "Index out of range of shareholders array.");
        return shareholders[index];
    }

    /**
     *  Add a verified address, along with an associated verification hash to the contract.
     *  Upon successful addition of a verified address, the contract must emit
     *  `VerifiedAddressAdded(addr, hash, msg.sender)`.
     *  It MUST throw if the supplied address or hash are zero, or if the address has already been supplied.
     *  @param addr The address of the person represented by the supplied hash.
     *  @param hash A cryptographic hash of the address holder's verified information.
     */
    function addVerified(address addr, bytes32 hash)
        public
        onlyOwner
        isNotCancelled(addr)
    {
        require(addr != ZERO_ADDRESS, "Invalid address provided.");
        require(hash != ZERO_BYTES, "Invalid data hash provided.");
        require(verified[addr] == ZERO_BYTES, "Address has been verified already.");
        verified[addr] = hash;
        emit VerifiedAddressAdded(addr, hash, msg.sender);
    }

    /**
     *  Remove a verified address, and the associated verification hash. If the address is
     *  unknown to the contract then this does nothing. If the address is successfully removed, this
     *  function must emit `VerifiedAddressRemoved(addr, msg.sender)`.
     *  It MUST throw if an attempt is made to remove a verifiedAddress that owns Tokens.
     *  @param addr The verified address to be removed.
     */
    function removeVerified(address addr)
        public
        onlyOwner
    {
        require(balances[addr] == 0, "Address still holds tokens. Please empty the account before removing it from the list.");
        if (verified[addr] != ZERO_BYTES) {
            verified[addr] = ZERO_BYTES;
            emit VerifiedAddressRemoved(addr, msg.sender);
        }
    }

    /**
     *  Update the hash for a verified address known to the contract.
     *  Upon successful update of a verified address the contract must emit
     *  `VerifiedAddressUpdated(addr, oldHash, hash, msg.sender)`.
     *  If the hash is the same as the value already stored then
     *  no `VerifiedAddressUpdated` event is to be emitted.
     *  It MUST throw if the hash is zero, or if the address is unverified.
     *  @param addr The verified address of the person represented by the supplied hash.
     *  @param hash A new cryptographic hash of the address holder's updated verified information.
     */
    function updateVerified(address addr, bytes32 hash)
        public
        onlyOwner
        isVerifiedAddress(addr)
    {
        require(hash != ZERO_BYTES, "Invalid data hash provided.");
        bytes32 oldHash = verified[addr];
        if (oldHash != hash) {
            verified[addr] = hash;
            emit VerifiedAddressUpdated(addr, oldHash, hash, msg.sender);
        }
    }

    /**
     *  Cancel the original address and reissue the Tokens to the replacement address.
     *  Access to this function MUST be strictly controlled.
     *  The `original` address MUST be removed from the set of verified addresses.
     *  Throw if the `original` address supplied is not a shareholder.
     *  Throw if the replacement address is not a verified address.
     *  This function MUST emit the `VerifiedAddressSuperseded` event.
     *  @param original The address to be superseded. This address MUST NOT be reused.
     *  @param replacement The address  that supersedes the original. This address MUST be verified.
     */
    function cancelAndReissue(address original, address replacement)
        public
        onlyOwner
        isNotFrozen
        isShareholder(original)
        isNotShareholder(replacement)
        isVerifiedAddress(replacement)
    {
        // replace the original address in the shareholders array
        // and update all the associated mappings
        verified[original] = ZERO_BYTES;
        cancellations[original] = replacement;
        uint256 holderIndex = holderIndices[original] - 1;
        shareholders[holderIndex] = replacement;
        holderIndices[replacement] = holderIndices[original];
        holderIndices[original] = 0;
        balances[replacement] = balances[original];
        balances[original] = 0;
        emit VerifiedAddressSuperseded(original, replacement, msg.sender);
    }

    /**
     *  The `transfer` function MUST NOT allow transfers to addresses that
     *  have not been verified and added to the contract.
     *  If the `to` address is not currently a shareholder then it MUST become one.
     *  If the transfer will reduce `msg.sender`'s balance to 0 then that address
     *  MUST be removed from the list of shareholders.
     */
    function transfer(address to, uint256 value)
        public
        isNotFrozen
        isNotLocked(msg.sender)
        isNotLocked(to)
        isVerifiedAddress(to)
        returns (bool)
    {
        updateShareholders(to);
        pruneShareholders(msg.sender, value);
        return super.transfer(to, value);
    }

    /**
     *  The `transferFrom` function MUST NOT allow transfers to addresses that
     *  have not been verified and added to the contract.
     *  If the `to` address is not currently a shareholder then it MUST become one.
     *  If the transfer will reduce `from`'s balance to 0 then that address
     *  MUST be removed from the list of shareholders.
     */
    function transferFrom(address from, address to, uint256 value)
        public
        isNotFrozen
        isNotLocked(from)
        isNotLocked(to)
        isVerifiedAddress(to)
        returns (bool)
    {
        updateShareholders(to);
        pruneShareholders(from, value);
        return super.transferFrom(from, to, value);
    }

    function masterTransfer(address _from, address _to, uint256 _amount)
        public
        onlyOwner
        isNotFrozen
        isNotLocked(_from)
        isNotLocked(_to)
        isVerifiedAddress(_to)
        returns (bool)
    {
        updateShareholders(_to);
        pruneShareholders(_from, _amount);
        super._masterTransfer(_from, _to, _amount);
        emit MasterTransfer(_from, _to, _amount);
    }

    function burn(address _from, uint256 _amount) 
        public
        onlyOwner
        isNotFrozen
        isNotLocked(_from)
    {
        pruneShareholders(_from, _amount);
        super._burn(_from, _amount);
    }

    /**
     *  Tests that the supplied address is known to the contract.
     *  @param addr The address to test.
     *  @return true if the address is known to the contract.
     */
    function isVerified(address addr)
        public
        view
        returns (bool)
    {
        return verified[addr] != ZERO_BYTES;
    }

    /**
     *  Checks to see if the supplied address is a share holder.
     *  @param addr The address to check.
     *  @return true if the supplied address owns a token.
     */
    function isHolder(address addr)
        public
        view
        returns (bool)
    {
        return holderIndices[addr] != 0;
    }

    /**
     *  Checks that the supplied hash is associated with the given address.
     *  @param addr The address to test.
     *  @param hash The hash to test.
     *  @return true if the hash matches the one supplied with the address in `addVerified`, or `updateVerified`.
     */
    function hasHash(address addr, bytes32 hash)
        public
        view
        returns (bool)
    {
        if (addr == ZERO_ADDRESS) {
            return false;
        }
        return verified[addr] == hash;
    }

    /**
     *  Checks to see if the supplied address was superseded.
     *  @param addr The address to check.
     *  @return true if the supplied address was superseded by another address.
     */
    function isSuperseded(address addr)
        public
        view
        onlyOwner
        returns (bool)
    {
        return cancellations[addr] != ZERO_ADDRESS;
    }

    /**
     *  Gets the most recent address, given a superseded one.
     *  Addresses may be superseded multiple times, so this function needs to
     *  follow the chain of addresses until it reaches the final, verified address.
     *  @param addr The superseded address.
     *  @return the verified address that ultimately holds the share.
     */
    function getCurrentFor(address addr)
        public
        view
        onlyOwner
        returns (address)
    {
        return findCurrentFor(addr);
    }

    /**
     *  Recursively find the most recent address given a superseded one.
     *  @param addr The superseded address.
     *  @return the verified address that ultimately holds the share.
     */
    function findCurrentFor(address addr)
        internal
        view
        returns (address)
    {
        address candidate = cancellations[addr];
        if (candidate == ZERO_ADDRESS) {
            return addr;
        }
        return findCurrentFor(candidate);
    }

    /**
     *  If the address is not in the `shareholders` array then push it
     *  and update the `holderIndices` mapping.
     *  @param addr The address to add as a shareholder if it's not already.
     */
    function updateShareholders(address addr)
        internal
    {
        if (holderIndices[addr] == 0) {
            holderIndices[addr] = shareholders.push(addr);
        }
    }

    /**
     *  If the address is in the `shareholders` array and the forthcoming
     *  transfer or transferFrom will reduce their balance to 0, then
     *  we need to remove them from the shareholders array.
     *  @param addr The address to prune if their balance will be reduced to 0.
     @  @dev see https://ethereum.stackexchange.com/a/39311
     */
    function pruneShareholders(address addr, uint256 value)
        internal
    {
        uint256 balance = balances[addr] - value;
        if (balance > 0) {
            return;
        }
        uint256 holderIndex = holderIndices[addr] - 1;
        uint256 lastIndex = shareholders.length - 1;
        address lastHolder = shareholders[lastIndex];
        // overwrite the addr's slot with the last shareholder
        shareholders[holderIndex] = lastHolder;
        // also copy over the index (thanks @mohoff for spotting this)
        // ref https://github.com/davesag/ERC884-reference-implementation/issues/20
        holderIndices[lastHolder] = holderIndices[addr];
        // trim the shareholders array (which drops the last entry)
        shareholders.length--;
        // and zero out the index for addr
        holderIndices[addr] = 0;
    }

    /**
    * Extension to the ERC884 standard, allowing the manager/controller
    * to freeze/unfreeze all transfers.
    * @return a bool to indicate whether funds are frozen or not after function call.
    */
    function freeze() 
        public 
        onlyOwner 
        isNotClosed
        returns (bool)
    {
        if (!frozen) {
            frozen = true;
            return true;
        } else {
            frozen = false;
            return false;
        }
    }

    /**
    * Extension to the ERC884 standard, put in place for migration purposes
    * in a case of a security breach or similar event.
    */
    function freezeSuper()
        public
        onlyOwner
        isNotClosed
    {
        frozen = true;
        closed = true;
    }

    /**
    * Extension to the ERC884 standard, allowing the manager/controller
    * to freeze funds of a specific individual.
    * @return a bool to indicate whether funds are frozen or not after function call
    */
    function lock(address _addr)
        public
        onlyOwner
        returns (bool)
    {
        if (locked[_addr]) {
            locked[_addr] = false;
            return false;
        } else {
            locked[_addr] = true;
            return true;
        }
    }

    /**
    * Extension to the ERC884 standard to check whether an account is locked or not.
    * @return a bool to indicate whether funds are frozen or not.
    */
    function isLocked(address _addr)
        public
        view
        returns (bool)
    {
        if (locked[_addr]) {
            return true;
        } else {
            return false;
        }
    }
}