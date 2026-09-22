import { describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { ASK_RECHARGE_HANDS } from '@/game/logic/constants';
import { Shoe } from '@/game/logic/shoe';
import { TrainingSession } from '@/game/logic/TrainingSession';
import type { Rank } from '@/game/logic/types';

/** A shoe that deals the scripted ranks first, then falls back to a real shuffle. */
class ScriptedShoe extends Shoe {
    private readonly script: Card[];

    constructor(ranks: Rank[]) {
        super(6);
        this.script = ranks.map((r) => new Card(r, '♠'));
    }

    override draw(): Card {
        return this.script.shift() ?? super.draw();
    }
}

const FRESH = { handsSeen: 0, handsCorrect: 0, bestStreak: 0 };

/** Hard 16 against a dealer 10: the chart says hit. Cards come off player, player, up card, hole card. */
function hard16vs10(saved = FRESH): TrainingSession {
    return new TrainingSession(saved, new ScriptedShoe(['10', '6', '10', '7']));
}

describe('ask the dealer (training)', () => {
    it('reveals the Basic Strategy play', () => {
        const session = hard16vs10();
        expect(session.askDealer()).toBe(true);
        expect(session.view().dealerSays).toBe('hit');
    });

    it('ends the live streak and keeps the hand out of the stats', () => {
        const session = hard16vs10({ handsSeen: 10, handsCorrect: 8, bestStreak: 5 });
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
