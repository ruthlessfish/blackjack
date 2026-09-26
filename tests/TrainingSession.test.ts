import { describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { ALL_CELLS, buildHand, cellType, chartCellId, pickCell, type DealtHand } from '@/game/logic/chart';
import { ASK_RECHARGE_HANDS } from '@/game/logic/constants';
import { Hand } from '@/game/logic/hand';
import { TrainingSession } from '@/game/logic/TrainingSession';
import type { Rank, SavedTraining } from '@/game/logic/types';

const FRESH: SavedTraining = { handsSeen: 0, handsCorrect: 0, bestStreak: 0, filter: 'all', misses: {} };

/** A deal of exact cards: the player's two, then the dealer's up card and hole card. */
function cards(player: [Rank, Rank], dealer: [Rank, Rank]): DealtHand {
    const make = (r: Rank) => new Card(r, '♠');
    return { player: player.map(make), dealer: dealer.map(make) };
}

/** Deals each scripted hand in turn, repeating the last one once the script runs out. */
function scripted(...hands: DealtHand[]): () => DealtHand {
    let i = 0;
    return () => hands[Math.min(i++, hands.length - 1)];
}

/** Hard 16 against a dealer 10: the chart says hit. */
const HARD_16_VS_10 = cards(['10', '6'], ['10', '7']);

function hard16vs10(saved = FRESH): TrainingSession {
    return new TrainingSession(saved, { dealHand: scripted(HARD_16_VS_10) });
}

/** A small seeded PRNG (mulberry32), so random dealing is repeatable. */
function seeded(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('ask the dealer (training)', () => {
    it('reveals the Basic Strategy play', () => {
        const session = hard16vs10();
        expect(session.askDealer()).toBe(true);
        expect(session.view().dealerSays).toBe('hit');
    });

    it('ends the live streak and keeps the hand out of the stats', () => {
        const session = hard16vs10({ ...FRESH, handsSeen: 10, handsCorrect: 8, bestStreak: 5 });
        session.askDealer();
        expect(session.answer('hit')).toBe(true);

        const v = session.view();
        expect(v.feedback?.correct).toBe(true);
        expect(v.handsSeen).toBe(10);
        expect(v.handsCorrect).toBe(8);
        expect(v.streak).toBe(0);
        expect(v.bestStreak).toBe(5);
    });

    it('still marks a wrong pick wrong after asking', () => {
        const session = hard16vs10();
        session.askDealer();
        session.answer('stand');
        expect(session.view().feedback?.correct).toBe(false);
        expect(session.view().handsSeen).toBe(0);
    });

    it('resets a streak already in progress', () => {
        const session = hard16vs10();
        session.answer('hit');
        expect(session.view().streak).toBe(1);
        session.deal();
        session.askDealer();
        expect(session.view().streak).toBe(0);
    });

    it('can be asked only once per hand, and not after answering', () => {
        const session = hard16vs10();
        session.askDealer();
        expect(session.askDealer()).toBe(false);

        const other = hard16vs10();
        other.answer('hit');
        expect(other.askDealer()).toBe(false);
        expect(other.view().can.ask).toBe(false);
    });

    it(`recharges for the next ${ASK_RECHARGE_HANDS} hands`, () => {
        const session = hard16vs10();
        session.askDealer();
        expect(session.view().askRecharge).toBe(ASK_RECHARGE_HANDS);

        for (let i = 0; i < ASK_RECHARGE_HANDS; i++) {
            session.deal();
            expect(session.view().can.ask).toBe(false);
            expect(session.askDealer()).toBe(false);
        }
        session.deal();
        expect(session.view().askRecharge).toBe(0);
        expect(session.view().can.ask).toBe(true);
    });
});

describe('misses per chart cell', () => {
    it('records a wrong answer against its cell', () => {
        const session = hard16vs10();
        session.answer('stand');
        expect(session.snapshot().misses).toEqual({ 'hard:16:10': 1 });
    });

    it('takes a miss off for a correct answer, and drops the cell at 0', () => {
        const session = hard16vs10({ ...FRESH, misses: { 'hard:16:10': 2 } });
        session.answer('hit');
        expect(session.snapshot().misses).toEqual({ 'hard:16:10': 1 });
        session.deal();
        session.answer('hit');
        expect(session.snapshot().misses).toEqual({});
        session.deal();
        session.answer('hit');
        expect(session.snapshot().misses).toEqual({});
    });

    it('leaves the misses alone on a hand the dealer was asked about', () => {
        const session = hard16vs10();
        session.askDealer();
        session.answer('stand');
        expect(session.snapshot().misses).toEqual({});
    });

    it('clears the misses on a stats reset, but keeps the filter', () => {
        const session = hard16vs10({ ...FRESH, filter: 'hard', misses: { 'soft:18:9': 3 } });
        session.resetStats();
        expect(session.snapshot()).toEqual({ ...FRESH, filter: 'hard' });
    });

    it('does not share the saved misses object', () => {
        const saved = { ...FRESH, misses: {} };
        const session = hard16vs10(saved);
        session.answer('stand');
        expect(saved.misses).toEqual({});
        const snap = session.snapshot();
        snap.misses['hard:9:2'] = 5;
        expect(session.snapshot().misses).toEqual({ 'hard:16:10': 1 });
    });
});

describe('hand filter', () => {
    const PAIR_OF_8S = cards(['8', '8'], ['6', '9']);

    it('swaps an unanswered hand of another kind, without ticking the recharge', () => {
        const session = new TrainingSession(FRESH, { dealHand: scripted(HARD_16_VS_10, PAIR_OF_8S) });
        session.askDealer();
        expect(session.setFilter('pair')).toBe(true);
        const v = session.view();
        expect(v.filter).toBe('pair');
        expect(v.handLabel).toBe('Pair of 8s');
        expect(v.dealerSays).toBeNull();
        expect(v.askRecharge).toBe(ASK_RECHARGE_HANDS);
    });

    it('keeps a hand that already fits, or one already answered', () => {
        const fits = new TrainingSession(FRESH, { dealHand: scripted(HARD_16_VS_10, PAIR_OF_8S) });
        expect(fits.setFilter('hard')).toBe(false);
        expect(fits.view().handLabel).toBe('Hard 16');

        const answered = new TrainingSession(FRESH, { dealHand: scripted(HARD_16_VS_10, PAIR_OF_8S) });
        answered.answer('hit');
        answered.setFilter('pair');
        expect(answered.view().handLabel).toBe('Hard 16');
        expect(answered.view().feedback?.correct).toBe(true);
    });

    it('is saved with the stats', () => {
        const session = hard16vs10();
        session.setFilter('soft');
        expect(session.snapshot().filter).toBe('soft');
    });

    it.each(['hard', 'soft', 'pair'] as const)('deals only %s hands once set', (filter) => {
        const session = new TrainingSession({ ...FRESH, filter }, { random: seeded(7) });
        for (let i = 0; i < 50; i++) {
            const label = session.view().handLabel;
            expect(label.startsWith(filter === 'pair' ? 'Pair' : filter === 'soft' ? 'Soft' : 'Hard')).toBe(true);
            session.answer('stand');
            session.deal();
        }
    });
});

describe('building a hand for a chart cell', () => {
    it('lands in the cell asked for, with no natural on either side', () => {
        const random = seeded(42);
        for (const cell of ALL_CELLS) {
            for (let i = 0; i < 8; i++) {
                const { player, dealer } = buildHand(cell, random);
                const hand = new Hand(player);
                const dealerHand = new Hand(dealer);
                expect(chartCellId(hand, dealer[0])).toBe(cell);
                expect(hand.isBlackjack).toBe(false);
                if (dealer[0].isAce || dealer[0].value === 10) expect(dealerHand.isBlackjack).toBe(false);
            }
        }
    });

    it('covers every hard total in the open-ended rows', () => {
        const random = seeded(3);
        const totals = new Set<number>();
        for (let i = 0; i < 300; i++) {
            totals.add(new Hand(buildHand('hard:8:5', random).player).total);
            totals.add(new Hand(buildHand('hard:17:5', random).player).total);
        }
        expect([...totals].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 17, 18, 19]);
    });
});

describe('picking a chart cell', () => {
    it.each(['hard', 'soft', 'pair'] as const)('picks only %s cells under that filter', (filter) => {
        const random = seeded(11);
        for (let i = 0; i < 500; i++) expect(cellType(pickCell(filter, {}, random))).toBe(filter);
    });

    it('deals a missed cell up to three times as often', () => {
        const random = seeded(99);
        const misses = { 'soft:18:9': 5, 'soft:17:3': 1 };
        const counts: Record<string, number> = {};
        const picks = 60_000;
        for (let i = 0; i < picks; i++) {
            const cell = pickCell('soft', misses, random);
            counts[cell] = (counts[cell] ?? 0) + 1;
        }
        // 80 soft cells: 78 at weight 1, one at 2, one capped at 3, for a total weight of 83.
        const unit = picks / 83;
        expect(counts['soft:18:9'] / unit).toBeCloseTo(3, 0);
        expect(counts['soft:17:3'] / unit).toBeCloseTo(2, 0);
        expect(counts['soft:13:2'] / unit).toBeCloseTo(1, 0);
    });
});
