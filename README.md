# IRG_FTR MASTER PLATFORM v6.0

## TROT Registration Protocol + ROI Module + Swap Module + Audit Fixes

**IPR Owner:** Rohit Tidke | © 2026 Intech Research Group

---

## What's New in v6.0

### 🆕 TROT Registration Module (Complete Implementation)

The platform now includes a comprehensive registration system following the TROT Registration Protocol:

| Feature | Description |
|---------|-------------|
| **Multi-Role Registration** | 10 participant archetypes with concurrent role support |
| **Entity Classification** | 11 entity types (Individual, Corporate, Trust, etc.) |
| **5-Tier Global KYC** | From provisional ($5K/mo) to institutional (unlimited) |
| **47+ Jurisdictions** | Country-specific KYC rules and document requirements |
| **Composite Risk Scoring** | 6-component weighted CRS formula (0.00-1.00) |
| **Human Error Prevention** | Double-entry verification, pattern detection, suggestions |
| **Video KYC** | Liveness detection, face matching, document verification |
| **Biometric Verification** | Fingerprint, face, iris support |
| **Bank Verification** | Penny drop verification with name matching |
| **Blockchain Wallet** | BIP-39 seed phrase, HD derivation, social recovery |
| **GDPR Compliance** | Data subject rights, consent management, retention |
| **Security** | Rate limiting, CSRF, fraud detection, geo-blocking |

### 🆕 ROI Module (Dynamic Country-Based ROI)

Dynamic ROI configuration with mandatory consultant justification:

| Feature | Description |
|---------|-------------|
| **Country-Specific ROI** | Base ROI configured per country (12+ countries) |
| **Min/Max Bounds** | Configurable ROI limits per jurisdiction |
| **Consultant Override** | ROI can be adjusted with mandatory justification |
| **Justification Categories** | 9 predefined categories + supporting evidence |
| **Auto-Approval** | Changes < 2% approved automatically |
| **Multi-Level Approval** | Large deviations require admin approval |
| **Audit Trail** | Complete history of all ROI changes |
| **Cache Management** | 5-minute cache with invalidation support |

### 🆕 Module Integration

All modules are now integrated for seamless FTR processing:

```
Registration Module ──┬──> Minting Module <──┬── ROI Module
                      │                      │
                      └──> Participant       └──> Dynamic ROI
                           Validation             with Justification
                                │
                                v
                      Consultant Approval
                      (ROI justification required)
```

---

## AUDIT COMPLIANCE STATUS

All issues from the FTR Platform Audit Report (13 April 2026) have been addressed:

### P0 Fixes (Blockers - RESOLVED)
| Issue | Status | File |
|-------|--------|------|
| Smart-contract deployment constructor mismatch | ✅ FIXED | `contracts/scripts/deploy.ts` |
| Frontend buggy useDebounce (stale closure) | ✅ FIXED | `shared/hooks/index.ts`, `frontend/src/modules/minting/MintingApplicationForm.tsx` |
| Empty backend routes (users, projects, minters, admin) | ✅ FIXED | `backend/src/routes/*.ts` |

### P1 Fixes (Security/Robustness - RESOLVED)
| Issue | Status | File |
|-------|--------|------|
| No dynamic ROI per country | ✅ FIXED | `backend/src/routes/admin.routes.ts`, `backend/prisma/schema.prisma` |
| 2FA disabled in production | ✅ FIXED | `backend/src/config/production.config.ts` |
| Input sanitization for XSS | ✅ FIXED | `backend/src/middleware/sanitize.ts` |

### P2 Fixes (Completeness - RESOLVED)
| Issue | Status | File |
|-------|--------|------|
| Missing form steps 2-4 | ✅ FIXED | `frontend/src/modules/minting/MintingApplicationForm.tsx` |
| No cross-currency swap UI | ✅ FIXED | `frontend/src/modules/swap/CrossCurrencySwapUI.tsx` |
| No Prisma seed data | ✅ FIXED | `prisma/seed/seed.ts` |

---

## Platform Features

### Core Modules
1. **Registration Module** (NEW) - TROT Protocol compliant multi-step registration
2. **Consultant Module** - Domain expert shortlisting, offers, tasks, payments
3. **Rating System** - AI scoring, peer ranking, weighted composite ratings
4. **Redemption Module** - Order-linked flow, surrender wallets, deregistration
5. **Swap Module** - Cross-product exchange with short-sale support

### Security Features
- Three-layer token security (Public ID + AES-256-GCM + Keccak-256)
- Firebase authentication with 2FA support
- Role-based access control
- Input sanitization (XSS protection)
- Rate limiting (action-specific) and CORS
- CSRF protection
- Fraud detection engine
- Geo-blocking for sanctioned countries
- 8 HEP (Human Error Prevention) hooks

### Registration Security
- Session-based authentication
- Device fingerprinting
- Bot protection (honeypot, timing validation)
- Brute force protection
- IP-based rate limiting
- VPN/Proxy/Tor detection
- Sanctions screening (OFAC/UN/EU/MHA)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS, Zustand |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM, Redis |
| Blockchain | Polygon, Solidity, ethers.js |
| Auth | Firebase Admin |
| KYC | DigiLocker, Signzy, Video KYC providers |
| Verification | OTP (Twilio/MSG91), Penny Drop APIs |

---

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.template .env
# Edit .env with your configuration

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Start development server
npm run dev
```

---

## API Endpoints

### Registration Module (NEW)
```
POST   /api/v1/registration/initiate           # Start registration
POST   /api/v1/registration/step/roles         # Select roles
POST   /api/v1/registration/step/entity-type   # Select entity type
POST   /api/v1/registration/step/individual-profile
POST   /api/v1/registration/step/corporate-profile
POST   /api/v1/registration/step/contact-details
POST   /api/v1/registration/step/bank-account
POST   /api/v1/registration/step/nominees
POST   /api/v1/registration/step/credentials
POST   /api/v1/registration/step/kyc-documents
POST   /api/v1/registration/step/video-kyc/initiate
POST   /api/v1/registration/step/terms
POST   /api/v1/registration/finalize
GET    /api/v1/registration/status
GET    /api/v1/registration/eligibility
GET    /api/v1/registration/risk-score
POST   /api/v1/registration/verify/mobile
POST   /api/v1/registration/verify/email
```

### ROI Module (NEW - Dynamic Country ROI)
```
GET    /api/v1/roi/config                      # Get all ROI configurations
GET    /api/v1/roi/config/:countryCode         # Get country-specific config
GET    /api/v1/roi/base/:countryCode           # Get base ROI for minting form
GET    /api/v1/roi/justification-categories    # Get justification categories
POST   /api/v1/roi/validate                    # Validate proposed ROI change
GET    /api/v1/roi/project/:projectId          # Get effective project ROI
POST   /api/v1/roi/override                    # Create ROI override (Consultant)
GET    /api/v1/roi/override/:id                # Get override details
GET    /api/v1/roi/overrides/pending           # Get pending overrides
PUT    /api/v1/roi/config/:countryCode         # Update country ROI (Admin)
POST   /api/v1/roi/override/:id/process        # Approve/reject override (Admin)
GET    /api/v1/roi/history                     # Get ROI change history
POST   /api/v1/roi/cache/invalidate            # Invalidate cache (Admin)
```

### Project Management (ROI Integrated)
```
GET    /api/v1/projects                        # Get minter's projects
POST   /api/v1/projects                        # Create project (validates ROI)
GET    /api/v1/projects/:id                    # Get project with effective ROI
PATCH  /api/v1/projects/:id                    # Update project
POST   /api/v1/projects/:id/consultant-approval # Submit approval with ROI justification
GET    /api/v1/projects/:id/roi-history        # Get project ROI changes
GET    /api/v1/projects/:id/tokens             # Get project tokens
GET    /api/v1/projects/:id/analytics          # Get project analytics
```

### Dynamic ROI (P1 Audit Fix - Legacy)
```
GET    /api/v1/admin/config/roi          # Get all ROI configs
GET    /api/v1/admin/config/roi?country=IN   # Get specific country
POST   /api/v1/admin/config/roi          # Update country ROI
POST   /api/v1/admin/config/roi/batch    # Batch update
GET    /api/v1/admin/config/roi/history  # Change history
```

### Consultant Module
```
POST   /api/v1/partners/consultants/shortlist
POST   /api/v1/partners/consultants/offer
POST   /api/v1/partners/consultants/tasks/:id/report
```

### Swap Module
```
POST   /api/v1/swap/initiate
POST   /api/v1/swap/confirm/:swapId
GET    /api/v1/swap/status/:swapId
```

### Redemption Module
```
POST   /api/v1/redemption/initiate
POST   /api/v1/redemption/confirm
POST   /api/v1/redemption/deregister/:tokenId
```

---

## Smart Contract Deployment

```bash
# Deploy to testnet (Amoy)
HARDHAT_NETWORK=amoy npx hardhat run scripts/deploy.ts

# Deploy to mainnet (Polygon)
HARDHAT_NETWORK=polygon npx hardhat run scripts/deploy.ts
```

**Note:** The deploy script now correctly passes both required constructor arguments:
1. `uri_` - Base URI for token metadata
2. `_feeRecipient` - Address to receive platform fees

---

## Constants Reference

| Parameter | Value |
|-----------|-------|
| Face Value Range | ₹10 - ₹10,000 |
| Validity Period | 1 - 25 years |
| Max Earmark | 25% |
| Surrender Ratio | 55% |
| Platform Fee | 1.5% |
| Swap Fee | 2% |
| FX Spread | 0.5% |
| Default ROI (India) | 9.2% |

### Registration Constants

| Parameter | Value |
|-----------|-------|
| KYC Tier 0 Limit | $5,000/month |
| KYC Tier 1 Limit | $50,000/month |
| KYC Tier 2 Limit | $500,000/month |
| FTR Provider Min Score | 0.65 |
| KYC Verification SLA | 60 seconds |
| Registration SLA | 5 minutes |
| GDPR Access SLA | 72 hours |
| FATF Retention | 7 years |

---

## Documentation

- [Registration API Reference](docs/REGISTRATION_API_REFERENCE.md)
- [API Reference](docs/API_REFERENCE.md)

---

## License

Proprietary - All rights reserved.
IPR Owner: Rohit Tidke | © 2026 Intech Research Group
