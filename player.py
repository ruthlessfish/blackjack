class Participant:
    def __init__(self):
        self.hand = []
        self.in_game = True

    def add_card(self, card):
        self.hand.append(card)

    def get_score(self):
        score = sum(card.value for card in self.hand)
        num_aces = sum(1 for card in self.hand if card.rank == 'A')
        while score > 21 and num_aces:
            score -= 10
            num_aces -= 1
        return score
    
    def has_blackjack(self):
        return len(self.hand) == 2 and self.get_score() == 21

    def is_busted(self):
        return self.get_score() > 21

    def show_hand(self):
        return ', '.join([str(card) for card in self.hand])

class Player(Participant):
    pass

class Dealer(Participant):
    pass