// FinTrack — Data Layer
// Transactions are loaded dynamically when the user uploads their files.

// ═══════════════════════════════════════
// TRANSACTIONS DATA (loaded from uploaded files)
// ═══════════════════════════════════════

const TRANSACTIONS = [
];

// BANK INCOME — auto-detected from Bank Leumi + Fibi statements
const BANK_INCOME = [
];

const MONTHS_ORDER = ["ינואר 2026","פברואר 2026","מרץ 2026"];

// ── Account balances as of last statement date ──────────────
// UPDATE these values from your bank statements when you receive them
// Format: { name, balance, statementDate, accountNumber }
let STATEMENT_BALANCES = [
  { name:"בנק לאומי",    balance: 0,  statementDate:"08-03-2026", accountNumber:"",
    contactPhone:"*5522", contactEmail:"pniot@bll.co.il",
    contactNote:"ניתן גם לפנות דרך וואטסאפ 052-8435522 או צ'אט באתר leumi.co.il" },
  { name:"בנק פיבי",     balance: 0,  statementDate:"28-02-2026", accountNumber:"",
    contactPhone:"*3009 / 03-5138700", contactEmail:"support@fibi.co.il",
    contactNote:"פניות הציבור: fibi.co.il/private/general/about/publicinquiries/" },
];
// To update: call updateStatementBalance('בנק לאומי', 45000, '08-03-2026')