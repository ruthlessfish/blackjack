/** Player-adjustable table options, edited in the Standard-mode settings panel. */
export interface Settings {
    decks: number;
    startingBalance: number;
}

/** What Standard mode persists between sessions. */
export interface SavedTable extends Settings {
    balance: number;
}

/** What Training mode persists between sessions. */
export interface SavedTraining {
    handsSeen: number;
    handsCorrect: number;
    bestStreak: number;
}

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

/** A card as the scenes see it: plain data, never the `Card` class. */
export interface CardView {
    rank: Rank;
    suit: Suit;
    red: boolean;
}

/** `tip` holds a settled round while the player decides whether to tip the dealer for good advice. */
export type Phase = 'betting' | 'insurance' | 'player' | 'dealer' | 'settled' | 'tip';
export type Outcome = 'win' | 'lose' | 'push';
export type Action = 'hit' | 'stand' | 'double' | 'split';

/** How the message line is styled: a settlement outcome, or the blackjack fanfare. */
export type MessageKind = Outcome | 'blackjack';

/**
 * Whether a control is offered. `unavailable` means it has no place right now
 * (so the control is hidden); `disabled` means it exists but can't be used yet,
 * say because the bankroll won't cover it or no bet is down (so it is shown
 * greyed out); `ok` means it can be used.
 */
export type Availability = 'ok' | 'disabled' | 'unavailable';

/** Runs `fn` after `ms` and hands back a function that cancels it. */
export type Scheduler = (fn: () => void, ms: number) => () => void;

/** The message line. Part of the state so it can never desync from a render. */
export interface MessageView {
    text: string;
    kind?: MessageKind;
}

export interface PlayerHandView {
    cards: CardView[];
    total: number;
    soft: boolean;
    bet: number;
    active: boolean;
    outcome?: Outcome;
    /** A natural that got paid, worth celebrating. */
    blackjack: boolean;
    label: string;
}

export interface ChipView {
    amount: number;
    availability: Availability;
}

/** The Standard-mode table as the player is allowed to see it. */
export interface ViewState {
    /** A face-down card is `null`. */
    dealer: (CardView | null)[];
    dealerHidden: boolean;
    dealerTotal: number | null;
    dealerSoft: boolean;
    balance: number;
    betDisplay: number;
    phase: Phase;
    shoeRemaining: number;
    shoeTotal: number;
    /** Cards retired to the discard tray. Excludes cards still in play on the table. */
    shoeDiscarded: number;
    playerHands: PlayerHandView[];
    /** The move the dealer suggested for the current decision, if the player asked. */
    advice: Action | null;
    message: MessageView;
    settings: Settings;
    chips: ChipView[];
    can: {
        deal: Availability;
        clear: Availability;
        hit: Availability;
        stand: Availability;
        double: Availability;
        split: Availability;
        /** Both insurance buttons: take it or decline. */
        insurance: Availability;
        /** Ask the dealer: shown during play, dimmed once asked for this decision. */
        ask: Availability;
        /** Both tip buttons: tip the dealer or decline. */
        tip: Availability;
        /** Whether the round-scoped settings (shoe, bankroll) can be changed. */
        settings: boolean;
    };
}

/** The Training-mode hand on the table. */
export interface TrainingView {
    dealer: (CardView | null)[];
    player: CardView[];
    /** How the hand reads at a glance: "Hard 16", "Soft 18", "Pair of 8s". */
    handLabel: string;
    /** Which of the four moves the player may pick right now, and whether the dealer can be asked. */
    can: Record<Action, boolean> & { ask: boolean };
    /** The play the dealer revealed for this hand; null if not asked. */
    dealerSays: Action | null;
    /** Hands left before Ask the Dealer recharges; 0 when ready. */
    askRecharge: number;
    /** Set once the player has answered; null while the hand awaits a move. */
    feedback: { correct: boolean; text: string } | null;
    handsSeen: number;
    handsCorrect: number;
    /** Percentage 0-100, or null before the first hand. */
    accuracy: number | null;
    streak: number;
    bestStreak: number;
}
