import { DEFAULT_SETTINGS } from './logic/constants';
import { sanitizeSavedTable } from './logic/settings';
import type { SavedTable, SavedTraining } from './logic/types';

const TRAINING_KEY = 'blackjack3.training';
const TABLE_KEY = 'blackjack3.table';

/**
 * localStorage can be missing, full, or blocked (private windows, embedded
 * previews), and it can hold anything a past version or a hand edit left in it.
 * Every read and write goes through here so the game never depends on it.
 */
function read(key: string): unknown {
    try {
        const text = window.localStorage.getItem(key);
        return text === null ? null : JSON.parse(text);
    } catch {
        return null;
    }
}

function write(key: string, value: unknown): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Persistence is a convenience; play carries on without it.
    }
}

const count = (value: unknown): number => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

export function loadTraining(): SavedTraining {
    const raw = (read(TRAINING_KEY) ?? {}) as Partial<Record<keyof SavedTraining, unknown>>;
    const handsSeen = count(raw.handsSeen);
    return {
        handsSeen,
        handsCorrect: Math.min(count(raw.handsCorrect), handsSeen),
        bestStreak: count(raw.bestStreak),
    };
}

export function saveTraining(saved: SavedTraining): void {
    write(TRAINING_KEY, saved);
}

/** The saved Standard table, or null when there is nothing (valid) to resume. */
export function loadTable(): SavedTable | null {
    const raw = read(TABLE_KEY);
    return raw === null ? null : sanitizeSavedTable(raw, DEFAULT_SETTINGS);
}

export function saveTable(saved: SavedTable): void {
    write(TABLE_KEY, saved);
}
