/**
 * IRG_FTR PLATFORM - Registration Form Component
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Multi-step registration with HEP protection, real-time validation,
 * and dynamic form adaptation based on roles/entity types
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRegistration } from '../hooks/useRegistration';
import { useHepValidation } from '../hooks/useHepValidation';
import type {
  ParticipantArchetype,
  EntityType,
  RegistrationPayload,
  KycDocumentType,
} from '@ftr-platform/shared/registration/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface RegistrationFormProps {
  onComplete?: (result: { participantId: string; walletAddress: string }) => void;
  onError?: (error: Error) => void;
  referralCode?: string;
  source?: string;
}

interface StepConfig {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  isConditional: boolean;
  condition?: (data: Partial<RegistrationPayload>) => boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PARTICIPANT_ARCHETYPES: { value: ParticipantArchetype; label: string; description: string }[] = [
  { value: 'TGDP_MINTER', label: 'TGDP Minter (Household)', description: 'Mint gold-backed FTRs from household gold' },
  { value: 'TGDP_JEWELER', label: 'TGDP Jeweler', description: 'Registered jeweler participating in TGDP' },
  { value: 'MARKET_MAKER', label: 'Market Maker', description: 'Provide liquidity in FTR markets' },
  { value: 'FTR_BUYER_HOUSEHOLD', label: 'FTR Buyer (Household)', description: 'Purchase FTRs for personal use' },
  { value: 'FTR_BUYER_OTHER', label: 'FTR Buyer (Corporate)', description: 'Purchase FTRs for business purposes' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider', description: 'Offer services redeemable via FTRs' },
  { value: 'DAC_PARTICIPANT', label: 'DAC Participant', description: 'Participate in Decentralized Commerce' },
  { value: 'CONSULTANT', label: 'Domain Consultant', description: 'Provide expert consultation services' },
  { value: 'INVESTOR', label: 'Investor', description: 'Invest in FTR ecosystem' },
];

const ENTITY_TYPES: { value: EntityType; label: string; requiresCorporateProfile: boolean }[] = [
  { value: 'INDIVIDUAL', label: 'Individual', requiresCorporateProfile: false },
  { value: 'PROPRIETORSHIP', label: 'Proprietorship', requiresCorporateProfile: true },
  { value: 'PARTNERSHIP', label: 'Partnership', requiresCorporateProfile: true },
  { value: 'LLP', label: 'LLP (Limited Liability Partnership)', requiresCorporateProfile: true },
  { value: 'PRIVATE_COMPANY', label: 'Private Company', requiresCorporateProfile: true },
  { value: 'LISTED_COMPANY', label: 'Listed Company', requiresCorporateProfile: true },
  { value: 'UNLISTED_PUBLIC_COMPANY', label: 'Unlisted Public Company', requiresCorporateProfile: true },
  { value: 'PUBLIC_TRUST', label: 'Public Trust', requiresCorporateProfile: true },
  { value: 'PRIVATE_TRUST', label: 'Private Trust', requiresCorporateProfile: true },
  { value: 'COOPERATIVE', label: 'Cooperative Society', requiresCorporateProfile: true },
];

const FTR_CATEGORIES = [
  { code: 'HOSP', name: 'Hospitality' },
  { code: 'HEALTH', name: 'Healthcare' },
  { code: 'EDU', name: 'Education' },
  { code: 'TRANSPORT', name: 'Transportation' },
  { code: 'REALTY', name: 'Real Estate' },
  { code: 'RETAIL', name: 'Retail' },
  { code: 'FOOD', name: 'Food & Beverage' },
  { code: 'ENERGY', name: 'Energy' },
  { code: 'TECH', name: 'Technology' },
  { code: 'FINANCE', name: 'Financial Services' },
  { code: 'TELECOM', name: 'Telecommunications' },
  { code: 'AGRI', name: 'Agriculture' },
  { code: 'TEXTILE', name: 'Textiles' },
  { code: 'PHARMA', name: 'Pharmaceuticals' },
  { code: 'AUTO', name: 'Automotive' },
  { code: 'ENTERTAINMENT', name: 'Entertainment' },
  { code: 'PROFESSIONAL', name: 'Professional Services' },
  { code: 'OTHER', name: 'Other Services' },
];

const STEPS: StepConfig[] = [
  { id: 'roles', title: 'Select Roles', description: 'Choose your participation roles', isRequired: true, isConditional: false },
  { id: 'entityType', title: 'Entity Type', description: 'Select your entity classification', isRequired: true, isConditional: false },
  { id: 'profile', title: 'Profile Details', description: 'Enter your profile information', isRequired: true, isConditional: false },
  { id: 'contact', title: 'Contact Details', description: 'Provide contact information', isRequired: true, isConditional: false },
  { id: 'bankAccount', title: 'Bank Account', description: 'Link your bank account', isRequired: true, isConditional: false },
  { id: 'nominees', title: 'Nominees', description: 'Add nominee details', isRequired: true, isConditional: false },
  { id: 'credentials', title: 'Credentials', description: 'Set username and password', isRequired: true, isConditional: false },
  { id: 'kycDocuments', title: 'KYC Documents', description: 'Upload verification documents', isRequired: true, isConditional: false },
  { id: 'terms', title: 'Terms & Conditions', description: 'Review and accept terms', isRequired: true, isConditional: false },
  { id: 'review', title: 'Review & Submit', description: 'Review your application', isRequired: true, isConditional: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  onComplete,
  onError,
  referralCode,
  source,
}) => {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<RegistrationPayload>>({});
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [stepWarnings, setStepWarnings] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedWarnings, setConfirmedWarnings] = useState<Set<string>>(new Set());

  // Hooks
  const { 
    sessionToken, 
    participantId, 
    initiateSession, 
    submitStep, 
    finalizeRegistration,
    isLoading,
    error: apiError,
  } = useRegistration();

  const { validate, validateField, hepErrors, hepWarnings, hepSuggestions } = useHepValidation();

  // Initialize session on mount
  useEffect(() => {
    initiateSession(source, referralCode);
  }, []);

  // Determine if corporate profile is needed
  const requiresCorporateProfile = useMemo(() => {
    if (!formData.entityType) return false;
    const entityConfig = ENTITY_TYPES.find(e => e.value === formData.entityType);
    return entityConfig?.requiresCorporateProfile ?? false;
  }, [formData.entityType]);

  // Get visible steps based on entity type
  const visibleSteps = useMemo(() => {
    return STEPS.filter(step => {
      if (step.isConditional && step.condition) {
        return step.condition(formData);
      }
      return true;
    });
  }, [formData]);

  // Handle field change with HEP validation
  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev };
      const keys = field.split('.');
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return updated;
    });

    // Real-time HEP validation
    validateField(field, value);
  }, [validateField]);

  // Handle step submission
  const handleNextStep = useCallback(async () => {
    const step = visibleSteps[currentStep];
    setIsSubmitting(true);
    setStepErrors({});

    try {
      // Run full validation for current step
      const validationResult = validate(formData, step.id);
      
      if (!validationResult.isValid) {
        setStepErrors(
          validationResult.errors.reduce((acc, err) => ({ ...acc, [err.field]: err.message }), {})
        );
        setIsSubmitting(false);
        return;
      }

      // Check for unconfirmed warnings
      const unconfirmedWarnings = validationResult.warnings.filter(
        w => w.confirmationRequired && !confirmedWarnings.has(w.code)
      );

      if (unconfirmedWarnings.length > 0) {
        setStepWarnings(
          unconfirmedWarnings.reduce((acc, w) => ({ ...acc, [w.field]: w.message }), {})
        );
        setIsSubmitting(false);
        return;
      }

      // Submit step to API
      const result = await submitStep(step.id, formData);
      
      if (result.success) {
        if (currentStep < visibleSteps.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          // Final step - complete registration
          const finalResult = await finalizeRegistration();
          if (finalResult.success && onComplete) {
            onComplete({
              participantId: finalResult.data.participantId,
              walletAddress: finalResult.data.walletAddress,
            });
          }
        }
      } else {
        setStepErrors(result.errors || { general: result.error?.message || 'An error occurred' });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setStepErrors({ general: error.message });
      onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, visibleSteps, formData, validate, submitStep, finalizeRegistration, confirmedWarnings, onComplete, onError]);

  // Handle warning confirmation
  const handleConfirmWarning = useCallback((warningCode: string) => {
    setConfirmedWarnings(prev => new Set([...prev, warningCode]));
    setStepWarnings(prev => {
      const updated = { ...prev };
      delete updated[warningCode];
      return updated;
    });
  }, []);

  // Handle previous step
  const handlePrevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setStepErrors({});
      setStepWarnings({});
    }
  }, [currentStep]);

  // Render step content
  const renderStepContent = () => {
    const step = visibleSteps[currentStep];

    switch (step.id) {
      case 'roles':
        return <RoleSelectionStep formData={formData} onChange={handleFieldChange} />;
      case 'entityType':
        return <EntityTypeStep formData={formData} onChange={handleFieldChange} />;
      case 'profile':
        return requiresCorporateProfile 
          ? <CorporateProfileStep formData={formData} onChange={handleFieldChange} />
          : <IndividualProfileStep formData={formData} onChange={handleFieldChange} />;
      case 'contact':
        return <ContactDetailsStep formData={formData} onChange={handleFieldChange} />;
      case 'bankAccount':
        return <BankAccountStep formData={formData} onChange={handleFieldChange} />;
      case 'nominees':
        return <NomineesStep formData={formData} onChange={handleFieldChange} />;
      case 'credentials':
        return <CredentialsStep formData={formData} onChange={handleFieldChange} />;
      case 'kycDocuments':
        return <KycDocumentsStep formData={formData} onChange={handleFieldChange} />;
      case 'terms':
        return <TermsStep formData={formData} onChange={handleFieldChange} />;
      case 'review':
        return <ReviewStep formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <div className="registration-form">
      {/* Progress indicator */}
      <div className="registration-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentStep + 1) / visibleSteps.length) * 100}%` }} 
          />
        </div>
        <div className="step-indicators">
          {visibleSteps.map((step, index) => (
            <div 
              key={step.id}
              className={`step-indicator ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            >
              <span className="step-number">{index + 1}</span>
              <span className="step-title">{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step header */}
      <div className="step-header">
        <h2>{visibleSteps[currentStep].title}</h2>
        <p>{visibleSteps[currentStep].description}</p>
      </div>

      {/* Error display */}
      {Object.keys(stepErrors).length > 0 && (
        <div className="error-banner">
          <h4>Please fix the following errors:</h4>
          <ul>
            {Object.entries(stepErrors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warning display with confirmation */}
      {Object.keys(stepWarnings).length > 0 && (
        <div className="warning-banner">
          <h4>Please confirm the following:</h4>
          {Object.entries(stepWarnings).map(([code, message]) => (
            <div key={code} className="warning-item">
              <p>{message}</p>
              <button onClick={() => handleConfirmWarning(code)}>
                I confirm this is correct
              </button>
            </div>
          ))}
        </div>
      )}

      {/* HEP Suggestions */}
      {hepSuggestions.length > 0 && (
        <div className="suggestions-banner">
          {hepSuggestions.map((suggestion, index) => (
            <div key={index} className="suggestion-item">
              <span>{suggestion.message}</span>
              {suggestion.suggestedValue && (
                <button onClick={() => handleFieldChange(suggestion.field, suggestion.suggestedValue)}>
                  Use: {suggestion.suggestedValue}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step content */}
      <div className="step-content">
        {renderStepContent()}
      </div>

      {/* Navigation buttons */}
      <div className="step-navigation">
        <button 
          onClick={handlePrevStep} 
          disabled={currentStep === 0 || isSubmitting}
          className="btn-secondary"
        >
          Previous
        </button>
        <button 
          onClick={handleNextStep} 
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? 'Processing...' : currentStep === visibleSteps.length - 1 ? 'Submit Registration' : 'Next'}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STEP COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface StepProps {
  formData: Partial<RegistrationPayload>;
  onChange: (field: string, value: any) => void;
}

const RoleSelectionStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const selectedRoles = formData.roleSelection?.selectedRoles || [];

  const handleRoleToggle = (role: ParticipantArchetype) => {
    const updated = selectedRoles.includes(role)
      ? selectedRoles.filter(r => r !== role)
      : [...selectedRoles, role];
    onChange('roleSelection.selectedRoles', updated);
  };

  const needsCategories = selectedRoles.some(r => 
    ['SERVICE_PROVIDER', 'TGDP_JEWELER'].includes(r)
  );

  const needsEarmarkedLimit = selectedRoles.includes('MARKET_MAKER');

  return (
    <div className="role-selection-step">
      <h3>Select Your Roles</h3>
      <p className="helper-text">You can select multiple roles. Different roles have different requirements.</p>
      
      <div className="role-grid">
        {PARTICIPANT_ARCHETYPES.map(archetype => (
          <div 
            key={archetype.value}
            className={`role-card ${selectedRoles.includes(archetype.value) ? 'selected' : ''}`}
            onClick={() => handleRoleToggle(archetype.value)}
          >
            <div className="role-checkbox">
              <input 
                type="checkbox" 
                checked={selectedRoles.includes(archetype.value)}
                onChange={() => handleRoleToggle(archetype.value)}
              />
            </div>
            <div className="role-info">
              <h4>{archetype.label}</h4>
              <p>{archetype.description}</p>
            </div>
          </div>
        ))}
      </div>

      {needsCategories && (
        <div className="category-selection">
          <h4>Select FTR Categories</h4>
          <p className="helper-text">Choose the categories of goods/services you will provide</p>
          <div className="category-grid">
            {FTR_CATEGORIES.map(cat => (
              <label key={cat.code} className="category-item">
                <input
                  type="checkbox"
                  checked={formData.roleSelection?.ftrCategories?.includes(cat.code) || false}
                  onChange={(e) => {
                    const current = formData.roleSelection?.ftrCategories || [];
                    const updated = e.target.checked
                      ? [...current, cat.code]
                      : current.filter(c => c !== cat.code);
                    onChange('roleSelection.ftrCategories', updated);
                  }}
                />
                <span>{cat.name}</span>
              </label>
            ))}
          </div>
          <button className="btn-link">
            + Request New Category
          </button>
        </div>
      )}

      {needsEarmarkedLimit && (
        <div className="earmarked-limit">
          <label>Earmarked Limit (USD)</label>
          <input
            type="number"
            value={formData.roleSelection?.earmarkedLimit || ''}
            onChange={(e) => onChange('roleSelection.earmarkedLimit', parseFloat(e.target.value))}
            placeholder="Enter maximum earmarked amount"
            min="0"
          />
          <p className="helper-text">Maximum amount you can hold in earmarked position</p>
        </div>
      )}
    </div>
  );
};

const EntityTypeStep: React.FC<StepProps> = ({ formData, onChange }) => {
  return (
    <div className="entity-type-step">
      <h3>Select Entity Type</h3>
      <p className="helper-text">Choose the legal structure that best describes you</p>
      
      <div className="entity-grid">
        {ENTITY_TYPES.map(entity => (
          <div 
            key={entity.value}
            className={`entity-card ${formData.entityType === entity.value ? 'selected' : ''}`}
            onClick={() => onChange('entityType', entity.value)}
          >
            <input 
              type="radio" 
              name="entityType"
              checked={formData.entityType === entity.value}
              onChange={() => onChange('entityType', entity.value)}
            />
            <span>{entity.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const IndividualProfileStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const profile = formData.individualProfile || {};

  return (
    <div className="individual-profile-step">
      <h3>Personal Information</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label>Salutation</label>
          <select
            value={profile.salutation || ''}
            onChange={(e) => onChange('individualProfile.salutation', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="Mr">Mr.</option>
            <option value="Ms">Ms.</option>
            <option value="Mrs">Mrs.</option>
            <option value="Dr">Dr.</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>First Name *</label>
          <input
            type="text"
            value={profile.firstName || ''}
            onChange={(e) => onChange('individualProfile.firstName', e.target.value)}
            placeholder="Enter first name"
            required
          />
        </div>
        <div className="form-group">
          <label>Middle Name</label>
          <input
            type="text"
            value={profile.middleName || ''}
            onChange={(e) => onChange('individualProfile.middleName', e.target.value)}
            placeholder="Enter middle name (if any)"
          />
        </div>
        <div className="form-group">
          <label>Last Name *</label>
          <input
            type="text"
            value={profile.lastName || ''}
            onChange={(e) => onChange('individualProfile.lastName', e.target.value)}
            placeholder="Enter last name"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Date of Birth *</label>
          <input
            type="date"
            value={profile.dateOfBirth || ''}
            onChange={(e) => onChange('individualProfile.dateOfBirth', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Gender</label>
          <select
            value={profile.gender || ''}
            onChange={(e) => onChange('individualProfile.gender', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
        </div>
        <div className="form-group">
          <label>Marital Status</label>
          <select
            value={profile.maritalStatus || ''}
            onChange={(e) => onChange('individualProfile.maritalStatus', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="SINGLE">Single</option>
            <option value="MARRIED">Married</option>
            <option value="DIVORCED">Divorced</option>
            <option value="WIDOWED">Widowed</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Nationality *</label>
          <input
            type="text"
            value={profile.nationality || ''}
            onChange={(e) => onChange('individualProfile.nationality', e.target.value.toUpperCase())}
            placeholder="Country code (e.g., IN)"
            maxLength={2}
            required
          />
        </div>
        <div className="form-group">
          <label>Country of Residence *</label>
          <input
            type="text"
            value={profile.countryOfResidence || ''}
            onChange={(e) => onChange('individualProfile.countryOfResidence', e.target.value.toUpperCase())}
            placeholder="Country code (e.g., IN)"
            maxLength={2}
            required
          />
        </div>
      </div>

      <h4>Address</h4>
      <div className="form-row">
        <div className="form-group full-width">
          <label>Address Line 1 *</label>
          <input
            type="text"
            value={profile.address?.line1 || ''}
            onChange={(e) => onChange('individualProfile.address.line1', e.target.value)}
            placeholder="House/Flat No., Building Name, Street"
            required
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group full-width">
          <label>Address Line 2</label>
          <input
            type="text"
            value={profile.address?.line2 || ''}
            onChange={(e) => onChange('individualProfile.address.line2', e.target.value)}
            placeholder="Area, Landmark (optional)"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>City *</label>
          <input
            type="text"
            value={profile.address?.city || ''}
            onChange={(e) => onChange('individualProfile.address.city', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>State/Province *</label>
          <input
            type="text"
            value={profile.address?.stateProvince || ''}
            onChange={(e) => onChange('individualProfile.address.stateProvince', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Postal Code *</label>
          <input
            type="text"
            value={profile.address?.postalCode || ''}
            onChange={(e) => onChange('individualProfile.address.postalCode', e.target.value)}
            required
          />
        </div>
      </div>
    </div>
  );
};

const CorporateProfileStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const profile = formData.corporateProfile || {};

  return (
    <div className="corporate-profile-step">
      <h3>Business Information</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label>Legal Name *</label>
          <input
            type="text"
            value={profile.legalName || ''}
            onChange={(e) => onChange('corporateProfile.legalName', e.target.value)}
            placeholder="As registered with authority"
            required
          />
        </div>
        <div className="form-group">
          <label>Trading Name</label>
          <input
            type="text"
            value={profile.tradingName || ''}
            onChange={(e) => onChange('corporateProfile.tradingName', e.target.value)}
            placeholder="Brand/DBA name (if different)"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Registration Number *</label>
          <input
            type="text"
            value={profile.registrationNumber || ''}
            onChange={(e) => onChange('corporateProfile.registrationNumber', e.target.value)}
            placeholder="CIN/LLP ID/Registration No."
            required
          />
        </div>
        <div className="form-group">
          <label>Registration Date *</label>
          <input
            type="date"
            value={profile.registrationDate || ''}
            onChange={(e) => onChange('corporateProfile.registrationDate', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Registration Authority *</label>
          <input
            type="text"
            value={profile.registrationAuthority || ''}
            onChange={(e) => onChange('corporateProfile.registrationAuthority', e.target.value)}
            placeholder="e.g., MCA, ROC Delhi"
            required
          />
        </div>
        <div className="form-group">
          <label>GSTIN</label>
          <input
            type="text"
            value={profile.gstNumber || ''}
            onChange={(e) => onChange('corporateProfile.gstNumber', e.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Business Phone *</label>
          <input
            type="tel"
            value={profile.businessPhone || ''}
            onChange={(e) => onChange('corporateProfile.businessPhone', e.target.value)}
            placeholder="+91 XXXXX XXXXX"
            required
          />
        </div>
        <div className="form-group">
          <label>Business Email *</label>
          <input
            type="email"
            value={profile.businessEmail || ''}
            onChange={(e) => onChange('corporateProfile.businessEmail', e.target.value)}
            placeholder="contact@company.com"
            required
          />
        </div>
      </div>

      {/* Registered Address section would go here - similar to IndividualProfileStep */}
      
      <div className="info-box">
        <p>You will be asked to add Authorized Signatories and Beneficial Owners after completing basic information.</p>
      </div>
    </div>
  );
};

const ContactDetailsStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const contacts = formData.contactDetails || {};

  return (
    <div className="contact-details-step">
      <h3>Contact Information</h3>
      
      <div className="form-section">
        <h4>Primary Mobile Number *</h4>
        <p className="helper-text">Enter your primary mobile number twice for verification</p>
        <div className="form-row">
          <div className="form-group">
            <label>Mobile Number</label>
            <input
              type="tel"
              value={contacts.primaryMobile || ''}
              onChange={(e) => onChange('contactDetails.primaryMobile', e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Mobile Number</label>
            <input
              type="tel"
              value={(contacts as any).primaryMobile_verify || ''}
              onChange={(e) => onChange('contactDetails.primaryMobile_verify', e.target.value)}
              placeholder="Re-enter mobile number"
              required
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4>Primary Email Address *</h4>
        <p className="helper-text">Enter your primary email address twice for verification</p>
        <div className="form-row">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={contacts.primaryEmail || ''}
              onChange={(e) => onChange('contactDetails.primaryEmail', e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Email Address</label>
            <input
              type="email"
              value={(contacts as any).primaryEmail_verify || ''}
              onChange={(e) => onChange('contactDetails.primaryEmail_verify', e.target.value)}
              placeholder="Re-enter email address"
              required
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4>Additional Contact (Optional)</h4>
        <div className="form-row">
          <div className="form-group">
            <label>Alternate Mobile</label>
            <input
              type="tel"
              value={contacts.alternateMobile || ''}
              onChange={(e) => onChange('contactDetails.alternateMobile', e.target.value)}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>
          <div className="form-group">
            <label>Landline</label>
            <input
              type="tel"
              value={contacts.landline || ''}
              onChange={(e) => onChange('contactDetails.landline', e.target.value)}
              placeholder="City code + Number"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4>Social Media (Optional)</h4>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={contacts.socialMediaConsent || false}
            onChange={(e) => onChange('contactDetails.socialMediaConsent', e.target.checked)}
          />
          <span>I consent to share my social media information</span>
        </label>
        {contacts.socialMediaConsent && (
          <div className="form-row">
            <div className="form-group">
              <label>WhatsApp Number</label>
              <input
                type="tel"
                value={contacts.whatsappNumber || ''}
                onChange={(e) => onChange('contactDetails.whatsappNumber', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Telegram Handle</label>
              <input
                type="text"
                value={contacts.telegramHandle || ''}
                onChange={(e) => onChange('contactDetails.telegramHandle', e.target.value)}
                placeholder="@username"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BankAccountStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const accounts = formData.bankAccounts || [];
  const account = accounts[0] || {};

  return (
    <div className="bank-account-step">
      <h3>Bank Account Details</h3>
      <p className="helper-text">Link your primary bank account for transactions</p>
      
      <div className="form-row">
        <div className="form-group">
          <label>Bank Name *</label>
          <input
            type="text"
            value={account.bankName || ''}
            onChange={(e) => onChange('bankAccounts.0.bankName', e.target.value)}
            placeholder="e.g., State Bank of India"
            required
          />
        </div>
        <div className="form-group">
          <label>IFSC Code *</label>
          <input
            type="text"
            value={account.bankCode || ''}
            onChange={(e) => onChange('bankAccounts.0.bankCode', e.target.value.toUpperCase())}
            placeholder="e.g., SBIN0001234"
            maxLength={11}
            required
          />
        </div>
      </div>

      <div className="form-section">
        <h4>Account Number *</h4>
        <p className="helper-text">Enter your account number twice for verification</p>
        <div className="form-row">
          <div className="form-group">
            <label>Account Number</label>
            <input
              type="text"
              value={account.accountNumber || ''}
              onChange={(e) => onChange('bankAccounts.0.accountNumber', e.target.value)}
              placeholder="Enter account number"
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Account Number</label>
            <input
              type="text"
              value={account.accountNumber_verify || ''}
              onChange={(e) => onChange('bankAccounts.0.accountNumber_verify', e.target.value)}
              placeholder="Re-enter account number"
              required
            />
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Account Holder Name *</label>
          <input
            type="text"
            value={account.accountHolderName || ''}
            onChange={(e) => onChange('bankAccounts.0.accountHolderName', e.target.value)}
            placeholder="As per bank records"
            required
          />
        </div>
        <div className="form-group">
          <label>Account Type *</label>
          <select
            value={account.accountType || ''}
            onChange={(e) => onChange('bankAccounts.0.accountType', e.target.value)}
            required
          >
            <option value="">Select...</option>
            <option value="SAVINGS">Savings</option>
            <option value="CURRENT">Current</option>
            <option value="CORPORATE">Corporate</option>
          </select>
        </div>
      </div>

      <div className="info-box">
        <p>A small verification amount will be deposited to verify your account. This typically takes 1-2 business days.</p>
      </div>
    </div>
  );
};

const NomineesStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const nominees = formData.nominees || [];

  const addNominee = () => {
    onChange('nominees', [...nominees, {
      name: '',
      relation: '',
      phone: '',
      percentage: 0,
      percentage_verify: 0,
      canAssistRecovery: false,
    }]);
  };

  const removeNominee = (index: number) => {
    onChange('nominees', nominees.filter((_, i) => i !== index));
  };

  const totalPercentage = nominees.reduce((sum, n) => sum + (n.percentage || 0), 0);

  return (
    <div className="nominees-step">
      <h3>Nominee Details</h3>
      <p className="helper-text">Add nominees who will inherit your assets. Total percentage must equal 100%.</p>
      
      {nominees.map((nominee, index) => (
        <div key={index} className="nominee-card">
          <div className="nominee-header">
            <h4>Nominee {index + 1}</h4>
            {nominees.length > 1 && (
              <button onClick={() => removeNominee(index)} className="btn-danger-text">
                Remove
              </button>
            )}
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={nominee.name || ''}
                onChange={(e) => onChange(`nominees.${index}.name`, e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Relation *</label>
              <select
                value={nominee.relation || ''}
                onChange={(e) => onChange(`nominees.${index}.relation`, e.target.value)}
                required
              >
                <option value="">Select...</option>
                <option value="Spouse">Spouse</option>
                <option value="Child">Child</option>
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone *</label>
              <input
                type="tel"
                value={nominee.phone || ''}
                onChange={(e) => onChange(`nominees.${index}.phone`, e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={nominee.email || ''}
                onChange={(e) => onChange(`nominees.${index}.email`, e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Percentage *</label>
              <input
                type="number"
                value={nominee.percentage || ''}
                onChange={(e) => onChange(`nominees.${index}.percentage`, parseFloat(e.target.value))}
                min="0"
                max="100"
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Percentage *</label>
              <input
                type="number"
                value={nominee.percentage_verify || ''}
                onChange={(e) => onChange(`nominees.${index}.percentage_verify`, parseFloat(e.target.value))}
                min="0"
                max="100"
                required
              />
            </div>
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={nominee.canAssistRecovery || false}
              onChange={(e) => onChange(`nominees.${index}.canAssistRecovery`, e.target.checked)}
            />
            <span>This nominee can assist with wallet recovery</span>
          </label>
        </div>
      ))}

      <div className="percentage-summary">
        <strong>Total Percentage: {totalPercentage}%</strong>
        {totalPercentage !== 100 && (
          <span className="warning"> (Must equal 100%)</span>
        )}
      </div>

      <button onClick={addNominee} className="btn-secondary">
        + Add Another Nominee
      </button>
    </div>
  );
};

const CredentialsStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="credentials-step">
      <h3>Set Your Credentials</h3>
      
      <div className="form-section">
        <h4>Username</h4>
        <div className="form-group">
          <label>Choose a Username *</label>
          <input
            type="text"
            value={(formData as any).username || ''}
            onChange={(e) => onChange('username', e.target.value.toLowerCase())}
            placeholder="Choose a unique username"
            pattern="[a-z0-9_]+"
            minLength={4}
            required
          />
          <p className="helper-text">Only lowercase letters, numbers, and underscores. Minimum 4 characters.</p>
        </div>
        <div className="form-group">
          <label>Display Name (AKA)</label>
          <input
            type="text"
            value={(formData as any).usernameAka || ''}
            onChange={(e) => onChange('usernameAka', e.target.value)}
            placeholder="Optional display name"
          />
        </div>
      </div>

      <div className="form-section">
        <h4>Password</h4>
        <p className="helper-text">Create a strong password and enter it twice for verification</p>
        <div className="form-row">
          <div className="form-group">
            <label>Password *</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={(formData as any).password || ''}
                onChange={(e) => onChange('password', e.target.value)}
                placeholder="Enter password"
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="toggle-password"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={(formData as any).password_verify || ''}
              onChange={(e) => onChange('password_verify', e.target.value)}
              placeholder="Re-enter password"
              required
            />
          </div>
        </div>
        <div className="password-requirements">
          <p>Password must contain:</p>
          <ul>
            <li>At least 8 characters</li>
            <li>At least one uppercase letter</li>
            <li>At least one lowercase letter</li>
            <li>At least one number</li>
            <li>At least one special character (!@#$%^&*)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const KycDocumentsStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const documents = formData.kycDocuments || [];

  return (
    <div className="kyc-documents-step">
      <h3>KYC Document Upload</h3>
      <p className="helper-text">Upload the required documents for verification</p>
      
      <div className="document-upload-section">
        <h4>Identity Proof (Aadhaar)</h4>
        <div className="form-group">
          <label>Aadhaar Number *</label>
          <input
            type="text"
            value={documents[0]?.documentNumber || ''}
            onChange={(e) => onChange('kycDocuments.0.documentNumber', e.target.value)}
            placeholder="XXXX XXXX XXXX"
            maxLength={14}
            required
          />
        </div>
        <div className="form-group">
          <label>Confirm Aadhaar Number *</label>
          <input
            type="text"
            value={documents[0]?.documentNumber_verify || ''}
            onChange={(e) => onChange('kycDocuments.0.documentNumber_verify', e.target.value)}
            placeholder="Re-enter Aadhaar number"
            maxLength={14}
            required
          />
        </div>
        <div className="file-upload">
          <label>Upload Aadhaar Front</label>
          <input type="file" accept="image/*,.pdf" />
        </div>
        <div className="file-upload">
          <label>Upload Aadhaar Back</label>
          <input type="file" accept="image/*,.pdf" />
        </div>
      </div>

      <div className="document-upload-section">
        <h4>PAN Card</h4>
        <div className="form-group">
          <label>PAN Number *</label>
          <input
            type="text"
            value={documents[1]?.documentNumber || ''}
            onChange={(e) => onChange('kycDocuments.1.documentNumber', e.target.value.toUpperCase())}
            placeholder="AAAAA0000A"
            maxLength={10}
            required
          />
        </div>
        <div className="file-upload">
          <label>Upload PAN Card</label>
          <input type="file" accept="image/*,.pdf" />
        </div>
      </div>
    </div>
  );
};

const TermsStep: React.FC<StepProps> = ({ formData, onChange }) => {
  const terms = formData.termsAcceptance || {};

  return (
    <div className="terms-step">
      <h3>Terms & Conditions</h3>
      
      <div className="terms-section">
        <h4>General Terms and Conditions</h4>
        <div className="terms-content">
          <p>Please read and accept the following terms...</p>
          {/* Terms content would go here */}
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={terms.generalTermsAccepted || false}
            onChange={(e) => {
              onChange('termsAcceptance.generalTermsAccepted', e.target.checked);
              onChange('termsAcceptance.generalTermsVersion', 'v2.1');
            }}
          />
          <span>I have read and accept the General Terms and Conditions</span>
        </label>
      </div>

      <div className="terms-section">
        <h4>Privacy Policy & Data Processing</h4>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={terms.gdprConsents?.identityVerification || false}
            onChange={(e) => onChange('termsAcceptance.gdprConsents.identityVerification', e.target.checked)}
          />
          <span>I consent to identity verification processing</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={terms.gdprConsents?.sanctionsScreening || false}
            onChange={(e) => onChange('termsAcceptance.gdprConsents.sanctionsScreening', e.target.checked)}
          />
          <span>I consent to sanctions screening (required by law)</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={terms.gdprConsents?.transactionMonitoring || false}
            onChange={(e) => onChange('termsAcceptance.gdprConsents.transactionMonitoring', e.target.checked)}
          />
          <span>I consent to transaction monitoring (required by law)</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={terms.gdprConsents?.crossBorderTransfers || false}
            onChange={(e) => onChange('termsAcceptance.gdprConsents.crossBorderTransfers', e.target.checked)}
          />
          <span>I consent to cross-border data transfers under Standard Contractual Clauses</span>
        </label>
      </div>
    </div>
  );
};

const ReviewStep: React.FC<{ formData: Partial<RegistrationPayload> }> = ({ formData }) => {
  return (
    <div className="review-step">
      <h3>Review Your Application</h3>
      <p className="helper-text">Please review all information before submitting</p>
      
      <div className="review-section">
        <h4>Selected Roles</h4>
        <ul>
          {formData.roleSelection?.selectedRoles?.map(role => (
            <li key={role}>{role.replace(/_/g, ' ')}</li>
          ))}
        </ul>
      </div>

      <div className="review-section">
        <h4>Entity Type</h4>
        <p>{formData.entityType?.replace(/_/g, ' ')}</p>
      </div>

      <div className="review-section">
        <h4>Profile</h4>
        {formData.individualProfile && (
          <p>
            {formData.individualProfile.firstName} {formData.individualProfile.lastName}
            <br />
            DOB: {formData.individualProfile.dateOfBirth}
          </p>
        )}
      </div>

      <div className="review-section">
        <h4>Contact</h4>
        <p>
          Mobile: {formData.contactDetails?.primaryMobile}
          <br />
          Email: {formData.contactDetails?.primaryEmail}
        </p>
      </div>

      <div className="info-box">
        <p>
          By clicking "Submit Registration", you confirm that all information provided is accurate 
          and you agree to the terms and conditions.
        </p>
      </div>
    </div>
  );
};

export default RegistrationForm;
