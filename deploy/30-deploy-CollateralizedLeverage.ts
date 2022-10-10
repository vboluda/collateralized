import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy,log} = deployments;
  const {deployer} = await getNamedAccounts();

  let configHardhat:any=hre.config.networks[hre.network.name];
  let config:any=configHardhat.options;
  let tokenA:string = config.TOKENA_ADDRESS;
  let tokenX:string = config.TOKENX_ADDRESS;
  let datafeed:string = config.ORACLE;
  let rate:number = config.MONTHLY_RATE; 

  // if(tokenA=="MOCK"){
  //   const ARGS=[config.tokenA.NAME,config.tokenA.SYMBOL,config.tokenA.MOCK_TOKEN_SUPPLY];
  //   let deployResult:any = await deploy('MockToken', {
  //     from: deployer,
  //     args: ARGS,
  //     log: true
  //   });
  //   if (!deployResult.newlyDeployed) {
  //     log(
  //       `Reusing MOCK TOKEN (${config.tokenA.NAME}) deployed at ${deployResult.address}`
  //     );
  //   }else{
  //     log(
  //       ` NEW MOCK TOKEN (${config.tokenA.NAME}) deployed at  ${deployResult.address}  using ${deployResult.receipt.gasUsed} gas`
  //     );
  //   }
  //   tokenA=deployResult.address;
  // }

  // if(tokenX=="MOCK"){
  //   const ARGS=[config.tokenX.NAME,config.tokenX.SYMBOL,config.tokenX.MOCK_TOKEN_SUPPLY];
  //   let deployResult:any = await deploy('MockToken', {
  //     from: deployer,
  //     args: ARGS,
  //     log: true
  //   });
  //   if (!deployResult.newlyDeployed) {
  //     log(
  //       `Reusing MOCK TOKEN (${config.tokenX.NAME}) deployed at ${deployResult.address}`
  //     );
  //   }else{
  //     log(
  //       ` NEW MOCK TOKEN (${config.tokenX.NAME}) deployed at  ${deployResult.address}  using ${deployResult.receipt.gasUsed} gas`
  //     );
  //   }
  //   tokenX=deployResult.address;
  // }

  // if(datafeed=="MOCK") datafeed = (await deployments.get('MockAgregatorV3')).address;
 
  // const ARGS=[tokenX,tokenA,datafeed,rate];

  // let deployResult:any = await deploy('CollateralizedLeverage', {
  //   from: deployer,
  //   args: ARGS,
  //   log: true
  // });
  // if (!deployResult.newlyDeployed) {
  //   log(
  //     `Reusing CollateralizedLeverage deployed at ${deployResult.address}`
  //   );
  // }else{
  //   log(
  //     ` NEW CollateralizedLeverage deployed at  ${deployResult.address}  using ${deployResult.receipt.gasUsed} gas`
  //   );
  // }
};

export default func;
func.tags = ['CollateralizedLeverage'];
func.dependencies=["MockTokenA","MockTokenB","MockAgregatorV3"];