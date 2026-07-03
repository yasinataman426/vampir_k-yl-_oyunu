export type RoleCounts = {
  vampire: number;
  doctor: number;
  hunter: number;
  jester: number;
  gunslinger: number;
};

export const getDefaultRoles = (playerCount: number): RoleCounts => {
  if (playerCount < 5) return { vampire: 0, doctor: 0, hunter: 0, jester: 0, gunslinger: 0 };
  if (playerCount <= 6) return { vampire: 1, doctor: 1, hunter: 0, jester: 0, gunslinger: 0 };
  if (playerCount <= 8) return { vampire: 2, doctor: 1, hunter: 0, jester: 0, gunslinger: 0 };
  if (playerCount <= 10) return { vampire: 2, doctor: 1, hunter: 1, jester: 1, gunslinger: 0 };
  if (playerCount <= 15) return { vampire: 3, doctor: 2, hunter: 1, jester: 1, gunslinger: 1 };
  if (playerCount <= 20) return { vampire: 4, doctor: 2, hunter: 1, jester: 1, gunslinger: 1 };
  return { vampire: 5, doctor: 2, hunter: 1, jester: 1, gunslinger: 1 };
};

export const calculateTotalSpecialRoles = (roles: RoleCounts): number => {
  return Object.values(roles).reduce((a, b) => a + b, 0);
};

export const validateRoles = (playerCount: number, roles: RoleCounts): boolean => {
  return calculateTotalSpecialRoles(roles) <= playerCount;
};

// Cryptographically secure random integer between min and max (inclusive)
const getRandomInt = (min: number, max: number) => {
  const range = max - min + 1;
  const maxSafeVal = Math.floor(4294967295 / range) * range;
  const array = new Uint32Array(1);
  let randomVal;
  do {
    crypto.getRandomValues(array);
    randomVal = array[0];
  } while (randomVal >= maxSafeVal);
  return min + (randomVal % range);
};

// Fisher-Yates shuffle
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const generateRoleDeck = (playerCount: number, roleCounts: RoleCounts): string[] => {
  const deck: string[] = [];
  
  // Add special roles
  for (let i = 0; i < roleCounts.vampire; i++) deck.push("Vampir");
  for (let i = 0; i < roleCounts.doctor; i++) deck.push("Doktor");
  for (let i = 0; i < roleCounts.hunter; i++) deck.push("Avcı");
  for (let i = 0; i < roleCounts.jester; i++) deck.push("Soytarı");
  for (let i = 0; i < roleCounts.gunslinger; i++) deck.push("Silahşör");

  // Fill the rest with villagers
  const remaining = playerCount - deck.length;
  for (let i = 0; i < remaining; i++) {
    deck.push("Köylü");
  }

  return shuffleArray(deck);
};
