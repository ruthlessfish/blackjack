import { Scene } from 'phaser';
import { registerSpriteFrames } from '../ui/atlas';
import { addText, CANVAS_H, CANVAS_W, COLOR, HEX, TEX } from '../ui/theme';

/** Loads the three image assets once, cuts the sprite frames, then hands over to the menu. */
export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        this.cameras.main.setBackgroundColor(COLOR.felt);

        const barW = 360;
        const cx = CANVAS_W / 2;
        const cy = CANVAS_H / 2;
        addText(this, cx, cy - 40, 'Shuffling…', { size: 26, color: COLOR.gold, bold: true });
        this.add.rectangle(cx, cy, barW, 14, 0x000000, 0.4).setStrokeStyle(2, HEX.gold);
        const fill = this.add.rectangle(cx - barW / 2, cy, 0, 10, HEX.gold).setOrigin(0, 0.5);
        this.load.on('progress', (p: number) => fill.setSize(barW * p, 10));

        this.load.setPath('assets');
        this.load.image(TEX.sprites, 'sprites.png');
        this.load.image(TEX.table, 'table.png');
        this.load.image(TEX.felt, 'felt.png');
    }

    create() {
        registerSpriteFrames(this);
        this.scene.start('MainMenu');
    }
}
