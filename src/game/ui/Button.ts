import { GameObjects, Scene } from 'phaser';
import { bindClick } from './click';
import { COLOR, FONT, HEX } from './theme';

export interface ButtonOptions {
    label: string;
    /** A smaller second line, e.g. a keyboard hint or a saved stat. */
    sublabel?: string;
    width: number;
    height: number;
    fontSize?: number;
    /** `primary` is the gold call-to-action. */
    variant?: 'default' | 'primary';
    onClick: () => void;
}

const FILL = { default: 0x1c5a34, primary: HEX.gold } as const;
const FILL_HOVER = { default: 0x287a48, primary: 0xffdf7a } as const;
const FILL_SELECTED = 0x3fae6a;
const FILL_DISABLED = 0x2b3a31;

/** A rounded text button drawn with Graphics (the art has no button frames). */
export class Button extends GameObjects.Container {
    private readonly bg: GameObjects.Graphics;
    private readonly title: GameObjects.Text;
    private readonly sub: GameObjects.Text | null = null;
    private readonly opts: ButtonOptions;
    private enabled = true;
    private hovering = false;
    private selected = false;

    constructor(scene: Scene, x: number, y: number, opts: ButtonOptions) {
        super(scene, x, y);
        this.opts = opts;

        this.bg = scene.add.graphics();
        const size = opts.fontSize ?? 22;
        const primary = opts.variant === 'primary';
        const hasSub = opts.sublabel !== undefined;

        this.title = scene.add
            .text(0, hasSub ? -opts.height * 0.16 : 0, opts.label, {
                fontFamily: FONT,
                fontSize: `${size}px`,
                fontStyle: 'bold',
                color: primary ? COLOR.ink : COLOR.text,
            })
            .setOrigin(0.5);
        this.add([this.bg, this.title]);

        if (hasSub) {
            this.sub = scene.add
                .text(0, opts.height * 0.24, opts.sublabel!, {
                    fontFamily: FONT,
                    fontSize: `${Math.round(size * 0.62)}px`,
                    color: primary ? COLOR.ink : COLOR.dim,
                })
                .setOrigin(0.5);
            this.add(this.sub);
        }

        this.setSize(opts.width, opts.height);
        this.setInteractive({ useHandCursor: true });
        this.on('pointerover', () => this.setHover(true));
        this.on('pointerout', () => this.setHover(false));
        bindClick(this, () => this.enabled && this.visible, opts.onClick);

        this.redraw();
        scene.add.existing(this);
    }

    setEnabled(enabled: boolean): this {
        this.enabled = enabled;
        if (!enabled) this.hovering = false;
        this.redraw();
        return this;
    }

    /** Toggle the highlighted look used by option pickers. */
    setSelected(selected: boolean): this {
        this.selected = selected;
        this.redraw();
        return this;
    }

    setLabel(label: string): this {
        this.title.setText(label);
        return this;
    }

    /** Only for a button built with a sublabel; one without has no line to change. */
    setSublabel(sublabel: string): this {
        this.sub?.setText(sublabel);
        return this;
    }

    private setHover(hovering: boolean): void {
        this.hovering = hovering && this.enabled;
        this.redraw();
    }

    private redraw(): void {
        const { width, height, variant } = this.opts;
        const kind = variant ?? 'default';
        let fill: number = this.hovering ? FILL_HOVER[kind] : FILL[kind];
        if (this.selected) fill = FILL_SELECTED;
        if (!this.enabled) fill = FILL_DISABLED;

        this.bg.clear();
        this.bg.fillStyle(0x000000, 0.35).fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width, height, 12);
        this.bg.fillStyle(fill, 1).fillRoundedRect(-width / 2, -height / 2, width, height, 12);
        this.bg
            .lineStyle(2, this.enabled ? HEX.gold : 0x55665b, this.selected ? 1 : 0.85)
            .strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
        this.setAlpha(this.enabled ? 1 : 0.55);
    }
}
