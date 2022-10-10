import { expect, util } from "chai";
import { ethers } from "hardhat";
import { Signer,BigNumber,providers } from "ethers";
import { Block } from "@ethersproject/abstract-provider";
import {CollateralizedLeverage__factory} from "../types/factories/contracts/CollateralizedLeverage__factory";
import {MockToken__factory} from "../types/factories/contracts/Mock/MockToken__factory";
import {CollateralizedLeverage} from "../types/contracts/CollateralizedLeverage";
import {MockToken} from "../types/contracts/Mock/MockToken";
import {MockAgregatorV3__factory} from "../types/factories/contracts/Mock/MockAgregatorV3.sol/MockAgregatorV3__factory";
import {MockAgregatorV3} from "../types/contracts/Mock/MockAgregatorV3.sol/MockAgregatorV3";



const SUPPLY:BigNumber=BigNumber.from("10000000000000000000000000000");
const ZERO_ADDRESS="0x0000000000000000000000000000000000000000";
const RATE:number=1000; // 1000 => 10%b
const MONTH_IN_SEC:number=3600*24*30;


describe("CollateralizedLeverage", function () {
  let Deployer:Signer;
  let Borrower:Signer;
  let Lender:Signer;
  let Account3:Signer;

  let deployerAddress:string;
  let borrowerAddress:string;
  let lenderAddress:string;
  let account3Address:string;

  let MockToken_factory:MockToken__factory;
  let MockTokenX:MockToken;
  let MockTokenA:MockToken;
  let CL_Factory:CollateralizedLeverage__factory;
  let CL:CollateralizedLeverage;
  let MockAgregator_factory:MockAgregatorV3__factory;
  let MockAgregator:MockAgregatorV3;

  let provider:providers.JsonRpcProvider;

  this.beforeEach(async function () {
    provider=ethers.provider;

    //Generate all accounts and addresses
    [Deployer,Borrower, Lender,Account3] = await ethers.getSigners();
    [
      deployerAddress, 
      borrowerAddress, 
      lenderAddress,
      account3Address
    ] = await Promise.all([
      Deployer.getAddress(),
      Borrower.getAddress(),
      Lender.getAddress(),
      Account3.getAddress()
    ]);

    //Initialize factory artifacts
    [
      MockToken_factory,
      CL_Factory,
      MockAgregator_factory
    ] = await Promise.all([
      ethers.getContractFactory("MockToken") as Promise<MockToken__factory>,
      ethers.getContractFactory("CollateralizedLeverage") as Promise<CollateralizedLeverage__factory>,
      ethers.getContractFactory("MockAgregatorV3") as Promise<MockAgregatorV3__factory>
    ]);

    // Deploy contracts
    MockTokenX=await MockToken_factory.deploy("TOkenX","X",SUPPLY);
    await MockTokenX.deployed();
    MockTokenA=await MockToken_factory.deploy("TOkenA","A",SUPPLY);
    await MockTokenA.deployed();
    MockAgregator=await MockAgregator_factory.deploy();
    await MockAgregator.deployed();
    CL = await CL_Factory.deploy(MockTokenX.address,MockTokenA.address,MockAgregator.address,RATE);
    await CL.deployed();

    // Provide funds to all players and approve Scrow contract for all players
    await Promise.all([
      MockTokenX.connect(Deployer).transfer(lenderAddress,"10000000000000"),
      MockTokenA.connect(Deployer).transfer(borrowerAddress,"10000000000000"),
      MockTokenX.connect(Deployer).transfer(account3Address,"10000000000000"),
      MockTokenA.connect(Borrower).approve(CL.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
      MockTokenX.connect(Lender).approve(CL.address,"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
    ]);
    
  });

  // Check constructor initial params
  it("Check initial params", async function () {
      let [
        currentTokenX,
        currentTokenA,
        currentOracle,
        currentRate
      ] = await Promise.all([
          CL.tokenX(),
          CL.tokenA(),
          CL.oracle(),
          CL.monthlyRate()
      ]); 

      expect(currentTokenX).to.be.equal(MockTokenX.address);
      expect(currentTokenA).to.be.equal(MockTokenA.address);
      expect(currentOracle).to.be.equal(MockAgregator.address);
      expect(currentRate).to.be.equal(RATE);
  });

    
    describe("placeBorrowRequest", function () {
      it("Low reques", async function () {
        await expect(CL.connect(Borrower).placeBorrowRequest(1,1))
        .to.be.revertedWith("CollateralizedLeverage:Low request");
      });

      it("Multiple request", async function () {
        let amount:number=1000000000000;
        let period:number=3600*24*30*6;
        await CL.connect(Borrower).placeBorrowRequest(amount,period);

        await expect(CL.connect(Borrower).placeBorrowRequest(amount,period))
        .to.be.revertedWith("CollateralizedLeverage:Multiple requests");
      });

      it("Place Request", async function () {
        let amount:number=1000000000000;
        let period:number=3600*24*30*6;

        let borrowerBalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);
        let contractBalance:BigNumber=await MockTokenA.balanceOf(CL.address);

        let block:Block=await provider.getBlock("latest");
        let timestamp:number=block.timestamp;

        timestamp+=8;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        await expect(CL.connect(Borrower).placeBorrowRequest(amount,period))
        .to.emit(CL,"placedRequest").withArgs(borrowerAddress,amount,timestamp);

        //Check internal contract storage
        let entry:any = await CL.ledger(borrowerAddress);
        expect(entry.amountTokenA).to.be.equal(amount);
        expect(entry.period).to.be.equal(period);
        expect(entry.timestamp).to.be.equal(timestamp);

        //Check token txs
        let newBorrowerBalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);
        let newContractBalance:BigNumber=await MockTokenA.balanceOf(CL.address);
        expect(newBorrowerBalance).to.be.equal(borrowerBalance.sub(amount));
        expect(newContractBalance).to.be.equal(contractBalance.add(amount));

      });
    });

    describe("retireRequest", function () {
      let amount:number=1000000000000;
      this.beforeEach(async function () {
        let period:number=3600*24*30*6;
        await CL.connect(Borrower).placeBorrowRequest(amount,period);
      });

      it("Not exist", async function () {
        await expect(CL.connect(Account3).retireRequest())
        .to.be.revertedWith("CollateralizedLeverage:Not Exist");
      });

      it("Already accepted", async function () {
        await CL.connect(Lender).acceptBorrowRequest(borrowerAddress);

        await expect(CL.connect(Borrower).retireRequest())
        .to.be.revertedWith("CollateralizedLeverage:AlreadyAccepted");
      });

      it("Retire request", async function () {
        let block:Block=await provider.getBlock("latest");
        let timestamp:number=block.timestamp;

        timestamp+=8;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        let borrowerBalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);
        let contractBalance:BigNumber=await MockTokenA.balanceOf(CL.address);

        await expect(CL.connect(Borrower).retireRequest())
        .to.emit(CL,"retiredRequest").withArgs(borrowerAddress,timestamp);

         //Check internal contract storage
         let entry:any = await CL.ledger(borrowerAddress);
         expect(entry.amountTokenA).to.be.equal(0);

         //Check token txs
         let newBorrowerBalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);
         let newContractBalance:BigNumber=await MockTokenA.balanceOf(CL.address);
         expect(newBorrowerBalance).to.be.equal(borrowerBalance.add(amount));
         expect(newContractBalance).to.be.equal(contractBalance.sub(amount));
      });
    });

    describe("acceptBorrowRequest", function () {
      let amount:number=1000000000000;
      let conversionRate:BigNumber=BigNumber.from(10);
      this.beforeEach(async function () {
        let period:number=3600*24*30*6;
        await CL.connect(Borrower).placeBorrowRequest(amount,period);
        // Agregator has 18 decimals
        await MockAgregator.setOracleParameters(1,conversionRate.mul(BigNumber.from(10).pow(18)),1);
      });

      it("Not exist", async function () {
        await expect(CL.connect(Lender).acceptBorrowRequest(account3Address))
        .to.be.revertedWith("CollateralizedLeverage:Not Exist");
      });

      it("Already accepted", async function () {

        await expect(CL.connect(Lender).acceptBorrowRequest(borrowerAddress))
        .not.to.be.reverted;

        await expect(CL.connect(Lender).acceptBorrowRequest(borrowerAddress))
        .to.be.revertedWith("CollateralizedLeverage:AlreadyAccepted");
      });

      it("Accept request", async function () {
        let block:Block=await provider.getBlock("latest");
        let timestamp:number=block.timestamp;

        timestamp+=8;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        let lenderBalance:BigNumber=await MockTokenX.balanceOf(lenderAddress);
        let borrowerBalance:BigNumber=await MockTokenX.balanceOf(borrowerAddress);
        let contractBalance:BigNumber=await MockTokenX.balanceOf(CL.address);

        await expect(CL.connect(Lender).acceptBorrowRequest(borrowerAddress))
        .to.emit(CL,"acceptRequest")
        .withArgs(borrowerAddress,lenderAddress,conversionRate.mul(amount),timestamp);
        
        //Check internal contract storage
         let entry:any = await CL.ledger(borrowerAddress);
         expect(entry.lender).to.be.equal(lenderAddress);
         expect(entry.amountTokenX).to.be.equal(conversionRate.mul(amount));

        //Check token txs
        let newLenderBalance:BigNumber=await MockTokenX.balanceOf(lenderAddress);
        let newBorrowerBalance:BigNumber=await MockTokenX.balanceOf(borrowerAddress);
        let newContractBalance:BigNumber=await MockTokenX.balanceOf(CL.address);
        expect(newLenderBalance).to.be.equal(lenderBalance.sub(conversionRate.mul(amount)));
        expect(newBorrowerBalance).to.be.equal(borrowerBalance.add(conversionRate.mul(amount).div(2)));
        expect(newContractBalance).to.be.equal(contractBalance.add(conversionRate.mul(amount).div(2)));
      
      });
    });

    describe("resolveRequest", function () {
      let amount:number=1000000000000;
      let conversionRate:BigNumber=BigNumber.from(10);
      let period:number=3600*24*30*6;
      let timestamp:number;

      this.beforeEach(async function () {
        
        let block:Block=await provider.getBlock("latest");
        timestamp=block.timestamp;

        timestamp+=8;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        
        await CL.connect(Borrower).placeBorrowRequest(amount,period);
        // Agregator has 18 decimals
        await MockAgregator.setOracleParameters(1,conversionRate.mul(BigNumber.from(10).pow(18)),1);
        // Lender accepts request
        await CL.connect(Lender).acceptBorrowRequest(borrowerAddress);
      });

      it("Not exist", async function () {
        await expect(CL.connect(Lender).resolveRequest(account3Address))
        .to.be.revertedWith("CollateralizedLeverage:Not Exist");
      });
      
      it("Not accepted", async function () {
        await MockTokenA.connect(Deployer).transfer(account3Address,amount);
        await MockTokenA.connect(Account3).approve(CL.address,amount);
        await CL.connect(Account3).placeBorrowRequest(amount,period);

        await expect(CL.connect(Lender).resolveRequest(account3Address))
        .to.be.revertedWith("CollateralizedLeverage:Req Not accpted");
      });

      it("Not ended", async function () {

        await expect(CL.connect(Lender).resolveRequest(borrowerAddress))
        .to.be.revertedWith("CollateralizedLeverage:Req Not finalized");
      });

      it("Resolve enough funds", async function () {
        timestamp+=period;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        await MockTokenX.connect(Deployer).transfer(borrowerAddress,"90000000000000");
        await MockTokenX.connect(Borrower).approve(CL.address,"90000000000000");

        let lenderBalance:BigNumber=await MockTokenX.balanceOf(lenderAddress);
        let borrowerABalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);

        let tokenXAmount:BigNumber=conversionRate.mul(amount)
        .add(conversionRate.mul(amount).mul(RATE).mul(period).div(MONTH_IN_SEC).div(10000).div(2));
        timestamp+=period;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        await expect(CL.connect(Lender).resolveRequest(borrowerAddress))
        .to.emit(CL,"resolveRequestEnoughtFunds")
        .withArgs(borrowerAddress,lenderAddress,tokenXAmount,amount,timestamp);

         //Check internal contract storage
        let entry:any = await CL.ledger(borrowerAddress);
        expect(entry.amountTokenA).to.be.equal(0);

        //Check token txs
        let newLenderBalance:BigNumber=await MockTokenX.balanceOf(lenderAddress);
        let newBorrowerABalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);
        let newContractBalance:BigNumber=await MockTokenX.balanceOf(CL.address);
        expect(newLenderBalance).to.be.equal(lenderBalance.add(tokenXAmount));
        expect(newBorrowerABalance).to.be.equal(borrowerABalance.add(amount));
      });

      it("Resolve NOT enough funds", async function () {
        let lenderBalance:BigNumber=await MockTokenA.balanceOf(lenderAddress);
        let borrowerABalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);

        let tokenXAmount:BigNumber=conversionRate.mul(amount)
        .add(conversionRate.mul(amount).mul(RATE).mul(period).div(MONTH_IN_SEC).div(10000).div(2));

        timestamp+=period;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        await expect(CL.connect(Lender).resolveRequest(borrowerAddress))
        .to.emit(CL,"resolveRequestNotEnoughtFunds")
        .withArgs(borrowerAddress,lenderAddress,tokenXAmount,amount,timestamp);

         //Check internal contract storage
         let entry:any = await CL.ledger(borrowerAddress);
         expect(entry.amountTokenA).to.be.equal(0);

          //Check token txs
        let newLenderBalance:BigNumber=await MockTokenA.balanceOf(lenderAddress);
        let newBorrowerABalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);
        expect(newLenderBalance).to.be.equal(lenderBalance.add(amount));
        expect(newBorrowerABalance).to.be.equal(borrowerABalance);
      });
    });

    describe("payCurrentInterest", function () {
      let amount:number=1000000000000;
      let conversionRate:BigNumber=BigNumber.from(10);
      let period:number=3600*24*30*6;
      let timestamp:number;

      this.beforeEach(async function () {
        
        let block:Block=await provider.getBlock("latest");
        timestamp=block.timestamp;

        timestamp+=8;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        await CL.connect(Borrower).placeBorrowRequest(amount,period);
        // Agregator has 18 decimals
        await MockAgregator.setOracleParameters(1,conversionRate.mul(BigNumber.from(10).pow(18)),1);
        // Lender accepts request
        await CL.connect(Lender).acceptBorrowRequest(borrowerAddress);
      });

      it("Not exist", async function () {
        await expect(CL.connect(Account3).payCurrentInterest())
        .to.be.revertedWith("CollateralizedLeverage:Not Exist");
      });

      it("Not accepted", async function () {
        await MockTokenA.connect(Deployer).transfer(account3Address,amount);
        await MockTokenA.connect(Account3).approve(CL.address,amount);
        await CL.connect(Account3).placeBorrowRequest(amount,period);

        await expect(CL.connect(Account3).payCurrentInterest())
        .to.be.revertedWith("CollateralizedLeverage:Req Not accpted");
      });

      it("Resolve enough funds", async function () {

        await MockTokenX.connect(Deployer).transfer(borrowerAddress,"90000000000000");
        await MockTokenX.connect(Borrower).approve(CL.address,"90000000000000");

        let lenderBalance:BigNumber=await MockTokenX.balanceOf(lenderAddress);
        let borrowerABalance:BigNumber=await MockTokenA.balanceOf(borrowerAddress);

        let tokenXAmount:BigNumber=conversionRate.mul(amount).mul(RATE).mul(period).div(MONTH_IN_SEC).div(10000).div(2);
        timestamp+=period/2;
        await provider.send("evm_setNextBlockTimestamp", [timestamp]);

        await expect(CL.connect(Borrower).payCurrentInterest())
        .to.emit(CL,"interestPaid")
        .withArgs(borrowerAddress,tokenXAmount,timestamp);

      });
    });
});