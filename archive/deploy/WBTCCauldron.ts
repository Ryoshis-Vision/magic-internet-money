import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, network } from "hardhat";
import { BentoBoxV1, ProxyOracle } from "../typechain";
import { DeploymentSubmission } from "hardhat-deploy/dist/types";
import { expect } from "chai";



const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const getDeployment = async (name: string) => {
    try {
      return (await deployments.get(name)).address
    } catch {
      return undefined
    }
  }

  // Deploy BNB Cauldron using DegenBox
  // if we need to use DegenBox instead the CauldronV2 mastercontract needs to
  // be whitelisted 
  const BentoBox = await ethers.getContractAt<BentoBoxV1>("BentoBoxV1", "0xd96f48665a1410C0cd669A88898ecA36B9Fc2cce");
  const CauldronV2MasterContract = "0x476b1E35DDE474cB9Aa1f6B85c9Cc589BFa85c1F"; // CauldronV2

  const collateral = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"; // wBTC
  const oracle = await ethers.getContract<ProxyOracle>("WbtcProxyOracle");
  const oracleData = "0x0000000000000000000000000000000000000000";

    //let oracle = "0x2Be431EE7E74b1CB7CfA16Fc90578EF42eF361B0"
  let INTEREST_CONVERSION = 1e18/(365.25*3600*24)/100
  let interest = parseInt(String(0 * INTEREST_CONVERSION))
  const OPENING_CONVERSION = 1e5/100
  const opening = 0.5 * OPENING_CONVERSION
  const liquidation = 7 * 1e3+1e5
  const collateralization = 85 * 1e3

  let initData = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "bytes", "uint64", "uint256", "uint256", "uint256"],
    [collateral, oracle.address, oracleData, interest, liquidation, collateralization, opening]
  );
  
  const cauldronAddress = await getDeployment("WbtcCauldron")

  if(cauldronAddress === undefined) {
    const tx = await (await BentoBox.deploy(CauldronV2MasterContract, initData, true)).wait();

    const deployEvent = tx?.events?.[0];
    expect(deployEvent?.eventSignature).to.be.eq("LogDeploy(address,bytes,address)");

    deployments.save("WbtcCauldron", {
      abi: [],
      address: deployEvent?.args?.cloneAddress,
    });
    
  }

};

export default deployFunction;

if (network.name !== "hardhat" || process.env.HARDHAT_LOCAL_NODE) {
  deployFunction.skip = ({ getChainId }) =>
    new Promise((resolve, reject) => {
      try {
        getChainId().then((chainId) => {
          resolve(chainId !== "1");
        });
      } catch (error) {
        reject(error);
      }
    });
}

deployFunction.tags = ["WbtcCauldron"];
deployFunction.dependencies = ["WbtcOracle"];
