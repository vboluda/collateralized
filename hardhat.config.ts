import { task } from "hardhat/config";
import  "hardhat-deploy";
import 'hardhat-deploy-ethers';
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import 'solidity-coverage'
import 'dotenv/config';



// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {version: "0.8.4"},
      {version: "0.8.8"}
    ]
  },
  defaultNetwork: "hardhat",
  paths: {
    deploy: 'deploy',
    deployments: 'deployments',
    imports: 'imports'
  },
  namedAccounts: {
    deployer: {
        default: 0, 
        137: 0, 
        80001: 0, 
    }
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    externalArtifacts: ['externalArtifacts/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
  },
  etherscan: {
    apiKey: "4XEX8ASQ6CQXE44V4VQSSC2CV34CWE3XPK",
  },
networks: {
    hardhat: {
      chainId: 1337,
      live:false,
      blockGasLimit:10000000000,
      options:{
        tokenA:{
          NAME: "TOKENA",
          SYMBOL:"A",
          MOCK_TOKEN_SUPPLY: "10000000000000000000000000"
        },
        tokenX:{
          NAME: "TOKENX",
          SYMBOL:"X",
          MOCK_TOKEN_SUPPLY: "10000000000000000000000000"
        },
        TOKENA_ADDRESS:"MOCK", //MOCK TO USE MOCK TOKEN CONTRACT OR THE REAL TOKEN ADDRESS
        TOKENX_ADDRESS:"MOCK", //MOCK TO USE MOCK TOKEN CONTRACT OR THE REAL TOKEN ADDRESS
        ORACLE:"MOCK",  //MOCK TO USE MOCK DATAFEED  OR THE REAL DATAFEED ADDRESS
        MONTHLY_RATE:500, // 500 => 5%
        VERIFY:false
      }
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/v1/10c131262ead77689842f842e011056f1224bc18",
      accounts: [`${process.env.DEV_PK_MUMBAI}`],
      gasPrice:20000000000,
      gasLimit:1000000,
      chainId: 80001,
      options:{
        tokenA:{
          NAME: "TOKENA",
          SYMBOL:"A",
          MOCK_TOKEN_SUPPLY: "10000000000000000000000000"
        },
        tokenX:{
          NAME: "TOKENX",
          SYMBOL:"X",
          MOCK_TOKEN_SUPPLY: "10000000000000000000000000"
        },
        TOKENA_ADDRESS:"MOCK", //MOCK TO USE MOCK TOKEN CONTRACT OR THE REAL TOKEN ADDRESS
        TOKENX_ADDRESS:"MOCK", //MOCK TO USE MOCK TOKEN CONTRACT OR THE REAL TOKEN ADDRESS
        ORACLE:"MOCK",  //MOCK TO USE MOCK DATAFEED  OR THE REAL DATAFEED ADDRESS
        MONTHLY_RATE:500, // 500 => 5%
        VERIFY:true
      }
    }
  } 
};
