// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interface/AggregatorV3Interface.sol";


import "hardhat/console.sol";

/**
@title CollateralizedLeverage contract
@notice KNown limitation: Only accepts one borrow request per user
@notice Functions to update parameters, owner management, pausing mechanisms have not been addressed to keep this contract as simple as possible
@notice This contract uses timestamp for time measurement. This keeps this contract simple, but would be better to use blocknumber to measure time
@notice THis contract is not intended for production as it simplifies processes, requirements and unit test are not exhaustive
*/
contract CollateralizedLeverage is Context {

    uint constant SECS_IN_DAY=86400;
   
    struct LedgerEntry{
        uint256 amountTokenA;
        uint256 amountTokenX;
        uint256 period;
        uint256 timestamp;
        address lender;
    }

    //Token addresses
    address public tokenX;
    address public tokenA;
    // Conversion datafeed
    address public oracle;
    //Rate
    uint256 public monthlyRate; // 100 eq 1%

    mapping(address => LedgerEntry) public ledger;

    event placedRequest(address indexed borrower, uint256 amountA, uint256 timestamp);
    event retiredRequest(address indexed borrower, uint256 timestamp);
    event acceptRequest(address indexed borrower, address indexed lender, uint256 amountX, uint256 timestamp);
    event resolveRequestEnoughtFunds(address indexed borrower, address indexed lender, uint256 amountX, uint256 amountA,  uint256 timestamp);
    event resolveRequestNotEnoughtFunds(address indexed borrower, address indexed lender, uint256 amountX, uint256 amountA,  uint256 timestamp);
    event interestPaid(address borrower,uint256 amount,uint256 timestamp);

    /**
        @param _tokenX Token used as stabled coin
        @param _tokenA Token used as collateral
        @param _oracle Datafeed used for conversion
        @param _monthlyRate Monthly rate the borrower must pay to the lender
    */
    constructor(address _tokenX, address _tokenA, address _oracle, uint256 _monthlyRate){
        tokenX = _tokenX;
        tokenA = _tokenA;
        oracle=_oracle;
        monthlyRate = _monthlyRate;
    }


    // *********************************************
    //  FUNCTIONS
    // *********************************************

    /**
        BORROWER: Place a borrow request
        @param amountTokenA Amount of token to use as a collateral
        @param period Time in seconds
     */
    function placeBorrowRequest(uint256 amountTokenA, uint256 period) external {
         require(amountTokenA>=1000000000000,"CollateralizedLeverage:Low request");
        require(ledger[_msgSender()].amountTokenA==0,"CollateralizedLeverage:Multiple requests");
        ledger[_msgSender()].amountTokenA=amountTokenA;
        ledger[_msgSender()].period=period;
        ledger[_msgSender()].timestamp=block.timestamp;
         require(
            IERC20(tokenA).transferFrom(_msgSender(), address(this),amountTokenA),
            "CollateralizedLeverage:transfer error"
        );

        emit placedRequest(_msgSender(), amountTokenA, block.timestamp);
    }

  /**
        BORROWER: Requiest can be retired if has not been accepted 
     */
    function retireRequest() external {
        require(ledger[_msgSender()].amountTokenA>0,"CollateralizedLeverage:Not Exist");
        require(ledger[_msgSender()].lender==address(0),"CollateralizedLeverage:AlreadyAccepted");
        require(
            IERC20(tokenA).transfer(_msgSender(),ledger[_msgSender()].amountTokenA),
            "CollateralizedLeverage:transfer error"
        );
        ledger[_msgSender()].amountTokenA=0;

        emit retiredRequest(_msgSender(), block.timestamp);
    }

    /**
        LENDER: Accepts a request and pay in stable coin the e1uivalent of the 50% of the collateral
        @param borrower User has placed the request
     */
    function acceptBorrowRequest(address borrower) external {
        require(ledger[borrower].amountTokenA>0,"CollateralizedLeverage:Not Exist");
        require(ledger[borrower].lender==address(0),"CollateralizedLeverage:AlreadyAccepted");
        uint256 amountTokenX = conversionAX(ledger[borrower].amountTokenA);
        ledger[borrower].amountTokenX=amountTokenX;
        ledger[borrower].lender=_msgSender();

        require(
            IERC20(tokenX).transferFrom(_msgSender(), address(this),amountTokenX),
            "CollateralizedLeverage:transfer error"
        );
        
        require(
            IERC20(tokenX).transfer( borrower, amountTokenX/2),
            "CollateralizedLeverage:transfer error2"
        );

        emit acceptRequest(borrower, _msgSender(), amountTokenX, block.timestamp);
    }

    /**
        ANY: resolve the request depending on the borrower balance:
            - If has enough balance to pay to lender 50% of collateral + interest: collateral is returned to borrower
            - If not: collateral is sent to lender
        @param borrower User has placed the request
     */
    function resolveRequest(address borrower) external {
        LedgerEntry memory entry= ledger[borrower];
        require(entry.amountTokenA>0,"CollateralizedLeverage:Not Exist");
        require(entry.lender!=address(0),"CollateralizedLeverage:Req Not accpted");
        require((entry.period + entry.timestamp) <=block.timestamp,"CollateralizedLeverage:Req Not finalized");

        uint256 amountToPay = entry.amountTokenX/2 + (entry.amountTokenX * entry.period * monthlyRate) / (SECS_IN_DAY * 30 * 10000 * 2);

        //Careful with allowance
        if((IERC20(tokenX).balanceOf(borrower)>=amountToPay) && (IERC20(tokenX).allowance(borrower,address(this))>=amountToPay)){
            require(
                IERC20(tokenX).transferFrom(borrower, address(this), amountToPay),
                "CollateralizedLeverage:transfer error"
            );

            require(
                IERC20(tokenX).transfer(entry.lender, amountToPay+entry.amountTokenX/2),
                "CollateralizedLeverage:transfer error2"
            );

             require(
                IERC20(tokenA).transfer(borrower, entry.amountTokenA),
                "CollateralizedLeverage:transfer error3"
            );

            emit resolveRequestEnoughtFunds(borrower, entry.lender, amountToPay+entry.amountTokenX/2, entry.amountTokenA,  block.timestamp);
        }else{
            require(
                IERC20(tokenA).transfer(entry.lender, entry.amountTokenA),
                "CollateralizedLeverage:transfer error4"
            );

            require(
                IERC20(tokenX).transfer(entry.lender, entry.amountTokenX/2),
                "CollateralizedLeverage:transfer error5"
            );

            emit resolveRequestNotEnoughtFunds(borrower, entry.lender, amountToPay+entry.amountTokenX/2, entry.amountTokenA,  block.timestamp);
        }

        ledger[borrower].amountTokenA=0;
        
    }

    /**
        BORROWER: Buy more time by paying current pending interests
     */
     function payCurrentInterest() external {
        LedgerEntry memory entry= ledger[_msgSender()];
        require(entry.amountTokenA>0,"CollateralizedLeverage:Not Exist");
        require(entry.lender!=address(0),"CollateralizedLeverage:Req Not accpted");
        require((entry.period + entry.timestamp) > block.timestamp,"CollateralizedLeverage:Req  finalized");

        uint256 amountToPay = (entry.amountTokenX * entry.period * monthlyRate) / (SECS_IN_DAY * 30 * 10000 * 2);
        require(
            IERC20(tokenX).transferFrom(_msgSender(), entry.lender, amountToPay),
            "CollateralizedLeverage:transfer error"
        );
        entry.timestamp = block.timestamp;

        emit interestPaid(_msgSender(), amountToPay, entry.timestamp );
     }



    // //*****************************************************************
    // // Internal
    // // ****************************************************************

    /**
        Uses oracle datafeed to calculate equivalent amount in stable coin
        @param amount amount in tokenA
        @return uint256 equivalent to stable coin
     */
    function conversionAX(uint256 amount) internal returns(uint256){
        //Very simplified apporach. We would need to make sure that price is been upgrading
        ( , int256 price, , , ) = AggregatorV3Interface(oracle).latestRoundData();
        uint decimals=AggregatorV3Interface(oracle).decimals();
        //Carefull with decimals
        uint256 result = uint256(price)*amount/(10**decimals);
        return result;
    }

}
