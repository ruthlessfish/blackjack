import { GameObjects } from 'phaser';

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
