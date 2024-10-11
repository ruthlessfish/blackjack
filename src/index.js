import _ from 'lodash';

import Card from "./js/card.js";
import Deck from "./js/deck.js";
import { Player, Dealer } from "./js/player.js";
import './css/style.css';
import SpriteSheet from './assets/windows-playing-cards.png';

console.debug("shuffling a new deck");
const deck = new Deck();
deck.shuffle();

console.debug("load players");
const player = new Player("Player 1", 1000);
const dealer = new Dealer("Dealer");

console.debug("set up canvas context");
const canvas = document.getElementById("game-screen");
const ctx = canvas.getContext("2d");
console.debug("loading sprites");
const sprites = new Image();
sprites.src = SpriteSheet;

sprites.onload = () => {
  console.debug("sprites loaded");
  
  // this will be called inside of a while loop
  gameLoop();
};

const gameLoop = () => {
  console.debug(`Player name: ${player.name}`);
  console.debug(`cash available: ${player.bankroll}`);
  console.debug(`w/l/t: ${player.wins}/${player.losses}/${player.ties}`);
  console.debug(`Blackjacks: ${player.blackjacks}`);

  console.debug("Getting valid bet from player");
  // @todo: call getValidBet

  console.debug("Dealing cards");
  deal();
};

const deal = () => {
  let card;
  for (let i of [1, 2]) {
    console.debug(`Dealing card #${i} to player`);
    card = deck.draw();
    player.addCard(card);
    console.debug(card);
    console.debug(`Dealing card #${i} to dealer`);
    card = deck.draw();
    if (i === 1) {
      card.faceUp = false;
    }
    dealer.addCard(card);
    console.debug(card);
  }
  drawPlayerHand();
  drawDealerHand();
};

const getValidBet = () => {
  let bet = parseInt(prompt("Enter your bet:"));
  while (isNaN(bet) || bet < 0 || bet > player.balance) {
    bet = parseInt(prompt("Invalid bet. Enter your bet:"));
  }
  return bet;
};

const drawCard = (card, locX, locY) => {
  const width = Card.FRAME_WIDTH - 1;
  const height = Card.FRAME_HEIGHT - 1;
  if (card.isFaceUp()) {
    const {x, y} = card.getSpriteOffset();
    ctx.drawImage(sprites, x*width+1, y*height+1, width-1, height-1, locX, locY, width-1, height-1);
  } else {
    ctx.fillStyle = "darkblue";
    ctx.fillRect(locX, locY, width, height);
  }
};

const drawPlayerHand = () => {
  let hand = player.hand;
  let x = 200;
  let y = 400;
  for (let card of hand) {
    drawCard(card, x, y);
    x += 40;
  }
};

const drawDealerHand = (hideFirst = true) => {
  let hand = dealer.hand;
  let x = 200;
  let y = 100;
  for (let card of hand) {
    drawCard(card, x, y);
    x += 40;
  }
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