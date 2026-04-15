/**
 * IRG_FTR - REDEMPTION SERVICE v5.0
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class RedemptionService {
  async initiateFromOrder(params: any) {
    const { orderId, ftrTokenIds, sellerId, buyerId } = params;
    await prisma.ftrToken.updateMany({
      where: { id: { in: ftrTokenIds } },
      data: { state: 'EARMARKED', earmarkedAt: new Date(), earmarkedFor: 'REDEMPTION', redemptionOrderId: orderId },
    });
    return { success: true, data: { redemptionId: `RDM-${Date.now()}` } };
  }

  async verifyFtrIds(orderId: string) {
    const tokens = await prisma.ftrToken.findMany({ where: { redemptionOrderId: orderId } });
    return { success: true, data: { orderId, tokenIds: tokens.map(t => t.id), allValid: true, invalidTokens: [], earmarkedAt: new Date() } };
  }

  async confirmSale(params: any) {
    const { orderId, confirmed } = params;
    if (confirmed) {
      const tokens = await prisma.ftrToken.findMany({ where: { redemptionOrderId: orderId } });
      await prisma.ftrToken.updateMany({
        where: { id: { in: tokens.map(t => t.id) } },
        data: { state: 'SURRENDERED', isSurrendered: true, surrenderedAt: new Date() },
      });
    }
    return { success: true };
  }

  async exerciseDeregistration(params: any) {
    const { tokenId, holderId } = params;
    const token = await prisma.ftrToken.update({
      where: { id: tokenId },
      data: { state: 'DEREGISTERED', holderOptionExercised: true, deregisteredAt: new Date() },
    });
    return { success: true, data: { tokenId, publicId: token.publicId, newState: 'DEREGISTERED', deregisteredAt: new Date() } };
  }

  async getPendingRedemptions(userId: string) {
    const tokens = await prisma.ftrToken.findMany({
      where: { holderId: userId, state: 'SURRENDERED', holderOptionExercised: false },
    });
    return { success: true, data: tokens };
  }

  async getSurrenderWallets(minterId: string) {
    const wallets = await prisma.surrenderWallet.findMany({ where: { minterId } });
    return { success: true, data: wallets };
  }
}

export default new RedemptionService();
