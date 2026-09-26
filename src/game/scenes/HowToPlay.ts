import { GameObjects, Scene } from 'phaser';
import { Card } from '../logic/card';
import {
    ASK_RECHARGE_HANDS,
    BLACKJACK_PAYOUTS,
    CHIPS,
    DEALER_ACCURACY_START,
    DEALER_ACCURACY_STEP,
    DECK_OPTIONS,
    DEFAULT_RULES,
    MAX_HANDS,
    MIN_BET,
    TIP_AMOUNT,
} from '../logic/constants';
import { Hand } from '../logic/hand';
import { basicStrategy } from '../logic/strategy';
import type { Action, Rank } from '../logic/types';
import { Button } from '../ui/Button';
import { addFeltBackground, addText, CANVAS_W, COLOR, FONT_TITLE, HEX } from '../ui/theme';

/** The page body sits in this rounded panel; every page lays out inside it. */
const PANEL = { x: 52, y: 84, w: CANVAS_W - 104, h: 588 };
const LEFT = PANEL.x + 36;
const TEXT_W = PANEL.w - 72;
const BODY_SIZE = 18;
/** Strategy grid geometry: label column width, cell width, row height. */
const CHART = { label: 58, cell: 34, row: 27 };

/** Dealer up cards across the top of every chart. */
const UP_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

/** A chart cell: the chart play, or `Ds` for a double whose fallback is stand (soft 18). */
type Cell = Action | 'double-stand';

const CELL_STYLE: Record<Cell, { fill: number; label: string; ink: string }> = {
    hit: { fill: 0xe4e4dc, label: 'H', ink: COLOR.ink },
    stand: { fill: 0xd9534f, label: 'S', ink: '#ffffff' },
    double: { fill: HEX.gold, label: 'D', ink: COLOR.ink },
    'double-stand': { fill: 0xf7dd8a, label: 'Ds', ink: COLOR.ink },
    split: { fill: 0x4aa3df, label: 'P', ink: '#ffffff' },
    // The charts use the default rules, which have no surrender, so this is never drawn today.
    surrender: { fill: 0x9b7fd1, label: 'R', ink: '#ffffff' },
};

interface ChartRow {
    label: string;
    cards: [Rank, Rank];
}

const HARD_ROWS: ChartRow[] = [
    { label: '8−', cards: ['3', '5'] },
    { label: '9', cards: ['4', '5'] },
    { label: '10', cards: ['6', '4'] },
    { label: '11', cards: ['6', '5'] },
    { label: '12', cards: ['10', '2'] },
    { label: '13', cards: ['10', '3'] },
    { label: '14', cards: ['10', '4'] },
    { label: '15', cards: ['10', '5'] },
    { label: '16', cards: ['10', '6'] },
    { label: '17+', cards: ['10', '7'] },
];

const SOFT_ROWS: ChartRow[] = (['2', '3', '4', '5', '6', '7', '8', '9'] as Rank[]).map((r) => ({
    label: `A,${r}`,
    cards: ['A', r],
}));

const PAIR_ROWS: ChartRow[] = (['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'] as Rank[]).map((r) => ({
    label: `${r},${r}`,
    cards: [r, r],
}));

/** What the chart says for these two cards against this up card, straight from the Training scorer. */
function chartCell(cards: [Rank, Rank], up: Rank): Cell {
    const hand = new Hand(cards.map((r) => new Card(r, '♠')));
    const upCard = new Card(up, '♠');
    const play = basicStrategy(hand, upCard, { double: true, split: true });
    if (play === 'double' && basicStrategy(hand, upCard, { double: false, split: true }) === 'stand') return 'double-stand';
    return play;
}

interface Page {
    title: string;
    build: (scene: HowToPlay, page: GameObjects.Container) => void;
}

const PAGES: Page[] = [
    {
        title: 'Two Ways to Play',
        build: (s, page) => {
            let y = PANEL.y + 34;
            y = s.section(page, y, 'Training', [
                'Drill Basic Strategy one hand at a time. You make only the first move, and it is scored against the chart.',
                'A correct answer moves on by itself; after a wrong one the right play is shown and you press Next.',
                'Hands with no decision to make (a blackjack for you, or one the dealer would peek) are skipped.',
                'The top bar tracks hands played, % correct, your live streak and your best streak. Stats are saved.',
            ]);
            y = s.section(page, y + 18, 'Standard', [
                'Full rounds of blackjack against the dealer with a bankroll. Place a bet with the chips, Deal, and play every hand to the end.',
                'Your bankroll is saved, so it carries over between visits. Leaving mid-round forfeits the bet on the table.',
                `Settings (between rounds) choose the number of decks (${DECK_OPTIONS.join(', ')}), the starting bankroll and the table rules; changing the bankroll starts a fresh table and fresh stats.`,
                'The line along the bottom counts rounds won, lost and pushed, blackjacks, your best win and your peak balance.',
                `If your balance drops below the smallest chip ($${MIN_BET}), the bankroll resets to its starting amount.`,
            ]);
        },
    },
    {
        title: 'Table Rules',
        build: (s, page) => {
            const payout = `${Math.round(BLACKJACK_PAYOUTS[DEFAULT_RULES.blackjackPays] * 5)} to 5`;
            let y = PANEL.y + 34;
            y = s.section(page, y, 'The goal', [
                'Beat the dealer by finishing closer to 21 without going over. Cards 2–10 count their number, J Q K count 10, and an Ace counts 1 or 11.',
                'A hand with an Ace counted as 11 is "soft" (A,6 is soft 17); going over 21 is a bust and loses at once.',
            ]);
            y = s.section(page, y + 14, 'The default table', [
                `Blackjack (an Ace and a ten-card) pays ${payout}. Other wins pay 1 to 1, and a tie is a push.`,
                'The dealer stands on all 17s, including soft 17, and peeks for blackjack when showing an Ace or a ten.',
                'Double down on any first two cards: double the bet, take exactly one more card. Doubling after a split is allowed.',
                `Split a pair into two hands, up to ${MAX_HANDS} hands. Split Aces get one card each.`,
                'Insurance is offered when the dealer shows an Ace. It costs half your bet and pays 2 to 1 if the dealer has blackjack.',
                'Standard\'s Settings can pay blackjack 3 to 2, have the dealer hit soft 17, turn off doubling after a split, or allow late surrender (R: give up the first two cards for half the bet back). Ask the Dealer follows the table\'s rules; Training and the charts always use the ones above.',
            ]);
            s.section(page, y + 14, 'Betting', [
                `Click the $${CHIPS.join(' / $')} chips to build a bet, Clear to take it back, then Deal.`,
            ]);
        },
    },
    {
        title: 'Keyboard Controls',
        build: (s, page) => {
            const keys: [string, string][] = [
                ['H', 'Hit: take another card'],
                ['S', 'Stand: keep your total'],
                ['D', 'Double down'],
                ['P', 'Split a pair'],
                ['R', 'Surrender, when the table allows it (Standard)'],
                ['A', 'Ask the dealer for advice'],
                ['Space / Enter', 'Deal (Standard)  ·  Next hand (Training)'],
                ['Y', 'Yes: take insurance, or tip the dealer (Standard)'],
                ['N', 'No: decline insurance, or refuse the tip (Standard)'],
                ['← / →', 'Previous / next page (this screen)'],
                ['Esc', 'Back to the menu (this screen)'],
            ];
            const top = PANEL.y + 46;
            const step = 46;
            const keyX = LEFT + 90;
            keys.forEach(([key, action], i) => {
                const y = top + i * step;
                const w = Math.max(56, key.length * 11 + 24);
                const cap = s.add.graphics();
                cap.fillStyle(0x000000, 0.35).fillRoundedRect(keyX - w / 2 + 2, y - 16, w, 36, 7);
                cap.fillStyle(0xf5f1e6, 1).fillRoundedRect(keyX - w / 2, y - 18, w, 36, 7);
                cap.lineStyle(2, HEX.gold, 0.9).strokeRoundedRect(keyX - w / 2, y - 18, w, 36, 7);
                page.add([
                    cap,
                    addText(s, keyX, y, key, { size: 18, bold: true, color: COLOR.ink }),
                    addText(s, LEFT + 210, y, action, { size: 20, originX: 0 }),
                ]);
            });
        },
    },
    {
        title: 'Basic Strategy: Hard Totals',
        build: (s, page) => {
            const y = s.section(page, PANEL.y + 30, 'Why a chart?', [
                'Basic Strategy is the play with the best long-run result for each hand against the dealer’s up card. It does not win every hand, but it keeps the house edge as low as it goes. Training scores you against exactly this chart.',
                'A hard hand has no Ace, or only Aces counted as 1. Find your total down the left and the dealer’s card across the top.',
            ]);
            const width = s.chartWidth();
            s.drawChart(page, (CANVAS_W - width) / 2, y + 22, 'Hard', HARD_ROWS);
            s.legend(page, PANEL.y + PANEL.h - 28, false);
        },
    },
    {
        title: 'Basic Strategy: Soft Hands & Pairs',
        build: (s, page) => {
            const width = s.chartWidth();
            const gap = 48;
            const x0 = (CANVAS_W - (2 * width + gap)) / 2;
            const top = PANEL.y + 26;
            s.drawChart(page, x0, top, 'Soft', SOFT_ROWS);
            s.drawChart(page, x0 + width + gap, top, 'Pair', PAIR_ROWS);
            const note = addText(
                s,
                x0,
                top + 9 * 27 + 26,
                'Soft hands: an Ace counted as 11 cannot bust on the next card, so they double more often.\nPairs: always split Aces and 8s; never split 10s or 5s (play 5,5 as a hard 10).',
                { size: 16, color: COLOR.dim, align: 'left', originX: 0 },
            ).setOrigin(0, 0);
            note.setWordWrapWidth(width).setLineSpacing(4);
            page.add(note);
            s.legend(page, PANEL.y + PANEL.h - 28, true);
        },
    },
    {
        title: 'Ask the Dealer & Tipping',
        build: (s, page) => {
            let y = PANEL.y + 30;
            y = s.section(page, y, 'In Training', [
                'Press A (or Ask dealer) to see the chart play for the hand in front of you.',
                `It costs you: your live streak ends, the hand is left out of your stats, and the button recharges over the next ${ASK_RECHARGE_HANDS} hands.`,
            ]);
            y = s.section(page, y + 14, 'In Standard', [
                `The dealer will suggest a move, but the advice is only right ${DEALER_ACCURACY_START}% of the time when you sit down, and you cannot tell good advice from bad. Each answer covers only your next move.`,
                `If you follow advice that turned out to be good, the dealer asks for a $${TIP_AMOUNT} tip once the round is settled (only if you can afford it).`,
            ]);
            y = s.section(page, y + 14, 'Tip or refuse?', [
                `Tip (Y): you pay $${TIP_AMOUNT} and the dealer’s advice gets ${DEALER_ACCURACY_STEP}% more accurate, up to 100%.`,
                `Refuse (N): you keep the money, but the advice gets ${DEALER_ACCURACY_STEP}% less accurate, down to 0%.`,
                `The dealer’s accuracy is not saved: it goes back to ${DEALER_ACCURACY_START}% whenever you return to the table from the menu or reload. Tipping trades money now for better advice for the rest of the session. Or learn the chart and never need to ask.`,
            ]);
        },
    },
];

/** Paged instructions: the modes, the rules, the keys, the strategy chart and tipping. */
export class HowToPlay extends Scene {
    private pages: GameObjects.Container[] = [];
    private index = 0;
    private heading!: GameObjects.Text;
    private indicator!: GameObjects.Text;
    private prevButton!: Button;
    private nextButton!: Button;

    constructor() {
        super('HowToPlay');
    }

    create() {
        addFeltBackground(this);
        this.pages = [];
        this.index = 0;

        new Button(this, 84, 40, {
            label: 'Back',
            width: 120,
            height: 44,
            fontSize: 20,
            onClick: () => this.back(),
        });
        this.heading = addText(this, CANVAS_W / 2, 42, '', {
            size: 34,
            bold: true,
            font: FONT_TITLE,
            color: COLOR.gold,
            stroke: true,
        });

        const panel = this.add.graphics();
        panel.fillStyle(0x000000, 0.45).fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 14);
        panel.lineStyle(2, HEX.gold, 0.5).strokeRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 14);

        for (const p of PAGES) {
            const container = this.add.container(0, 0);
            p.build(this, container);
            this.pages.push(container);
        }

        const barY = 720;
        this.prevButton = new Button(this, CANVAS_W / 2 - 170, barY, {
            label: '‹ Prev',
            width: 150,
            height: 50,
            fontSize: 22,
            onClick: () => this.showPage(this.index - 1),
        });
        this.nextButton = new Button(this, CANVAS_W / 2 + 170, barY, {
            label: 'Next ›',
            width: 150,
            height: 50,
            fontSize: 22,
            variant: 'primary',
            onClick: () => this.showPage(this.index + 1),
        });
        this.indicator = addText(this, CANVAS_W / 2, barY, '', { size: 20, bold: true, color: COLOR.dim });

        this.bindKeys();
        this.showPage(0);
    }

    private bindKeys(): void {
        const kb = this.input.keyboard!;
        const bind = (key: string, act: () => void): void => {
            kb.on(`keydown-${key}`, (event: KeyboardEvent) => {
                if (!event.repeat) act();
            });
        };
        bind('LEFT', () => this.showPage(this.index - 1));
        bind('RIGHT', () => this.showPage(this.index + 1));
        bind('ESC', () => this.back());
        bind('BACKSPACE', () => this.back());
    }

    private back(): void {
        this.scene.start('MainMenu');
    }

    private showPage(i: number): void {
        if (i < 0 || i >= this.pages.length) return;
        this.index = i;
        this.pages.forEach((page, n) => page.setVisible(n === i));
        this.heading.setText(PAGES[i].title);
        this.indicator.setText(`${i + 1} / ${this.pages.length}`);
        this.prevButton.setEnabled(i > 0);
        this.nextButton.setEnabled(i < this.pages.length - 1);
    }

    // ---- Page building blocks (used by PAGES) ------------------------------

    /** A gold subheading over bullet lines. Returns the y just below the last line. */
    section(page: GameObjects.Container, y: number, heading: string, lines: string[]): number {
        const title = addText(this, LEFT, y, heading, { size: 22, bold: true, color: COLOR.gold, originX: 0 });
        title.setOrigin(0, 0);
        page.add(title);
        let bottom = y + title.height + 6;
        for (const line of lines) {
            const dot = addText(this, LEFT + 4, bottom, '•', { size: BODY_SIZE, color: COLOR.gold, originX: 0 });
            const text = addText(this, LEFT + 24, bottom, line, { size: BODY_SIZE, align: 'left', originX: 0 });
            dot.setOrigin(0, 0);
            text.setOrigin(0, 0).setWordWrapWidth(TEXT_W - 24).setLineSpacing(3);
            page.add([dot, text]);
            bottom += text.height + 6;
        }
        return bottom;
    }

    chartWidth(): number {
        return CHART.label + UP_RANKS.length * CHART.cell;
    }

    /** A colour-coded strategy grid, every cell asked of `basicStrategy`. */
    drawChart(page: GameObjects.Container, x: number, y: number, corner: string, rows: ChartRow[]): void {
        const { label: labelW, cell: cellW, row: rowH } = CHART;
        const g = this.add.graphics();
        page.add(g);

        page.add(addText(this, x + labelW / 2, y + rowH / 2, corner, { size: 15, bold: true, color: COLOR.gold }));
        UP_RANKS.forEach((up, c) => {
            const cx = x + labelW + c * cellW + cellW / 2;
            page.add(addText(this, cx, y + rowH / 2, up, { size: 16, bold: true, color: COLOR.gold }));
        });

        rows.forEach((row, r) => {
            const top = y + (r + 1) * rowH;
            page.add(addText(this, x + labelW / 2, top + rowH / 2, row.label, { size: 16, bold: true }));
            UP_RANKS.forEach((up, c) => {
                const style = CELL_STYLE[chartCell(row.cards, up)];
                const left = x + labelW + c * cellW;
                g.fillStyle(style.fill, 1).fillRect(left + 1, top + 1, cellW - 2, rowH - 2);
                page.add(
                    addText(this, left + cellW / 2, top + rowH / 2, style.label, {
                        size: 15,
                        bold: true,
                        color: style.ink,
                    }),
                );
            });
        });
    }

    /** One line of swatches explaining the chart letters. */
    legend(page: GameObjects.Container, y: number, withDs: boolean): void {
        const items: [Cell, string][] = [
            ['hit', 'Hit'],
            ['stand', 'Stand'],
            ['double', 'Double (else hit)'],
            ...(withDs ? ([['double-stand', 'Double (else stand)']] as [Cell, string][]) : []),
            ['split', 'Split'],
        ];
        const spacing = withDs ? 190 : 210;
        const x0 = CANVAS_W / 2 - ((items.length - 1) * spacing) / 2 - 70;
        const g = this.add.graphics();
        page.add(g);
        items.forEach(([cell, text], i) => {
            const style = CELL_STYLE[cell];
            const x = x0 + i * spacing;
            g.fillStyle(style.fill, 1).fillRect(x, y - 12, 30, 24);
            page.add([
                addText(this, x + 15, y, style.label, { size: 14, bold: true, color: style.ink }),
                addText(this, x + 40, y, text, { size: 16, originX: 0 }),
            ]);
        });
    }
}
