"""Downloads Creative Commons category photos from Openverse into client/public/img.
Run once:  python tools/fetch_images.py   (credits are saved to client/public/img/credits.json)"""
import io, json, os, sys, urllib.parse, urllib.request
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'client', 'public', 'img')
os.makedirs(OUT, exist_ok=True)
PER_CATEGORY = 6

QUERIES = {
    'restaurants': ['indian restaurant interior', 'restaurant food thali', 'cafe interior'],
    'hotels': ['hotel room bed', 'hotel lobby', 'hotel exterior india', 'hotel reception'],
    'doctors': ['stethoscope doctor', 'dentist chair', 'hospital doctor patient', 'medical clinic room'],
    'plumbers': ['plumber repair pipe', 'plumber working', 'kitchen sink tap', 'plumbing pipes'],
    'electricians': ['electrician wiring', 'electrician work', 'electrical panel repair'],
    'ac-repair': ['air conditioner repair', 'air conditioning technician', 'split air conditioner'],
    'beauty-spa': ['hairdresser cutting hair', 'barber shop', 'nail salon manicure', 'spa massage'],
    'gyms': ['dumbbells gym', 'treadmill gym', 'weightlifting gym', 'gym workout'],
    'coaching': ['classroom students india', 'classroom teaching', 'students studying'],
    'car-repair': ['mechanic car engine', 'car garage lift', 'car repair garage', 'auto mechanic workshop'],
    'packers-movers': ['cardboard boxes moving house', 'moving truck loading', 'movers carrying boxes', 'moving van'],
    'pharmacy': ['pharmacist', 'medicine pills', 'drugstore aisle', 'pharmacy counter'],
    'grocery': ['fruit vegetable shop', 'supermarket shelves', 'vegetable market india', 'grocery shop shelves'],
    'banks': ['atm machine', 'bank atm', 'bank counter'],
    'education': ['college campus india', 'university building', 'college students classroom', 'school building india'],
}

UA = {'User-Agent': 'LocalDirectoryCollegeProject/1.0'}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()

only = sys.argv[1:]
credits = {}
cpath = os.path.join(OUT, 'credits.json')
if os.path.exists(cpath):
    credits = json.load(open(cpath, encoding='utf8'))

for slug, queries in QUERIES.items():  # '_rejected' in credits.json lists photos never to use again
    if only and slug not in only:
        continue
    # keep photos already downloaded (bad ones can simply be deleted and this script re-run)
    saved = [e for e in credits.get(slug, []) if os.path.exists(os.path.join(OUT, e['file']))]
    seen = {e['source'] for e in saved} | set(credits.get('_rejected', []))
    for q in queries:
        if len(saved) >= PER_CATEGORY:
            break
        params = urllib.parse.urlencode({'q': q, 'page_size': 12, 'aspect_ratio': 'wide', 'license_type': 'commercial', 'mature': 'false'})
        try:
            results = json.loads(get(f'https://api.openverse.org/v1/images/?{params}'))['results']
        except Exception as e:
            print('search failed', slug, q, e); continue
        for r in results:
            if len(saved) >= PER_CATEGORY:
                break
            if r.get('foreign_landing_url') in seen or (r.get('width') or 0) < 640:
                continue
            seen.add(r.get('foreign_landing_url'))
            try:
                img = Image.open(io.BytesIO(get(r['url']))).convert('RGB')
            except Exception:
                continue
            # crop to 16:10 and resize to 800px wide
            w, h = img.size
            tw, th = (w, int(w * 10 / 16)) if w * 10 / 16 <= h else (int(h * 16 / 10), h)
            img = img.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th)).resize((800, 500))
            used = {e['file'] for e in saved}
            name = next(f'{slug}-{i}.jpg' for i in range(1, 50) if f'{slug}-{i}.jpg' not in used)
            img.save(os.path.join(OUT, name), 'JPEG', quality=78, optimize=True)
            saved.append({'file': name, 'title': r.get('title'), 'creator': r.get('creator'), 'license': r.get('license'),
                          'license_version': r.get('license_version'), 'source': r.get('foreign_landing_url')})
    credits[slug] = saved
    print(slug, len(saved))

json.dump(credits, open(cpath, 'w', encoding='utf8'), indent=1, ensure_ascii=False)
