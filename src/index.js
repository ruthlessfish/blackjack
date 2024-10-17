'use strict';

import _ from 'lodash';
import Card from "./js/card.js";
import Deck from "./js/deck.js";
import { Player, Dealer } from "./js/player.js";
import './css/style.css';
import SpriteSheet from './assets/sprites.png';

let playerName;
while (!playerName) {
  playerName = prompt("Enter your name:");
}

// load player, dealer, and deck
const player = new Player(playerName, 1000);
const dealer = new Dealer("Dealer");

const deck = new Deck();
deck.shuffle();

let message = document.getElementById("message");
let betAmount = 0;

// load graphics
const canvas = document.getElementById("blackjack-table");
const ctx = canvas.getContext("2d");
const sprites = new Image();
sprites.fetchPriority = "high";
sprites.loading = "eager";
sprites.src = SpriteSheet;


/**
 * Controller button bindings
 */

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
// game controls
const gameControls = document.getElementById("game-controls");
const splitButton = document.getElementById("split-button");
const hitButton = document.getElementById("hit-button");
const standButton = document.getElementById("stand-button");
const doubleButton = document.getElementById("double-button");
// player info
const playerNameEl = document.getElementById("player-name");
const playerBankrollEl = document.getElementById("player-bankroll");
const playerWinsEl = document.getElementById("player-wins");

/**
 * Event Handlers
 * 
 */

/**
 * Handles the click event for the bet button.
 *
 * @param {Event} e - The click event object.
 */
const handleBetButtonClick = (e) => {
  let amount = parseInt(e.target.textContent);
  if (player.bankroll >= betAmount + amount) {
    betAmount += amount;
    message.textContent = `Bet: $${betAmount}`;
  }
};

/**
 * Handles the click event for the clear button.
 * Resets the bet amount to 0 and updates the message text content.
 *
 * @param {Event} e - The click event object.
 */
const handleClearButtonClick = (e) => {
  betAmount = 0;
  message.textContent = "Place your bet:";
};

/**
 * Handles the click event for the "Deal" button.
 * If the bet amount is greater than 0, places the bet, hides the betting controls,
 * shows the game controls, resets the bet amount, and calls the "deal" function.
 *
 * @param {Event} e - The click event object.
 */
const handelDealButtonClick = (e) => {
  if (betAmount > 0) {
    player.placeBet(betAmount);
    bettingControls.style.display = "none";
    gameControls.style.display = "block";
    betAmount = 0;
    deal();
  }
};

/**
 * Handles the click event for the hit button.
 *
 * @param {Event} e - The click event object.
 */
const handleHitButtonClick = (e) => {
  if (!hitButton.disabled) {
    let newCard = deck.draw();
    player.addCard(newCard);
    drawPlayerHand();
    checkPlayerHand();
  }
};

/**
 * Handles the click event for the double button.
 *
 * @param {Event} e - The click event object.
 */
const handleDoubleButtonClick = (e) => {
  if (!doubleButton.disabled) {
    player.doubleDown();
    let newCard = deck.draw();
    player.addCard(newCard);
    drawPlayerHand();
    endPlayerTurn();
  }
};

/**
 * Handles the click event for the Stand button.
 * Ends the player's turn if the Stand button is not disabled.
 *
 * @param {Event} e - The click event object.
 */
const handleStandButtonClick = (e) => {
  if (!standButton.disabled) {
    endPlayerTurn();
  }
};

/**
 * Game logic
 * 
 */

/**
 * Draws the player's information on the screen.
 */
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
  doubleButton.disabled = player.bankroll < player.bet;
  checkPlayerHand();
};

/**
 * Handles the player's turn in the game.
 */
const checkPlayerHand = () => {
  if (player.hasBlackjack() || player.isBusted()) {
    endPlayerTurn();
  }
};

/**
 * Ends the player's turn by disabling the hit and stand buttons,
 * handling the dealer's turn, determining the winner, and resetting the game after a delay.
 */
const endPlayerTurn = () => {
  hitButton.disabled = true;
  standButton.disabled = true;
  doubleButton.disabled = true;
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

/**
 * Resets the game by resetting player and dealer, discarding the deck,
 * clearing the canvas, and updating the display of betting and game controls.
 */
const resetGame = () => {
  player.reset();
  dealer.reset();
  deck.discard();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  bettingControls.style.display = "block";
  gameControls.style.display = "none";
};

// register event listeners
bet5Button.addEventListener("click", handleBetButtonClick);
bet10Button.addEventListener("click", handleBetButtonClick);
bet25Button.addEventListener("click", handleBetButtonClick);
bet50Button.addEventListener("click", handleBetButtonClick);
bet100Button.addEventListener("click", handleBetButtonClick);
bet500Button.addEventListener("click", handleBetButtonClick);
clearBetButton.addEventListener("click", handleClearButtonClick);
dealButton.addEventListener("click", handelDealButtonClick);
hitButton.addEventListener("click", handleHitButtonClick);
doubleButton.addEventListener("click", handleDoubleButtonClick);
standButton.addEventListener("click", handleStandButtonClick);
window.onload = drawPlayerInfo;