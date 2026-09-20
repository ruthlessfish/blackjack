import { GameObjects, Scene } from 'phaser';
import type { Availability } from '../logic/types';
import { chipFrame } from './atlas';
import { FONT, TEX } from './theme';

/** A betting chip: the chip art with its denomination drawn on top. */
export class ChipButton extends GameObjects.Container {
    private readonly art: GameObjects.Image;
    private enabled = true;

    constructor(scene: Scene, x: number, y: number, amount: number, scale: number, onClick: () => void) {
        super(scene, x, y);

        this.art = scene.add.image(0, 0, TEX.sprites, chipFrame(amount)).setScale(scale);
        // Chips are photographed from above at an angle, so the face sits a little low of centre.
        const label = scene.add
            .text(0, 2 * scale, `$${amount}`, {
                fontFamily: FONT,
                fontSize: `${Math.round(17 * scale)}px`,
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
            })
            .setOrigin(0.5);
        this.add([this.art, label]);

        this.setSize(this.art.displayWidth, this.art.displayHeight);
        this.setInteractive({ useHandCursor: true });
        this.on('pointerover', () => this.enabled && this.setScale(1.1));
        this.on('pointerout', () => this.setScale(1));
        this.on('pointerup', () => {
            if (this.enabled && this.visible) onClick();
        });
        scene.add.existing(this);
    }

    /** `unavailable` hides the chip; `unaffordable` shows it dimmed. */
    setAvailability(availability: Availability): this {
        this.setVisible(availability !== 'unavailable');
        this.enabled = availability === 'ok';
        this.setAlpha(this.enabled ? 1 : 0.4);
        if (!this.enabled) this.setScale(1);
        return this;
    }
}
