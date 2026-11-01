import { BANNED, STOP, LABELS, CONDS, HOLD_DURATION } from '../constants';

export { HOLD_DURATION };

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const hasPasswordVariety = (password) =>
  [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length >= 3;

export function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 720;
      const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * sc);
      canvas.height = Math.round(img.height * sc);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export const displayValue = (v) =>
  v == null || String(v).trim().toLowerCase() === 'null' ? '' : String(v).trim();

export const priceText = (l) => {
  if (!l) return '';
  if (l.type === 'sell') return '₹' + (displayValue(l.price) || '0');
  if (l.type === 'swap') return 'Wants: ' + (displayValue(l.want) || 'open to offers');
  if (l.type === 'request') {
    return displayValue(l.price) ? 'Budget: ₹' + displayValue(l.price) : 'Open budget';
  }
  return 'Free to claim';
};

export function isHeld(l) {
  if (!l || !l.reservedUntil) return false;
  return Date.now() <= l.reservedUntil;
}

export const holdLabel = (l) => {
  if (!isHeld(l)) return '';
  const d = new Date(l.reservedUntil);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = d.toDateString() === new Date().toDateString();
  return 'Held until ' + timeStr + (isToday ? '' : ' ' + d.toLocaleDateString());
};

export const bannedHit = (t) => {
  const m = BANNED.find(([r]) => r.test(t));
  return m ? m[1] : '';
};

export const toks = (s) =>
  (String(s).toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => !STOP.has(w));

export const textOf = (l) =>
  (l.title + ' ' + (l.desc || '') + ' ' + (l.course || '') + ' ' + (l.want || '')).toLowerCase();

export const overlap = (r, l) => {
  const a = toks(r.title + ' ' + (r.course || ''));
  return a.length > 0 && a.filter((w) => textOf(l).includes(w)).length >= Math.ceil(a.length / 2);
};

export function passesFilter(l, f) {
  if (f.cat && f.cat !== 'All' && l.category !== f.cat) return false;
  if (f.type && f.type !== 'all' && l.type !== f.type) return false;
  if (f.cond && f.cond !== 'all' && l.cond !== f.cond) return false;
  if (f.place && f.place !== 'all' && l.place !== f.place) return false;
  if (f.course && !(l.course || '').toLowerCase().includes(String(f.course).toLowerCase().trim()))
    return false;
  if (f.free && !(l.type === 'donate' || (l.type === 'sell' && !l.price))) return false;
  const lo = f.min === '' || f.min == null ? null : +f.min;
  const hi = f.max === '' || f.max == null ? null : +f.max;
  if (lo !== null || hi !== null) {
    if (l.type === 'swap') return false;
    const p = l.price || 0;
    if (lo !== null && p < lo) return false;
    if (hi !== null && p > hi) return false;
  }
  if (f.q) {
    const w = toks(f.q);
    const searchTerms = w.length ? w : [f.q.toLowerCase()];
    if (!searchTerms.every((x) => textOf(l).includes(x))) return false;
  }
  return true;
}

export function describeFilter(f) {
  const p = [];
  if (f.q) p.push('“' + f.q + '”');
  if (f.cat && f.cat !== 'All') p.push(f.cat);
  if (f.type && f.type !== 'all') p.push(LABELS[f.type] || f.type);
  if (f.cond && f.cond !== 'all') p.push(CONDS[f.cond] || f.cond);
  if (f.place && f.place !== 'all') p.push(f.place);
  if (f.free) p.push('free only');
  if (f.course) p.push('course ' + f.course);
  if (f.min !== '' || f.max !== '') {
    p.push('₹' + (f.min || 0) + ' to ' + (f.max !== '' ? '₹' + f.max : 'any'));
  }
  return p.join(', ');
}

export const photosOf = (l) => {
  if (!l) return [];
  const photos = l.photos && l.photos.length ? l.photos : l.photo ? [l.photo] : [];
  return photos.filter(
    (p) => typeof p === 'string' && p.trim() && p.trim().toLowerCase() !== 'null'
  );
};

export const doneCount = (email, listings = []) =>
  listings.filter((x) => x.owner === email && x.status === 'done').length;

export const ratingOf = (email, ratings = []) => {
  const list = ratings.filter((x) => x.to === email);
  return {
    n: list.length,
    avg: list.length ? list.reduce((a, x) => a + x.stars, 0) / list.length : 0,
    list
  };
};

export const starTxt = (email, ratings = []) => {
  const r = ratingOf(email, ratings);
  return r.n ? `★ ${r.avg.toFixed(1)} (${r.n})` : 'No ratings yet';
};

export const badgeList = (email, listings = [], ratings = []) => {
  const n = doneCount(email, listings);
  const don = listings.filter(
    (x) => x.owner === email && x.status === 'done' && x.type === 'donate'
  ).length;
  const r = ratingOf(email, ratings);
  const b = [];
  if (n >= 1) b.push('First swap');
  if (n >= 3) b.push('Regular');
  if (n >= 5) b.push('Campus hero');
  if (don >= 1) b.push('Giver');
  if (r.n >= 3 && r.avg >= 4.5) b.push('Trusted');
  return b;
};

export const loadStorage = (key, defaultVal) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
};

export const saveStorage = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
};
