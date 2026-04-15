"""
TROT Edu — Platform-wide business rule constants.

Change these values to adjust platform behaviour without touching logic.
These must stay in sync with PLATFORM_CONFIG in public/index.html.
"""

# ── Business rules ────────────────────────────────────────────────────────────

ISSUANCE_CAP_PERCENT    = 6.0   # 600%  — max FTR/SU = annualIntake × this
SU_MERIT_MIN_PERCENT    = 0.70  # 70%   — min fraction of SUs to merit/needy students
EARMARKED_SEAT_PERCENT  = 0.55  # 55%   — seats earmarked for FTR/SU holders

# ── Auth ──────────────────────────────────────────────────────────────────────

PASSWORD_MIN_LENGTH = 12
OTP_LENGTH          = 6

# ── Firestore collection names ────────────────────────────────────────────────
# If you rename a collection, update it here — not scattered through views.

COL_USERS        = 'users'
COL_ISSUANCES    = 'issuances'
COL_HOLDINGS     = 'holdings'
COL_REDEMPTIONS  = 'redemptions'
COL_SPONSORSHIPS = 'sponsorships'
