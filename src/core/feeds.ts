import type { SourceInfo } from '../shared/types.ts';

export const SOURCES: SourceInfo[] = [
  // English — Israel
  { id: 'toi', name: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/', lang: 'en', topic: 'Politics', region: 'israel', color: '#1F4E8C', monogram: 'TI', site: 'timesofisrael.com' },
  { id: 'ynetnews', name: 'Ynetnews', url: 'https://www.ynet.co.il/Integration/StoryRss3082.xml', lang: 'en', topic: 'Politics', region: 'israel', color: '#D7261E', monogram: 'yn', site: 'ynetnews.com' },
  { id: 'jpost', name: 'Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx', lang: 'en', topic: 'Politics', region: 'israel', color: '#13294B', monogram: 'JP', site: 'jpost.com' },
  { id: 'globes-en', name: 'Globes', url: 'https://en.globes.co.il/WebService/Rss/RssFeeder.asmx/FeederNode?iID=1725', lang: 'en', topic: 'Economy', region: 'israel', color: '#0E7C66', monogram: 'G', site: 'en.globes.co.il' },
  // English — world / business / tech
  { id: 'bbc-world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', lang: 'en', topic: 'World', region: 'world', color: '#B80000', monogram: 'BBC', site: 'bbc.com' },
  { id: 'bbc-business', name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', lang: 'en', topic: 'Economy', region: 'world', color: '#8C1D18', monogram: 'BBC', site: 'bbc.com' },
  { id: 'guardian-world', name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', lang: 'en', topic: 'World', region: 'world', color: '#052962', monogram: 'G', site: 'theguardian.com' },
  { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', lang: 'en', topic: 'Tech', region: 'world', color: '#0A9E01', monogram: 'TC', site: 'techcrunch.com' },
  // Hebrew — Israel
  { id: 'ynet', name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', lang: 'he', topic: 'Politics', region: 'israel', color: '#E1251B', monogram: 'y', site: 'ynet.co.il' },
  { id: 'maariv', name: 'מעריב', url: 'https://www.maariv.co.il/Rss/RssChadashot', lang: 'he', topic: 'Politics', region: 'israel', color: '#1C3F94', monogram: 'מ', site: 'maariv.co.il' },
  { id: 'srugim', name: 'סרוגים', url: 'https://www.srugim.co.il/feed', lang: 'he', topic: 'Politics', region: 'israel', color: '#2B6CB0', monogram: 'ס', site: 'srugim.co.il' },
  { id: 'geektime', name: 'Geektime', url: 'https://www.geektime.co.il/feed/', lang: 'he', topic: 'Tech', region: 'israel', color: '#6B2FBF', monogram: 'GT', site: 'geektime.co.il' },
  { id: 'globes-he', name: 'גלובס', url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2', lang: 'he', topic: 'Economy', region: 'israel', color: '#0E7C66', monogram: 'ג', site: 'globes.co.il' },
];

export const SOURCE_MAP = new Map(SOURCES.map((s) => [s.id, s]));
