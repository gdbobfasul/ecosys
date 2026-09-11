// Version: 1.0002
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// САМО ЗА ЛОКАЛНИЯ ТЕСТ (test/PupikesV2*.test.js): прост мок на „двойка + рутер" в PancakeSwap v2 и на WBNB.
// pull = продажба без проверка; sellChecked = продажба като истинска двойка (минава само ако двойката е получила токените);
// push = двойката праща токени (покупка / skim / теглене); getReserves/token0 = резервите, които договорът чете при
// проверката на плащането (задават се със setState — като sync()). Не се деплойва в реални мрежи.
interface IERC20MinV2Test {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MockDexPairV2Test {
    address public token0;
    uint112 private r0;
    uint112 private r1;
    function setState(address token0_, uint112 reserve0, uint112 reserve1) external { token0 = token0_; r0 = reserve0; r1 = reserve1; }
    function getReserves() external view returns (uint112, uint112, uint32) { return (r0, r1, 0); }
    function pull(address token, address from, uint256 amount) external {
        require(IERC20MinV2Test(token).transferFrom(from, address(this), amount), "pull");
    }
    function push(address token, address to, uint256 amount) external {
        require(IERC20MinV2Test(token).transfer(to, amount), "push");
    }
    function sellChecked(address token, address from, uint256 amount) external {
        uint256 b0 = IERC20MinV2Test(token).balanceOf(address(this));
        require(IERC20MinV2Test(token).transferFrom(from, address(this), amount), "pull");
        require(IERC20MinV2Test(token).balanceOf(address(this)) > b0, "INSUFFICIENT_INPUT_AMOUNT");
    }
}

// Мок на WBNB: само баланси (mint = „рутерът е пратил BNB в двойката").
contract MockWbnbV2Test {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
}
