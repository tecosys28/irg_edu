# IRG_FTR Platform - Registration Module API Reference

## TROT Registration Protocol v6.0

> **IPR Owner:** Rohit Tidke | © 2026 Intech Research Group

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limits](#rate-limits)
4. [Error Codes](#error-codes)
5. [API Endpoints](#api-endpoints)
   - [Session Management](#session-management)
   - [Registration Steps](#registration-steps)
   - [Verification](#verification)
   - [KYC](#kyc)
   - [Wallet](#wallet)
   - [Status & Eligibility](#status--eligibility)
6. [Data Models](#data-models)
7. [Security](#security)

---

## Overview

The Registration Module implements the TROT Registration Protocol, providing:

- **Multi-role registration** with 10 participant archetypes
- **5-tier global KYC** supporting 47+ jurisdictions
- **Composite Risk Scoring (CRS)** for fraud prevention
- **Human Error Prevention (HEP)** with double-entry verification
- **GDPR compliance** for EEA participants
- **Blockchain wallet generation** with social recovery

### Base URL

```
https://api.irg-ftr.com/api/v1/registration
```

### Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-04-13T10:30:00Z"
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

---

## Authentication

### Session-Based Authentication

Registration uses session-based authentication. All requests (except `/initiate`) must include:

| Header | Description |
|--------|-------------|
| `X-Registration-Session` | Session token from `/initiate` |
| `X-CSRF-Token` | CSRF token (for POST/PUT/DELETE) |

### Headers Example

```http
POST /api/v1/registration/step/roles
Content-Type: application/json
X-Registration-Session: sess_abc123-def456
X-CSRF-Token: csrf_xyz789
```

---

## Rate Limits

| Action | Window | Max Requests | Block Duration |
|--------|--------|--------------|----------------|
| `registration:initiate` | 1 hour | 10 | 24 hours |
| `registration:step` | 1 minute | 30 | 15 minutes |
| `registration:otp` | 1 hour | 5 | 1 hour |
| `registration:upload` | 1 hour | 20 | 1 hour |
| `registration:video_kyc` | 24 hours | 3 | 24 hours |
| `global:ip` | 1 minute | 100 | 5 minutes |

Response headers:
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp (ISO 8601)

---

## Error Codes

### Authentication Errors (401)

| Code | Description |
|------|-------------|
| `SESSION_REQUIRED` | Missing session token |
| `SESSION_INVALID` | Invalid or expired session |
| `SESSION_EXPIRED` | Session timeout |

### Authorization Errors (403)

| Code | Description |
|------|-------------|
| `CSRF_MISSING` | Missing CSRF token |
| `CSRF_INVALID` | Invalid CSRF token |
| `GEO_RESTRICTED` | Service unavailable in region |
| `FRAUD_DETECTED` | Request blocked for fraud |

### Rate Limit Errors (429)

| Code | Description |
|------|-------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `RATE_LIMIT_BLOCKED` | Temporarily blocked |

### Validation Errors (400)

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `HEP_VIOLATION` | Human error prevention triggered |
| `DOUBLE_ENTRY_MISMATCH` | Verification fields don't match |

---

## API Endpoints

### Session Management

#### POST /initiate

Start a new registration session.

**Request:**
```json
{
  "source": "web",
  "referralCode": "REF123",
  "deviceFingerprint": "fp_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant_abc123",
    "registrationId": "TROT-IN-2604-ABC123",
    "sessionToken": "sess_xyz789",
    "csrfToken": "csrf_def456",
    "expiresAt": "2026-04-13T14:30:00Z"
  }
}
```

---

### Registration Steps

#### POST /step/roles

Select participant roles (multi-select allowed).

**Request:**
```json
{
  "roles": ["FTR_BUYER_HOUSEHOLD", "SERVICE_PROVIDER"],
  "ftrCategories": ["HOSP", "FOOD"],
  "earmarkedLimit": 100000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "roles": ["FTR_BUYER_HOUSEHOLD", "SERVICE_PROVIDER"],
    "requiredKycTier": "TIER_1_BASIC",
    "nextStep": "entityType"
  }
}
```

#### POST /step/entity-type

Select entity classification.

**Request:**
```json
{
  "entityType": "INDIVIDUAL"
}
```

**Entity Types:**
- `INDIVIDUAL`
- `PROPRIETORSHIP`
- `PARTNERSHIP`
- `LLP`
- `PRIVATE_COMPANY`
- `LISTED_COMPANY`
- `UNLISTED_PUBLIC_COMPANY`
- `PUBLIC_TRUST`
- `PRIVATE_TRUST`
- `COOPERATIVE`
- `GOVERNMENT_ENTITY`

#### POST /step/individual-profile

Submit individual profile (for INDIVIDUAL entity type).

**Request:**
```json
{
  "salutation": "Mr",
  "firstName": "Rahul",
  "middleName": "Kumar",
  "lastName": "Sharma",
  "dateOfBirth": "1990-05-15",
  "gender": "MALE",
  "maritalStatus": "MARRIED",
  "nationality": "IN",
  "countryOfResidence": "IN",
  "education": "Graduate",
  "occupation": "Software Engineer",
  "annualIncome": "10L-25L",
  "address": {
    "line1": "123 Main Street",
    "line2": "Apt 456",
    "city": "Mumbai",
    "stateProvince": "MH",
    "countryCode": "IN",
    "postalCode": "400001"
  }
}
```

#### POST /step/corporate-profile

Submit corporate profile (for non-INDIVIDUAL entity types).

**Request:**
```json
{
  "legalName": "ABC Technologies Pvt Ltd",
  "tradingName": "ABC Tech",
  "businessType": "PRIVATE_COMPANY",
  "registrationNumber": "U72200MH2020PTC123456",
  "registrationDate": "2020-03-15",
  "registrationAuthority": "ROC Mumbai",
  "registrationValidity": "2030-03-14",
  "taxId": "AAACA1234A",
  "gstNumber": "27AAACA1234A1ZP",
  "registeredAddress": { ... },
  "operatingAddress": { ... },
  "businessPhone": "+919876543210",
  "businessEmail": "contact@abctech.com",
  "authorizedSignatories": [
    {
      "name": "John Doe",
      "designation": "Director",
      "email": "john@abctech.com",
      "phone": "+919876543211",
      "effectiveFrom": "2020-03-15",
      "canTransact": true,
      "transactionLimit": 1000000
    }
  ],
  "beneficialOwners": [
    {
      "name": "Jane Doe",
      "nationality": "IN",
      "ownershipPercentage": 51,
      "controlType": "DIRECT",
      "isPep": false
    }
  ]
}
```

#### POST /step/contact-details

Submit contact information with double-entry verification.

**Request:**
```json
{
  "primaryMobile": "+919876543210",
  "primaryMobile_verify": "+919876543210",
  "alternateMobile": "+919876543211",
  "landline": "+912212345678",
  "primaryEmail": "user@example.com",
  "primaryEmail_verify": "user@example.com",
  "alternateEmail": "user.alt@example.com",
  "socialMediaConsent": true,
  "whatsappNumber": "+919876543210",
  "telegramHandle": "@username",
  "preferredContactMethod": "EMAIL",
  "preferredLanguage": "EN"
}
```

#### POST /step/bank-account

Submit bank account details.

**Request:**
```json
{
  "bankName": "HDFC Bank",
  "bankCode": "HDFC0001234",
  "branchName": "Mumbai Main",
  "accountNumber": "12345678901234",
  "accountNumber_verify": "12345678901234",
  "accountHolderName": "RAHUL KUMAR SHARMA",
  "accountType": "SAVINGS",
  "currency": "INR",
  "isPrimary": true
}
```

**Response includes penny drop verification:**
```json
{
  "success": true,
  "data": {
    "accountId": "acc_123",
    "verificationStatus": "PENDING",
    "pennyDropTransactionId": "PD_ABC123XYZ",
    "verificationExpiresAt": "2026-04-13T11:00:00Z"
  }
}
```

#### POST /step/nominees

Submit nominee details.

**Request:**
```json
{
  "nominees": [
    {
      "name": "Priya Sharma",
      "relation": "SPOUSE",
      "dateOfBirth": "1992-08-20",
      "phone": "+919876543212",
      "email": "priya@example.com",
      "address": "Same as above",
      "percentage": 50,
      "canAssistRecovery": true
    },
    {
      "name": "Amit Sharma",
      "relation": "SIBLING",
      "phone": "+919876543213",
      "percentage": 50,
      "canAssistRecovery": true
    }
  ]
}
```

> **Note:** Total nominee percentage must equal 100%.

#### POST /step/credentials

Set username and password.

**Request:**
```json
{
  "username": "rahul_sharma",
  "usernameAka": "RahulS",
  "password": "SecureP@ssw0rd123",
  "password_verify": "SecureP@ssw0rd123",
  "enableTwoFactor": true
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot contain username or personal info

#### POST /step/terms

Accept terms and conditions.

**Request:**
```json
{
  "termsAccepted": true,
  "termsVersion": "2.1.0",
  "gdprConsents": {
    "dataProcessing": true,
    "crossBorderTransfer": true,
    "marketing": false,
    "analytics": true,
    "thirdPartySharing": false,
    "profiling": true
  },
  "roleSpecificTerms": {
    "SERVICE_PROVIDER": {
      "accepted": true,
      "version": "1.0.0"
    }
  }
}
```

#### POST /finalize

Complete registration and create wallet.

**Request:**
```json
{
  "walletPassword": "WalletP@ss123",
  "walletPassword_verify": "WalletP@ss123",
  "seedPhraseHint": "childhood pet name",
  "socialRecoveryNominees": ["nominee_1", "nominee_2", "nominee_3"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant_abc123",
    "registrationId": "TROT-IN-2604-ABC123",
    "walletAddress": "ftr_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    "kycStatus": "APPROVED",
    "kycTier": "TIER_1_BASIC",
    "activatedAt": "2026-04-13T10:45:00Z",
    "seedPhrase": ["word1", "word2", ... , "word12"],
    "seedPhraseWarning": "IMPORTANT: Store this seed phrase securely. It cannot be recovered."
  }
}
```

---

### Verification

#### POST /verify/mobile

Verify mobile OTP.

**Request:**
```json
{
  "otpId": "otp_abc123",
  "otp": "123456"
}
```

#### POST /verify/email

Verify email (via link or OTP).

**Request:**
```json
{
  "token": "email_verification_token"
}
```

#### POST /verify/resend-otp

Resend OTP.

**Request:**
```json
{
  "channel": "SMS",
  "destination": "+919876543210"
}
```

**Channels:** `SMS`, `EMAIL`, `WHATSAPP`, `VOICE`

---

### KYC

#### POST /step/kyc-documents

Upload KYC documents.

**Request (multipart/form-data):**
```
documentType: AADHAAR
documentNumber: 1234-5678-9012
documentFront: [file]
documentBack: [file]
```

**Document Types:**
- India: `AADHAAR`, `PAN`, `VOTER_ID`, `DRIVING_LICENSE`, `PASSPORT`
- US: `SSN_ITIN`, `PASSPORT`, `DRIVING_LICENSE`
- UK: `PASSPORT`, `NATIONAL_ID`, `DRIVING_LICENSE`
- UAE: `EMIRATES_ID`, `PASSPORT`
- Singapore: `NRIC`, `PASSPORT`

**Response includes OCR extraction:**
```json
{
  "success": true,
  "data": {
    "documentId": "doc_123",
    "status": "VERIFIED",
    "ocrExtracted": {
      "name": "RAHUL KUMAR SHARMA",
      "dob": "1990-05-15",
      "address": "123 Main Street, Mumbai"
    },
    "ocrConfidence": 0.95,
    "verificationScore": 0.98
  }
}
```

#### POST /step/video-kyc/initiate

Start video KYC session.

**Request:**
```json
{
  "countryCode": "IN",
  "preferredLanguage": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "VKYC_ABC123XYZ456",
    "sessionUrl": "https://vkyc.irg-ftr.com/session/VKYC_ABC123XYZ456",
    "expiresAt": "2026-04-13T11:00:00Z",
    "instructions": [
      "Ensure good lighting",
      "Have your ID document ready",
      "Allow camera and microphone access"
    ]
  }
}
```

---

### Wallet

#### POST /wallet/export

Export wallet for hardware device.

**Request:**
```json
{
  "targetDevice": "LEDGER",
  "password": "WalletP@ss123"
}
```

#### POST /wallet/recovery/initiate

Initiate social recovery.

**Request:**
```json
{
  "newPublicKey": "public_key_hex"
}
```

---

### Status & Eligibility

#### GET /status

Get registration status.

**Response:**
```json
{
  "success": true,
  "data": {
    "participantId": "participant_abc123",
    "registrationId": "TROT-IN-2604-ABC123",
    "status": "ACTIVE",
    "currentStep": "completed",
    "completedSteps": ["roles", "entityType", "profile", "contact", "bank", "nominees", "credentials", "kyc", "terms"],
    "kycStatus": "APPROVED",
    "kycTier": "TIER_1_BASIC",
    "eligibilityStatus": "ELIGIBLE"
  }
}
```

#### GET /eligibility

Check eligibility for activation.

**Response:**
```json
{
  "success": true,
  "data": {
    "isEligible": true,
    "checks": {
      "kycComplete": true,
      "minimumRiskScore": true,
      "bankVerified": true,
      "termsAccepted": true,
      "notBlacklisted": true,
      "noActiveDisputes": true
    },
    "riskScore": 0.82,
    "riskRating": "LOW"
  }
}
```

#### GET /risk-score

Get Composite Risk Score (Tier-3 only).

**Response:**
```json
{
  "success": true,
  "data": {
    "compositeRiskScore": 0.82,
    "riskRating": "LOW",
    "components": {
      "creditBureauScore": 0.85,
      "behaviouralHistoryScore": 0.78,
      "adverseMediaScore": 0.95,
      "sowSofIntegrityScore": 0.80,
      "crossBorderExposureScore": 0.70,
      "pepFamilyRiskScore": 1.00
    },
    "multipliers": {
      "defaultCascade": 1.0,
      "deliveryPerformance": 1.1,
      "jurisdictionRisk": 1.0
    },
    "lastAssessedAt": "2026-04-13T10:30:00Z",
    "nextAssessmentAt": "2026-04-14T10:30:00Z"
  }
}
```

---

## Data Models

### Participant Archetypes

| Archetype | Description | Required KYC |
|-----------|-------------|--------------|
| `TGDP_MINTER` | Mints gold-backed FTRs from household gold | Tier 2 |
| `TGDP_JEWELER` | Registered jeweler in TGDP program | Tier 3 |
| `MARKET_MAKER` | Provides liquidity in FTR markets | Tier 3 |
| `FTR_BUYER_HOUSEHOLD` | Personal FTR purchases | Tier 1 |
| `FTR_BUYER_OTHER` | Corporate FTR purchases | Tier 2 |
| `SERVICE_PROVIDER` | Offers services redeemable via FTRs | Tier 2 |
| `DAC_PARTICIPANT` | Decentralized commerce participant | Tier 1 |
| `CONSULTANT` | Domain consultant | Tier 2 |
| `BANK_TRUSTEE` | Bank trustee for Corpus Fund | Tier 4 |
| `INVESTOR` | FTR ecosystem investor | Tier 3 |

### KYC Tiers

| Tier | Name | Monthly Limit | Documents Required |
|------|------|---------------|-------------------|
| 0 | Provisional | $5,000 | Basic ID |
| 1 | Basic | $50,000 | Government ID + Selfie |
| 2 | Standard | $500,000 | Above + Address Proof + Video KYC |
| 3 | Enhanced | Unlimited | Above + Financial Docs + Background Check |
| 4 | Institutional | Unlimited | Full due diligence + Board resolution |

### Risk Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Credit Bureau | 40% | Normalized credit score |
| Behavioural | 25% | Historical platform behaviour |
| Adverse Media | 15% | News/media screening |
| SoW/SoF | 10% | Source of wealth/funds verification |
| Cross-Border | 5% | International exposure risk |
| PEP/Family | 5% | Political exposure |

---

## Security

### Headers Required

```http
X-Registration-Session: <session_token>
X-CSRF-Token: <csrf_token>
X-Device-Fingerprint: <fingerprint> (optional but recommended)
```

### Bot Protection

- Honeypot fields detection
- Request timing validation (minimum form completion time)
- Device fingerprinting
- Behavioural analysis

### Geo-Blocking

Services blocked in sanctioned countries:
- North Korea (KP)
- Iran (IR)
- Syria (SY)
- Cuba (CU)

### Fraud Detection Triggers

- High-risk country registration
- VPN/Proxy/Tor detection
- Rapid form submission
- Multiple concurrent sessions
- IP address changes mid-session

---

## Changelog

### v6.0.0 (2026-04-13)

- Added security middleware (rate limiting, CSRF, fraud detection)
- Added verification service (OTP, penny drop, video KYC, biometric)
- Added wallet service (BIP-39, social recovery, hardware wallet)
- Enhanced HEP validators
- GDPR compliance layer
- 47+ jurisdiction support

### v5.0.0 (2026-04-01)

- Initial TROT Registration Protocol implementation
- 5-tier KYC engine
- Composite Risk Scoring
- Multi-role registration

---

**IPR Owner:** Rohit Tidke | © 2026 Intech Research Group
