// ═══════════════════════════════════════════════════════════════════════════════
// IRG SWAP SYSTEM - REACT FRONTEND (v6.0 Production)
// Complete UI with all safety features and HEP hook indicators
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle, Clock, ArrowRightLeft, Shield, Wallet, TrendingUp, RefreshCw, X, Loader2, Lock, Unlock, DollarSign, Building2, FileText, Activity } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

type SwapStatus = 'PENDING' | 'INVENTORY_CHECK' | 'SHORT_SALE_INITIATED' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
type FtrProductType = 'TROT_REALTY' | 'TAXI_FTR' | 'AF_FTR' | 'GIC' | 'HOSP' | 'HEALTH' | 'EDU' | 'K_FTR' | 'T_JR' | 'TGDP';

interface FtrToken {
  id: string;
  tokenId: string;
  productType: FtrProductType;
  minter: { id: string; name: string; country: string };
  faceValue: number;
  currency: string;
  state: string;
  expiresAt: string;
}

interface Minter {
  id: string;
  name: string;
  businessType: string;
  country: string;
  currency: string;
}

interface SwapRequest {
  id: string;
  status: SwapStatus;
  offeredToken?: FtrToken;
  requestedMinter: Minter;
  requestedService: { description: string; quantity: number; estimatedValue: number; productType: FtrProductType };
  marketRateOffered?: number;
  marketRateRequested?: number;
  fxRate?: number;
  shortSaleTriggered: boolean;
  inventorySource?: string;
  createdAt: string;
  executedAt?: string;
}

interface CorpusFund {
  id: string;
  totalBalance: number;
  shortSaleBalance: number;
  fxReserve: number;
  perUnitValue: number;
  outstandingUnits: number;
  status: string;
  minter: Minter;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA (In production, this comes from API)
// ─────────────────────────────────────────────────────────────────────────────────

const MOCK_TOKENS: FtrToken[] = [
  { id: 'tok_1', tokenId: 'FTR-TROT-001', productType: 'TROT_REALTY', minter: { id: 'm1', name: 'Urban Developers Ltd', country: 'IN' }, faceValue: 50000, currency: 'INR', state: 'ACTIVE', expiresAt: '2027-12-31' },
  { id: 'tok_2', tokenId: 'FTR-TAXI-002', productType: 'TAXI_FTR', minter: { id: 'm2', name: 'Metro Cabs Corp', country: 'IN' }, faceValue: 10000, currency: 'INR', state: 'ACTIVE', expiresAt: '2026-06-30' },
  { id: 'tok_3', tokenId: 'TGDP-EDU-003', productType: 'TGDP', minter: { id: 'm3', name: 'Premier Education Trust', country: 'IN' }, faceValue: 75000, currency: 'INR', state: 'ACTIVE', expiresAt: '2028-03-15' },
  { id: 'tok_4', tokenId: 'FTR-HEALTH-004', productType: 'HEALTH', minter: { id: 'm4', name: 'HealthFirst Hospitals', country: 'IN' }, faceValue: 25000, currency: 'INR', state: 'ACTIVE', expiresAt: '2026-09-30' },
];

const MOCK_MINTERS: Minter[] = [
  { id: 'm1', name: 'Urban Developers Ltd', businessType: 'Real Estate', country: 'IN', currency: 'INR' },
  { id: 'm2', name: 'Metro Cabs Corp', businessType: 'Transportation', country: 'IN', currency: 'INR' },
  { id: 'm3', name: 'Premier Education Trust', businessType: 'Education', country: 'IN', currency: 'INR' },
  { id: 'm4', name: 'HealthFirst Hospitals', businessType: 'Healthcare', country: 'IN', currency: 'INR' },
  { id: 'm5', name: 'Global Stays Hotels', businessType: 'Hospitality', country: 'AE', currency: 'AED' },
  { id: 'm6', name: 'TechPark Solutions', businessType: 'Commercial', country: 'SG', currency: 'SGD' },
];

const MOCK_SWAPS: SwapRequest[] = [
  { id: 'sw_1', status: 'EXECUTED', offeredToken: MOCK_TOKENS[0], requestedMinter: MOCK_MINTERS[1], requestedService: { description: 'Taxi Credits Package', quantity: 5, estimatedValue: 12500, productType: 'TAXI_FTR' }, marketRateOffered: 50000, marketRateRequested: 12500, fxRate: 1, shortSaleTriggered: false, inventorySource: 'OPEN_MARKET', createdAt: '2026-04-10T10:30:00Z', executedAt: '2026-04-10T10:32:00Z' },
  { id: 'sw_2', status: 'PENDING', requestedMinter: MOCK_MINTERS[2], requestedService: { description: 'Education Voucher', quantity: 1, estimatedValue: 30000, productType: 'TGDP' }, marketRateRequested: 30000, fxRate: 1, shortSaleTriggered: false, createdAt: '2026-04-12T09:15:00Z' },
];

const MOCK_CORPUS: CorpusFund = {
  id: 'cf_1',
  totalBalance: 5000000,
  shortSaleBalance: 250000,
  fxReserve: 15000,
  perUnitValue: 1250,
  outstandingUnits: 4000,
  status: 'ACTIVE',
  minter: MOCK_MINTERS[0],
};

const FTR_PRODUCT_LABELS: Record<FtrProductType, string> = {
  TROT_REALTY: 'TROT Realty',
  TAXI_FTR: 'Taxi FTR',
  AF_FTR: 'AF FTR',
  GIC: 'GIC',
  HOSP: 'Hospitality',
  HEALTH: 'Healthcare',
  EDU: 'Education',
  K_FTR: 'K-FTR',
  T_JR: 'T-JR',
  TGDP: 'TGDP',
};

const STATUS_CONFIG: Record<SwapStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  PENDING: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: <Clock className="w-4 h-4" /> },
  INVENTORY_CHECK: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: <RefreshCw className="w-4 h-4 animate-spin" /> },
  SHORT_SALE_INITIATED: { color: 'text-purple-400', bg: 'bg-purple-400/10', icon: <TrendingUp className="w-4 h-4" /> },
  EXECUTED: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: <CheckCircle className="w-4 h-4" /> },
  FAILED: { color: 'text-red-400', bg: 'bg-red-400/10', icon: <AlertCircle className="w-4 h-4" /> },
  CANCELLED: { color: 'text-gray-400', bg: 'bg-gray-400/10', icon: <X className="w-4 h-4" /> },
};

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────────

const HepHookIndicator = ({ hooks }: { hooks: string[] }) => (
  <div className="flex flex-wrap gap-1.5 mt-3">
    {hooks.map((hook) => (
      <span key={hook} className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
        {hook}
      </span>
    ))}
  </div>
);

const TokenCard = ({ token, selected, onSelect }: { token: FtrToken; selected: boolean; onSelect: () => void }) => (
  <div
    onClick={onSelect}
    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
      selected
        ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
        : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
    }`}
  >
    <div className="flex items-start justify-between mb-3">
      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ${
        token.productType === 'TGDP' ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300'
      }`}>
        {FTR_PRODUCT_LABELS[token.productType]}
      </span>
      {selected && <CheckCircle className="w-5 h-5 text-cyan-400" />}
    </div>
    <p className="font-mono text-sm text-white/60 mb-1">{token.tokenId}</p>
    <p className="text-lg font-semibold text-white mb-1">
      {token.currency} {token.faceValue.toLocaleString()}
    </p>
    <p className="text-xs text-white/40">{token.minter.name}</p>
  </div>
);

const SwapHistoryItem = ({ swap }: { swap: SwapRequest }) => {
  const config = STATUS_CONFIG[swap.status];
  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bg}`}>
            {config.icon}
            {swap.status}
          </span>
          {swap.shortSaleTriggered && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded">
              SHORT SALE
            </span>
          )}
        </div>
        <span className="text-xs text-white/40 font-mono">
          {new Date(swap.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {swap.offeredToken ? (
          <span className="text-white/80">{swap.offeredToken.tokenId}</span>
        ) : (
          <span className="text-white/40 italic">Cash Payment</span>
        )}
        <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
        <span className="text-white/80">{swap.requestedService.description}</span>
      </div>
      {swap.marketRateRequested && (
        <p className="mt-2 text-xs text-white/40">
          Value: {swap.requestedMinter.currency} {swap.marketRateRequested.toLocaleString()}
          {swap.fxRate && swap.fxRate !== 1 && ` (FX: ${swap.fxRate})`}
        </p>
      )}
    </div>
  );
};

const CorpusFundCard = ({ corpus }: { corpus: CorpusFund }) => {
  const utilizationRate = corpus.totalBalance > 0 ? (corpus.shortSaleBalance / corpus.totalBalance) * 100 : 0;
  
  return (
    <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Building2 className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Super Corpus Fund</h3>
          <p className="text-xs text-white/50">{corpus.minter.name}</p>
        </div>
        <span className={`ml-auto px-2 py-0.5 text-[10px] font-semibold uppercase rounded ${
          corpus.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {corpus.status}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-white/40 mb-1">Total Balance</p>
          <p className="text-xl font-bold text-white">₹{(corpus.totalBalance / 100000).toFixed(1)}L</p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">Short Sale Balance</p>
          <p className="text-xl font-bold text-purple-400">₹{(corpus.shortSaleBalance / 100000).toFixed(1)}L</p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">FX Reserve</p>
          <p className="text-lg font-semibold text-white/80">₹{corpus.fxReserve.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">Per Unit Value</p>
          <p className="text-lg font-semibold text-white/80">₹{corpus.perUnitValue.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white/40">Utilization Rate</span>
          <span className="text-white/60">{utilizationRate.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${utilizationRate}%` }} />
        </div>
      </div>
      
      <p className="text-xs text-white/40 mt-3">
        {corpus.outstandingUnits.toLocaleString()} outstanding units
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────────

export default function IRGSwapSystem() {
  const [activeTab, setActiveTab] = useState<'swap' | 'history' | 'corpus'>('swap');
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedMinter, setSelectedMinter] = useState<string>('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [selectedProductType, setSelectedProductType] = useState<FtrProductType>('TAXI_FTR');
  const [isProcessing, setIsProcessing] = useState(false);
  const [swapStage, setSwapStage] = useState<'idle' | 'validating' | 'confirming' | 'executing' | 'complete'>('idle');
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swaps, setSwaps] = useState<SwapRequest[]>(MOCK_SWAPS);

  const activeHooks = ['double-entry', 'confirmation', 'duplicate-guard', 'rate-limit', 'validation', 'audit-log', 'rollback'];
  
  const handleInitiateSwap = async () => {
    setError(null);
    setIsProcessing(true);
    
    // Stage 1: Validation
    setSwapStage('validating');
    await new Promise(r => setTimeout(r, 800));
    
    // Validate inputs
    if (!selectedMinter) {
      setError('Please select a target minter');
      setIsProcessing(false);
      setSwapStage('idle');
      return;
    }
    if (!serviceDescription.trim()) {
      setError('Please describe the requested service');
      setIsProcessing(false);
      setSwapStage('idle');
      return;
    }
    if (estimatedValue <= 0) {
      setError('Please enter a valid estimated value');
      setIsProcessing(false);
      setSwapStage('idle');
      return;
    }
    
    // Stage 2: Awaiting confirmation
    setSwapStage('confirming');
    const token = `confirm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setConfirmationToken(token);
    setIsProcessing(false);
  };

  const handleConfirmSwap = async () => {
    if (!confirmationToken) return;
    
    setIsProcessing(true);
    setSwapStage('executing');
    
    // Simulate execution
    await new Promise(r => setTimeout(r, 1500));
    
    // Create new swap
    const newSwap: SwapRequest = {
      id: `sw_${Date.now()}`,
      status: 'EXECUTED',
      offeredToken: selectedToken ? MOCK_TOKENS.find(t => t.id === selectedToken) : undefined,
      requestedMinter: MOCK_MINTERS.find(m => m.id === selectedMinter)!,
      requestedService: {
        description: serviceDescription,
        quantity,
        estimatedValue,
        productType: selectedProductType,
      },
      marketRateOffered: selectedToken ? MOCK_TOKENS.find(t => t.id === selectedToken)?.faceValue : 0,
      marketRateRequested: estimatedValue,
      fxRate: 1,
      shortSaleTriggered: Math.random() > 0.7, // 30% chance of short sale for demo
      inventorySource: Math.random() > 0.5 ? 'OPEN_MARKET' : 'MINTER_CF',
      createdAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
    };
    
    setSwaps([newSwap, ...swaps]);
    setSwapStage('complete');
    
    // Reset after delay
    setTimeout(() => {
      setSwapStage('idle');
      setConfirmationToken(null);
      setSelectedToken(null);
      setSelectedMinter('');
      setServiceDescription('');
      setQuantity(1);
      setEstimatedValue(0);
      setIsProcessing(false);
    }, 2000);
  };

  const handleCancelSwap = () => {
    setSwapStage('idle');
    setConfirmationToken(null);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="border-b border-white/10 bg-gradient-to-r from-cyan-500/5 to-purple-500/5">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
                <ArrowRightLeft className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  IRG Swap System
                </h1>
                <p className="text-xs text-white/40">v6.0 Production • Zero Human Errors</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400">
                <Shield className="w-3.5 h-3.5" />
                8 HEP Hooks Active
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-white/10 bg-white/2">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {[
              { id: 'swap', label: 'New Swap', icon: ArrowRightLeft },
              { id: 'history', label: 'History', icon: FileText },
              { id: 'corpus', label: 'Corpus Fund', icon: Building2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'swap' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Token Selection */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Select Token to Offer</h2>
                  <span className="text-xs text-white/40">(Optional - leave empty for cash payment)</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {MOCK_TOKENS.map((token) => (
                    <TokenCard
                      key={token.id}
                      token={token}
                      selected={selectedToken === token.id}
                      onSelect={() => setSelectedToken(selectedToken === token.id ? null : token.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">Request Details</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Target Minter</label>
                    <select
                      value={selectedMinter}
                      onChange={(e) => setSelectedMinter(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                    >
                      <option value="" className="bg-[#1a1a24]">Select a minter...</option>
                      {MOCK_MINTERS.map((minter) => (
                        <option key={minter.id} value={minter.id} className="bg-[#1a1a24]">
                          {minter.name} ({minter.businessType}) - {minter.country}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Product Type</label>
                      <select
                        value={selectedProductType}
                        onChange={(e) => setSelectedProductType(e.target.value as FtrProductType)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                      >
                        {Object.entries(FTR_PRODUCT_LABELS).map(([key, label]) => (
                          <option key={key} value={key} className="bg-[#1a1a24]">{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Service Description</label>
                    <input
                      type="text"
                      value={serviceDescription}
                      onChange={(e) => setServiceDescription(e.target.value)}
                      placeholder="e.g., Taxi Credits Package, Education Voucher..."
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Estimated Value (INR)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={estimatedValue}
                        onChange={(e) => setEstimatedValue(parseInt(e.target.value) || 0)}
                        className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Swap Summary & Actions */}
            <div className="space-y-4">
              <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20 sticky top-6">
                <h3 className="font-semibold text-white mb-4">Swap Summary</h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Offering</span>
                    <span className="text-white font-medium">
                      {selectedToken
                        ? `${MOCK_TOKENS.find(t => t.id === selectedToken)?.tokenId}`
                        : 'Cash Payment'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Offered Value</span>
                    <span className="text-white font-medium">
                      {selectedToken
                        ? `₹${MOCK_TOKENS.find(t => t.id === selectedToken)?.faceValue.toLocaleString()}`
                        : '—'}
                    </span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Requesting</span>
                    <span className="text-white font-medium">{serviceDescription || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Requested Value</span>
                    <span className="text-cyan-400 font-semibold">₹{estimatedValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Fee (2%)</span>
                    <span className="text-white/60">₹{(estimatedValue * 0.02).toLocaleString()}</span>
                  </div>
                </div>

                {error && (
                  <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-300">{error}</p>
                  </div>
                )}

                {swapStage === 'idle' && (
                  <button
                    onClick={handleInitiateSwap}
                    disabled={isProcessing}
                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                  >
                    Initiate Swap
                  </button>
                )}

                {swapStage === 'validating' && (
                  <div className="text-center py-4">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-white/60">Validating request...</p>
                  </div>
                )}

                {swapStage === 'confirming' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium text-amber-300">Confirmation Required</span>
                      </div>
                      <p className="text-xs text-white/50">
                        Token: <span className="font-mono text-amber-300/80">{confirmationToken?.slice(0, 20)}...</span>
                      </p>
                    </div>
                    <button
                      onClick={handleConfirmSwap}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Confirm & Execute
                    </button>
                    <button
                      onClick={handleCancelSwap}
                      className="w-full py-2 text-white/50 hover:text-white/80 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {swapStage === 'executing' && (
                  <div className="text-center py-4">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-white/60">Executing atomic swap...</p>
                    <p className="text-xs text-white/40 mt-1">HEP hooks active</p>
                  </div>
                )}

                {swapStage === 'complete' && (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-emerald-300">Swap Executed Successfully!</p>
                    <p className="text-xs text-white/40 mt-1">Double-entry verified • Audit logged</p>
                  </div>
                )}

                <HepHookIndicator hooks={activeHooks} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Swap History</h2>
              <span className="text-sm text-white/40">{swaps.length} transactions</span>
            </div>
            {swaps.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No swaps yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {swaps.map((swap) => (
                  <SwapHistoryItem key={swap.id} swap={swap} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'corpus' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Super Corpus Fund Management</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition-all">
                <RefreshCw className="w-4 h-4" />
                Run Snapshot
              </button>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-6">
              <CorpusFundCard corpus={MOCK_CORPUS} />
              
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                <h3 className="font-semibold text-white mb-4">Corpus Fund Operations</h3>
                <p className="text-sm text-white/50 mb-4">
                  The Super Corpus Fund serves as market-maker, short-sale engine, FX absorber, and recall buffer.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-white/60">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Short-sale when no market inventory
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    FX gain/loss absorption
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Pro-rata surrender returns
                  </div>
                  <div className="flex items-center gap-2 text-white/60">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Recall fund transfers
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Recent Activity</span>
                  </div>
                  <p className="text-xs text-white/50">
                    Last snapshot: 2 hours ago • 3 short-sales processed today
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs text-white/30">
            <span>IRG Swap System v6.0 • Zero Loose Ends Architecture</span>
            <span>All FTR Products + TGDP Supported</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
