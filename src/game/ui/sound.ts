/**
 * Every sound in the game, synthesized with the Web Audio API: there are no
 * audio files. Audio can be missing or blocked (old browsers, autoplay rules),
 * so like `storage.ts` nothing here throws; a sound that cannot play is skipped.
 */
export type SoundName = 'deal' | 'flip' | 'chip' | 'win' | 'blackjack' | 'lose' | 'push' | 'correct' | 'wrong';

const MASTER_VOLUME = 0.25;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

/** The shared context, made on first use. Null when the browser has no Web Audio. */
function context(): AudioContext | null {
    if (ctx) return ctx;
    try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = MASTER_VOLUME;
        master.connect(ctx.destination);
    } catch {
        ctx = null;
    }
    return ctx;
}

/**
 * Browsers only let audio start from a user gesture, but most sounds fire later
 * from tween callbacks. Resuming the context on the first press or key unlocks it
 * for good.
 */
export function installAudioUnlock(): void {
    const unlock = (): void => {
        const c = context();
        if (c && c.state === 'suspended') void c.resume().catch(() => {});
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
}

/** A second of white noise, made once and reused for every swish and tick. */
function noiseBuffer(c: AudioContext): AudioBuffer {
    if (noise) return noise;
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
}

/** A gain node that rises quickly to `peak` at `at`, then decays to silence over `length` seconds. */
function envelope(c: AudioContext, at: number, length: number, peak: number): GainNode {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    g.connect(master!);
    return g;
}

function tone(c: AudioContext, freq: number, at: number, length: number, type: OscillatorType = 'sine', peak = 0.6): void {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(envelope(c, at, length, peak));
    osc.start(at);
    osc.stop(at + length + 0.02);
}

/** Noise through a band-pass filter: a card sliding across felt, or a flick. */
function swish(c: AudioContext, at: number, length: number, centre: number, peak: number): void {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centre;
    filter.Q.value = 0.8;
    src.connect(filter).connect(envelope(c, at, length, peak));
    src.start(at, Math.random() * 0.5);
    src.stop(at + length + 0.02);
}

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, A3: 220, E3: 164.81, G4: 392 };

const SOUNDS: Record<SoundName, (c: AudioContext, t: number) => void> = {
    deal: (c, t) => swish(c, t, 0.07, 2600, 0.9),
    flip: (c, t) => swish(c, t, 0.04, 4000, 0.6),
    chip: (c, t) => {
        tone(c, 2500, t, 0.05, 'sine', 0.35);
        tone(c, 3200, t + 0.035, 0.06, 'sine', 0.3);
    },
    win: (c, t) => {
        tone(c, NOTE.C5, t, 0.14);
        tone(c, NOTE.G5, t + 0.1, 0.22);
    },
    blackjack: (c, t) => {
        [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(c, f, t + i * 0.08, i === 3 ? 0.3 : 0.12));
    },
    lose: (c, t) => {
        tone(c, NOTE.A3, t, 0.16, 'triangle');
        tone(c, NOTE.E3, t + 0.13, 0.26, 'triangle');
    },
    push: (c, t) => tone(c, NOTE.G4, t, 0.2, 'triangle'),
    correct: (c, t) => tone(c, NOTE.C6, t, 0.18, 'sine', 0.45),
    wrong: (c, t) => tone(c, 110, t, 0.22, 'square', 0.18),
};

export const sfx = {
    get muted(): boolean {
        return muted;
    },

    setMuted(value: boolean): void {
        muted = value;
    },

    /** Flip the mute setting and return the new one. */
    toggle(): boolean {
        muted = !muted;
        return muted;
    },

    play(name: SoundName): void {
        if (muted) return;
        // Only play once a gesture has made the context; a sound before then would be blocked anyway.
        if (!ctx || ctx.state !== 'running') return;
        try {
            SOUNDS[name](ctx, ctx.currentTime);
        } catch {
            // A sound is a nicety; the game carries on without it.
        }
    },
};
