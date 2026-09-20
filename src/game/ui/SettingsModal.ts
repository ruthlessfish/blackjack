import { GameObjects, Scene } from 'phaser';
import { BANKROLL_OPTIONS, DECK_OPTIONS, DEFAULT_SETTINGS } from '../logic/constants';
import type { Settings } from '../logic/types';
import { Button } from './Button';
import { bindClick } from './click';
import { addText, CANVAS_H, CANVAS_W, COLOR, FONT_TITLE, HEX } from './theme';

const PANEL_W = 640;
const PANEL_H = 480;

/**
 * The Standard-mode settings panel. It edits a private draft, so Cancel (or
 * clicking outside) throws the edits away and only Save reaches the game.
 * Bankroll is a row of presets because Phaser has no text input.
 */
export class SettingsModal extends GameObjects.Container {
    private draft: Settings = { ...DEFAULT_SETTINGS };
    private readonly deckButtons: { value: number; button: Button }[] = [];
    private readonly bankrollButtons: { value: number; button: Button }[] = [];
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
        this.add(addText(scene, 0, -PANEL_H / 2 + 44, 'Settings', { size: 34, bold: true, font: FONT_TITLE, color: COLOR.gold }));

        this.add(addText(scene, -PANEL_W / 2 + 40, -100, 'Decks in the shoe', { size: 20, bold: true, originX: 0 }));
        this.addOptionRow(DECK_OPTIONS, -50, 64, (v) => `${v}`, this.deckButtons, (v) => (this.draft.decks = v));

        this.add(addText(scene, -PANEL_W / 2 + 40, 40, 'Starting bankroll', { size: 20, bold: true, originX: 0 }));
        this.addOptionRow(BANKROLL_OPTIONS, 90, 84, (v) => `$${v}`, this.bankrollButtons, (v) => (this.draft.startingBalance = v));
        this.add(
            addText(scene, 0, 144, 'Changing the bankroll resets your balance. Changing decks reshuffles.', {
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
        this.draft = { ...current };
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
        this.onSave({ ...this.draft });
        this.close();
    }

    private addOptionRow(
        values: readonly number[],
        y: number,
        width: number,
        format: (value: number) => string,
        into: { value: number; button: Button }[],
        set: (value: number) => void,
    ): void {
        const gap = 12;
        const total = values.length * width + (values.length - 1) * gap;
        values.forEach((value, i) => {
            const x = -total / 2 + width / 2 + i * (width + gap);
            const button = new Button(this.scene, x, y, {
                label: format(value),
                width,
                height: 46,
                fontSize: 20,
                onClick: () => {
                    set(value);
                    this.syncButtons();
                },
            });
            this.add(button);
            into.push({ value, button });
        });
    }

    private syncButtons(): void {
        for (const { value, button } of this.deckButtons) button.setSelected(value === this.draft.decks);
        for (const { value, button } of this.bankrollButtons) {
            button.setSelected(value === this.draft.startingBalance);
        }
    }
}
