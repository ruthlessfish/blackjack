import _ from 'lodash';
import Card from "./js/card.js";
import Deck from "./js/deck.js";
import { Player, Dealer } from "./js/player.js";
import './css/style.css';
import SpriteSheet from './assets/sprites.png';

console.debug("load players");
const player = new Player("Player 1", 1000);
const dealer = new Dealer("Dealer");

console.debug("set up canvas context");
const canvas = document.getElementById("blackjack-table");
const ctx = canvas.getContext("2d");

const splitButton = document.getElementById("split-button");
const hitButton = document.getElementById("hit-button");
const standButton = document.getElementById("stand-button");
const doubleButton = document.getElementById("double-button");

console.debug("loading sprites");
const sprites = new Image();
sprites.fetchPriority = "high";
sprites.loading = "eager";
sprites.src = SpriteSheet;
sprites.addEventListener("load", e => {
  console.debug("sprites loaded");
});

console.debug("shuffling a new deck");
const deck = new Deck();
deck.shuffle();

hitButton.addEventListener("click", e => {
  if (!hitButton.disabled) {
    let newCard = deck.draw();
    console.debug(`Player drew: ${newCard.toString()}`);
    player.addCard(newCard);
    console.debug(`${player.name}'s hand: ${player.showHand()}`);
    console.debug(`${player.name}'s score: ${player.getScore()}`);
    drawPlayerHand();
    checkPlayerHand();
  }
});

standButton.addEventListener("click", e => {
  if (!standButton.disabled) {
    endPlayerTurn();
  }
});

const main = () => {
  console.debug(`Player name: ${player.name}`);
  console.debug(`cash available: ${player.bankroll}`);
  console.debug(`w/l/t: ${player.wins}/${player.losses}/${player.ties}`);
  console.debug(`Blackjacks: ${player.blackjacks}`);
  // console.debug("Getting valid bet from player");
  // @todo: call getValidBet
  console.debug("Dealing cards");
  deal();
  checkPlayerHand();
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
  console.debug(`${player.name}'s hand: ${player.showHand()}`);
  console.debug(`${player.name}'s score: ${player.getScore()}`);
  console.debug(`${dealer.name} is showing: ${dealer.hand[0].toString()}`);
  if (player.hasBlackjack() || player.isBusted()) {
    endPlayerTurn();
  }
};

const endPlayerTurn = () => {
  hitButton.disabled = true;
  standButton.disabled = true;
  handleDealerTurn();
  determineWinner();
  player.reset();
  dealer.reset();
  deck.discard();
};

/**
 * Handles the dealer's turn in a blackjack game.
 */
const handleDealerTurn = () => {
  dealer.hand[0].flip();
  drawDealerHand();
  if (!player.isBusted()) {
    let dealerScore = dealer.getScore();
    while (dealerScore < 17) {
      let newCard = deck.draw();
      console.debug(`${dealer.name} drew: ${newCard.toString()}`);
      dealer.addCard(newCard);
      dealerScore = dealer.getScore();
      console.debug(`${dealer.name}'s hand: ${dealer.showHand()}`);
      console.debug(`${dealer.name}'s score: ${dealerScore}`);
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
    console.debug("Player busted. Dealer wins.");
    alert("Dealer wins.");
    player.lose();
  } else if (dealer.isBusted()) {
    console.debug("Dealer busted. Player wins.");
    alert("You win.");
    player.win();
  } else if (player.hasBlackjack()) {
    console.debug("Player has blackjack.");
    alert("Blackjack! You win!");
    player.win(true);
  } else if (player.getScore() == dealer.getScore()) {
    console.debug("Push.");
    alert("Push.");
    player.push();
  } else if (player.getScore() > dealer.getScore()) {
    console.debug("Player wins.");
    alert("You win.");
    player.win();
  } else {
    console.debug("Dealer wins.");
    alert("Dealer wins.");
    player.lose();
    }
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

window.onload = main;