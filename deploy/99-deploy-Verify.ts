import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { ethers } from "hardhat";
import {CollateralizedLeverage__factory} from "../types/factories/contracts/CollateralizedLeverage__factory";
import {CollateralizedLeverage} from "../types/contracts/CollateralizedLeverage";

async function waitMillis(millis:number):Promise<void>{
  return new Promise<void>((resolve,reject)=>{
      setTimeout(()=>{
          resolve();
      },millis,"");
  });
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy,log} = deployments;
  const {deployer} = await getNamedAccounts();

  let configHardhat:any=hre.config.networks[hre.network.name];
  let config:any=configHardhat.options;

  const TOKENA_ARGS=[config.tokenA.NAME,config.tokenA.SYMBOL,config.tokenA.MOCK_TOKEN_SUPPLY];
  const TOKENX_ARGS=[config.tokenX.NAME,config.tokenX.SYMBOL,config.tokenX.MOCK_TOKEN_SUPPLY];

  let contractAddress:string = (await deployments.get('CollateralizedLeverage')).address;

  let CollateralizedLeverage_factory:CollateralizedLeverage__factory=await ethers.getContractFactory("CollateralizedLeverage") as CollateralizedLeverage__factory;
  let CL:CollateralizedLeverage=await CollateralizedLeverage_factory.attach(contractAddress);

  let tokenA:string = await CL.tokenA();
  let tokenX:string = await CL.tokenX();
  let datafeed:string = await CL.oracle();
  let rate:number = config.MONTHLY_RATE; 
 
  const ARGS=[tokenX,tokenA,datafeed,rate];
  console.log("ARGS: "+JSON.stringify(ARGS));
  console.log("ADDRESS: "+contractAddress);



  if(config.VERIFY){
    console.info("Wait for explorer backend for update contract information from chain. Some explorers (Polygon for instance) do not update contract information inmediately");
    console.info("As a result sometimes verification process throws an error. We wait 10 secons tom give time backend to update infrmation");
    console.info("HOWEVER IF VERIFICATION PROCESS FAILS, DEPLOYMENT PROCESS CAN BE EXECUTED AGAIN SAFELY AS IT WILL NOT DEPLOY NEW CONTRACTS, BUT WILL REUSE THEM");
    //await waitMillis(10000); // Give time to polygonscan backend to process these contracts

    // await hre.run("verify:verify",{
    //     address:contractAddress,
    //     constructorArguments:ARGS
    // });

    await hre.run("verify:verify",{
      address:datafeed,
      constructorArguments:[]
    });

    await hre.run("verify:verify",{
      address:tokenA,
      constructorArguments:TOKENA_ARGS,
      contract: "contracts/Mock/MockToken.sol:MockToken"
    });

    await hre.run("verify:verify",{
      address:tokenX,
      constructorArguments:TOKENX_ARGS,
      contract: "contracts/Mock/MockToken.sol:MockToken"
    });
  };
};

export default func;
func.tags = ['Verify'];
func.dependencies = ['Scrow','MockToken']