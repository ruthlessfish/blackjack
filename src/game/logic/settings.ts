import { DECK_OPTIONS, MIN_BET } from './constants';
import type { SavedTable, Settings } from './types';

/**
 * Coerce settings read back from storage into something the table can accept.
 * Storage can hold anything (old versions, hand edits, `NaN`), so each field
 * falls back to the live value rather than rejecting the whole record.
 */
export function sanitizeSettings(raw: unknown, current: Settings): Settings {
    const next = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;

    const decks = Number(next.decks);
    const bankroll = Math.floor(Number(next.startingBalance));

    return {
        decks: DECK_OPTIONS.includes(decks) ? decks : current.decks,
        startingBalance: Number.isFinite(bankroll) && bankroll >= MIN_BET ? bankroll : current.startingBalance,
    };
}

/** Same idea for a whole saved table; a balance that cannot cover a bet restarts from the starting bankroll. */
export function sanitizeSavedTable(raw: unknown, defaults: Settings): SavedTable {
    const settings = sanitizeSettings(raw, defaults);
    const balance = Math.floor(Number((raw as { balance?: unknown } | null)?.balance));
    return {
        ...settings,
        balance: Number.isFinite(balance) && balance >= MIN_BET ? balance : settings.startingBalance,
    };
}
