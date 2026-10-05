// Fills the database with sample categories, businesses, users and reviews.
// Run `npm run seed` to wipe and re-create all demo data.
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { db, transaction, CITY_COORDS } from './db.js';

// Small seeded random generator so the demo data is the same every time
function makeRandom(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = [
  {
    name: 'Restaurants', slug: 'restaurants', icon: 'Utensils', color: '#FD5A46',
    keywords: 'food dining eat cafe biryani pizza thali dinner lunch',
    hours: { open: '11:00', close: '23:00', closed: [] },
    names: ['Spice Route', 'The Tandoor House', 'Green Leaf Cafe', 'Punjabi Rasoi', 'Biryani Mahal', 'Urban Bites', 'Saffron Kitchen', 'Masala Junction'],
    services: ['Dine-in', 'Home Delivery', 'Takeaway', 'North Indian', 'Chinese', 'South Indian', 'Family Seating', 'Party Orders', 'Pure Veg'],
    desc: (n) => `${n} serves freshly cooked North Indian, Chinese and continental dishes in a warm, family-friendly setting. Known for quick service, hygienic kitchen and generous portions.`,
  },
  {
    name: 'Hotels', slug: 'hotels', icon: 'BedDouble', color: '#552CB7',
    keywords: 'stay room lodge resort guest house accommodation',
    hours: { open: '00:00', close: '23:59', closed: [] },
    names: ['Hotel Royal Residency', 'Comfort Inn Suites', 'The Grand Palace', 'Hotel Silver Oak', 'Mountain View Stay', 'City Heart Hotel', 'Hotel Blue Moon'],
    services: ['AC Rooms', 'Free WiFi', 'Room Service', 'Parking', 'Restaurant', 'Banquet Hall', '24x7 Check-in', 'Airport Pickup'],
    desc: (n) => `${n} offers clean, comfortable rooms with modern amenities, courteous staff and easy access to the main market and railway station.`,
  },
  {
    name: 'Doctors', slug: 'doctors', icon: 'Stethoscope', color: '#058CD7',
    keywords: 'clinic physician health medical hospital dentist checkup',
    hours: { open: '10:00', close: '20:00', closed: ['sun'] },
    names: ['Dr. Sharma Clinic', 'Care Plus Clinic', 'Dr. Mehta Family Clinic', 'LifeLine Health Centre', 'Smile Dental Care', 'Dr. Rawat Child Clinic', 'Apex Multispeciality Clinic'],
    services: ['General Physician', 'Child Specialist', 'Dentist', 'Health Checkup', 'Diabetes Care', 'Vaccination', 'Online Consultation', 'Lab Tests'],
    desc: (n) => `${n} provides trusted medical consultation with experienced doctors, modern diagnostic equipment and minimal waiting time.`,
  },
  {
    name: 'Plumbers', slug: 'plumbers', icon: 'Wrench', color: '#00995E',
    keywords: 'plumbing pipe leak tap water tank bathroom fitting',
    hours: { open: '08:00', close: '20:00', closed: [] },
    names: ['QuickFix Plumbing', 'Aqua Plumbing Services', 'Leak Stop Experts', 'Ravi Plumbing Works', 'PipeCare Solutions', 'HomeServe Plumbers'],
    services: ['Leak Repair', 'Tap & Mixer Fitting', 'Water Tank Cleaning', 'Bathroom Fitting', 'Drain Blockage', 'Motor Installation', '24x7 Emergency'],
    desc: (n) => `${n} handles all household and commercial plumbing work — leak repair, new fittings, blockages and tank cleaning — with same-day visits.`,
  },
  {
    name: 'Electricians', slug: 'electricians', icon: 'Zap', color: '#FFC567',
    keywords: 'electric wiring light fan switch inverter repair',
    hours: { open: '09:00', close: '20:00', closed: [] },
    names: ['PowerPoint Electricals', 'Bright Spark Electricians', 'Volt Masters', 'Safe Wiring Services', 'Shiv Electric Works', 'Current Care'],
    services: ['House Wiring', 'Fan & Light Fitting', 'Inverter Installation', 'MCB & Switchboard', 'Short Circuit Repair', 'CCTV Installation'],
    desc: (n) => `${n} offers safe and certified electrical services for homes and offices, from new wiring to fan fitting and inverter setup.`,
  },
  {
    name: 'AC Repair', slug: 'ac-repair', icon: 'AirVent', color: '#058CD7',
    keywords: 'air conditioner cooling service gas refill split window',
    hours: { open: '09:00', close: '21:00', closed: [] },
    names: ['CoolCare AC Services', 'Chill Zone AC Repair', 'Frost Air Solutions', 'Polar AC Experts', 'Arctic Cool Services'],
    services: ['AC Servicing', 'Gas Refilling', 'Split AC Installation', 'Window AC Repair', 'AMC Plans', 'Fridge Repair'],
    desc: (n) => `${n} repairs and services all brands of split and window ACs. Trained technicians, genuine spare parts and 30-day service warranty.`,
  },
  {
    name: 'Beauty & Spa', slug: 'beauty-spa', icon: 'Sparkles', color: '#FB7DA8',
    keywords: 'salon parlour parlor haircut makeup facial spa massage bridal',
    hours: { open: '10:00', close: '21:00', closed: ['tue'] },
    names: ['Glamour Beauty Salon', 'Looks Unisex Salon', 'Bliss Spa & Wellness', 'Style Studio', 'Glow Up Parlour', 'Mirror Mirror Salon'],
    services: ['Haircut', 'Hair Colour', 'Facial', 'Bridal Makeup', 'Manicure & Pedicure', 'Body Massage', 'Waxing'],
    desc: (n) => `${n} is a premium unisex salon offering hair, skin and bridal services by trained stylists using branded products.`,
  },
  {
    name: 'Gyms', slug: 'gyms', icon: 'Dumbbell', color: '#FD5A46',
    keywords: 'fitness workout yoga zumba trainer crossfit',
    hours: { open: '05:30', close: '22:00', closed: [] },
    names: ['Iron Paradise Gym', 'FitZone Fitness', 'Muscle Factory', 'Pulse Fitness Club', 'Gold Fit Gym', 'Flex Nation'],
    services: ['Weight Training', 'Cardio', 'Personal Trainer', 'Yoga', 'Zumba', 'Diet Plans', 'Steam Bath'],
    desc: (n) => `${n} is a fully equipped fitness centre with certified trainers, modern machines and flexible monthly memberships.`,
  },
  {
    name: 'Coaching Classes', slug: 'coaching', icon: 'GraduationCap', color: '#00995E',
    keywords: 'tuition institute classes jee neet exam education tutor school',
    hours: { open: '07:00', close: '20:00', closed: ['sun'] },
    names: ['Bright Future Academy', 'Success Point Classes', 'Concept Coaching Centre', 'Aim High Institute', 'Vidya Tutorials', 'Edu Star Classes'],
    services: ['JEE Coaching', 'NEET Coaching', 'Class 10 & 12 Boards', 'Spoken English', 'Computer Courses', 'Online Classes'],
    desc: (n) => `${n} offers result-oriented coaching with experienced faculty, small batches, regular tests and doubt-clearing sessions.`,
  },
  {
    name: 'Car Repair', slug: 'car-repair', icon: 'Car', color: '#552CB7',
    keywords: 'garage mechanic car service wash denting painting auto',
    hours: { open: '09:00', close: '19:30', closed: [] },
    names: ['AutoCare Garage', 'Speed Motors Workshop', 'Wheels & Deals Service', 'Car Doctor', 'Torque Auto Works', 'Express Car Care'],
    services: ['General Service', 'Denting & Painting', 'Car Wash', 'Wheel Alignment', 'AC Repair', 'Battery Replacement', 'Pickup & Drop'],
    desc: (n) => `${n} is a multi-brand car workshop offering periodic service, repairs, denting-painting and doorstep pickup at fair prices.`,
  },
  {
    name: 'Packers & Movers', slug: 'packers-movers', icon: 'Truck', color: '#FFC567',
    keywords: 'shifting relocation moving transport house shifting',
    hours: { open: '08:00', close: '21:00', closed: [] },
    names: ['SafeShift Packers & Movers', 'Agarwal Relocation Services', 'Quick Move Logistics', 'Home Shift Experts', 'Trusty Movers'],
    services: ['House Shifting', 'Office Relocation', 'Car Transport', 'Packing Material', 'Storage', 'Insurance'],
    desc: (n) => `${n} provides safe, insured household and office shifting within the city and across India, with careful packing and on-time delivery.`,
  },
  {
    name: 'Pharmacy', slug: 'pharmacy', icon: 'Pill', color: '#FB7DA8',
    keywords: 'chemist medical store medicine drug store',
    hours: { open: '08:00', close: '23:00', closed: [] },
    names: ['Apollo Care Pharmacy', 'MedPlus Chemist', 'Shree Medical Store', 'HealthFirst Pharmacy', 'Wellness Medicos', 'City Chemist'],
    services: ['Prescription Medicines', 'Home Delivery', 'Surgical Items', 'Baby Care', 'Health Supplements', 'Discounts'],
    desc: (n) => `${n} stocks genuine medicines, surgical items and wellness products with free home delivery in the neighbourhood.`,
  },
  // These two are filled only with real businesses from OpenStreetMap (no made-up banks or shops)
  {
    name: 'Grocery & Supermarkets', slug: 'grocery', icon: 'ShoppingCart', color: '#00995E', seed: false,
    keywords: 'kirana general store supermarket vegetables fruits bakery dairy provision', names: [], services: [], desc: () => '',
  },
  {
    name: 'Banks & ATMs', slug: 'banks', icon: 'Landmark', color: '#552CB7', seed: false,
    keywords: 'bank atm cash finance money', names: [], services: [], desc: () => '',
  },
  {
    name: 'Colleges & Schools', slug: 'education', icon: 'School', color: '#058CD7', seed: false,
    keywords: 'college university school institute campus kindergarten education', names: [], services: [], desc: () => '',
  },
  {
    name: 'Other Places', slug: 'places', icon: 'MapPin', color: '#FB7DA8', seed: false,
    keywords: 'place landmark temple park office', names: [], services: [], desc: () => '',
  },
];

const CITY_AREAS = {
  Dehradun: ['Rajpur Road', 'Paltan Bazaar', 'Clement Town', 'Prem Nagar', 'Sahastradhara Road', 'Ballupur', 'ISBT'],
  Delhi: ['Connaught Place', 'Karol Bagh', 'Lajpat Nagar', 'Saket', 'Dwarka', 'Rohini'],
  Mumbai: ['Andheri West', 'Bandra', 'Dadar', 'Powai', 'Borivali', 'Colaba'],
  Bengaluru: ['Koramangala', 'Indiranagar', 'Whitefield', 'Jayanagar', 'HSR Layout', 'MG Road'],
  Pune: ['Kothrud', 'Viman Nagar', 'Hinjewadi', 'Baner', 'Shivaji Nagar'],
  Jaipur: ['Malviya Nagar', 'Vaishali Nagar', 'C-Scheme', 'Raja Park', 'Mansarovar'],
  Hyderabad: ['Kukatpally', 'KPHB Colony', 'Madhapur', 'Gachibowli', 'Ameerpet', 'Banjara Hills', 'Secunderabad'],
};

const REVIEWER_NAMES = [
  'Aarav Gupta', 'Priya Singh', 'Rohit Verma', 'Sneha Rawat', 'Karan Malhotra', 'Neha Joshi', 'Vikas Negi',
  'Ananya Iyer', 'Rahul Bisht', 'Pooja Kapoor', 'Arjun Nair', 'Simran Kaur', 'Aditya Rao', 'Kavya Reddy',
  'Manish Thakur', 'Isha Bhatt', 'Siddharth Jain', 'Ritika Chauhan', 'Deepak Pandey', 'Meera Pillai',
];

const COMMENTS = {
  5: ['Excellent service, highly recommended!', 'Very professional and on time. Will definitely come again.', 'Best in the area, totally worth it.', 'Amazing experience, staff was very polite and helpful.', 'Quick response and great quality work.'],
  4: ['Good experience overall, slightly pricey.', 'Nice service, they were a little late but did the job well.', 'Quality is good, would recommend to friends.', 'Friendly staff and reasonable rates.'],
  3: ['Average experience, could be better.', 'Okay service, nothing special.', 'Decent, but waiting time was long.'],
  2: ['Took too long to respond.', 'Not satisfied with the quality this time.'],
  1: ['Very poor experience, would not recommend.'],
};

export function seed() {
  const rand = makeRandom(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const sample = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const phone = () => `+91 9${between(1000, 9999)}${between(10000, 99999)}`;
  const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  transaction(() => {
    for (const t of ['enquiry_messages', 'favorites', 'enquiries', 'reviews', 'businesses', 'categories', 'users', 'synced_areas']) db.exec(`DELETE FROM ${t}`);
    db.exec(`DELETE FROM sqlite_sequence`);

    // --- Users (demo logins are listed in README.md) ---
    const addUser = db.prepare('INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)');
    const hash = (p) => bcrypt.hashSync(p, 8);
    addUser.run('Admin', 'admin@mohalla.test', hash('admin123'), '+91 9000000001', 'admin');
    const ownerId = Number(addUser.run('Rakesh Business Owner', 'owner@mohalla.test', hash('owner123'), '+91 9000000002', 'business').lastInsertRowid);
    addUser.run('Demo User', 'user@mohalla.test', hash('user123'), '+91 9000000003', 'user');
    const reviewerHash = hash('password123');
    const reviewerIds = REVIEWER_NAMES.map((n) =>
      Number(addUser.run(n, n.toLowerCase().replace(' ', '.') + '@example.com', reviewerHash, phone(), 'user').lastInsertRowid),
    );

    // --- Categories ---
    const addCat = db.prepare('INSERT INTO categories (name, slug, icon, color, keywords) VALUES (?, ?, ?, ?, ?)');
    const catIds = {};
    for (const c of CATEGORIES) catIds[c.slug] = Number(addCat.run(c.name, c.slug, c.icon, c.color, c.keywords).lastInsertRowid);

    // --- Businesses + reviews ---
    const addBiz = db.prepare(`INSERT INTO businesses
      (owner_id, category_id, name, description, phone, whatsapp, address, area, city, lat, lng, hours, services,
       established, is_approved, is_featured, is_verified, views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const addReview = db.prepare('INSERT INTO reviews (user_id, business_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)');

    for (const [city, areas] of Object.entries(CITY_AREAS)) {
      const [cLat, cLng] = CITY_COORDS[city];
      for (const c of CATEGORIES.filter((cat) => cat.seed !== false)) {
        const names = sample(c.names, 2);
        names.forEach((name, i) => {
          const area = pick(areas);
          const ph = phone();
          const isOwners = city === 'Dehradun' && i === 0; // demo owner owns some Dehradun listings
          const approved = !(city === 'Dehradun' && i === 1 && ['gyms', 'pharmacy'].includes(c.slug)) ? 1 : 0;
          const id = Number(addBiz.run(
            isOwners ? ownerId : null,
            catIds[c.slug], name, c.desc(name), ph, ph,
            `Shop No. ${between(1, 120)}, ${area}, ${city}`, area, city,
            +(cLat + (rand() - 0.5) * 0.08).toFixed(5), +(cLng + (rand() - 0.5) * 0.08).toFixed(5),
            JSON.stringify(c.hours), JSON.stringify(sample(c.services, between(4, 6))),
            between(1995, 2022), approved, rand() < 0.18 ? 1 : 0, rand() < 0.6 ? 1 : 0,
            between(40, 2500), daysAgo(between(10, 700)),
          ).lastInsertRowid);

          // Each business gets reviews from random reviewers; ratings lean positive
          for (const uid of sample(reviewerIds, between(2, 12))) {
            const r = rand();
            const rating = r < 0.45 ? 5 : r < 0.8 ? 4 : r < 0.93 ? 3 : r < 0.98 ? 2 : 1;
            addReview.run(uid, id, rating, pick(COMMENTS[rating]), daysAgo(between(1, 300)));
          }
        });
      }
    }

    // Some businesses show a live status set by their owner (expires after 12 hours, re-run seed before a demo)
    const setLive = db.prepare("UPDATE businesses SET live_status = ?, live_status_at = datetime('now') WHERE id = ?");
    for (const { id } of db.prepare('SELECT id FROM businesses').all()) {
      const r = rand();
      if (r < 0.2) setLive.run('available', id);
      else if (r < 0.28) setLive.run('busy', id);
      else if (r < 0.31) setLive.run('closed_today', id);
    }

    // A real college added by hand (details from its public website, fsb.org.in) — not in OpenStreetMap yet
    const edu = db.prepare("SELECT id FROM categories WHERE slug = 'education'").get();
    if (edu) {
      db.prepare(`INSERT INTO businesses (category_id, name, description, phone, address, area, city, lat, lng, website, hours,
          services, established, is_approved, is_verified, views, created_at, source)
        VALUES (?, ?, ?, '', ?, 'Kukatpally', 'Hyderabad', 17.48521, 78.41158, 'https://www.fsb.org.in', ?, ?, NULL, 1, 1, 1200, datetime('now', '-30 days'), 'real')`).run(
        edu.id, 'FSB Degree College (Fortune School of Business)',
        'Fortune School of Business (FSB) is a degree college in Kukatpally, Hyderabad offering career-oriented BBA, BCA, B.Com and PGDM programmes with smart classrooms, a digital e-library and industry-linked training.',
        'Kothari Solitaire, beside Govt. Degree College, Metro Pillar 830, Kukatpally, Hyderabad',
        JSON.stringify({ open: '09:00', close: '17:00', closed: ['sun'] }),
        JSON.stringify(['BBA', 'BCA', 'B.Com (Computers)', 'B.Com Hons', 'PGDM', 'Business Analytics', 'Data Science']),
      );
    }

    // A couple of enquiries for the demo owner's dashboard
    const addEnq = db.prepare('INSERT INTO enquiries (user_id, business_id, name, phone, message, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const ownerBiz = db.prepare('SELECT id FROM businesses WHERE owner_id = ? LIMIT 3').all(ownerId);
    const msgs = ['Hi, I need a quotation for this weekend. Please call me.', 'What are your charges? Are you available tomorrow morning?', 'Please share your best price.'];
    ownerBiz.forEach((b, i) => addEnq.run(reviewerIds[i], b.id, REVIEWER_NAMES[i], phone(), msgs[i], daysAgo(i)));
  });

  const count = db.prepare('SELECT COUNT(*) AS n FROM businesses').get().n;
  console.log(`Seeded ${CATEGORIES.length} categories and ${count} businesses.`);
}

// Adds categories that were introduced after the database was first created
export function ensureCategories() {
  const add = db.prepare('INSERT OR IGNORE INTO categories (name, slug, icon, color, keywords) VALUES (?, ?, ?, ?, ?)');
  for (const c of CATEGORIES) add.run(c.name, c.slug, c.icon, c.color, c.keywords);
}

export function seedIfEmpty() {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categories').get();
  if (n === 0) seed();
}

// Allow `node seed.js` to reset the data directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) seed();
