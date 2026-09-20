import { DECK_OPTIONS, MIN_BET } from './constants';
import type { SavedTable, Settings } from './types';

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
    };
}

/** Same idea for a whole saved table; a balance that cannot cover a bet restarts from the starting bankroll. */
export function sanitizeSavedTable(raw: unknown, defaults: Settings): SavedTable {
    const settings = sanitizeSettings(raw, defaults);
    const balance = parseBankroll((raw as { balance?: unknown } | null)?.balance);
    return { ...settings, balance: balance ?? settings.startingBalance };
}
