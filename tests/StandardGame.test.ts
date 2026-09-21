import { afterEach, describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { Shoe } from '@/game/logic/shoe';
import { StandardGame } from '@/game/logic/StandardGame';
import type { Rank, SavedTable, Scheduler } from '@/game/logic/types';

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

const games: StandardGame[] = [];

/**
 * A table on a stacked shoe. Cards come off in deal order: player, player,
 * dealer up card, dealer hole card, then whatever the hand goes on to draw.
 */
function table(script: Rank[], saved?: SavedTable, schedule?: Scheduler): StandardGame {
    const game = new StandardGame(() => {}, { saved, shoe: new ScriptedShoe(script), schedule });
    games.push(game);
    return game;
}

/** A clock the test winds by hand: `fire()` runs whatever is still scheduled. */
function manualClock() {
    const jobs: { fn: () => void; live: boolean }[] = [];
    const schedule: Scheduler = (fn) => {
        const job = { fn, live: true };
        jobs.push(job);
        return () => {
            job.live = false;
        };
    };
    return {
        schedule,
        pending: () => jobs.filter((j) => j.live).length,
        fire: () => {
            for (const job of jobs.splice(0)) if (job.live) job.fn();
        },
    };
}

/** Bet with chips, deal, and hand back the game. */
function deal(game: StandardGame, ...chips: number[]): StandardGame {
    for (const chip of chips) game.addBet(chip);
    game.deal();
    return game;
}

afterEach(() => {
    for (const game of games.splice(0)) game.dispose();
});

describe('blackjack payout (6:5)', () => {
    it.each([
        [[5], 6],
        [[5, 5, 5], 18],
        [[25], 30],
        [[100], 120],
    ])('bet %j pays %i', (chips, win) => {
        const game = deal(table(['A', 'K', '9', '7']), ...chips);

        expect(game.view().balance).toBe(500 + win);
        expect(game.view().playerHands[0].blackjack).toBe(true);
        expect(game.view().message.text).toBe(`Blackjack! You won $${win}.`);
    });

    it('does not count a 21 made after a split as a blackjack', () => {
        // The first split ace draws a king for 21, but it pays 1:1 like any other win.
        const game = deal(table(['A', 'A', '9', '7', 'K', '5', '10']), 5);
        game.split();

        expect(game.view().balance).toBe(500 - 5 - 5 + 10 + 10);
        expect(game.view().playerHands.some((h) => h.blackjack)).toBe(false);
    });
});

describe('settlement', () => {
    it('pays 1:1 on a win and returns the stake on a push', () => {
        const win = deal(table(['10', '8', '10', '6', '10']), 5); // dealer 16 draws a ten and busts
        win.stand();
        expect(win.view().balance).toBe(505);

        const push = deal(table(['10', '8', '10', '8']), 5);
        push.stand();
        expect(push.view().balance).toBe(500);
    });

    it('doubling stakes a second bet and pays on both', () => {
        // 11 vs a dealer 16: the double draws a ten (21), the dealer draws a ten and busts.
        const game = deal(table(['6', '5', '6', '10', '10', '10']), 5);
        game.double();
        expect(game.view().balance).toBe(500 - 5 - 5 + 20);
    });

    it('splits into two hands that settle separately', () => {
        // Eights vs a dealer 17: the first hand draws to 18 and wins, the second to 17 and pushes.
        const game = deal(table(['8', '8', '10', '7', '10', '9']), 5);
        game.split();
        expect(game.view().playerHands).toHaveLength(2);
        game.stand();
        game.stand();

        expect(game.view().playerHands.map((h) => h.outcome)).toEqual(['win', 'push']);
        expect(game.view().balance).toBe(500 - 5 - 5 + 10 + 5);
    });

    it('gives split aces one card each and no further action', () => {
        const game = deal(table(['A', 'A', '9', '7', 'K', '5', '10']), 5);
        game.split();

        expect(game.view().phase).toBe('betting'); // settled with no player input
        expect(game.view().balance).toBe(510);
    });
});

describe('insurance', () => {
    it('is offered against an ace and pays 2:1 on a dealer blackjack', () => {
        const game = deal(table(['10', '9', 'A', 'K']), 5);
        expect(game.view().phase).toBe('insurance');

        game.takeInsurance(); // costs $2 on a $5 bet
        expect(game.view().balance).toBe(500 - 5 - 2 + 6);
    });

    it('loses the insurance stake when the dealer has no blackjack', () => {
        const game = deal(table(['10', '9', 'A', '6']), 5);
        game.takeInsurance();
        expect(game.view().phase).toBe('player');

        game.stand(); // 19 beats a soft 17
        expect(game.view().balance).toBe(500 - 5 - 2 + 10);
    });

    it('declining costs only the bet on a dealer blackjack', () => {
        const game = deal(table(['10', '9', 'A', 'K']), 5);
        game.declineInsurance();
        expect(game.view().balance).toBe(495);
    });
});

describe('bankroll', () => {
    it('keeps the result of the hand that broke the player, then resets', () => {
        const saved: SavedTable = { decks: 6, startingBalance: 100, balance: 5 };
        const game = deal(table(['10', '2', '10', '9'], saved), 5);
        game.stand(); // 12 loses to 19

        expect(game.view().balance).toBe(100);
        expect(game.view().message.text).toContain('You lost $5.');
        expect(game.view().message.text).toContain('Out of funds');
    });
});

describe('settings', () => {
    it('ignores a deck count the panel does not offer', () => {
        const game = table([]);
        game.applySettings({ decks: 0, startingBalance: 500 });
        expect(game.view().settings.decks).toBe(6);

        game.applySettings({ decks: 2, startingBalance: 500 });
        expect(game.view().settings.decks).toBe(2);
    });

    it('saves the live deck count and bankroll', () => {
        const game = table([]);
        game.applySettings({ decks: 2, startingBalance: 1000 });

        // A new bankroll also resets the balance to it.
        expect(game.snapshot()).toEqual({ decks: 2, startingBalance: 1000, balance: 1000 });
    });
});

describe('sweeping the settled round', () => {
    it('leaves the round up until the sweep fires, then clears the table', () => {
        const clock = manualClock();
        const game = deal(table(['10', '8', '10', '8'], undefined, clock.schedule), 5);
        game.stand();

        expect(game.view().playerHands).toHaveLength(1); // still there to read
        expect(clock.pending()).toBe(1);

        clock.fire();
        expect(game.view().playerHands).toHaveLength(0);
        expect(game.view().dealer).toHaveLength(0);
    });

    it('betting again sweeps at once and cancels the timer', () => {
        const clock = manualClock();
        const game = deal(table(['10', '8', '10', '8'], undefined, clock.schedule), 5);
        game.stand();

        game.addBet(5);
        expect(game.view().playerHands).toHaveLength(0);
        expect(clock.pending()).toBe(0);
    });

    it('drops the timer when the table is disposed', () => {
        const clock = manualClock();
        const game = deal(table(['10', '8', '10', '8'], undefined, clock.schedule), 5);
        game.stand();

        game.dispose();
        expect(clock.pending()).toBe(0);
    });
});

describe('what the table offers', () => {
    it('offers Deal and Clear only once a stake is down', () => {
        const game = table([]);
        expect(game.view().can).toMatchObject({ deal: 'disabled', clear: 'disabled', hit: 'unavailable' });

        game.addBet(5);
        expect(game.view().can).toMatchObject({ deal: 'ok', clear: 'ok' });
    });

    it('offers the play controls in a hand and hides the betting ones', () => {
        const game = deal(table(['10', '6', '10', '9']), 5);

        expect(game.view().can).toMatchObject({
            hit: 'ok',
            stand: 'ok',
            double: 'ok',
            split: 'unavailable',
            deal: 'unavailable',
            clear: 'unavailable',
            insurance: 'unavailable',
            settings: false,
        });
        expect(game.view().chips.every((c) => c.availability === 'unavailable')).toBe(true);
    });

    it('offers insurance, and nothing else, while it is being decided', () => {
        const game = deal(table(['10', '9', 'A', 'K']), 5);

        expect(game.view().can).toMatchObject({ insurance: 'ok', hit: 'unavailable', deal: 'unavailable' });
    });

    it('dims a double the bankroll cannot cover', () => {
        const saved: SavedTable = { decks: 6, startingBalance: 100, balance: 5 };
        const game = deal(table(['6', '5', '10', '9'], saved), 5);

        expect(game.view().can.double).toBe('disabled');
        game.double(); // a disabled play does nothing
        expect(game.view().playerHands[0].bet).toBe(5);
    });
});
