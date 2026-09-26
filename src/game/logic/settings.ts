import { BLACKJACK_PAYOUTS, DECK_OPTIONS, MIN_BET } from './constants';
import type { BlackjackPayout, SavedTable, Settings, TableRules, TableStats } from './types';

/** A shoe size the settings panel offers, or null for anything else. */
export function parseDecks(value: unknown): number | null {
    const decks = Number(value);
    return DECK_OPTIONS.includes(decks) ? decks : null;
}

/** A whole-dollar bankroll that can cover a bet, or null. */
export function parseBankroll(value: unknown): number | null {
    const bankroll = Math.floor(Number(value));
    return Number.isFinite(bankroll) && bankroll >= MIN_BET ? bankroll : null;
}

/** A whole, non-negative count; anything else is 0. */
export function parseCount(value: unknown): number {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

const isPayout = (value: unknown): value is BlackjackPayout =>
    Object.keys(BLACKJACK_PAYOUTS).includes(value as string);

const flag = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

/** Each rule is checked on its own, so one bad field falls back without losing the rest. */
export function sanitizeRules(raw: unknown, current: TableRules): TableRules {
    const next = (raw ?? {}) as Partial<Record<keyof TableRules, unknown>>;
    return {
        blackjackPays: isPayout(next.blackjackPays) ? next.blackjackPays : current.blackjackPays,
        dealerHitsSoft17: flag(next.dealerHitsSoft17, current.dealerHitsSoft17),
        doubleAfterSplit: flag(next.doubleAfterSplit, current.doubleAfterSplit),
        surrender: flag(next.surrender, current.surrender),
    };
}

/**
 * Coerce settings read back from storage into something the table can accept.
 * Storage can hold anything (old versions, hand edits, `NaN`), so each field
 * falls back to the live value rather than rejecting the whole record.
 */
export function sanitizeSettings(raw: unknown, current: Settings): Settings {
    const next = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;

    return {
        decks: parseDecks(next.decks) ?? current.decks,
        startingBalance: parseBankroll(next.startingBalance) ?? current.startingBalance,
        rules: sanitizeRules(next.rules, current.rules),
    };
}

/** Stats for a bankroll that has just begun. */
export function freshStats(balance: number): TableStats {
    return { rounds: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, biggestWin: 0, peakBalance: balance };
}

/** Saved stats, every field a whole count; the peak is never below the balance it is saved with. */
export function sanitizeStats(raw: unknown, balance: number): TableStats {
    const next = (raw ?? {}) as Partial<Record<keyof TableStats, unknown>>;
    return {
        rounds: parseCount(next.rounds),
        wins: parseCount(next.wins),
        losses: parseCount(next.losses),
        pushes: parseCount(next.pushes),
        blackjacks: parseCount(next.blackjacks),
        biggestWin: parseCount(next.biggestWin),
        peakBalance: Math.max(parseCount(next.peakBalance), balance),
    };
}

/** Same idea for a whole saved table; a balance that cannot cover a bet restarts from the starting bankroll. */
export function sanitizeSavedTable(raw: unknown, defaults: Settings): SavedTable {
    const settings = sanitizeSettings(raw, defaults);
    const record = raw as { balance?: unknown; stats?: unknown } | null;
    const balance = parseBankroll(record?.balance) ?? settings.startingBalance;
    return { ...settings, balance, stats: sanitizeStats(record?.stats, balance) };
}

/** The rules as one line of text, e.g. "Blackjack pays 6 to 5  ·  Dealer stands on all 17s  ·  …". */
export function rulesSummary(rules: TableRules): string {
    return [
        `Blackjack pays ${rules.blackjackPays === '3:2' ? '3 to 2' : '6 to 5'}`,
        rules.dealerHitsSoft17 ? 'Dealer hits soft 17' : 'Dealer stands on all 17s',
        rules.doubleAfterSplit ? 'Double after split' : 'No double after split',
        rules.surrender ? 'Late surrender' : 'No surrender',
    ].join('  ·  ');
}
