import { Scene, Textures } from 'phaser';
import type { CardView, Rank, Suit } from '../logic/types';
import { TEX } from './theme';

/** Native size of one card frame in sprites.png. */
export const CARD_W = 88;
export const CARD_H = 124;

/** sprites.png lists suits as spades, hearts, clubs, diamonds; the game's SUITS order differs. */
const SUIT_ROW: Record<Suit, number> = { '♠': 0, '♥': 1, '♣': 2, '♦': 3 };
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** The last row of the card area: four card backs and a blank stack, then the chips to the right. */
const BACKS_Y = 496;
const BACK_FRAMES = ['back-red', 'back-blue', 'stack-blue', 'stack-red', 'stack-blank'];

/** Chip frames are 62x70, on a 64 px pitch starting at x=441, in two rows. */
const CHIP_X = 441;
const CHIP_PITCH = 64;
const CHIP_W = 62;
const CHIP_H = 70;
const CHIP_ROWS: { y: number; colors: string[] }[] = [
    { y: 497, colors: ['white', 'red', 'green', 'blue', 'black'] },
    { y: 569, colors: ['yellow', 'orange', 'purple', 'pink', 'brown'] },
];

export const BACK_RED = 'back-red';
export const BACK_BLUE = 'back-blue';

/** Chip colour per denomination. The art carries no value, so the scene overlays a label. */
export const CHIP_COLOR: Record<number, string> = { 5: 'red', 25: 'green', 100: 'black' };

/** Frame name for a face-up card, or the red back for a face-down one. */
export function cardFrame(card: CardView | null): string {
    return card ? `${card.rank}${card.suit}` : BACK_RED;
}

export function chipFrame(amount: number): string {
    return `chip-${CHIP_COLOR[amount] ?? 'white'}`;
}

/**
 * sprites.png is not a uniform grid (cards are 124 px tall, chips 70), so the
 * frames are cut by hand rather than with `load.spritesheet`. Nearest-neighbour
 * filtering keeps the pixel art crisp when the scenes scale it.
 */
export function registerSpriteFrames(scene: Scene): void {
    const tex = scene.textures.get(TEX.sprites);

    for (const suit of Object.keys(SUIT_ROW) as Suit[]) {
        RANKS.forEach((rank, col) => {
            tex.add(`${rank}${suit}`, 0, col * CARD_W, SUIT_ROW[suit] * CARD_H, CARD_W, CARD_H);
        });
    }

    BACK_FRAMES.forEach((name, col) => tex.add(name, 0, col * CARD_W, BACKS_Y, CARD_W, CARD_H));

    for (const row of CHIP_ROWS) {
        row.colors.forEach((color, i) => {
            tex.add(`chip-${color}`, 0, CHIP_X + i * CHIP_PITCH, row.y, CHIP_W, CHIP_H);
        });
    }

    tex.setFilter(Textures.FilterMode.NEAREST);
}
