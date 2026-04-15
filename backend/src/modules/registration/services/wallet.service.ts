/**
 * IRG_FTR PLATFORM - Wallet Service
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Handles blockchain wallet operations:
 * - Key pair generation (Ed25519, ECDSA)
 * - BIP-39 mnemonic seed phrases
 * - HD wallet derivation (BIP-32/44)
 * - Wallet namespaces (TGDP/FTR/DAC/TRCS)
 * - Social recovery configuration
 * - Hardware wallet integration
 * - Wallet encryption
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WalletNamespace = 'TGDP_SOVEREIGN' | 'FTR_STANDARD' | 'DAC_COMMERCE' | 'TRCS_SETTLEMENT';
export type KeyAlgorithm = 'ED25519' | 'SECP256K1' | 'P256';

export interface WalletCreationResult {
  walletAddress: string;
  publicKey: string;
  namespace: WalletNamespace;
  registrationId: string;
  createdAt: Date;
  seedPhraseWords: string[]; // 12 or 24 words
  seedPhraseHint?: string;
  encryptedPrivateKey: string;
  keyAlgorithm: KeyAlgorithm;
  derivationPath: string;
  checksum: string;
}

export interface WalletRecoveryConfig {
  recoveryMethod: 'SEED_PHRASE' | 'SOCIAL' | 'HARDWARE' | 'MULTISIG';
  socialRecovery?: SocialRecoveryConfig;
  hardwareWallet?: HardwareWalletConfig;
  multisigConfig?: MultisigConfig;
}

export interface SocialRecoveryConfig {
  enabled: boolean;
  nominees: SocialRecoveryNominee[];
  requiredApprovals: number; // e.g., 2 of 3
  recoveryDelayHours: number;
  lastUpdated: Date;
}

export interface SocialRecoveryNominee {
  nomineeId: string;
  name: string;
  email?: string;
  phone?: string;
  publicKeyHash: string;
  addedAt: Date;
  lastVerifiedAt?: Date;
}

export interface HardwareWalletConfig {
  type: 'LEDGER' | 'TREZOR' | 'KEEPKEY' | 'COLDCARD';
  deviceId?: string;
  publicKey: string;
  linkedAt: Date;
  lastUsedAt?: Date;
  firmwareVersion?: string;
}

export interface MultisigConfig {
  threshold: number;
  totalSigners: number;
  signerPublicKeys: string[];
  scriptHash: string;
}

export interface WalletExportFormat {
  format: 'KEYSTORE_V3' | 'WIF' | 'RAW_HEX' | 'BASE58' | 'PEM';
  encryptedData: string;
  publicKey: string;
  address: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIP-39 WORDLIST (English)
// Standard 2048-word list for mnemonic generation
// ═══════════════════════════════════════════════════════════════════════════════

const BIP39_WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
  'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
  'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
  'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
  'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic',
  'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest',
  // ... In production, include full 2048-word BIP-39 wordlist
  // Truncated for brevity - use official bip39 package in production
  'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access',
  'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act', 'action',
  'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult',
  'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent', 'agree',
  'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert', 'alien',
  'zoo', 'zone', 'zero', 'youth', 'yellow', 'year', 'wrong', 'write', 'wrap', 'worth',
  'world', 'worry', 'work', 'word', 'wood', 'wonder', 'woman', 'wolf', 'witness', 'winter',
  'wine', 'window', 'win', 'will', 'wild', 'wide', 'wide', 'wife', 'whole', 'where',
];

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const WALLET_CONFIG = {
  defaultAlgorithm: 'ED25519' as KeyAlgorithm,
  seedPhraseLength: 12, // 12 or 24 words
  socialRecoveryMinNominees: 3,
  socialRecoveryDefaultApprovals: 2,
  socialRecoveryDefaultDelayHours: 72,
  encryptionAlgorithm: 'aes-256-gcm',
  derivationPaths: {
    TGDP_SOVEREIGN: "m/44'/901'/0'/0/0",
    FTR_STANDARD: "m/44'/902'/0'/0/0",
    DAC_COMMERCE: "m/44'/903'/0'/0/0",
    TRCS_SETTLEMENT: "m/44'/904'/0'/0/0",
  },
  addressPrefixes: {
    TGDP_SOVEREIGN: 'tgdp_',
    FTR_STANDARD: 'ftr_',
    DAC_COMMERCE: 'dac_',
    TRCS_SETTLEMENT: 'trcs_',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class WalletService {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // WALLET CREATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Create a new wallet with seed phrase
   */
  static async createWallet(
    participantId: string,
    registrationId: string,
    namespace: WalletNamespace,
    password: string,
    options?: {
      algorithm?: KeyAlgorithm;
      seedPhraseLength?: 12 | 24;
      seedPhraseHint?: string;
    }
  ): Promise<WalletCreationResult> {
    const algorithm = options?.algorithm || WALLET_CONFIG.defaultAlgorithm;
    const seedPhraseLength = options?.seedPhraseLength || WALLET_CONFIG.seedPhraseLength;
    
    // Generate entropy and seed phrase
    const entropy = crypto.randomBytes(seedPhraseLength === 12 ? 16 : 32);
    const seedPhraseWords = this.entropyToMnemonic(entropy);
    
    // Derive keys from seed
    const seed = this.mnemonicToSeed(seedPhraseWords.join(' '), password);
    const derivationPath = WALLET_CONFIG.derivationPaths[namespace];
    const keyPair = this.deriveKeyPair(seed, derivationPath, algorithm);
    
    // Generate wallet address
    const walletAddress = this.generateWalletAddress(keyPair.publicKey, namespace);
    
    // Encrypt private key
    const encryptedPrivateKey = this.encryptPrivateKey(keyPair.privateKey, password);
    
    // Generate checksum
    const checksum = this.generateChecksum(walletAddress, keyPair.publicKey);
    
    // Link registration ID on blockchain (mock)
    await this.linkRegistrationToBlockchain(registrationId, walletAddress, namespace);
    
    return {
      walletAddress,
      publicKey: keyPair.publicKey,
      namespace,
      registrationId,
      createdAt: new Date(),
      seedPhraseWords,
      seedPhraseHint: options?.seedPhraseHint,
      encryptedPrivateKey,
      keyAlgorithm: algorithm,
      derivationPath,
      checksum,
    };
  }
  
  /**
   * Convert entropy to BIP-39 mnemonic words
   */
  private static entropyToMnemonic(entropy: Buffer): string[] {
    // Calculate checksum
    const hash = crypto.createHash('sha256').update(entropy).digest();
    const checksumBits = entropy.length / 4; // 4 bits per 32 bits of entropy
    
    // Combine entropy and checksum
    const entropyBits = this.bytesToBinary(entropy);
    const checksumBinary = this.bytesToBinary(hash).substring(0, checksumBits);
    const combined = entropyBits + checksumBinary;
    
    // Split into 11-bit chunks for word indices
    const words: string[] = [];
    for (let i = 0; i < combined.length; i += 11) {
      const index = parseInt(combined.substring(i, i + 11), 2);
      words.push(BIP39_WORDLIST[index % BIP39_WORDLIST.length]);
    }
    
    return words;
  }
  
  /**
   * Convert mnemonic to seed
   */
  private static mnemonicToSeed(mnemonic: string, passphrase: string = ''): Buffer {
    const salt = 'mnemonic' + passphrase;
    return crypto.pbkdf2Sync(mnemonic, salt, 2048, 64, 'sha512');
  }
  
  /**
   * Derive key pair from seed using derivation path
   */
  private static deriveKeyPair(
    seed: Buffer,
    path: string,
    algorithm: KeyAlgorithm
  ): { publicKey: string; privateKey: string } {
    // Simplified key derivation - in production use proper HD key derivation
    // For Ed25519: use ed25519-hd-key package
    // For secp256k1: use hdkey or ethereumjs-wallet
    
    const hmac = crypto.createHmac('sha512', 'Bitcoin seed');
    hmac.update(seed);
    const derived = hmac.digest();
    
    const privateKeyBytes = derived.subarray(0, 32);
    
    // Generate public key based on algorithm
    let publicKey: string;
    
    switch (algorithm) {
      case 'ED25519':
        // In production, use tweetnacl or similar
        publicKey = crypto.createHash('sha256').update(privateKeyBytes).digest('hex');
        break;
      case 'SECP256K1':
        // In production, use secp256k1 library
        publicKey = '04' + crypto.createHash('sha256').update(privateKeyBytes).digest('hex') +
                    crypto.createHash('sha256').update(privateKeyBytes).update('2').digest('hex');
        break;
      case 'P256':
        publicKey = crypto.createHash('sha256').update(privateKeyBytes).digest('hex');
        break;
      default:
        throw new Error(`Unsupported key algorithm: ${algorithm}`);
    }
    
    return {
      publicKey,
      privateKey: privateKeyBytes.toString('hex'),
    };
  }
  
  /**
   * Generate wallet address from public key
   */
  private static generateWalletAddress(publicKey: string, namespace: WalletNamespace): string {
    const prefix = WALLET_CONFIG.addressPrefixes[namespace];
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    const checksum = crypto.createHash('sha256').update(hash).digest('hex').substring(0, 8);
    
    return `${prefix}${hash.substring(0, 32)}${checksum}`;
  }
  
  /**
   * Encrypt private key for secure storage
   */
  private static encryptPrivateKey(privateKey: string, password: string): string {
    const key = crypto.scryptSync(password, 'irg-ftr-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(WALLET_CONFIG.encryptionAlgorithm, key, iv);
    
    let encrypted = cipher.update(privateKey, 'hex', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Decrypt private key
   */
  static decryptPrivateKey(encryptedData: string, password: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const key = crypto.scryptSync(password, 'irg-ftr-salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(WALLET_CONFIG.encryptionAlgorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'hex');
    decrypted += decipher.final('hex');
    
    return decrypted;
  }
  
  /**
   * Generate wallet checksum for verification
   */
  private static generateChecksum(address: string, publicKey: string): string {
    const data = address + publicKey;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
  
  /**
   * Link registration ID to wallet on blockchain (mock)
   */
  private static async linkRegistrationToBlockchain(
    registrationId: string,
    walletAddress: string,
    namespace: WalletNamespace
  ): Promise<string> {
    // In production, this would call the smart contract
    // to register the mapping: registrationId -> walletAddress
    
    console.log(`[BLOCKCHAIN] Linking ${registrationId} to ${walletAddress} (${namespace})`);
    
    // Mock transaction hash
    return `0x${crypto.randomBytes(32).toString('hex')}`;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SOCIAL RECOVERY
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Configure social recovery for wallet
   */
  static configureSocialRecovery(
    participantId: string,
    nominees: Array<{
      nomineeId: string;
      name: string;
      email?: string;
      phone?: string;
    }>,
    requiredApprovals?: number,
    recoveryDelayHours?: number
  ): SocialRecoveryConfig {
    if (nominees.length < WALLET_CONFIG.socialRecoveryMinNominees) {
      throw new Error(`Minimum ${WALLET_CONFIG.socialRecoveryMinNominees} nominees required for social recovery`);
    }
    
    const approvals = requiredApprovals || WALLET_CONFIG.socialRecoveryDefaultApprovals;
    if (approvals > nominees.length) {
      throw new Error(`Required approvals (${approvals}) cannot exceed number of nominees (${nominees.length})`);
    }
    
    const recoveryNominees: SocialRecoveryNominee[] = nominees.map(n => ({
      nomineeId: n.nomineeId,
      name: n.name,
      email: n.email,
      phone: n.phone,
      publicKeyHash: crypto.createHash('sha256').update(n.nomineeId).digest('hex'),
      addedAt: new Date(),
    }));
    
    return {
      enabled: true,
      nominees: recoveryNominees,
      requiredApprovals: approvals,
      recoveryDelayHours: recoveryDelayHours || WALLET_CONFIG.socialRecoveryDefaultDelayHours,
      lastUpdated: new Date(),
    };
  }
  
  /**
   * Initiate social recovery
   */
  static async initiateSocialRecovery(
    walletAddress: string,
    initiatorId: string,
    newPublicKey: string
  ): Promise<{
    recoveryId: string;
    status: string;
    approvalDeadline: Date;
    requiredApprovals: number;
    currentApprovals: number;
  }> {
    const recoveryId = `REC_${crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    const approvalDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // In production, this would:
    // 1. Verify initiator is a valid nominee
    // 2. Create recovery request in smart contract
    // 3. Notify other nominees
    // 4. Start recovery delay timer
    
    console.log(`[SOCIAL_RECOVERY] Initiated for ${walletAddress} by ${initiatorId}`);
    
    return {
      recoveryId,
      status: 'PENDING_APPROVALS',
      approvalDeadline,
      requiredApprovals: 2, // From config
      currentApprovals: 1, // Initiator counts as first approval
    };
  }
  
  /**
   * Approve social recovery
   */
  static async approveSocialRecovery(
    recoveryId: string,
    nomineeId: string,
    signature: string
  ): Promise<{
    status: string;
    currentApprovals: number;
    recoveryExecutionAt?: Date;
  }> {
    // In production, verify signature and update smart contract
    
    console.log(`[SOCIAL_RECOVERY] Approval from ${nomineeId} for ${recoveryId}`);
    
    // Mock: Assume this approval meets threshold
    return {
      status: 'THRESHOLD_MET',
      currentApprovals: 2,
      recoveryExecutionAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hour delay
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HARDWARE WALLET
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Link hardware wallet
   */
  static async linkHardwareWallet(
    participantId: string,
    walletAddress: string,
    hardwareType: 'LEDGER' | 'TREZOR' | 'KEEPKEY' | 'COLDCARD',
    publicKey: string,
    deviceId?: string
  ): Promise<HardwareWalletConfig> {
    // In production:
    // 1. Verify public key matches wallet
    // 2. Verify device signature
    // 3. Update wallet configuration
    
    const config: HardwareWalletConfig = {
      type: hardwareType,
      deviceId,
      publicKey,
      linkedAt: new Date(),
    };
    
    console.log(`[HARDWARE_WALLET] Linked ${hardwareType} to ${walletAddress}`);
    
    return config;
  }
  
  /**
   * Export wallet for hardware device
   */
  static exportForHardwareWallet(
    walletAddress: string,
    targetDevice: 'LEDGER' | 'TREZOR' | 'KEEPKEY' | 'COLDCARD'
  ): WalletExportFormat {
    // Generate appropriate export format for target device
    const format = targetDevice === 'LEDGER' ? 'KEYSTORE_V3' : 'WIF';
    
    // Mock export data
    const exportData: WalletExportFormat = {
      format,
      encryptedData: crypto.randomBytes(64).toString('hex'), // Placeholder
      publicKey: crypto.randomBytes(32).toString('hex'),
      address: walletAddress,
    };
    
    return exportData;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // WALLET VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Verify seed phrase matches wallet
   */
  static verifySeedPhrase(
    seedPhraseWords: string[],
    walletAddress: string,
    namespace: WalletNamespace,
    password: string = ''
  ): boolean {
    try {
      // Recreate wallet from seed phrase
      const mnemonic = seedPhraseWords.join(' ');
      const seed = this.mnemonicToSeed(mnemonic, password);
      const derivationPath = WALLET_CONFIG.derivationPaths[namespace];
      const keyPair = this.deriveKeyPair(seed, derivationPath, WALLET_CONFIG.defaultAlgorithm);
      const recreatedAddress = this.generateWalletAddress(keyPair.publicKey, namespace);
      
      return recreatedAddress === walletAddress;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Validate seed phrase format
   */
  static validateSeedPhrase(words: string[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check length
    if (words.length !== 12 && words.length !== 24) {
      errors.push(`Seed phrase must be 12 or 24 words (got ${words.length})`);
    }
    
    // Check all words are in wordlist
    const invalidWords = words.filter(w => !BIP39_WORDLIST.includes(w.toLowerCase()));
    if (invalidWords.length > 0) {
      errors.push(`Invalid words: ${invalidWords.join(', ')}`);
    }
    
    // Verify checksum
    if (errors.length === 0) {
      const checksumValid = this.verifySeedPhraseChecksum(words);
      if (!checksumValid) {
        errors.push('Invalid seed phrase checksum');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Verify seed phrase checksum
   */
  private static verifySeedPhraseChecksum(words: string[]): boolean {
    try {
      // Convert words to indices
      const indices = words.map(w => BIP39_WORDLIST.indexOf(w.toLowerCase()));
      if (indices.includes(-1)) return false;
      
      // Convert to binary
      let binary = '';
      for (const index of indices) {
        binary += index.toString(2).padStart(11, '0');
      }
      
      // Split entropy and checksum
      const checksumLength = words.length === 12 ? 4 : 8;
      const entropyBits = binary.substring(0, binary.length - checksumLength);
      const checksumBits = binary.substring(binary.length - checksumLength);
      
      // Calculate expected checksum
      const entropyBytes = this.binaryToBytes(entropyBits);
      const hash = crypto.createHash('sha256').update(entropyBytes).digest();
      const expectedChecksum = this.bytesToBinary(hash).substring(0, checksumLength);
      
      return checksumBits === expectedChecksum;
    } catch {
      return false;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Convert bytes to binary string
   */
  private static bytesToBinary(bytes: Buffer): string {
    return Array.from(bytes)
      .map(b => b.toString(2).padStart(8, '0'))
      .join('');
  }
  
  /**
   * Convert binary string to bytes
   */
  private static binaryToBytes(binary: string): Buffer {
    const bytes: number[] = [];
    for (let i = 0; i < binary.length; i += 8) {
      bytes.push(parseInt(binary.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }
  
  /**
   * Generate username from registration ID
   */
  static generateUsername(registrationId: string, preferredAlias?: string): string {
    if (preferredAlias) {
      // Sanitize and return preferred alias
      const sanitized = preferredAlias
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .substring(0, 20);
      
      if (sanitized.length >= 3) {
        return sanitized;
      }
    }
    
    // Generate from registration ID
    return registrationId.toLowerCase().replace(/-/g, '_');
  }
  
  /**
   * Check username availability
   */
  static async checkUsernameAvailability(username: string): Promise<{
    available: boolean;
    suggestions?: string[];
  }> {
    // In production, check database
    // Mock: Assume 20% chance of being taken
    const isTaken = Math.random() < 0.2;
    
    if (isTaken) {
      const suggestions = [
        `${username}_1`,
        `${username}${Math.floor(Math.random() * 1000)}`,
        `${username}_${new Date().getFullYear()}`,
      ];
      
      return {
        available: false,
        suggestions,
      };
    }
    
    return { available: true };
  }
  
  /**
   * Get wallet balance (mock)
   */
  static async getWalletBalance(walletAddress: string): Promise<{
    available: number;
    locked: number;
    staked: number;
    currency: string;
  }> {
    // In production, query blockchain
    return {
      available: 0,
      locked: 0,
      staked: 0,
      currency: 'FTR',
    };
  }
}

// Export singleton
export const walletService = new WalletService();
