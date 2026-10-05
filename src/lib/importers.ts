// ==============================================================================
// StarRuby.in Banking System — Universal Bulk Ingestion & Duplicate Scanner
// Supports: CSV, Google Sheets (Live URL & Paste), PDF Statement AI/OCR Extraction
// ==============================================================================

import { BankTransaction, UserTransaction, Party, Account } from '../types/database';
import { getDaysDifference } from './matching';
import { normalizeAlias } from './alias';

// ------------------------------------------------------------------------------
// 1. DATE & NUMBER NORMALIZATION HELPERS
// ------------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

/**
 * Normalizes almost any common date string format to 'YYYY-MM-DD'
 * Handles: 2026-09-28, 28/09/2026, 28-09-2026, 28-Sep-2026, 28 Sep 2026, 09/28/2026
 */
export function normalizeDateToISO(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();

  // 1. Check YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 2. Check DD-MMM-YYYY or DD MMM YYYY (e.g. 28-Sep-2026, 28-SEP-2026)
  const dMmmYMatch = str.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/);
  if (dMmmYMatch) {
    const [, d, monStr, yRaw] = dMmmYMatch;
    const m = MONTH_MAP[monStr.toLowerCase()];
    if (m) {
      const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // 3. Check DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    const [, p1, p2, yRaw] = dmyMatch;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const num1 = parseInt(p1, 10);
    const num2 = parseInt(p2, 10);

    // If p1 > 12, it must be DD-MM-YYYY
    if (num1 > 12) {
      return `${y}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
    }
    // Standard Indian / UK / Banking default: DD-MM-YYYY
    return `${y}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Parses cleaned positive decimal amount from currency strings (₹1,50,000.00 -> 150000)
 */
export function cleanCurrencyAmount(raw: any): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.abs(raw);

  const clean = String(raw)
    .replace(/[₹$€£\s]/g, '')
    .replace(/,/g, '')
    .trim();

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.abs(num);
}

// ------------------------------------------------------------------------------
// 2. CSV & TSV ROBUST QUOTED-DELIMITER PARSER
// ------------------------------------------------------------------------------

/**
 * Parses CSV or TSV text with full quote and comma/tab awareness
 */
export function parseDelimitedText(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect delimiter: tab or comma
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  const result: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let curVal = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          curVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(curVal.trim().replace(/^["']|["']$/g, ''));
        curVal = '';
      } else {
        curVal += char;
      }
    }
    row.push(curVal.trim().replace(/^["']|["']$/g, ''));
    result.push(row);
  }

  return result;
}

// ------------------------------------------------------------------------------
// 3. GOOGLE SHEETS LIVE URL TRANSLATOR
// ------------------------------------------------------------------------------

/**
 * Converts Google Sheets URL to a public CSV export URL
 */
export function convertGoogleSheetsUrlToCsvExport(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;

  const sheetId = match[1];
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Fetches CSV text directly from a Google Sheets URL
 */
export async function fetchGoogleSheetCsv(sheetUrl: string): Promise<string> {
  const exportUrl = convertGoogleSheetsUrlToCsvExport(sheetUrl);
  if (!exportUrl) {
    throw new Error('Invalid Google Sheets URL. URL must contain "/spreadsheets/d/{SHEET_ID}".');
  }

  try {
    const res = await fetch(exportUrl);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error('Google Sheet is private or restricted. In Google Sheets, click "Share" -> "Anyone with the link can view". Alternatively, copy the cells (Ctrl+C) and paste them directly!');
      }
      throw new Error(`Google Sheets fetch failed (${res.status})`);
    }
    return await res.text();
  } catch (err: any) {
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error('CORS or Network restriction on this Google Sheet. Please paste the copied cells directly in the box below!');
    }
    throw err;
  }
}

// ------------------------------------------------------------------------------
// 4. PDF STATEMENT TEXT EXTRACTION (pdfjs-dist)
// ------------------------------------------------------------------------------

export interface PdfExtractedLine {
  lineText: string;
  pageNumber: number;
}

/**
 * Reads a PDF statement file and extracts tabular lines page-by-page
 */
export async function extractLinesFromPdf(file: File): Promise<PdfExtractedLine[]> {
  const pdfjsModule = await import('pdfjs-dist');
  const pdfjsLib: any = (pdfjsModule as any).default || pdfjsModule;

  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
    } catch (e) {
      console.warn('PDF Worker setup note:', e);
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const extractedLines: PdfExtractedLine[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as any[];

    // Group items by horizontal row (Y coordinate)
    const lineBuckets = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of items) {
      if (!item.str || !item.transform) continue;
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);

      // Find nearby Y bucket within 4px
      let matchedY: number | null = null;
      for (const existingY of lineBuckets.keys()) {
        if (Math.abs(existingY - y) <= 4) {
          matchedY = existingY;
          break;
        }
      }

      if (matchedY === null) {
        lineBuckets.set(y, [{ x, text: item.str }]);
      } else {
        lineBuckets.get(matchedY)!.push({ x, text: item.str });
      }
    }

    // Sort rows from top of page to bottom (descending Y)
    const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a);

    for (const y of sortedYs) {
      const rowItems = lineBuckets.get(y)!;
      // Sort items within row from left to right (ascending X)
      rowItems.sort((a, b) => a.x - b.x);
      const combined = rowItems.map(i => i.text).join(' ').trim();
      if (combined.length > 0) {
        extractedLines.push({ lineText: combined, pageNumber: pageNum });
      }
    }
  }

  return extractedLines;
}

// ------------------------------------------------------------------------------
// 5. PARSED ROW INTERFACES & DUPLICATE SCANNERS
// ------------------------------------------------------------------------------

export interface ParsedBankRow {
  account_id: string;
  value_date: string;
  narration: string;
  party_name?: string;
  reference_no?: string;
  debit: number;
  credit: number;
  balance_after?: number;
  description?: string;
  valid: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
  error?: string;
  rawText?: string;
}

export interface ParsedUserRow {
  account_id: string;
  party_name: string;
  date: string;
  amount: number;
  amount_confirmed: 'Confirmed' | 'Unconfirmed';
  direction: 'Payment' | 'Receipt';
  exchange_rate?: number;
  description?: string;
  valid: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
  error?: string;
  rawText?: string;
}

/**
 * Live Duplicate Scanner (±7 Days) for Bank Statement Rows
 */
export function checkBankRowDuplicate(
  candidate: { account_id: string; value_date: string; debit: number; credit: number; narration?: string },
  existingTxns: BankTransaction[],
  priorBatch: ParsedBankRow[]
): { isDuplicate: boolean; reason?: string } {
  const isCandidateDebit = candidate.debit > 0;
  const candidateAmt = candidate.debit > 0 ? candidate.debit : candidate.credit;
  if (candidateAmt <= 0 || !candidate.value_date) return { isDuplicate: false };

  // 1. Check against existing bank transactions in database (±7 Days window)
  for (const b of existingTxns) {
    if (b.account_id !== candidate.account_id) continue;
    const isBDebit = b.debit > 0;
    if (isCandidateDebit !== isBDebit) continue;

    const bAmt = isBDebit ? b.debit : b.credit;
    if (Math.abs(bAmt - candidateAmt) <= 5) {
      const daysDiff = getDaysDifference(candidate.value_date, b.value_date);
      if (daysDiff <= 7) {
        return {
          isDuplicate: true,
          reason: `Potential duplicate of existing ${b.id} on ${b.value_date} (${isBDebit ? 'Debit' : 'Credit'} ${bAmt.toLocaleString()})`,
        };
      }
    }
  }

  // 2. Check against prior valid rows in this incoming batch
  for (let i = 0; i < priorBatch.length; i++) {
    const p = priorBatch[i];
    if (!p.valid) continue;
    if (p.account_id !== candidate.account_id) continue;
    const isPDebit = p.debit > 0;
    if (isCandidateDebit !== isPDebit) continue;

    const pAmt = isPDebit ? p.debit : p.credit;
    if (Math.abs(pAmt - candidateAmt) <= 0.01) {
      const daysDiff = getDaysDifference(candidate.value_date, p.value_date);
      if (daysDiff <= 7) {
        return {
          isDuplicate: true,
          reason: `Duplicate row in this file (Matches row ${i + 1} with ${pAmt.toLocaleString()} on ${p.value_date})`,
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Live Duplicate Scanner (±7 Days) for User Transaction Rows
 */
export function checkUserRowDuplicate(
  candidate: { account_id: string; date: string; amount: number; direction: string; party_name?: string },
  existingTxns: UserTransaction[],
  priorBatch: ParsedUserRow[],
  parties: Party[]
): { isDuplicate: boolean; reason?: string } {
  if (candidate.amount <= 0 || !candidate.date) return { isDuplicate: false };
  const candPartyNorm = candidate.party_name ? normalizeAlias(candidate.party_name) : '';

  // 1. Check against existing user transactions (±7 Days)
  for (const t of existingTxns) {
    if (t.account_id !== candidate.account_id) continue;
    if (t.direction !== candidate.direction) continue;

    const daysDiff = getDaysDifference(candidate.date, t.date_of_transaction);
    if (daysDiff > 7) continue;

    const amtMatch = Math.abs(t.amount - candidate.amount) <= 5;
    const existingParty = t.party_id ? parties.find(p => p.id === t.party_id) : undefined;
    const existingPartyName = existingParty?.system_name || existingParty?.party_name || t.party_name_raw || '';
    const partyMatch = candPartyNorm && normalizeAlias(existingPartyName).includes(candPartyNorm);

    if (amtMatch && (partyMatch || candPartyNorm.length === 0)) {
      return {
        isDuplicate: true,
        reason: `Potential duplicate of existing ${t.id} on ${t.date_of_transaction} (${t.direction} ${t.amount.toLocaleString()} to ${existingPartyName || 'Party'})`,
      };
    }
  }

  // 2. Check against prior valid rows in this batch
  for (let i = 0; i < priorBatch.length; i++) {
    const p = priorBatch[i];
    if (!p.valid) continue;
    if (p.account_id !== candidate.account_id) continue;
    if (p.direction !== candidate.direction) continue;

    const daysDiff = getDaysDifference(candidate.date, p.date);
    if (daysDiff <= 7 && Math.abs(p.amount - candidate.amount) <= 0.01) {
      return {
        isDuplicate: true,
        reason: `Duplicate row in this file (Matches row ${i + 1} with ${p.amount.toLocaleString()} on ${p.date})`,
      };
    }
  }

  return { isDuplicate: false };
}

// ------------------------------------------------------------------------------
// 6. BANK STATEMENT PARSERS (DELIMITED TABLE & PDF TEXT)
// ------------------------------------------------------------------------------

/**
 * Parses structured table rows into Bank Statement Transactions
 */
export function parseBankStatementDelimitedRows(
  rows: string[][],
  defaultAccountId: string,
  existingTxns: BankTransaction[],
  allowedAccounts: Account[]
): ParsedBankRow[] {
  if (rows.length < 2) return [];

  // Check header row for column indices
  const header = rows[0].map(c => c.toLowerCase().trim());
  let dateIdx = header.findIndex(c => c.includes('date') || c.includes('value'));
  let narrIdx = header.findIndex(c => c.includes('narration') || c.includes('particular') || c.includes('description'));
  let partyIdx = header.findIndex(c => c.includes('party') || c.includes('counterparty') || c.includes('beneficiary') || c.includes('remitter') || c.includes('vendor') || c.includes('client'));
  let refIdx = header.findIndex(c => c.includes('ref') || c.includes('chq') || c.includes('utr'));
  let debitIdx = header.findIndex(c => c.includes('debit') || c.includes('withdrawal') || c.includes('dr'));
  let creditIdx = header.findIndex(c => c.includes('credit') || c.includes('deposit') || c.includes('cr'));
  let amtIdx = header.findIndex(c => c === 'amount');
  let dirIdx = header.findIndex(c => c.includes('direction') || c.includes('type'));
  let balIdx = header.findIndex(c => c.includes('balance'));
  let accIdx = header.findIndex(c => c.includes('account'));

  // Default positional mappings if headers are non-standard
  if (dateIdx === -1) dateIdx = 1;
  if (narrIdx === -1) narrIdx = 2;

  const result: ParsedBankRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length < 2 || cols.every(c => !c.trim())) continue;

    const accId = (accIdx !== -1 && cols[accIdx]) ? cols[accIdx].trim() : defaultAccountId;
    const dateRaw = dateIdx !== -1 ? cols[dateIdx] : '';
    const isoDate = normalizeDateToISO(dateRaw);
    const narration = (narrIdx !== -1 && cols[narrIdx]) ? cols[narrIdx].trim() : 'Bank Transaction';
    const refNo = (refIdx !== -1 && cols[refIdx]) ? cols[refIdx].trim() : undefined;
    const balanceAfter = (balIdx !== -1 && cols[balIdx]) ? cleanCurrencyAmount(cols[balIdx]) : undefined;

    let rawParty = partyIdx !== -1 && cols[partyIdx] ? cols[partyIdx].trim() : undefined;
    // Smart fallback: Extract party hint from standard bank narration formats if no party column is present
    if (!rawParty && narration) {
      const dashParts = narration.split(/\s*-\s*|\s*–\s*/);
      if (dashParts.length >= 2) {
        const candidate = dashParts[1].trim();
        if (candidate.length > 2 && !candidate.startsWith('INV') && !candidate.startsWith('UTR') && !candidate.startsWith('CMS')) {
          rawParty = candidate;
        }
      }
    }

    let debit = 0;
    let credit = 0;

    if (debitIdx !== -1 || creditIdx !== -1) {
      if (debitIdx !== -1) debit = cleanCurrencyAmount(cols[debitIdx]);
      if (creditIdx !== -1) credit = cleanCurrencyAmount(cols[creditIdx]);
    } else if (amtIdx !== -1) {
      const amt = cleanCurrencyAmount(cols[amtIdx]);
      const dir = dirIdx !== -1 ? cols[dirIdx].toLowerCase() : 'payment';
      if (dir.includes('receipt') || dir.includes('credit') || dir.includes('cr') || dir.includes('deposit')) {
        credit = amt;
      } else {
        debit = amt;
      }
    }

    // Validation
    const isAccValid = allowedAccounts.some(a => a.id === accId);
    const isDateValid = Boolean(isoDate);
    const isAmtValid = (debit > 0 || credit > 0) && !(debit > 0 && credit > 0);
    const isNarrValid = narration.length > 0;

    let error = '';
    if (!isAccValid) error += `Invalid Account (${accId}); `;
    if (!isDateValid) error += `Unrecognized date format ("${dateRaw}"); `;
    if (!isAmtValid) error += `Amount must have either debit or credit > 0; `;
    if (!isNarrValid) error += `Narration missing; `;

    const valid = isAccValid && isDateValid && isAmtValid && isNarrValid;

    const parsedRow: ParsedBankRow = {
      account_id: accId,
      value_date: isoDate || dateRaw,
      narration,
      party_name: rawParty || undefined,
      reference_no: refNo,
      debit,
      credit,
      balance_after: balanceAfter,
      valid,
      error: error.trim() || undefined,
    };

    if (valid) {
      const dup = checkBankRowDuplicate(parsedRow, existingTxns, result);
      parsedRow.isDuplicate = dup.isDuplicate;
      parsedRow.duplicateReason = dup.reason;
    }

    result.push(parsedRow);
  }

  return result;
}

/**
 * Intelligent regex parser for PDF Bank Statements
 * Identifies lines containing date + narration + debit/credit/balance
 */
export function parseBankStatementPdfLines(
  lines: PdfExtractedLine[],
  defaultAccountId: string,
  existingTxns: BankTransaction[],
  allowedAccounts: Account[]
): ParsedBankRow[] {
  const result: ParsedBankRow[] = [];

  // Match dates in lines: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD-MMM-YYYY
  const dateRegex = /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.\s][A-Za-z]{3}[-/.\s]\d{2,4})\b/;

  for (const { lineText } of lines) {
    const dateMatch = lineText.match(dateRegex);
    if (!dateMatch) continue;

    const rawDate = dateMatch[0];
    const isoDate = normalizeDateToISO(rawDate);
    if (!isoDate) continue;

    // Remove the date from line to inspect remainder
    const lineWithoutDate = lineText.replace(rawDate, '').trim();

    // Look for decimal/comma numbers (e.g. 15,000.00 or 3500.50)
    const numberMatches = lineWithoutDate.match(/\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})\b/g);
    if (!numberMatches || numberMatches.length === 0) continue;

    // Convert numbers to float
    const amounts = numberMatches.map(n => cleanCurrencyAmount(n)).filter(n => n > 0);
    if (amounts.length === 0) continue;

    // Extract text between date and amounts as Narration
    let narration = lineWithoutDate;
    for (const numStr of numberMatches) {
      narration = narration.replace(numStr, '');
    }
    narration = narration.replace(/[|;\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!narration || narration.length < 3) {
      narration = 'Bank Transaction';
    }

    // Determine Debit / Credit
    const isDr = /\b(dr|debit|withdrawal|chq|paid)\b/i.test(lineText);
    const isCr = /\b(cr|credit|deposit|received)\b/i.test(lineText);

    let debit = 0;
    let credit = 0;
    let balance: number | undefined = undefined;

    if (amounts.length >= 2) {
      // Typically [Txn Amount, Balance] or [Debit, Credit, Balance]
      if (amounts.length >= 3) {
        debit = amounts[0];
        credit = amounts[1];
        balance = amounts[2];
      } else {
        const txnAmt = amounts[0];
        balance = amounts[1];
        if (isCr && !isDr) credit = txnAmt;
        else debit = txnAmt;
      }
    } else {
      const txnAmt = amounts[0];
      if (isCr && !isDr) credit = txnAmt;
      else debit = txnAmt;
    }

    if (debit === 0 && credit === 0) continue;

    const isAccValid = allowedAccounts.some(a => a.id === defaultAccountId);
    const valid = isAccValid && (debit > 0 || credit > 0) && Boolean(isoDate);

    const parsedRow: ParsedBankRow = {
      account_id: defaultAccountId,
      value_date: isoDate,
      narration,
      debit,
      credit,
      balance_after: balance,
      valid,
      rawText: lineText,
      error: !valid ? 'Invalid statement line structure' : undefined,
    };

    if (valid) {
      const dup = checkBankRowDuplicate(parsedRow, existingTxns, result);
      parsedRow.isDuplicate = dup.isDuplicate;
      parsedRow.duplicateReason = dup.reason;
    }

    result.push(parsedRow);
  }

  return result;
}

// ------------------------------------------------------------------------------
// 7. USER TRANSACTIONS PARSERS (DELIMITED TABLE & PDF TEXT)
// ------------------------------------------------------------------------------

/**
 * Parses structured table rows into User Transactions
 */
export function parseUserDelimitedRows(
  rows: string[][],
  defaultAccountId: string,
  existingTxns: UserTransaction[],
  allowedAccounts: Account[],
  parties: Party[]
): ParsedUserRow[] {
  if (rows.length < 2) return [];

  const header = rows[0].map(c => c.toLowerCase().trim());
  let accIdx = header.findIndex(c => c.includes('account'));
  let partyIdx = header.findIndex(c => c.includes('party') || c.includes('vendor') || c.includes('client'));
  let dateIdx = header.findIndex(c => c.includes('date'));
  let amtIdx = header.findIndex(c => c.includes('amount') || c.includes('amt'));
  let confIdx = header.findIndex(c => c.includes('confirm') || c.includes('status'));
  let dirIdx = header.findIndex(c => c.includes('direction') || c.includes('type'));
  let rateIdx = header.findIndex(c => c.includes('rate') || c.includes('exchange'));
  let descIdx = header.findIndex(c => c.includes('desc') || c.includes('note') || c.includes('narration'));

  if (dateIdx === -1) dateIdx = 2;
  if (amtIdx === -1) amtIdx = 3;

  const result: ParsedUserRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length < 2 || cols.every(c => !c.trim())) continue;

    const accId = (accIdx !== -1 && cols[accIdx]) ? cols[accIdx].trim() : defaultAccountId;
    const partyName = (partyIdx !== -1 && cols[partyIdx]) ? cols[partyIdx].trim() : '';
    const dateRaw = dateIdx !== -1 ? cols[dateIdx] : '';
    const isoDate = normalizeDateToISO(dateRaw);
    const amount = amtIdx !== -1 ? cleanCurrencyAmount(cols[amtIdx]) : 0;

    let confirmedStr = (confIdx !== -1 && cols[confIdx]) ? cols[confIdx].trim() : 'Confirmed';
    let confirmed: 'Confirmed' | 'Unconfirmed' =
      confirmedStr.toLowerCase().startsWith('un') ? 'Unconfirmed' : 'Confirmed';

    let dirStr = (dirIdx !== -1 && cols[dirIdx]) ? cols[dirIdx].trim().toLowerCase() : 'payment';
    let direction: 'Payment' | 'Receipt' =
      (dirStr.includes('receipt') || dirStr.includes('credit') || dirStr.includes('cr') || dirStr.includes('deposit'))
        ? 'Receipt'
        : 'Payment';

    const exchangeRate = (rateIdx !== -1 && cols[rateIdx]) ? parseFloat(cols[rateIdx]) || undefined : undefined;
    const description = (descIdx !== -1 && cols[descIdx]) ? cols[descIdx].trim() : undefined;

    const isAccValid = allowedAccounts.some(a => a.id === accId);
    const isDateValid = Boolean(isoDate);
    const isAmtValid = amount > 0;

    let error = '';
    if (!isAccValid) error += `Invalid Account (${accId}); `;
    if (!isDateValid) error += `Unrecognized date format ("${dateRaw}"); `;
    if (!isAmtValid) error += `Amount must be > 0; `;

    const valid = isAccValid && isDateValid && isAmtValid;

    const parsedRow: ParsedUserRow = {
      account_id: accId,
      party_name: partyName,
      date: isoDate || dateRaw,
      amount,
      amount_confirmed: confirmed,
      direction,
      exchange_rate: exchangeRate,
      description,
      valid,
      error: error.trim() || undefined,
    };

    if (valid) {
      const dup = checkUserRowDuplicate(parsedRow, existingTxns, result, parties);
      parsedRow.isDuplicate = dup.isDuplicate;
      parsedRow.duplicateReason = dup.reason;
    }

    result.push(parsedRow);
  }

  return result;
}

/**
 * Intelligent regex parser for PDF User Invoices / Transaction lists
 */
export function parseUserPdfLines(
  lines: PdfExtractedLine[],
  defaultAccountId: string,
  existingTxns: UserTransaction[],
  allowedAccounts: Account[],
  parties: Party[]
): ParsedUserRow[] {
  const result: ParsedUserRow[] = [];
  const dateRegex = /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.\s][A-Za-z]{3}[-/.\s]\d{2,4})\b/;

  for (const { lineText } of lines) {
    const dateMatch = lineText.match(dateRegex);
    if (!dateMatch) continue;

    const rawDate = dateMatch[0];
    const isoDate = normalizeDateToISO(rawDate);
    if (!isoDate) continue;

    const lineWithoutDate = lineText.replace(rawDate, '').trim();
    const numberMatches = lineWithoutDate.match(/\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b/g);
    if (!numberMatches || numberMatches.length === 0) continue;

    const amounts = numberMatches.map(n => cleanCurrencyAmount(n)).filter(n => n > 0);
    if (amounts.length === 0) continue;

    const amount = amounts[0];

    // Remainder text contains party and notes
    let partyOrDesc = lineWithoutDate;
    for (const numStr of numberMatches) {
      partyOrDesc = partyOrDesc.replace(numStr, '');
    }
    partyOrDesc = partyOrDesc.replace(/[|;\t]/g, ' ').replace(/\s+/g, ' ').trim();

    const isReceipt = /\b(receipt|credit|cr|advance|received)\b/i.test(lineText);
    const direction: 'Payment' | 'Receipt' = isReceipt ? 'Receipt' : 'Payment';

    const isAccValid = allowedAccounts.some(a => a.id === defaultAccountId);
    const valid = isAccValid && amount > 0 && Boolean(isoDate);

    const parsedRow: ParsedUserRow = {
      account_id: defaultAccountId,
      party_name: partyOrDesc || 'General Treasury',
      date: isoDate,
      amount,
      amount_confirmed: 'Confirmed',
      direction,
      description: partyOrDesc,
      valid,
      rawText: lineText,
      error: !valid ? 'Invalid user transaction row structure' : undefined,
    };

    if (valid) {
      const dup = checkUserRowDuplicate(parsedRow, existingTxns, result, parties);
      parsedRow.isDuplicate = dup.isDuplicate;
      parsedRow.duplicateReason = dup.reason;
    }

    result.push(parsedRow);
  }

  return result;
}

// ------------------------------------------------------------------------------
// 8. SAMPLE CSV DOWNLOAD TEMPLATES
// ------------------------------------------------------------------------------

export function downloadSampleCsvTemplate(type: 'bank' | 'user') {
  let content = '';
  let filename = '';

  if (type === 'bank') {
    filename = 'StarRuby_Bank_Statement_Template.csv';
    content = [
      'Account_ID,Date,Party_Name,Narration,Reference_No,Debit,Credit,Balance_After,Description',
      'BNK1,2026-05-11,JS DIAMONDS LTD,Inward Remittance - JS DIAMONDS LTD - CO-OPERATIVE BANK PLC.,033IWCF261310540,0,32638,109420.24,Export proceeds invoice 104',
      'BNK1,2026-09-28,Bangkok Gems & Stones Co.,NEFT-CMS-Bangkok Gems & Stones-INV8821,UTR99281726,35000,0,1250000,Payment for sapphire rough lot',
      'BNK1,2026-09-29,Raw Gem Importer,RTGS-Raw Gem Importer-ADV401,UTR11029384,0,15000,1265000,Advance deposit for rubies',
      'BNK3,2026-09-30,Blue Ocean Trading LLC,WIRE TRANSFER-Blue Ocean Trading LLC,FT262719,82000,0,510000,Prepayment invoice 4092',
      'BNK2,2026-09-30,Self Clearing,CHQ WDL-Self Clearing 004128,CHQ004128,50000,0,890000,Operational cash withdrawal',
    ].join('\n');
  } else {
    filename = 'StarRuby_User_Transactions_Template.csv';
    content = [
      'Account_ID,Party_System_Name,Date,Amount,Confirmed_Status,Direction,Exchange_Rate,Description',
      'BNK1,Bangkok Gems & Stones Co.,2026-09-28,35000,Confirmed,Payment,1.0,Payment for sapphire rough lot',
      'BNK3,Blue Ocean Trading LLC,2026-09-29,82000,Unconfirmed,Payment,26.05,Prepayment invoice 4092',
      'BNK1,Raw Gem Importer,2026-09-30,15000,Confirmed,Receipt,1.0,Advance deposit for rubies',
      'BNK2,Gemological Institute of India,2026-09-30,12500,Confirmed,Payment,1.0,Certification and grading fees',
    ].join('\n');
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
