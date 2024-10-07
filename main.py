from deck import Deck

def deal(deck):
    player_hand = [];
    dealer_hand = [];

    for i in range(2):
        player_hand.append(deck.deal())
        dealer_hand.append(deck.deal())
    
    return player_hand, dealer_hand

def get_score(hand):
    return sum([card.value for card in hand])

def main():
    """Run the main blackjack game loop."""
    deck = Deck()
    deck.shuffle()
    
    player_hand, dealer_hane = deal(deck)

    player_in = True
    dealer_in = True
    dealer_score = get_score(dealer_hand)
    player_score = get_score(player_hand)

    while player_in:
        print('\nPlayer hand: %s' % ', '.join([str(card) for card in player_hand]))
        print('Player score: %s' % player_score)
        print('''Dealer is showing %s\n''' % dealer_hand[0])

        if player_score == 21:
            print('Blackjack!')
            break
        elif player_score > 21:
            print('Bust!')
            break
        else:
            player_in = input('Do you want to hit? (y/n) ') == 'y'
            if player_in:
                new_card = deck.deal()
                print('You drew %s' % new_card)
                player_hand.append(new_card)
                player_score += new_card.value
                print('\nPlayer hand: %s' % ', '.join([str(card) for card in player_hand]))
                print('Player score: %s' % player_score)

    print('\nDealer hand: %s' % ', '.join([str(card) for card in dealer_hand]))
    print('Dealer score: %s' % dealer_score)
    if player_score < 21:
        while dealer_in:
            if dealer_score < 17:
                new_card = deck.deal()
                print('Dealer drew %s' % new_card)
                dealer_hand.append(new_card)
                dealer_score += new_card.value
            else:
                dealer_in = False

    print('\nPlayer hand: %s' % ', '.join([str(card) for card in player_hand]))
    print('Player score: %s' % player_score)
    print('\nDealer hand: %s' % ', '.join([str(card) for card in dealer_hand]))
    print('Dealer score: %s' % dealer_score)

    if player_score > 21:
        print('Player busts, dealer wins!')
    elif dealer_score > 21:
        print('Dealer busts, player wins!')
    elif player_score == dealer_score:
        print('Push!')
    elif player_score > dealer_score:
        print('Player wins!')
    else:
        print('Dealer wins!')

if __name__ == '__main__':
    main()