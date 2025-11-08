/**
 * Letterboxd Service
 * Handles scraping Letterboxd profile data
 */

const LETTERBOXD_BASE_URL = 'https://letterboxd.com';

/**
 * Fetch and parse Letterboxd profile page
 * @param {string} username - Letterboxd username
 * @returns {Promise<Object>} - Profile data
 */
export const fetchLetterboxdProfile = async (username) => {
  try {
    const profileUrl = `${LETTERBOXD_BASE_URL}/${username}/`;
    
    // Fetch the profile page
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse the HTML to extract profile data
    const profileData = parseLetterboxdProfile(html, username);
    
    return profileData;
  } catch (error) {
    console.error('Error fetching Letterboxd profile:', error);
    throw error;
  }
};

/**
 * Parse Letterboxd profile HTML to extract data
 * @param {string} html - HTML content
 * @param {string} username - Username
 * @returns {Object} - Parsed profile data
 */
const parseLetterboxdProfile = (html, username) => {
  const data = {
    username,
    displayName: null,
    profilePicture: null,
    filmsWatched: null,
    filmsWatchedThisYear: null,
    following: null,
    followers: null,
  };

  try {
    // Extract display name - Letterboxd uses <h1 class="title-1"> or similar
    // Also check for meta tags
    const displayNameMatch = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                                html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                                html.match(/<title>([^<]+)<\/title>/i);
    if (displayNameMatch) {
      let name = displayNameMatch[1].trim();
      // Remove " on Letterboxd" suffix if present
      name = name.replace(/\s+on\s+Letterboxd.*$/i, '');
      data.displayName = name;
    } else {
      data.displayName = username;
    }

    // Extract profile picture - check multiple sources
    // 1. Meta og:image tag
    let imageUrl = null;
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch) {
      imageUrl = ogImageMatch[1];
    } else {
      // 2. Look for avatar class in img tag
      const avatarMatch = html.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/i) ||
                           html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*avatar[^"]*"/i);
      if (avatarMatch) {
        imageUrl = avatarMatch[1];
      }
    }
    
    if (imageUrl) {
      // Handle relative URLs and protocol-relative URLs
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = LETTERBOXD_BASE_URL + imageUrl;
      }
      data.profilePicture = imageUrl;
    }

    // Extract stats - Letterboxd uses specific patterns
    // Look for stats in profile stats section or nav stats
    // Pattern: numbers in stat blocks, often with commas
    
    // Films watched - look for "Films" text followed by number
    // Try multiple patterns
    const filmsPatterns = [
      /<a[^>]*href="\/[^"]*\/films\/"[^>]*>[\s\S]{0,300}?(\d+(?:,\d+)*)/i,
      /films[^>]*>[\s\S]{0,200}?<span[^>]*>(\d+(?:,\d+)*)<\/span>/i,
      /(\d+(?:,\d+)*)[\s\S]{0,100}?films/i,
      /films:\s*(\d+(?:,\d+)*)/i,
    ];
    
    for (const pattern of filmsPatterns) {
      const match = html.match(pattern);
      if (match) {
        data.filmsWatched = parseInt(match[1].replace(/,/g, ''), 10);
        break;
      }
    }

    // Films watched this year
    // Letterboxd shows "This year" stats - we need to find the actual film count
    // NOT the year number itself (e.g., 2025)
    const currentYear = new Date().getFullYear();
    
    // First, try to find "This year" section and extract the number after it
    // Look for patterns like "This year" followed by a number that's NOT the year
    const thisYearPatterns = [
      // Pattern: "This year" text, then look for number that's not the current year
      // Match "this year" then skip the year number and find the film count
      new RegExp(`this\\s+year[^>]*>([\\s\\S]{0,1000}?)(?:${currentYear})?[^>]*>([\\s\\S]{0,500}?)(\\d+(?:,\\d+)*)`, 'i'),
      // Pattern: Look for stat items or list items with "this year"
      /<li[^>]*>[\s\S]{0,500}?this\s+year[\s\S]{0,500}?(\d+(?:,\d+)*)/i,
      // Pattern: Look for div or span with "this year" class or text
      /<[^>]*class="[^"]*this[^"]*year[^"]*"[^>]*>[\s\S]{0,500}?(\d+(?:,\d+)*)/i,
    ];
    
    let foundThisYear = false;
    for (const pattern of thisYearPatterns) {
      const match = html.match(pattern);
      if (match) {
        // Get the last captured group (should be the film count)
        const countStr = match[match.length - 1];
        if (countStr) {
          const count = parseInt(countStr.replace(/,/g, ''), 10);
          // Verify it's not the year and is a reasonable film count
          if (count !== currentYear && count > 0 && count < 100000) {
            data.filmsWatchedThisYear = count;
            foundThisYear = true;
            break;
          }
        }
      }
    }
    
    // If not found, try looking for year links that contain film counts
    // But exclude the year number itself
    if (!foundThisYear) {
      // Look for links to the current year's films page
      const yearLinkPattern = new RegExp(`<a[^>]*href="[^"]*\\/${currentYear}[^"]*"[^>]*>([\\s\\S]{0,300}?)<\\/a>`, 'i');
      const yearLinkMatch = html.match(yearLinkPattern);
      if (yearLinkMatch) {
        // Extract number from the link content, but make sure it's not just the year
        const linkContent = yearLinkMatch[1];
        const numbers = linkContent.match(/(\d+(?:,\d+)*)/g);
        if (numbers) {
          for (const numStr of numbers) {
            const num = parseInt(numStr.replace(/,/g, ''), 10);
            // Use the number if it's not the year and is reasonable
            if (num !== currentYear && num > 0 && num < 100000) {
              data.filmsWatchedThisYear = num;
              foundThisYear = true;
              break;
            }
          }
        }
      }
    }
    
    // Last resort: Look for any mention of "this year" and find nearby numbers
    // but exclude the year number
    if (!foundThisYear) {
      const thisYearIndex = html.toLowerCase().indexOf('this year');
      if (thisYearIndex !== -1) {
        // Extract a section around "this year"
        const section = html.substring(
          Math.max(0, thisYearIndex - 100),
          Math.min(html.length, thisYearIndex + 1000)
        );
        // Find all numbers in this section
        const numbers = section.match(/(\d+(?:,\d+)*)/g);
        if (numbers) {
          for (const numStr of numbers) {
            const num = parseInt(numStr.replace(/,/g, ''), 10);
            // Skip the year and any unreasonably large numbers
            if (num !== currentYear && num > 0 && num < 10000) {
              data.filmsWatchedThisYear = num;
              break;
            }
          }
        }
      }
    }

    // Following count
    const followingPatterns = [
      /<a[^>]*href="\/[^"]*\/following\/"[^>]*>[\s\S]{0,300}?(\d+(?:,\d+)*)/i,
      /following[^>]*>[\s\S]{0,200}?<span[^>]*>(\d+(?:,\d+)*)<\/span>/i,
      /(\d+(?:,\d+)*)[\s\S]{0,100}?following/i,
      /following:\s*(\d+(?:,\d+)*)/i,
    ];
    
    for (const pattern of followingPatterns) {
      const match = html.match(pattern);
      if (match) {
        data.following = parseInt(match[1].replace(/,/g, ''), 10);
        break;
      }
    }

    // Followers count
    const followersPatterns = [
      /<a[^>]*href="\/[^"]*\/followers\/"[^>]*>[\s\S]{0,300}?(\d+(?:,\d+)*)/i,
      /followers?[^>]*>[\s\S]{0,200}?<span[^>]*>(\d+(?:,\d+)*)<\/span>/i,
      /(\d+(?:,\d+)*)[\s\S]{0,100}?followers?/i,
      /followers?:\s*(\d+(?:,\d+)*)/i,
    ];
    
    for (const pattern of followersPatterns) {
      const match = html.match(pattern);
      if (match) {
        data.followers = parseInt(match[1].replace(/,/g, ''), 10);
        break;
      }
    }

    // Try to extract from JSON-LD structured data
    const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const jsonLd = JSON.parse(match[1]);
        if (jsonLd.name && !data.displayName) {
          data.displayName = jsonLd.name;
        }
        if (jsonLd.image && !data.profilePicture) {
          data.profilePicture = jsonLd.image;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    return data;
  } catch (error) {
    console.error('Error parsing Letterboxd profile:', error);
    return data;
  }
};

/**
 * Get Letterboxd profile URL
 * @param {string} username - Username
 * @returns {string} - Profile URL
 */
export const getLetterboxdProfileUrl = (username) => {
  return `${LETTERBOXD_BASE_URL}/${username}/`;
};

/**
 * Fetch and parse Letterboxd watchlist
 * @param {string} username - Letterboxd username
 * @returns {Promise<Array>} - Array of watchlist items with titles and years
 */
export const fetchLetterboxdWatchlist = async (username) => {
  try {
    const watchlistUrl = `${LETTERBOXD_BASE_URL}/${username}/watchlist/`;
    
    // Fetch the watchlist page
    const response = await fetch(watchlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch watchlist: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse the HTML to extract watchlist items
    const watchlistItems = parseLetterboxdWatchlist(html);
    
    return watchlistItems;
  } catch (error) {
    console.error('Error fetching Letterboxd watchlist:', error);
    throw error;
  }
};

/**
 * Parse Letterboxd watchlist HTML to extract movie titles
 * @param {string} html - HTML content
 * @returns {Array} - Array of watchlist items with title and year
 */
const parseLetterboxdWatchlist = (html) => {
  const items = [];
  const seenTitles = new Set();
  
  try {
    // Helper function to add item if not duplicate
    const addItem = (title, year) => {
      if (!title || title.length < 2) return;
      const key = title.toLowerCase().trim() + (year ? `-${year}` : '');
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        items.push({ title: title.trim(), year });
      }
    };
    
    // Pattern 1: Look for data-film-name attribute (most reliable)
    const filmNamePattern = /data-film-name="([^"]+)"/gi;
    const filmNameMatches = Array.from(html.matchAll(filmNamePattern));
    
    for (const match of filmNameMatches) {
      const title = match[1].trim();
      addItem(title, null);
    }
    
    // Pattern 2: Look for poster links with film slugs
    // Format: /film/movie-title-2024/ or href="/film/slug/"
    const filmSlugPattern = /\/film\/([^\/"']+)\//gi;
    const filmSlugMatches = Array.from(html.matchAll(filmSlugPattern));
    
    for (const match of filmSlugMatches) {
      const slug = match[1];
      // Extract title and year from slug (format: movie-title-2024)
      const titleYearMatch = slug.match(/^(.+)-(\d{4})$/);
      if (titleYearMatch) {
        const title = titleYearMatch[1].replace(/-/g, ' ');
        const year = parseInt(titleYearMatch[2], 10);
        addItem(title, year);
      } else {
        // Just title, no year
        const title = slug.replace(/-/g, ' ');
        addItem(title, null);
      }
    }
    
    // Pattern 3: Look for h2 or span with film title (common in list views)
    const titlePatterns = [
      /<h2[^>]*>([^<]+)<\/h2>/gi,
      /<span[^>]*class="[^"]*film[^"]*title[^"]*"[^>]*>([^<]+)<\/span>/gi,
      /<a[^>]*class="[^"]*film[^"]*"[^>]*>[\s\S]{0,200}?<span[^>]*>([^<]+)<\/span>/gi,
    ];
    
    for (const pattern of titlePatterns) {
      const matches = Array.from(html.matchAll(pattern));
      for (const match of matches) {
        const text = match[1].trim();
        // Check if it looks like a movie title
        if (text && text.length > 2 && !text.match(/^(icon|button|arrow|close|menu|loading|error)/i)) {
          // Check if it contains a year in parentheses
          const yearMatch = text.match(/(.+)\s+\((\d{4})\)/);
          if (yearMatch) {
            addItem(yearMatch[1].trim(), parseInt(yearMatch[2], 10));
          } else {
            addItem(text, null);
          }
        }
      }
    }
    
    // Pattern 4: Look for img alt attributes (poster images) - more selective
    const imgAltPattern = /<img[^>]*alt="([^"]+)"[^>]*class="[^"]*poster[^"]*"/gi;
    const imgAltMatches = Array.from(html.matchAll(imgAltPattern));
    
    for (const match of imgAltMatches) {
      const altText = match[1].trim();
      // Check if it looks like a movie title
      if (altText && altText.length > 2) {
        // Check if it contains a year
        const yearMatch = altText.match(/(.+)\s+\((\d{4})\)/);
        if (yearMatch) {
          addItem(yearMatch[1].trim(), parseInt(yearMatch[2], 10));
        } else {
          addItem(altText, null);
        }
      }
    }
    
    return items;
  } catch (error) {
    console.error('Error parsing Letterboxd watchlist:', error);
    return [];
  }
};

export default {
  fetchLetterboxdProfile,
  fetchLetterboxdWatchlist,
  getLetterboxdProfileUrl,
};

