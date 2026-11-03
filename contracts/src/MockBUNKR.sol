// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockBUNKR
/// @notice Testnet stand-in for the real $BUNKR, which launches on Urufu Labs. Like the
///         Urufu coin it has a fixed 800M supply, Permit and no admin keys. Unlike it, it
///         has a faucet so testers can play. Never deploy this to mainnet.
contract MockBUNKR is ERC20, ERC20Permit {
    uint256 public constant SUPPLY = 800_000_000e18;
    uint256 public constant FAUCET_RESERVE = 200_000_000e18;
    uint256 public constant FAUCET_AMOUNT = 120_000e18;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastDrip;

    error FaucetCooldown(uint256 readyAt);
    error FaucetEmpty();

    constructor(address treasury) ERC20("Bunkr (Testnet)", "BUNKR") ERC20Permit("Bunkr (Testnet)") {
        _mint(treasury, SUPPLY - FAUCET_RESERVE);
        _mint(address(this), FAUCET_RESERVE);
    }

    /// @notice Free testnet $BUNKR, once a day per address.
    function faucet() external {
        uint256 last = lastDrip[msg.sender];
        if (last != 0 && block.timestamp < last + FAUCET_COOLDOWN) revert FaucetCooldown(last + FAUCET_COOLDOWN);
        if (balanceOf(address(this)) < FAUCET_AMOUNT) revert FaucetEmpty();
        lastDrip[msg.sender] = block.timestamp;
        _transfer(address(this), msg.sender, FAUCET_AMOUNT);
    }
}
