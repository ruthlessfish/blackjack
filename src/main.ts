import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from '@vercel/speed-insights';
import StartGame from './game/main';

inject();
injectSpeedInsights();

document.addEventListener('DOMContentLoaded', () => {
    StartGame('game-container');
});
