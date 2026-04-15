/**
 * IRG_FTR PLATFORM - Database Seed Script
 * P2 AUDIT FIX: Add test data for development/testing
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 * 
 * Usage: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SEED USERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating users...');
  
  const passwordHash = await hash('TestPass123!', 12);
  
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@irg-ftr.com' },
      update: {},
      create: {
        email: 'admin@irg-ftr.com',
        name: 'System Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        kycStatus: 'APPROVED',
        isActive: true,
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      },
    }),
    prisma.user.upsert({
      where: { email: 'holder@test.com' },
      update: {},
      create: {
        email: 'holder@test.com',
        name: 'Test Holder',
        passwordHash,
        role: 'HOLDER',
        kycStatus: 'APPROVED',
        isActive: true,
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      },
    }),
    prisma.user.upsert({
      where: { email: 'minter@test.com' },
      update: {},
      create: {
        email: 'minter@test.com',
        name: 'Test Minter User',
        passwordHash,
        role: 'MINTER',
        kycStatus: 'APPROVED',
        isActive: true,
        walletAddress: '0x7890abcdef1234567890abcdef1234567890abcd',
      },
    }),
    prisma.user.upsert({
      where: { email: 'consultant@test.com' },
      update: {},
      create: {
        email: 'consultant@test.com',
        name: 'Test Consultant',
        passwordHash,
        role: 'CONSULTANT',
        kycStatus: 'APPROVED',
        isActive: true,
        walletAddress: '0xdef1234567890abcdef1234567890abcdef123456',
      },
    }),
  ]);
  
  console.log(`✓ Created ${users.length} users\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SEED MINTERS
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating minters...');
  
  const minters = await Promise.all([
    prisma.minter.upsert({
      where: { id: 'minter_001' },
      update: {},
      create: {
        id: 'minter_001',
        userId: users[2].id,
        businessName: 'Hospitality Corp India',
        businessType: 'PVT_LTD',
        registrationNumber: 'CIN123456789',
        gstNumber: '27AABCU9603R1ZM',
        panNumber: 'AABCU9603R',
        countryCode: 'IN',
        stateCode: 'MH',
        status: 'ACTIVE',
      },
    }),
    prisma.minter.upsert({
      where: { id: 'minter_002' },
      update: {},
      create: {
        id: 'minter_002',
        userId: users[2].id,
        businessName: 'Healthcare Services US',
        businessType: 'LLP',
        registrationNumber: 'EIN987654321',
        countryCode: 'US',
        stateCode: 'CA',
        status: 'ACTIVE',
      },
    }),
  ]);
  
  console.log(`✓ Created ${minters.length} minters\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SEED CORPUS FUNDS
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating corpus funds...');
  
  const corpusFunds = await Promise.all([
    prisma.corpusFund.upsert({
      where: { minterId: 'minter_001' },
      update: {},
      create: {
        minterId: 'minter_001',
        totalBalance: 1000000,
        shortSaleBalance: 0,
        fxReserve: 50000,
        perUnitValue: 100,
        outstandingUnits: 10000,
        marketMakerLimit: 200000,
        investmentReturns: 25000,
        status: 'ACTIVE',
      },
    }),
    prisma.corpusFund.upsert({
      where: { minterId: 'minter_002' },
      update: {},
      create: {
        minterId: 'minter_002',
        totalBalance: 500000,
        shortSaleBalance: 0,
        fxReserve: 25000,
        perUnitValue: 80,
        outstandingUnits: 6250,
        marketMakerLimit: 100000,
        investmentReturns: 10000,
        status: 'ACTIVE',
      },
    }),
  ]);
  
  console.log(`✓ Created ${corpusFunds.length} corpus funds\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SEED PROJECTS
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating projects...');
  
  const projects = await Promise.all([
    prisma.project.upsert({
      where: { id: 'project_001' },
      update: {},
      create: {
        id: 'project_001',
        minterId: 'minter_001',
        name: 'Hotel Room Nights Program',
        description: 'Tokenized hotel room nights for partner properties',
        productType: 'HOSP',
        countryCode: 'IN',
        stateCode: 'MH',
        totalCapacity: 10000,
        mintedTokens: 5000,
        faceValue: 5000,
        validityYears: 5,
        expectedRoi: 9.2,
        status: 'ACTIVE',
      },
    }),
    prisma.project.upsert({
      where: { id: 'project_002' },
      update: {},
      create: {
        id: 'project_002',
        minterId: 'minter_002',
        name: 'Healthcare Services Package',
        description: 'Tokenized healthcare services',
        productType: 'HEALTH',
        countryCode: 'US',
        stateCode: 'CA',
        totalCapacity: 5000,
        mintedTokens: 2000,
        faceValue: 10000,
        validityYears: 10,
        expectedRoi: 6.5,
        status: 'ACTIVE',
      },
    }),
  ]);
  
  console.log(`✓ Created ${projects.length} projects\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SEED FTR TOKENS
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating FTR tokens...');
  
  const tokens = [];
  for (let i = 1; i <= 10; i++) {
    const token = await prisma.ftrToken.upsert({
      where: { id: `token_${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        id: `token_${String(i).padStart(3, '0')}`,
        tokenId: `${i}`,
        publicId: `HOSP-2026-MNT001-${String(i).padStart(5, '0')}`,
        productType: 'HOSP',
        minterId: 'minter_001',
        holderId: users[1].id, // Test holder
        faceValue: 5000,
        currency: 'INR',
        state: i <= 7 ? 'AVAILABLE' : (i === 8 ? 'LISTED' : (i === 9 ? 'EARMARKED' : 'REDEEMED')),
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), // 5 years
        metadata: { batchId: 'batch_001', serialNumber: i },
      },
    });
    tokens.push(token);
  }
  
  console.log(`✓ Created ${tokens.length} FTR tokens\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. SEED CONSULTANTS
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating consultants...');
  
  const consultants = await Promise.all([
    prisma.consultant.upsert({
      where: { id: 'consultant_001' },
      update: {},
      create: {
        id: 'consultant_001',
        userId: users[3].id,
        registrationNumber: 'CON-2026-001',
        businessName: 'Expert Appraisals Ltd',
        specializations: ['APPRAISAL', 'FINANCIAL_ANALYSIS'],
        categories: ['HOSP', 'HEALTH'],
        countryCode: 'IN',
        stateCode: 'MH',
        geoScore: 100,
        rating: 4.5,
        totalReviews: 25,
        onTimePercentage: 95,
        availabilityStatus: 'AVAILABLE',
        status: 'ACTIVE',
        baseFeePercent: 2,
      },
    }),
    prisma.consultant.upsert({
      where: { id: 'consultant_002' },
      update: {},
      create: {
        id: 'consultant_002',
        userId: users[3].id,
        registrationNumber: 'CON-2026-002',
        businessName: 'Legal Review Partners',
        specializations: ['LEGAL_REVIEW', 'COMPLIANCE_CHECK'],
        categories: ['K_FTR', 'TGDP', 'HEALTH'],
        countryCode: 'IN',
        stateCode: 'DL',
        geoScore: 80,
        rating: 4.2,
        totalReviews: 18,
        onTimePercentage: 88,
        availabilityStatus: 'AVAILABLE',
        status: 'ACTIVE',
        baseFeePercent: 2.5,
      },
    }),
  ]);
  
  console.log(`✓ Created ${consultants.length} consultants\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. SEED ROI CONFIGURATIONS (P1 FIX)
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating ROI configurations...');
  
  const roiConfigs = await Promise.all([
    prisma.roiConfig.upsert({
      where: { countryCode: 'IN' },
      update: {},
      create: { countryCode: 'IN', roiPercent: 9.2, effectiveFrom: new Date('2026-01-01'), updatedBy: 'system' },
    }),
    prisma.roiConfig.upsert({
      where: { countryCode: 'US' },
      update: {},
      create: { countryCode: 'US', roiPercent: 6.5, effectiveFrom: new Date('2026-01-01'), updatedBy: 'system' },
    }),
    prisma.roiConfig.upsert({
      where: { countryCode: 'GB' },
      update: {},
      create: { countryCode: 'GB', roiPercent: 7.0, effectiveFrom: new Date('2026-01-01'), updatedBy: 'system' },
    }),
    prisma.roiConfig.upsert({
      where: { countryCode: 'AE' },
      update: {},
      create: { countryCode: 'AE', roiPercent: 8.0, effectiveFrom: new Date('2026-01-01'), updatedBy: 'system' },
    }),
    prisma.roiConfig.upsert({
      where: { countryCode: 'SG' },
      update: {},
      create: { countryCode: 'SG', roiPercent: 5.5, effectiveFrom: new Date('2026-01-01'), updatedBy: 'system' },
    }),
  ]);
  
  console.log(`✓ Created ${roiConfigs.length} ROI configurations\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. SEED SURRENDER WALLETS
  // ─────────────────────────────────────────────────────────────────────────────
  
  console.log('Creating surrender wallets...');
  
  const surrenderWallets = await Promise.all([
    prisma.surrenderWallet.upsert({
      where: { minterId: 'minter_001' },
      update: {},
      create: {
        minterId: 'minter_001',
        walletAddress: 'SURRENDER-minter_001',
        totalTokens: 50,
        totalValue: 250000,
        status: 'ACTIVE',
      },
    }),
  ]);
  
  console.log(`✓ Created ${surrenderWallets.length} surrender wallets\n`);

  console.log('🎉 Database seed completed successfully!\n');
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('                    SEED SUMMARY                        ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Users:           ${users.length}`);
  console.log(`Minters:         ${minters.length}`);
  console.log(`Corpus Funds:    ${corpusFunds.length}`);
  console.log(`Projects:        ${projects.length}`);
  console.log(`FTR Tokens:      ${tokens.length}`);
  console.log(`Consultants:     ${consultants.length}`);
  console.log(`ROI Configs:     ${roiConfigs.length}`);
  console.log(`Surrender Wallets: ${surrenderWallets.length}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('\nTest Credentials:');
  console.log('  Admin: admin@irg-ftr.com / TestPass123!');
  console.log('  Holder: holder@test.com / TestPass123!');
  console.log('  Minter: minter@test.com / TestPass123!');
  console.log('  Consultant: consultant@test.com / TestPass123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
