import type { BlackjackPayout, Rank, Settings, Suit, TableRules } from './types';

export const STARTING_BALANCE = 500;
/** What a natural wins per dollar staked. 6:5 is a whole number on any multiple of $5; 3:2 rounds down. */
export const BLACKJACK_PAYOUTS: Record<BlackjackPayout, number> = { '3:2': 1.5, '6:5': 1.2 };
export const MAX_HANDS = 4;
export const RESHUFFLE_FRACTION = 0.25; // reshuffle when fewer than this share of cards remain
export const SWEEP_DELAY_MS = 3000; // how long a settled round stays on the table

/** A missed chart cell is dealt up to this many times as often as one with no misses (one step per miss). */
export const MAX_CELL_WEIGHT = 3;

/** Hands after asking the Training dealer before the button works again. */
export const ASK_RECHARGE_HANDS = 3;
/** What a Standard-mode tip costs, and how far each tip (or refusal) moves the dealer's accuracy. */
export const TIP_AMOUNT = 5;
export const DEALER_ACCURACY_START = 50; // percent, reset every time a table is created
export const DEALER_ACCURACY_STEP = 5;

/** Chip denominations on the table. */
export const CHIPS: readonly number[] = [5, 25, 100];

/** The smallest legal bet, and the balance below which the table is out of funds. */
export const MIN_BET = Math.min(...CHIPS);

/** Shoe sizes the settings panel offers; anything else is rejected. */
export const DECK_OPTIONS: readonly number[] = [1, 2, 4, 6, 8];

/** Starting bankrolls the settings panel offers (Phaser has no text input). */
export const BANKROLL_OPTIONS: readonly number[] = [100, 250, 500, 1000, 2500, 5000];

/** The house rules a new table starts with, and the only rules Training ever uses. */
export const DEFAULT_RULES: TableRules = {
    blackjackPays: '6:5',
    dealerHitsSoft17: false,
    doubleAfterSplit: true,
    surrender: false,
};

export const DEFAULT_SETTINGS: Settings = {
    decks: 6,
    startingBalance: STARTING_BALANCE,
    rules: DEFAULT_RULES,
};

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RED_SUITS = new Set<Suit>(['♥', '♦']);
