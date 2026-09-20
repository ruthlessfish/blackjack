import { GameObjects, Scene } from 'phaser';

export const CANVAS_W = 1024;
export const CANVAS_H = 768;

/** Texture keys, registered once by the Preloader. */
export const TEX = {
    sprites: 'sprites',
    table: 'table',
    felt: 'felt',
} as const;

export const FONT = '"Trebuchet MS", "Segoe UI", Helvetica, Arial, sans-serif';
export const FONT_TITLE = 'Georgia, "Times New Roman", serif';

export const COLOR = {
    text: '#f5f1e6',
    dim: '#b9c9bd',
    gold: '#f2c94c',
    win: '#7dffa1',
    lose: '#ff8a8a',
    push: '#ffe08a',
    ink: '#10281a',
} as const;

/** Green multiply tint that turns the grey felt.png into a table-green. */
export const FELT_TINT = 0x3fae6a;

/** A grey-felt tile with a green tint, for screens that are not the table itself. */
export function addFeltBackground(scene: Scene): GameObjects.TileSprite {
    return scene.add
        .tileSprite(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, TEX.felt)
        .setTint(FELT_TINT)
        .setDepth(-10);
}

/** The gameplay table. Both are 4:3, so the scale is uniform. */
export function addTableBackground(scene: Scene): GameObjects.Image {
    return scene.add
        .image(CANVAS_W / 2, CANVAS_H / 2, TEX.table)
        .setDisplaySize(CANVAS_W, CANVAS_H)
        .setDepth(-10);
}

interface TextOptions {
    size?: number;
    color?: string;
    bold?: boolean;
    font?: string;
    align?: 'left' | 'center' | 'right';
    /** Origin x; 0.5 centres on `x`. */
    originX?: number;
    stroke?: boolean;
}

/** A label with the game's house style; the scene owns its lifetime. */
export function addText(
    scene: Scene,
    x: number,
    y: number,
    text: string,
    opts: TextOptions = {},
): GameObjects.Text {
    const size = opts.size ?? 20;
    return scene.add
        .text(x, y, text, {
            fontFamily: opts.font ?? FONT,
            fontSize: `${size}px`,
            fontStyle: opts.bold ? 'bold' : 'normal',
            color: opts.color ?? COLOR.text,
            align: opts.align ?? 'center',
            stroke: opts.stroke ? '#000000' : undefined,
            strokeThickness: opts.stroke ? Math.max(2, Math.round(size / 8)) : 0,
        })
        .setOrigin(opts.originX ?? 0.5, 0.5);
}

/** "12/22" for a soft hand, "17" otherwise. A soft 21 is just 21. */
export function scoreLabel(total: number, soft: boolean): string {
    return soft && total !== 21 ? `${total - 10}/${total}` : `${total}`;
}
