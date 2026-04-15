/**
 * IRG_FTR PLATFORM - HEP (Human Error Prevention) Validators
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Comprehensive validation with double-entry verification, pattern detection,
 * and real-time error prevention
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface HepValidationResult {
  isValid: boolean;
  errors: HepError[];
  warnings: HepWarning[];
  suggestions: HepSuggestion[];
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// HEP VALIDATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class HepValidator {
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DOUBLE ENTRY VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Verify two values match (case-sensitive)
   */
  static verifyDoubleEntry(
    field: string,
    value1: string | number | undefined,
    value2: string | number | undefined,
    options?: {
      caseSensitive?: boolean;
      trimWhitespace?: boolean;
      allowEmpty?: boolean;
    }
  ): HepError | null {
    
    const { caseSensitive = true, trimWhitespace = true, allowEmpty = false } = options || {};
    
    if (!allowEmpty && (value1 === undefined || value1 === '' || value2 === undefined || value2 === '')) {
      return {
        field: `${field}_verify`,
        code: 'HEP_DOUBLE_ENTRY_REQUIRED',
        message: `Please enter ${field} twice for verification`,
        severity: 'ERROR',
      };
    }
    
    let v1 = String(value1);
    let v2 = String(value2);
    
    if (trimWhitespace) {
      v1 = v1.trim();
      v2 = v2.trim();
    }
    
    if (!caseSensitive) {
      v1 = v1.toLowerCase();
      v2 = v2.toLowerCase();
    }
    
    if (v1 !== v2) {
      return {
        field: `${field}_verify`,
        code: 'HEP_DOUBLE_ENTRY_MISMATCH',
        message: `${field} values do not match. Please verify both entries.`,
        severity: 'CRITICAL',
      };
    }
    
    return null;
  }
  
  /**
   * Verify numeric values match within tolerance
   */
  static verifyNumericDoubleEntry(
    field: string,
    value1: number | undefined,
    value2: number | undefined,
    tolerance: number = 0.001
  ): HepError | null {
    
    if (value1 === undefined || value2 === undefined) {
      return {
        field: `${field}_verify`,
        code: 'HEP_DOUBLE_ENTRY_REQUIRED',
        message: `Please enter ${field} twice for verification`,
        severity: 'ERROR',
      };
    }
    
    if (Math.abs(value1 - value2) > tolerance) {
      return {
        field: `${field}_verify`,
        code: 'HEP_DOUBLE_ENTRY_MISMATCH',
        message: `${field} values do not match. First: ${value1}, Second: ${value2}`,
        severity: 'CRITICAL',
      };
    }
    
    return null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PATTERN DETECTION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Detect suspicious patterns in text
   */
  static detectSuspiciousPatterns(
    field: string,
    value: string
  ): HepWarning[] {
    
    const warnings: HepWarning[] = [];
    
    // Repeated characters (e.g., "aaaa" or "1111")
    if (/(.)\1{3,}/.test(value)) {
      warnings.push({
        field,
        code: 'HEP_REPEATED_CHARS',
        message: `${field} contains repeated characters. Please verify this is correct.`,
        confirmationRequired: true,
      });
    }
    
    // Sequential numbers (e.g., "12345" or "98765")
    if (/(?:0(?=1)|1(?=2)|2(?=3)|3(?=4)|4(?=5)|5(?=6)|6(?=7)|7(?=8)|8(?=9)){4}/.test(value) ||
        /(?:9(?=8)|8(?=7)|7(?=6)|6(?=5)|5(?=4)|4(?=3)|3(?=2)|2(?=1)|1(?=0)){4}/.test(value)) {
      warnings.push({
        field,
        code: 'HEP_SEQUENTIAL_NUMBERS',
        message: `${field} contains sequential numbers. Please verify this is correct.`,
        confirmationRequired: true,
      });
    }
    
    // Common test values
    const testPatterns = ['test', 'sample', 'demo', 'dummy', 'fake', 'xxx', 'abc', '123'];
    const lowerValue = value.toLowerCase();
    for (const pattern of testPatterns) {
      if (lowerValue.includes(pattern)) {
        warnings.push({
          field,
          code: 'HEP_TEST_VALUE_DETECTED',
          message: `${field} appears to contain a test/sample value. Please use actual data.`,
          confirmationRequired: true,
        });
        break;
      }
    }
    
    // HTML/Script injection attempt
    if (/<[^>]*>|javascript:|on\w+=/i.test(value)) {
      warnings.push({
        field,
        code: 'HEP_SUSPICIOUS_CONTENT',
        message: `${field} contains potentially harmful content that has been sanitized.`,
      });
    }
    
    return warnings;
  }
  
  /**
   * Detect copy-paste patterns
   */
  static detectCopyPasteAnomalies(
    fields: Record<string, string>
  ): HepWarning[] {
    
    const warnings: HepWarning[] = [];
    const values = Object.entries(fields);
    
    // Check for identical values in different fields
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const [field1, value1] = values[i];
        const [field2, value2] = values[j];
        
        if (value1 && value2 && value1 === value2 && value1.length > 5) {
          warnings.push({
            field: field1,
            code: 'HEP_DUPLICATE_VALUES',
            message: `${field1} and ${field2} have identical values. Please verify this is intentional.`,
            confirmationRequired: true,
          });
        }
      }
    }
    
    return warnings;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DOCUMENT NUMBER VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Validate Aadhaar number with Verhoeff checksum
   */
  static validateAadhaar(value: string): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    // Remove spaces
    const cleaned = value.replace(/\s/g, '');
    
    // Must be 12 digits
    if (!/^\d{12}$/.test(cleaned)) {
      errors.push({
        field: 'aadhaar',
        code: 'HEP_INVALID_FORMAT',
        message: 'Aadhaar must be exactly 12 digits',
        severity: 'ERROR',
      });
    }
    
    // Cannot start with 0 or 1
    if (/^[01]/.test(cleaned)) {
      errors.push({
        field: 'aadhaar',
        code: 'HEP_INVALID_AADHAAR',
        message: 'Aadhaar number cannot start with 0 or 1',
        severity: 'ERROR',
      });
    }
    
    // Verhoeff checksum validation
    if (errors.length === 0 && !this.verifyVerhoeffChecksum(cleaned)) {
      errors.push({
        field: 'aadhaar',
        code: 'HEP_CHECKSUM_FAILED',
        message: 'Invalid Aadhaar number (checksum verification failed)',
        severity: 'CRITICAL',
      });
    }
    
    // Check for common mistakes
    warnings.push(...this.detectSuspiciousPatterns('aadhaar', cleaned));
    
    // Suggest formatting
    if (value.length === 12 && !value.includes(' ')) {
      suggestions.push({
        field: 'aadhaar',
        code: 'HEP_FORMAT_SUGGESTION',
        message: 'Consider entering Aadhaar as: XXXX XXXX XXXX',
        suggestedValue: `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`,
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Validate PAN number
   */
  static validatePAN(value: string): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toUpperCase().replace(/\s/g, '');
    
    // Format: AAAAA0000A
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleaned)) {
      errors.push({
        field: 'pan',
        code: 'HEP_INVALID_FORMAT',
        message: 'PAN must be in format: AAAAA0000A (5 letters, 4 digits, 1 letter)',
        severity: 'ERROR',
      });
    }
    
    // Fourth character indicates entity type
    if (cleaned.length >= 4) {
      const entityChar = cleaned[3];
      const validEntityChars = 'ABCFGHLJPT';
      if (!validEntityChars.includes(entityChar)) {
        errors.push({
          field: 'pan',
          code: 'HEP_INVALID_ENTITY_CODE',
          message: `Invalid entity type character '${entityChar}' in PAN`,
          severity: 'ERROR',
        });
      }
    }
    
    // Auto-uppercase suggestion
    if (value !== cleaned && errors.length === 0) {
      suggestions.push({
        field: 'pan',
        code: 'HEP_UPPERCASE_SUGGESTION',
        message: 'PAN should be in uppercase',
        suggestedValue: cleaned,
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Validate GSTIN
   */
  static validateGSTIN(value: string): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toUpperCase().replace(/\s/g, '');
    
    // Format: 22AAAAA0000A1Z5
    // State code (2) + PAN (10) + Entity number (1) + Z (1) + Checksum (1)
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(cleaned)) {
      errors.push({
        field: 'gstin',
        code: 'HEP_INVALID_FORMAT',
        message: 'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5',
        severity: 'ERROR',
      });
    }
    
    // Validate state code
    if (cleaned.length >= 2) {
      const stateCode = parseInt(cleaned.substring(0, 2));
      if (stateCode < 1 || stateCode > 38) {
        errors.push({
          field: 'gstin',
          code: 'HEP_INVALID_STATE_CODE',
          message: `Invalid state code '${cleaned.substring(0, 2)}' in GSTIN`,
          severity: 'ERROR',
        });
      }
    }
    
    // Extract PAN from GSTIN for cross-validation
    if (cleaned.length >= 12) {
      const embeddedPan = cleaned.substring(2, 12);
      suggestions.push({
        field: 'pan',
        code: 'HEP_PAN_FROM_GSTIN',
        message: `PAN extracted from GSTIN: ${embeddedPan}`,
        suggestedValue: embeddedPan,
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Validate IFSC code
   */
  static validateIFSC(value: string): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toUpperCase().replace(/\s/g, '');
    
    // Format: AAAA0XXXXXX (4 letters, 0, 6 alphanumeric)
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned)) {
      errors.push({
        field: 'ifsc',
        code: 'HEP_INVALID_FORMAT',
        message: 'IFSC must be 11 characters: 4 letters, 0, and 6 alphanumeric',
        severity: 'ERROR',
      });
    }
    
    // Fifth character must be 0
    if (cleaned.length >= 5 && cleaned[4] !== '0') {
      errors.push({
        field: 'ifsc',
        code: 'HEP_INVALID_IFSC',
        message: 'Fifth character of IFSC must be 0',
        severity: 'ERROR',
      });
    }
    
    // Common bank code suggestions
    const bankCodes: Record<string, string> = {
      'SBIN': 'State Bank of India',
      'HDFC': 'HDFC Bank',
      'ICIC': 'ICICI Bank',
      'UTIB': 'Axis Bank',
      'KKBK': 'Kotak Mahindra Bank',
      'PUNB': 'Punjab National Bank',
      'BARB': 'Bank of Baroda',
      'CNRB': 'Canara Bank',
    };
    
    if (cleaned.length >= 4) {
      const bankCode = cleaned.substring(0, 4);
      if (bankCodes[bankCode]) {
        suggestions.push({
          field: 'ifsc',
          code: 'HEP_BANK_IDENTIFIED',
          message: `Bank identified: ${bankCodes[bankCode]}`,
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CONTACT VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Validate phone number with country detection
   */
  static validatePhone(value: string, expectedCountry?: string): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.replace(/[\s\-\(\)]/g, '');
    
    // Basic format check
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      errors.push({
        field: 'phone',
        code: 'HEP_INVALID_FORMAT',
        message: 'Phone number must be 10-15 digits',
        severity: 'ERROR',
      });
    }
    
    // Country code detection
    const countryPatterns: Record<string, { pattern: RegExp; name: string; format: string }> = {
      IN: { pattern: /^(\+91|91)?[6-9]\d{9}$/, name: 'India', format: '+91 XXXXX XXXXX' },
      US: { pattern: /^(\+1|1)?[2-9]\d{9}$/, name: 'USA', format: '+1 (XXX) XXX-XXXX' },
      GB: { pattern: /^(\+44|44)?[7]\d{9}$/, name: 'UK', format: '+44 XXXX XXXXXX' },
      AE: { pattern: /^(\+971|971)?[5]\d{8}$/, name: 'UAE', format: '+971 XX XXX XXXX' },
      SG: { pattern: /^(\+65|65)?[89]\d{7}$/, name: 'Singapore', format: '+65 XXXX XXXX' },
    };
    
    let detectedCountry: string | undefined;
    for (const [code, { pattern, name }] of Object.entries(countryPatterns)) {
      if (pattern.test(cleaned)) {
        detectedCountry = code;
        suggestions.push({
          field: 'phone',
          code: 'HEP_COUNTRY_DETECTED',
          message: `Phone number appears to be from ${name}`,
        });
        break;
      }
    }
    
    // Mismatch warning
    if (expectedCountry && detectedCountry && expectedCountry !== detectedCountry) {
      warnings.push({
        field: 'phone',
        code: 'HEP_COUNTRY_MISMATCH',
        message: `Phone number country (${detectedCountry}) doesn't match expected (${expectedCountry})`,
        confirmationRequired: true,
      });
    }
    
    // Suggest adding country code
    if (!cleaned.startsWith('+') && cleaned.length === 10 && expectedCountry === 'IN') {
      suggestions.push({
        field: 'phone',
        code: 'HEP_ADD_COUNTRY_CODE',
        message: 'Consider adding country code',
        suggestedValue: `+91${cleaned}`,
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Validate email with domain suggestions
   */
  static validateEmail(value: string): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.toLowerCase().trim();
    
    // Basic format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      errors.push({
        field: 'email',
        code: 'HEP_INVALID_FORMAT',
        message: 'Invalid email format',
        severity: 'ERROR',
      });
      return { isValid: false, errors, warnings, suggestions };
    }
    
    const [localPart, domain] = cleaned.split('@');
    
    // Temporary/disposable email detection
    const disposableDomains = ['tempmail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email'];
    if (disposableDomains.includes(domain)) {
      errors.push({
        field: 'email',
        code: 'HEP_DISPOSABLE_EMAIL',
        message: 'Disposable email addresses are not allowed',
        severity: 'CRITICAL',
      });
    }
    
    // Common typo detection
    const commonDomains: Record<string, string> = {
      'gmail.com': 'gmail.com',
      'gmial.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'gmail.co': 'gmail.com',
      'yahoo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'hotmail.com': 'hotmail.com',
      'hotmal.com': 'hotmail.com',
      'outlook.com': 'outlook.com',
      'outloo.com': 'outlook.com',
    };
    
    if (commonDomains[domain] && commonDomains[domain] !== domain) {
      warnings.push({
        field: 'email',
        code: 'HEP_POSSIBLE_TYPO',
        message: `Did you mean @${commonDomains[domain]}?`,
        confirmationRequired: true,
      });
      suggestions.push({
        field: 'email',
        code: 'HEP_DOMAIN_CORRECTION',
        message: `Suggested correction: ${localPart}@${commonDomains[domain]}`,
        suggestedValue: `${localPart}@${commonDomains[domain]}`,
      });
    }
    
    // Plus addressing check
    if (localPart.includes('+')) {
      warnings.push({
        field: 'email',
        code: 'HEP_PLUS_ADDRESSING',
        message: 'Email uses plus addressing. Some services may strip the +tag portion.',
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FINANCIAL VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Validate account number
   */
  static validateAccountNumber(value: string, countryCode: string): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const cleaned = value.replace(/\s/g, '');
    
    // Country-specific validation
    const accountRules: Record<string, { minLength: number; maxLength: number; pattern: RegExp }> = {
      IN: { minLength: 9, maxLength: 18, pattern: /^\d{9,18}$/ },
      US: { minLength: 8, maxLength: 17, pattern: /^\d{8,17}$/ },
      GB: { minLength: 8, maxLength: 8, pattern: /^\d{8}$/ }, // Sort code separate
      AE: { minLength: 12, maxLength: 23, pattern: /^[A-Z]{2}\d{2}[A-Z0-9]{12,19}$/ }, // IBAN
    };
    
    const rules = accountRules[countryCode] || { minLength: 8, maxLength: 20, pattern: /^[A-Z0-9]{8,20}$/i };
    
    if (cleaned.length < rules.minLength || cleaned.length > rules.maxLength) {
      errors.push({
        field: 'accountNumber',
        code: 'HEP_INVALID_LENGTH',
        message: `Account number must be ${rules.minLength}-${rules.maxLength} characters for ${countryCode}`,
        severity: 'ERROR',
      });
    }
    
    if (!rules.pattern.test(cleaned)) {
      errors.push({
        field: 'accountNumber',
        code: 'HEP_INVALID_FORMAT',
        message: 'Invalid account number format',
        severity: 'ERROR',
      });
    }
    
    // Suspicious pattern detection
    warnings.push(...this.detectSuspiciousPatterns('accountNumber', cleaned));
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  /**
   * Validate nominee percentages
   */
  static validateNomineePercentages(
    percentages: number[]
  ): HepValidationResult {
    const errors: HepError[] = [];
    const warnings: HepWarning[] = [];
    const suggestions: HepSuggestion[] = [];
    
    const total = percentages.reduce((sum, p) => sum + p, 0);
    
    if (Math.abs(total - 100) > 0.01) {
      errors.push({
        field: 'nomineePercentages',
        code: 'HEP_INVALID_TOTAL',
        message: `Nominee percentages must total 100%. Current total: ${total.toFixed(2)}%`,
        severity: 'CRITICAL',
      });
      
      // Suggest adjustment
      const adjustment = 100 - total;
      suggestions.push({
        field: 'nomineePercentages',
        code: 'HEP_ADJUSTMENT_NEEDED',
        message: `Adjustment needed: ${adjustment > 0 ? '+' : ''}${adjustment.toFixed(2)}%`,
      });
    }
    
    // Check for very small percentages
    for (let i = 0; i < percentages.length; i++) {
      if (percentages[i] > 0 && percentages[i] < 1) {
        warnings.push({
          field: `nominee[${i}].percentage`,
          code: 'HEP_SMALL_PERCENTAGE',
          message: `Nominee ${i + 1} has a very small percentage (${percentages[i]}%)`,
          confirmationRequired: true,
        });
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DATE VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Validate date of birth
   */
  static validateDateOfBirth(value: string): HepValidationResult {
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
    
    // Future date check
    if (date > now) {
      errors.push({
        field: 'dateOfBirth',
        code: 'HEP_FUTURE_DATE',
        message: 'Date of birth cannot be in the future',
        severity: 'CRITICAL',
      });
    }
    
    // Age calculation
    let age = now.getFullYear() - date.getFullYear();
    const monthDiff = now.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
      age--;
    }
    
    // Minimum age (18)
    if (age < 18) {
      errors.push({
        field: 'dateOfBirth',
        code: 'HEP_UNDERAGE',
        message: 'Must be at least 18 years old',
        severity: 'CRITICAL',
      });
    }
    
    // Maximum age (120)
    if (age > 120) {
      errors.push({
        field: 'dateOfBirth',
        code: 'HEP_INVALID_AGE',
        message: 'Please verify the date of birth',
        severity: 'ERROR',
      });
    }
    
    // Edge case warnings
    if (age >= 80) {
      warnings.push({
        field: 'dateOfBirth',
        code: 'HEP_SENIOR_AGE',
        message: `Age calculated as ${age}. Please verify this is correct.`,
        confirmationRequired: true,
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER: VERHOEFF CHECKSUM
  // ─────────────────────────────────────────────────────────────────────────────
  
  private static verifyVerhoeffChecksum(num: string): boolean {
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL FORM VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class RegistrationFormValidator {
  
  /**
   * Validate entire registration form with HEP
   */
  static validateFullForm(formData: Record<string, any>): HepValidationResult {
    const allErrors: HepError[] = [];
    const allWarnings: HepWarning[] = [];
    const allSuggestions: HepSuggestion[] = [];
    
    // Double entry verifications
    const doubleEntryFields = [
      { field: 'primaryMobile', v1: formData.primaryMobile, v2: formData.primaryMobile_verify },
      { field: 'primaryEmail', v1: formData.primaryEmail, v2: formData.primaryEmail_verify },
      { field: 'accountNumber', v1: formData.accountNumber, v2: formData.accountNumber_verify },
      { field: 'password', v1: formData.password, v2: formData.password_verify },
    ];
    
    for (const { field, v1, v2 } of doubleEntryFields) {
      if (v1 || v2) {
        const error = HepValidator.verifyDoubleEntry(field, v1, v2);
        if (error) allErrors.push(error);
      }
    }
    
    // Document validations
    if (formData.aadhaar) {
      const result = HepValidator.validateAadhaar(formData.aadhaar);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    }
    
    if (formData.pan) {
      const result = HepValidator.validatePAN(formData.pan);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    }
    
    if (formData.gstin) {
      const result = HepValidator.validateGSTIN(formData.gstin);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    }
    
    // Contact validations
    if (formData.primaryEmail) {
      const result = HepValidator.validateEmail(formData.primaryEmail);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    }
    
    if (formData.primaryMobile) {
      const result = HepValidator.validatePhone(formData.primaryMobile, formData.countryCode);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    }
    
    // Date of birth
    if (formData.dateOfBirth) {
      const result = HepValidator.validateDateOfBirth(formData.dateOfBirth);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    }
    
    // Copy-paste detection
    const copyPasteWarnings = HepValidator.detectCopyPasteAnomalies({
      firstName: formData.firstName,
      lastName: formData.lastName,
      accountHolderName: formData.accountHolderName,
    });
    allWarnings.push(...copyPasteWarnings);
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      suggestions: allSuggestions,
    };
  }
}
