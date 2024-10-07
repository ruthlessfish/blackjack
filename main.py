from deck import Deck
from player import Player, Dealer

def deal(deck, player, dealer):
    """Deal two cards to the player and dealer."""
    for i in range(2):
        player.add_card(deck.deal())
        dealer.add_card(deck.deal())

def main():
    """Run the main blackjack game loop."""
    deck = Deck()
    deck.shuffle()
    
    player = Player()
    dealer = Dealer()

    deal(deck, player, dealer)

    while player.in_game:
        print(f'Player hand: {player.show_hand()}')
        print(f'Player score: {player.get_score()}')
        print(f'Dealer is showing {dealer.hand[0]}')

        if player.has_blackjack():
            print('Blackjack!')
            break

        if player.is_busted():
            print('Bust!')
            break

        player.in_game = input('Do you want to hit? (y/n) ') == 'y'
        if player.in_game:
            new_card = deck.deal()
            print(f'You drew {new_card}')
            player.add_card(new_card)
            print(f'Player hand: {player.show_hand()}')
            print(f'Player score: {player.get_score()}')

    if not player.is_busted():
        while dealer.get_score() < 17:
            new_card = deck.deal()
            print(f'Dealer drew {new_card}')
            dealer.add_card(new_card)
            print(f'Dealer hand: {dealer.show_hand()}')
            print(f'Dealer score: {dealer.get_score()}')

    print(f'Player hand: {player.show_hand()}')
    print(f'Player score: {player.get_score()}')
    print(f'Dealer hand: {dealer.show_hand()}')
    print(f'Dealer score: {dealer.get_score()}')

    if player.get_score() > 21:
        print('Player busts, dealer wins!')
    elif dealer.get_score() > 21:
        print('Dealer busts, player wins!')
    elif player.get_score() == dealer.get_score():
        print('Push!')
    elif player.get_score() > dealer.get_score():
        print('Player wins!')
    else:
        print('Dealer wins!')

if __name__ == '__main__':
    while input('Do you want to play blackjack? (y/n) ') == 'y':
        main()