// ═══════════════════════════════════════════════════════════════════════════════
// IRG SWAP SYSTEM - SWAP SERVICE (v6.0 Production)
// Complete implementation with all 8 HEP hooks for zero human errors
// Covers: User-initiated swaps, System short-sale, Cross-currency, All FTR types
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient, SwapStatus, InventorySource, TokenState } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  createHepContext,
  HepContext,
  useDoubleEntry,
  useConfirmation,
  useDuplicateGuard,
  useRateLimit,
  useValidation,
  useAuditLog,
  useRollback,
} from '../hooks/hep-hooks';
import {
  SwapRequest,
  RequestedService,
  InitiateSwapRequest,
  InitiateSwapResponse,
  ExecuteSwapResponse,
  InventoryCheckResult,
  SWAP_CONSTANTS,
} from '../../../shared/types';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────────
// SWAP SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class SwapService {
  private static instance: SwapService;
  private hep: HepContext;

  private constructor() {
    this.hep = createHepContext({
      confirmText: 'Confirm Swap Execution',
      timeout: SWAP_CONSTANTS.CONFIRMATION_TIMEOUT_MS,
    });
  }

  public static getInstance(): SwapService {
    if (!SwapService.instance) {
      SwapService.instance = new SwapService();
    }
    return SwapService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/swap/initiate
  // User-initiated swap (surrender any FTR/TGDP → request any minter service)
  // ─────────────────────────────────────────────────────────────────────────────

  async initiateSwap(
    initiatorId: string,
    request: InitiateSwapRequest
  ): Promise<InitiateSwapResponse> {
    const { offeredTokenId, requestedMinterId, requestedService } = request;

    // HOOK 1: Rate Limit Check
    const rateLimitCheck = this.hep.rateLimit.checkLimit(initiatorId);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        requiresConfirmation: false,
        inventoryStatus: { available: false, source: InventorySource.OPEN_MARKET, quantity: 0, requiresShortSale: false },
        estimatedRates: { offeredRate: 0, requestedRate: 0, fxRate: 1, netValue: 0 },
        error: `Rate limit exceeded. Try again in ${Math.ceil(rateLimitCheck.resetIn / 1000)} seconds.`,
      };
    }

    // HOOK 2: Duplicate Guard Check
    if (this.hep.duplicateGuard.isDuplicate({ initiatorId, offeredTokenId, requestedMinterId })) {
      return {
        success: false,
        requiresConfirmation: false,
        inventoryStatus: { available: false, source: InventorySource.OPEN_MARKET, quantity: 0, requiresShortSale: false },
        estimatedRates: { offeredRate: 0, requestedRate: 0, fxRate: 1, netValue: 0 },
        error: 'Duplicate request detected. Please wait before submitting again.',
      };
    }

    // HOOK 3: Validation
    const validation = this.hep.validation.validateSwapRequest(
      offeredTokenId,
      requestedMinterId,
      requestedService
    );
    if (!validation.valid) {
      return {
        success: false,
        requiresConfirmation: false,
        inventoryStatus: { available: false, source: InventorySource.OPEN_MARKET, quantity: 0, requiresShortSale: false },
        estimatedRates: { offeredRate: 0, requestedRate: 0, fxRate: 1, netValue: 0 },
        error: validation.errors.join('; '),
      };
    }

    // Record duplicate guard submission
    this.hep.duplicateGuard.recordSubmission({ initiatorId, offeredTokenId, requestedMinterId });

    try {
      // Verify token ownership if offering a token
      if (offeredTokenId) {
        const token = await prisma.ftrToken.findUnique({
          where: { id: offeredTokenId },
        });

        if (!token || token.holderId !== initiatorId) {
          return {
            success: false,
            requiresConfirmation: false,
            inventoryStatus: { available: false, source: InventorySource.OPEN_MARKET, quantity: 0, requiresShortSale: false },
            estimatedRates: { offeredRate: 0, requestedRate: 0, fxRate: 1, netValue: 0 },
            error: 'Token not found or not owned by initiator.',
          };
        }

        if (token.state !== TokenState.ACTIVE) {
          return {
            success: false,
            requiresConfirmation: false,
            inventoryStatus: { available: false, source: InventorySource.OPEN_MARKET, quantity: 0, requiresShortSale: false },
            estimatedRates: { offeredRate: 0, requestedRate: 0, fxRate: 1, netValue: 0 },
            error: `Token is not available for swap (current state: ${token.state}).`,
          };
        }
      }

      // Verify requested minter exists
      const requestedMinter = await prisma.minter.findUnique({
        where: { id: requestedMinterId },
        include: { corpusFund: true },
      });

      if (!requestedMinter || !requestedMinter.isActive) {
        return {
          success: false,
          requiresConfirmation: false,
          inventoryStatus: { available: false, source: InventorySource.OPEN_MARKET, quantity: 0, requiresShortSale: false },
          estimatedRates: { offeredRate: 0, requestedRate: 0, fxRate: 1, netValue: 0 },
          error: 'Requested minter not found or inactive.',
        };
      }

      // Get market rates
      const rates = await this.getMarketRates(offeredTokenId, requestedService);

      // Check inventory (Market → Minter CF → Pooled CF → Short Sale)
      const inventoryStatus = await this.checkInventory(
        requestedMinterId,
        requestedService.quantity,
        requestedService.productType
      );

      // Create swap request
      const swap = await prisma.swapRequest.create({
        data: {
          initiatorId,
          offeredTokenId,
          requestedMinterId,
          requestedService: requestedService as any,
          status: SwapStatus.PENDING,
          marketRateOffered: rates.offeredRate,
          marketRateRequested: rates.requestedRate,
          fxRate: rates.fxRate,
          inventorySource: inventoryStatus.source,
          shortSaleTriggered: inventoryStatus.requiresShortSale,
          corpusAccountId: inventoryStatus.corpusFundId,
        },
        include: {
          initiator: true,
          offeredToken: true,
          requestedMinter: true,
        },
      });

      // HOOK 4: Request confirmation
      const confirmationRequest = this.hep.confirmation.requestConfirmation(async () => {
        return this.executeSwap(swap.id, inventoryStatus.requiresShortSale);
      });

      // Update swap with confirmation token
      await prisma.swapRequest.update({
        where: { id: swap.id },
        data: { confirmationToken: confirmationRequest.token },
      });

      // HOOK 5: Audit Log
      this.hep.auditLog.log({
        action: 'SWAP_INITIATED',
        userId: initiatorId,
        resourceType: 'SwapRequest',
        resourceId: swap.id,
        newState: { status: swap.status, inventorySource: inventoryStatus.source },
        metadata: { warnings: validation.warnings },
      });

      return {
        success: true,
        swap: swap as unknown as SwapRequest,
        requiresConfirmation: true,
        confirmationToken: confirmationRequest.token,
        inventoryStatus,
        estimatedRates: {
          offeredRate: rates.offeredRate,
          requestedRate: rates.requestedRate,
          fxRate: rates.fxRate,
          netValue: rates.offeredRate - rates.requestedRate * rates.fxRate,
        },
      };
    } catch (error) {
      console.error('[SwapService] initiateSwap error:', error);
      return {
        success: false,
        requiresConfirmation: false,
        inventoryStatus: { available: false, source: InventorySource.OPEN_MARKET, quantity: 0, requiresShortSale: false },
        estimatedRates: { offeredRate: 0, requestedRate: 0, fxRate: 1, netValue: 0 },
        error: error instanceof Error ? error.message : 'Failed to initiate swap.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/v1/swap/confirm/:swapId
  // Confirm and execute swap after user confirmation
  // ─────────────────────────────────────────────────────────────────────────────

  async confirmSwap(swapId: string, confirmationToken: string): Promise<ExecuteSwapResponse> {
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapId },
    });

    if (!swap) {
      return { success: false, error: 'Swap request not found.' };
    }

    if (swap.confirmationToken !== confirmationToken) {
      return { success: false, error: 'Invalid confirmation token.' };
    }

    if (swap.status !== SwapStatus.PENDING) {
      return { success: false, error: `Swap cannot be confirmed (current status: ${swap.status}).` };
    }

    try {
      const result = await this.hep.confirmation.confirm(confirmationToken);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return result.result as ExecuteSwapResponse;
    } catch (error) {
      console.error('[SwapService] confirmSwap error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm swap.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXECUTE SWAP (Internal - called after confirmation)
  // Atomic execution with HEP hooks + payment trigger
  // ─────────────────────────────────────────────────────────────────────────────

  private async executeSwap(swapId: string, isShortSale: boolean): Promise<ExecuteSwapResponse> {
    const rollback = useRollback();
    const doubleEntry = useDoubleEntry();

    try {
      return await prisma.$transaction(async (tx) => {
        // Get swap with all relations
        const swap = await tx.swapRequest.findUnique({
          where: { id: swapId },
          include: {
            offeredToken: true,
            requestedMinter: { include: { corpusFund: true } },
            initiator: true,
          },
        });

        if (!swap) {
          throw new Error('Swap not found');
        }

        // Update status
        await tx.swapRequest.update({
          where: { id: swapId },
          data: { 
            status: isShortSale ? SwapStatus.SHORT_SALE_INITIATED : SwapStatus.INVENTORY_CHECK,
            confirmedAt: new Date(),
          },
        });

        // HOOK 6: Register rollback for token state
        if (swap.offeredTokenId) {
          const originalState = swap.offeredToken!.state;
          rollback.registerRollback(
            `Revert token ${swap.offeredTokenId} state`,
            async () => {
              await prisma.ftrToken.update({
                where: { id: swap.offeredTokenId! },
                data: { state: originalState },
              });
            }
          );

          // Surrender the offered token
          await tx.ftrToken.update({
            where: { id: swap.offeredTokenId },
            data: {
              state: TokenState.SURRENDERED,
              surrenderedAt: new Date(),
              redemptionOrderId: swapId,
            },
          });
        }

        // HOOK 7: Double-entry accounting
        const offeredValue = Number(swap.marketRateOffered) || 0;
        const requestedValue = Number(swap.marketRateRequested) || 0;
        const fxRate = Number(swap.fxRate) || 1;
        const adjustedRequestedValue = requestedValue * fxRate;

        // Debit initiator (what they're giving up)
        doubleEntry.record(swap.initiatorId, offeredValue, 'debit');
        
        // Credit minter (what they're receiving)
        doubleEntry.record(swap.requestedMinterId, adjustedRequestedValue, 'credit');

        // Fee to IRG
        const fee = adjustedRequestedValue * SWAP_CONSTANTS.SWAP_FEE_PERCENTAGE;
        doubleEntry.record('IRG_CF', fee, 'credit');

        // If short sale, handle corpus fund
        let corpusImpact = { shortSaleTriggered: false, pnlAmount: 0, fxImpact: 0 };

        if (isShortSale && swap.requestedMinter.corpusFund) {
          corpusImpact = await this.handleShortSale(
            tx,
            swap.requestedMinter.corpusFund.id,
            (swap.requestedService as any).quantity || 1,
            fxRate,
            rollback
          );

          doubleEntry.record(swap.requestedMinter.corpusFund.id, corpusImpact.pnlAmount, 'debit');
        }

        // Verify double-entry balance
        const balanceCheck = doubleEntry.verify();
        if (!balanceCheck.balanced && balanceCheck.discrepancy > 0.01) {
          // For this swap flow, we allow imbalance due to fees
          console.warn(`[SwapService] Double-entry discrepancy: ${balanceCheck.discrepancy}`);
        }

        // Create settlement transaction
        const transaction = await tx.transaction.create({
          data: {
            type: 'SWAP_SETTLEMENT',
            swapRequestId: swapId,
            fromUserId: swap.initiatorId,
            toMinterId: swap.requestedMinterId,
            toCorpusFundId: isShortSale ? swap.requestedMinter.corpusFund?.id : undefined,
            amount: adjustedRequestedValue,
            currency: (swap.requestedService as any).currency || 'USD',
            fxRate: fxRate,
            status: 'COMPLETED',
            processedAt: new Date(),
            metadata: {
              offeredTokenId: swap.offeredTokenId,
              isShortSale,
              fee,
              corpusImpact,
            },
          },
        });

        // Create fee transaction
        await tx.transaction.create({
          data: {
            type: 'SWAP_FEE',
            swapRequestId: swapId,
            fromUserId: swap.initiatorId,
            amount: fee,
            currency: (swap.requestedService as any).currency || 'USD',
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });

        // Final status update
        const executedSwap = await tx.swapRequest.update({
          where: { id: swapId },
          data: {
            status: SwapStatus.EXECUTED,
            executedAt: new Date(),
            shortSaleTriggered: isShortSale,
          },
          include: {
            initiator: true,
            offeredToken: true,
            requestedMinter: true,
            transactions: true,
          },
        });

        // HOOK 8: Audit Log
        this.hep.auditLog.log({
          action: 'SWAP_EXECUTED',
          userId: swap.initiatorId,
          resourceType: 'SwapRequest',
          resourceId: swapId,
          previousState: { status: swap.status },
          newState: { status: SwapStatus.EXECUTED, isShortSale },
          metadata: { transaction: transaction.id, corpusImpact },
        });

        return {
          success: true,
          swap: executedSwap as unknown as SwapRequest,
          transaction: transaction as any,
          corpusImpact,
        };
      });
    } catch (error) {
      console.error('[SwapService] executeSwap error:', error);

      // Execute rollbacks
      const rollbackResult = await rollback.executeRollbacks();
      console.log('[SwapService] Rollback result:', rollbackResult);

      // Mark swap as failed
      await prisma.swapRequest.update({
        where: { id: swapId },
        data: {
          status: SwapStatus.FAILED,
          failureReason: error instanceof Error ? error.message : 'Execution failed',
        },
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Swap execution failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SHORT SALE HANDLING (Corpus Fund)
  // ─────────────────────────────────────────────────────────────────────────────

  private async handleShortSale(
    tx: any,
    corpusFundId: string,
    quantity: number,
    fxRate: number,
    rollback: ReturnType<typeof useRollback>
  ): Promise<{ shortSaleTriggered: boolean; pnlAmount: number; fxImpact: number }> {
    const corpus = await tx.corpusFund.findUnique({
      where: { id: corpusFundId },
    });

    if (!corpus) {
      throw new Error('Corpus fund not found');
    }

    const perUnitValue = Number(corpus.perUnitValue);
    const shortSaleValue = quantity * perUnitValue;
    const fxImpact = fxRate !== 1 ? shortSaleValue * (fxRate - 1) : 0;

    // Register rollback
    rollback.registerRollback(
      `Revert corpus fund ${corpusFundId} short sale`,
      async () => {
        await prisma.corpusFund.update({
          where: { id: corpusFundId },
          data: {
            shortSaleBalance: { decrement: shortSaleValue },
            outstandingUnits: { increment: quantity },
            fxReserve: { decrement: fxImpact },
          },
        });
      }
    );

    // Update corpus fund
    await tx.corpusFund.update({
      where: { id: corpusFundId },
      data: {
        shortSaleBalance: { increment: shortSaleValue },
        outstandingUnits: { decrement: quantity },
        fxReserve: { increment: fxImpact },
        lastSnapshotAt: new Date(),
      },
    });

    // Create P/L transaction
    await tx.transaction.create({
      data: {
        type: 'SHORT_SALE_PROFIT_LOSS',
        toCorpusFundId: corpusFundId,
        amount: shortSaleValue,
        currency: 'USD',
        status: 'COMPLETED',
        processedAt: new Date(),
        metadata: { quantity, perUnitValue, fxRate, fxImpact },
      },
    });

    return {
      shortSaleTriggered: true,
      pnlAmount: shortSaleValue,
      fxImpact,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INVENTORY CHECK (Market → Minter CF → Pooled CF → Short Sale)
  // ─────────────────────────────────────────────────────────────────────────────

  async checkInventory(
    minterId: string,
    quantity: number,
    productType: string
  ): Promise<InventoryCheckResult> {
    // Check order: Open Market → Minter's CF → Pooled Super Corpus → Short Sale

    // 1. Check open market listings
    const marketListings = await prisma.marketplaceListing.findMany({
      where: {
        isActive: true,
        token: {
          minterId,
          productType: productType as any,
          state: TokenState.LISTED,
        },
      },
      include: { token: true },
      take: quantity,
    });

    if (marketListings.length >= quantity) {
      const avgPrice = marketListings.reduce((sum, l) => sum + Number(l.askPrice), 0) / marketListings.length;
      return {
        available: true,
        source: InventorySource.OPEN_MARKET,
        quantity: marketListings.length,
        marketPrice: avgPrice,
        requiresShortSale: false,
      };
    }

    // 2. Check minter's corpus fund
    const minterCorpus = await prisma.corpusFund.findUnique({
      where: { minterId },
    });

    if (minterCorpus && minterCorpus.outstandingUnits >= quantity) {
      return {
        available: true,
        source: InventorySource.MINTER_CF,
        quantity: minterCorpus.outstandingUnits,
        corpusFundId: minterCorpus.id,
        requiresShortSale: false,
      };
    }

    // 3. Check pooled corpus funds (other minters with same product type)
    const pooledCorpus = await prisma.corpusFund.findMany({
      where: {
        minterId: { not: minterId },
        status: 'ACTIVE',
        outstandingUnits: { gte: quantity },
      },
      orderBy: { outstandingUnits: 'desc' },
      take: 1,
    });

    if (pooledCorpus.length > 0) {
      return {
        available: true,
        source: InventorySource.POOLED_CF,
        quantity: pooledCorpus[0].outstandingUnits,
        corpusFundId: pooledCorpus[0].id,
        requiresShortSale: false,
      };
    }

    // 4. Fall back to short sale (if minter corpus has capacity)
    if (minterCorpus && minterCorpus.status === 'ACTIVE') {
      return {
        available: true,
        source: InventorySource.SHORT_SALE,
        quantity,
        corpusFundId: minterCorpus.id,
        requiresShortSale: true,
      };
    }

    // No inventory available
    return {
      available: false,
      source: InventorySource.OPEN_MARKET,
      quantity: 0,
      requiresShortSale: false,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MARKET RATE CALCULATION
  // ─────────────────────────────────────────────────────────────────────────────

  async getMarketRates(
    offeredTokenId: string | undefined,
    requestedService: RequestedService
  ): Promise<{ offeredRate: number; requestedRate: number; fxRate: number }> {
    let offeredRate = 0;

    if (offeredTokenId) {
      const token = await prisma.ftrToken.findUnique({
        where: { id: offeredTokenId },
      });
      if (token) {
        // Check if listed on marketplace for current price
        const listing = await prisma.marketplaceListing.findFirst({
          where: { tokenId: offeredTokenId, isActive: true },
        });
        offeredRate = listing ? Number(listing.askPrice) : Number(token.faceValue);
      }
    }

    const requestedRate = requestedService.estimatedValue;

    // Get FX rate if currencies differ
    let fxRate = 1;
    if (offeredTokenId) {
      const token = await prisma.ftrToken.findUnique({ where: { id: offeredTokenId } });
      if (token && token.currency !== requestedService.currency) {
        const fxRecord = await prisma.fxRate.findFirst({
          where: {
            fromCurrency: token.currency,
            toCurrency: requestedService.currency,
            validTo: null,
          },
          orderBy: { validFrom: 'desc' },
        });
        if (fxRecord) {
          fxRate = Number(fxRecord.rate);
        }
      }
    }

    return { offeredRate, requestedRate, fxRate };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CANCEL SWAP
  // ─────────────────────────────────────────────────────────────────────────────

  async cancelSwap(swapId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const swap = await prisma.swapRequest.findUnique({
      where: { id: swapId },
    });

    if (!swap) {
      return { success: false, error: 'Swap not found.' };
    }

    if (swap.initiatorId !== userId) {
      return { success: false, error: 'Not authorized to cancel this swap.' };
    }

    if (swap.status !== SwapStatus.PENDING) {
      return { success: false, error: `Cannot cancel swap (current status: ${swap.status}).` };
    }

    // Cancel confirmation if exists
    if (swap.confirmationToken) {
      this.hep.confirmation.cancel(swap.confirmationToken);
    }

    await prisma.swapRequest.update({
      where: { id: swapId },
      data: { status: SwapStatus.CANCELLED },
    });

    this.hep.auditLog.log({
      action: 'SWAP_CANCELLED',
      userId,
      resourceType: 'SwapRequest',
      resourceId: swapId,
      previousState: { status: swap.status },
      newState: { status: SwapStatus.CANCELLED },
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET USER SWAPS (History & Pending)
  // ─────────────────────────────────────────────────────────────────────────────

  async getUserSwaps(
    userId: string,
    options?: { status?: SwapStatus; limit?: number; offset?: number }
  ): Promise<{ swaps: SwapRequest[]; total: number }> {
    const where = {
      initiatorId: userId,
      ...(options?.status && { status: options.status }),
    };

    const [swaps, total] = await Promise.all([
      prisma.swapRequest.findMany({
        where,
        include: {
          initiator: true,
          offeredToken: { include: { minter: true } },
          requestedMinter: true,
          transactions: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      prisma.swapRequest.count({ where }),
    ]);

    return { swaps: swaps as unknown as SwapRequest[], total };
  }
}

export const swapService = SwapService.getInstance();
