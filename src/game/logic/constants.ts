import type { Rank, Settings, Suit } from './types';

export const STARTING_BALANCE = 500;
export const BLACKJACK_PAYOUT = 1.2; // 6:5; a whole number for any bet that is a multiple of $5
export const MAX_HANDS = 4;
export const RESHUFFLE_FRACTION = 0.25; // reshuffle when fewer than this share of cards remain
export const SWEEP_DELAY_MS = 3000; // how long a settled round stays on the table
export const TRAINING_DECKS = 6;

/** Chip denominations on the table. */
export const CHIPS: readonly number[] = [5, 25, 100];

/** The smallest legal bet, and the balance below which the table is out of funds. */
export const MIN_BET = Math.min(...CHIPS);

/** Shoe sizes the settings panel offers; anything else is rejected. */
export const DECK_OPTIONS: readonly number[] = [1, 2, 4, 6, 8];

/** Starting bankrolls the settings panel offers (Phaser has no text input). */
export const BANKROLL_OPTIONS: readonly number[] = [100, 250, 500, 1000, 2500, 5000];

export const DEFAULT_SETTINGS: Settings = {
    decks: 6,
    startingBalance: STARTING_BALANCE,
};

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RED_SUITS = new Set<Suit>(['♥', '♦']);
