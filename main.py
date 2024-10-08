from deck import Deck
from player import Player, Dealer

deck = Deck()
deck.shuffle()

player = Player('Player 1', 1000)
dealer = Dealer('Dealer')

def deal():
    """Deal two cards to the player and dealer."""
    for i in range(2):
        player.add_card(deck.deal())
        dealer.add_card(deck.deal())

def get_valid_bet():
    while True:
        bet = input(f'How much do you want to bet? (Max {player.bank})')
        if not bet.isdigit():
            print('Please enter a valid number.')
        elif int(bet) > player.bank:
            print('You do not have enough money to make that bet.')
        else:
            break
    return int(bet)

def main():
    """Run the main blackjack game loop."""
    print(f'Player name: {player.name}')
    print(f'cash available: {player.bank}')
    print(f'w/l/t: {player.wins}/{player.losses}/{player.ties}')
    print(f'Blackjacks: {player.blackjacks}')

    bet = get_valid_bet()
    
    print(f'You bet {bet}')
    player.place_bet(bet)

    print('Dealing cards...')
    deal()

    while player.in_game:
        print(f'{player.name} hand: {player.show_hand()}')
        print(f'{player.name} score: {player.get_score()}')
        print(f'{dealer.name} is showing {dealer.hand[0]}')

        if player.has_blackjack():
            print('Blackjack!')
            break

        if player.is_busted():
            print('Bust!')
            break

        player.in_game = input('Do you want to hit? (y/n) ') == 'y'
        if player.in_game:
            new_card = deck.deal()
            print(f'{player.name} drew {new_card}')
            player.add_card(new_card)
            print(f'{player.name} hand: {player.show_hand()}')
            print(f'{player.name} score: {player.get_score()}')

    if not player.is_busted():
        while dealer.get_score() < 17:
            new_card = deck.deal()
            print(f'{dealer.name} drew {new_card}')
            dealer.add_card(new_card)
            print(f'{dealer.name} hand: {dealer.show_hand()}')
            print(f'{dealer.name} score: {dealer.get_score()}')

    print(f'{player.name} hand: {player.show_hand()}')
    print(f'{player.name} score: {player.get_score()}')
    print(f'{dealer.name} hand: {dealer.show_hand()}')
    print(f'{dealer.name} score: {dealer.get_score()}')

    if player.is_busted():
        print(f'{player.name} busts, {dealer.name} wins!')
        player.lose()
    elif dealer.is_busted():
        print(f'{dealer.name} busts, {player.name} wins!')
        player.win()
    elif player.has_blackjack():
        print(f'{player.name} wins with blackjack!')
        player.win(True)
    elif player.get_score() == dealer.get_score():
        print('Push!')
        player.push()
    elif player.get_score() > dealer.get_score():
        print(f'{player.name} wins!')
        player.win()
    else:
        print(f'{dealer.name} wins!')
        player.lose()
    
    player.reset()
    dealer.reset()
    deck.discard()

if __name__ == '__main__':
    while input('Do you want to play blackjack? (y/n) ') == 'y':
        main()