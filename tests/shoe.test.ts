import { describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { Shoe } from '@/game/logic/shoe';

describe('Shoe', () => {
    it('holds 52 cards a deck', () => {
        expect(new Shoe(1).remaining).toBe(52);
        expect(new Shoe(6).remaining).toBe(312);
    });

    it('leaves out cards still in play when it is rebuilt', () => {
        const shoe = new Shoe(1);
        shoe.reset([new Card('A', '♠'), new Card('K', '♥')]);
        expect(shoe.remaining).toBe(50);

        const drawn = Array.from({ length: 50 }, () => shoe.draw());
        expect(drawn.some((c) => c.rank === 'A' && c.suit === '♠')).toBe(false);
        expect(drawn.some((c) => c.rank === 'K' && c.suit === '♥')).toBe(false);
    });

    it('only removes one copy per card in play from a multi-deck shoe', () => {
        const shoe = new Shoe(2);
        shoe.reset([new Card('A', '♠')]);
        expect(shoe.remaining).toBe(103);
    });
});
