import { describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { Shoe } from '@/game/logic/shoe';

describe('Shoe', () => {
    it('holds 52 cards a deck, less the burn card', () => {
        expect(new Shoe(1).remaining).toBe(51);
        expect(new Shoe(1).total).toBe(52);
        expect(new Shoe(6).remaining).toBe(311);
    });

    it('burns a card again when an empty shoe is rebuilt', () => {
        const shoe = new Shoe(1);
        for (let i = 0; i < 51; i++) shoe.draw();
        expect(shoe.remaining).toBe(0);
        shoe.draw();
        expect(shoe.remaining).toBe(50);
    });

    it('leaves out cards still in play when it is rebuilt', () => {
        const shoe = new Shoe(1);
        shoe.reset([new Card('A', '♠'), new Card('K', '♥')]);
        expect(shoe.remaining).toBe(49);

        const drawn = Array.from({ length: 49 }, () => shoe.draw());
        expect(drawn.some((c) => c.rank === 'A' && c.suit === '♠')).toBe(false);
        expect(drawn.some((c) => c.rank === 'K' && c.suit === '♥')).toBe(false);
    });

    it('only removes one copy per card in play from a multi-deck shoe', () => {
        const shoe = new Shoe(2);
        shoe.reset([new Card('A', '♠')]);
        expect(shoe.remaining).toBe(102);
    });
});
