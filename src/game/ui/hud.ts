import { GameObjects, Scene, Scenes } from 'phaser';
import { saveMuted } from '../storage';
import { Button } from './Button';
import { sfx } from './sound';
import { addText, COLOR, HEX } from './theme';

/** Scenes that have already asked to switch and are waiting for the scene manager to act on it. */
const leaving = new WeakSet<Scene>();

/**
 * Switch to another scene, once. Scene changes are queued until the next frame, so two presses landing
 * in the same frame (Enter and Space, or Esc and H) would otherwise start two scenes on top of each other.
 */
export function switchScene(scene: Scene, key: string, data?: object): void {
    if (leaving.has(scene)) return;
    leaving.add(scene);
    scene.events.once(Scenes.Events.SHUTDOWN, () => leaving.delete(scene));
    scene.scene.start(key, data);
}

/**
 * The Menu button in the top-left corner of the game screens, also on the `Esc` key. `canLeave` runs
 * first for Esc only, so a scene can use the key to close something of its own (and return false).
 */
export function addMenuButton(scene: Scene, canLeave: () => boolean = () => true): Button {
    const toMenu = (): void => {
        switchScene(scene, 'MainMenu');
    };
    scene.input.keyboard!.on('keydown-ESC', (event: KeyboardEvent) => {
        if (!event.repeat && canLeave()) toMenu();
    });
    return new Button(scene, 84, 40, {
        label: 'Menu',
        sublabel: 'Esc',
        width: 120,
        height: 52,
        fontSize: 20,
        onClick: toMenu,
    });
}

interface StatBoxOptions {
    width?: number;
    fillAlpha?: number;
    borderAlpha?: number;
    valueColor?: string;
    /** What the value shows before the first update. */
    value?: string;
}

/** A top-bar readout: a small caption over a large value in a rounded box. Returns the value text to update. */
export function addStatBox(scene: Scene, cx: number, caption: string, opts: StatBoxOptions = {}): GameObjects.Text {
    const width = opts.width ?? 160;
    const box = scene.add.graphics();
    box.fillStyle(0x000000, opts.fillAlpha ?? 0.45).fillRoundedRect(cx - width / 2, 12, width, 56, 10);
    box.lineStyle(2, HEX.gold, opts.borderAlpha ?? 0.5).strokeRoundedRect(cx - width / 2, 12, width, 56, 10);
    addText(scene, cx, 26, caption, { size: 12, bold: true, color: COLOR.dim });
    return addText(scene, cx, 49, opts.value ?? '', { size: 26, bold: true, color: opts.valueColor });
}

const soundLabel = (): string => (sfx.muted ? '🔇' : '🔊');

/** The sound toggle in the bottom-right corner of every screen, also on the `M` key. The setting is saved. */
export function addSoundToggle(scene: Scene): Button {
    const button = new Button(scene, 992, 736, {
        label: soundLabel(),
        width: 52,
        height: 52,
        fontSize: 20,
        onClick: () => toggle(),
    });
    const toggle = (): void => {
        saveMuted(sfx.toggle());
        button.setLabel(soundLabel());
    };
    scene.input.keyboard!.on('keydown-M', (event: KeyboardEvent) => {
        if (!event.repeat) toggle();
    });
    return button;
}
