/**
 * IRG_FTR MASTER PLATFORM - SWAP MODULE v6.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 * 
 * User-initiated swaps: Surrender any FTR/TGDP → Request any minter service
 * System short-sale: When inventory unavailable
 * Cross-currency support with FX
 * All FTR product types supported
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export * from './services';
export { default as swapRoutes } from './routes';
export * from './hooks/hep-hooks';
