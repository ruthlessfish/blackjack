class Participant:
    def __init__(self, name = ''):
        self.hand = []
        self.in_game = True
        self.name = name

    def add_card(self, card):
        self.hand.append(card)

    def get_score(self):
        score = sum(card.value for card in self.hand)
        num_aces = sum(1 for card in self.hand if card.rank == 'ACE')
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
    
    def reset(self):
        self.hand = []
        self.in_game = True

class Player(Participant):
    def __init__(self, name, bank = 100):
        super().__init__(name)
        self.bank = bank
        self.bet = 0
        self.wins = 0
        self.losses = 0
        self.ties = 0
        self.blackjacks = 0
    
    def place_bet(self, amount):
        self.bank -= amount
        self.bet += amount
    
    def win(self, with_blackjack = False):
        self.wins += 1
        win_multiplier = 1
        if with_blackjack:
            self.blackjacks += 1
            win_multiplier = 1.5
        self.bank += self.bet*(1 + win_multiplier)
        self.bet = 0
    
    def lose(self):
        self.losses += 1
        self.bet = 0
    
    def push(self):
        self.ties += 1
        self.bank += self.bet
        self.bet = 0

    def double_down(self):
        self.bank -= self.bet
        self.bet *= 2
    
    def get_win_percentage(self):
        return self.wins/(self.wins + self.losses + self.ties)*100

class Dealer(Participant):
    pass