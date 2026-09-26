import { GameObjects, Scene, Scenes } from 'phaser';
import { CHIPS, TIP_AMOUNT } from '../logic/constants';
import { StandardGame } from '../logic/StandardGame';
import type { Availability, PlayerHandView, TableStats, ViewState } from '../logic/types';
import { loadTable, saveTable } from '../storage';
import { BACK_BLUE, BACK_RED, CARD_H } from '../ui/atlas';
import { BetStack } from '../ui/BetStack';
import { Button } from '../ui/Button';
import { ChipButton } from '../ui/ChipButton';
import { HandView } from '../ui/HandView';
import { addMenuButton, addSoundToggle, addStatBox } from '../ui/hud';
import { Pile } from '../ui/Pile';
import { SettingsModal } from '../ui/SettingsModal';
import { sfx } from '../ui/sound';
import { addFeltBackground, addText, CANVAS_W, COLOR, HEX, scoreLabel } from '../ui/theme';

/** Where dealt cards slide in from: the shoe. */
const SHOE = { x: 930, y: 160 };
const DISCARD = { x: 94, y: 160 };
const PILE_SCALE = 0.6;

const DEALER_SCALE = 0.9;
const DEALER_Y = 138;
const PLAYER_Y = 572;

const CONTROLS_Y = 700;
const STATS_Y = 752;

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
    private statsText!: GameObjects.Text;
    private shoe!: Pile;
    private discard!: Pile;
    private settings!: SettingsModal;
    private settingsButton!: Button;
    /** The last snapshot written to storage, so an unchanged table is not written again. */
    private lastSaved = '';
    /** The view drawn last, so a render can tell what just happened and play its sound. */
    private prev: ViewState | null = null;

    private chipButtons: { amount: number; button: ChipButton }[] = [];
    private clearButton!: Button;
    private dealButton!: Button;
    private hitButton!: Button;
    private standButton!: Button;
    private doubleButton!: Button;
    private splitButton!: Button;
    private surrenderButton!: Button;
    private insuranceYes!: Button;
    private insuranceNo!: Button;
    private askButton!: Button;
    private tipYes!: Button;
    private tipNo!: Button;

    constructor() {
        super('Standard');
    }

    create() {
        this.playerHands = [];
        this.playerTitles = [];
        this.chipButtons = [];
        this.prev = null;

        addFeltBackground(this);
        this.buildHud();
        this.buildTable();
        this.buildControls();
        addSoundToggle(this);
        this.settings = new SettingsModal(this, (next) => this.table.applySettings(next));

        this.lastSaved = '';
        this.table = new StandardGame(
            (view) => {
                this.persist();
                this.render(view);
            },
            {
                saved: loadTable() ?? undefined,
                // The settled round is swept on the scene's clock, so it goes when the scene does.
                schedule: (fn, ms) => {
                    const timer = this.time.delayedCall(ms, fn);
                    return () => timer.remove();
                },
            },
        );
        this.events.once(Scenes.Events.SHUTDOWN, () => this.table.dispose());
        this.bindKeys();
        this.persist();
        this.render(this.table.view());
    }

    /**
     * Keyboard play. Each key just forwards to the table, which ignores a move that is not legal
     * right now, so the only guards here are for things the table cannot see: a held key, and the
     * settings panel being open in front of it.
     */
    private bindKeys(): void {
        const keyboard = this.input.keyboard!;
        const bind = (key: string, act: () => void): void => {
            keyboard.on(`keydown-${key}`, (event: KeyboardEvent) => {
                if (!event.repeat && !this.settings.isOpen) act();
            });
        };
        bind('H', () => this.table.hit());
        bind('S', () => this.table.stand());
        bind('D', () => this.table.double());
        bind('P', () => this.table.split());
        bind('R', () => this.table.surrender());
        bind('A', () => this.table.askDealer());
        // Insurance and the tip are never offered together, and each ignores Y/N outside its phase.
        bind('Y', () => {
            this.table.takeInsurance();
            this.table.tipDealer();
        });
        bind('N', () => {
            this.table.declineInsurance();
            this.table.declineTip();
        });
        bind('SPACE', () => this.table.deal());
        bind('ENTER', () => this.table.deal());
    }

    // ---- Layout ------------------------------------------------------------

    private buildHud(): void {
        addMenuButton(this);
        this.balanceText = addStatBox(this, CANVAS_W / 2 - 92, 'BALANCE');
        this.betText = addStatBox(this, CANVAS_W / 2 + 92, 'BET');

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
        this.statsText = addText(this, CANVAS_W / 2, STATS_Y, '', { size: 15, color: COLOR.dim });

        this.activeMark = this.add.graphics();
        this.betStack = new BetStack(this, CANVAS_W / 2, PLAYER_Y);
    }

    private buildControls(): void {
        const y = CONTROLS_Y;

        CHIPS.forEach((amount, i) => {
            const x = 232 + i * 90;
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

        const play = (x: number, label: string, onClick: () => void, width = 116): Button =>
            new Button(this, x, y, { label, width, height: 56, fontSize: 24, onClick });
        this.hitButton = play(180, 'Hit', () => this.table.hit());
        this.standButton = play(304, 'Stand', () => this.table.stand());
        this.doubleButton = play(428, 'Double', () => this.table.double());
        this.splitButton = play(552, 'Split', () => this.table.split());
        // Only shown when the table allows surrender and the opening hand is untouched.
        this.surrenderButton = play(692, 'Surrender', () => this.table.surrender(), 144);

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

        this.askButton = new Button(this, 850, y, {
            label: 'Ask dealer',
            width: 150,
            height: 56,
            fontSize: 20,
            onClick: () => this.table.askDealer(),
        });
        this.tipYes = new Button(this, 400, y, {
            label: `Tip $${TIP_AMOUNT}`,
            width: 230,
            height: 56,
            fontSize: 22,
            onClick: () => this.table.tipDealer(),
        });
        this.tipNo = new Button(this, 640, y, {
            label: 'No thanks',
            width: 200,
            height: 56,
            fontSize: 22,
            variant: 'primary',
            onClick: () => this.table.declineTip(),
        });
    }

    // ---- Rendering ---------------------------------------------------------

    /**
     * Save the table after every change, so a reload mid-round forfeits the bet
     * rather than undoing it. Most changes (a hit, a settled sweep) leave the
     * saved fields alone, so only a real difference is written.
     */
    private persist(): void {
        const snapshot = this.table.snapshot();
        const text = JSON.stringify(snapshot);
        if (text === this.lastSaved) return;
        this.lastSaved = text;
        saveTable(snapshot);
    }

    private render(v: ViewState): void {
        this.balanceText.setText(`$${v.balance}`).setColor(this.balanceColor(v));
        this.betText.setText(`$${v.betDisplay}`);
        this.shoe.set(v.shoeRemaining, v.shoeTotal, 'in shoe');
        this.discard.set(v.shoeDiscarded, v.shoeTotal, 'discarded');

        const dealerLands = this.dealerHand.setCards(v.dealer, SHOE);
        this.dealerScore.setText(
            v.dealerTotal !== null
                ? `Dealer ${scoreLabel(v.dealerTotal, v.dealerSoft)}`
                : v.dealer.length
                  ? 'Dealer ?'
                  : '',
        );

        const playerLands = this.renderPlayerHands(v);
        // With no hands on the table the bet is shown as chips at the spot; once dealt it is on the hand titles.
        this.betStack.setAmount(v.playerHands.length === 0 ? v.betDisplay : 0);

        this.message
            .setText(v.message.text)
            .setColor(v.message.kind ? OUTCOME_COLOR[v.message.kind] : COLOR.text);

        this.statsText.setText(this.statsLine(v.stats));
        this.renderControls(v);
        this.playSounds(v, Math.max(dealerLands, playerLands));
        this.prev = v;
    }

    /** Chip clicks while betting, and the result once a round settles and its last cards have landed. */
    private playSounds(v: ViewState, cardsLandIn: number): void {
        const prev = this.prev;
        if (!prev) return;
        if (prev.phase === 'betting' && v.phase === 'betting' && v.betDisplay !== prev.betDisplay) {
            sfx.play('chip');
        }
        // Every settlement adds a round. A natural settles inside the deal, never showing a phase in
        // play, so the count is the signal rather than the phase.
        const settled = v.stats.rounds > prev.stats.rounds;
        const kind = v.message.kind;
        if (settled && kind) this.time.delayedCall(cardsLandIn, () => sfx.play(kind));
    }

    private statsLine(s: TableStats): string {
        return [
            `Rounds ${s.rounds}`,
            `W ${s.wins}  L ${s.losses}  P ${s.pushes}`,
            `Blackjacks ${s.blackjacks}`,
            `Best win $${s.biggestWin}`,
            `Peak $${s.peakBalance}`,
        ].join('  ·  ');
    }

    /**
     * Green above the starting bankroll, red below. Chips already staked on the table still count as
     * yours. While a tip is pending the round is paid out, so the balance is already the whole story.
     */
    private balanceColor(v: ViewState): string {
        const worth = v.phase === 'betting' || v.phase === 'tip' ? v.balance : v.balance + v.betDisplay;
        if (worth > v.settings.startingBalance) return COLOR.win;
        if (worth < v.settings.startingBalance) return COLOR.lose;
        return COLOR.text;
    }

    /** Returns how many ms until the last newly dealt card lands. */
    private renderPlayerHands(v: ViewState): number {
        const n = v.playerHands.length;
        const { xs, scale } = playerSlots(n);

        // A split adds one hand. The half it splits off, and any hands pushed along after it, slide
        // over from where they sat rather than being dealt from the shoe again. The split-off half is
        // the first hand after the first that holds a single card.
        const before = this.playerHands.map((view) => ({ x: view.x, y: view.y }));
        const splitAt =
            n === before.length + 1 ? v.playerHands.findIndex((h, i) => i > 0 && h.cards.length === 1) : -1;

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
        let landsIn = 0;

        v.playerHands.forEach((h, i) => {
            const view = this.playerHands[i];
            view.setCardScale(scale);
            view.setPosition(xs[i], PLAYER_Y);
            landsIn = Math.max(landsIn, view.setCards(h.cards, splitAt >= 0 && i >= splitAt ? before[i - 1] : SHOE));

            const title = this.playerTitles[i];
            title.setPosition(xs[i], PLAYER_Y - cardH / 2 - 24);
            title.setText(this.handTitle(h)).setColor(this.handColor(h));

            if (h.active) {
                const w = view.spanFor(h.cards.length) + 24;
                this.activeMark
                    .lineStyle(3, HEX.gold, 0.95)
                    .strokeRoundedRect(xs[i] - w / 2, PLAYER_Y - cardH / 2 - 10, w, cardH + 20, 10);
            }
        });
        return landsIn;
    }

    private handTitle(h: PlayerHandView): string {
        let title = `${h.label}  ${scoreLabel(h.total, h.soft)}  ·  $${h.bet}`;
        if (h.blackjack) title += '  BLACKJACK!';
        else if (h.outcome === 'win') title += '  WIN';
        else if (h.surrendered) title += '  SURRENDER';
        else if (h.outcome === 'push') title += '  PUSH';
        else if (h.outcome === 'lose') title += h.total > 21 ? '  BUST' : '  LOSE';
        return title;
    }

    private handColor(h: PlayerHandView): string {
        if (h.blackjack) return OUTCOME_COLOR.blackjack;
        if (h.outcome) return OUTCOME_COLOR[h.outcome];
        return h.active ? COLOR.gold : COLOR.text;
    }

    private renderControls(v: ViewState): void {
        for (const { amount, button } of this.chipButtons) {
            const chip = v.chips.find((c) => c.amount === amount);
            button.setAvailability(chip ? chip.availability : 'unavailable');
        }
        this.showAvailability(this.clearButton, v.can.clear);
        this.showAvailability(this.dealButton, v.can.deal);
        this.showAvailability(this.hitButton, v.can.hit);
        this.showAvailability(this.standButton, v.can.stand);
        this.showAvailability(this.doubleButton, v.can.double);
        this.showAvailability(this.splitButton, v.can.split);
        this.showAvailability(this.surrenderButton, v.can.surrender);
        this.showAvailability(this.insuranceYes, v.can.insurance);
        this.showAvailability(this.insuranceNo, v.can.insurance);
        this.showAvailability(this.askButton, v.can.ask);
        this.showAvailability(this.tipYes, v.can.tip);
        this.showAvailability(this.tipNo, v.can.tip);

        this.settingsButton.setEnabled(v.can.settings);
    }

    /** Controls with no place right now are hidden; ones that exist but can't be used yet are shown dimmed. */
    private showAvailability(button: Button, a: Availability): void {
        button.setVisible(a !== 'unavailable').setEnabled(a === 'ok');
    }
}
