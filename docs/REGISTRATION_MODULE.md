# IRG_FTR PLATFORM - REGISTRATION MODULE v6.0

## TROT REGISTRATION PROTOCOL COMPLIANT

**IPR Owner:** Rohit Tidke | © 2026 Intech Research Group

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [API Reference](#api-reference)
5. [Data Models](#data-models)
6. [KYC Engine](#kyc-engine)
7. [Risk Scoring](#risk-scoring)
8. [HEP Validators](#hep-validators)
9. [Frontend Components](#frontend-components)
10. [Security](#security)
11. [GDPR Compliance](#gdpr-compliance)

---

## Overview

The Registration Module implements the complete TROT Registration Protocol, providing:

- **Multi-role support** with 10 participant archetypes
- **5-tier global KYC** with 47+ country configurations
- **Composite Risk Scoring (CRS)** with AI + Domain Consultant dual control
- **Human Error Prevention (HEP)** with real-time validation
- **GDPR compliance** for EEA participants
- **Blockchain wallet integration** with social recovery

---

## Features

### ✅ Role & Category System
- 10 participant archetypes (TGDP Minter, Jeweler, Market Maker, etc.)
- 18 approved FTR categories with grouped/searchable list
- Multi-role concurrent support
- "Add new category" workflow with Domain Consultant review

### ✅ Entity Classification
- 11 entity types (Individual to Government Entity)
- Automatic form adaptation based on entity type
- OCR verification for corporate documents
- UBO (Ultimate Beneficial Owner) tracking

### ✅ 5-Tier KYC Engine
| Tier | Name | Monthly Limit | Validity |
|------|------|---------------|----------|
| 0 | Provisional | $5,000 | 1 month |
| 1 | Basic | $50,000 | 12 months |
| 2 | Standard | $500,000 | 12 months |
| 3 | Enhanced | Unlimited | 6 months |
| 4 | Institutional | Unlimited | 6 months |

### ✅ Risk Scoring (CRS)
```
CRS = 0.40 × CreditBureauScore
    + 0.25 × BehaviouralHistoryScore
    + 0.15 × AdverseMediaScore
    + 0.10 × SoW_SoF_IntegrityScore
    + 0.05 × CrossBorderExposureScore
    + 0.05 × PEP_FamilyRiskScore
    + Dynamic Multipliers
```

### ✅ HEP (Human Error Prevention)
- Double-entry verification for critical fields
- Real-time pattern detection (suspicious chars, test values)
- Document number validation (Aadhaar with Verhoeff, PAN, GSTIN, IFSC)
- Email typo detection and suggestions
- Copy-paste anomaly detection

---

## Architecture

```
/backend/src/modules/registration/
├── services/
│   ├── registration.service.ts    # Core registration logic
│   ├── kyc-engine.service.ts      # 5-tier KYC with country configs
│   └── risk-scoring.service.ts    # CRS calculation
├── routes/
│   └── registration.routes.ts     # API endpoints
├── validators/
│   └── hep-validators.ts          # HEP validation
└── index.ts                       # Module exports

/frontend/src/modules/registration/
├── components/
│   └── RegistrationForm.tsx       # Multi-step form component
├── hooks/
│   ├── useRegistration.ts         # Registration state management
│   └── useHepValidation.ts        # Frontend HEP validation
└── index.ts                       # Module exports

/shared/registration/
└── types.ts                       # Shared TypeScript types
```

---

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/registration/initiate` | Start registration session |
| GET | `/api/v1/registration/config/:countryCode` | Get country config |
| GET | `/api/v1/registration/categories` | Get FTR categories |

### Step-Based Endpoints (Require Session)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/registration/step/roles` | Select roles |
| POST | `/api/v1/registration/step/entity-type` | Select entity type |
| POST | `/api/v1/registration/step/individual-profile` | Individual profile |
| POST | `/api/v1/registration/step/corporate-profile` | Corporate profile |
| POST | `/api/v1/registration/step/contact-details` | Contact details |
| POST | `/api/v1/registration/step/bank-account` | Bank account |
| POST | `/api/v1/registration/step/nominees` | Nominees |
| POST | `/api/v1/registration/step/credentials` | Username/password |
| POST | `/api/v1/registration/step/kyc-documents` | KYC documents |
| POST | `/api/v1/registration/step/video-kyc/initiate` | Video KYC |
| POST | `/api/v1/registration/step/terms` | Terms acceptance |
| POST | `/api/v1/registration/finalize` | Complete registration |

### Verification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/registration/verify/mobile` | Verify mobile OTP |
| POST | `/api/v1/registration/verify/email` | Verify email token |
| POST | `/api/v1/registration/verify/resend-otp` | Resend OTP |

### Status Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/registration/status` | Registration status |
| GET | `/api/v1/registration/eligibility` | Eligibility check |
| GET | `/api/v1/registration/risk-score` | Risk score (Tier-3) |

---

## Data Models

### Participant (Master Record)
```typescript
interface Participant {
  id: string;
  registrationId: string;        // Immutable, blockchain-linked
  entityType: EntityType;
  status: RegistrationStatus;
  kycTier: KycTier;
  kycStatus: KycStatus;
  walletAddress?: string;
  walletNamespace?: WalletNamespace;
  compositeRiskScore?: number;   // 0.000 - 1.000
  riskRating?: RiskRating;
  gdprApplicable: boolean;
  gdprConsents?: object;
  // ... additional fields
}
```

### Supporting Models
- `ParticipantRole` - Multi-role support
- `IndividualProfile` - Personal details
- `CorporateProfile` - Business details
- `ContactDetails` - Contact information
- `BankAccount` - Bank linkage
- `Nominee` - Nominee details
- `KycDocument` - Document storage
- `KycVerification` - Verification records
- `SanctionsScreening` - Screening results
- `RiskAssessment` - CRS calculations
- `RenewalSchedule` - Lifecycle management
- `ProfileAmendment` - Change tracking
- `GdprRequest` - Data subject rights
- `WalletRecovery` - Recovery configuration
- `RegistrationAudit` - 7-year audit trail

---

## KYC Engine

### Country Configurations
Pre-configured for 6 major jurisdictions:
- **IN (India)** - PMLA 2002, Aadhaar/PAN
- **US** - BSA/AML, SSN/ITIN
- **GB** - MLR 2017, Passport
- **DE** - GwG/AMLD6, GDPR
- **AE** - SCA Rules, Emirates ID
- **SG** - MAS Guidelines, NRIC

### Sanctions Screening
Integrated with 7 sanctions lists:
- OFAC
- UN Consolidated
- EU Sanctions
- UK Sanctions
- MHA India
- FATF High-Risk
- Local Watchlist

### Video KYC
- AI liveness detection (score ≥ 0.95)
- Face match verification (score ≥ 0.90)
- 60-second SLA
- Automatic escalation for manual review

---

## Risk Scoring

### CRS Components
| Component | Weight | Description |
|-----------|--------|-------------|
| Credit Bureau | 40% | Normalized credit score |
| Behavioural | 25% | Minting/delivery/settlement rates |
| Adverse Media | 15% | Media screening with recency |
| SoW/SoF | 10% | Source of Wealth/Funds verification |
| Cross-Border | 5% | Jurisdiction exposure |
| PEP/Family | 5% | PEP and associate screening |

### Dynamic Multipliers
- **Default Cascade:** ×1.3 if default in last 24 months
- **Delivery Performance:** ×1.1 bonus or ×0.8 penalty
- **Jurisdiction:** ×1.5 for FATF high-risk, ×1.2 for monitoring

### Rating Thresholds
| Rating | Score Range |
|--------|-------------|
| LOW | ≥ 0.80 |
| MEDIUM | 0.65 - 0.79 |
| HIGH | 0.40 - 0.64 |
| UNACCEPTABLE | < 0.40 |

**FTR Provider Minimum:** 0.65

---

## HEP Validators

### Double Entry Fields
- Primary Mobile
- Primary Email
- Account Number
- Password
- Nominee Percentages

### Document Validators
- **Aadhaar:** 12-digit + Verhoeff checksum
- **PAN:** AAAAA0000A format + entity type
- **GSTIN:** 22AAAAA0000A1Z5 format + state code
- **IFSC:** AAAA0XXXXXX format

### Pattern Detection
- Repeated characters (4+ consecutive)
- Sequential numbers
- Test/dummy values
- HTML/script injection
- Copy-paste duplicates

### Email/Phone Validation
- Disposable email detection
- Typo suggestions (gmail.co → gmail.com)
- Country code detection
- Format suggestions

---

## Frontend Components

### RegistrationForm
Multi-step registration form with:
- Dynamic step visibility based on entity type
- Real-time HEP validation
- Warning confirmation dialogs
- Suggestion acceptance
- Progress indicator

### useRegistration Hook
```typescript
const {
  sessionToken,
  participantId,
  submitStep,
  finalizeRegistration,
  verifyMobileOtp,
  uploadDocument,
  getEligibility,
  getRiskScore,
} = useRegistration();
```

### useHepValidation Hook
```typescript
const {
  validate,
  validateField,
  hepErrors,
  hepWarnings,
  hepSuggestions,
  confirmWarning,
} = useHepValidation();
```

---

## Security

### Authentication
- Session token for registration flow
- JWT for authenticated endpoints
- 2FA support
- Biometric hash storage (encrypted)

### Data Protection
- Field-level encryption for sensitive data
- Audit trail with 7-year retention
- Blockchain immutability for critical events

### Rate Limiting
- Registration initiation: 5/hour
- OTP resend: 3/10 minutes
- Document upload: 10/minute

---

## GDPR Compliance

### Applicable Countries
All 30 EEA countries (27 EU + Iceland, Liechtenstein, Norway)

### Consent Requirements
| Consent Type | Lawful Basis | Mandatory |
|--------------|--------------|-----------|
| Identity Verification | Contract | Yes |
| Sanctions Screening | Legal Obligation | Yes |
| Transaction Monitoring | Legal Obligation | Yes |
| Data Sharing | Legitimate Interest | No |
| Cross-Border Transfers | Contract | Yes |
| Marketing | Consent | No |

### Data Subject Rights
- ACCESS (72-hour SLA)
- RECTIFICATION (30-day SLA)
- ERASURE (30-day SLA)
- RESTRICT_PROCESSING
- PORTABILITY
- OBJECT
- WITHDRAW_CONSENT

### Retention
- 7 years post-deregistration (FATF requirement)
- Automatic anonymization after retention period

---

## Changelog

### v6.0 (Current)
- Full TROT Registration Protocol implementation
- 5-tier global KYC engine
- Composite Risk Scoring (CRS)
- HEP validators
- GDPR compliance layer
- Multi-step frontend form
- React hooks for state management

### v5.0 (Previous)
- Basic registration with single role
- Single-tier KYC
- No risk scoring
- Limited validation

---

**End of Documentation**
