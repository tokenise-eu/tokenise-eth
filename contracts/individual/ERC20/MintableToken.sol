pragma solidity 0.4.25;

import "../helpers/Ownable.sol";
import "./StandardToken.sol";

/**
 * @title Mintable token
 * @dev Simple ERC20 Token example, with mintable token creation
 * @dev Issue: * https://github.com/OpenZeppelin/openzeppelin-solidity/issues/120
 * Based on code by TokenMarketNet: https://github.com/TokenMarketNet/ico/blob/master/contracts/MintableToken.sol
 */
contract MintableToken is Ownable, StandardToken {
    event Issue(address indexed to, uint256 amount);

    bool public mintingFinished = false;

    /**
    * @dev Function to issue tokens
    * @param _to The address that will receive the issued tokens.
    * @param _amount The amount of tokens to issue.
    * @return A boolean that indicates if the operation was successful.
    */
    function issue(address _to, uint256 _amount) public onlyOwner returns (bool) {
        totalSupply_ = totalSupply_.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        emit Issue(_to, _amount);
        emit Transfer(address(0), _to, _amount);
        return true;
    }
}
