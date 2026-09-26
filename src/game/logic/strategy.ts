import { Card } from './card';
import { DEFAULT_RULES } from './constants';
import { Hand } from './hand';
import type { Action, TableRules } from './types';

/** Which moves are legal right now, so the chart can give the fallback play instead. */
export interface LegalMoves {
    double: boolean;
    split: boolean;
    surrender?: boolean;
}

/**
 * Multi-deck Basic Strategy for a table's rules (by default: dealer stands
 * on all 17s, double after split allowed, no surrender). `legal` says which
 * moves can be made right now, so the chart can give the fallback play
 * instead (e.g. a three-card soft 17 can no longer double: hit).
 */
export function basicStrategy(hand: Hand, upCard: Card, legal: LegalMoves, rules: TableRules = DEFAULT_RULES): Action {
    const up = upCard.value; // 2-10, ace = 11
    const h17 = rules.dealerHitsSoft17;

    if (legal.surrender && shouldSurrender(hand, up, h17, legal.split)) {
        return 'surrender';
    }
    if (hand.isPair && legal.split && shouldSplit(hand.cards[0].value, up, rules.doubleAfterSplit)) {
        return 'split';
    }
    return hand.isSoft
        ? softAction(hand.total, up, legal.double, h17)
        : hardAction(hand.total, up, legal.double, h17);
}

/** Late surrender. A pair of 8s that can be split is split, except against an Ace when the dealer hits soft 17. */
function shouldSurrender(hand: Hand, up: number, h17: boolean, canSplit: boolean): boolean {
    if (hand.isSoft) return false;
    if (hand.isPair && canSplit && hand.cards[0].value === 8) return h17 && up === 11;
    switch (hand.total) {
        case 17: return h17 && up === 11;
        case 16: return up >= 9;
        case 15: return up === 10 || (h17 && up === 11);
        default: return false;
    }
}

function shouldSplit(pair: number, up: number, das: boolean): boolean {
    switch (pair) {
        case 11: return true; // aces
        case 10: return false;
        case 9: return up <= 9 && up !== 7;
        case 8: return true;
        case 7: return up <= 7;
        case 6: return das ? up <= 6 : up >= 3 && up <= 6;
        case 5: return false; // play as a hard 10
        case 4: return das && (up === 5 || up === 6);
        default: return das ? up <= 7 : up >= 4 && up <= 7; // 2s and 3s
    }
}

function softAction(total: number, up: number, canDouble: boolean, h17: boolean): Action {
    if (total === 19 && h17 && up === 6) return canDouble ? 'double' : 'stand';
    if (total >= 19) return 'stand';
    if (total === 18) {
        if ((up >= 3 && up <= 6) || (h17 && up === 2)) return canDouble ? 'double' : 'stand';
        if (up <= 8) return 'stand'; // 2, 7, 8
        return 'hit'; // 9, 10, ace
    }
    if (total === 17) return up >= 3 && up <= 6 && canDouble ? 'double' : 'hit';
    if (total >= 15) return up >= 4 && up <= 6 && canDouble ? 'double' : 'hit'; // soft 15-16
    if (total >= 13) return up >= 5 && up <= 6 && canDouble ? 'double' : 'hit'; // soft 13-14
    return 'hit'; // soft 12, a pair of aces that cannot be split
}

function hardAction(total: number, up: number, canDouble: boolean, h17: boolean): Action {
    if (total >= 17) return 'stand';
    if (total >= 13) return up <= 6 ? 'stand' : 'hit';
    if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
    if (total === 11) return (up <= 10 || h17) && canDouble ? 'double' : 'hit';
    if (total === 10) return up <= 9 && canDouble ? 'double' : 'hit';
    if (total === 9) return up >= 3 && up <= 6 && canDouble ? 'double' : 'hit';
    return 'hit'; // 8 or less
}
