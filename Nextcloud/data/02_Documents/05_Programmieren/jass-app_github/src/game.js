const SUITS = ["S", "H", "D", "C"];
const RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];

const TOTAL_ROUND_POINTS = 157;

const MODE_DEFINITIONS = [
  { value: "trump:S", label: "Trumpf Schaufel" },
  { value: "trump:H", label: "Trumpf Herz" },
  { value: "trump:D", label: "Trumpf Ecke" },
  { value: "trump:C", label: "Trumpf Kreuz" },
  { value: "obenabe", label: "Obenabe" },
  { value: "undenufe", label: "Undenufe" },
  { value: "slalom_up", label: "Slalom (obenabe zuerst)" },
  { value: "slalom_down", label: "Slalom (undenufe zuerst)" },
  { value: "misere", label: "Misere" }
];

const PUSH_MODE = { value: "push", label: "Schieben" };

const MODE_LABEL_LOOKUP = MODE_DEFINITIONS.concat([PUSH_MODE]).reduce((acc, mode) => {
  acc[mode.value] = mode.label;
  return acc;
}, {});

const WEIGHT_UP = {
  "6": 1,
  "7": 2,
  "8": 3,
  "9": 4,
  "10": 5,
  J: 6,
  Q: 7,
  K: 8,
  A: 9
};

const WEIGHT_DOWN = {
  A: 1,
  K: 2,
  Q: 3,
  J: 4,
  "10": 5,
  "9": 6,
  "8": 7,
  "7": 8,
  "6": 9
};

const WEIGHT_TRUMP = {
  "6": 1,
  "7": 2,
  "8": 3,
  "10": 4,
  Q: 5,
  K: 6,
  A: 7,
  "9": 8,
  J: 9
};

const POINTS_TRUMP_NON_TRUMP_SUITS = {
  A: 11,
  K: 4,
  Q: 3,
  J: 2,
  "10": 10,
  "9": 0,
  "8": 0,
  "7": 0,
  "6": 0
};

const POINTS_NO_TRUMP = {
  A: 11,
  K: 4,
  Q: 3,
  J: 2,
  "10": 10,
  "9": 0,
  "8": 8,
  "7": 0,
  "6": 0
};

const POINTS_TRUMP = {
  J: 20,
  "9": 14,
  A: 11,
  K: 4,
  Q: 3,
  "10": 10,
  "8": 0,
  "7": 0,
  "6": 0
};

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank
      });
    }
  }
  return deck;
}

function shuffle(cards) {
  const deck = cards.slice();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

function teamOfSeat(seat) {
  return seat % 2;
}

function seatOrderFrom(startSeat) {
  return [0, 1, 2, 3].map((offset) => (startSeat + offset) % 4);
}

function sortHand(hand) {
  hand.sort((a, b) => {
    const suitCompare = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    if (suitCompare !== 0) {
      return suitCompare;
    }
    return WEIGHT_UP[a.rank] - WEIGHT_UP[b.rank];
  });
}

function isTrumpMode(mode) {
  return String(mode || "").startsWith("trump:");
}

function trumpSuitForMode(mode) {
  if (!isTrumpMode(mode)) {
    return null;
  }
  return mode.split(":")[1] || null;
}

function directionForTrick(mode, trickIndex) {
  if (mode === "undenufe") {
    return "down";
  }
  if (mode === "slalom_up") {
    return trickIndex % 2 === 0 ? "up" : "down";
  }
  if (mode === "slalom_down") {
    return trickIndex % 2 === 0 ? "down" : "up";
  }
  return "up";
}

function modeChoices(pushUsed) {
  return pushUsed ? MODE_DEFINITIONS.slice() : [PUSH_MODE].concat(MODE_DEFINITIONS);
}

function startNewRound(previousGame, dealerSeat) {
  const deck = shuffle(createDeck());
  const hands = [[], [], [], []];
  const dealOrder = seatOrderFrom((dealerSeat + 1) % 4);

  let deckIndex = 0;
  for (let pass = 0; pass < 9; pass += 1) {
    for (const seat of dealOrder) {
      hands[seat].push(deck[deckIndex]);
      deckIndex += 1;
    }
  }

  hands.forEach(sortHand);

  return {
    dealerSeat,
    chooserSeat: (dealerSeat + 1) % 4,
    pushUsed: false,
    phase: "waiting_mode",
    mode: null,
    turnSeat: null,
    trickStarterSeat: null,
    trick: [],
    trickHistory: [],
    hands,
    roundPoints: [0, 0],
    teamPoints: previousGame ? previousGame.teamPoints.slice() : [0, 0],
    roundNumber: previousGame ? previousGame.roundNumber + 1 : 1,
    lastRound: null,
    matchWinner: null
  };
}

function chooseMode(game, seat, mode) {
  if (!game || game.phase !== "waiting_mode") {
    throw new Error("Trumpf kann aktuell nicht gewaehlt werden.");
  }
  if (seat !== game.chooserSeat) {
    throw new Error("Du bist nicht am Trumpf waehlen.");
  }

  const allowedModes = modeChoices(game.pushUsed).map((entry) => entry.value);
  if (!allowedModes.includes(mode)) {
    throw new Error("Unbekannter Spielmodus.");
  }

  if (mode === "push") {
    if (game.pushUsed) {
      throw new Error("Es wurde bereits geschoben.");
    }
    game.pushUsed = true;
    game.chooserSeat = (seat + 2) % 4;
    return;
  }

  game.mode = mode;
  game.phase = "playing";
  game.turnSeat = (game.dealerSeat + 1) % 4;
  game.trickStarterSeat = game.turnSeat;
}

function getAllowedCards(hand, trick) {
  if (!Array.isArray(hand) || hand.length === 0) {
    return [];
  }
  if (!Array.isArray(trick) || trick.length === 0) {
    return hand.slice();
  }

  const ledSuit = trick[0].card.suit;
  const followingSuit = hand.filter((card) => card.suit === ledSuit);
  if (followingSuit.length > 0) {
    return followingSuit;
  }

  return hand.slice();
}

function cardWeight(card, mode, trickIndex) {
  if (isTrumpMode(mode)) {
    const trumpSuit = trumpSuitForMode(mode);
    if (card.suit === trumpSuit) {
      return WEIGHT_TRUMP[card.rank];
    }
    return WEIGHT_UP[card.rank];
  }

  const direction = directionForTrick(mode, trickIndex);
  if (direction === "down") {
    return WEIGHT_DOWN[card.rank];
  }
  return WEIGHT_UP[card.rank];
}

function trickWinner(trick, mode, trickIndex) {
  const ledSuit = trick[0].card.suit;

  if (isTrumpMode(mode)) {
    const trumpSuit = trumpSuitForMode(mode);
    const trumpCards = trick.filter((entry) => entry.card.suit === trumpSuit);
    if (trumpCards.length > 0) {
      let best = trumpCards[0];
      for (let i = 1; i < trumpCards.length; i += 1) {
        if (cardWeight(trumpCards[i].card, mode, trickIndex) > cardWeight(best.card, mode, trickIndex)) {
          best = trumpCards[i];
        }
      }
      return best.seat;
    }
  }

  const candidates = trick.filter((entry) => entry.card.suit === ledSuit);
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i += 1) {
    if (cardWeight(candidates[i].card, mode, trickIndex) > cardWeight(best.card, mode, trickIndex)) {
      best = candidates[i];
    }
  }
  return best.seat;
}

function cardPoints(card, mode) {
  if (isTrumpMode(mode)) {
    if (card.suit === trumpSuitForMode(mode)) {
      return POINTS_TRUMP[card.rank] || 0;
    }
    return POINTS_TRUMP_NON_TRUMP_SUITS[card.rank] || 0;
  }

  return POINTS_NO_TRUMP[card.rank] || 0;
}

function finalizeRound(game) {
  let awarded = game.roundPoints.slice();
  if (game.mode === "misere") {
    awarded = [TOTAL_ROUND_POINTS - game.roundPoints[0], TOTAL_ROUND_POINTS - game.roundPoints[1]];
  }

  game.teamPoints[0] += awarded[0];
  game.teamPoints[1] += awarded[1];

  let winnerTeam = null;
  if (awarded[0] > awarded[1]) {
    winnerTeam = 0;
  }
  if (awarded[1] > awarded[0]) {
    winnerTeam = 1;
  }

  game.lastRound = {
    mode: game.mode,
    modeLabel: MODE_LABEL_LOOKUP[game.mode] || game.mode,
    rawPoints: game.roundPoints.slice(),
    awardedPoints: awarded.slice(),
    winnerTeam
  };

  if (game.teamPoints[0] >= 1000 && game.teamPoints[0] > game.teamPoints[1]) {
    game.matchWinner = 0;
  } else if (game.teamPoints[1] >= 1000 && game.teamPoints[1] > game.teamPoints[0]) {
    game.matchWinner = 1;
  } else {
    game.matchWinner = null;
  }

  game.phase = "round_over";
  game.turnSeat = null;
  game.chooserSeat = null;
  game.pushUsed = false;
}

function playCard(game, seat, cardId) {
  if (!game || game.phase !== "playing") {
    throw new Error("Das Spiel laeuft aktuell nicht.");
  }
  if (seat !== game.turnSeat) {
    throw new Error("Du bist nicht am Zug.");
  }

  const hand = game.hands[seat];
  if (!hand) {
    throw new Error("Ungueltiger Sitz.");
  }

  const cardIndex = hand.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) {
    throw new Error("Karte nicht auf der Hand.");
  }

  const trickIndex = game.trickHistory.length;
  const allowed = getAllowedCards(hand, game.trick);
  const isAllowed = allowed.some((card) => card.id === cardId);
  if (!isAllowed) {
    throw new Error("Du musst Farbe bedienen, wenn moeglich.");
  }

  const [card] = hand.splice(cardIndex, 1);
  game.trick.push({ seat, card });

  if (game.trick.length < 4) {
    game.turnSeat = (seat + 1) % 4;
    return;
  }

  const winnerSeat = trickWinner(game.trick, game.mode, trickIndex);
  const lastTrick = game.hands.every((cards) => cards.length === 0);

  let trickPoints = game.trick.reduce((sum, entry) => sum + cardPoints(entry.card, game.mode), 0);
  if (lastTrick) {
    trickPoints += 5;
  }

  game.roundPoints[teamOfSeat(winnerSeat)] += trickPoints;

  game.trickHistory.push({
    trickIndex,
    cards: game.trick.slice(),
    winnerSeat,
    points: trickPoints
  });

  game.trick = [];

  if (lastTrick) {
    finalizeRound(game);
    return;
  }

  game.turnSeat = winnerSeat;
  game.trickStarterSeat = winnerSeat;
}

function serializeGameForSeat(game, seat) {
  if (!game) {
    return null;
  }

  const trickIndex = game.trickHistory.length;
  const allowedCardIds =
    game.phase === "playing" && seat === game.turnSeat
      ? getAllowedCards(game.hands[seat], game.trick).map((card) => card.id)
      : [];

  return {
    phase: game.phase,
    dealerSeat: game.dealerSeat,
    chooserSeat: game.chooserSeat,
    pushUsed: game.pushUsed,
    mode: game.mode,
    modeLabel: MODE_LABEL_LOOKUP[game.mode] || null,
    turnSeat: game.turnSeat,
    trickStarterSeat: game.trickStarterSeat,
    trick: game.trick,
    trickHistory: game.trickHistory,
    roundPoints: game.roundPoints,
    teamPoints: game.teamPoints,
    roundNumber: game.roundNumber,
    matchWinner: game.matchWinner,
    lastRound: game.lastRound,
    availableModes:
      game.phase === "waiting_mode" && seat === game.chooserSeat
        ? modeChoices(game.pushUsed)
        : [],
    hands: game.hands.map((cards, idx) => (idx === seat ? cards : cards.length)),
    handCounts: game.hands.map((cards) => cards.length),
    allowedCardIds
  };
}

module.exports = {
  MODE_DEFINITIONS,
  MODE_LABEL_LOOKUP,
  TOTAL_ROUND_POINTS,
  chooseMode,
  playCard,
  serializeGameForSeat,
  startNewRound,
  teamOfSeat
};