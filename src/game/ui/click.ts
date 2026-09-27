import { GameObjects, Geom } from 'phaser';

/**
 * Fire `onClick` for a press and release on the same object, the way a
 * button behaves everywhere else. A release alone does not count, so pressing
 * somewhere else and letting go over a button (or dragging off it first) does
 * nothing. `live` is checked at release time, so a hidden or disabled control
 * stays inert.
 */
export function bindClick(target: GameObjects.GameObject, live: () => boolean, onClick: () => void): void {
    let pressed = false;
    target.on('pointerdown', () => {
        pressed = true;
    });
    target.on('pointerout', () => {
        pressed = false;
    });
    target.on('pointerup', () => {
        const wasPressed = pressed;
        pressed = false;
        if (wasPressed && live()) onClick();
    });
}

/** Extra logical px of hit area around a control on touch screens; controls sit at least twice this apart. */
export const TOUCH_PAD = 8;

/**
 * Make a sized container clickable. On a touch screen the hit area reaches `TOUCH_PAD` past the art on
 * every side, since the FIT-scaled canvas makes controls small on a phone; with a mouse it is the art.
 */
export function setPaddedInteractive(target: GameObjects.Container): void {
    const pad = target.scene.sys.game.device.input.touch ? TOUCH_PAD : 0;
    // A container's hit area is measured from its top-left corner.
    const area = new Geom.Rectangle(-pad, -pad, target.width + 2 * pad, target.height + 2 * pad);
    target.setInteractive({ hitArea: area, hitAreaCallback: Geom.Rectangle.Contains, useHandCursor: true });
}
