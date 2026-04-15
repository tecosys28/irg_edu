/**
 * IRG_FTR PLATFORM - useHepValidation Hook
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Frontend HEP (Human Error Prevention) validation with real-time feedback
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { useState, useCallback, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface HepError {
  field: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'CRITICAL';
}

export interface HepWarning {
  field: string;
  code: string;
  message: string;
  confirmationRequired?: boolean;
}

export interface HepSuggestion {
  field: string;
  code: string;
  message: string;
  suggestedValue?: string;
}

export interface HepValidationResult {
  isValid: boolean;
  errors: HepError[];
  warnings: HepWarning[];
  suggestions: HepSuggestion[];
}

interface UseHepValidationReturn {
  // Validation methods
  validate: (formData: Record<string, any>, stepId: string) => HepValidationResult;
  validateField: (field: string, value: any) => HepValidationResult;
  
  // Results
  hepErrors: HepError[];
  hepWarnings: HepWarning[];
  hepSuggestions: HepSuggestion[];
  
  // Field-specific
  getFieldErrors: (field: string) => HepError[];
  getFieldWarnings: (field: string) => HepWarning[];
  getFieldSuggestions: (field: string) => HepSuggestion[];
  
  // State management
  clearErrors: () => void;
  confirmWarning: (warningCode: string) => void;
  confirmedWarnings: Set<string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const VALIDATORS = {
  /**
   * Validate Aadhaar number (India)
   */
  aadhaar: (value: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.replace(/\s/g, '');
    
    if (!/^\d{12}$/.test(cleaned)) {
      errors.push({
        field: 'aadhaar',
        code: 'HEP_INVALID_FORMAT',
        message: 'Aadhaar must be exactly 12 digits',
        severity: 'ERROR',
      });
    }
    
    if (/^[01]/.test(cleaned)) {
      errors.push({
        field: 'aadhaar',
        code: 'HEP_INVALID_AADHAAR',
        message: 'Aadhaar cannot start with 0 or 1',
        severity: 'ERROR',
      });
    }
    
    // Verhoeff checksum
    if (errors.length === 0 && !verifyVerhoeff(cleaned)) {
      errors.push({
        field: 'aadhaar',
        code: 'HEP_CHECKSUM_FAILED',
        message: 'Invalid Aadhaar number (checksum failed)',
        severity: 'CRITICAL',
      });
    }
    
    // Formatting suggestion
    if (cleaned.length === 12 && !value.includes(' ')) {
      suggestions.push({
        field: 'aadhaar',
        code: 'HEP_FORMAT_SUGGESTION',
        message: 'Format as: XXXX XXXX XXXX',
        suggestedValue: `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`,
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Validate PAN number (India)
   */
  pan: (value: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toUpperCase().replace(/\s/g, '');
    
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleaned)) {
      errors.push({
        field: 'pan',
        code: 'HEP_INVALID_FORMAT',
        message: 'PAN must be in format: AAAAA0000A',
        severity: 'ERROR',
      });
    }
    
    // Fourth character entity type check
    if (cleaned.length >= 4) {
      const entityChar = cleaned[3];
      const validChars = 'ABCFGHLJPT';
      if (!validChars.includes(entityChar)) {
        errors.push({
          field: 'pan',
          code: 'HEP_INVALID_ENTITY_CODE',
          message: `Invalid entity code '${entityChar}'`,
          severity: 'ERROR',
        });
      }
    }
    
    if (value !== cleaned && errors.length === 0) {
      suggestions.push({
        field: 'pan',
        code: 'HEP_UPPERCASE',
        message: 'PAN should be uppercase',
        suggestedValue: cleaned,
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Validate GSTIN
   */
  gstin: (value: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toUpperCase().replace(/\s/g, '');
    
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(cleaned)) {
      errors.push({
        field: 'gstin',
        code: 'HEP_INVALID_FORMAT',
        message: 'Invalid GSTIN format',
        severity: 'ERROR',
      });
    }
    
    // State code validation
    if (cleaned.length >= 2) {
      const stateCode = parseInt(cleaned.substring(0, 2));
      if (stateCode < 1 || stateCode > 38) {
        errors.push({
          field: 'gstin',
          code: 'HEP_INVALID_STATE',
          message: 'Invalid state code in GSTIN',
          severity: 'ERROR',
        });
      }
    }
    
    // Extract PAN
    if (cleaned.length >= 12) {
      suggestions.push({
        field: 'pan',
        code: 'HEP_PAN_EXTRACTED',
        message: `PAN from GSTIN: ${cleaned.substring(2, 12)}`,
        suggestedValue: cleaned.substring(2, 12),
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Validate IFSC code
   */
  ifsc: (value: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toUpperCase().replace(/\s/g, '');
    
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned)) {
      errors.push({
        field: 'ifsc',
        code: 'HEP_INVALID_FORMAT',
        message: 'IFSC must be 11 characters: 4 letters, 0, 6 alphanumeric',
        severity: 'ERROR',
      });
    }
    
    if (cleaned.length >= 5 && cleaned[4] !== '0') {
      errors.push({
        field: 'ifsc',
        code: 'HEP_INVALID_IFSC',
        message: 'Fifth character must be 0',
        severity: 'ERROR',
      });
    }
    
    // Bank identification
    const bankCodes: Record<string, string> = {
      'SBIN': 'State Bank of India',
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'UTIB': 'Axis Bank',
      'KKBK': 'Kotak Mahindra Bank',
    };
    
    if (cleaned.length >= 4 && bankCodes[cleaned.substring(0, 4)]) {
      suggestions.push({
        field: 'ifsc',
        code: 'HEP_BANK_IDENTIFIED',
        message: `Bank: ${bankCodes[cleaned.substring(0, 4)]}`,
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Validate email
   */
  email: (value: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toLowerCase().trim();
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      errors.push({
        field: 'email',
        code: 'HEP_INVALID_FORMAT',
        message: 'Invalid email format',
        severity: 'ERROR',
      });
      return { isValid: false, errors, warnings, suggestions };
    }
    
    const domain = cleaned.split('@')[1];
    
    // Disposable email detection
    const disposable = ['tempmail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com'];
    if (disposable.includes(domain)) {
      errors.push({
        field: 'email',
        code: 'HEP_DISPOSABLE',
        message: 'Disposable email addresses are not allowed',
        severity: 'CRITICAL',
      });
    }
    
    // Common typo suggestions
    const typos: Record<string, string> = {
      'gmial.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'gmail.co': 'gmail.com',
      'yaho.com': 'yahoo.com',
      'hotmal.com': 'hotmail.com',
    };
    
    if (typos[domain]) {
      warnings.push({
        field: 'email',
        code: 'HEP_TYPO_DETECTED',
        message: `Did you mean @${typos[domain]}?`,
        confirmationRequired: true,
      });
      suggestions.push({
        field: 'email',
        code: 'HEP_DOMAIN_CORRECTION',
        message: `Suggested: ${cleaned.split('@')[0]}@${typos[domain]}`,
        suggestedValue: `${cleaned.split('@')[0]}@${typos[domain]}`,
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Validate phone number
   */
  phone: (value: string, countryCode?: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.replace(/[\s\-\(\)]/g, '');
    
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      errors.push({
        field: 'phone',
        code: 'HEP_INVALID_FORMAT',
        message: 'Phone must be 10-15 digits',
        severity: 'ERROR',
      });
    }
    
    // India phone check
    if (countryCode === 'IN' && cleaned.length === 10 && !/^[6-9]/.test(cleaned)) {
      errors.push({
        field: 'phone',
        code: 'HEP_INVALID_PHONE',
        message: 'Indian mobile numbers must start with 6-9',
        severity: 'ERROR',
      });
    }
    
    // Add country code suggestion
    if (!cleaned.startsWith('+') && cleaned.length === 10 && countryCode === 'IN') {
      suggestions.push({
        field: 'phone',
        code: 'HEP_ADD_COUNTRY_CODE',
        message: 'Add country code',
        suggestedValue: `+91${cleaned}`,
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Validate date of birth
   */
  dateOfBirth: (value: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const date = new Date(value);
    const now = new Date();
    
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'dateOfBirth',
        code: 'HEP_INVALID_DATE',
        message: 'Invalid date format',
        severity: 'ERROR',
      });
      return { isValid: false, errors, warnings, suggestions };
    }
    
    if (date > now) {
      errors.push({
        field: 'dateOfBirth',
        code: 'HEP_FUTURE_DATE',
        message: 'Date cannot be in the future',
        severity: 'CRITICAL',
      });
    }
    
    // Age calculation
    let age = now.getFullYear() - date.getFullYear();
    const monthDiff = now.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
      age--;
    }
    
    if (age < 18) {
      errors.push({
        field: 'dateOfBirth',
        code: 'HEP_UNDERAGE',
        message: 'Must be at least 18 years old',
        severity: 'CRITICAL',
      });
    }
    
    if (age > 120) {
      errors.push({
        field: 'dateOfBirth',
        code: 'HEP_INVALID_AGE',
        message: 'Please verify date of birth',
        severity: 'ERROR',
      });
    }
    
    if (age >= 80 && age <= 120) {
      warnings.push({
        field: 'dateOfBirth',
        code: 'HEP_SENIOR_AGE',
        message: `Age: ${age}. Please verify.`,
        confirmationRequired: true,
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Validate password strength
   */
  password: (value: string): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    if (value.length < 8) {
      errors.push({
        field: 'password',
        code: 'HEP_TOO_SHORT',
        message: 'Password must be at least 8 characters',
        severity: 'ERROR',
      });
    }
    
    if (!/[A-Z]/.test(value)) {
      errors.push({
        field: 'password',
        code: 'HEP_NO_UPPERCASE',
        message: 'Must contain an uppercase letter',
        severity: 'ERROR',
      });
    }
    
    if (!/[a-z]/.test(value)) {
      errors.push({
        field: 'password',
        code: 'HEP_NO_LOWERCASE',
        message: 'Must contain a lowercase letter',
        severity: 'ERROR',
      });
    }
    
    if (!/[0-9]/.test(value)) {
      errors.push({
        field: 'password',
        code: 'HEP_NO_NUMBER',
        message: 'Must contain a number',
        severity: 'ERROR',
      });
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
      errors.push({
        field: 'password',
        code: 'HEP_NO_SPECIAL',
        message: 'Must contain a special character',
        severity: 'ERROR',
      });
    }
    
    // Common password check
    const common = ['password', '12345678', 'qwerty', 'letmein'];
    if (common.includes(value.toLowerCase())) {
      errors.push({
        field: 'password',
        code: 'HEP_COMMON_PASSWORD',
        message: 'Password is too common',
        severity: 'CRITICAL',
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
  
  /**
   * Double entry verification
   */
  doubleEntry: (value1: any, value2: any, field: string): HepValidationResult => {
    const errors: HepError[] = [];
    
    if (value1 !== value2) {
      errors.push({
        field: `${field}_verify`,
        code: 'HEP_MISMATCH',
        message: 'Values do not match',
        severity: 'CRITICAL',
      });
    }
    
    return { isValid: errors.length === 0, errors, warnings: [], suggestions: [] };
  },
  
  /**
   * Nominee percentages
   */
  nomineePercentages: (percentages: number[]): HepValidationResult => {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const total = percentages.reduce((sum, p) => sum + (p || 0), 0);
    
    if (Math.abs(total - 100) > 0.01) {
      errors.push({
        field: 'nomineePercentages',
        code: 'HEP_INVALID_TOTAL',
        message: `Total must be 100%. Current: ${total.toFixed(2)}%`,
        severity: 'CRITICAL',
      });
    }
    
    percentages.forEach((p, i) => {
      if (p > 0 && p < 1) {
        warnings.push({
          field: `nominee[${i}].percentage`,
          code: 'HEP_SMALL_PERCENTAGE',
          message: `Very small percentage (${p}%)`,
          confirmationRequired: true,
        });
      }
    });
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  },
};

/**
 * Verhoeff checksum algorithm
 */
function verifyVerhoeff(num: string): boolean {
  const d = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  ];
  
  const p = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
  ];
  
  let c = 0;
  const arr = num.split('').reverse().map(Number);
  
  for (let i = 0; i < arr.length; i++) {
    c = d[c][p[i % 8][arr[i]]];
  }
  
  return c === 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function useHepValidation(): UseHepValidationReturn {
  const [hepErrors, setHepErrors] = useState<HepError[]>([]);
  const [hepWarnings, setHepWarnings] = useState<HepWarning[]>([]);
  const [hepSuggestions, setHepSuggestions] = useState<HepSuggestion[]>([]);
  const [confirmedWarnings, setConfirmedWarnings] = useState<Set<string>>(new Set());

  /**
   * Validate a single field
   */
  const validateField = useCallback((field: string, value: any): HepValidationResult => {
    let result: HepValidationResult = { isValid: true, errors: [], warnings: [], suggestions: [] };
    
    // Determine validator based on field name
    const fieldLower = field.toLowerCase();
    
    if (fieldLower.includes('aadhaar')) {
      result = VALIDATORS.aadhaar(value);
    } else if (fieldLower.includes('pan') && !fieldLower.includes('expand')) {
      result = VALIDATORS.pan(value);
    } else if (fieldLower.includes('gstin') || fieldLower.includes('gst')) {
      result = VALIDATORS.gstin(value);
    } else if (fieldLower.includes('ifsc')) {
      result = VALIDATORS.ifsc(value);
    } else if (fieldLower.includes('email')) {
      result = VALIDATORS.email(value);
    } else if (fieldLower.includes('phone') || fieldLower.includes('mobile')) {
      result = VALIDATORS.phone(value);
    } else if (fieldLower.includes('dateofbirth') || fieldLower.includes('dob')) {
      result = VALIDATORS.dateOfBirth(value);
    } else if (fieldLower.includes('password') && !fieldLower.includes('verify')) {
      result = VALIDATORS.password(value);
    }
    
    // Update state with field-specific results
    setHepErrors(prev => {
      const filtered = prev.filter(e => e.field !== field);
      return [...filtered, ...result.errors];
    });
    
    setHepWarnings(prev => {
      const filtered = prev.filter(w => w.field !== field);
      return [...filtered, ...result.warnings];
    });
    
    setHepSuggestions(prev => {
      const filtered = prev.filter(s => s.field !== field);
      return [...filtered, ...result.suggestions];
    });
    
    return result;
  }, []);

  /**
   * Validate full form for a step
   */
  const validate = useCallback((formData: Record<string, any>, stepId: string): HepValidationResult => {
    const allErrors: HepError[] = [];
    const allWarnings: HepWarning[] = [];
    const allSuggestions: HepSuggestion[] = [];
    
    // Double entry verifications
    const doubleEntryFields = [
      { v1: 'primaryMobile', v2: 'primaryMobile_verify' },
      { v1: 'primaryEmail', v2: 'primaryEmail_verify' },
      { v1: 'accountNumber', v2: 'accountNumber_verify' },
      { v1: 'password', v2: 'password_verify' },
    ];
    
    for (const { v1, v2 } of doubleEntryFields) {
      const val1 = getNestedValue(formData, v1);
      const val2 = getNestedValue(formData, v2);
      
      if (val1 || val2) {
        const result = VALIDATORS.doubleEntry(val1, val2, v1);
        allErrors.push(...result.errors);
      }
    }
    
    // Field-specific validations based on step
    switch (stepId) {
      case 'contact':
        if (formData.contactDetails?.primaryEmail) {
          const result = VALIDATORS.email(formData.contactDetails.primaryEmail);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
          allSuggestions.push(...result.suggestions);
        }
        if (formData.contactDetails?.primaryMobile) {
          const result = VALIDATORS.phone(formData.contactDetails.primaryMobile);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
          allSuggestions.push(...result.suggestions);
        }
        break;
        
      case 'profile':
        if (formData.individualProfile?.dateOfBirth) {
          const result = VALIDATORS.dateOfBirth(formData.individualProfile.dateOfBirth);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
        }
        break;
        
      case 'bankAccount':
        if (formData.bankAccounts?.[0]?.bankCode) {
          const result = VALIDATORS.ifsc(formData.bankAccounts[0].bankCode);
          allErrors.push(...result.errors);
          allSuggestions.push(...result.suggestions);
        }
        break;
        
      case 'nominees':
        if (formData.nominees?.length) {
          const percentages = formData.nominees.map((n: any) => n.percentage || 0);
          const result = VALIDATORS.nomineePercentages(percentages);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
        }
        break;
        
      case 'credentials':
        if (formData.password) {
          const result = VALIDATORS.password(formData.password);
          allErrors.push(...result.errors);
        }
        break;
        
      case 'kycDocuments':
        // Validate document numbers
        formData.kycDocuments?.forEach((doc: any, index: number) => {
          if (doc.documentType === 'AADHAAR' && doc.documentNumber) {
            const result = VALIDATORS.aadhaar(doc.documentNumber);
            result.errors.forEach(e => e.field = `kycDocuments[${index}].documentNumber`);
            allErrors.push(...result.errors);
          }
          if (doc.documentType === 'PAN' && doc.documentNumber) {
            const result = VALIDATORS.pan(doc.documentNumber);
            result.errors.forEach(e => e.field = `kycDocuments[${index}].documentNumber`);
            allErrors.push(...result.errors);
          }
        });
        break;
    }
    
    // Update state
    setHepErrors(allErrors);
    setHepWarnings(allWarnings);
    setHepSuggestions(allSuggestions);
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      suggestions: allSuggestions,
    };
  }, []);

  /**
   * Get errors for a specific field
   */
  const getFieldErrors = useCallback((field: string): HepError[] => {
    return hepErrors.filter(e => e.field === field || e.field.startsWith(`${field}.`));
  }, [hepErrors]);

  /**
   * Get warnings for a specific field
   */
  const getFieldWarnings = useCallback((field: string): HepWarning[] => {
    return hepWarnings.filter(w => w.field === field || w.field.startsWith(`${field}.`));
  }, [hepWarnings]);

  /**
   * Get suggestions for a specific field
   */
  const getFieldSuggestions = useCallback((field: string): HepSuggestion[] => {
    return hepSuggestions.filter(s => s.field === field || s.field.startsWith(`${field}.`));
  }, [hepSuggestions]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setHepErrors([]);
    setHepWarnings([]);
    setHepSuggestions([]);
  }, []);

  /**
   * Confirm a warning
   */
  const confirmWarning = useCallback((warningCode: string) => {
    setConfirmedWarnings(prev => new Set([...prev, warningCode]));
    setHepWarnings(prev => prev.filter(w => w.code !== warningCode));
  }, []);

  return {
    validate,
    validateField,
    hepErrors,
    hepWarnings,
    hepSuggestions,
    getFieldErrors,
    getFieldWarnings,
    getFieldSuggestions,
    clearErrors,
    confirmWarning,
    confirmedWarnings,
  };
}

/**
 * Helper to get nested value from object
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export default useHepValidation;
