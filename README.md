# StarRuby.in — Banking & Treasury Management System (Production ERP)

A multi-entity corporate banking transaction governance, reconciliation, and treasury ERP built for **StarRuby.in** group companies (`StarRuby.in Private Limited`, `Star Ruby Gems DMCC`).

Developed to enforce immutable transaction records, 4-tier role permissions, 3-layer approvals with strict Admin exclusivity, cell-level version history, and zero-egress Cloudflare R2 document storage.

---

## Key Features & Inviolable Rules

1. **Rule 1: Never Mutate an Entry**: User and bank records are immutable once saved. Corrections occur strictly through status changes, linking/unlinking, and version history.
2. **Rule 2: Linking is a Link, Not an Edit**: `txn_bank_links` connects user transactions to supporting bank entries many-to-many without altering either entry.
3. **Rule 3: Every Change Has a History**: Every cell modification generates an audit row in `record_versions` with 1-click restore functionality.
4. **Rule 4: Bank Side is Strictly Supporting Data**: Transactions can be closed and approved through all 3 approval layers with `verified_with_bank = 'No'` and zero bank statement entries. Accounting is never blocked by bank statement delays.

---

## 3-Layer Approval Journey

```
[User Entry Saved: 'open']
         │
         ▼
[Layer 1: Closed in Match Tab] ───► status becomes 'in_approval'
         │                          (Accountant, Manager, or Admin)
         ▼
[Layer 2: 1st Admin Approval]  ───► status becomes 'approved (pending review)'
         │                          * READY FOR ACCOUNTING ENTRY *
         ▼                          (Approved by Harshil OR Vismay)
[Layer 3: 2nd Admin Review]    ───► status becomes 'approved (closed)'
                                    (MUST be the OTHER Admin)
```

---

## Modules Implemented

| Module | Purpose & Core Capabilities |
| :--- | :--- |
| **1. Masters & Setup** | Companies (`COM1`, `COM2`), Users, Roles & Company Scoping (`user_companies`), Bank Accounts (`BNK1`..`BNK4`), Signatories, Parties with clean System Names, Aliases & manual CID customer numbers. |
| **2. User Entry (Truth)** | Transaction entry form with live duplicate panel (± 7 days), party description templates with `use_count`, Confirmed/Unconfirmed amount toggle, optional INR exchange rate valuation, and batch CSV upload with validation preview. |
| **3. Bank Statements** | Supporting statement lines with verbatim narration, separate internal descriptions, debit/credit entries, and CSV upload. |
| **4. Duplicates Triage** | Automated detection of suspected duplicate pairs (± 3 days, same party, ± 5 amount) with side-by-side comparison and 1-click logged deletion or dismissal. |
| **5. Party Aliases** | Work queue for raw typed names (user-side only). Normalization, pg_trgm fuzzy suggestions with similarity %, Map to Party (retroactive update across all past transactions), Create New Party, and Ignore. |
| **6. Match & Reconcile** | Reconciliation interface: Candidate bank lines within ± 7 days ranked by confidence score formula $(0.6 \times \text{Party}) + (0.4 \times \text{Amount})$, multi-select linking, and Layer 1 Closing (with or without bank data). |
| **7. 3-Layer Approvals** | Layer 1 closed queue, Layer 2 1st Admin queue, Layer 3 final review queue enforcing strict Admin Exclusivity (Harshil and Vismay cannot approve both layers on the same transaction). |
| **8. Discrepancies** | Attention queue for unconfirmed amounts, unverified closed items (`verified_with_bank = No`), and unlinked bank entries. |
| **9. Pending Queue** | Anticipated money calendar (rent, salary, upcoming receipts) with auto-suggestions on matching amount entry and 1-click Map & Close. |
| **10. Statement Uploads** | Interactive monthly matrix (Accounts $\times$ Months), Red/Green indicators, direct Cloudflare R2 uploads, and historical file retention. |
| **11. Statement Ledger** | Read-only running balance report for physical cross-check against bank PDF/paper statements. |
| **12. Comments & Documents** | Transaction board chat, Cloudflare R2 file attachments, and simulated AI hybrid vector(1536) + FTS search. |
| **13. Version History** | Cell-level change audit log with 1-click value restore. |

---

## Tech Stack

* **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Canvas Confetti
* **Database**: Supabase PostgreSQL with 21 tables, triggers, sequences, and RLS policies
* **Object Storage**: Cloudflare R2 (S3-compatible API via `@aws-sdk/client-s3`)
* **Deployment**: Vercel ready (`vercel.json`)

---

## Getting Started

### 1. Database Setup (Supabase)
Run the migration script located at:
```
supabase/migrations/20260913000001_initial_schema.sql
```
in your Supabase SQL Editor. This initializes all 21 tables, custom ID generators (`COM1`, `UTRN101`, `BTRN101`, etc.), triggers, and initial seed data.

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase and Cloudflare R2 credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CLOUDFLARE_R2_ACCOUNT_ID=your-cloudflare-account-id
VITE_CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key-id
VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
VITE_CLOUDFLARE_R2_BUCKET_NAME=banking-docs-prod
```
*(Note: The system includes a built-in mock fallback engine, so you can test all features immediately in local development without waiting for cloud credentials).*

### 3. Running Locally
```bash
npm install
npm run dev
```

### 4. Building for Production & Vercel
```bash
npm run build
```
Deploy the folder directly to Vercel via Vercel CLI (`vercel`) or Git repository integration.
