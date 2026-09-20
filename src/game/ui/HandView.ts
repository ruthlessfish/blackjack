import { GameObjects, Scene } from 'phaser';
import type { CardView } from '../logic/types';
import { CARD_W, cardFrame } from './atlas';
import { TEX } from './theme';

const DEAL_MS = 260;
const SHIFT_MS = 140;
const FLIP_MS = 110;

/** Where a newly dealt card starts its slide from, in world coordinates. */
export interface Point {
    x: number;
    y: number;
}

/**
 * A row of overlapping cards centred on its own position. It diffs against
 * what is already showing, so a scene can hand it the whole hand on every
 * render and only the new card slides in (and a hole card flips over).
 */
export class HandView extends GameObjects.Container {
    /** `x` is where the card is headed, so a re-render mid-slide can tell it need not move it again. */
    private shown: { key: string; img: GameObjects.Image; x: number }[] = [];
    private cardScale: number;
    /** Distance between neighbouring cards as a share of a card's width: below 1 overlaps, above 1 leaves a gap. */
    private readonly step: number;

    constructor(scene: Scene, x: number, y: number, cardScale: number, step = 0.6) {
        super(scene, x, y);
        this.cardScale = cardScale;
        this.step = step;
        scene.add.existing(this);
    }

    /** Width of the row for `n` cards. */
    spanFor(n: number): number {
        const cw = CARD_W * this.cardScale;
        return n === 0 ? 0 : cw + (n - 1) * cw * this.step;
    }

    /** Take every card off the table, so the next `setCards` deals them all in fresh. */
    clear(): void {
        for (const s of this.shown) {
            this.scene.tweens.killTweensOf(s.img);
            s.img.destroy();
        }
        this.shown = [];
    }

    /** Resize the cards already showing; the next `setCards` re-slots them. */
    setCardScale(scale: number): void {
        if (scale === this.cardScale) return;
        this.cardScale = scale;
        for (const s of this.shown) s.img.setScale(scale);
    }

    setCards(cards: (CardView | null)[], dealFrom?: Point): void {
        const keys = cards.map(cardFrame);
        const count = cards.length;

        // Anything past the new length is gone (a swept table).
        while (this.shown.length > count) this.shown.pop()!.img.destroy();

        for (let i = 0; i < count; i++) {
            const target = this.slotX(i, count);
            const existing = this.shown[i];

            if (existing && existing.key === keys[i]) {
                if (existing.x !== target) this.shift(existing.img, target);
                existing.x = target;
                continue;
            }

            if (existing && existing.key === cardFrame(null)) {
                this.flip(existing.img, keys[i], target);
                existing.key = keys[i];
                existing.x = target;
                continue;
            }

            existing?.img.destroy();
            const img = this.scene.add.image(target, 0, TEX.sprites, keys[i]).setScale(this.cardScale);
            this.add(img);
            this.shown[i] = { key: keys[i], img, x: target };

            if (dealFrom) {
                img.setPosition(dealFrom.x - this.x, dealFrom.y - this.y).setAlpha(0.2);
                this.scene.tweens.add({
                    targets: img,
                    x: target,
                    y: 0,
                    alpha: 1,
                    duration: DEAL_MS,
                    ease: 'Cubic.easeOut',
                });
            }
        }
    }

    private slotX(i: number, count: number): number {
        const cw = CARD_W * this.cardScale;
        return -this.spanFor(count) / 2 + cw / 2 + i * cw * this.step;
    }

    /** Slide a card that is already on the table to a new slot (the row re-centres as it grows). */
    private shift(img: GameObjects.Image, x: number): void {
        // A card still flying in is finished off first so it cannot be left mid-air.
        this.scene.tweens.killTweensOf(img);
        img.setY(0).setAlpha(1);
        this.scene.tweens.add({ targets: img, x, duration: SHIFT_MS, ease: 'Sine.easeOut' });
    }

    /** Turn a face-down card over: squash to nothing, swap the frame, expand. */
    private flip(img: GameObjects.Image, frame: string, x: number): void {
        this.scene.tweens.killTweensOf(img);
        img.setX(x);
        this.scene.tweens.add({
            targets: img,
            scaleX: 0,
            duration: FLIP_MS,
            onComplete: () => {
                img.setFrame(frame);
                this.scene.tweens.add({ targets: img, scaleX: this.cardScale, duration: FLIP_MS });
            },
        });
    }
}
