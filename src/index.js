import _ from 'lodash';

import Card from "./js/card.js";
import Deck from "./js/deck.js";
import { Player, Dealer } from "./js/player.js";
import './css/style.css';
import SpriteSheet from './assets/windows-playing-cards.png';

console.log("shuffling a new deck");
const deck = new Deck();
deck.shuffle();

console.log("load players");
const player = new Player("Player 1", 1000);
const dealer = new Dealer("Dealer");

console.log('set up canvas context');
const canvas = document.getElementById("game-screen");
const ctx = canvas.getContext("2d");
console.log('loading sprites');
const sprites = new Image();
sprites.src = SpriteSheet;

sprites.onload = () => {
  console.log('sprites loaded');
  
  // this will be called inside of a while loop
  gameLoop();
};

const gameLoop = () => {
  console.log(`Player name: ${player.name}`);
  console.log(`cash available: ${player.bankroll}`);
  console.log(`w/l/t: ${player.wins}/${player.losses}/${player.ties}`);
  console.log(`Blackjacks: ${player.blackjacks}`);

  console.log("Getting valid bet from player");
  // @todo: call getValidBet

  console.log("Dealing cards");
  deal();
};

const deal = () => {
  let card;
  for (let i of [1, 2]) {
    console.log(`Dealing card #${i} to player`);
    card = deck.draw();
    player.addCard(card);
    console.log(card);
    drawPlayerCard(card);
    console.log(`Dealing card #${i} to dealer`);
    card = deck.draw();
    dealer.addCard(card);
    console.log(card);
  }
};

const getValidBet = () => {
  let bet = parseInt(prompt("Enter your bet:"));
  while (isNaN(bet) || bet < 0 || bet > player.balance) {
    bet = parseInt(prompt("Invalid bet. Enter your bet:"));
  }
  return bet;
};

const drawPlayerCard = card => {
  // player hand area = 200, 400, 600, 500
  const width = Card.FRAME_WIDTH - 1;
  const height = Card.FRAME_HEIGHT - 1;
  const {x, y} = card.getSpriteOffset();
  console.log(x, y, width, height, x*width, y*height);
  ctx.drawImage(sprites,1, 1, width, height, 200, 400, width, height);
};

/*function handlePlayerTurn() {
  while(player.in_game) {
    let action = prompt("Enter your action (hit, stand, double down, split):");
    switch(action.toLowerCase()) {
      case "hit": 
        player.addCard(deck.draw());
        break;
      case "stand":
        player.in_game = false;
        break;
      case "double down":
        if (player.balance >= player.bet) {
          player.addCard(deck.draw());
          player.bet *= 2;
          player.in_game = false;
        } else {
          alert("Insufficient balance to double down.");
        }
        break;
      case "split":
        if (player.canSplit()) {
          player.split();
          player.addCard(deck.draw());
          player.splitHand.addCard(deck.draw());
          player.in_game = true;
          player.splitHand.in_game = true;
          handlePlayerTurn();
          handlePlayerTurn(player.splitHand);
        } else {
          alert("Cannot split.");
        }
        break;
      default:
        alert("Invalid action.");
    }
  }
}*/