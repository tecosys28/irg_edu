// ═══════════════════════════════════════════════════════════════════════════════
// IRG SWAP SYSTEM - CORPUS FUND SERVICE (v6.0 Production)
// Manages: Short-sale execution, FX absorption, Pro-rata returns, Recall transfers
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient, CorpusStatus } from '@prisma/client';
import { useAuditLog, useValidation } from '../hooks/hep-hooks';
import { SWAP_CONSTANTS, CorpusFund } from '../../../shared/types';

const prisma = new PrismaClient();

export class CorpusFundService {
  private static instance: CorpusFundService;
  private auditLog = useAuditLog();
  private validation = useValidation();

  private constructor() {}

  public static getInstance(): CorpusFundService {
    if (!CorpusFundService.instance) {
      CorpusFundService.instance = new CorpusFundService();
    }
    return CorpusFundService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CREATE CORPUS FUND FOR MINTER
  // ─────────────────────────────────────────────────────────────────────────────

  async createCorpusFund(
    minterId: string,
    initialDeposit: number,
    userId: string
  ): Promise<{ success: boolean; corpusFund?: CorpusFund; error?: string }> {
    try {
      // Check if minter exists and doesn't have a corpus fund
      const minter = await prisma.minter.findUnique({
        where: { id: minterId },
        include: { corpusFund: true },
      });

      if (!minter) {
        return { success: false, error: 'Minter not found.' };
      }

      if (minter.corpusFund) {
        return { success: false, error: 'Corpus fund already exists for this minter.' };
      }

      const corpusFund = await prisma.corpusFund.create({
        data: {
          minterId,
          totalBalance: initialDeposit,
          perUnitValue: 0,
          outstandingUnits: 0,
          marketMakerLimit: initialDeposit * 0.5, // 50% of initial deposit
          status: CorpusStatus.ACTIVE,
        },
        include: { minter: true },
      });

      // Create initial deposit transaction
      await prisma.transaction.create({
        data: {
          type: 'CORPUS_DEPOSIT',
          toCorpusFundId: corpusFund.id,
          amount: initialDeposit,
          currency: minter.currency,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      this.auditLog.log({
        action: 'CORPUS_FUND_CREATED',
        userId,
        resourceType: 'CorpusFund',
        resourceId: corpusFund.id,
        newState: { totalBalance: initialDeposit, status: CorpusStatus.ACTIVE },
      });

      return { success: true, corpusFund: corpusFund as unknown as CorpusFund };
    } catch (error) {
      console.error('[CorpusFundService] createCorpusFund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create corpus fund.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DEPOSIT TO CORPUS FUND
  // ─────────────────────────────────────────────────────────────────────────────

  async deposit(
    corpusFundId: string,
    amount: number,
    userId: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    if (amount <= 0) {
      return { success: false, error: 'Deposit amount must be positive.' };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const corpus = await tx.corpusFund.findUnique({
          where: { id: corpusFundId },
          include: { minter: true },
        });

        if (!corpus) {
          throw new Error('Corpus fund not found.');
        }

        if (corpus.status !== CorpusStatus.ACTIVE) {
          throw new Error('Corpus fund is not active.');
        }

        const updatedCorpus = await tx.corpusFund.update({
          where: { id: corpusFundId },
          data: {
            totalBalance: { increment: amount },
            marketMakerLimit: { increment: amount * 0.5 },
          },
        });

        await tx.transaction.create({
          data: {
            type: 'CORPUS_DEPOSIT',
            toCorpusFundId: corpusFundId,
            amount,
            currency: corpus.minter.currency,
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });

        return updatedCorpus;
      });

      this.auditLog.log({
        action: 'CORPUS_DEPOSIT',
        userId,
        resourceType: 'CorpusFund',
        resourceId: corpusFundId,
        newState: { totalBalance: Number(result.totalBalance) },
        metadata: { depositAmount: amount },
      });

      return { success: true, newBalance: Number(result.totalBalance) };
    } catch (error) {
      console.error('[CorpusFundService] deposit error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deposit failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROCESS SURRENDER RETURN (Pro-rata return to developer)
  // Swap.docx §d - Reduces recall liability
  // ─────────────────────────────────────────────────────────────────────────────

  async processSurrenderReturn(
    minterId: string,
    unitsSurrendered: number,
    userId: string
  ): Promise<{ success: boolean; returnAmount?: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const corpus = await tx.corpusFund.findUnique({
          where: { minterId },
          include: { minter: true },
        });

        if (!corpus) {
          throw new Error('Corpus fund not found.');
        }

        if (corpus.status !== CorpusStatus.ACTIVE) {
          throw new Error('Corpus fund is not active.');
        }

        // Calculate pro-rata return
        const perUnit = Number(corpus.totalBalance) / Math.max(corpus.outstandingUnits, 1);
        const returnAmount = perUnit * unitsSurrendered;

        // Validate
        const validation = this.validation.validateCorpusFundOperation(
          Number(corpus.totalBalance),
          returnAmount,
          'withdrawal'
        );

        if (!validation.valid) {
          throw new Error(validation.errors.join('; '));
        }

        // Update corpus
        await tx.corpusFund.update({
          where: { minterId },
          data: {
            totalBalance: { decrement: returnAmount },
            outstandingUnits: { decrement: unitsSurrendered },
            lastSnapshotAt: new Date(),
          },
        });

        // Create transaction
        await tx.transaction.create({
          data: {
            type: 'SURRENDER_RETURN',
            toCorpusFundId: corpus.id,
            toMinterId: minterId,
            amount: returnAmount,
            currency: corpus.minter.currency,
            status: 'COMPLETED',
            processedAt: new Date(),
            metadata: { unitsSurrendered, perUnit },
          },
        });

        return returnAmount;
      });

      this.auditLog.log({
        action: 'SURRENDER_RETURN_PROCESSED',
        userId,
        resourceType: 'CorpusFund',
        resourceId: minterId,
        metadata: { unitsSurrendered, returnAmount: result },
      });

      return { success: true, returnAmount: result };
    } catch (error) {
      console.error('[CorpusFundService] processSurrenderReturn error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Surrender return failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRANSFER TO RECALL FUND
  // Swap.docx §e - On recall event
  // ─────────────────────────────────────────────────────────────────────────────

  async transferToRecallFund(
    minterId: string,
    userId: string
  ): Promise<{ success: boolean; transferredAmount?: number; error?: string }> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const corpus = await tx.corpusFund.findUnique({
          where: { minterId },
          include: { minter: true },
        });

        if (!corpus) {
          throw new Error('Corpus fund not found.');
        }

        if (corpus.status === CorpusStatus.RECALL_TRANSFERRED) {
          throw new Error('Corpus fund already transferred to recall.');
        }

        const transferAmount = Number(corpus.totalBalance);

        // Update corpus status
        await tx.corpusFund.update({
          where: { minterId },
          data: {
            status: CorpusStatus.RECALL_TRANSFERRED,
            totalBalance: 0,
            shortSaleBalance: 0,
            fxReserve: 0,
            lastSnapshotAt: new Date(),
          },
        });

        // Create recall transfer transaction
        await tx.transaction.create({
          data: {
            type: 'RECALL_TRANSFER',
            toCorpusFundId: corpus.id,
            amount: transferAmount,
            currency: corpus.minter.currency,
            status: 'COMPLETED',
            processedAt: new Date(),
            metadata: { 
              originalBalance: transferAmount,
              shortSaleBalance: Number(corpus.shortSaleBalance),
              fxReserve: Number(corpus.fxReserve),
            },
          },
        });

        return transferAmount;
      });

      this.auditLog.log({
        action: 'RECALL_TRANSFER',
        userId,
        resourceType: 'CorpusFund',
        resourceId: minterId,
        newState: { status: CorpusStatus.RECALL_TRANSFERRED },
        metadata: { transferredAmount: result },
      });

      return { success: true, transferredAmount: result };
    } catch (error) {
      console.error('[CorpusFundService] transferToRecallFund error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Recall transfer failed.',
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RUN CORPUS SNAPSHOT (Daily/periodic)
  // Recalculates perUnitValue for incentives, market-maker support
  // ─────────────────────────────────────────────────────────────────────────────

  async runCorpusSnapshot(): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      const activeCorpuses = await prisma.corpusFund.findMany({
        where: { status: CorpusStatus.ACTIVE },
        include: { minter: true },
      });

      for (const corpus of activeCorpuses) {
        try {
          // Count active tokens for this minter
          const tokenCount = await prisma.ftrToken.count({
            where: {
              minterId: corpus.minterId,
              state: { in: ['ACTIVE', 'LISTED'] },
            },
          });

          // Calculate new per-unit value
          const totalValue = Number(corpus.totalBalance) + Number(corpus.investmentReturns);
          const perUnitValue = tokenCount > 0 ? totalValue / tokenCount : 0;

          await prisma.corpusFund.update({
            where: { id: corpus.id },
            data: {
              perUnitValue,
              outstandingUnits: tokenCount,
              lastSnapshotAt: new Date(),
            },
          });

          updated++;
        } catch (err) {
          errors.push(`Failed to update ${corpus.id}: ${err}`);
        }
      }
    } catch (error) {
      errors.push(`Snapshot job failed: ${error}`);
    }

    return { updated, errors };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET CORPUS FUND DETAILS
  // ─────────────────────────────────────────────────────────────────────────────

  async getCorpusFund(minterId: string): Promise<CorpusFund | null> {
    const corpus = await prisma.corpusFund.findUnique({
      where: { minterId },
      include: { minter: true },
    });

    return corpus as unknown as CorpusFund | null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET CORPUS FUND STATS
  // ─────────────────────────────────────────────────────────────────────────────

  async getCorpusFundStats(corpusFundId: string): Promise<{
    totalBalance: number;
    shortSaleBalance: number;
    fxReserve: number;
    perUnitValue: number;
    outstandingUnits: number;
    utilizationRate: number;
    recentTransactions: any[];
  } | null> {
    const corpus = await prisma.corpusFund.findUnique({
      where: { id: corpusFundId },
    });

    if (!corpus) return null;

    const recentTransactions = await prisma.transaction.findMany({
      where: { toCorpusFundId: corpusFundId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const totalBalance = Number(corpus.totalBalance);
    const shortSaleBalance = Number(corpus.shortSaleBalance);
    const utilizationRate = totalBalance > 0 ? shortSaleBalance / totalBalance : 0;

    return {
      totalBalance,
      shortSaleBalance,
      fxReserve: Number(corpus.fxReserve),
      perUnitValue: Number(corpus.perUnitValue),
      outstandingUnits: corpus.outstandingUnits,
      utilizationRate,
      recentTransactions,
    };
  }
}

export const corpusFundService = CorpusFundService.getInstance();
