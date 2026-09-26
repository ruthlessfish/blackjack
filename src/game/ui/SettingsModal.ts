import { GameObjects, Scene } from 'phaser';
import { BANKROLL_OPTIONS, DECK_OPTIONS, DEFAULT_SETTINGS } from '../logic/constants';
import type { Settings, TableRules } from '../logic/types';
import { Button } from './Button';
import { bindClick } from './click';
import { addText, CANVAS_H, CANVAS_W, COLOR, FONT_TITLE, HEX } from './theme';

const PANEL_W = 640;
const PANEL_H = 700;
const LABEL_X = -PANEL_W / 2 + 40;

/** Each table rule as a labelled pair of buttons: [label, [text, value] for each choice]. */
const RULE_ROWS: { [K in keyof TableRules]: [string, [string, TableRules[K]][]] } = {
    blackjackPays: ['Blackjack pays', [['3 to 2', '3:2'], ['6 to 5', '6:5']]],
    dealerHitsSoft17: ['Soft 17', [['Dealer stands', false], ['Dealer hits', true]]],
    doubleAfterSplit: ['Double after split', [['On', true], ['Off', false]]],
    surrender: ['Surrender', [['Off', false], ['Late', true]]],
};

/**
 * The Standard-mode settings panel. It edits a private draft, so Cancel (or
 * clicking outside) throws the edits away and only Save reaches the game.
 * Bankroll is a row of presets because Phaser has no text input.
 */
export class SettingsModal extends GameObjects.Container {
    private draft: Settings = { ...DEFAULT_SETTINGS, rules: { ...DEFAULT_SETTINGS.rules } };
    /** Every option button, with how to tell whether the draft has it selected. */
    private readonly options: { selected: () => boolean; button: Button }[] = [];
    private readonly onSave: (next: Settings) => void;

    constructor(scene: Scene, onSave: (next: Settings) => void) {
        super(scene, CANVAS_W / 2, CANVAS_H / 2);
        this.onSave = onSave;

        // The dimmer swallows clicks so nothing behind the panel is reachable; clicking it cancels.
        const dim = scene.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x000000, 0.6).setInteractive();
        bindClick(dim, () => true, () => this.close());
        const panel = scene.add.graphics();
        panel.fillStyle(HEX.felt, 1).fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 18);
        panel.lineStyle(3, HEX.gold, 1).strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 18);
        // A second interactive layer under the panel's own controls stops clicks on it from reaching the dimmer.
        const panelHit = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, 0x000000, 0).setInteractive();

        this.add([dim, panel, panelHit]);
        this.add(addText(scene, 0, -PANEL_H / 2 + 40, 'Settings', { size: 34, bold: true, font: FONT_TITLE, color: COLOR.gold }));

        this.add(addText(scene, LABEL_X, -254, 'Decks in the shoe', { size: 20, bold: true, originX: 0 }));
        this.addOptionRow(
            DECK_OPTIONS.map((v) => [`${v}`, v] as [string, number]),
            0,
            -212,
            64,
            () => this.draft.decks,
            (v) => (this.draft.decks = v),
        );

        this.add(addText(scene, LABEL_X, -162, 'Starting bankroll', { size: 20, bold: true, originX: 0 }));
        this.addOptionRow(
            BANKROLL_OPTIONS.map((v) => [`$${v}`, v] as [string, number]),
            0,
            -120,
            84,
            () => this.draft.startingBalance,
            (v) => (this.draft.startingBalance = v),
        );
        this.add(
            addText(scene, 0, -80, 'Changing the bankroll resets your balance and stats. Changing decks reshuffles.', {
                size: 15,
                color: COLOR.dim,
            }),
        );

        this.add(addText(scene, LABEL_X, -36, 'Table rules', { size: 20, bold: true, color: COLOR.gold, originX: 0 }));
        this.addRuleRow('blackjackPays', 12);
        this.addRuleRow('dealerHitsSoft17', 68);
        this.addRuleRow('doubleAfterSplit', 124);
        this.addRuleRow('surrender', 180);
        this.add(
            addText(scene, 0, 226, 'Ask the Dealer follows these rules. Training always plays the defaults.', {
                size: 15,
                color: COLOR.dim,
            }),
        );

        this.add(
            new Button(scene, -90, PANEL_H / 2 - 50, {
                label: 'Save',
                width: 150,
                height: 48,
                variant: 'primary',
                onClick: () => this.save(),
            }),
        );
        this.add(new Button(scene, 90, PANEL_H / 2 - 50, { label: 'Cancel', width: 150, height: 48, onClick: () => this.close() }));

        this.setDepth(1000).setVisible(false);
        scene.add.existing(this);
    }

    /** Open with the table's live settings as the starting draft. */
    open(current: Settings): void {
        this.draft = { ...current, rules: { ...current.rules } };
        this.syncButtons();
        this.setVisible(true);
    }

    close(): void {
        this.setVisible(false);
    }

    /** The scene checks this so a key press does not act on the table behind the panel. */
    get isOpen(): boolean {
        return this.visible;
    }

    private save(): void {
        this.onSave({ ...this.draft, rules: { ...this.draft.rules } });
        this.close();
    }

    /** One table rule: its name on the left, its two choices on the right. */
    private addRuleRow<K extends keyof TableRules>(key: K, y: number): void {
        const [label, choices] = RULE_ROWS[key];
        this.add(addText(this.scene, LABEL_X, y, label, { size: 19, originX: 0 }));
        this.addOptionRow(
            choices,
            130,
            y,
            160,
            () => this.draft.rules[key],
            (v) => (this.draft.rules[key] = v),
        );
    }

    /** A row of buttons centred on `cx`, one per [text, value]; clicking one selects its value. */
    private addOptionRow<T>(
        choices: [string, T][],
        cx: number,
        y: number,
        width: number,
        get: () => T,
        set: (value: T) => void,
    ): void {
        const gap = 12;
        const total = choices.length * width + (choices.length - 1) * gap;
        choices.forEach(([text, value], i) => {
            const x = cx - total / 2 + width / 2 + i * (width + gap);
            const button = new Button(this.scene, x, y, {
                label: text,
                width,
                height: 44,
                fontSize: 19,
                onClick: () => {
                    set(value);
                    this.syncButtons();
                },
            });
            this.add(button);
            this.options.push({ selected: () => get() === value, button });
        });
    }

    private syncButtons(): void {
        for (const { selected, button } of this.options) button.setSelected(selected());
    }
}
