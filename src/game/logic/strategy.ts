import { Card } from './card';
import { Hand } from './hand';
import type { Action } from './types';

/**
 * Multi-deck Basic Strategy for this table's rules: dealer stands on all
 * 17s, double after split allowed, no surrender. `canDouble`/`canSplit`
 * say which moves are legal right now, so the chart can give the fallback
 * play instead (e.g. a three-card soft 17 can no longer double: hit).
 */
export function basicStrategy(hand: Hand, upCard: Card, canDouble: boolean, canSplit: boolean): Action {
    const up = upCard.value; // 2-10, ace = 11

    if (hand.isPair && canSplit && shouldSplit(hand.cards[0].value, up)) {
        return 'split';
    }
    return hand.isSoft ? softAction(hand.total, up, canDouble) : hardAction(hand.total, up, canDouble);
}

function shouldSplit(pair: number, up: number): boolean {
    switch (pair) {
        case 11: return true; // aces
        case 10: return false;
        case 9: return up <= 9 && up !== 7;
        case 8: return true;
        case 7: return up <= 7;
        case 6: return up <= 6;
        case 5: return false; // play as a hard 10
        case 4: return up === 5 || up === 6;
        default: return up <= 7; // 2s and 3s (double after split allowed)
    }
}

function softAction(total: number, up: number, canDouble: boolean): Action {
    if (total >= 19) return 'stand';
    if (total === 18) {
        if (up >= 3 && up <= 6) return canDouble ? 'double' : 'stand';
        if (up <= 8) return 'stand'; // 2, 7, 8
        return 'hit'; // 9, 10, ace
    }
    if (total === 17) return up >= 3 && up <= 6 && canDouble ? 'double' : 'hit';
    if (total >= 15) return up >= 4 && up <= 6 && canDouble ? 'double' : 'hit'; // soft 15-16
    if (total >= 13) return up >= 5 && up <= 6 && canDouble ? 'double' : 'hit'; // soft 13-14
    return 'hit'; // soft 12, a pair of aces that cannot be split
}

function hardAction(total: number, up: number, canDouble: boolean): Action {
    if (total >= 17) return 'stand';
    if (total >= 13) return up <= 6 ? 'stand' : 'hit';
    if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
    if (total === 11) return up <= 10 && canDouble ? 'double' : 'hit';
    if (total === 10) return up <= 9 && canDouble ? 'double' : 'hit';
    if (total === 9) return up >= 3 && up <= 6 && canDouble ? 'double' : 'hit';
    return 'hit'; // 8 or less
}
