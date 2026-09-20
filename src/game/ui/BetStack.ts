import { GameObjects, Scene } from 'phaser';
import { CHIPS } from '../logic/constants';
import { chipFrame } from './atlas';
import { addChipLabel, TEX } from './theme';

const CHIP_RISE = 6; // px each chip in a column lifts the next
const MAX_PER_COLUMN = 8;
const COLUMN_GAP = 76;
const SCALE = 1.1;

/** The bet as physical chips: one column per denomination, biggest on the left. */
export class BetStack extends GameObjects.Container {
    private shownAmount = -1;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
    }

    setAmount(amount: number): void {
        if (amount === this.shownAmount) return;
        this.shownAmount = amount;
        this.removeAll(true);

        // Break the bet into the fewest chips, largest first.
        const counts: { chip: number; n: number }[] = [];
        let left = amount;
        for (const chip of [...CHIPS].sort((a, b) => b - a)) {
            const n = Math.floor(left / chip);
            left -= n * chip;
            if (n > 0) counts.push({ chip, n });
        }

        counts.forEach(({ chip, n }, col) => {
            const x = (col - (counts.length - 1) / 2) * COLUMN_GAP;
            const shown = Math.min(n, MAX_PER_COLUMN);
            for (let i = 0; i < shown; i++) {
                this.add(this.scene.add.image(x, -i * CHIP_RISE, TEX.sprites, chipFrame(chip)).setScale(SCALE));
            }
            // The art carries no value, so the top chip of each column is labelled like the chip buttons.
            this.add(addChipLabel(this.scene, x, -(shown - 1) * CHIP_RISE + 2 * SCALE, `$${chip}`, Math.round(17 * SCALE)));
            // A tall column is capped in height; the count says how many there really are.
            if (n > shown) this.add(addChipLabel(this.scene, x, 34, `×${n}`, 16));
        });
    }
}
