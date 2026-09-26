import { HowToPlay } from './scenes/HowToPlay';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { Standard } from './scenes/Standard';
import { Training } from './scenes/Training';
import { CANVAS_H, CANVAS_W, COLOR } from './ui/theme';
import { AUTO, Game, Scale, Types } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: CANVAS_W,
    height: CANVAS_H,
    parent: 'game-container',
    backgroundColor: COLOR.felt,
    // Every sound is synthesized in ui/sound.ts, so Phaser's own audio (and its AudioContext) is off.
    audio: { noAudio: true },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    // The first scene in the list is the one that starts.
    scene: [
        Preloader,
        MainMenu,
        Training,
        Standard,
        HowToPlay
    ]
};

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });

    // Dev-only handle so a browser session can read scene state (e.g. __phaser.scene.getScene('Standard').table.view()).
    if (import.meta.env.DEV) {
        (window as unknown as { __phaser?: Game }).__phaser = game;
    }

    return game;
}

export default StartGame;
