/**
 * IRG_FTR PLATFORM - Cross-Currency Swap UI
 * P2 AUDIT FIX: Frontend component for cross-currency swap
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  useDebounce, 
  useDoubleEntry, 
  useDuplicateGuard,
  useConfirmation,
  useRateLimit
} from '@ftr-platform/shared/hooks';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Token {
  id: string;
  publicId: string;
  productType: string;
  faceValue: number;
  currency: string;
  minterName: string;
  state: string;
}

interface Minter {
  id: string;
  businessName: string;
  productTypes: string[];
  countryCode: string;
}

interface SwapRate {
  offeredRate: number;
  requestedRate: number;
  fxRate: number;
  fxSpread: number;
  platformFee: number;
  netValue: number;
  settlementAmount: number;
}

interface InventoryStatus {
  available: boolean;
  source: 'OPEN_MARKET' | 'MINTER_CF' | 'POOLED_CF' | 'SHORT_SALE';
  requiresShortSale: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const SWAP_FEE_PERCENT = 2;
const FX_SPREAD_PERCENT = 0.5;
const CONFIRMATION_TIMEOUT_MS = 30000;

// Mock FX rates (in production, fetched from API)
const FX_RATES: Record<string, number> = {
  'INR_USD': 0.012,
  'INR_EUR': 0.011,
  'INR_GBP': 0.0095,
  'USD_INR': 83.5,
  'USD_EUR': 0.92,
  'USD_GBP': 0.79,
  'EUR_INR': 90.5,
  'EUR_USD': 1.09,
  'EUR_GBP': 0.86,
  'GBP_INR': 105.5,
  'GBP_USD': 1.27,
  'GBP_EUR': 1.16,
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CrossCurrencySwapUI() {
  // State
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [targetMinter, setTargetMinter] = useState<Minter | null>(null);
  const [targetCurrency, setTargetCurrency] = useState('INR');
  const [requestedValue, setRequestedValue] = useState(0);
  const [requestedValue_verify, setRequestedValue_verify] = useState(0);
  const [serviceDescription, setServiceDescription] = useState('');
  
  const [swapRate, setSwapRate] = useState<SwapRate | null>(null);
  const [inventoryStatus, setInventoryStatus] = useState<InventoryStatus | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mock data
  const [userTokens] = useState<Token[]>([
    { id: 'token_001', publicId: 'K_FTR-2026-MNT001-00001', productType: 'K_FTR', faceValue: 5000, currency: 'INR', minterName: 'Minter Corp A', state: 'AVAILABLE' },
    { id: 'token_002', publicId: 'HOSP-2026-MNT002-00001', productType: 'HOSP', faceValue: 3000, currency: 'USD', minterName: 'Hotel Chain B', state: 'AVAILABLE' },
  ]);

  const [availableMinters] = useState<Minter[]>([
    { id: 'minter_001', businessName: 'Minter Corp A', productTypes: ['K_FTR', 'TGDP'], countryCode: 'IN' },
    { id: 'minter_002', businessName: 'Hotel Chain B', productTypes: ['HOSP'], countryCode: 'US' },
    { id: 'minter_003', businessName: 'Healthcare Inc', productTypes: ['HEALTH'], countryCode: 'GB' },
  ]);

  // HEP Hooks
  const { verifyMatch, isValid: isValueVerified, mismatchError } = useDoubleEntry({ 
    tolerance: 0.005 // 0.5% for FX transactions
  });
  const { isDuplicate, markSubmitted } = useDuplicateGuard({ key: 'swap-form' });
  const { confirm, isPending: isConfirming } = useConfirmation({ timeout: CONFIRMATION_TIMEOUT_MS });
  const { checkLimit, recordRequest, remainingRequests } = useRateLimit({ maxRequests: 10, windowMs: 60000 });
  const { debouncedCallback: debouncedCalculate } = useDebounce(calculateRates, 500);

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async function calculateRates() {
    if (!selectedToken || !targetMinter || requestedValue <= 0) {
      setSwapRate(null);
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const sourceCurrency = selectedToken.currency;
      const isCrossCurrency = sourceCurrency !== targetCurrency;
      
      let fxRate = 1;
      if (isCrossCurrency) {
        const fxKey = `${sourceCurrency}_${targetCurrency}`;
        fxRate = FX_RATES[fxKey] || 1;
      }

      const offeredRate = selectedToken.faceValue;
      const requestedRate = requestedValue;
      const fxSpread = isCrossCurrency ? requestedValue * (FX_SPREAD_PERCENT / 100) : 0;
      const platformFee = requestedValue * (SWAP_FEE_PERCENT / 100);
      const netValue = offeredRate * fxRate - requestedRate;
      const settlementAmount = requestedRate + platformFee + fxSpread;

      setSwapRate({
        offeredRate,
        requestedRate,
        fxRate,
        fxSpread,
        platformFee,
        netValue,
        settlementAmount,
      });

      // Check inventory
      setInventoryStatus({
        available: true,
        source: Math.random() > 0.3 ? 'MINTER_CF' : 'SHORT_SALE',
        requiresShortSale: Math.random() > 0.7,
      });

    } catch (err) {
      setError('Failed to calculate rates. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  }

  useEffect(() => {
    debouncedCalculate();
  }, [selectedToken, targetMinter, requestedValue, targetCurrency]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleInitiateSwap = async () => {
    // Validations
    if (!selectedToken) {
      setError('Please select a token to swap');
      return;
    }
    if (!targetMinter) {
      setError('Please select a target minter');
      return;
    }
    if (requestedValue <= 0) {
      setError('Please enter a valid requested value');
      return;
    }
    if (!verifyMatch(requestedValue, requestedValue_verify, true)) {
      setError(mismatchError || 'Value verification failed');
      return;
    }
    if (isDuplicate()) {
      setError('Please wait before submitting again');
      return;
    }
    if (!checkLimit()) {
      setError(`Rate limit exceeded. ${remainingRequests} requests remaining.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      recordRequest();
      markSubmitted();

      // Generate confirmation token
      const token = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setConfirmationToken(token);
      setCountdown(30);

      // Start countdown
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setConfirmationToken(null);
            setError('Confirmation timeout. Please try again.');
            setIsSubmitting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      setError('Failed to initiate swap. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleConfirmSwap = async () => {
    if (!confirmationToken) return;

    try {
      const confirmed = await confirm();
      if (!confirmed) {
        setError('Swap cancelled');
        setConfirmationToken(null);
        setIsSubmitting(false);
        return;
      }

      // Execute swap (in production, API call)
      console.log('[Swap] Executing swap:', {
        tokenId: selectedToken?.id,
        targetMinterId: targetMinter?.id,
        requestedValue,
        targetCurrency,
        confirmationToken,
      });

      alert('Swap executed successfully!');
      
      // Reset form
      setSelectedToken(null);
      setTargetMinter(null);
      setRequestedValue(0);
      setRequestedValue_verify(0);
      setServiceDescription('');
      setSwapRate(null);
      setConfirmationToken(null);

    } catch (err) {
      setError('Swap execution failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSwap = () => {
    setConfirmationToken(null);
    setIsSubmitting(false);
    setCountdown(0);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Cross-Currency Swap</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Offer */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">You Offer</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Select Token</label>
            <select
              value={selectedToken?.id || ''}
              onChange={(e) => setSelectedToken(userTokens.find(t => t.id === e.target.value) || null)}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select a token...</option>
              {userTokens.filter(t => t.state === 'AVAILABLE').map(token => (
                <option key={token.id} value={token.id}>
                  {token.publicId} - {token.currency} {token.faceValue}
                </option>
              ))}
            </select>
          </div>

          {selectedToken && (
            <div className="bg-gray-50 p-4 rounded">
              <p><strong>Token ID:</strong> {selectedToken.publicId}</p>
              <p><strong>Type:</strong> {selectedToken.productType}</p>
              <p><strong>Face Value:</strong> {selectedToken.currency} {selectedToken.faceValue.toLocaleString()}</p>
              <p><strong>Minter:</strong> {selectedToken.minterName}</p>
            </div>
          )}
        </div>

        {/* Right Column - Request */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">You Request</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Target Minter</label>
            <select
              value={targetMinter?.id || ''}
              onChange={(e) => setTargetMinter(availableMinters.find(m => m.id === e.target.value) || null)}
              className="w-full border rounded-md p-2"
            >
              <option value="">Select a minter...</option>
              {availableMinters.map(minter => (
                <option key={minter.id} value={minter.id}>
                  {minter.businessName} ({minter.productTypes.join(', ')})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              {CURRENCIES.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Requested Value</label>
              <input
                type="number"
                value={requestedValue || ''}
                onChange={(e) => setRequestedValue(Number(e.target.value))}
                className="w-full border rounded-md p-2"
                min={1}
                max={1000000}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Value</label>
              <input
                type="number"
                value={requestedValue_verify || ''}
                onChange={(e) => setRequestedValue_verify(Number(e.target.value))}
                className="w-full border rounded-md p-2"
                min={1}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">Double-entry verification required (0.5% tolerance for FX)</p>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Service Description</label>
            <textarea
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              className="w-full border rounded-md p-2"
              rows={3}
              placeholder="Describe the service/goods you want..."
            />
          </div>
        </div>
      </div>

      {/* Rate Calculation */}
      {swapRate && (
        <div className="mt-6 bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Swap Summary</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Offered Value</p>
              <p className="text-lg font-bold">{selectedToken?.currency} {swapRate.offeredRate.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">FX Rate</p>
              <p className="text-lg font-bold">{swapRate.fxRate.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Platform Fee (2%)</p>
              <p className="text-lg font-bold">{targetCurrency} {swapRate.platformFee.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">FX Spread (0.5%)</p>
              <p className="text-lg font-bold">{targetCurrency} {swapRate.fxSpread.toFixed(2)}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg">Settlement Amount:</span>
              <span className="text-2xl font-bold text-blue-600">
                {targetCurrency} {swapRate.settlementAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {inventoryStatus && (
            <div className={`mt-4 p-3 rounded ${inventoryStatus.requiresShortSale ? 'bg-yellow-100' : 'bg-green-100'}`}>
              <p className="text-sm">
                <strong>Inventory Source:</strong> {inventoryStatus.source}
                {inventoryStatus.requiresShortSale && (
                  <span className="text-yellow-700 ml-2">⚠️ Short sale required</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Section */}
      {confirmationToken && (
        <div className="mt-6 bg-yellow-50 border-2 border-yellow-400 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Confirm Swap</h3>
          <p className="text-sm text-gray-600 mb-4">
            You have <span className="font-bold text-red-600">{countdown}</span> seconds to confirm this swap.
          </p>
          
          <div className="flex space-x-4">
            <button
              onClick={handleConfirmSwap}
              disabled={isConfirming}
              className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              {isConfirming ? 'Confirming...' : 'Confirm Swap'}
            </button>
            <button
              onClick={handleCancelSwap}
              className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!confirmationToken && (
        <div className="mt-6 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Rate limit: {remainingRequests} requests remaining
          </p>
          <button
            onClick={handleInitiateSwap}
            disabled={isSubmitting || isCalculating || !swapRate}
            className="px-8 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isCalculating ? 'Calculating...' : isSubmitting ? 'Processing...' : 'Initiate Swap'}
          </button>
        </div>
      )}
    </div>
  );
}
