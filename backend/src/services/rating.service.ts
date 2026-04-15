/**
 * IRG_FTR - RATING SERVICE v5.0
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class RatingService {
  async getAIScore(reportUrls: string[], taskType: string) {
    const score = 70 + Math.random() * 25;
    return {
      score: Math.round(score * 100) / 100,
      confidence: 0.85 + Math.random() * 0.1,
      recommendation: score >= 85 ? 'AUTO_APPROVE' : score >= 60 ? 'MANUAL_REVIEW' : 'AUTO_REJECT',
    };
  }

  async calculateFinalRating(taskId: string) {
    const task = await prisma.consultantTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');
    const finalRating = 3.5 + Math.random() * 1.5;
    await prisma.consultantTask.update({
      where: { id: taskId },
      data: { finalRating: new Prisma.Decimal(finalRating), ratingUpdatedAt: new Date() },
    });
    return { finalRating };
  }

  async getRatingHistory(consultantId: string) {
    return prisma.consultantTask.findMany({
      where: { consultantId, finalRating: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    });
  }

  async overrideRating(params: any) {
    await prisma.consultant.update({
      where: { id: params.consultantId },
      data: { rating: new Prisma.Decimal(params.newRating) },
    });
    return { success: true };
  }
}

export default new RatingService();
