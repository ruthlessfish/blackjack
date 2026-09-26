import { GameObjects, Scene, Time } from 'phaser';
import { TrainingSession } from '../logic/TrainingSession';
import type { Action, HandFilter } from '../logic/types';
import { loadTraining, saveTraining } from '../storage';
import { Button } from '../ui/Button';
import { HandView } from '../ui/HandView';
import { addMenuButton, addSoundToggle, addStatBox } from '../ui/hud';
import { sfx } from '../ui/sound';
import { TEX, addFeltBackground, addText, CANVAS_W, COLOR } from '../ui/theme';

/** A correct answer moves on by itself after this long; a wrong one waits for the player. */
const AUTO_ADVANCE_MS = 1200;
/** How long a "Reset stats" click stays armed before it needs confirming again. */
const CONFIRM_MS = 3000;
const CARD_SCALE = 1.15;
const CARD_STEP = 1.1;
/** Where dealt cards slide in from. */
const DECK = { x: 900, y: 200 };

const ACTIONS: { action: Action; label: string; key: string }[] = [
    { action: 'hit', label: 'Hit', key: 'H' },
    { action: 'stand', label: 'Stand', key: 'S' },
    { action: 'double', label: 'Double', key: 'D' },
    { action: 'split', label: 'Split', key: 'P' },
];

/** The hand-type picker down the left edge, on keys 1-4. */
const FILTERS: { filter: HandFilter; label: string; key: string }[] = [
    { filter: 'all', label: 'All', key: 'ONE' },
    { filter: 'hard', label: 'Hard', key: 'TWO' },
    { filter: 'soft', label: 'Soft', key: 'THREE' },
    { filter: 'pair', label: 'Pairs', key: 'FOUR' },
];

/**
 * Basic Strategy drill. One hand at a time, one move each, scored against the
 * chart. All the rules live in `TrainingSession`; this scene draws its view.
 */
export class Training extends Scene {
    /** Public so the dev hook can read the live state from the console. */
    session!: TrainingSession;

    private dealerHand!: HandView;
    private playerHand!: HandView;
    private handLabel!: GameObjects.Text;
    private feedback!: GameObjects.Text;
    private statValues!: Record<'hands' | 'correct' | 'accuracy' | 'streak' | 'best', GameObjects.Text>;
    private actionButtons = new Map<Action, Button>();
    private filterButtons = new Map<HandFilter, Button>();
    private nextButton!: Button;
    private askButton!: Button;
    private resetButton!: Button;
    private advanceTimer: Time.TimerEvent | null = null;
    private resetTimer: Time.TimerEvent | null = null;

    constructor() {
        super('Training');
    }

    create() {
        this.session = new TrainingSession(loadTraining());
        this.advanceTimer = null;
        this.resetTimer = null;
        this.actionButtons.clear();
        this.filterButtons.clear();

        addFeltBackground(this);
        this.buildHud();
        this.buildTable();
        this.buildControls();
        this.bindKeys();
        addSoundToggle(this);

        this.render();
    }

    // ---- Layout ------------------------------------------------------------

    private buildHud(): void {
        addMenuButton(this);

        const stats: { key: keyof Training['statValues']; label: string }[] = [
            { key: 'hands', label: 'HANDS' },
            { key: 'correct', label: 'CORRECT' },
            { key: 'accuracy', label: 'ACCURACY' },
            { key: 'streak', label: 'STREAK' },
            { key: 'best', label: 'BEST' },
        ];
        const width = 128;
        const gap = 12;
        const left = CANVAS_W / 2 - (stats.length * width + (stats.length - 1) * gap) / 2;
        this.statValues = {} as Training['statValues'];
        stats.forEach((s, i) => {
            const cx = left + width / 2 + i * (width + gap);
            const best = s.key === 'best';
            this.statValues[s.key] = addStatBox(this, cx, s.label, {
                width,
                fillAlpha: 0.35,
                borderAlpha: best ? 1 : 0.4,
                valueColor: best ? COLOR.gold : COLOR.text,
                value: '0',
            });
        });

        this.resetButton = new Button(this, CANVAS_W - 84, 40, {
            label: 'Reset stats',
            width: 130,
            height: 44,
            fontSize: 17,
            onClick: () => this.onReset(),
        });
    }

    private buildTable(): void {
        const cx = CANVAS_W / 2;
        // A face-down deck to deal from, in the corner.
        this.add.image(DECK.x, DECK.y, TEX.sprites, 'stack-red').setScale(1.1);

        addText(this, cx, 116, 'DEALER SHOWS', { size: 16, bold: true, color: COLOR.dim, stroke: true });
        // Side by side rather than overlapped: every pip has to be readable at a glance.
        this.dealerHand = new HandView(this, cx, 205, CARD_SCALE, CARD_STEP);

        this.handLabel = addText(this, cx, 318, '', { size: 34, bold: true, color: COLOR.gold, stroke: true });
        this.playerHand = new HandView(this, cx, 412, CARD_SCALE, CARD_STEP);

        this.feedback = addText(this, cx, 528, '', { size: 30, bold: true, stroke: true });
        this.feedback.setWordWrapWidth(900);

        // Level with "DEALER SHOWS", in the empty column left of the cards.
        const fx = 84;
        addText(this, fx, 116, 'DEAL', { size: 16, bold: true, color: COLOR.dim, stroke: true });
        FILTERS.forEach((f, i) => {
            const button = new Button(this, fx, 162 + i * 62, {
                label: f.label,
                sublabel: `key ${i + 1}`,
                width: 124,
                height: 52,
                fontSize: 21,
                onClick: () => this.setFilter(f.filter),
            });
            this.filterButtons.set(f.filter, button);
        });
    }

    private buildControls(): void {
        const width = 200;
        const gap = 20;
        const left = CANVAS_W / 2 - (ACTIONS.length * width + (ACTIONS.length - 1) * gap) / 2;
        ACTIONS.forEach((a, i) => {
            const button = new Button(this, left + width / 2 + i * (width + gap), 618, {
                label: a.label,
                sublabel: `key ${a.key}`,
                width,
                height: 76,
                fontSize: 30,
                onClick: () => this.choose(a.action),
            });
            this.actionButtons.set(a.action, button);
        });

        this.nextButton = new Button(this, CANVAS_W / 2, 704, {
            label: 'Next hand',
            sublabel: 'Space or Enter',
            width: 300,
            height: 58,
            fontSize: 26,
            variant: 'primary',
            onClick: () => this.next(),
        });

        this.askButton = new Button(this, 850, 704, {
            label: 'Ask dealer',
            sublabel: 'key A',
            width: 220,
            height: 58,
            fontSize: 24,
            onClick: () => this.ask(),
        });

        new Button(this, 174, 704, {
            label: 'Mistakes',
            sublabel: 'key K',
            width: 220,
            height: 58,
            fontSize: 24,
            onClick: () => this.showMistakes(),
        });
    }

    private bindKeys(): void {
        const kb = this.input.keyboard!;
        for (const a of ACTIONS) kb.on(`keydown-${a.key}`, () => this.choose(a.action));
        for (const f of FILTERS) kb.on(`keydown-${f.key}`, () => this.setFilter(f.filter));
        kb.on('keydown-A', () => this.ask());
        kb.on('keydown-K', () => this.showMistakes());
        kb.on('keydown-SPACE', () => this.next());
        kb.on('keydown-ENTER', () => this.next());
    }

    // ---- Play --------------------------------------------------------------

    private choose(action: Action): void {
        if (!this.session.answer(action)) return;
        saveTraining(this.session.snapshot());
        this.render();
        sfx.play(this.session.view().feedback?.correct ? 'correct' : 'wrong');

        if (this.session.view().feedback?.correct) {
            this.advanceTimer = this.time.delayedCall(AUTO_ADVANCE_MS, () => this.next());
        }
    }

    /** Reveal the play. It costs the streak, so there is nothing new to save. */
    private ask(): void {
        if (this.session.askDealer()) this.render();
    }

    /** Deal only this kind of hand. An unanswered hand of another kind is swapped at once. */
    private setFilter(filter: HandFilter): void {
        // A swapped hand deals in fresh, as a new hand does.
        if (this.session.setFilter(filter)) {
            this.dealerHand.clear();
            this.playerHand.clear();
        }
        saveTraining(this.session.snapshot());
        this.render();
    }

    /** The strategy chart with the cells still being missed outlined; its Back comes here. */
    private showMistakes(): void {
        this.scene.start('HowToPlay', { page: 'mistakes', back: 'Training' });
    }

    /** Move to the next hand. Also the manual path for a correct answer, skipping the wait. */
    private next(): void {
        if (this.session.view().feedback === null) return;
        this.advanceTimer?.remove();
        this.advanceTimer = null;

        this.session.deal();
        this.dealerHand.clear();
        this.playerHand.clear();
        this.render();
    }

    /** First click arms it; a second within a few seconds wipes the saved totals. */
    private onReset(): void {
        if (this.resetTimer === null) {
            this.resetButton.setLabel('Sure?');
            this.resetTimer = this.time.delayedCall(CONFIRM_MS, () => this.disarmReset());
            return;
        }
        this.session.resetStats();
        saveTraining(this.session.snapshot());
        this.disarmReset();
        this.render();
    }

    private disarmReset(): void {
        this.resetTimer?.remove();
        this.resetTimer = null;
        this.resetButton.setLabel('Reset stats');
    }

    // ---- Rendering ---------------------------------------------------------

    private render(): void {
        const v = this.session.view();

        this.statValues.hands.setText(`${v.handsSeen}`);
        this.statValues.correct.setText(`${v.handsCorrect}`);
        this.statValues.accuracy.setText(v.accuracy === null ? '—' : `${Math.round(v.accuracy)}%`);
        this.statValues.streak.setText(`${v.streak}`);
        this.statValues.best.setText(`${v.bestStreak}`);

        this.dealerHand.setCards(v.dealer, DECK);
        this.playerHand.setCards(v.player, DECK);
        this.handLabel.setText(v.handLabel);

        if (v.feedback) {
            this.feedback.setText(v.feedback.text).setColor(v.feedback.correct ? COLOR.win : COLOR.lose);
        } else if (v.dealerSays) {
            const label = ACTIONS.find((a) => a.action === v.dealerSays)!.label;
            this.feedback.setText(`Dealer says: ${label}.`).setColor(COLOR.gold);
        } else {
            this.feedback.setText('What is the Basic Strategy play?').setColor(COLOR.text);
        }

        for (const [action, button] of this.actionButtons) button.setEnabled(v.can[action]);
        for (const [filter, button] of this.filterButtons) button.setSelected(filter === v.filter);
        this.nextButton.setVisible(v.feedback !== null && !v.feedback.correct);
        this.askButton.setEnabled(v.can.ask);
        // The hand the dealer was asked on shows the full wait; it starts counting on the next one.
        this.askButton.setSublabel(v.askRecharge > 0 ? `recharging (${v.askRecharge})` : 'key A');
    }
}
