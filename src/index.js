'use strict';

import _ from 'lodash';
import Card from "./js/card.js";
import Deck from "./js/deck.js";
import { Player, Dealer } from "./js/player.js";
import './css/style.css';
import SpriteSheet from './assets/sprites.png';

const player = new Player("Player 1", 1000);
const dealer = new Dealer("Dealer");
const deck = new Deck();
deck.shuffle();

const canvas = document.getElementById("blackjack-table");
const ctx = canvas.getContext("2d");
const sprites = new Image();
sprites.fetchPriority = "high";
sprites.loading = "eager";
sprites.src = SpriteSheet;

let message = document.getElementById("message");
let betAmount = 0;

// user controls
const bettingControls = document.getElementById("betting-controls");
const bet5Button = document.getElementById("bet-5");
const bet10Button = document.getElementById("bet-10");
const bet25Button = document.getElementById("bet-25");
const bet50Button = document.getElementById("bet-50");
const bet100Button = document.getElementById("bet-100");
const bet500Button = document.getElementById("bet-500");
const clearBetButton = document.getElementById("clear-bet");
const dealButton = document.getElementById("deal-button");

const handleBetButtonClick = function(e) {
  let amount = parseInt(e.target.textContent);
  if (player.bankroll >= betAmount + amount) {
    betAmount += amount;
    message.textContent = `Bet: $${betAmount}`;
  }
};

bet5Button.addEventListener("click", handleBetButtonClick);
bet10Button.addEventListener("click", handleBetButtonClick);
bet25Button.addEventListener("click", handleBetButtonClick);
bet50Button.addEventListener("click", handleBetButtonClick);
bet100Button.addEventListener("click", handleBetButtonClick);
bet500Button.addEventListener("click", handleBetButtonClick);

clearBetButton.addEventListener("click", function(e) {
  betAmount = 0;
  message.textContent = "Place your bet:";
});

dealButton.addEventListener("click", function(e) {
  if (betAmount > 0) {
    player.placeBet(betAmount);
    bettingControls.style.display = "none";
    gameControls.style.display = "block";
    betAmount = 0;
    deal();
  }
});

// game controls
const gameControls = document.getElementById("game-controls");
const splitButton = document.getElementById("split-button");
const hitButton = document.getElementById("hit-button");
const standButton = document.getElementById("stand-button");
const doubleButton = document.getElementById("double-button");

hitButton.addEventListener("click", (e) => {
  if (!hitButton.disabled) {
    let newCard = deck.draw();
    player.addCard(newCard);
    drawPlayerHand();
    checkPlayerHand();
  }
});

standButton.addEventListener("click", (e) => {
  if (!standButton.disabled) {
    endPlayerTurn();
  }
});

const playerNameEl = document.getElementById("player-name");
const playerBankrollEl = document.getElementById("player-bankroll");
const playerWinsEl = document.getElementById("player-wins");

const drawPlayerInfo = () => {
  playerNameEl.textContent = player.name;
  playerBankrollEl.textContent = `\$${player.bankroll}`;
  playerWinsEl.textContent = `${player.wins}`;
};

/**
 * Deals cards to the player and dealer.
 */
const deal = () => {
  let card;
  player.addCard(deck.draw());
  dealer.addCard(deck.draw(true));
  player.addCard(deck.draw());
  dealer.addCard(deck.draw());
  drawPlayerHand();
  drawDealerHand();
  hitButton.disabled = false;
  standButton.disabled = false;
  checkPlayerHand();
};

/**
 * Prompts the user to enter a valid bet amount.
 * The bet amount must be a positive number and cannot exceed the player's balance.
 *
 * @returns {number} The valid bet amount entered by the user.
 */
const getValidBet = () => {
  let bet = parseInt(prompt("Enter your bet:"));
  while (isNaN(bet) || bet < 0 || bet > player.balance) {
    bet = parseInt(prompt("Invalid bet. Enter your bet:"));
  }
  return bet;
};

/**
 * Handles the player's turn in the game.
 */
const checkPlayerHand = () => {
  if (player.hasBlackjack() || player.isBusted()) {
    endPlayerTurn();
  }
};

const endPlayerTurn = () => {
  hitButton.disabled = true;
  standButton.disabled = true;
  handleDealerTurn();
  determineWinner();
  setTimeout(resetGame, 3000);
};

/**
 * Handles the dealer's turn in a blackjack game.
 */
const handleDealerTurn = () => {
  dealer.hand[0].flip();
  drawDealerHand();
  if (!player.isBusted()) {
    let dealerScore = dealer.score;
    while (dealerScore < 17) {
      let newCard = deck.draw();
      dealer.addCard(newCard);
      dealerScore = dealer.score;
      drawDealerHand();
    }
  }
};

/**
 * Determines the winner of the game based on the player and dealer scores.
 * Displays appropriate messages and updates player's win/loss record.
 */
const determineWinner = () => {
  if (player.isBusted()) {
    message.textContent = "Dealer wins.";
    player.lose();
  } else if (dealer.isBusted()) {
    message.textContent = "You win.";
    player.win();
  } else if (player.hasBlackjack()) {
    message.textContent = "Blackjack! You win!";
    player.win(true);
  } else if (player.score == dealer.score) {
    message.textContent = "Push.";
    player.push();
  } else if (player.score > dealer.score) {
    message.textContent = "You win.";
    player.win();
  } else {
    message.textContent = "Dealer wins.";
    player.lose();
  }
  drawPlayerInfo();
};

/**
 * Draws a card on the canvas.
 * @param {Card} card - The card to be drawn.
 * @param {number} locX - The x-coordinate of the card's location.
 * @param {number} locY - The y-coordinate of the card's location.
 */
const drawCard = (card, locX, locY) => {
  const width = Card.FRAME_WIDTH;
  const height = Card.FRAME_HEIGHT;
  const {x, y} = card.isFaceUp() ? card.getSpriteOffset() : {x: 0, y:4};
  ctx.drawImage(sprites, x*width, y*height, width, height, locX, locY, width, height);
};

/**
 * Draws the player's hand on the canvas.
 */
const drawPlayerHand = () => {
  let hand = player.hand;
  let x = 320;
  let y = 400;
  for (let card of hand) {
    drawCard(card, x, y);
    x += 40;
  }
};

/**
 * Draws the dealer's hand on the canvas.
 */
const drawDealerHand = () => {
  let hand = dealer.hand;
  let x = 320;
  let y = 50;
  for (let card of hand) {
    drawCard(card, x, y);
    x += 40;
  }
};

const resetGame = () => {
  player.reset();
  dealer.reset();
  deck.discard();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bettingControls.style.display = "block";
  gameControls.style.display = "none";
};

// window.addEventListener("load", main);
window.onload = drawPlayerInfo;