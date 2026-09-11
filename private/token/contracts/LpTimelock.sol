// Version: 1.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * LpTimelock — прост, проверим сейф за LP токените на двойката (PancakeSwap LP е обикновен ERC-20).
 * Собственикът (бенефициентът) праща LP тук; до `unlockTime` никой не може да ги извади — така купувачите виждат,
 * че ликвидността е заключена. След срока бенефициентът вика release() и получава всичко.
 * Срокът може само да се УДЪЛЖАВА (extend). Договорът няма друг достъп до средствата.
 */
interface IERC20Lp {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract LpTimelock {
    address public immutable token;         // LP токенът (двойката)
    address public immutable beneficiary;   // трезорът, който ще си получи LP след срока
    uint64  public unlockTime;
    event Locked(address indexed token, address indexed beneficiary, uint64 unlockTime);
    event Extended(uint64 unlockTime);
    event Released(address indexed to, uint256 amount);

    constructor(address token_, address beneficiary_, uint64 unlockTime_) {
        require(token_ != address(0) && beneficiary_ != address(0), "zero");
        require(unlockTime_ > block.timestamp, "unlock in the past");
        token = token_; beneficiary = beneficiary_; unlockTime = unlockTime_;
        emit Locked(token_, beneficiary_, unlockTime_);
    }

    function locked() external view returns (uint256) { return IERC20Lp(token).balanceOf(address(this)); }
    function timeLeft() external view returns (uint256) { return block.timestamp >= unlockTime ? 0 : unlockTime - block.timestamp; }

    function extend(uint64 newUnlockTime) external {
        require(msg.sender == beneficiary, "not beneficiary");
        require(newUnlockTime > unlockTime, "only longer");
        unlockTime = newUnlockTime;
        emit Extended(newUnlockTime);
    }

    function release() external {
        require(msg.sender == beneficiary, "not beneficiary");
        require(block.timestamp >= unlockTime, "still locked");
        uint256 amt = IERC20Lp(token).balanceOf(address(this));
        require(amt > 0, "nothing to release");
        require(IERC20Lp(token).transfer(beneficiary, amt), "transfer failed");
        emit Released(beneficiary, amt);
    }
}
