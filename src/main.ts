import { inject } from "@vercel/analytics"
import StartGame from './game/main';

inject();

document.addEventListener('DOMContentLoaded', () => {
    StartGame('game-container');
});
