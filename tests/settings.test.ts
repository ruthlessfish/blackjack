import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, DEFAULT_SETTINGS } from '@/game/logic/constants';
import {
    freshStats,
    parseBankroll,
    parseDecks,
    rulesSummary,
    sanitizeRules,
    sanitizeSavedTable,
    sanitizeSettings,
    sanitizeStats,
    sanitizeTraining,
} from '@/game/logic/settings';

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
        const saved = {
            decks: 2,
            startingBalance: 1000,
            rules: { blackjackPays: '3:2', dealerHitsSoft17: true, doubleAfterSplit: false, surrender: true },
            balance: 730,
            stats: { rounds: 9, wins: 4, losses: 4, pushes: 1, blackjacks: 1, biggestWin: 60, peakBalance: 1100 },
        };
        expect(sanitizeSavedTable(saved, DEFAULT_SETTINGS)).toEqual(saved);
    });

    it.each([null, undefined, 'junk', 42, {}])('falls back to the defaults for %j', (raw) => {
        expect(sanitizeSavedTable(raw, DEFAULT_SETTINGS)).toEqual({
            ...DEFAULT_SETTINGS,
            balance: DEFAULT_SETTINGS.startingBalance,
            stats: freshStats(DEFAULT_SETTINGS.startingBalance),
        });
    });

    it('restarts from the starting bankroll when the balance cannot cover a bet', () => {
        const saved = sanitizeSavedTable({ decks: 4, startingBalance: 250, balance: 3 }, DEFAULT_SETTINGS);
        expect(saved).toEqual({ decks: 4, startingBalance: 250, rules: DEFAULT_RULES, balance: 250, stats: freshStats(250) });
    });

    it('replaces each bad field on its own', () => {
        expect(sanitizeSettings({ decks: 7, startingBalance: 1000 }, DEFAULT_SETTINGS)).toEqual({
            decks: DEFAULT_SETTINGS.decks,
            startingBalance: 1000,
            rules: DEFAULT_RULES,
        });
    });

    it('loads a save from before table rules and stats with the defaults', () => {
        const saved = sanitizeSavedTable({ decks: 2, startingBalance: 1000, balance: 730 }, DEFAULT_SETTINGS);
        expect(saved.rules).toEqual(DEFAULT_RULES);
        expect(saved.stats).toEqual(freshStats(730));
    });
});

describe('sanitizeRules', () => {
    it('replaces each bad rule on its own', () => {
        const raw = { blackjackPays: '2:1', dealerHitsSoft17: true, doubleAfterSplit: 'no', surrender: 1 };
        expect(sanitizeRules(raw, DEFAULT_RULES)).toEqual({ ...DEFAULT_RULES, dealerHitsSoft17: true });
    });

    it('keeps a valid payout', () => {
        expect(sanitizeRules({ blackjackPays: '3:2' }, DEFAULT_RULES).blackjackPays).toBe('3:2');
    });
});

describe('sanitizeStats', () => {
    it('makes every field a whole count, and keeps the peak at or above the balance', () => {
        const raw = { rounds: 4.7, wins: -2, losses: 'x', pushes: NaN, blackjacks: '1', biggestWin: 30, peakBalance: 100 };
        expect(sanitizeStats(raw, 400)).toEqual({
            rounds: 4,
            wins: 0,
            losses: 0,
            pushes: 0,
            blackjacks: 1,
            biggestWin: 30,
            peakBalance: 400,
        });
    });
});

describe('sanitizeTraining', () => {
    const FRESH = { handsSeen: 0, handsCorrect: 0, bestStreak: 0, filter: 'all', misses: {} };

    it('keeps a valid record', () => {
        const saved = {
            handsSeen: 40,
            handsCorrect: 31,
            bestStreak: 12,
            filter: 'soft',
            misses: { 'soft:18:9': 2, 'pair:A:10': 1, 'hard:8:5': 3 },
        };
        expect(sanitizeTraining(saved)).toEqual(saved);
    });

    it.each([null, undefined, 'junk', 42, {}, []])('falls back to a fresh record for %j', (raw) => {
        expect(sanitizeTraining(raw)).toEqual(FRESH);
    });

    it('loads a save from before the filter and misses', () => {
        expect(sanitizeTraining({ handsSeen: 9, handsCorrect: 7, bestStreak: 4 })).toEqual({
            ...FRESH,
            handsSeen: 9,
            handsCorrect: 7,
            bestStreak: 4,
        });
    });

    it('never has more correct answers than hands seen', () => {
        expect(sanitizeTraining({ handsSeen: 3, handsCorrect: 10 }).handsCorrect).toBe(3);
    });

    it.each(['pairs', 'Hard', 1, null])('turns an unknown filter %j into all', (filter) => {
        expect(sanitizeTraining({ filter }).filter).toBe('all');
    });

    it('keeps only real chart cells with a positive whole count', () => {
        const misses = {
            'hard:16:10': 2.8,
            'soft:21:5': 1,
            'hard:4:5': 1,
            'pair:J:3': 1,
            'soft:18:9': 0,
            'pair:8:A': -3,
            'hard:12:4': 'x',
            'hard:13:2': NaN,
            'pair:9:7': '2',
        };
        expect(sanitizeTraining({ misses }).misses).toEqual({ 'hard:16:10': 2, 'pair:9:7': 2 });
    });

    it('ignores misses that are not an object', () => {
        expect(sanitizeTraining({ misses: 'hard:16:10' }).misses).toEqual({});
    });
});

describe('rulesSummary', () => {
    it('describes the default table', () => {
        expect(rulesSummary(DEFAULT_RULES)).toBe(
            'Blackjack pays 6 to 5  ·  Dealer stands on all 17s  ·  Double after split  ·  No surrender',
        );
    });
});
