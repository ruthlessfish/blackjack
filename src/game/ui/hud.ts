import { GameObjects, Scene } from 'phaser';
import { saveMuted } from '../storage';
import { Button } from './Button';
import { sfx } from './sound';
import { addText, COLOR, HEX } from './theme';

/** The Menu button in the top-left corner of both game screens. */
export function addMenuButton(scene: Scene): Button {
    return new Button(scene, 84, 40, {
        label: 'Menu',
        width: 120,
        height: 44,
        fontSize: 20,
        onClick: () => scene.scene.start('MainMenu'),
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
    const button = new Button(scene, 996, 740, {
        label: soundLabel(),
        width: 44,
        height: 44,
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
