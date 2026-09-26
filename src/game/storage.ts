import { DEFAULT_SETTINGS } from './logic/constants';
import { parseCount, sanitizeSavedTable } from './logic/settings';
import type { SavedTable, SavedTraining } from './logic/types';

const TRAINING_KEY = 'blackjack3.training';
const TABLE_KEY = 'blackjack3.table';
const SOUND_KEY = 'blackjack3.sound';

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

export function loadTraining(): SavedTraining {
    const raw = (read(TRAINING_KEY) ?? {}) as Partial<Record<keyof SavedTraining, unknown>>;
    const handsSeen = parseCount(raw.handsSeen);
    return {
        handsSeen,
        handsCorrect: Math.min(parseCount(raw.handsCorrect), handsSeen),
        bestStreak: parseCount(raw.bestStreak),
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

/** Whether sound is off. Anything but a saved `true` means sound is on. */
export function loadMuted(): boolean {
    return (read(SOUND_KEY) as { muted?: unknown } | null)?.muted === true;
}

export function saveMuted(muted: boolean): void {
    write(SOUND_KEY, { muted });
}
