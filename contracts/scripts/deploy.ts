/**
 * IRG_FTR PLATFORM - Smart Contract Deployment Script
 * AUDIT FIX: Added _feeRecipient parameter to constructor call
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Deployment configurations per network
const DEPLOYMENT_CONFIGS: Record<string, {
  uri: string;
  feeRecipient: string;
  gasLimit?: number;
}> = {
  polygon: {
    uri: "https://api.irg-ftr.com/metadata/{id}.json",
    feeRecipient: process.env.FEE_RECIPIENT_ADDRESS || "0x0000000000000000000000000000000000000000",
    gasLimit: 5000000,
  },
  amoy: {
    uri: "https://testnet-api.irg-ftr.com/metadata/{id}.json",
    feeRecipient: process.env.FEE_RECIPIENT_ADDRESS_TESTNET || "0x0000000000000000000000000000000000000000",
    gasLimit: 5000000,
  },
  localhost: {
    uri: "http://localhost:3001/metadata/{id}.json",
    feeRecipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default Hardhat account
    gasLimit: 5000000,
  },
};

async function main() {
  const network = process.env.HARDHAT_NETWORK || "localhost";
  const config = DEPLOYMENT_CONFIGS[network];

  if (!config) {
    throw new Error(`No deployment config found for network: ${network}`);
  }

  console.log(`\n🚀 Deploying FTRToken to ${network}...`);
  console.log(`   URI: ${config.uri}`);
  console.log(`   Fee Recipient: ${config.feeRecipient}`);

  // Validate fee recipient address
  if (!ethers.isAddress(config.feeRecipient)) {
    throw new Error(`Invalid feeRecipient address: ${config.feeRecipient}`);
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`\n📦 Deploying with account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Account balance: ${ethers.formatEther(balance)} ETH/MATIC`);

  // Deploy contract
  const FTRToken = await ethers.getContractFactory("FTRToken");
  
  // AUDIT FIX: Pass BOTH required constructor arguments
  // Previous buggy code: const contract = await FTRToken.deploy(config.uri);
  // Fixed code below passes uri_ AND _feeRecipient as required by constructor
  const contract = await FTRToken.deploy(
    config.uri,           // uri_: Base URI for token metadata
    config.feeRecipient   // _feeRecipient: Address to receive platform fees
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log(`\n✅ FTRToken deployed to: ${contractAddress}`);
  console.log(`   Transaction hash: ${contract.deploymentTransaction()?.hash}`);

  // Wait for block confirmations (5 for mainnet, 2 for testnet)
  const confirmations = network === "polygon" ? 5 : 2;
  console.log(`\n⏳ Waiting for ${confirmations} block confirmations...`);
  await contract.deploymentTransaction()?.wait(confirmations);
  console.log(`✅ Confirmed!`);

  // Save deployment info
  const deploymentInfo = {
    network,
    contractAddress,
    deployer: deployer.address,
    feeRecipient: config.feeRecipient,
    uri: config.uri,
    timestamp: new Date().toISOString(),
    transactionHash: contract.deploymentTransaction()?.hash,
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📄 Deployment info saved to: ${deploymentFile}`);

  // Verify contract on block explorer (if not localhost)
  if (network !== "localhost") {
    console.log(`\n🔍 To verify on block explorer, run:`);
    console.log(`   npx hardhat verify --network ${network} ${contractAddress} "${config.uri}" "${config.feeRecipient}"`);
  }

  return contractAddress;
}

main()
  .then((address) => {
    console.log(`\n🎉 Deployment complete! Contract address: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
