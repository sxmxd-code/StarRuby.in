// ==============================================================================
// StarRuby.in Banking System — Matching & Duplicate Detection Logic
// ==============================================================================

import { UserTransaction, BankTransaction, Party, PendingTransaction } from '../types/database';
import { calculateTrigramSimilarity, normalizeAlias } from './alias';

export interface DuplicatePair<T> {
  id: string;
  itemA: T;
  itemB: T;
  daysDiff: number;
  amountDiff: number;
  partyMatchScore: number;
}

/**
 * Calculates absolute day difference between two date strings (YYYY-MM-DD)
 */
export function getDaysDifference(dateStrA: string, dateStrB: string): number {
  const dateA = new Date(dateStrA).getTime();
  const dateB = new Date(dateStrB).getTime();
  const diffTime = Math.abs(dateA - dateB);
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Detects duplicates in User Transactions:
 * - Date within ± 3 days
 * - Same party (or normalized similarity >= 0.7)
 * - Amount within ± 5 in account currency
 */
export function detectUserDuplicates(
  transactions: UserTransaction[],
  partiesMap: Map<string, Party>,
  daysTolerance = 3,
  amountTolerance = 5
): DuplicatePair<UserTransaction>[] {
  const pairs: DuplicatePair<UserTransaction>[] = [];

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i];
      const b = transactions[j];

      // Same account & direction required
      if (a.account_id !== b.account_id || a.direction !== b.direction) continue;

      const daysDiff = getDaysDifference(a.date_of_transaction, b.date_of_transaction);
      if (daysDiff > daysTolerance) continue;

      const amountDiff = Math.abs(a.amount - b.amount);
      if (amountDiff > amountTolerance) continue;

      // Party match: resolve system names if available
      const partyA = a.party_id ? partiesMap.get(a.party_id)?.system_name || a.party_name_raw : a.party_name_raw;
      const partyB = b.party_id ? partiesMap.get(b.party_id)?.system_name || b.party_name_raw : b.party_name_raw;

      const partyScore = calculateTrigramSimilarity(partyA, partyB);
      const isExactParty = normalizeAlias(partyA) === normalizeAlias(partyB) || (a.party_id && a.party_id === b.party_id);

      if (isExactParty || partyScore >= 0.6) {
        pairs.push({
          id: `${a.id}_${b.id}`,
          itemA: a,
          itemB: b,
          daysDiff,
          amountDiff,
          partyMatchScore: partyScore,
        });
      }
    }
  }

  return pairs;
}

/**
 * Detects duplicates in Bank Statement entries:
 * - Same account
 * - Date within ± 3 days
 * - Amount within ± 5
 * - Narration similarity >= 0.6
 */
export function detectBankDuplicates(
  transactions: BankTransaction[],
  daysTolerance = 3,
  amountTolerance = 5
): DuplicatePair<BankTransaction>[] {
  const pairs: DuplicatePair<BankTransaction>[] = [];

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i];
      const b = transactions[j];

      if (a.account_id !== b.account_id) continue;

      const daysDiff = getDaysDifference(a.value_date, b.value_date);
      if (daysDiff > daysTolerance) continue;

      const aAmount = a.debit > 0 ? a.debit : a.credit;
      const bAmount = b.debit > 0 ? b.debit : b.credit;
      const aIsDebit = a.debit > 0;
      const bIsDebit = b.debit > 0;

      if (aIsDebit !== bIsDebit) continue;

      const amountDiff = Math.abs(aAmount - bAmount);
      if (amountDiff > amountTolerance) continue;

      const narrationScore = calculateTrigramSimilarity(a.narration, b.narration);
      if (narrationScore >= 0.6) {
        pairs.push({
          id: `${a.id}_${b.id}`,
          itemA: a,
          itemB: b,
          daysDiff,
          amountDiff,
          partyMatchScore: narrationScore,
        });
      }
    }
  }

  return pairs;
}

/**
 * Finds matching candidates in Bank Statements for a selected User Transaction:
 * Window: ± 7 days
 * Confidence formula: (0.6 * Party/Narration Similarity) + (0.4 * Amount Proximity)
 */
export interface MatchCandidate {
  bankTxn: BankTransaction;
  confidenceScore: number; // 0% to 100%
  partyScore: number;
  amountScore: number;
  reasons: string[];
}

export function getMatchCandidatesForUserTxn(
  userTxn: UserTransaction,
  bankTxns: BankTransaction[],
  partySystemName: string = '',
  windowDays = 7,
  partyWeight = 0.6
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const amountWeight = 1 - partyWeight;

  for (const b of bankTxns) {
    if (b.account_id !== userTxn.account_id) continue;

    const daysDiff = getDaysDifference(userTxn.date_of_transaction, b.value_date);
    if (daysDiff > windowDays) continue;

    // Direction check: Payment = debit > 0; Receipt = credit > 0
    const bAmount = userTxn.direction === 'Payment' ? b.debit : b.credit;
    if (bAmount <= 0) continue;

    // Amount Proximity Score
    const diff = Math.abs(userTxn.amount - bAmount);
    let amountScore = 0;
    const reasons: string[] = [];

    if (diff === 0) {
      amountScore = 1.0;
      reasons.push('Exact amount match');
    } else if (diff <= 5) {
      amountScore = 0.95;
      reasons.push(`Amount within ±${diff.toFixed(2)}`);
    } else if (diff / userTxn.amount <= 0.05) {
      amountScore = 0.8;
      reasons.push('Amount within 5% variance');
    } else {
      amountScore = Math.max(0, 1 - diff / userTxn.amount);
    }

    // Party similarity: compare party system name or raw typed name with bank narration
    const targetPartyName = partySystemName || userTxn.party_name_raw;
    const partyScore = calculateTrigramSimilarity(targetPartyName, b.narration);

    if (partyScore >= 0.7) {
      reasons.push(`High party match (${Math.round(partyScore * 100)}%)`);
    } else if (partyScore >= 0.4) {
      reasons.push(`Partial party name match (${Math.round(partyScore * 100)}%)`);
    }

    // Reference number check (e.g. description contains reference)
    if (b.reference_no && userTxn.description?.toLowerCase().includes(b.reference_no.toLowerCase())) {
      reasons.push(`Reference #${b.reference_no} found in description`);
    }

    const confidenceScore = Number((partyWeight * partyScore + amountWeight * amountScore).toFixed(3));

    candidates.push({
      bankTxn: b,
      confidenceScore: Math.round(confidenceScore * 100),
      partyScore,
      amountScore,
      reasons,
    });
  }

  // Sort descending by confidence score
  return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Checks Pending Queue for auto-suggestions:
 * When user transaction has same amount (within 7 days)
 */
export function findPendingQueueMatches(
  userTxn: UserTransaction,
  pendingList: PendingTransaction[],
  windowDays = 7
): PendingTransaction[] {
  return pendingList.filter(p => {
    if (p.status !== 'pending') return false;
    if (p.account_id !== userTxn.account_id) return false;
    if (p.direction !== userTxn.direction) return false;

    // Amount match
    if (Math.abs(p.amount - userTxn.amount) > 0.01) return false;

    // Date window
    const daysDiff = getDaysDifference(userTxn.date_of_transaction, p.expected_date);
    return daysDiff <= windowDays;
  });
}
