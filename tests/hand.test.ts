import { describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { Hand, PlayerHand } from '@/game/logic/hand';
import type { Rank } from '@/game/logic/types';

const cards = (...ranks: Rank[]) => ranks.map((r) => new Card(r, '♠'));

describe('Hand', () => {
    it.each([
        [['A', 'K'], 21, true],
        [['A', 'A'], 12, true],
        [['A', '5', 'K'], 16, false],
        [['A', '6'], 17, true],
        [['10', '6', '9'], 25, false],
    ] as [Rank[], number, boolean][])('%j totals %i (soft: %s)', (ranks, total, soft) => {
        const hand = new Hand(cards(...ranks));
        expect(hand.total).toBe(total);
        expect(hand.isSoft).toBe(soft);
    });

    it('is a blackjack only with two cards', () => {
        expect(new Hand(cards('A', 'K')).isBlackjack).toBe(true);
        expect(new Hand(cards('5', '6', '10')).isBlackjack).toBe(false);
    });

    it('busts over 21', () => {
        expect(new Hand(cards('10', '6', '9')).isBust).toBe(true);
        expect(new Hand(cards('10', '6', '5')).isBust).toBe(false);
    });

    it('counts any two ten-value cards as a pair', () => {
        expect(new Hand(cards('K', 'Q')).isPair).toBe(true);
        expect(new Hand(cards('8', '8')).isPair).toBe(true);
        expect(new Hand(cards('8', '9')).isPair).toBe(false);
        expect(new Hand(cards('8', '8', '8')).isPair).toBe(false);
    });
});

describe('PlayerHand', () => {
    it('carries its bet and starts unresolved and unsettled', () => {
        const hand = new PlayerHand(25, cards('9', '9'));
        expect(hand.bet).toBe(25);
        expect(hand.resolved).toBe(false);
        expect(hand.outcome).toBeUndefined();
    });

    it('doubles its bet, resolves and settles only through its methods', () => {
        const hand = new PlayerHand(25, cards('5', '6'));
        hand.doubleBet();
        hand.resolve();
        hand.settle('win');

        expect(hand.bet).toBe(50);
        expect(hand.resolved).toBe(true);
        expect(hand.outcome).toBe('win');
    });
});
