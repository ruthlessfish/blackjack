import { GameObjects, Scene } from 'phaser';
import { addText, COLOR, HEX } from './theme';

/** The keycap drawn by How to Play's controls page is the size-18 cap; every other size scales from it. */
const BASE = 18;

/** How wide a cap for `key` is at this text size. */
export function keyCapWidth(key: string, size = BASE): number {
    const k = size / BASE;
    return Math.max(56 * k, (key.length * 11 + 24) * k);
}

/** A key drawn as a cream keycap with a gold rim, centred on (x, y). */
export function addKeyCap(scene: Scene, x: number, y: number, key: string, size = BASE): GameObjects.Container {
    const k = size / BASE;
    const w = keyCapWidth(key, size);
    const h = 36 * k;
    const r = 7 * k;
    const cap = scene.add.graphics();
    cap.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2 * k, -h / 2 + 2 * k, w, h, r);
    cap.fillStyle(0xf5f1e6, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    cap.lineStyle(Math.max(1, 2 * k), HEX.gold, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    const label = addText(scene, 0, 0, key, { size, bold: true, color: COLOR.ink });
    return scene.add.container(x, y, [cap, label]);
}
