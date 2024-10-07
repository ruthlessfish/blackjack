import random
from card import Card

class Deck:
    def __init__(self):
        self._cards = []
        self._dealt = []
        self._discarded = []
        self.populate()
    
    def populate(self):
        self._cards = [Card(n, s) for s in Card.suits for n in Card.ranks]
    
    def shuffle(self):
        self._cards.extend(self._discarded)
        self._cards.extend(self._dealt)
        self._discarded = []
        self._dealt = []
        random.shuffle(self._cards)
    
    def deal(self):
        new_card = self._cards.pop()
        self._dealt.append(new_card)
        return new_card
    
    def discard(self):
        self._discarded.extend(self._dealt)
        self._dealt = []