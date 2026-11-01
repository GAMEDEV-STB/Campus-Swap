export const CAMPUS_EMAIL_DOMAIN = 'bmsce.ac.in';
export const AUTH_ALLOWED_EMAIL_DOMAINS = ['bmsce.ac.in', 'gmail.com'];

export const CATEGORIES = [
  'Books',
  'Electronics',
  'Furniture',
  'Clothing',
  'Bikes & transport',
  'Kitchen & dorm',
  'Sports & hobbies',
  'Other'
];

export const HINTS = {
  buy: 'Find what you need from students nearby.',
  sell: 'Turn things you no longer use into cash.',
  swap: 'Trade something you have for something you need.',
  donate: 'Give items a second life with someone on campus.',
  request: "Can't find it? Ask campus and let students offer it to you."
};

export const ACTIONS = {
  buy: 'Search',
  sell: 'Start selling',
  swap: 'Start a swap',
  donate: 'Donate an item',
  request: 'Request an item'
};

export const PLACEHOLDERS = {
  buy: 'Search listings on campus',
  sell: 'What do you want to sell?',
  swap: 'What do you want to swap?',
  donate: 'What do you want to donate?',
  request: 'What are you looking for?'
};

export const LABELS = {
  sell: 'For sale',
  swap: 'Swap',
  donate: 'Free',
  request: 'Wanted'
};

export const COMPLETE_LABEL = {
  sell: 'Mark as sold',
  swap: 'Mark as swapped',
  donate: 'Mark as donated',
  request: 'Mark as found'
};

export const DONE_LABEL = {
  sell: 'Sold',
  swap: 'Swapped',
  donate: 'Donated',
  request: 'Fulfilled'
};

export const CONDS = {
  new: 'New',
  good: 'Good',
  used: 'Used'
};

export const PLACES = ['Hostel block', 'Other'];

export const SPOTS = [
  'the library entrance',
  'the main canteen',
  'the main gate, near security',
  'the student centre'
];

export const RULES = [
  'Weapons or ammunition',
  'Alcohol, tobacco, vapes or drugs',
  'Stolen, counterfeit or pirated goods',
  'Leaked exam papers or answer keys'
];

export const BANNED = [
  [/\b(guns?|firearms?|ammo|ammunition|explosives?)\b/i, 'weapons'],
  [/\b(alcohol|beer|vodka|whisky|whiskey|rum|liquor|cigarettes?|vapes?|tobacco|hookah)\b/i, 'alcohol, tobacco or vapes'],
  [/\b(drugs?|weed|ganja|marijuana|cannabis)\b/i, 'drugs'],
  [/\b(stolen|counterfeit|fake id|pirated|cracked software)\b/i, 'stolen, fake or pirated goods'],
  [/\b(leaked|answer keys?)\b/i, 'leaked exam material']
];

export const REASONS = [
  'Prohibited item',
  'Scam or spam',
  'Harassment or abuse',
  'Wrong or misleading info',
  'Other'
];

export const QUICK = [
  'Is this still available?',
  'Where can we meet?',
  "What's the lowest you'll take?",
  'I can pick up today'
];

export const STOP = new Set('the and for with any need want looking buy sell some one new old used'.split(' '));

export const HOLD_DURATION = 24 * 60 * 60 * 1000;
