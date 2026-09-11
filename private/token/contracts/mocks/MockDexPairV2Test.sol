// Version: 1.0000
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// САМО ЗА ЛОКАЛНИЯ ТЕСТ (test/PupikesV2Blocking.test.js): прост мок на „двойка + рутер" в PancakeSwap.
// pull = продажба (рутерът дърпа токени от продавача към двойката с transferFrom);
// push = покупка (двойката праща токени на купувача с transfer). Не се деплойва в реални мрежи.
interface IERC20MinV2Test {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract MockDexPairV2Test {
    function pull(address token, address from, uint256 amount) external {
        require(IERC20MinV2Test(token).transferFrom(from, address(this), amount), "pull");
    }
    function push(address token, address to, uint256 amount) external {
        require(IERC20MinV2Test(token).transfer(to, amount), "push");
    }
}
