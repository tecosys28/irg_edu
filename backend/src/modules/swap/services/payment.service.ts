// ═══════════════════════════════════════════════════════════════════════════════
// IRG SWAP SYSTEM - PAYMENT SERVICE (v6.0 Production)
// Handles: Swap settlements, Corpus P/L, FX adjustments, Fee routing
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient, TransactionType, TransactionStatus } from '@prisma/client';
import { useDoubleEntry, useAuditLog } from '../hooks/hep-hooks';
import { SWAP_CONSTANTS, Transaction } from '../../../shared/types';

const prisma = new PrismaClient();

export class PaymentService {
  private static instance: PaymentService;
  private auditLog = useAuditLog();

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESS SWAP PAYMENT
  // Main payment flow for swap settlements with double-entry
  // ─────────────────────────────────────────────────────────────────────────────

  async processSwapPayment(
    swapId: string,
    offeredRate: number,
    requestedRate: number,
    fxRate: number = 1
  ): Promise<{ success: boolean; transactions?: Transaction[]; error?: string }> {
    const doubleEntry = useDoubleEntry();

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id: swapId },
        include: {
          initiator: true,
          requestedMinter: { include: { corpusFund: true } },
        },
      });

      if (!swap) {
        return { success: false, error: 'Swap not found.' };
      }

      const adjustedRequestedRate = requestedRate * fxRate;
      const fee = adjustedRequestedRate * SWAP_CONSTANTS.SWAP_FEE_PERCENTAGE;

      const transactions = await prisma.$transaction(async (tx) => {
        const createdTransactions: any[] = [];

        // 1. Settlement: Initiator → Minter CF
        const settlement = await tx.transaction.create({
          data: {
            type: TransactionType.SWAP_SETTLEMENT,
            swapRequestId: swapId,
            fromUserId: swap.initiatorId,
            toMinterId: swap.requestedMinterId,
            toCorpusFundId: swap.requestedMinter.corpusFund?.id,
            amount: adjustedRequestedRate - fee,
            currency: (swap.requestedService as any).currency || 'USD',
            fxRate,
            status: TransactionStatus.COMPLETED,
            processedAt: new Date(),
            metadata: { offeredRate, requestedRate, fxRate },
          },
        });
        createdTransactions.push(settlement);

        // Double-entry: debit initiator, credit minter
        doubleEntry.record(swap.initiatorId, adjustedRequestedRate, 'debit');
        doubleEntry.record(swap.requestedMinterId, adjustedRequestedRate - fee, 'credit');

        // 2. Fee: Initiator → IRG CF
        const feeTransaction = await tx.transaction.create({
          data: {
            type: TransactionType.SWAP_FEE,
            swapRequestId: swapId,
            fromUserId: swap.initiatorId,
            amount: fee,
            currency: (swap.requestedService as any).currency || 'USD',
            status: TransactionStatus.COMPLETED,
            processedAt: new Date(),
            metadata: { feePercentage: SWAP_CONSTANTS.SWAP_FEE_PERCENTAGE },
          },
        });
        createdTransactions.push(feeTransaction);

        // Double-entry: credit IRG CF
        doubleEntry.record('IRG_CF', fee, 'credit');

        // 3. FX adjustment if applicable
        if (fxRate !== 1) {
          const fxImpact = requestedRate * (fxRate - 1);
          const fxTransaction = await tx.transaction.create({
            data: {
              type: TransactionType.FX_ADJUSTMENT,
              swapRequestId: swapId,
              toCorpusFundId: swap.requestedMinter.corpusFund?.id,
              amount: Math.abs(fxImpact),
              currency: (swap.requestedService as any).currency || 'USD',
              fxRate,
              status: TransactionStatus.COMPLETED,
              processedAt: new Date(),
              metadata: { fxImpact, direction: fxImpact >= 0 ? 'gain' : 'loss' },
            },
          });
          createdTransactions.push(fxTransaction);

          // Update corpus FX reserve
          if (swap.requestedMinter.corpusFund) {
            await tx.corpusFund.update({
              where: { id: swap.requestedMinter.corpusFund.id },
              data: {
                fxReserve: { increment: fxImpact },
              },
            });
          }
        }

        // Verify double-entry balance
        const balance = doubleEntry.verify();
        if (!balance.balanced) {
          console.warn(`[PaymentService] Double-entry imbalance: ${balance.discrepancy}`);
        }

        return createdTransactions;
      });

      this.auditLog.log({
        action: 'SWAP_PAYMENT_PROCESSED',
        userId: swap.initiatorId,
        resourceType: 'SwapRequest',
        resourceId: swapId,
        metadata: {
          offeredRate,
          requestedRate,
          adjustedRequestedRate,
          fee,
          fxRate,
          transactionCount: transactions.length,
        },
      });

      return { success: true, transactions: transactions as Transaction[] };
    } catch (error) {
      console.error('[PaymentService] processSwapPayment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECORD CORPUS P/L
  // For short-sale profit/loss tracking
  // ─────────────────────────────────────────────────────────────────────────────

  async recordCorpusPnl(
    minterId: string,
    amount: number,
    reason: 'SHORT_SALE_PROFIT_LOSS' | 'FX_ADJUSTMENT',
    context?: any
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const corpus = await prisma.corpusFund.findUnique({
        where: { minterId },
        include: { minter: true },
      });

      if (!corpus) {
        return { success: false, error: 'Corpus fund not found.' };
      }

      const transaction = await prisma.transaction.create({
        data: {
          type: reason as TransactionType,
          toMinterId: minterId,
          toCorpusFundId: corpus.id,
          amount,
          currency: corpus.minter.currency,
          status: TransactionStatus.COMPLETED,
          processedAt: new Date(),
          metadata: context,
        },
      });

      this.auditLog.log({
        action: 'CORPUS_PNL_RECORDED',
        userId: 'SYSTEM',
        resourceType: 'CorpusFund',
        resourceId: corpus.id,
        metadata: { amount, reason, context },
      });

      return { success: true, transaction: transaction as unknown as Transaction };
    } catch (error) {
      console.error('[PaymentService] recordCorpusPnl error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'P/L recording failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESS SURRENDER RETURN PAYMENT
  // Payment to developer bank account
  // ─────────────────────────────────────────────────────────────────────────────

  async processSurrenderReturnPayment(
    minterId: string,
    amount: number
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const corpus = await prisma.corpusFund.findUnique({
        where: { minterId },
        include: { minter: true },
      });

      if (!corpus) {
        return { success: false, error: 'Corpus fund not found.' };
      }

      const transaction = await prisma.transaction.create({
        data: {
          type: TransactionType.SURRENDER_RETURN,
          toMinterId: minterId,
          toCorpusFundId: corpus.id,
          amount,
          currency: corpus.minter.currency,
          status: TransactionStatus.COMPLETED,
          processedAt: new Date(),
          metadata: { type: 'developer_cash_flow' },
        },
      });

      this.auditLog.log({
        action: 'SURRENDER_RETURN_PAYMENT',
        userId: 'SYSTEM',
        resourceType: 'CorpusFund',
        resourceId: corpus.id,
        metadata: { amount },
      });

      return { success: true, transaction: transaction as unknown as Transaction };
    } catch (error) {
      console.error('[PaymentService] processSurrenderReturnPayment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Surrender return payment failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRANSFER TO RECALL FUND
  // Routes to Recall Fund per irg_payment spec
  // ─────────────────────────────────────────────────────────────────────────────

  async transferToRecall(
    minterId: string,
    amount: number
  ): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
    try {
      const corpus = await prisma.corpusFund.findUnique({
        where: { minterId },
        include: { minter: true },
      });

      if (!corpus) {
        return { success: false, error: 'Corpus fund not found.' };
      }

      const transaction = await prisma.transaction.create({
        data: {
          type: TransactionType.RECALL_TRANSFER,
          toMinterId: minterId,
          toCorpusFundId: corpus.id,
          amount,
          currency: corpus.minter.currency,
          status: TransactionStatus.COMPLETED,
          processedAt: new Date(),
          metadata: { destination: 'RECALL_FUND' },
        },
      });

      this.auditLog.log({
        action: 'RECALL_TRANSFER_PAYMENT',
        userId: 'SYSTEM',
        resourceType: 'CorpusFund',
        resourceId: corpus.id,
        metadata: { amount },
      });

      return { success: true, transaction: transaction as unknown as Transaction };
    } catch (error) {
      console.error('[PaymentService] transferToRecall error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Recall transfer failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET TRANSACTION HISTORY
  // ─────────────────────────────────────────────────────────────────────────────

  async getTransactionHistory(
    filters: {
      swapRequestId?: string;
      userId?: string;
      minterId?: string;
      type?: TransactionType;
      fromDate?: Date;
      toDate?: Date;
    },
    options?: { limit?: number; offset?: number }
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const where: any = {};

    if (filters.swapRequestId) where.swapRequestId = filters.swapRequestId;
    if (filters.userId) where.fromUserId = filters.userId;
    if (filters.minterId) where.toMinterId = filters.minterId;
    if (filters.type) where.type = filters.type;
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = filters.fromDate;
      if (filters.toDate) where.createdAt.lte = filters.toDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          swapRequest: true,
          fromUser: true,
          toMinter: true,
          toCorpusFund: true,
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions: transactions as unknown as Transaction[], total };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET PAYMENT SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────

  async getPaymentSummary(
    minterId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<{
    totalSettlements: number;
    totalFees: number;
    totalPnl: number;
    transactionCount: number;
  }> {
    const now = new Date();
    let fromDate: Date;

    switch (period) {
      case 'day':
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        toMinterId: minterId,
        createdAt: { gte: fromDate },
        status: TransactionStatus.COMPLETED,
      },
    });

    const summary = transactions.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount);
        switch (tx.type) {
          case TransactionType.SWAP_SETTLEMENT:
            acc.totalSettlements += amount;
            break;
          case TransactionType.SWAP_FEE:
            acc.totalFees += amount;
            break;
          case TransactionType.SHORT_SALE_PROFIT_LOSS:
          case TransactionType.FX_ADJUSTMENT:
            acc.totalPnl += amount;
            break;
        }
        acc.transactionCount++;
        return acc;
      },
      { totalSettlements: 0, totalFees: 0, totalPnl: 0, transactionCount: 0 }
    );

    return summary;
  }
}

export const paymentService = PaymentService.getInstance();
