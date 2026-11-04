// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockStock
/// @notice Testnet stand-in for a Robinhood stock token (those only exist on mainnet).
///         18 decimals and Permit, like the real ones. Has a faucet so testers can buy
///         Stock Bags. Never deploy this to mainnet.
contract MockStock is ERC20, ERC20Permit {
    uint256 public immutable faucetAmount;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    mapping(address => uint256) public lastDrip;

    error FaucetCooldown(uint256 readyAt);

    constructor(string memory name_, string memory symbol_, uint256 faucetAmount_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        faucetAmount = faucetAmount_;
    }

    /// @notice Free testnet shares, once a day per address.
    function faucet() external {
        uint256 last = lastDrip[msg.sender];
        if (last != 0 && block.timestamp < last + FAUCET_COOLDOWN) revert FaucetCooldown(last + FAUCET_COOLDOWN);
        lastDrip[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
    }
}
