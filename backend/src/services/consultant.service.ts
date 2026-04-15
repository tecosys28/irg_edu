/**
 * IRG_FTR - CONSULTANT SERVICE v5.0
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class ConsultantService {
  async registerConsultant(data: any) {
    const consultant = await prisma.consultant.create({
      data: {
        userId: data.userId,
        registrationNumber: data.registrationNumber,
        businessName: data.businessName,
        specializations: data.specializations,
        categories: data.categories,
        countryCode: data.countryCode,
        stateCode: data.stateCode,
        city: data.city,
        geoScore: new Prisma.Decimal(50),
        baseFeePercent: new Prisma.Decimal(data.baseFeePercent ?? 2.0),
        status: 'PENDING',
      },
    });
    return { success: true, data: consultant };
  }

  async shortlistConsultants(params: any) {
    const consultants = await prisma.consultant.findMany({
      where: {
        status: 'ACTIVE',
        countryCode: params.countryCode,
        categories: { hasSome: params.categories },
      },
      orderBy: [{ rating: 'desc' }, { geoScore: 'desc' }],
      take: params.limit || 10,
    });
    return { success: true, data: { consultants, geoScores: {}, availabilityStatus: {} } };
  }

  async sendOffer(data: any) {
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 72);
    const offer = await prisma.consultantOffer.create({
      data: {
        consultantId: data.consultantId,
        mintingAppId: data.mintingAppId,
        feeQuoted: new Prisma.Decimal(data.feeQuoted),
        terms: data.terms || {},
        validUntil,
        status: 'SENT',
      },
    });
    return { success: true, data: offer };
  }

  async respondToOffer(offerId: string, accept: boolean, consultantId: string) {
    const offer = await prisma.consultantOffer.update({
      where: { id: offerId },
      data: { status: accept ? 'ACCEPTED' : 'REJECTED', respondedAt: new Date() },
    });
    return { success: true, data: offer };
  }

  async allocateTask(params: any) {
    const task = await prisma.consultantTask.create({
      data: {
        consultantId: params.consultantId,
        mintingAppId: params.mintingAppId,
        taskType: params.taskType,
        description: params.description,
        deadline: params.deadline,
        status: 'ASSIGNED',
        feeQuoted: new Prisma.Decimal(params.feeQuoted),
        onTimeBonus: new Prisma.Decimal(0),
        doubleEntryVerified: false,
      },
    });
    return { success: true, data: task };
  }

  async startTask(taskId: string, consultantId: string) {
    const task = await prisma.consultantTask.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS' },
    });
    return { success: true, data: task };
  }

  async submitReport(params: any, consultantId: string, doubleEntryHash: string) {
    const task = await prisma.consultantTask.update({
      where: { id: params.taskId },
      data: {
        status: 'SUBMITTED',
        reportUrl: params.reportUrls,
        reportHash: params.reportHash,
        submittedAt: new Date(),
        doubleEntryVerified: true,
        confirmationHash: doubleEntryHash,
      },
    });
    return { success: true, data: task };
  }

  async processFeePament(taskId: string, approvedBy: string, approvedFee?: number) {
    const task = await prisma.consultantTask.update({
      where: { id: taskId },
      data: { feeApproved: approvedFee ? new Prisma.Decimal(approvedFee) : undefined, feePaidAt: new Date() },
    });
    return { success: true, data: { transactionId: `TXN-${Date.now()}` } };
  }

  async getConsultantTasks(consultantId: string, status?: string) {
    const tasks = await prisma.consultantTask.findMany({
      where: { consultantId, ...(status && { status: status as any }) },
      orderBy: { deadline: 'asc' },
    });
    return { success: true, data: tasks };
  }

  async getConsultantDashboard(consultantId: string) {
    const consultant = await prisma.consultant.findUnique({ where: { id: consultantId } });
    const tasks = await prisma.consultantTask.groupBy({ by: ['status'], where: { consultantId }, _count: true });
    return {
      success: true,
      data: {
        profile: consultant,
        tasks: tasks.reduce((acc, t) => ({ ...acc, [t.status]: t._count }), {}),
        totalEarnings: 0,
      },
    };
  }

  async getConsultantByUserId(userId: string) {
    return prisma.consultant.findUnique({ where: { userId } });
  }

  async getConsultantById(id: string) {
    return prisma.consultant.findUnique({ where: { id } });
  }
}

export default new ConsultantService();
