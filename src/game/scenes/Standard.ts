import { GameObjects, Scene, Scenes } from 'phaser';
import { CHIPS } from '../logic/constants';
import { StandardGame } from '../logic/StandardGame';
import type { Availability, ViewState } from '../logic/types';
import { loadTable, saveTable } from '../storage';
import { BACK_BLUE, BACK_RED, CARD_H } from '../ui/atlas';
import { BetStack } from '../ui/BetStack';
import { Button } from '../ui/Button';
import { ChipButton } from '../ui/ChipButton';
import { HandView } from '../ui/HandView';
import { Pile } from '../ui/Pile';
import { SettingsModal } from '../ui/SettingsModal';
import { addTableBackground, addText, CANVAS_W, COLOR, scoreLabel } from '../ui/theme';

/** Where dealt cards slide in from: the shoe. */
const SHOE = { x: 930, y: 160 };
const DISCARD = { x: 94, y: 160 };
const PILE_SCALE = 0.6;

const DEALER_SCALE = 0.9;
const DEALER_Y = 138;
const PLAYER_Y = 572;

const CONTROLS_Y = 700;

const OUTCOME_COLOR = {
    win: COLOR.win,
    lose: COLOR.lose,
    push: COLOR.push,
    blackjack: COLOR.gold,
} as const;

/** Where the player's hands sit, and how big their cards are, for a given number of hands. */
function playerSlots(n: number): { xs: number[]; scale: number } {
    if (n <= 1) return { xs: [CANVAS_W / 2], scale: 0.9 };
    if (n === 2) return { xs: [300, 724], scale: 0.85 };
    if (n === 3) return { xs: [190, 512, 834], scale: 0.7 };
    return { xs: [140, 395, 650, 905], scale: 0.62 };
}

/**
 * Regular 1-on-1 blackjack against the dealer. `StandardGame` owns every rule;
 * this scene draws the `ViewState` it emits and forwards clicks.
 */
export class Standard extends Scene {
    /** Public so the dev hook can read the live state from the console. */
    table!: StandardGame;

    private dealerHand!: HandView;
    private dealerScore!: GameObjects.Text;
    private playerHands: HandView[] = [];
    private playerTitles: GameObjects.Text[] = [];
    private activeMark!: GameObjects.Graphics;
    private betStack!: BetStack;
    private message!: GameObjects.Text;
    private balanceText!: GameObjects.Text;
    private betText!: GameObjects.Text;
    private shoe!: Pile;
    private discard!: Pile;
    private settings!: SettingsModal;
    private settingsButton!: Button;

    private chipButtons: { amount: number; button: ChipButton }[] = [];
    private clearButton!: Button;
    private dealButton!: Button;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    private splitButton!: Button;
    private insuranceYes!: Button;
    private insuranceNo!: Button;

    constructor() {
        super('Standard');
    }

    create() {
        this.playerHands = [];
        this.playerTitles = [];
        this.chipButtons = [];

        addTableBackground(this);
        this.buildHud();
        this.buildTable();
        this.buildControls();
        this.settings = new SettingsModal(this, (next) => this.table.applySettings(next));

        this.table = new StandardGame((view) => this.render(view), loadTable() ?? undefined);
        this.events.once(Scenes.Events.SHUTDOWN, () => this.table.dispose());
        this.render(this.table.view());
    }

    // ---- Layout ------------------------------------------------------------

    private buildHud(): void {
        new Button(this, 84, 40, {
            label: 'Menu',
            width: 120,
            height: 44,
            fontSize: 20,
            onClick: () => this.scene.start('MainMenu'),
        });

        const box = (cx: number, label: string): GameObjects.Text => {
            const g = this.add.graphics();
            g.fillStyle(0x000000, 0.45).fillRoundedRect(cx - 80, 12, 160, 56, 10);
            g.lineStyle(2, 0xf2c94c, 0.5).strokeRoundedRect(cx - 80, 12, 160, 56, 10);
            addText(this, cx, 26, label, { size: 12, bold: true, color: COLOR.dim });
            return addText(this, cx, 49, '', { size: 26, bold: true });
        };
        this.balanceText = box(CANVAS_W / 2 - 92, 'BALANCE');
        this.betText = box(CANVAS_W / 2 + 92, 'BET');

        this.settingsButton = new Button(this, CANVAS_W - 84, 40, {
            label: 'Settings',
            width: 130,
            height: 44,
            fontSize: 19,
            onClick: () => this.settings.open(this.table.view().settings),
        });
    }

    private buildTable(): void {
        this.shoe = new Pile(this, SHOE.x, SHOE.y, BACK_RED, PILE_SCALE);
        this.discard = new Pile(this, DISCARD.x, DISCARD.y, BACK_BLUE, PILE_SCALE);

        this.dealerHand = new HandView(this, CANVAS_W / 2, DEALER_Y, DEALER_SCALE);
        this.dealerScore = addText(this, CANVAS_W / 2, DEALER_Y + (CARD_H * DEALER_SCALE) / 2 + 20, '', {
            size: 22,
            bold: true,
            stroke: true,
        });
        this.message = addText(this, CANVAS_W / 2, 258, '', { size: 26, bold: true, stroke: true });
        this.message.setWordWrapWidth(760);

        this.activeMark = this.add.graphics();
        this.betStack = new BetStack(this, CANVAS_W / 2, PLAYER_Y);
    }

    private buildControls(): void {
        const y = CONTROLS_Y;

        [232, 322, 412].forEach((x, i) => {
            const amount = CHIPS[i];
            const button = new ChipButton(this, x, y, amount, 1.1, () => this.table.addBet(amount));
            this.chipButtons.push({ amount, button });
        });
        this.clearButton = new Button(this, 540, y, {
            label: 'Clear',
            width: 110,
            height: 50,
            fontSize: 20,
            onClick: () => this.table.clearBet(),
        });
        this.dealButton = new Button(this, 700, y, {
            label: 'Deal',
            width: 170,
            height: 58,
            fontSize: 28,
            variant: 'primary',
            onClick: () => this.table.deal(),
        });

        const play = (x: number, label: string, onClick: () => void): Button =>
            new Button(this, x, y, { label, width: 116, height: 56, fontSize: 24, onClick });
        this.hitButton = play(300, 'Hit', () => this.table.hit());
        this.standButton = play(430, 'Stand', () => this.table.stand());
        this.doubleButton = play(560, 'Double', () => this.table.double());
        this.splitButton = play(690, 'Split', () => this.table.split());

        this.insuranceYes = new Button(this, 400, y, {
            label: 'Take insurance',
            width: 230,
            height: 56,
            fontSize: 22,
            onClick: () => this.table.takeInsurance(),
        });
        this.insuranceNo = new Button(this, 640, y, {
            label: 'No thanks',
            width: 200,
            height: 56,
            fontSize: 22,
            variant: 'primary',
            onClick: () => this.table.declineInsurance(),
        });
    }

    // ---- Rendering ---------------------------------------------------------

    private render(v: ViewState): void {
        // Saved on every change so a reload mid-round forfeits the bet rather than undoing it.
        saveTable(this.table.snapshot());

        this.balanceText.setText(`$${v.balance}`).setColor(this.balanceColor(v));
        this.betText.setText(`$${v.betDisplay}`);
        this.shoe.set(v.shoeRemaining, v.shoeTotal, 'in shoe');
        this.discard.set(v.shoeDiscarded, v.shoeTotal, 'discarded');

        this.dealerHand.setCards(v.dealer, SHOE);
        this.dealerScore.setText(
            v.dealerTotal !== null
                ? `Dealer ${scoreLabel(v.dealerTotal, v.dealerSoft)}`
                : v.dealer.length
                  ? 'Dealer ?'
                  : '',
        );

        this.renderPlayerHands(v);
        // With no hands on the table the bet is shown as chips at the spot; once dealt it is on the hand titles.
        this.betStack.setAmount(v.playerHands.length === 0 ? v.betDisplay : 0);

        this.message
            .setText(v.message.text)
            .setColor(v.message.kind ? OUTCOME_COLOR[v.message.kind] : COLOR.text);

        this.renderControls(v);
    }

    /** Green above the starting bankroll, red below. Chips already staked on the table still count as yours. */
    private balanceColor(v: ViewState): string {
        const worth = v.phase === 'betting' ? v.balance : v.balance + v.betDisplay;
        if (worth > v.settings.startingBalance) return COLOR.win;
        if (worth < v.settings.startingBalance) return COLOR.lose;
        return COLOR.text;
    }

    private renderPlayerHands(v: ViewState): void {
        const n = v.playerHands.length;
        const { xs, scale } = playerSlots(n);

        while (this.playerHands.length > n) {
            this.playerHands.pop()!.destroy();
            this.playerTitles.pop()!.destroy();
        }
        while (this.playerHands.length < n) {
            this.playerHands.push(new HandView(this, xs[0], PLAYER_Y, scale));
            this.playerTitles.push(addText(this, xs[0], PLAYER_Y, '', { size: 19, bold: true, stroke: true }));
        }

        this.activeMark.clear();
        const cardH = CARD_H * scale;

        v.playerHands.forEach((h, i) => {
            const view = this.playerHands[i];
            view.setCardScale(scale);
            view.setPosition(xs[i], PLAYER_Y);
            view.setCards(h.cards, SHOE);

            const title = this.playerTitles[i];
            title.setPosition(xs[i], PLAYER_Y - cardH / 2 - 24);
            title.setText(this.handTitle(h)).setColor(this.handColor(h));

            if (h.active) {
                const w = view.spanFor(h.cards.length) + 24;
                this.activeMark
                    .lineStyle(3, 0xf2c94c, 0.95)
                    .strokeRoundedRect(xs[i] - w / 2, PLAYER_Y - cardH / 2 - 10, w, cardH + 20, 10);
            }
        });
    }

    private handTitle(h: ViewState['playerHands'][number]): string {
        let title = `${h.label}  ${scoreLabel(h.total, h.soft)}  ·  $${h.bet}`;
        if (h.blackjack) title += '  BLACKJACK!';
        else if (h.outcome === 'win') title += '  WIN';
        else if (h.outcome === 'push') title += '  PUSH';
        else if (h.outcome === 'lose') title += h.total > 21 ? '  BUST' : '  LOSE';
        return title;
    }

    private handColor(h: ViewState['playerHands'][number]): string {
        if (h.blackjack) return OUTCOME_COLOR.blackjack;
        if (h.outcome) return OUTCOME_COLOR[h.outcome];
        return h.active ? COLOR.gold : COLOR.text;
    }

    private renderControls(v: ViewState): void {
        for (const { amount, button } of this.chipButtons) {
            const chip = v.chips.find((c) => c.amount === amount);
            button.setAvailability(chip ? chip.availability : 'unavailable');
        }
        this.showButton(this.clearButton, v.can.chips, v.can.clear);
        this.showButton(this.dealButton, v.can.chips, v.can.deal);

        const playing = v.phase === 'player';
        this.showButton(this.hitButton, playing, v.can.hit);
        this.showButton(this.standButton, playing, v.can.stand);
        this.showAvailability(this.doubleButton, v.can.double);
        this.showAvailability(this.splitButton, v.can.split);

        this.showButton(this.insuranceYes, v.can.insurance, true);
        this.showButton(this.insuranceNo, v.can.insurance, true);

        this.settingsButton.setEnabled(v.can.settings);
    }

    private showButton(button: Button, visible: boolean, enabled: boolean): void {
        button.setVisible(visible).setEnabled(enabled);
    }

    /** Impossible moves are hidden; legal-but-unaffordable ones are shown dimmed. */
    private showAvailability(button: Button, a: Availability): void {
        button.setVisible(a !== 'unavailable').setEnabled(a === 'ok');
    }
}
