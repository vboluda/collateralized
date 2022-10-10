# COLLATERALIZED LEVERAGE
**NOTICE:** Known limitation: Only accepts one borrow request per user

**NOTICE:** Functions to update parameters, owner management, pausing mechanisms have not been addressed to keep this contract as simple as possible

**NOTICE:** This contract uses timestamp for time measurement. This keeps this contract simple, but would be better to use blocknumber to measure time

**NOTICE:** This contract is not intended for production as it simplifies processes, requirements and unit test are not exhaustive

## DIRECTORIES
- Contracts
  - Mock: Mock contracts used for testing
- deploy: Deploy scripts
- deployment: Artifacts deployed in every network. Default hardhat network does not generate artifacts
- test

## COMMANDS
  $ yarn install
  
  $ yarn test
  
  $ yarn deploy //Deploy in hardhat network
  
  $ yarn deploy --network mumbai // Deploy in Mumbai
