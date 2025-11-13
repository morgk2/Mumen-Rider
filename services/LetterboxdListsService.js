/**
 * Letterboxd Lists Service
 * Handles fetching and parsing Letterboxd popular lists
 */

const LETTERBOXD_BASE_URL = 'https://letterboxd.com';

/**
 * Fetch popular lists from Letterboxd
 * @returns {Promise<Array>} Array of list objects
 */
const fetchPopularLists = async () => {
  try {
    const url = `${LETTERBOXD_BASE_URL}/lists/popular/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const lists = parsePopularLists(html);
    return lists;
  } catch (error) {
    console.error('Error fetching popular lists:', error);
    throw error;
  }
};

/**
 * Parse Letterboxd popular lists HTML
 * @param {string} html - HTML content
 * @returns {Array} Array of list objects
 */
const parsePopularLists = (html) => {
  const lists = [];
  
  try {
    // Letterboxd uses <li class="list-item"> for list items
    // Use a safer approach - split by list-item class and process each
    const listItemMatches = html.split(/<li[^>]*class="[^"]*list-item[^"]*"/);
    console.log('Found', listItemMatches.length - 1, 'potential list items');
    
    for (let i = 1; i < listItemMatches.length && lists.length < 20; i++) {
      const listHtml = listItemMatches[i];
      
      // Extract list URL - look for href="/list/..."
      const urlMatch = listHtml.match(/href="(\/list\/[^"]+)"/);
      if (!urlMatch) continue;
      
      const listPath = urlMatch[1];
      const listUrl = `${LETTERBOXD_BASE_URL}${listPath}`;
      
      // Extract list title - find h2 with link inside
      let title = null;
      const h2Match = listHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (h2Match) {
        const h2Content = h2Match[1];
        const linkMatch = h2Content.match(/<a[^>]*>([\s\S]*?)<\/a>/);
        if (linkMatch) {
          title = linkMatch[1].replace(/<[^>]*>/g, '').trim();
        }
      }
      
      // Extract description
      let description = null;
      const descMatch = listHtml.match(/<p[^>]*class="[^"]*micro[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      if (descMatch) {
        description = descMatch[1].replace(/<[^>]*>/g, '').trim();
      }
      
      // Extract poster images - find all img tags with poster in src
      const posters = [];
      const imgRegex = /<img[^>]*src="([^"]*\/poster-[^"]*)"[^>]*>/g;
      let imgMatch;
      let matchCount = 0;
      
      while ((imgMatch = imgRegex.exec(listHtml)) !== null && matchCount < 6) {
        let posterUrl = imgMatch[1];
        if (posterUrl.startsWith('//')) {
          posterUrl = 'https:' + posterUrl;
        } else if (posterUrl.startsWith('/')) {
          posterUrl = LETTERBOXD_BASE_URL + posterUrl;
        }
        posters.push(posterUrl);
        matchCount++;
      }
      
      // Extract backdrop/collage image
      let backdropUrl = null;
      if (posters.length > 0) {
        backdropUrl = posters[0];
      }
      
      // Extract film count if available
      let filmCount = null;
      const countMatch = listHtml.match(/(\d+)\s+films?/i);
      if (countMatch) {
        filmCount = parseInt(countMatch[1], 10);
      }
      
      if (title && listUrl) {
        lists.push({
          id: listPath.replace('/list/', '').replace(/\//g, '-'),
          title,
          description,
          url: listUrl,
          path: listPath,
          posters,
          backdropUrl,
          filmCount,
        });
      } else {
        console.log('Skipping list item - missing title or URL. Title:', title, 'URL:', listUrl);
      }
    }
    console.log('Parsed', lists.length, 'lists successfully');
  } catch (error) {
    console.error('Error parsing popular lists:', error);
  }
  
  return lists;
};

/**
 * Fetch a specific list's details and films
 * @param {string} listUrl - Full URL to the list page
 * @returns {Promise<Object>} List details with films
 */
const fetchListDetails = async (listUrl) => {
  try {
    const response = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const listDetails = parseListDetails(html, listUrl);
    return listDetails;
  } catch (error) {
    console.error('Error fetching list details:', error);
    throw error;
  }
};

/**
 * Parse list details page HTML
 * @param {string} html - HTML content
 * @param {string} listUrl - Original list URL
 * @returns {Object} List details with films
 */
const parseListDetails = (html, listUrl) => {
  try {
    // Extract title
    const titleMatch = html.match(/<h1[^>]*class="[^"]*headline-1[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : null;
    
    // Extract description
    const descMatch = html.match(/<div[^>]*class="[^"]*body-text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let description = null;
    if (descMatch) {
      description = descMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    
    // Extract backdrop/collage image
    const backdropMatch = html.match(/<img[^>]*src="([^"]*\/poster-[^"]*)"[^>]*class="[^"]*image[^"]*"/);
    let backdropUrl = null;
    if (backdropMatch) {
      backdropUrl = backdropMatch[1];
      if (backdropUrl.startsWith('//')) {
        backdropUrl = 'https:' + backdropUrl;
      } else if (backdropUrl.startsWith('/')) {
        backdropUrl = LETTERBOXD_BASE_URL + backdropUrl;
      }
    }
    
    // Extract films from the list - use safer splitting approach
    const films = [];
    const filmItemSplits = html.split(/<li[^>]*class="[^"]*listitem[^"]*"/);
    
    for (let i = 1; i < filmItemSplits.length && films.length < 100; i++) {
      const filmHtml = filmItemSplits[i];
      
      // Extract film URL
      const filmUrlMatch = filmHtml.match(/href="(\/film\/[^"]+)"/);
      if (!filmUrlMatch) continue;
      
      const filmPath = filmUrlMatch[1];
      
      // Extract film title - find h2 with link
      let filmTitle = null;
      const h2Match = filmHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (h2Match) {
        const h2Content = h2Match[1];
        const linkMatch = h2Content.match(/<a[^>]*>([\s\S]*?)<\/a>/);
        if (linkMatch) {
          filmTitle = linkMatch[1].replace(/<[^>]*>/g, '').trim();
        }
      }
      
      // Extract year
      let year = null;
      const yearMatch = filmHtml.match(/(\d{4})/);
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
      }
      
      // Extract poster
      let posterUrl = null;
      const posterMatch = filmHtml.match(/<img[^>]*src="([^"]*\/poster-[^"]*)"[^>]*>/);
      if (posterMatch) {
        posterUrl = posterMatch[1];
        if (posterUrl.startsWith('//')) {
          posterUrl = 'https:' + posterUrl;
        } else if (posterUrl.startsWith('/')) {
          posterUrl = LETTERBOXD_BASE_URL + posterUrl;
        }
      }
      
      if (filmTitle) {
        films.push({
          title: filmTitle,
          year,
          posterUrl,
          letterboxdPath: filmPath,
        });
      }
    }
    
    return {
      title,
      description,
      backdropUrl,
      films,
      url: listUrl,
    };
  } catch (error) {
    console.error('Error parsing list details:', error);
    return {
      title: null,
      description: null,
      backdropUrl: null,
      films: [],
      url: listUrl,
    };
  }
};

export { fetchPopularLists, fetchListDetails };

