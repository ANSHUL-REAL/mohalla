// "Smart Ask" — understands everyday sentences (English + Hinglish) and turns them into search filters.
// Example: "my AC is not cooling, need someone urgently near me"
//   → category: AC Repair, open now, nearest first

const CATEGORY_WORDS = {
  plumbers: ['plumber', 'plumbing', 'leak', 'leaking', 'pipe', 'tap', 'nal', 'drain', 'blockage', 'blocked', 'toilet', 'flush', 'water tank', 'geyser', 'bathroom fitting'],
  electricians: ['electrician', 'wiring', 'bijli', 'light', 'lights', 'fan', 'switch', 'socket', 'short circuit', 'inverter', 'mcb', 'power cut', 'current'],
  'ac-repair': ['ac', 'air conditioner', 'cooling', 'not cooling', 'gas refill', 'fridge', 'refrigerator', 'cooler'],
  doctors: ['doctor', 'clinic', 'fever', 'pain', 'cough', 'cold', 'tooth', 'teeth', 'toothache', 'dentist', 'checkup', 'sick', 'injury', 'hospital', 'bukhar', 'dard', 'child specialist', 'physician'],
  pharmacy: ['medicine', 'medicines', 'medical store', 'chemist', 'pharmacy', 'dawai', 'dawa', 'tablets'],
  restaurants: ['food', 'eat', 'hungry', 'khana', 'dinner', 'lunch', 'breakfast', 'biryani', 'pizza', 'cafe', 'restaurant', 'thali', 'momos', 'chai', 'coffee', 'burger', 'sweets'],
  hotels: ['hotel', 'room', 'stay', 'lodge', 'guest house', 'hostel'],
  'beauty-spa': ['haircut', 'hair cut', 'salon', 'parlour', 'parlor', 'facial', 'makeup', 'spa', 'massage', 'beard', 'baal', 'bridal', 'barber'],
  gyms: ['gym', 'workout', 'fitness', 'yoga', 'weight loss', 'exercise', 'zumba'],
  coaching: ['tuition', 'coaching', 'classes', 'jee', 'neet', 'tutor', 'padhai', 'exam', 'english speaking'],
  education: ['college', 'colleges', 'university', 'school', 'schools', 'campus', 'institute', 'degree college', 'admission'],
  'car-repair': ['car', 'mechanic', 'garage', 'puncture', 'tyre', 'gaadi', 'car wash', 'car service', 'battery'],
  'packers-movers': ['shifting', 'movers', 'packers', 'relocate', 'moving house', 'house shift'],
  grocery: ['grocery', 'kirana', 'vegetables', 'sabzi', 'fruits', 'milk', 'bread', 'supermarket', 'atta', 'ration', 'bakery'],
  banks: ['atm', 'cash', 'bank', 'paisa', 'withdraw', 'money'],
};

const URGENT = ['now', 'urgent', 'urgently', 'asap', 'immediately', 'tonight', 'abhi', 'jaldi', 'emergency', 'right now', 'quick', 'quickly'];
const NEAR = ['near me', 'nearby', 'near', 'close by', 'paas', 'around me', 'walking distance', 'nearest'];
const BEST = ['best', 'top', 'good', 'trusted', 'acha', 'achha', 'highly rated', 'reliable', 'famous'];
// Words that show the user is asking in a sentence, not typing a business name
const ASKING = ['need', 'want', 'looking', 'find', 'my', 'help', 'someone', 'chahiye', 'where', 'get', 'not working', 'not cooling',
  'broken', 'leaking', 'repair', 'fix', 'hungry', 'kaha', 'koi'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const has = (text, phrase) => new RegExp('(^|[^a-z])' + escapeRegex(phrase) + '($|[^a-z])').test(text);

export function smartAsk(input, categories = []) {
  const text = ` ${input.toLowerCase().replace(/[’']/g, '')} `;

  // Pick the category whose words match the most (longer phrases count more)
  let best = null, bestScore = 0;
  for (const [slug, list] of Object.entries(CATEGORY_WORDS)) {
    const score = list.reduce((s, w) => s + (has(text, w) ? (w.includes(' ') ? 2 : 1) : 0), 0);
    if (score > bestScore) { best = slug; bestScore = score; }
  }

  const urgent = URGENT.some((w) => has(text, w));
  const near = NEAR.some((w) => has(text, w)) || urgent;
  const wantsBest = BEST.some((w) => has(text, w));
  const rating = text.match(/(\d(?:\.\d)?)\s*(\+|star|stars)/);

  const chips = [];
  const params = {};
  if (best) {
    params.category = best;
    chips.push(categories.find((c) => c.slug === best)?.name || best);
  }
  if (urgent) { params.openNow = '1'; chips.push('Open now'); }
  if (near) { params.sort = 'distance'; chips.push('Nearest first'); }
  else if (wantsBest) { params.sort = 'rating'; chips.push('Top rated'); }
  if (rating) { params.minRating = rating[1]; chips.push(`${rating[1]}+ ★`); }

  const asking = ASKING.some((w) => has(text, w));
  // Only a "smart" question when it reads like a request ("need a plumber now"), never for plain names
  // like "fsb degree college" — those are searched by name so real places can be found.
  const isSmart = !!best && (urgent || near || wantsBest || !!rating || asking);
  return { isSmart, params, chips, near };
}

export const SMART_EXAMPLES = [
  'my AC is not cooling, need someone urgently',
  'best dentist near me',
  'tap leaking in bathroom, need plumber now',
  'hungry, want biryani nearby',
  'need cash, nearest ATM',
];
