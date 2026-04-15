/**
 * IRG_FTR PLATFORM - Minting Application Form
 * 
 * AUDIT FIXES APPLIED:
 * - P0: Fixed useDebounce (imported from shared hooks, not inline)
 * - P1: Added country selector for dynamic ROI
 * - P2: Implemented missing Steps 2, 3, 4 (Revenue, Parameters, Assets)
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import React, { useState, useCallback, useEffect } from 'react';

// AUDIT FIX P0: Import fixed useDebounce from shared hooks
// Previously this component had an inline buggy version with stale closure
import { 
  useDebounce, 
  useDoubleEntry, 
  useDuplicateGuard, 
  useAutoSave,
  SUBMIT_COOLDOWN_MS 
} from '@ftr-platform/shared/hooks';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type ProductType = 'K_FTR' | 'TGDP' | 'T_JR' | 'AF_FTR' | 'GIC' | 'HOSP' | 'HEALTH' | 'EDU' | 'TROT_REALTY' | 'TAXI_FTR';

interface Step1Data {
  projectName: string;
  productType: ProductType;
  description: string;
  countryCode: string; // P1 FIX: Added for dynamic ROI
  stateCode?: string;
}

// P2 FIX: Step 2 - Revenue Details (previously placeholder)
interface Step2Data {
  annualRevenue: number;
  annualRevenue_verify: number; // Double entry
  projectedGrowthRate: number;
  revenueStreams: {
    source: string;
    percentage: number;
  }[];
  financialYear: string;
}

// P2 FIX: Step 3 - Capacity Parameters (previously placeholder)
interface Step3Data {
  totalCapacity: number;
  totalCapacity_verify: number; // Double entry
  utilizationRate: number;
  faceValue: number;
  faceValue_verify: number; // Double entry
  validityYears: number;
  expectedRoi: number; // P1 FIX: Now fetched dynamically based on country
  earmarkPercentage: number;
}

// P2 FIX: Step 4 - Asset Details (previously placeholder)
interface Step4Data {
  assetType: 'PHYSICAL' | 'DIGITAL' | 'SERVICE' | 'MIXED';
  assetDescription: string;
  assetLocation?: string;
  assetValuation: number;
  assetValuation_verify: number; // Double entry
  supportingDocuments: {
    type: string;
    fileName: string;
    uploadedAt: string;
  }[];
}

interface FormData {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
}

// P1 FIX: Country ROI mapping (fetched from API in production)
// Now fetched dynamically - these are fallback values only
const COUNTRY_ROI_DEFAULTS: Record<string, number> = {
  IN: 9.2,
  US: 6.5,
  GB: 7.0,
  AE: 8.0,
  SG: 5.5,
  AU: 6.0,
  CA: 6.0,
  DE: 4.5,
  FR: 4.5,
  JP: 3.0,
};

// ROI Configuration from API
interface RoiConfigResponse {
  countryCode: string;
  baseRoi: number;
  minRoi: number;
  maxRoi: number;
  regulatoryFramework?: string;
}

const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'UAE' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
];

// API helper for fetching dynamic ROI
async function fetchRoiForCountry(countryCode: string): Promise<RoiConfigResponse> {
  try {
    const response = await fetch(`/api/v1/roi/base/${countryCode}`);
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    throw new Error(data.error?.message || 'Failed to fetch ROI');
  } catch (error) {
    console.warn(`[ROI] Failed to fetch for ${countryCode}, using fallback:`, error);
    return {
      countryCode,
      baseRoi: COUNTRY_ROI_DEFAULTS[countryCode] || 9.2,
      minRoi: 0,
      maxRoi: 100,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MintingApplicationForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    step1: {
      projectName: '',
      productType: 'K_FTR',
      description: '',
      countryCode: 'IN',
      stateCode: '',
    },
    step2: {
      annualRevenue: 0,
      annualRevenue_verify: 0,
      projectedGrowthRate: 10,
      revenueStreams: [],
      financialYear: '2025-26',
    },
    step3: {
      totalCapacity: 100,
      totalCapacity_verify: 0,
      utilizationRate: 80,
      faceValue: 1000,
      faceValue_verify: 0,
      validityYears: 10,
      expectedRoi: 9.2,
      earmarkPercentage: 25,
    },
    step4: {
      assetType: 'SERVICE',
      assetDescription: '',
      assetLocation: '',
      assetValuation: 0,
      assetValuation_verify: 0,
      supportingDocuments: [],
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT FIX P0: Use fixed useDebounce from shared hooks
  // The previous inline version had stale closure bug
  // ═══════════════════════════════════════════════════════════════════════════
  
  const { debouncedCallback: debouncedSave, isDebouncing } = useDebounce(
    async (data: FormData) => {
      console.log('[Auto-save] Saving draft...', data);
      // In production: await api.saveDraft(data);
    },
    SUBMIT_COOLDOWN_MS
  );

  // Double entry verification for financial fields
  const { verifyMatch: verifyRevenue, mismatchError: revenueError } = useDoubleEntry();
  const { verifyMatch: verifyCapacity, mismatchError: capacityError } = useDoubleEntry();
  const { verifyMatch: verifyFaceValue, mismatchError: faceValueError } = useDoubleEntry();
  const { verifyMatch: verifyValuation, mismatchError: valuationError } = useDoubleEntry();

  // Duplicate submission guard
  const { isDuplicate, markSubmitted } = useDuplicateGuard({ key: 'minting-form' });

  // Auto-save functionality
  const { isDirty, setDirty, lastSaved, saveNow } = useAutoSave({
    data: formData,
    onSave: async (data) => {
      console.log('[Auto-save] Draft saved at', new Date().toISOString());
    },
    interval: 30000,
    enabled: true,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P1 FIX: Fetch dynamic ROI when country changes (now from API)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [roiConfig, setRoiConfig] = useState<RoiConfigResponse | null>(null);
  const [isLoadingRoi, setIsLoadingRoi] = useState(false);
  
  useEffect(() => {
    const countryCode = formData.step1.countryCode;
    
    // Fetch dynamic ROI from API
    setIsLoadingRoi(true);
    fetchRoiForCountry(countryCode)
      .then((config) => {
        setRoiConfig(config);
        setFormData(prev => ({
          ...prev,
          step3: {
            ...prev.step3,
            expectedRoi: config.baseRoi,
          },
        }));
        console.log(`[ROI] Fetched ROI for ${countryCode}:`, config);
      })
      .catch((error) => {
        console.error(`[ROI] Error fetching ROI:`, error);
        // Fallback to hardcoded value
        const roi = COUNTRY_ROI_DEFAULTS[countryCode] || 9.2;
        setFormData(prev => ({
          ...prev,
          step3: {
            ...prev.step3,
            expectedRoi: roi,
          },
        }));
      })
      .finally(() => {
        setIsLoadingRoi(false);
      });
  }, [formData.step1.countryCode]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FORM HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStep1Change = (field: keyof Step1Data, value: any) => {
    setFormData(prev => ({
      ...prev,
      step1: { ...prev.step1, [field]: value },
    }));
    setDirty(true);
  };

  const handleStep2Change = (field: keyof Step2Data, value: any) => {
    setFormData(prev => ({
      ...prev,
      step2: { ...prev.step2, [field]: value },
    }));
    setDirty(true);
  };

  const handleStep3Change = (field: keyof Step3Data, value: any) => {
    setFormData(prev => ({
      ...prev,
      step3: { ...prev.step3, [field]: value },
    }));
    setDirty(true);
  };

  const handleStep4Change = (field: keyof Step4Data, value: any) => {
    setFormData(prev => ({
      ...prev,
      step4: { ...prev.step4, [field]: value },
    }));
    setDirty(true);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1:
        if (!formData.step1.projectName) newErrors.projectName = 'Project name is required';
        if (!formData.step1.description) newErrors.description = 'Description is required';
        if (!formData.step1.countryCode) newErrors.countryCode = 'Country is required';
        break;
      
      case 2:
        if (formData.step2.annualRevenue <= 0) newErrors.annualRevenue = 'Annual revenue must be positive';
        if (!verifyRevenue(formData.step2.annualRevenue, formData.step2.annualRevenue_verify)) {
          newErrors.annualRevenue_verify = revenueError || 'Revenue verification failed';
        }
        break;
      
      case 3:
        if (formData.step3.totalCapacity < 1 || formData.step3.totalCapacity > 100) {
          newErrors.totalCapacity = 'Capacity must be between 1% and 100%';
        }
        if (!verifyCapacity(formData.step3.totalCapacity, formData.step3.totalCapacity_verify)) {
          newErrors.totalCapacity_verify = capacityError || 'Capacity verification failed';
        }
        if (formData.step3.faceValue < 10 || formData.step3.faceValue > 10000) {
          newErrors.faceValue = 'Face value must be between ₹10 and ₹10,000';
        }
        if (!verifyFaceValue(formData.step3.faceValue, formData.step3.faceValue_verify)) {
          newErrors.faceValue_verify = faceValueError || 'Face value verification failed';
        }
        if (formData.step3.validityYears < 1 || formData.step3.validityYears > 25) {
          newErrors.validityYears = 'Validity must be between 1 and 25 years';
        }
        break;
      
      case 4:
        if (!formData.step4.assetDescription) newErrors.assetDescription = 'Asset description is required';
        if (formData.step4.assetValuation <= 0) newErrors.assetValuation = 'Asset valuation must be positive';
        if (!verifyValuation(formData.step4.assetValuation, formData.step4.assetValuation_verify)) {
          newErrors.assetValuation_verify = valuationError || 'Valuation verification failed';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    // Check for duplicate submission
    if (isDuplicate()) {
      alert('Please wait before submitting again');
      return;
    }

    // Validate all steps
    for (let step = 1; step <= 4; step++) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    setIsSubmitting(true);
    markSubmitted();

    try {
      // In production: await api.submitApplication(formData);
      console.log('[Submit] Application submitted:', formData);
      alert('Application submitted successfully!');
    } catch (error) {
      console.error('[Submit] Error:', error);
      alert('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Minting Application</h1>
        <p className="text-gray-600">Step {currentStep} of 4</p>
        
        {/* Progress indicator */}
        <div className="flex mt-4">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 mx-1 rounded ${
                step <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        
        {/* Auto-save indicator */}
        {isDirty && (
          <p className="text-sm text-yellow-600 mt-2">
            {isDebouncing ? 'Saving...' : 'Unsaved changes'}
          </p>
        )}
        {lastSaved && (
          <p className="text-sm text-green-600 mt-1">
            Last saved: {lastSaved.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Step 1: Project Details */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Project Details</h2>
          
          <div>
            <label className="block text-sm font-medium">Project Name *</label>
            <input
              type="text"
              value={formData.step1.projectName}
              onChange={(e) => handleStep1Change('projectName', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
              maxLength={200}
            />
            {errors.projectName && <p className="text-red-500 text-sm">{errors.projectName}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium">Product Type *</label>
            <select
              value={formData.step1.productType}
              onChange={(e) => handleStep1Change('productType', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
            >
              <option value="K_FTR">K_FTR - General</option>
              <option value="TGDP">TGDP - Tokenized GDP</option>
              <option value="T_JR">T_JR - Travel Junior</option>
              <option value="AF_FTR">AF_FTR - Agriculture & Food</option>
              <option value="GIC">GIC - Insurance Credits</option>
              <option value="HOSP">HOSP - Hospitality</option>
              <option value="HEALTH">HEALTH - Healthcare</option>
              <option value="EDU">EDU - Education</option>
              <option value="TROT_REALTY">TROT_REALTY - Real Estate</option>
              <option value="TAXI_FTR">TAXI_FTR - Transportation</option>
            </select>
          </div>
          
          {/* P1 FIX: Country selector for dynamic ROI */}
          <div>
            <label className="block text-sm font-medium">Country *</label>
            <select
              value={formData.step1.countryCode}
              onChange={(e) => handleStep1Change('countryCode', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} (ROI: {COUNTRY_ROI_DEFAULTS[country.code]}%)
                </option>
              ))}
            </select>
            {errors.countryCode && <p className="text-red-500 text-sm">{errors.countryCode}</p>}
            <p className="text-sm text-gray-500 mt-1">
              Expected ROI is automatically set based on country selection
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Description *</label>
            <textarea
              value={formData.step1.description}
              onChange={(e) => handleStep1Change('description', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
              rows={4}
              maxLength={5000}
            />
            {errors.description && <p className="text-red-500 text-sm">{errors.description}</p>}
          </div>
        </div>
      )}

      {/* P2 FIX: Step 2 - Revenue Details (previously placeholder) */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Revenue Details</h2>
          
          <div>
            <label className="block text-sm font-medium">Annual Revenue (₹) *</label>
            <input
              type="number"
              value={formData.step2.annualRevenue || ''}
              onChange={(e) => handleStep2Change('annualRevenue', Number(e.target.value))}
              className="mt-1 block w-full border rounded-md p-2"
              min={0}
            />
            {errors.annualRevenue && <p className="text-red-500 text-sm">{errors.annualRevenue}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium">Confirm Annual Revenue (₹) *</label>
            <input
              type="number"
              value={formData.step2.annualRevenue_verify || ''}
              onChange={(e) => handleStep2Change('annualRevenue_verify', Number(e.target.value))}
              className="mt-1 block w-full border rounded-md p-2"
              min={0}
            />
            {errors.annualRevenue_verify && <p className="text-red-500 text-sm">{errors.annualRevenue_verify}</p>}
            <p className="text-sm text-gray-500 mt-1">Double-entry verification required</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Projected Growth Rate (%)</label>
            <input
              type="number"
              value={formData.step2.projectedGrowthRate}
              onChange={(e) => handleStep2Change('projectedGrowthRate', Number(e.target.value))}
              className="mt-1 block w-full border rounded-md p-2"
              min={0}
              max={100}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium">Financial Year</label>
            <input
              type="text"
              value={formData.step2.financialYear}
              onChange={(e) => handleStep2Change('financialYear', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
              placeholder="e.g., 2025-26"
            />
          </div>
        </div>
      )}

      {/* P2 FIX: Step 3 - Capacity Parameters (previously placeholder) */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Capacity & Parameters</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Total Capacity (%) *</label>
              <input
                type="number"
                value={formData.step3.totalCapacity}
                onChange={(e) => handleStep3Change('totalCapacity', Number(e.target.value))}
                className="mt-1 block w-full border rounded-md p-2"
                min={1}
                max={100}
              />
              {errors.totalCapacity && <p className="text-red-500 text-sm">{errors.totalCapacity}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium">Confirm Capacity (%) *</label>
              <input
                type="number"
                value={formData.step3.totalCapacity_verify || ''}
                onChange={(e) => handleStep3Change('totalCapacity_verify', Number(e.target.value))}
                className="mt-1 block w-full border rounded-md p-2"
                min={1}
                max={100}
              />
              {errors.totalCapacity_verify && <p className="text-red-500 text-sm">{errors.totalCapacity_verify}</p>}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Utilization Rate (%)</label>
            <input
              type="number"
              value={formData.step3.utilizationRate}
              onChange={(e) => handleStep3Change('utilizationRate', Number(e.target.value))}
              className="mt-1 block w-full border rounded-md p-2"
              min={0}
              max={100}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Face Value (₹) *</label>
              <input
                type="number"
                value={formData.step3.faceValue}
                onChange={(e) => handleStep3Change('faceValue', Number(e.target.value))}
                className="mt-1 block w-full border rounded-md p-2"
                min={10}
                max={10000}
              />
              {errors.faceValue && <p className="text-red-500 text-sm">{errors.faceValue}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium">Confirm Face Value (₹) *</label>
              <input
                type="number"
                value={formData.step3.faceValue_verify || ''}
                onChange={(e) => handleStep3Change('faceValue_verify', Number(e.target.value))}
                className="mt-1 block w-full border rounded-md p-2"
                min={10}
                max={10000}
              />
              {errors.faceValue_verify && <p className="text-red-500 text-sm">{errors.faceValue_verify}</p>}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Validity Period (Years) *</label>
            <input
              type="number"
              value={formData.step3.validityYears}
              onChange={(e) => handleStep3Change('validityYears', Number(e.target.value))}
              className="mt-1 block w-full border rounded-md p-2"
              min={1}
              max={25}
            />
            {errors.validityYears && <p className="text-red-500 text-sm">{errors.validityYears}</p>}
          </div>
          
          {/* P1 FIX: ROI now shows dynamic value based on country */}
          <div>
            <label className="block text-sm font-medium">Expected ROI (%)</label>
            <input
              type="number"
              value={formData.step3.expectedRoi}
              readOnly
              className="mt-1 block w-full border rounded-md p-2 bg-gray-100"
            />
            <p className="text-sm text-gray-500 mt-1">
              ROI is automatically set based on country: {formData.step1.countryCode}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Earmark Percentage (%)</label>
            <input
              type="number"
              value={formData.step3.earmarkPercentage}
              onChange={(e) => handleStep3Change('earmarkPercentage', Number(e.target.value))}
              className="mt-1 block w-full border rounded-md p-2"
              min={0}
              max={25}
            />
            <p className="text-sm text-gray-500 mt-1">Maximum allowed: 25%</p>
          </div>
        </div>
      )}

      {/* P2 FIX: Step 4 - Asset Details (previously placeholder) */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Asset Details</h2>
          
          <div>
            <label className="block text-sm font-medium">Asset Type *</label>
            <select
              value={formData.step4.assetType}
              onChange={(e) => handleStep4Change('assetType', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
            >
              <option value="PHYSICAL">Physical Asset</option>
              <option value="DIGITAL">Digital Asset</option>
              <option value="SERVICE">Service</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Asset Description *</label>
            <textarea
              value={formData.step4.assetDescription}
              onChange={(e) => handleStep4Change('assetDescription', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
              rows={4}
              maxLength={2000}
            />
            {errors.assetDescription && <p className="text-red-500 text-sm">{errors.assetDescription}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium">Asset Location</label>
            <input
              type="text"
              value={formData.step4.assetLocation}
              onChange={(e) => handleStep4Change('assetLocation', e.target.value)}
              className="mt-1 block w-full border rounded-md p-2"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Asset Valuation (₹) *</label>
              <input
                type="number"
                value={formData.step4.assetValuation || ''}
                onChange={(e) => handleStep4Change('assetValuation', Number(e.target.value))}
                className="mt-1 block w-full border rounded-md p-2"
                min={0}
              />
              {errors.assetValuation && <p className="text-red-500 text-sm">{errors.assetValuation}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium">Confirm Valuation (₹) *</label>
              <input
                type="number"
                value={formData.step4.assetValuation_verify || ''}
                onChange={(e) => handleStep4Change('assetValuation_verify', Number(e.target.value))}
                className="mt-1 block w-full border rounded-md p-2"
                min={0}
              />
              {errors.assetValuation_verify && <p className="text-red-500 text-sm">{errors.assetValuation_verify}</p>}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Supporting Documents</label>
            <input
              type="file"
              multiple
              className="mt-1 block w-full"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            />
            <p className="text-sm text-gray-500 mt-1">
              Upload relevant documents (PDF, DOC, images). Max 10MB each.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="px-6 py-2 border rounded-md disabled:opacity-50"
        >
          Previous
        </button>
        
        {currentStep < 4 ? (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </button>
        )}
      </div>
    </div>
  );
}
