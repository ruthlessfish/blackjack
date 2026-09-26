import { Scene } from 'phaser';
import { loadTable, loadTraining } from '../storage';
import { CHIPS, DEFAULT_SETTINGS } from '../logic/constants';
import { rulesSummary } from '../logic/settings';
import { accuracyPct } from '../logic/TrainingSession';
import { Button } from '../ui/Button';
import { chipFrame } from '../ui/atlas';
import { addFeltBackground, addText, CANVAS_W, COLOR, FONT_TITLE, TEX } from '../ui/theme';

export class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        addFeltBackground(this);
        this.decorate();

        const cx = CANVAS_W / 2;
        addText(this, cx, 150, 'Blackjack', {
            size: 88,
            bold: true,
            font: FONT_TITLE,
            color: COLOR.gold,
            stroke: true,
        });
        addText(this, cx, 222, 'Pick a mode', { size: 24, color: COLOR.text, stroke: true });

        // The saved stats are read fresh each time the menu opens, so they are current after a session.
        const training = loadTraining();
        const pct = accuracyPct(training.handsSeen, training.handsCorrect);
        const accuracy = pct === null ? 'no hands yet' : `${Math.round(pct)}% correct`;
        const table = loadTable();
        const bankroll = table ? table.balance : DEFAULT_SETTINGS.startingBalance;

        new Button(this, cx, 350, {
            label: 'Training',
            sublabel: `Drill Basic Strategy  ·  best streak ${training.bestStreak}  ·  ${accuracy}`,
            width: 680,
            height: 108,
            fontSize: 38,
            variant: 'primary',
            onClick: () => this.scene.start('Training'),
        });
        new Button(this, cx, 490, {
            label: 'Standard',
            sublabel: `Play against the dealer  ·  bankroll $${bankroll}`,
            width: 680,
            height: 108,
            fontSize: 38,
            onClick: () => this.scene.start('Standard'),
        });

        addText(this, cx, 568, rulesSummary(table ? table.rules : DEFAULT_SETTINGS.rules), {
            size: 16,
            color: COLOR.dim,
        });
        new Button(this, cx, 626, {
            label: 'How to Play',
            sublabel: 'key H',
            width: 240,
            height: 58,
            fontSize: 22,
            onClick: () => this.scene.start('HowToPlay'),
        });
        this.input.keyboard!.on('keydown-H', () => this.scene.start('HowToPlay'));

        addText(this, cx, 752, '© 2026 Shane Pearson. All rights reserved.', { size: 13, color: COLOR.dim });
    }

    /** A fan of cards and a few chips, cut from the same sprite sheet as the game. */
    private decorate(): void {
        // Kept below the buttons and clear of the footer line, in the two bottom corners.
        const fan: { frame: string; x: number; y: number; angle: number }[] = [
            { frame: 'A♠', x: 110, y: 640, angle: -14 },
            { frame: 'K♥', x: 150, y: 634, angle: 0 },
            { frame: 'Q♦', x: 190, y: 640, angle: 14 },
        ];
        for (const c of fan) {
            this.add.image(c.x, c.y, TEX.sprites, c.frame).setScale(1.05).setAngle(c.angle);
        }
        CHIPS.forEach((amount, i) => {
            this.add
                .image(840 + i * 34, 646 - (i % 2) * 18, TEX.sprites, chipFrame(amount))
                .setScale(1.3)
                .setAngle(i * 12 - 10);
        });
    }
}
