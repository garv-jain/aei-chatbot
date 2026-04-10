const axios = require('axios');
const cheerio = require('cheerio');

const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const BASE_URL = 'https://www.aei.org';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Convert domain folder name like "Shane_Tews" back to "Shane Tews" for AEI search
function domainToScholarName(domainName) {
  return domainName.replace(/_/g, ' ');
}

// Fetch article URLs from AEI search results for a scholar
async function fetchScholarArticleLinks(scholarName, maxArticles = 10) {
  const slug = scholarName.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  const url = `${BASE_URL}/scholar/${slug}/`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 AEI-Internal-Chatbot/1.0' },
      httpsAgent,
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const links = [];
    const seen = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (
        href &&
        href.startsWith('https://www.aei.org/') &&
        !href.includes('/profile/') &&
        !href.includes('/scholar/') &&
        !href.includes('/policy-areas/') &&
        !href.includes('/aeideas/') &&
        !href.includes('/search-results/') &&
        !href.includes('/donate/') &&
        !href.includes('/events/') &&
        !href.includes('wp-content') &&
        !href.includes('mailto:') &&
        !seen.has(href)
      ) {
        seen.add(href);
        links.push(href);
      }
    });

    console.log(`Found ${links.length} article links on scholar page for ${scholarName}`);
    return links.slice(0, maxArticles);

  } catch (error) {
    console.error(`Error fetching scholar page for ${scholarName}:`, error.message);
    return [];
  }
}

// Scrape a single AEI article for title, date, author, and body
async function scrapeArticle(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 AEI-Internal-Chatbot/1.0' },
      timeout: 10000,
      httpsAgent
    });

    const $ = cheerio.load(response.data);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      'Unknown Title';

    const date =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time').first().attr('datetime') ||
      $('time').first().text().trim() ||
      'Unknown Date';

    const author =
      $('meta[name="author"]').attr('content') ||
      $('[class*="author"]').first().text().trim() ||
      'AEI Scholar';

    // Extract body — try article/main tags like readability does
    let body = '';
    for (const selector of ['article', 'main', '[class*="content"]', '[class*="body"]']) {
      const text = $(selector).text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) {
        body = text.substring(0, 3000);
        break;
      }
    }

    if (!body) return null;
    return { title, date, author, url, body };

  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

// Score relevance of an article to a query
function scoreRelevance(article, query) {
  const words = query.toLowerCase().split(/\s+/);
  const text = `${article.title} ${article.body}`.toLowerCase();
  return words.reduce((score, word) => {
    return score + (text.match(new RegExp(word, 'g')) || []).length;
  }, 0);
}

// Main export: fetch top relevant live articles for a query
async function fetchRelevantArticles(domainName, query, maxResults = 3) {
  if (domainName === 'General') return [];

  const scholarName = domainToScholarName(domainName);
  const articleLinks = await fetchScholarArticleLinks(scholarName, 15);
  if (articleLinks.length === 0) return [];

  const articles = [];
  for (const url of articleLinks) {
    await sleep(300);
    const article = await scrapeArticle(url);
    if (article) articles.push(article);
    if (articles.length >= 10) break;
  }

  return articles
    .map(a => ({ ...a, score: scoreRelevance(a, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

module.exports = { fetchRelevantArticles };