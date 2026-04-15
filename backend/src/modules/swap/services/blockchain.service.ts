// backend/src/services/blockchain.service.ts
// Smart Contract Interaction Layer for FTRToken.sol

import { ethers, Contract, Wallet, Provider } from 'ethers';
import logger, { transactionLogger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BLOCKCHAIN_CONFIG = {
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
  chainId: parseInt(process.env.BLOCKCHAIN_CHAIN_ID || '1337'),
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
  ftrTokenAddress: process.env.FTR_TOKEN_ADDRESS || '',
  gasLimit: parseInt(process.env.BLOCKCHAIN_GAS_LIMIT || '500000'),
  maxRetries: 3,
  retryDelay: 1000,
};

// =============================================================================
// FTR TOKEN ABI (Minimal interface for swap operations)
// =============================================================================

const FTR_TOKEN_ABI = [
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event TokenMinted(uint256 indexed tokenId, address indexed owner, string productType, uint256 faceValue)',
  'event TokenSurrendered(uint256 indexed tokenId, address indexed owner)',
  'event TokenBurned(uint256 indexed tokenId)',
  'event SwapExecuted(uint256 indexed fromTokenId, uint256 indexed toTokenId, address indexed executor)',
  
  // Read functions
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function getTokenDetails(uint256 tokenId) view returns (tuple(string productType, uint256 faceValue, uint8 state, uint256 mintedAt, uint256 surrenderedAt))',
  'function totalSupply() view returns (uint256)',
  
  // Write functions
  'function mint(address to, string productType, uint256 faceValue) returns (uint256)',
  'function surrender(uint256 tokenId)',
  'function burn(uint256 tokenId)',
  'function executeSwap(uint256 fromTokenId, uint256 toTokenId, address newOwner)',
  'function batchTransfer(uint256[] tokenIds, address to)',
  
  // Admin functions
  'function pause()',
  'function unpause()',
  'function setMinter(address minter, bool approved)',
];

// =============================================================================
// TOKEN STATE ENUM (matches Solidity contract)
// =============================================================================

export enum BlockchainTokenState {
  MINTED = 0,
  ACTIVE = 1,
  SURRENDERED = 2,
  REDEEMED = 3,
  BURNED = 4,
}

// =============================================================================
// BLOCKCHAIN SERVICE
// =============================================================================

export class BlockchainService {
  private static instance: BlockchainService;
  private provider: Provider | null = null;
  private wallet: Wallet | null = null;
  private ftrTokenContract: Contract | null = null;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Check if blockchain is configured
      if (!BLOCKCHAIN_CONFIG.privateKey || !BLOCKCHAIN_CONFIG.ftrTokenAddress) {
        logger.warn('[BLOCKCHAIN] Not configured - running in mock mode');
        return false;
      }

      // Connect to provider
      this.provider = new ethers.JsonRpcProvider(
        BLOCKCHAIN_CONFIG.rpcUrl,
        BLOCKCHAIN_CONFIG.chainId
      );

      // Create wallet
      this.wallet = new Wallet(BLOCKCHAIN_CONFIG.privateKey, this.provider);

      // Connect to FTR Token contract
      this.ftrTokenContract = new Contract(
        BLOCKCHAIN_CONFIG.ftrTokenAddress,
        FTR_TOKEN_ABI,
        this.wallet
      );

      // Verify connection
      const network = await this.provider.getNetwork();
      logger.info(`[BLOCKCHAIN] Connected to chain ${network.chainId}`);

      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('[BLOCKCHAIN] Initialization failed', { error });
      return false;
    }
  }

  // ===========================================================================
  // TOKEN OPERATIONS
  // ===========================================================================

  /**
   * Surrender a token on-chain
   * Called when user initiates swap
   */
  async surrenderToken(tokenId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const txId = `surrender-${tokenId}-${Date.now()}`;
    transactionLogger.start(txId, 'BLOCKCHAIN_SURRENDER', { tokenId });

    try {
      if (!this.initialized || !this.ftrTokenContract) {
        // Mock mode for development
        logger.info(`[BLOCKCHAIN:MOCK] Surrender token ${tokenId}`);
        transactionLogger.complete(txId, 'BLOCKCHAIN_SURRENDER', { tokenId, mock: true });
        return { success: true, txHash: `mock-tx-${Date.now()}` };
      }

      const tx = await this.ftrTokenContract.surrender(tokenId, {
        gasLimit: BLOCKCHAIN_CONFIG.gasLimit,
      });

      const receipt = await tx.wait();
      
      transactionLogger.complete(txId, 'BLOCKCHAIN_SURRENDER', {
        tokenId,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      });

      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      transactionLogger.fail(txId, 'BLOCKCHAIN_SURRENDER', error.message, { tokenId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute atomic swap on-chain
   * Transfers ownership and updates states
   */
  async executeSwap(
    fromTokenId: string,
    toTokenId: string,
    newOwner: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const txId = `swap-${fromTokenId}-${toTokenId}-${Date.now()}`;
    transactionLogger.start(txId, 'BLOCKCHAIN_SWAP', { fromTokenId, toTokenId, newOwner });

    try {
      if (!this.initialized || !this.ftrTokenContract) {
        // Mock mode
        logger.info(`[BLOCKCHAIN:MOCK] Execute swap ${fromTokenId} -> ${toTokenId}`);
        transactionLogger.complete(txId, 'BLOCKCHAIN_SWAP', { mock: true });
        return { success: true, txHash: `mock-tx-${Date.now()}` };
      }

      const tx = await this.ftrTokenContract.executeSwap(
        fromTokenId,
        toTokenId,
        newOwner,
        { gasLimit: BLOCKCHAIN_CONFIG.gasLimit }
      );

      const receipt = await tx.wait();

      transactionLogger.complete(txId, 'BLOCKCHAIN_SWAP', {
        fromTokenId,
        toTokenId,
        newOwner,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      });

      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      transactionLogger.fail(txId, 'BLOCKCHAIN_SWAP', error.message, { fromTokenId, toTokenId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Burn token (for short-sale buyback and cancel)
   */
  async burnToken(tokenId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const txId = `burn-${tokenId}-${Date.now()}`;
    transactionLogger.start(txId, 'BLOCKCHAIN_BURN', { tokenId });

    try {
      if (!this.initialized || !this.ftrTokenContract) {
        logger.info(`[BLOCKCHAIN:MOCK] Burn token ${tokenId}`);
        transactionLogger.complete(txId, 'BLOCKCHAIN_BURN', { mock: true });
        return { success: true, txHash: `mock-tx-${Date.now()}` };
      }

      const tx = await this.ftrTokenContract.burn(tokenId, {
        gasLimit: BLOCKCHAIN_CONFIG.gasLimit,
      });

      const receipt = await tx.wait();

      transactionLogger.complete(txId, 'BLOCKCHAIN_BURN', {
        tokenId,
        txHash: receipt.hash,
      });

      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      transactionLogger.fail(txId, 'BLOCKCHAIN_BURN', error.message, { tokenId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get token details from blockchain
   */
  async getTokenDetails(tokenId: string): Promise<{
    productType: string;
    faceValue: bigint;
    state: BlockchainTokenState;
    mintedAt: bigint;
    surrenderedAt: bigint;
  } | null> {
    try {
      if (!this.initialized || !this.ftrTokenContract) {
        return null;
      }

      const details = await this.ftrTokenContract.getTokenDetails(tokenId);
      return {
        productType: details.productType,
        faceValue: details.faceValue,
        state: details.state,
        mintedAt: details.mintedAt,
        surrenderedAt: details.surrenderedAt,
      };
    } catch (error) {
      logger.error('[BLOCKCHAIN] Failed to get token details', { tokenId, error });
      return null;
    }
  }

  /**
   * Verify token ownership
   */
  async verifyOwnership(tokenId: string, expectedOwner: string): Promise<boolean> {
    try {
      if (!this.initialized || !this.ftrTokenContract) {
        return true; // Mock mode - assume valid
      }

      const owner = await this.ftrTokenContract.ownerOf(tokenId);
      return owner.toLowerCase() === expectedOwner.toLowerCase();
    } catch (error) {
      logger.error('[BLOCKCHAIN] Ownership verification failed', { tokenId, error });
      return false;
    }
  }

  // ===========================================================================
  // BATCH OPERATIONS
  // ===========================================================================

  /**
   * Batch transfer tokens (for corpus fund operations)
   */
  async batchTransfer(
    tokenIds: string[],
    to: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const txId = `batch-${Date.now()}`;
    transactionLogger.start(txId, 'BLOCKCHAIN_BATCH_TRANSFER', { count: tokenIds.length, to });

    try {
      if (!this.initialized || !this.ftrTokenContract) {
        logger.info(`[BLOCKCHAIN:MOCK] Batch transfer ${tokenIds.length} tokens`);
        return { success: true, txHash: `mock-tx-${Date.now()}` };
      }

      const tx = await this.ftrTokenContract.batchTransfer(tokenIds, to, {
        gasLimit: BLOCKCHAIN_CONFIG.gasLimit * tokenIds.length,
      });

      const receipt = await tx.wait();

      transactionLogger.complete(txId, 'BLOCKCHAIN_BATCH_TRANSFER', {
        count: tokenIds.length,
        txHash: receipt.hash,
      });

      return { success: true, txHash: receipt.hash };
    } catch (error: any) {
      transactionLogger.fail(txId, 'BLOCKCHAIN_BATCH_TRANSFER', error.message, {});
      return { success: false, error: error.message };
    }
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  isInitialized(): boolean {
    return this.initialized;
  }

  async getBlockNumber(): Promise<number> {
    if (!this.provider) return 0;
    return await this.provider.getBlockNumber();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const blockchainService = BlockchainService.getInstance();
export default blockchainService;
