/**
 * Letterboxd Watchlist Service
 * Matches Letterboxd watchlist items with TMDB data
 */

import { TMDBService } from './TMDBService';

/**
 * Match a single watchlist item with TMDB
 * @param {Object} item - Watchlist item with title and optional year
 * @returns {Promise<Object|null>} - TMDB movie data or null if not found
 */
const matchItemWithTMDB = async (item) => {
  try {
    // Search TMDB with the title
    const searchResult = await TMDBService.searchMulti(item.title, 1);
    
    if (!searchResult.results || searchResult.results.length === 0) {
      return null;
    }
    
    // If we have a year, try to find an exact match first
    if (item.year) {
      const exactMatch = searchResult.results.find(
        (result) => 
          result.media_type === 'movie' && 
          result.release_date && 
          new Date(result.release_date).getFullYear() === item.year
      );
      
      if (exactMatch) {
        return {
          ...exactMatch,
          media_type: 'movie',
        };
      }
    }
    
    // Find the best match (prefer movies, then TV shows)
    // Look for items with matching title (fuzzy match)
    const titleLower = item.title.toLowerCase();
    const bestMatch = searchResult.results.find((result) => {
      const resultTitle = (result.title || result.name || '').toLowerCase();
      return resultTitle.includes(titleLower) || titleLower.includes(resultTitle);
    });
    
    if (bestMatch) {
      return {
        ...bestMatch,
        media_type: bestMatch.media_type || (bestMatch.title ? 'movie' : 'tv'),
      };
    }
    
    // Fallback to first movie result
    const firstMovie = searchResult.results.find((result) => result.media_type === 'movie');
    if (firstMovie) {
      return {
        ...firstMovie,
        media_type: 'movie',
      };
    }
    
    // Fallback to first result
    const firstResult = searchResult.results[0];
    if (firstResult) {
      return {
        ...firstResult,
        media_type: firstResult.media_type || (firstResult.title ? 'movie' : 'tv'),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error matching "${item.title}" with TMDB:`, error);
    return null;
  }
};

/**
 * Match watchlist items with TMDB data
 * @param {Array} watchlistItems - Array of watchlist items
 * @param {Function} onProgress - Optional progress callback (current, total)
 * @returns {Promise<Array>} - Array of matched items with TMDB data
 */
export const matchWatchlistWithTMDB = async (watchlistItems, onProgress) => {
  const matchedItems = [];
  const total = watchlistItems.length;
  
  for (let i = 0; i < watchlistItems.length; i++) {
    const item = watchlistItems[i];
    
    // Call progress callback if provided
    if (onProgress) {
      onProgress(i + 1, total);
    }
    
    // Match with TMDB
    const tmdbData = await matchItemWithTMDB(item);
    
    if (tmdbData) {
      matchedItems.push({
        ...tmdbData,
        letterboxdTitle: item.title,
        letterboxdYear: item.year,
      });
    }
    
    // Add a small delay to avoid rate limiting
    if (i < watchlistItems.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return matchedItems;
};

export default {
  matchWatchlistWithTMDB,
};




