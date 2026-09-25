// Plays 100 hands of Standard-mode blackjack, the player always making the Basic Strategy move,
// and prints who won each one: Dealer, Player, or Push.
//   npm run simulate           one winner per line
//   npm run simulate -- -v     a table of up card, starting cards, final totals, and winner
import { Card, Hand, MIN_BET, StandardGame, basicStrategy } from '../src/game/logic';
import type { CardView } from '../src/game/logic';

// The project has no @types/node; this is all the script needs from Node.
declare const process: { argv: string[] };

const HANDS = 300;

type Winner = 'Dealer' | 'Player' | 'Push';

interface Row {
    upCard: string;
    startCards: string;
    playerTotal: string;
    dealerTotal: string;
    winner: Winner;
}

const cardText = (c: CardView | null): string => (c ? `${c.rank}${c.suit}` : '??');

/** Deal one round and play it out by the chart. */
function playHand(game: StandardGame): Row {
    game.clearBet();
    game.addBet(MIN_BET);
    game.deal();

    const opening = game.view();
    const upCard = opening.dealer[0]!;
    const startCards = opening.playerHands[0].cards;

    if (opening.phase === 'insurance') game.declineInsurance();

    while (game.view().phase === 'player') {
        const view = game.view();
        const active = view.playerHands.find((h) => h.active)!;
        const hand = new Hand(active.cards.map((c) => new Card(c.rank, c.suit)));
        const action = basicStrategy(hand, new Card(upCard.rank, upCard.suit), view.can.double === 'ok', view.can.split === 'ok');
        game[action]();
    }

    const settled = game.view();
    // One winner per round: the net of every hand's result, so a split round counts once.
    const net = settled.playerHands.reduce(
        (sum, h) => sum + (h.outcome === 'win' ? h.bet : h.outcome === 'lose' ? -h.bet : 0),
        0,
    );

    return {
        upCard: cardText(upCard),
        startCards: startCards.map(cardText).join(' '),
        playerTotal: settled.playerHands.map((h) => h.total).join(' / '),
        dealerTotal: String(settled.dealerTotal ?? ''),
        winner: net > 0 ? 'Player' : net < 0 ? 'Dealer' : 'Push',
    };
}

function printTable(rows: Row[]): void {
    const columns: [string, keyof Row][] = [
        ['Dealer Up Card', 'upCard'],
        ['Player Start Cards', 'startCards'],
        ['Player Total', 'playerTotal'],
        ['Dealer Total', 'dealerTotal'],
        ['Winner', 'winner'],
    ];
    const widths = columns.map(([title, key]) => Math.max(title.length, ...rows.map((r) => r[key].length)));
    const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ').trimEnd();

    console.log(line(columns.map(([title]) => title)));
    console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
    for (const row of rows) console.log(line(columns.map(([, key]) => row[key])));
}

const args = process.argv.slice(1);
const verbose = args.includes('-v') || args.includes('--verbose');

// A no-op clock: the settled-round sweep is only for the screen, and a real timer would keep Node alive.
const game = new StandardGame(() => {}, { schedule: () => () => {} });
const rows: Row[] = [];
for (let i = 0; i < HANDS; i++) rows.push(playHand(game));
game.dispose();

if (verbose) printTable(rows);
else for (const row of rows) console.log(row.winner);

const count = (winner: Winner) => rows.filter((r) => r.winner === winner).length;
console.log();
console.log(`Player Wins: ${count('Player')}`);
console.log(`Dealer Wins: ${count('Dealer')}`);
console.log(`Pushes: ${count('Push')}`);
