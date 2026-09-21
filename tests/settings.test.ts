import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/game/logic/constants';
import { parseBankroll, parseDecks, sanitizeSavedTable, sanitizeSettings } from '@/game/logic/settings';

describe('parseDecks', () => {
    it.each([
        [6, 6],
        ['4', 4],
        [3, null],
        [0, null],
        [NaN, null],
        [undefined, null],
        [null, null],
    ])('%j -> %j', (value, expected) => {
        expect(parseDecks(value)).toBe(expected);
    });
});

describe('parseBankroll', () => {
    it.each([
        [500, 500],
        [500.9, 500],
        ['250', 250],
        [5, 5],
        [4, null],
        [-100, null],
        [NaN, null],
        [Infinity, null],
        [undefined, null],
    ])('%j -> %j', (value, expected) => {
        expect(parseBankroll(value)).toBe(expected);
    });
});

describe('sanitizeSavedTable', () => {
    it('keeps a valid record', () => {
        const saved = { decks: 2, startingBalance: 1000, balance: 730 };
        expect(sanitizeSavedTable(saved, DEFAULT_SETTINGS)).toEqual(saved);
    });

    it.each([null, undefined, 'junk', 42, {}])('falls back to the defaults for %j', (raw) => {
        expect(sanitizeSavedTable(raw, DEFAULT_SETTINGS)).toEqual({
            ...DEFAULT_SETTINGS,
            balance: DEFAULT_SETTINGS.startingBalance,
        });
    });

    it('restarts from the starting bankroll when the balance cannot cover a bet', () => {
        const saved = sanitizeSavedTable({ decks: 4, startingBalance: 250, balance: 3 }, DEFAULT_SETTINGS);
        expect(saved).toEqual({ decks: 4, startingBalance: 250, balance: 250 });
    });

    it('replaces each bad field on its own', () => {
        expect(sanitizeSettings({ decks: 7, startingBalance: 1000 }, DEFAULT_SETTINGS)).toEqual({
            decks: DEFAULT_SETTINGS.decks,
            startingBalance: 1000,
        });
    });
});
