import { GameObjects, Scene, Time } from 'phaser';
import { COUNT_SPEED_MS, DECK_OPTIONS } from '../logic/constants';
import { CountingSession } from '../logic/CountingSession';
import type { CountSpeed } from '../logic/types';
import { loadCounting, saveCounting } from '../storage';
import { BACK_RED } from '../ui/atlas';
import { Button } from '../ui/Button';
import { HandView } from '../ui/HandView';
import { addMenuButton, addSoundToggle, addStatBox } from '../ui/hud';
import { Pile } from '../ui/Pile';
import { sfx } from '../ui/sound';
import { addFeltBackground, addText, CANVAS_W, COLOR, HEX, markAnswer } from '../ui/theme';

/** A quiz answered without a miss moves on by itself after this long; a miss waits for the player. */
const AUTO_ADVANCE_MS = 1200;
/** How long a "Reset stats" click stays armed before it needs confirming again. */
const CONFIRM_MS = 3000;
const CARD_SCALE = 1.8;
/** Where dealt cards slide in from: the shoe pile. */
const SHOE = { x: 84, y: 470 };
/** Digits a typed answer may have; no real count gets near three. */
const MAX_DIGITS = 3;

/** The speed picker down the left edge, on keys 1-3 (only while dealing, since digits answer quizzes). */
const SPEEDS: { speed: CountSpeed; label: string }[] = [
    { speed: 'slow', label: 'Slow' },
    { speed: 'medium', label: 'Medium' },
    { speed: 'fast', label: 'Fast' },
];

/**
 * Hi-Lo drill. Cards flip off the shoe on a timer and every so often play
 * stops for the running count (and, every other time, the true count).
 * The rules live in `CountingSession`; this scene runs the clock, takes the
 * typed answer and draws the view.
 */
export class Counting extends Scene {
    /** Public so the dev hook can read the live state (and the running count) from the console. */
    session!: CountingSession;

    private card!: HandView;
    private shoe!: Pile;
    private status!: GameObjects.Text;
    private prompt!: GameObjects.Text;
    private feedback!: GameObjects.Text;
    private entryBox!: GameObjects.Graphics;
    private entryText!: GameObjects.Text;
    private statValues!: Record<'quizzes' | 'accuracy' | 'streak' | 'best' | 'time', GameObjects.Text>;
    private speedButtons = new Map<CountSpeed, Button>();
    private deckButtons = new Map<number, Button>();
    private minusButton!: Button;
    private plusButton!: Button;
    private mainButton!: Button;
    private resetButton!: Button;

    private dealTimer: Time.TimerEvent | null = null;
    private advanceTimer: Time.TimerEvent | null = null;
    private resetTimer: Time.TimerEvent | null = null;
    private paused = false;
    /** The answer being typed: digits with an optional leading "-". Empty reads as 0. */
    private entry = '';
    /** Any wrong answer in the current quiz, so feedback waits for the player. */
    private quizMissed = false;
    /** Which draw the table is showing, so a re-render doesn't re-deal the same card. */
    private shownCard = '';

    constructor() {
        super('Counting');
    }

    create() {
        this.session = new CountingSession(loadCounting());
        this.dealTimer = null;
        this.advanceTimer = null;
        this.resetTimer = null;
        this.paused = false;
        this.entry = '';
        this.quizMissed = false;
        this.shownCard = '';
        this.speedButtons.clear();
        this.deckButtons.clear();

        addFeltBackground(this);
        this.buildHud();
        this.buildTable();
        this.buildControls();
        this.bindKeys();
        addSoundToggle(this);

        this.startDealing();
        this.render();
    }

    // ---- Layout ------------------------------------------------------------

    private buildHud(): void {
        addMenuButton(this);

        const stats: { key: keyof Counting['statValues']; label: string }[] = [
            { key: 'quizzes', label: 'ANSWERS' },
            { key: 'accuracy', label: 'ACCURACY' },
            { key: 'streak', label: 'STREAK' },
            { key: 'best', label: 'BEST' },
            { key: 'time', label: 'AVG TIME' },
        ];
        const width = 128;
        const gap = 12;
        const left = CANVAS_W / 2 - (stats.length * width + (stats.length - 1) * gap) / 2;
        this.statValues = {} as Counting['statValues'];
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
            height: 52,
            fontSize: 17,
            onClick: () => this.onReset(),
        });
    }

    private buildTable(): void {
        const cx = CANVAS_W / 2;

        const lx = 84;
        addText(this, lx, 116, 'SPEED', { size: 16, bold: true, color: COLOR.dim, stroke: true });
        SPEEDS.forEach((s, i) => {
            const button = new Button(this, lx, 162 + i * 62, {
                label: s.label,
                sublabel: `key ${i + 1}`,
                width: 124,
                height: 52,
                fontSize: 21,
                onClick: () => this.setSpeed(s.speed),
            });
            this.speedButtons.set(s.speed, button);
        });

        this.shoe = new Pile(this, SHOE.x, SHOE.y, BACK_RED, 0.9);

        const rx = CANVAS_W - 84;
        addText(this, rx, 116, 'DECKS', { size: 16, bold: true, color: COLOR.dim, stroke: true });
        DECK_OPTIONS.forEach((decks, i) => {
            const button = new Button(this, rx, 160 + i * 60, {
                label: `${decks}`,
                width: 124,
                height: 52,
                fontSize: 21,
                onClick: () => this.setDecks(decks),
            });
            this.deckButtons.set(decks, button);
        });

        this.card = new HandView(this, cx, 240, CARD_SCALE);
        this.status = addText(this, cx, 378, '', { size: 22, bold: true, color: COLOR.dim, stroke: true });
        this.feedback = addText(this, cx, 426, '', { size: 26, bold: true, stroke: true });
        this.feedback.setWordWrapWidth(680);
    }

    private buildControls(): void {
        const cx = CANVAS_W / 2;
        this.prompt = addText(this, cx, 492, '', { size: 32, bold: true, color: COLOR.gold, stroke: true });

        const y = 568;
        this.entryBox = this.add.graphics();
        this.entryBox.fillStyle(0x000000, 0.45).fillRoundedRect(cx - 100, y - 36, 200, 72, 12);
        this.entryBox.lineStyle(2, HEX.gold, 0.8).strokeRoundedRect(cx - 100, y - 36, 200, 72, 12);
        this.entryText = addText(this, cx, y, '', { size: 44, bold: true });

        this.minusButton = new Button(this, cx - 160, y, {
            label: '−',
            sublabel: '↓',
            width: 88,
            height: 72,
            fontSize: 36,
            onClick: () => this.step(-1),
        });
        this.plusButton = new Button(this, cx + 160, y, {
            label: '+',
            sublabel: '↑',
            width: 88,
            height: 72,
            fontSize: 36,
            onClick: () => this.step(1),
        });

        // One button whose job follows the phase: pause while dealing, submit a quiz, continue after feedback.
        this.mainButton = new Button(this, cx, 684, {
            label: '',
            sublabel: '',
            width: 300,
            height: 64,
            fontSize: 26,
            variant: 'primary',
            onClick: () => this.primary(),
        });
    }

    private bindKeys(): void {
        const kb = this.input.keyboard!;
        kb.on('keydown', (event: KeyboardEvent) => this.onKey(event));
    }

    private onKey(event: KeyboardEvent): void {
        const phase = this.session.view().phase;
        const key = event.key;

        if (key === ' ' || key === 'Enter') {
            if (!event.repeat) this.primary();
            return;
        }
        if (phase === 'quiz') {
            if (/^[0-9]$/.test(key)) this.type(key);
            else if (key === '-' || key === '_') this.flipSign();
            else if (key === 'Backspace') this.setEntry(this.entry.slice(0, -1));
            else if (key === 'ArrowUp' || key === '+' || key === '=') this.step(1);
            else if (key === 'ArrowDown') this.step(-1);
            return;
        }
        const speed = SPEEDS[Number(key) - 1];
        if (speed) this.setSpeed(speed.speed);
    }

    // ---- Dealing -----------------------------------------------------------

    /** (Re)start the card clock at the current speed. */
    private startDealing(): void {
        this.dealTimer?.remove();
        this.dealTimer = this.time.addEvent({
            delay: COUNT_SPEED_MS[this.session.view().speed],
            loop: true,
            callback: () => this.tick(),
        });
    }

    private tick(): void {
        if (this.paused || !this.session.dealCard()) return;
        if (this.session.view().phase === 'quiz') {
            this.entry = '';
            this.quizMissed = false;
        }
        this.render();
    }

    private setSpeed(speed: CountSpeed): void {
        this.session.setSpeed(speed);
        saveCounting(this.session.snapshot());
        this.startDealing();
        this.render();
    }

    private setDecks(decks: number): void {
        if (decks === this.session.view().decks) return;
        this.advanceTimer?.remove();
        this.advanceTimer = null;
        this.session.setDecks(decks);
        saveCounting(this.session.snapshot());
        this.startDealing();
        this.render();
    }

    // ---- Answering ---------------------------------------------------------

    private primary(): void {
        const phase = this.session.view().phase;
        if (phase === 'quiz') this.submit();
        else if (phase === 'feedback') this.resume();
        else this.togglePause();
    }

    private togglePause(): void {
        this.paused = !this.paused;
        this.render();
    }

    private type(digit: string): void {
        const digits = this.entry.replace('-', '');
        if (digits.length >= MAX_DIGITS) return;
        this.setEntry(this.entry + digit);
    }

    private flipSign(): void {
        this.setEntry(this.entry.startsWith('-') ? this.entry.slice(1) : `-${this.entry}`);
    }

    private step(by: number): void {
        if (this.session.view().phase !== 'quiz') return;
        this.setEntry(`${this.entryValue() + by}`);
    }

    private setEntry(entry: string): void {
        // A leading zero goes when a digit follows it, so "0" then "3" reads 3.
        this.entry = entry.replace(/^(-?)0+(?=\d)/, '$1');
        this.render();
    }

    private entryValue(): number {
        const n = parseInt(this.entry, 10);
        return Number.isNaN(n) ? 0 : n;
    }

    private submit(): void {
        if (!this.session.answer(this.entryValue())) return;
        saveCounting(this.session.snapshot());
        const v = this.session.view();
        const correct = v.feedback?.correct ?? false;
        if (!correct) this.quizMissed = true;
        this.entry = '';
        sfx.play(correct ? 'correct' : 'wrong');

        if (v.phase === 'feedback' && !this.quizMissed) {
            this.advanceTimer = this.time.delayedCall(AUTO_ADVANCE_MS, () => this.resume());
        }
        this.render();
    }

    /** Back to dealing. Also the manual path after a clean quiz, skipping the wait. */
    private resume(): void {
        this.advanceTimer?.remove();
        this.advanceTimer = null;
        if (!this.session.resume()) return;
        this.paused = false;
        // The clock starts over, so the first card comes a full beat after the feedback clears.
        this.startDealing();
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
        saveCounting(this.session.snapshot());
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

        this.statValues.quizzes.setText(`${v.quizzes}`);
        this.statValues.accuracy.setText(v.accuracy === null ? '—' : `${Math.round(v.accuracy)}%`);
        this.statValues.streak.setText(`${v.streak}`);
        this.statValues.best.setText(`${v.bestStreak}`);
        this.statValues.time.setText(v.avgAnswerMs === null ? '—' : `${(v.avgAnswerMs / 1000).toFixed(1)}s`);

        this.shoe.set(v.cardsRemaining, v.shoeTotal, 'in shoe');
        // One card at a time: the old one leaves so the new one slides in from the shoe.
        // Cards left tells two draws of the same card apart.
        const drawn = v.card ? `${v.card.rank}${v.card.suit}:${v.cardsRemaining}` : '';
        if (drawn !== this.shownCard) {
            this.card.clear();
            if (v.card) this.card.setCards([v.card], SHOE);
            this.shownCard = drawn;
        }

        if (v.phase === 'dealing') {
            this.status.setText(
                this.paused ? 'Paused' : v.reshuffled ? 'New shoe: the count starts at 0' : 'Keep the running count…',
            );
        } else {
            this.status.setText('');
        }

        if (v.feedback) {
            this.feedback.setText(markAnswer(v.feedback.text, v.feedback.correct)).setColor(v.feedback.correct ? COLOR.win : COLOR.lose);
        } else {
            this.feedback.setText('');
        }

        const quiz = v.phase === 'quiz';
        this.prompt.setText(
            v.question === 'running' ? 'Running count?' : v.question === 'true' ? 'True count? (per deck left, toward 0)' : '',
        );
        this.entryBox.setVisible(quiz);
        this.entryText.setVisible(quiz);
        this.entryText.setText(this.entry === '' ? '0' : this.entry).setColor(this.entry === '' ? COLOR.dim : COLOR.text);
        this.minusButton.setVisible(quiz);
        this.plusButton.setVisible(quiz);

        if (quiz) this.mainButton.setLabel('Submit').setSublabel('Enter');
        else if (v.phase === 'feedback') this.mainButton.setLabel('Continue').setSublabel('Space or Enter');
        else this.mainButton.setLabel(this.paused ? 'Resume' : 'Pause').setSublabel('Space');

        for (const [speed, button] of this.speedButtons) button.setSelected(speed === v.speed);
        for (const [decks, button] of this.deckButtons) button.setSelected(decks === v.decks);
    }
}
