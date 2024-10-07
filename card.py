class Card:
    """
    Represents a playing card.

    Attributes:
        rank (str): The rank of the card.
        suit (str): The suit of the card.
    """
    ranks = [_ for _ in range(2,11)] + ['JACK', 'QUEEN', 'KING', 'ACE']
    suits = ['SPADE', 'HEART', 'DIAMOND', 'CLUB']

    def __init__(self, rank, suit):
        self.rank = rank
        self.suit = suit

    def __str__(self):
        """
        Returns a string representation of the card.

        The string representation includes the rank and suit of the card.
        If the rank is a special case (J, Q, K, A), it is replaced with the corresponding word (Jack, Queen, King, Ace).

        Returns:
            str: The string representation of the card.
        """
        case = {
            'J': 'Jack',
            'Q': 'Queen',
            'K': 'King',
            'A': 'Ace'
        }
        rank = self.rank
        rank = case[rank] if rank in case else rank
        return f'{rank} of {self.suit}S'

    @property
    def rank(self):
        """
        Returns the rank of the card.

        Returns:
            str: The rank of the card.
        """
        return self._rank

    @rank.setter
    def rank(self, rank):
        """
        Set the rank of the card.

        Args:
            rank (str): The rank of the card.

        Raises:
            ValueError: If the rank is not a valid rank.

        Returns:
            None
        """
        if rank in Card.ranks:
            self._rank = rank
        else:
            raise ValueError('Invalid rank')

    @property
    def value(self):
        """
        Returns the value of the card.

        Returns:
            int: The value of the card.
        """
        if self.rank in Card.ranks[0:-4]:
            return int(self.rank)
        elif self.rank == 'ACE':
            return 11
        else:
            return 10

    @property
    def suit(self):
        """
        Returns the suit of the card.

        Returns:
            str: The suit of the card.
        """
        return self._suit

    @suit.setter
    def suit(self, suit):
        """
        Set the suit of the card.

        Parameters:
        - suit (str): The suit of the card. Must be one of ['Hearts', 'Diamonds', 'Clubs', 'Spades'].

        Raises:
        - ValueError: If the suit is not a valid option.

        """
        if suit in Card.suits:
            self._suit = suit
        else:
            raise ValueError('Invalid suit')
