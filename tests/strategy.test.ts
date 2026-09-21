import { describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card.ts';
import { Hand } from '@/game/logic/hand.ts';
import { basicStrategy } from '@/game/logic/strategy.ts';
import type { Action, Rank } from '@/game/logic/types.ts';

const hand = (...ranks: Rank[]) => new Hand(ranks.map((r) => new Card(r, '♠')));

/** [player cards, dealer up card, expected play], with double and split both legal. */
const CHART: [Rank[], Rank, Action][] = [
    // Hard totals
    [['10', '7'], 'A', 'stand'],
    [['10', '6'], '6', 'stand'],
    [['10', '6'], '7', 'hit'],
    [['10', '6'], '10', 'hit'],
    [['10', '2'], '3', 'hit'],
    [['10', '2'], '4', 'stand'],
    [['10', '2'], '6', 'stand'],
    [['10', '2'], '7', 'hit'],
    [['6', '5'], '2', 'double'],
    [['6', '5'], '10', 'double'],
    [['6', '5'], 'A', 'hit'],
    [['6', '4'], '9', 'double'],
    [['6', '4'], '10', 'hit'],
    [['5', '4'], '2', 'hit'],
    [['5', '4'], '3', 'double'],
    [['5', '4'], '6', 'double'],
    [['5', '4'], '7', 'hit'],
    [['5', '3'], '6', 'hit'],
    // Soft totals
    [['A', '9'], '6', 'stand'],
    [['A', '8'], '6', 'stand'],
    [['A', '7'], '2', 'stand'],
    [['A', '7'], '3', 'double'],
    [['A', '7'], '6', 'double'],
    [['A', '7'], '7', 'stand'],
    [['A', '7'], '8', 'stand'],
    [['A', '7'], '9', 'hit'],
    [['A', '7'], 'A', 'hit'],
    [['A', '6'], '2', 'hit'],
    [['A', '6'], '3', 'double'],
    [['A', '6'], '7', 'hit'],
    [['A', '5'], '3', 'hit'],
    [['A', '5'], '4', 'double'],
    [['A', '4'], '4', 'double'],
    [['A', '4'], '7', 'hit'],
    [['A', '3'], '4', 'hit'],
    [['A', '3'], '5', 'double'],
    [['A', '2'], '6', 'double'],
    [['A', '2'], '7', 'hit'],
    // Pairs
    [['A', 'A'], '10', 'split'],
    [['8', '8'], '10', 'split'],
    [['8', '8'], 'A', 'split'],
    [['10', '10'], '6', 'stand'],
    [['K', 'Q'], '6', 'stand'],
    [['9', '9'], '6', 'split'],
    [['9', '9'], '7', 'stand'],
    [['9', '9'], '9', 'split'],
    [['9', '9'], '10', 'stand'],
    [['9', '9'], 'A', 'stand'],
    [['7', '7'], '7', 'split'],
    [['7', '7'], '8', 'hit'],
    [['6', '6'], '6', 'split'],
    [['6', '6'], '7', 'hit'],
    [['5', '5'], '9', 'double'],
    [['5', '5'], '10', 'hit'],
    [['4', '4'], '4', 'hit'],
    [['4', '4'], '5', 'split'],
    [['4', '4'], '6', 'split'],
    [['4', '4'], '7', 'hit'],
    [['3', '3'], '7', 'split'],
    [['3', '3'], '8', 'hit'],
    [['2', '2'], '2', 'split'],
    [['2', '2'], '8', 'hit'],
];

describe('basicStrategy', () => {
    it.each(CHART)('%j vs %s -> %s', (cards, up, expected) => {
        expect(basicStrategy(hand(...cards), new Card(up, '♠'), true, true)).toBe(expected);
    });

    it('falls back when doubling is not allowed', () => {
        // Soft 18 doubles against 5 when it can, otherwise stands.
        expect(basicStrategy(hand('A', '7'), new Card('5', '♠'), false, true)).toBe('stand');
        // A three-card soft 17 can no longer double, so it hits.
        expect(basicStrategy(hand('A', '2', '4'), new Card('5', '♠'), false, false)).toBe('hit');
        // Hard 11 hits when it cannot double.
        expect(basicStrategy(hand('6', '5'), new Card('6', '♠'), false, true)).toBe('hit');
    });

    it('plays a pair it cannot split as its total', () => {
        // A pair of aces is a soft 12, which hits.
        expect(basicStrategy(hand('A', 'A'), new Card('10', '♠'), true, false)).toBe('hit');
    });
});
