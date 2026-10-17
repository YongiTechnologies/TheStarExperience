import { MenuItem } from '@/types';

/**
 * Menu artwork (transparent cut-outs) mapped by item name. Items without
 * artwork fall back to a category icon on the menu card.
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

const RAW_MENU: MenuItem[] = [
  { id: 'food-001', name: 'Gogo Balls', description: 'Spiced beef balls minced with cumin, black pepper, crumbs, onion and garlic.', price: 120, category: 'food', available: true },
  { id: 'food-002', name: 'Yeye Goat', description: 'Goat curry in mild spices, green peppers and spices. Some bones attached.', price: 100, category: 'food', available: true },
  { id: 'food-003', name: 'Yeye Chicken', description: 'Chicken curry in mild curry sauce with chunks of boiled potato.', price: 120, category: 'food', available: true },
  { id: 'food-004', name: 'Chicken Call', description: 'Spicy oven-grilled chicken wings.', price: 95, category: 'food', available: true },
  { id: 'food-005', name: 'Domedo Grilled', description: 'Pan-grilled pork marinated and steamed in local indigenous spices.', price: 95, category: 'food', available: true },
  { id: 'food-006', name: 'Calamari Squid', description: 'Fried squid slices in oregano and paprika.', price: 150, category: 'food', available: true },
  { id: 'food-007', name: 'Fried Veg Home Grown', description: 'Brown Ghanaian organic rice with specks of beans, fried with assorted vegetables. Cooked with coconut oil or vegetable oil if preferred.', price: 80, category: 'food', available: true },
  { id: 'food-008', name: 'Virgin Green Revolution', description: 'Avocado mixed with spring onions, coriander and lime juice dressing.', price: 80, category: 'food', available: true },
  { id: 'food-009', name: 'Stir Fried Vegetables', description: 'Mixed fresh vegetables stir-fried with a dash of soya sauce.', price: 80, category: 'food', available: true },
  { id: 'food-010', name: 'Egg Fried Rice (Brown Rice)', description: 'Brown Ghanaian organic rice with specks of beans, egg and mixed fresh vegetables, stir-fried. Cooked with coconut oil or vegetable oil if preferred.', price: 80, category: 'food', available: true },
  { id: 'food-011', name: 'Special Home Grown', description: 'Choose small cuts of either chicken, beef balls or grilled pork, fried with brown rice and vegetables.', price: 100, category: 'food', available: true },
  { id: 'food-012', name: 'Green Revolution', description: 'Avocado mixed with tuna, spring onions, coriander and lime juice dressing.', price: 100, category: 'food', available: true },
  { id: 'food-013', name: 'Mixed Grilled Platter', description: 'Six beef meatballs, fried calamari (300 g), chicken wings (250 g), grilled pork (250 g), stir-fried home-grown brown rice, cassava chips and fried yam.', price: 500, category: 'food', available: true },
  { id: 'food-014', name: 'Jollof Rice', description: 'Rice, oil, onion, pepper, fresh tomatoes, tomato paste and green bell pepper.', price: 70, category: 'food', available: true },
  { id: 'food-015', name: 'Yamrock', description: 'Slender-cut pieces of yam fried in deep vegetable oil.', price: 40, category: 'food', available: true },
  { id: 'food-016', name: 'Cassava Havana', description: 'Boiled cassava cut into slender pieces and fried in deep vegetable oil.', price: 40, category: 'food', available: true },
  { id: 'food-017', name: 'Kelewele', description: 'Slender-cut pieces of plantain fried in deep vegetable oil.', price: 40, category: 'food', available: true },

  { id: 'cocktail-001', name: 'Kokoroko (House Favourite)', description: 'Pulverized ice, spirit shot, hibiscus, lime, mint and brown sugar. 1 litre.', price: 100, category: 'cocktails', available: true },
  { id: 'cocktail-002', name: 'Passion Kokoroko', description: 'Passion fruit, lime, crushed ice, cane spirit and brown sugar. 1 litre.', price: 100, category: 'cocktails', available: true },
  { id: 'cocktail-003', name: 'Mint Kokoroko', description: 'Mint, lime, crushed ice, cane spirit and brown sugar. 1 litre.', price: 100, category: 'cocktails', available: true },
  { id: 'cocktail-004', name: 'Frozen Harmattan', description: 'Pulverized ice, coconut shot, lime juice, brown sugar and mint garnish. 1 litre.', price: 100, category: 'cocktails', available: true },
  { id: 'cocktail-005', name: 'Republica', description: 'Caipirinha-style drink with lime, crushed ice, cane spirit and sugar. 1 litre.', price: 100, category: 'cocktails', available: true },
  { id: 'cocktail-006', name: 'Kukuruntumi', description: 'Vanilla-cinnamon spirit, coconut spirit, ice, lime and Coca-Cola. 1 litre.', price: 100, category: 'cocktails', available: true },
  { id: 'cocktail-007', name: 'Woezor', description: 'Lime, crushed ice, coconut cane spirit, sugar and a splash of pineapple juice. 1 litre.', price: 100, category: 'cocktails', available: true },
  { id: 'cocktail-008', name: 'Mojito', description: 'Mint leaves, soda water, sugar, cane spirit, crushed ice and lime. 1 litre.', price: 100, category: 'cocktails', available: true },

  { id: 'mocktail-001', name: 'Ghana', description: 'Pulverized ice, hibiscus, lime, mint, passion fruit and brown sugar. 1 litre. Available at the East Legon Substation only.', price: 80, category: 'mocktails', available: false },
  { id: 'mocktail-002', name: 'Lyngwa', description: 'Mint, lime, bissap and ginger concentrate, soda water, ice and pineapple juice. 1 litre.', price: 100, category: 'mocktails', available: true },
  { id: 'mocktail-003', name: 'Lemonade Mocktail', description: 'Lime, soda water, ice and sugar.', price: 60, category: 'mocktails', available: true },

  { id: 'wine-001', name: 'House Red or White (Glass)', description: 'House red or white wine, by the glass.', price: 90, category: 'wine', available: true },
  { id: 'wine-002', name: 'House Red or White (Bottle)', description: 'House red or white wine, by the bottle.', price: 380, category: 'wine', available: true },
  { id: 'wine-003', name: 'Palm Wine', description: 'Local wine served fresh from the palm tree plantation.', price: 50, category: 'wine', available: true },

  { id: 'spirit-shot-001', name: 'Akpeteshie-Cane Spirit Shot (Ginger)', description: 'Ginger-infused Akpeteshie cane spirit shot.', price: 50, category: 'spirits', available: true },
  { id: 'spirit-shot-002', name: 'Akpeteshie-Cane Spirit Shot (Vanilla)', description: 'Vanilla-infused Akpeteshie cane spirit shot.', price: 50, category: 'spirits', available: true },
  { id: 'spirit-shot-003', name: 'Akpeteshie-Cane Spirit Shot (Coffee-Cocoa)', description: 'Coffee-cocoa-infused Akpeteshie cane spirit shot.', price: 50, category: 'spirits', available: true },
  { id: 'spirit-shot-004', name: 'Akpeteshie-Cane Spirit Shot (Coconut)', description: 'Coconut-infused Akpeteshie cane spirit shot.', price: 50, category: 'spirits', available: true },
  { id: 'spirit-shot-005', name: 'Akpeteshie-Cane Spirit Shot (Passion Fruit)', description: 'Passion-fruit-infused Akpeteshie cane spirit shot.', price: 50, category: 'spirits', available: true },
  { id: 'spirit-500-001', name: 'Akpeteshie Spirit Bottle (Ginger, 500 ml)', description: 'Ginger-infused Akpeteshie cane spirit. 500 ml bottle.', price: 400, category: 'spirits', available: true },
  { id: 'spirit-500-002', name: 'Akpeteshie Spirit Bottle (Vanilla & Cinnamon, 500 ml)', description: 'Vanilla and cinnamon-infused Akpeteshie cane spirit. 500 ml bottle.', price: 400, category: 'spirits', available: true },
  { id: 'spirit-500-003', name: 'Akpeteshie Spirit Bottle (Coffee-Cocoa, 500 ml)', description: 'Coffee-cocoa-infused Akpeteshie cane spirit. 500 ml bottle.', price: 400, category: 'spirits', available: true },
  { id: 'spirit-500-004', name: 'Akpeteshie Spirit Bottle (Coconut & Vanilla, 500 ml)', description: 'Coconut and vanilla-infused Akpeteshie cane spirit. 500 ml bottle.', price: 400, category: 'spirits', available: true },
  { id: 'spirit-500-005', name: 'Akpeteshie Spirit Bottle (Passion Fruit, 500 ml)', description: 'Passion-fruit-infused Akpeteshie cane spirit. 500 ml bottle.', price: 400, category: 'spirits', available: true },
  { id: 'spirit-1l-001', name: 'Akpeteshie Spirit Bottle (Ginger, 1 L)', description: 'Ginger-infused Akpeteshie cane spirit. 1 litre bottle.', price: 700, category: 'spirits', available: true },
  { id: 'spirit-1l-002', name: 'Akpeteshie Spirit Bottle (Vanilla & Cinnamon, 1 L)', description: 'Vanilla and cinnamon-infused Akpeteshie cane spirit. 1 litre bottle.', price: 700, category: 'spirits', available: true },
  { id: 'spirit-1l-003', name: 'Akpeteshie Spirit Bottle (Coffee-Cocoa, 1 L)', description: 'Coffee-cocoa-infused Akpeteshie cane spirit. 1 litre bottle.', price: 700, category: 'spirits', available: true },
  { id: 'spirit-1l-004', name: 'Akpeteshie Spirit Bottle (Coconut & Vanilla, 1 L)', description: 'Coconut and vanilla-infused Akpeteshie cane spirit. 1 litre bottle.', price: 700, category: 'spirits', available: true },
  { id: 'spirit-1l-005', name: 'Akpeteshie Spirit Bottle (Passion Fruit, 1 L)', description: 'Passion-fruit-infused Akpeteshie cane spirit. 1 litre bottle.', price: 700, category: 'spirits', available: true },

  { id: 'beer-001', name: 'Beer Sop', description: 'Club beer with bissap concentrate.', price: 50, category: 'beer', available: true },
  { id: 'beer-002', name: 'Ginger Beer', description: 'Club beer with ginger concentrate.', price: 50, category: 'beer', available: true },
  { id: 'beer-003', name: 'Sunshine Beer', description: 'Club beer with a lime dash and salt.', price: 50, category: 'beer', available: true },
  { id: 'beer-004', name: 'Star / Club (Small)', description: 'Star or Club beer, small size.', price: 40, category: 'beer', available: true },
  { id: 'beer-005', name: 'Star / Club (Large)', description: 'Star or Club beer, large size.', price: 60, category: 'beer', available: true },
  { id: 'beer-006', name: 'Smirnoff Ice', description: 'Smirnoff Ice.', price: 50, category: 'beer', available: true },
  { id: 'beer-007', name: 'Smirnoff Black', description: 'Smirnoff Black.', price: 50, category: 'beer', available: true },
  { id: 'beer-008', name: 'Guinness', description: 'Guinness stout.', price: 40, category: 'beer', available: true },
  { id: 'beer-009', name: 'Savannah Dry Cider', description: 'Savannah Dry cider.', price: 65, category: 'beer', available: true },
  { id: 'beer-010', name: 'Hunters Gold Cider', description: 'Hunters Gold cider.', price: 65, category: 'beer', available: true },
  { id: 'beer-011', name: 'Eagle Beer', description: 'Eagle beer.', price: 35, category: 'beer', available: true },
  { id: 'beer-012', name: 'Tale Beer', description: 'Tale beer.', price: 35, category: 'beer', available: true },

  { id: 'soft-001', name: 'Hibiscus Juice (Bissap)', description: 'Natural hibiscus juice, also known as bissap.', price: 45, category: 'soft-drinks', available: true },
  { id: 'soft-002', name: 'Pineapple Juice', description: 'Natural pineapple juice.', price: 50, category: 'soft-drinks', available: true },
  { id: 'soft-003', name: 'Soursop Iced Tea', description: 'Soursop iced tea sweetened with honey and spices.', price: 50, category: 'soft-drinks', available: true },
  { id: 'soft-004', name: 'Orange Juice', description: 'Pure orange juice.', price: 50, category: 'soft-drinks', available: true },
  { id: 'soft-005', name: 'House Lemonade', description: 'House lemonade.', price: 50, category: 'soft-drinks', available: true },
  { id: 'soft-006', name: 'Coke', description: 'Coca-Cola.', price: 30, category: 'soft-drinks', available: true },
  { id: 'soft-007', name: 'Fanta', description: 'Fanta.', price: 30, category: 'soft-drinks', available: true },
  { id: 'soft-008', name: 'Sprite', description: 'Sprite.', price: 30, category: 'soft-drinks', available: true },
  { id: 'soft-009', name: 'Alvaro', description: 'Alvaro.', price: 30, category: 'soft-drinks', available: true },
  { id: 'soft-010', name: 'Water', description: 'Bottled water.', price: 15, category: 'soft-drinks', available: true },
  { id: 'soft-011', name: 'Malta Guinness', description: 'Malta Guinness.', price: 35, category: 'soft-drinks', available: true },
  { id: 'soft-012', name: 'Soda Water', description: 'Soda water.', price: 30, category: 'soft-drinks', available: true },
];

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

export const INITIAL_MENU: MenuItem[] = RAW_MENU.map((item) => ({
  ...item,
  image: getMenuImage(item.name),
}));
