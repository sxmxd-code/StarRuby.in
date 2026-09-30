// ==============================================================================
// StarRuby.in Banking System — Unified Financial Formatters
// Standardizes dates to Google Sheets style: DD-MMM-YYYY (e.g. 15-MAR-2026)
// ==============================================================================

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Formats any ISO date or date string into DD-MMM-YYYY (e.g. 28-SEP-2026)
 * Avoids any confusion between month and day.
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '—';

  // Handle YYYY-MM-DD explicitly without timezone shifts
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = match[1];
    const monthIdx = parseInt(match[2], 10) - 1;
    const day = match[3];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day}-${MONTHS[monthIdx]}-${year}`;
    }
  }

  // Fallback for timestamps or other date formats
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return dateStr;
  }

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = MONTHS[parsed.getMonth()];
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats a timestamp into DD-MMM-YYYY HH:mm
 */
export function formatDisplayDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;

  const day = String(parsed.getDate()).padStart(2, '0');
  const month = MONTHS[parsed.getMonth()];
  const year = parsed.getFullYear();
  const hours = String(parsed.getHours()).padStart(2, '0');
  const mins = String(parsed.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${mins}`;
}

/**
 * Formats a currency amount with 2 decimal places and comma separators
 */
export function formatCurrencyAmount(amount: number, currency?: string): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}
