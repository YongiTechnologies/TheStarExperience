/**
 * Menu artwork (transparent cut-outs) mapped by item name. The menu itself
 * comes from the backend (seed.py), so keys must match its item names. Items
 * without artwork fall back to a category icon on the menu card.
 */
const FOOD = (name: string) => `/assets/menu/food-${name}.webp`;
const DRINK = (name: string) => `/assets/menu/drink-${name}.webp`;

export const MENU_IMAGE_BY_NAME: Record<string, string> = {
  'Gogo Balls': FOOD('gogo-balls'),
  'Yeye Goat': FOOD('yeye-goat'),
  'Yeye Chicken': FOOD('yeye-chicken'),
  'Chicken Call': FOOD('chicken-call'),
  'Domedo Grilled': FOOD('domedo-grilled'),
  'Calamari Squid': FOOD('calamari-squid'),
  'Fried Veg Home Grown': FOOD('fried-veg-home-grown'),
  'Virgin Green Revolution': FOOD('virgin-green-revolution'),
  'Stir Fried Vegetables': FOOD('stir-fried-vegetables'),
  'Egg Fried Rice (Brown Rice)': FOOD('egg-fried-rice'),
  'Special Home Grown': FOOD('fried-veg-home-grown'),
  'Green Revolution': FOOD('green-revolution-tuna'),
  'Mixed Grilled Platter': FOOD('domedo-grilled'),
  'Jollof Rice': FOOD('jollof-rice'),
  'Yamrock': FOOD('yamrock'),
  'Cassava Havana': FOOD('cassava-havana'),
  'Kelewele': FOOD('kelewele'),

  'Kokoroko (House Favourite)': DRINK('kokoroko'),
  'Passion Kokoroko': DRINK('passion-kokoroko'),
  'Mint Kokoroko': DRINK('mint-kokoroko'),
  'Frozen Harmattan': DRINK('frozen-harmattan'),
  'Republica': DRINK('republica'),
  'Kukuruntumi': DRINK('kukurantumi'),
  'Woezor': DRINK('woezor'),
  'Mojito': DRINK('mojito'),

  'Ghana': DRINK('ghana-slush'),
  'Lyngwa': DRINK('lyngwa'),
  'Lemonade Mocktail': DRINK('lemonade-mocktail'),

  'House Red or White (Glass)': DRINK('wine-glasses'),
  'House Red or White (Bottle)': DRINK('wine-glasses'),
  'Palm Wine': DRINK('palm-wine'),

  // Beer mixes share the "wild beers" artwork.
  'Beer Sop': DRINK('wild-beers'),
  'Ginger Beer': DRINK('wild-beers'),
  'Sunshine Beer': DRINK('wild-beers'),
  'Star / Club (Small)': DRINK('star-club-beer'),
  'Star / Club (Large)': DRINK('star-club-beer'),
  'Smirnoff Ice': DRINK('smirnoff-ice'),
  'Guinness': DRINK('guinness'),
  'Tale Beer': DRINK('tale-beer'),

  'Hibiscus Juice (Bissap)': DRINK('natural-fruit-juices'),
  'Pineapple Juice': DRINK('natural-fruit-juices'),
  'Soursop Iced Tea': DRINK('natural-fruit-juices'),
  'Orange Juice': DRINK('natural-fruit-juices'),
  'House Lemonade': DRINK('lemonade-mocktail'),
  'Coke': DRINK('water-and-sodas-cans'),
  'Fanta': DRINK('water-and-sodas-cans'),
  'Sprite': DRINK('water-and-sodas-cans'),
  'Soda Water': DRINK('water-and-sodas-cans'),
  'Water': DRINK('water-and-sodas-cans'),
};

/** Infused Akpeteshie: one shot photo, and a bottle per flavour. */
const SPIRIT_SHOT_IMAGE = DRINK('infusion-spirit-shots');
const SPIRIT_BOTTLE_BY_FLAVOUR: [string, string][] = [
  ['Ginger', DRINK('infusion-bottle-ginger')],
  ['Vanilla', DRINK('infusion-bottle-vanilla')],
  ['Coffee-Cocoa', DRINK('infusion-bottle-coffee-cocoa')],
  ['Coconut', DRINK('infusion-bottle-coconut')],
  ['Passion', DRINK('infusion-bottle-passion')],
];
const SPIRIT_BOTTLE_SET_IMAGE = DRINK('infusion-spirit-bottles-set');

/** Resolve the artwork for an item name, covering the spirit variants. */
export function getMenuImage(name: string): string | undefined {
  if (MENU_IMAGE_BY_NAME[name]) return MENU_IMAGE_BY_NAME[name];
  if (name.startsWith('Akpeteshie-Cane Spirit Shot')) return SPIRIT_SHOT_IMAGE;
  if (name.startsWith('Akpeteshie Spirit Bottle')) {
    // "(Coconut & Vanilla, 500 ml)" is the coconut bottle, so match the first flavour named.
    const flavours = name.slice(name.indexOf('(') + 1);
    const match = SPIRIT_BOTTLE_BY_FLAVOUR.map(([flavour, image]) => ({ at: flavours.indexOf(flavour), image }))
      .filter(({ at }) => at >= 0)
      .sort((a, b) => a.at - b.at)[0];
    return match?.image ?? SPIRIT_BOTTLE_SET_IMAGE;
  }
  return undefined;
}
