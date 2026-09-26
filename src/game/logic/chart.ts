import { Card } from './card';
import { MAX_CELL_WEIGHT, RANKS, SUITS } from './constants';
import type { Hand } from './hand';
import type { CellId, HandFilter, HandType, Rank } from './types';

/**
 * The Basic Strategy chart as a grid of cells: one row per player hand, one
 * column per dealer up card. Training deals, scores and remembers misses by
 * cell, and the HowToPlay charts are drawn from the same rows, so the buckets
 * are defined only here.
 */

/** Dealer up cards, as the chart columns name them. */
export const UP_IDS: readonly string[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

/**
 * Chart rows per hand type. Hard `8` is "8 or less" and hard `17` is "17 or more";
 * soft rows are the total (A,2 is soft 13); pair rows are the card (10 covers J, Q, K).
 */
export const CHART_ROWS: Record<HandType, readonly string[]> = {
    hard: ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17'],
    soft: ['13', '14', '15', '16', '17', '18', '19', '20'],
    pair: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'],
};

const HAND_TYPES: readonly HandType[] = ['hard', 'soft', 'pair'];

/** Every cell on the three charts. */
export const ALL_CELLS: readonly CellId[] = HAND_TYPES.flatMap((type) =>
    CHART_ROWS[type].flatMap((row) => UP_IDS.map((up) => `${type}:${row}:${up}`)),
);

const CELL_SET = new Set(ALL_CELLS);

export function isCellId(value: string): value is CellId {
    return CELL_SET.has(value);
}

/** Which chart a hand is read from: a pair first, then soft, then hard. */
export function handType(hand: Hand): HandType {
    if (hand.isPair) return 'pair';
    return hand.isSoft ? 'soft' : 'hard';
}

/** A card's column or pair-row name: `A`, or its value (so J, Q, K are `10`). */
const valueId = (card: Card): string => (card.isAce ? 'A' : `${card.value}`);

/** The chart cell a two-card hand falls in against this up card. */
export function chartCellId(hand: Hand, upCard: Card): CellId {
    const type = handType(hand);
    let row: string;
    if (type === 'pair') row = valueId(hand.cards[0]);
    else if (type === 'soft') row = `${hand.total}`;
    else row = `${Math.min(Math.max(hand.total, 8), 17)}`;
    return `${type}:${row}:${valueId(upCard)}`;
}

export function cellType(cell: CellId): HandType {
    return cell.split(':')[0] as HandType;
}

/** How a cell reads in a list: "Hard 16 vs 10", "Soft 18 vs 9", "Pair of 8s vs A". */
export function cellLabel(cell: CellId): string {
    const [type, row, up] = cell.split(':');
    let hand: string;
    if (type === 'pair') hand = row === 'A' ? 'Pair of Aces' : `Pair of ${row}s`;
    else if (type === 'soft') hand = `Soft ${row}`;
    else if (row === '8') hand = 'Hard 8 or less';
    else if (row === '17') hand = 'Hard 17 or more';
    else hand = `Hard ${row}`;
    return `${hand} vs ${up}`;
}

/** How much more often a cell is dealt for its outstanding misses. */
export function cellWeight(misses: number): number {
    return Math.min(1 + misses, MAX_CELL_WEIGHT);
}

/** A cell for the next hand: any cell the filter allows, missed cells weighted up. */
export function pickCell(filter: HandFilter, misses: Record<CellId, number>, random: () => number): CellId {
    const cells = filter === 'all' ? ALL_CELLS : ALL_CELLS.filter((c) => cellType(c) === filter);
    const weights = cells.map((c) => cellWeight(misses[c] ?? 0));
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cells.length; i++) {
        roll -= weights[i];
        if (roll < 0) return cells[i];
    }
    return cells[cells.length - 1];
}

/** The two hands a Training deal puts on the table. */
export interface DealtHand {
    player: Card[];
    dealer: Card[];
}

const TEN_RANKS: Rank[] = ['10', 'J', 'Q', 'K'];

function pick<T>(items: readonly T[], random: () => number): T {
    return items[Math.floor(random() * items.length)];
}

/** A card worth `value` (11 is an Ace; 10 is any ten-card) in a random suit. */
function cardOfValue(value: number, random: () => number): Card {
    const rank: Rank = value === 11 ? 'A' : value === 10 ? pick(TEN_RANKS, random) : (`${value}` as Rank);
    return new Card(rank, pick(SUITS, random));
}

const idValue = (id: string): number => (id === 'A' ? 11 : Number(id));

/** Two different ace-free values that make a hard total in the row's range (8 is 5-8, 17 is 17-19). */
function hardValues(row: number, random: () => number): [number, number] {
    const [lo, hi] = row === 8 ? [5, 8] : row === 17 ? [17, 19] : [row, row];
    const pairs: [number, number][] = [];
    for (let a = 2; a <= 10; a++) {
        for (let b = a + 1; b <= 10; b++) {
            if (a + b >= lo && a + b <= hi) pairs.push([a, b]);
        }
    }
    return pick(pairs, random);
}

/**
 * Cards that put the player in `cell`. Never a player natural, and never a
 * dealer natural the peek would catch, so every hand dealt has a decision.
 */
export function buildHand(cell: CellId, random: () => number): DealtHand {
    const [type, row, up] = cell.split(':');
    let values: [number, number];
    if (type === 'pair') values = [idValue(row), idValue(row)];
    else if (type === 'soft') values = [11, Number(row) - 11];
    else values = hardValues(Number(row), random);
    if (random() < 0.5) values.reverse();

    const upValue = idValue(up);
    // Anything but the card that would give a peeking dealer blackjack.
    const holeRanks = RANKS.filter((r) => {
        if (upValue === 11) return !TEN_RANKS.includes(r);
        if (upValue === 10) return r !== 'A';
        return true;
    });

    return {
        player: values.map((v) => cardOfValue(v, random)),
        dealer: [cardOfValue(upValue, random), new Card(pick(holeRanks, random), pick(SUITS, random))],
    };
}
