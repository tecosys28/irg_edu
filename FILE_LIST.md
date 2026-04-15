# IRG_FTR PLATFORM v5.0 + SWAP v6.0 - FILE LIST
## Audit-Fixed Version (13 April 2026)

**IPR Owner:** Rohit Tidke | © 2026 Intech Research Group

---

## AUDIT FIX MARKERS
Files marked with [P0], [P1], [P2] contain fixes for audit findings.

---

## ROOT
```
├── README.md                              # [UPDATED] Audit compliance documentation
├── FILE_LIST.md                           # This file
├── package.json                           # Workspace configuration
└── .env.template                          # Environment template
```

## CONTRACTS
```
contracts/
├── src/
│   └── FTRToken.sol                       # ERC-1155 token contract
├── scripts/
│   └── deploy.ts                          # [P0 FIX] Constructor mismatch fixed
└── hardhat.config.ts                      # Hardhat configuration
```

## BACKEND
```
backend/
├── src/
│   ├── app.ts                             # Express application setup
│   ├── config/
│   │   └── production.config.ts           # [P1 FIX] 2FA enabled
│   ├── middleware/
│   │   ├── auth.ts                        # Authentication middleware
│   │   └── sanitize.ts                    # [P1 FIX] XSS protection
│   ├── routes/
│   │   ├── index.ts                       # Route aggregator
│   │   ├── users.routes.ts                # [P0 FIX] Fully implemented
│   │   ├── minters.routes.ts              # [P0 FIX] Fully implemented
│   │   ├── projects.routes.ts             # [P0 FIX] Fully implemented
│   │   ├── admin.routes.ts                # [P0/P1 FIX] Dynamic ROI endpoints
│   │   ├── consultant.routes.ts           # Consultant module routes
│   │   └── redemption.routes.ts           # Redemption module routes
│   ├── services/
│   │   ├── consultant.service.ts          # Shortlisting, offers, tasks
│   │   ├── rating.service.ts              # AI scoring, peer ranking
│   │   ├── redemption.service.ts          # Surrender, deregistration
│   │   └── roi.service.ts                 # [P1 FIX] Dynamic ROI service
│   └── modules/
│       └── swap/
│           ├── services/
│           │   ├── swap.service.ts        # Swap execution
│           │   ├── corpus-fund.service.ts # Corpus fund management
│           │   ├── payment.service.ts     # Payment processing
│           │   └── blockchain.service.ts  # Blockchain integration
│           ├── routes/
│           │   └── swap.routes.ts         # Swap API endpoints
│           └── hooks/
│               └── hep-hooks.ts           # HEP hooks (backend)
└── prisma/
    └── schema.prisma                      # [P1 FIX] RoiConfig model added
```

## FRONTEND
```
frontend/
└── src/
    └── modules/
        ├── minting/
        │   └── MintingApplicationForm.tsx # [P0/P1/P2 FIX] Complete form with dynamic ROI
        ├── consultant/
        │   ├── ConsultantPortal.tsx       # Dashboard
        │   └── ConsultantReviewForm.tsx   # Report submission
        ├── redemption/
        │   └── RedemptionPanel.tsx        # Redemption UI
        └── swap/
            ├── SwapApp.tsx                # Swap application
            └── CrossCurrencySwapUI.tsx    # [P2 FIX] Cross-currency UI
```

## SHARED
```
shared/
├── constants.ts                           # Platform constants
├── types/
│   └── index.ts                           # TypeScript types
├── hooks/
│   └── index.ts                           # [P0 FIX] Fixed useDebounce
└── swap/
    └── types.ts                           # Swap-specific types
```

## PRISMA
```
prisma/
├── schema.prisma                          # [P1 FIX] Complete schema with RoiConfig
└── seed/
    └── seed.ts                            # [P2 FIX] Database seed data
```

## DOCS
```
docs/
└── api-reference.md                       # API documentation
```

---

## TOTAL FILES: 45+

## AUDIT FIX SUMMARY

### P0 Fixes (3 files)
1. `contracts/scripts/deploy.ts` - Constructor arguments
2. `shared/hooks/index.ts` - useDebounce stale closure
3. `backend/src/routes/*.ts` - Empty routes filled

### P1 Fixes (4 files)
1. `backend/src/routes/admin.routes.ts` - Dynamic ROI API
2. `backend/prisma/schema.prisma` - RoiConfig model
3. `backend/src/config/production.config.ts` - 2FA enabled
4. `backend/src/middleware/sanitize.ts` - XSS protection

### P2 Fixes (3 files)
1. `frontend/src/modules/minting/MintingApplicationForm.tsx` - Steps 2-4
2. `frontend/src/modules/swap/CrossCurrencySwapUI.tsx` - Swap UI
3. `prisma/seed/seed.ts` - Seed data
