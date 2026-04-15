// ═══════════════════════════════════════════════════════════════════════════════
// IRG SWAP SYSTEM - HEP HOOKS (8 Hooks for Zero Human Errors)
// Implements: double-entry, confirmation, duplicate-guard, rate-limit,
//             debounce, validation, audit-log, rollback
// ═══════════════════════════════════════════════════════════════════════════════

import {
  ConfirmationOptions,
  RateLimitOptions,
  DuplicateGuardKey,
  SWAP_CONSTANTS,
} from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// 1. DOUBLE-ENTRY HOOK - Ensures every value change has matching debit/credit
// ─────────────────────────────────────────────────────────────────────────────────

interface DoubleEntryLedger {
  debits: Map<string, number>;
  credits: Map<string, number>;
}

class DoubleEntryHook {
  private ledger: DoubleEntryLedger = {
    debits: new Map(),
    credits: new Map(),
  };

  record(accountId: string, amount: number, type: 'debit' | 'credit'): void {
    const map = type === 'debit' ? this.ledger.debits : this.ledger.credits;
    const current = map.get(accountId) || 0;
    map.set(accountId, current + Math.abs(amount));
  }

  verify(): { balanced: boolean; discrepancy: number } {
    let totalDebits = 0;
    let totalCredits = 0;

    this.ledger.debits.forEach((v) => (totalDebits += v));
    this.ledger.credits.forEach((v) => (totalCredits += v));

    const discrepancy = Math.abs(totalDebits - totalCredits);
    const balanced = discrepancy < 0.01; // Allow tiny floating point variance

    return { balanced, discrepancy };
  }

  clear(): void {
    this.ledger.debits.clear();
    this.ledger.credits.clear();
  }

  getSnapshot(): DoubleEntryLedger {
    return {
      debits: new Map(this.ledger.debits),
      credits: new Map(this.ledger.credits),
    };
  }
}

export const useDoubleEntry = () => new DoubleEntryHook();

// ─────────────────────────────────────────────────────────────────────────────────
// 2. CONFIRMATION HOOK - Requires explicit user confirmation for critical actions
// ─────────────────────────────────────────────────────────────────────────────────

interface PendingConfirmation<T> {
  token: string;
  action: () => Promise<T>;
  expiresAt: number;
  confirmText: string;
}

class ConfirmationHook<T> {
  private pending: Map<string, PendingConfirmation<T>> = new Map();
  private options: ConfirmationOptions;

  constructor(options: ConfirmationOptions) {
    this.options = options;
  }

  generateToken(): string {
    return `confirm_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  requestConfirmation(action: () => Promise<T>): {
    token: string;
    confirmText: string;
    expiresIn: number;
  } {
    const token = this.generateToken();
    const expiresAt = Date.now() + this.options.timeout;

    this.pending.set(token, {
      token,
      action,
      expiresAt,
      confirmText: this.options.confirmText,
    });

    // Auto-cleanup expired confirmations
    setTimeout(() => this.pending.delete(token), this.options.timeout + 1000);

    return {
      token,
      confirmText: this.options.confirmText,
      expiresIn: this.options.timeout,
    };
  }

  async confirm(token: string): Promise<{ success: boolean; result?: T; error?: string }> {
    const pending = this.pending.get(token);

    if (!pending) {
      return { success: false, error: 'Invalid or expired confirmation token' };
    }

    if (Date.now() > pending.expiresAt) {
      this.pending.delete(token);
      return { success: false, error: 'Confirmation token has expired' };
    }

    try {
      const result = await pending.action();
      this.pending.delete(token);
      return { success: true, result };
    } catch (error) {
      this.pending.delete(token);
      return { success: false, error: error instanceof Error ? error.message : 'Action failed' };
    }
  }

  cancel(token: string): boolean {
    return this.pending.delete(token);
  }
}

export const useConfirmation = <T>(options: ConfirmationOptions) =>
  new ConfirmationHook<T>(options);

// ─────────────────────────────────────────────────────────────────────────────────
// 3. DUPLICATE-GUARD HOOK - Prevents double-submission of identical requests
// ─────────────────────────────────────────────────────────────────────────────────

class DuplicateGuardHook {
  private submissions: Map<string, number> = new Map();
  private ttl: number;

  constructor(ttlMs: number = SWAP_CONSTANTS.DUPLICATE_GUARD_TTL_MS) {
    this.ttl = ttlMs;
  }

  private generateKey(data: DuplicateGuardKey): string {
    return `${data.initiatorId}:${data.offeredTokenId || 'null'}:${data.requestedMinterId}`;
  }

  isDuplicate(data: Omit<DuplicateGuardKey, 'timestamp'>): boolean {
    const key = this.generateKey({ ...data, timestamp: Date.now() });
    const lastSubmission = this.submissions.get(key);

    if (lastSubmission && Date.now() - lastSubmission < this.ttl) {
      return true;
    }

    return false;
  }

  recordSubmission(data: Omit<DuplicateGuardKey, 'timestamp'>): void {
    const key = this.generateKey({ ...data, timestamp: Date.now() });
    this.submissions.set(key, Date.now());

    // Auto-cleanup after TTL
    setTimeout(() => this.submissions.delete(key), this.ttl + 1000);
  }

  clear(): void {
    this.submissions.clear();
  }
}

export const useDuplicateGuard = (ttlMs?: number) => new DuplicateGuardHook(ttlMs);

// ─────────────────────────────────────────────────────────────────────────────────
// 4. RATE-LIMIT HOOK - Prevents excessive API calls per user/action
// ─────────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class RateLimitHook {
  private limits: Map<string, RateLimitEntry> = new Map();
  private options: RateLimitOptions;

  constructor(options?: Partial<RateLimitOptions>) {
    this.options = {
      maxRequests: options?.maxRequests || SWAP_CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
      windowMs: options?.windowMs || SWAP_CONSTANTS.RATE_LIMIT_WINDOW_MS,
      keyPrefix: options?.keyPrefix || 'swap',
    };
  }

  checkLimit(userId: string): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
  } {
    const key = `${this.options.keyPrefix}:${userId}`;
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > this.options.windowMs) {
      // New window
      this.limits.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: this.options.maxRequests - 1,
        resetIn: this.options.windowMs,
      };
    }

    if (entry.count >= this.options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: this.options.windowMs - (now - entry.windowStart),
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.options.maxRequests - entry.count,
      resetIn: this.options.windowMs - (now - entry.windowStart),
    };
  }

  reset(userId: string): void {
    const key = `${this.options.keyPrefix}:${userId}`;
    this.limits.delete(key);
  }
}

export const useRateLimit = (options?: Partial<RateLimitOptions>) =>
  new RateLimitHook(options);

// ─────────────────────────────────────────────────────────────────────────────────
// 5. DEBOUNCE HOOK - Prevents rapid-fire actions (UI protection)
// ─────────────────────────────────────────────────────────────────────────────────

class DebounceHook {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private delayMs: number;

  constructor(delayMs: number = SWAP_CONSTANTS.DEBOUNCE_MS) {
    this.delayMs = delayMs;
  }

  async debounce<T>(key: string, action: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const existing = this.timers.get(key);
      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(async () => {
        this.timers.delete(key);
        try {
          const result = await action();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, this.delayMs);

      this.timers.set(key, timer);
    });
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}

export const useDebounce = (delayMs?: number) => new DebounceHook(delayMs);

// ─────────────────────────────────────────────────────────────────────────────────
// 6. VALIDATION HOOK - Comprehensive input validation for swap requests
// ─────────────────────────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class ValidationHook {
  validateSwapRequest(
    offeredTokenId: string | undefined,
    requestedMinterId: string,
    requestedService: {
      quantity: number;
      estimatedValue: number;
      productType: string;
    }
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!requestedMinterId || requestedMinterId.trim() === '') {
      errors.push('Requested minter ID is required');
    }

    // Quantity validation
    if (!requestedService.quantity || requestedService.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }

    if (requestedService.quantity > SWAP_CONSTANTS.MAX_BATCH_SIZE) {
      errors.push(`Quantity cannot exceed ${SWAP_CONSTANTS.MAX_BATCH_SIZE}`);
    }

    // Value validation
    if (requestedService.estimatedValue < SWAP_CONSTANTS.MIN_SWAP_VALUE) {
      errors.push(`Value must be at least ${SWAP_CONSTANTS.MIN_SWAP_VALUE}`);
    }

    if (requestedService.estimatedValue > SWAP_CONSTANTS.MAX_SWAP_VALUE) {
      errors.push(`Value cannot exceed ${SWAP_CONSTANTS.MAX_SWAP_VALUE}`);
    }

    // Product type validation
    const validProductTypes = [
      'TROT_REALTY', 'TAXI_FTR', 'AF_FTR', 'GIC', 'HOSP',
      'HEALTH', 'EDU', 'K_FTR', 'T_JR', 'TGDP'
    ];
    if (!validProductTypes.includes(requestedService.productType)) {
      errors.push(`Invalid product type: ${requestedService.productType}`);
    }

    // Warnings
    if (!offeredTokenId) {
      warnings.push('No token offered - cash payment may be required');
    }

    if (requestedService.estimatedValue > 100000) {
      warnings.push('High-value swap - additional verification may be required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateCorpusFundOperation(
    balance: number,
    requestedAmount: number,
    operation: 'short_sale' | 'withdrawal'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (requestedAmount <= 0) {
      errors.push('Amount must be positive');
    }

    if (operation === 'short_sale') {
      const threshold = balance * SWAP_CONSTANTS.SHORT_SALE_THRESHOLD;
      if (requestedAmount > threshold) {
        errors.push(`Short sale exceeds ${SWAP_CONSTANTS.SHORT_SALE_THRESHOLD * 100}% threshold`);
      }
    }

    if (operation === 'withdrawal' && requestedAmount > balance) {
      errors.push('Insufficient corpus fund balance');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

export const useValidation = () => new ValidationHook();

// ─────────────────────────────────────────────────────────────────────────────────
// 7. AUDIT-LOG HOOK - Records all actions for compliance and debugging
// ─────────────────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditLogHook {
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 10000;

  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
    };

    this.logs.push(fullEntry);

    // Prevent memory overflow
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs / 2);
    }

    // In production, this would write to database/external service
    console.log('[AUDIT]', JSON.stringify(fullEntry, null, 2));

    return fullEntry;
  }

  getLogsForResource(resourceType: string, resourceId: string): AuditLogEntry[] {
    return this.logs.filter(
      (log) => log.resourceType === resourceType && log.resourceId === resourceId
    );
  }

  getLogsForUser(userId: string, fromDate?: Date): AuditLogEntry[] {
    return this.logs.filter(
      (log) =>
        log.userId === userId &&
        (!fromDate || log.timestamp >= fromDate)
    );
  }
}

export const useAuditLog = () => new AuditLogHook();

// ─────────────────────────────────────────────────────────────────────────────────
// 8. ROLLBACK HOOK - Enables transaction rollback on failure
// ─────────────────────────────────────────────────────────────────────────────────

interface RollbackAction {
  id: string;
  description: string;
  execute: () => Promise<void>;
}

class RollbackHook {
  private actions: RollbackAction[] = [];

  registerRollback(description: string, rollbackFn: () => Promise<void>): string {
    const id = `rollback_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.actions.push({ id, description, execute: rollbackFn });
    return id;
  }

  async executeRollbacks(): Promise<{
    success: boolean;
    executed: string[];
    failed: { id: string; error: string }[];
  }> {
    const executed: string[] = [];
    const failed: { id: string; error: string }[] = [];

    // Execute in reverse order (LIFO)
    const reversedActions = [...this.actions].reverse();

    for (const action of reversedActions) {
      try {
        await action.execute();
        executed.push(action.id);
        console.log(`[ROLLBACK] Successfully executed: ${action.description}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ id: action.id, error: errorMsg });
        console.error(`[ROLLBACK] Failed: ${action.description} - ${errorMsg}`);
      }
    }

    this.clear();

    return {
      success: failed.length === 0,
      executed,
      failed,
    };
  }

  clear(): void {
    this.actions = [];
  }

  getRegisteredCount(): number {
    return this.actions.length;
  }
}

export const useRollback = () => new RollbackHook();

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED HEP CONTEXT - Use all 8 hooks together
// ─────────────────────────────────────────────────────────────────────────────────

export interface HepContext {
  doubleEntry: DoubleEntryHook;
  confirmation: ConfirmationHook<any>;
  duplicateGuard: DuplicateGuardHook;
  rateLimit: RateLimitHook;
  debounce: DebounceHook;
  validation: ValidationHook;
  auditLog: AuditLogHook;
  rollback: RollbackHook;
}

export const createHepContext = (
  confirmationOptions: ConfirmationOptions = {
    confirmText: 'Confirm Action',
    timeout: SWAP_CONSTANTS.CONFIRMATION_TIMEOUT_MS,
  }
): HepContext => ({
  doubleEntry: useDoubleEntry(),
  confirmation: useConfirmation(confirmationOptions),
  duplicateGuard: useDuplicateGuard(),
  rateLimit: useRateLimit(),
  debounce: useDebounce(),
  validation: useValidation(),
  auditLog: useAuditLog(),
  rollback: useRollback(),
});
