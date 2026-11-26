import type { NewsLang, Topic } from '../shared/types.ts';

// English keywords are matched on word boundaries; Hebrew ones as substrings
// (Hebrew attaches prefixes like ה/ו/ב/ל/מ/ש directly to words).
const RULES: Record<Exclude<Topic, 'General'>, { en: string[]; he: string[] }> = {
  Security: {
    en: ['idf', 'military', 'army', 'missile', 'missiles', 'rocket', 'rockets', 'hamas', 'hezbollah', 'houthi', 'houthis', 'terror', 'terrorist', 'terrorists', 'airstrike', 'airstrikes', 'strike', 'strikes', 'soldier', 'soldiers', 'troops', 'war', 'drone', 'drones', 'ceasefire', 'hostage', 'hostages', 'shin bet', 'mossad', 'gunman', 'stabbing', 'shooting', 'defense', 'defence', 'nato', 'weapons', 'killed'],
    he: ['צה"ל', 'צה״ל', 'טיל', 'רקט', 'חמאס', 'חיזבאללה', 'חות\'ים', 'פיגוע', 'מחבל', 'חייל', 'לוחמ', 'מלחמ', 'ביטחונ', 'צבא', 'כטב"ם', 'שב"כ', 'מוסד', 'חטופ', 'הפסקת אש', 'יירוט', 'תקיפ', 'נהרג', 'ירי'],
  },
  Economy: {
    en: ['economy', 'economic', 'market', 'markets', 'stock', 'stocks', 'shares', 'bank', 'banks', 'inflation', 'interest rate', 'interest rates', 'shekel', 'budget', 'tax', 'taxes', 'gdp', 'prices', 'investors', 'investment', 'earnings', 'tariff', 'tariffs', 'trade', 'revenue', 'profit', 'bonds', 'oil', 'imf', 'jobs', 'wages', 'housing', 'mortgage'],
    he: ['כלכל', 'בורס', 'מניות', 'מניה', 'בנק', 'אינפלצי', 'ריבית', 'שקל', 'תקציב', 'מיסים', 'מס הכנסה', 'מחירי', 'משקיע', 'השקע', 'רווח', 'הכנסות', 'דולר', 'משכנת', 'נדל"ן', 'נדל״ן', 'שכר', 'אג"ח', 'תמ"ג', 'יצוא', 'מכס'],
  },
  Tech: {
    en: ['tech', 'technology', 'ai', 'artificial intelligence', 'startup', 'startups', 'software', 'app', 'apps', 'google', 'apple', 'microsoft', 'openai', 'nvidia', 'meta', 'amazon', 'cyber', 'cybersecurity', 'chip', 'chips', 'semiconductor', 'robot', 'robots', 'chatgpt', 'llm', 'crypto', 'bitcoin', 'saas', 'venture', 'funding round', 'smartphone', 'iphone', 'android', 'spacex', 'tesla', 'quantum'],
    he: ['הייטק', 'סטארט', 'בינה מלאכותית', 'טכנולוגי', 'סייבר', 'אפליקצי', 'גוגל', 'אפל', 'מיקרוסופט', 'אנבידיה', 'שבב', 'רובוט', 'תוכנה', 'הנפקה', 'גיוס הון', 'קריפטו', 'ביטקוין', 'סמארטפון', 'AI'],
  },
  Health: {
    en: ['health', 'hospital', 'hospitals', 'medical', 'medicine', 'doctor', 'doctors', 'nurse', 'virus', 'disease', 'vaccine', 'vaccines', 'cancer', 'patients', 'patient', 'covid', 'measles', 'outbreak', 'drug', 'drugs', 'mental health', 'nhs', 'who', 'surgery', 'obesity'],
    he: ['בריאות', 'בית חולים', 'בתי חולים', 'רפוא', 'רופא', 'נגיף', 'מחל', 'חיסונ', 'סרטן', 'מטופל', 'חולים', 'קורונה', 'חצבת', 'תרופ', 'ניתוח', 'אחות'],
  },
  Culture: {
    en: ['culture', 'film', 'films', 'movie', 'movies', 'music', 'art', 'arts', 'book', 'books', 'festival', 'celebrity', 'tv', 'television', 'eurovision', 'museum', 'singer', 'actor', 'actress', 'album', 'concert', 'oscar', 'oscars', 'netflix', 'theatre', 'theater', 'football', 'sport', 'sports', 'olympic', 'olympics', 'fashion'],
    he: ['תרבות', 'סרט', 'מוזיק', 'אמנות', 'ספר ', 'פסטיבל', 'זמר', 'שחקן', 'שחקנית', 'מוזיאון', 'אירוויזיון', 'הופעה', 'אלבום', 'טלוויזי', 'תיאטרון', 'כדורגל', 'ספורט', 'אולימפי', 'אופנה', 'סלבס'],
  },
  Politics: {
    en: ['election', 'elections', 'knesset', 'minister', 'ministers', 'government', 'coalition', 'parliament', 'president', 'netanyahu', 'vote', 'voters', 'court', 'supreme court', 'opposition', 'lawmaker', 'lawmakers', 'senate', 'congress', 'trump', 'prime minister', 'party', 'cabinet', 'bill', 'legislation', 'politics', 'political', 'diplomat', 'diplomatic', 'sanctions', 'policy'],
    he: ['כנסת', 'השר ', 'שרת ', 'שר ה', 'ממשל', 'קואליצי', 'בחירות', 'נתניהו', 'אופוזיצי', 'בג"ץ', 'בג״ץ', 'ראש הממשלה', 'מפלג', 'הצבעה', 'חוק ', 'הצעת חוק', 'פוליטי', 'יועמ"ש', 'נשיא', 'ליכוד', 'טראמפ', 'קבינט', 'ח"כ', 'ח״כ'],
  },
  World: {
    en: ['ukraine', 'russia', 'china', 'europe', 'european union', 'eu', 'un', 'united nations', 'africa', 'india', 'brazil', 'germany', 'france', 'uk', 'britain', 'syria', 'lebanon', 'iran', 'turkey', 'japan', 'korea', 'mexico', 'canada', 'australia', 'global', 'international', 'world'],
    he: ['אוקראינ', 'רוסי', 'סין', 'אירופ', 'האו"ם', 'האו״ם', 'הודו', 'גרמני', 'צרפת', 'בריטני', 'סוריה', 'לבנון', 'איראן', 'טורקי', 'יפן', 'קוריאה', 'ארה"ב', 'ארה״ב', 'בעולם', 'בינלאומי', 'וושינגטון', 'מוסקבה'],
  },
};

const CATEGORY_MAP: [RegExp, Topic][] = [
  [/(\b(politic|election|knesset|government)|פוליטי|מדיני|בחירות|כנסת)/i, 'Politics'],
  [/(\b(econom|business|market|financ|money|bank|real estate)|כלכל|עסקים|שוק ההון|נדל|צרכנות|כסף)/i, 'Economy'],
  [/(\b(tech|science|startup|cyber|gadget|ai|artificial|venture|apps?)\b|\btech|הייטק|טכנולוג|מדע|סטארט|סייבר)/i, 'Tech'],
  [/(\b(security|defen[cs]e|military|terror|war|idf|israel at war|hamas)\b|\bterror|ביטחון|צבא|מלחמ|צה"ל|צה״ל)/i, 'Security'],
  [/(\b(health|medic|wellness)|בריאות|רפוא)/i, 'Health'],
  [/(\b(culture|arts?|entertainment|film|music|books?|sports?|lifestyle|food|travel|celeb)\b|תרבות|בידור|ספורט|אוכל|תיירות|סלבס|אמנות|פנאי)/i, 'Culture'],
  [/(\b(world|international|middle east|europe|asia|africa|americas|us news|global)\b|עולם|בעולם|חו"ל|חו״ל)/i, 'World'],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EN_REGEX = Object.fromEntries(
  Object.entries(RULES).map(([t, r]) => [t, r.en.map((k) => new RegExp(`\\b${escapeRe(k)}\\b`, 'i'))]),
) as Record<string, RegExp[]>;

export function classify(title: string, summary: string, categories: string[], lang: NewsLang, fallback: Topic): Topic {
  const scores = new Map<Topic, number>();
  const add = (t: Topic, n: number) => scores.set(t, (scores.get(t) || 0) + n);

  for (const c of categories) {
    for (const [re, topic] of CATEGORY_MAP) if (re.test(c)) { add(topic, 3); break; }
  }
  const headline = title;
  const body = summary.slice(0, 600);
  for (const [topic, rule] of Object.entries(RULES) as [Exclude<Topic, 'General'>, { en: string[]; he: string[] }][]) {
    if (lang === 'en') {
      for (const re of EN_REGEX[topic]) {
        if (re.test(headline)) add(topic, 2);
        else if (re.test(body)) add(topic, 1);
      }
    } else {
      for (const k of rule.he) {
        if (headline.includes(k)) add(topic, 2);
        else if (body.includes(k)) add(topic, 1);
      }
      // Hebrew posts sometimes contain English tech words
      for (const re of EN_REGEX[topic]) if (re.test(headline)) add(topic, 1);
    }
  }
  if (scores.size === 0) {
    // No signal at all: specialist desks keep their desk, general desks → General.
    return fallback === 'Economy' || fallback === 'Tech' ? fallback : 'General';
  }
  // Light bias toward the newsroom's own desk so weak signals don't flip it.
  add(fallback, 1.5);
  // "World" is a weak catch-all signal for Israeli outlets.
  if (scores.has('World') && fallback !== 'World') scores.set('World', (scores.get('World') || 0) * 0.6);

  let best: Topic = fallback;
  let bestScore = 0;
  for (const [t, s] of scores) if (s > bestScore) { best = t; bestScore = s; }
  return bestScore >= 1.5 ? best : 'General';
}
