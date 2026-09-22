import { afterEach, describe, expect, it } from 'vitest';
import { Card } from '@/game/logic/card';
import { TIP_AMOUNT } from '@/game/logic/constants';
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
function table(script: Rank[], saved?: SavedTable, schedule?: Scheduler, random?: () => number): StandardGame {
    const game = new StandardGame(() => {}, { saved, shoe: new ScriptedShoe(script), schedule, random });
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

describe('ask the dealer (standard)', () => {
    /** Always right, or always wrong, whatever the dealer's accuracy. */
    const honest = () => 0;
    const liar = () => 0.99;

    /**
     * Hard 16 against a dealer 10 (the chart says hit), which draws a 2 to 18 and
     * stands on it to beat the dealer's 17.
     */
    const HIT_TO_WIN: Rank[] = ['10', '6', '10', '7', '2'];

    /** Ask, follow the advice to a hit, then stand on the 18 and win. */
    function followToWin(game: StandardGame): StandardGame {
        deal(game, 5);
        game.askDealer();
        expect(game.view().advice).toBe('hit');
        game.hit();
        game.stand();
        return game;
    }

    it('suggests the chart move when it is right', () => {
        const game = deal(table(HIT_TO_WIN, undefined, undefined, honest), 5);
        game.askDealer();
        expect(game.view().advice).toBe('hit');
        expect(game.view().message.text).toContain('hit');
    });

    it('suggests some other legal move when it is wrong', () => {
        const game = deal(table(HIT_TO_WIN, undefined, undefined, liar), 5);
        game.askDealer();
        expect(['stand', 'double']).toContain(game.view().advice);
    });

    it('can be asked once per decision', () => {
        const game = deal(table(HIT_TO_WIN, undefined, undefined, honest), 5);
        expect(game.view().can.ask).toBe('ok');
        game.askDealer();
        expect(game.view().can.ask).toBe('disabled');
        game.hit();
        expect(game.view().advice).toBeNull();
        expect(game.view().can.ask).toBe('ok');
    });

    it('is not offered outside play', () => {
        const game = table(HIT_TO_WIN);
        expect(game.view().can.ask).toBe('unavailable');
        game.askDealer();
        expect(game.view().advice).toBeNull();
    });

    it('asks for a tip after good advice is followed, and holds the sweep', () => {
        const clock = manualClock();
        const game = followToWin(table(HIT_TO_WIN, undefined, clock.schedule, honest));
        const v = game.view();
        expect(v.phase).toBe('tip');
        expect(v.can.tip).toBe('ok');
        expect(v.can.deal).toBe('unavailable');
        expect(v.balance).toBe(505);
        expect(clock.pending()).toBe(0);

        game.tipDealer();
        expect(game.view().phase).toBe('betting');
        expect(game.view().balance).toBe(505 - TIP_AMOUNT);
        expect(game.view().message.text).toContain('Thanks for the tip');
        expect(clock.pending()).toBe(1);
    });

    it('gets more accurate after a tip', () => {
        // A roll of 0.52 misses at the starting 50% but lands once a tip lifts it to 55%.
        let roll = 0;
        const game = followToWin(table([...HIT_TO_WIN, '10', '6', '10', '7'], undefined, undefined, () => roll));
        game.tipDealer();
        roll = 0.52;
        deal(game);
        game.askDealer();
        expect(game.view().advice).toBe('hit');
    });

    it('gets less accurate after a refusal', () => {
        // A roll of 0.47 lands at the starting 50% but misses once a refusal drops it to 45%.
        let roll = 0;
        const game = followToWin(table([...HIT_TO_WIN, '10', '6', '10', '7'], undefined, undefined, () => roll));
        game.declineTip();
        expect(game.view().phase).toBe('betting');
        expect(game.view().message.text).not.toContain('Tip');
        roll = 0.47;
        deal(game);
        game.askDealer();
        expect(game.view().advice).not.toBe('hit');
    });

    it('keeps accuracy between 0 and 100', () => {
        let roll = 0;
        const script: Rank[] = [];
        for (let i = 0; i < 12; i++) script.push(...HIT_TO_WIN);
        const game = table(script, undefined, undefined, () => roll);
        // Eleven tips would take it to 105%, but it tops out at 100%: a roll just under 1 still lands.
        for (let i = 0; i < 11; i++) {
            followToWin(game);
            game.tipDealer();
        }
        roll = 0.999;
        deal(game);
        game.askDealer();
        expect(game.view().advice).toBe('hit');
    });

    it('drops to never right after enough refusals', () => {
        let roll = 0;
        const script: Rank[] = [];
        for (let i = 0; i < 12; i++) script.push(...HIT_TO_WIN);
        const game = table(script, undefined, undefined, () => roll);
        // Ten refusals take 50% to 0%; asking at a roll of 0 then misses.
        for (let i = 0; i < 10; i++) {
            followToWin(game);
            game.declineTip();
        }
        deal(game);
        game.askDealer();
        expect(game.view().advice).not.toBe('hit');
        game.hit();
        game.stand();
        // Wrong advice followed: no tip is owed.
        expect(game.view().phase).toBe('betting');
    });

    it('owes no tip when correct advice is ignored', () => {
        const game = deal(table(HIT_TO_WIN, undefined, undefined, honest), 5);
        game.askDealer();
        game.stand();
        expect(game.view().phase).toBe('betting');
    });

    it('owes no tip when the balance cannot cover it', () => {
        // Good advice, but the hand still loses the last $5: the bankroll resets instead.
        const saved: SavedTable = { decks: 6, startingBalance: 100, balance: 5 };
        const game = deal(table(['10', '6', '10', '7', '10'], saved, undefined, honest), 5);
        game.askDealer();
        game.hit();
        expect(game.view().phase).toBe('betting');
        expect(game.view().balance).toBe(100);
    });

    it('resets the bankroll when the tip takes the last chip', () => {
        // A 17 pushes the dealer's 17, leaving $5: the tip empties the balance.
        const saved: SavedTable = { decks: 6, startingBalance: 100, balance: 5 };
        const game = deal(table(['10', '7', '10', '7'], saved, undefined, honest), 5);
        game.askDealer();
        expect(game.view().advice).toBe('stand');
        game.stand();
        expect(game.view().phase).toBe('tip');
        game.tipDealer();
        expect(game.view().balance).toBe(100);
        expect(game.view().message.text).toContain('Out of funds');
    });

    it('never saves the accuracy', () => {
        const game = followToWin(table(HIT_TO_WIN, undefined, undefined, honest));
        game.tipDealer();
        expect(Object.keys(game.snapshot()).sort()).toEqual(['balance', 'decks', 'startingBalance']);
    });
});
