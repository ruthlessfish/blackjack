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

export type Phase = 'betting' | 'insurance' | 'player' | 'dealer' | 'settled';
export type Outcome = 'win' | 'lose' | 'push';
export type Action = 'hit' | 'stand' | 'double' | 'split';

/** How the message line is styled: a settlement outcome, or the blackjack fanfare. */
export type MessageKind = Outcome | 'blackjack';

/**
 * Why an action is or isn't offered. `unavailable` means the rules don't allow
 * it at all (so the control is hidden); `unaffordable` means the play exists
 * but the bankroll won't cover it (so the control is shown greyed out).
 */
export type Availability = 'ok' | 'unaffordable' | 'unavailable';

/** The message line. Part of the state so it can never desync from a render. */
export interface MessageView {
    text: string;
    kind?: MessageKind;
}

export interface HandView {
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
    playerHands: HandView[];
    message: MessageView;
    settings: Settings;
    chips: ChipView[];
    can: {
        deal: boolean;
        hit: boolean;
        stand: boolean;
        double: Availability;
        split: Availability;
        insurance: boolean;
        clear: boolean;
        chips: boolean;
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
    /** Which of the four moves the player may pick right now. */
    can: Record<Action, boolean>;
    /** Set once the player has answered; null while the hand awaits a move. */
    feedback: { correct: boolean; text: string } | null;
    handsSeen: number;
    handsCorrect: number;
    /** Percentage 0-100, or null before the first hand. */
    accuracy: number | null;
    streak: number;
    bestStreak: number;
}
