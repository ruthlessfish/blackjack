import { GameObjects, Scene } from 'phaser';
import { CARD_H, CARD_W } from './atlas';
import { COLOR, FONT, TEX } from './theme';

const MAX_LAYERS = 8;
const LAYER_RISE = 2; // px each extra card lifts the pile

/**
 * The shoe or the discard tray: a stack of card backs whose height tracks how
 * full it is, with a count underneath. Thickness is presentation only; the
 * counts come from the game.
 */
export class Pile extends GameObjects.Container {
    private layers: GameObjects.Image[] = [];
    private readonly outline: GameObjects.Graphics;
    private readonly label: GameObjects.Text;
    private readonly frame: string;
    private readonly pileScale: number;

    constructor(scene: Scene, x: number, y: number, frame: string, pileScale: number) {
        super(scene, x, y);
        this.frame = frame;
        this.pileScale = pileScale;

        const w = CARD_W * pileScale;
        const h = CARD_H * pileScale;
        this.outline = scene.add.graphics();
        this.outline
            .lineStyle(2, 0xffffff, 0.35)
            .strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
        this.label = scene.add
            .text(0, h / 2 + 16, '', { fontFamily: FONT, fontSize: '15px', color: COLOR.text })
            .setOrigin(0.5);
        this.add([this.outline, this.label]);
        scene.add.existing(this);
    }

    set(count: number, total: number, word: string): void {
        const wanted = count === 0 || total === 0 ? 0 : 1 + Math.round((MAX_LAYERS - 1) * (count / total));

        while (this.layers.length > wanted) this.layers.pop()!.destroy();
        while (this.layers.length < wanted) {
            const i = this.layers.length;
            const img = this.scene.add
                .image(0, -i * LAYER_RISE, TEX.sprites, this.frame)
                .setScale(this.pileScale);
            this.add(img);
            this.layers.push(img);
        }

        this.outline.setVisible(wanted === 0);
        this.label.setText(`${count} ${word}`);
    }
}
