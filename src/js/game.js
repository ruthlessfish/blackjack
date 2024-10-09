// import Card from './card.js';
// import Deck from './deck.js';
// import {Player, Dealer} from './player.js';

const sprites = new Image();
sprites.src = 'assets/windows-playing-cards.png';

function draw() {
    const canvas = document.getElementById('game-board');

    const offsetX = offSetY = 1;
    const frameWidth = 73;
    const frameHeight = 98;
    const rows = 13;
    const cols = 4; 

    if (canvas.getContext) {
        const ctx = canvas.getContext('2d');
        for (let row = 0; row < rows; row++){
            for(let col = 0; col < cols; col++) {
                ctx.drawImage(
                  sprites,
                  row * frameWidth + 1,
                  col * frameHeight + 1,
                  frameWidth - 1,
                  frameHeight - 1,
                  row*20,
                  col*20,
                  frameWidth - 1,
                  frameHeight - 1
                );
            }
        } 
    } else {
        // canvas-unsupported code here
    }
}

window.addEventListener('load', draw);