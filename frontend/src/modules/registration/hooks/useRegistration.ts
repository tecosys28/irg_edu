/**
 * IRG_FTR PLATFORM - useRegistration Hook
 * TROT REGISTRATION PROTOCOL COMPLIANT
 * 
 * Manages registration session state and API interactions
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { useState, useCallback, useRef } from 'react';
import type { RegistrationPayload, RegistrationResponse } from '@ftr-platform/shared/registration/types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UseRegistrationReturn {
  // Session state
  sessionToken: string | null;
  participantId: string | null;
  registrationId: string | null;
  
  // Loading/error state
  isLoading: boolean;
  error: Error | null;
  
  // Current step tracking
  currentStep: string | null;
  completedSteps: string[];
  
  // Actions
  initiateSession: (source?: string, referralCode?: string) => Promise<void>;
  submitStep: (stepId: string, data: Partial<RegistrationPayload>) => Promise<StepSubmissionResult>;
  finalizeRegistration: () => Promise<RegistrationResponse>;
  
  // Verification actions
  verifyMobileOtp: (otp: string) => Promise<boolean>;
  verifyEmailToken: (token: string) => Promise<boolean>;
  resendOtp: (type: 'mobile' | 'email', destination: string) => Promise<void>;
  
  // KYC actions
  initiateVideoKyc: (countryCode: string) => Promise<VideoKycSession>;
  uploadDocument: (documentType: string, file: File) => Promise<DocumentUploadResult>;
  
  // Status
  getRegistrationStatus: () => Promise<RegistrationStatus>;
  getEligibility: () => Promise<EligibilityResult>;
  getRiskScore: () => Promise<RiskScoreResult>;
  
  // Reset
  resetSession: () => void;
}

interface StepSubmissionResult {
  success: boolean;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
  hepViolations?: string[];
  data?: any;
}

interface VideoKycSession {
  sessionId: string;
  sessionUrl: string;
  expiresAt: string;
}

interface DocumentUploadResult {
  success: boolean;
  documentId?: string;
  ocrExtracted?: Record<string, any>;
  ocrConfidence?: number;
  errors?: string[];
}

interface RegistrationStatus {
  participantId: string;
  currentStep: string;
  completedSteps: string[];
  pendingSteps: string[];
  kycStatus: string;
  kycTier: string;
  eligibilityStatus: string;
}

interface EligibilityResult {
  isEligible: boolean;
  checks: Record<string, boolean>;
  failureReasons?: string[];
}

interface RiskScoreResult {
  score: number;
  rating: string;
  factorBreakdown: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = '/api/v1/registration';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  sessionToken?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (sessionToken) {
    headers['X-Registration-Session'] = sessionToken;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'API request failed');
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function useRegistration(): UseRegistrationReturn {
  // State
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Initiate registration session
   */
  const initiateSession = useCallback(async (source?: string, referralCode?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<{
        success: boolean;
        data: {
          participantId: string;
          registrationId: string;
          sessionToken: string;
        };
      }>('/initiate', {
        method: 'POST',
        body: JSON.stringify({ source, referralCode }),
      });

      if (response.success) {
        setSessionToken(response.data.sessionToken);
        setParticipantId(response.data.participantId);
        setRegistrationId(response.data.registrationId);
        setCurrentStep('roles');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to initiate session'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Submit step data
   */
  const submitStep = useCallback(async (
    stepId: string,
    data: Partial<RegistrationPayload>
  ): Promise<StepSubmissionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<{
        success: boolean;
        data?: any;
        errors?: Record<string, string>;
        warnings?: Record<string, string>;
        hepViolations?: string[];
      }>(`/step/${stepId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }, sessionToken);

      if (response.success) {
        setCompletedSteps(prev => [...new Set([...prev, stepId])]);
      }

      return {
        success: response.success,
        errors: response.errors,
        warnings: response.warnings,
        hepViolations: response.hepViolations,
        data: response.data,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Step submission failed');
      setError(error);
      return {
        success: false,
        errors: { general: error.message },
      };
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  /**
   * Finalize registration
   */
  const finalizeRegistration = useCallback(async (): Promise<RegistrationResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<RegistrationResponse>('/finalize', {
        method: 'POST',
      }, sessionToken);

      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Finalization failed');
      setError(error);
      return {
        success: false,
        error: { code: 'FINALIZATION_ERROR', message: error.message },
      };
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  /**
   * Verify mobile OTP
   */
  const verifyMobileOtp = useCallback(async (otp: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const response = await apiRequest<{ success: boolean }>('/verify/mobile', {
        method: 'POST',
        body: JSON.stringify({ otp }),
      }, sessionToken);

      return response.success;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  /**
   * Verify email token
   */
  const verifyEmailToken = useCallback(async (token: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const response = await apiRequest<{ success: boolean }>('/verify/email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }, sessionToken);

      return response.success;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  /**
   * Resend OTP
   */
  const resendOtp = useCallback(async (type: 'mobile' | 'email', destination: string): Promise<void> => {
    await apiRequest('/verify/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ type, destination }),
    }, sessionToken);
  }, [sessionToken]);

  /**
   * Initiate video KYC
   */
  const initiateVideoKyc = useCallback(async (countryCode: string): Promise<VideoKycSession> => {
    const response = await apiRequest<{
      success: boolean;
      data: VideoKycSession;
    }>('/step/video-kyc/initiate', {
      method: 'POST',
      body: JSON.stringify({ countryCode }),
    }, sessionToken);

    return response.data;
  }, [sessionToken]);

  /**
   * Upload document
   */
  const uploadDocument = useCallback(async (
    documentType: string,
    file: File
  ): Promise<DocumentUploadResult> => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);

    // For file uploads, we use a different approach
    const response = await fetch(`${API_BASE}/step/kyc-documents`, {
      method: 'POST',
      headers: {
        'X-Registration-Session': sessionToken || '',
        'X-Participant-Id': participantId || '',
      },
      body: formData,
    });

    const data = await response.json();

    return {
      success: data.success,
      documentId: data.data?.documentId,
      ocrExtracted: data.data?.ocrExtracted,
      ocrConfidence: data.data?.ocrConfidence,
      errors: data.errors,
    };
  }, [sessionToken, participantId]);

  /**
   * Get registration status
   */
  const getRegistrationStatus = useCallback(async (): Promise<RegistrationStatus> => {
    const response = await apiRequest<{
      success: boolean;
      data: RegistrationStatus;
    }>('/status', {}, sessionToken);

    return response.data;
  }, [sessionToken]);

  /**
   * Get eligibility
   */
  const getEligibility = useCallback(async (): Promise<EligibilityResult> => {
    const response = await apiRequest<{
      success: boolean;
      data: EligibilityResult;
    }>('/eligibility', {}, sessionToken);

    return response.data;
  }, [sessionToken]);

  /**
   * Get risk score
   */
  const getRiskScore = useCallback(async (): Promise<RiskScoreResult> => {
    const response = await apiRequest<{
      success: boolean;
      data: RiskScoreResult;
    }>('/risk-score', {}, sessionToken);

    return response.data;
  }, [sessionToken]);

  /**
   * Reset session
   */
  const resetSession = useCallback(() => {
    setSessionToken(null);
    setParticipantId(null);
    setRegistrationId(null);
    setCurrentStep(null);
    setCompletedSteps([]);
    setError(null);
    
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    sessionToken,
    participantId,
    registrationId,
    isLoading,
    error,
    currentStep,
    completedSteps,
    initiateSession,
    submitStep,
    finalizeRegistration,
    verifyMobileOtp,
    verifyEmailToken,
    resendOtp,
    initiateVideoKyc,
    uploadDocument,
    getRegistrationStatus,
    getEligibility,
    getRiskScore,
    resetSession,
  };
}

export default useRegistration;
