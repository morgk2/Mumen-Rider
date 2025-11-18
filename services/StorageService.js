import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = '@bookmarks';
const COLLECTIONS_KEY = '@collections';
const READING_MODE_KEY = '@reading_mode';
const VIDEO_SOURCE_KEY = '@video_source';
const EXTERNAL_PLAYER_KEY = '@externalPlayer';
const LETTERBOXD_USERNAME_KEY = '@letterboxd_username';
const LETTERBOXD_PROFILE_KEY = '@letterboxd_profile';
const LETTERBOXD_WATCHLIST_KEY = '@letterboxd_watchlist';
const DOWNLOAD_QUALITY_KEY = '@download_quality';

export class StorageService {
  // Bookmarks/Saves
  static async getBookmarks() {
    try {
      const data = await AsyncStorage.getItem(BOOKMARKS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting bookmarks:', error);
      return [];
    }
  }

  static async saveBookmark(item) {
    try {
      const bookmarks = await this.getBookmarks();
      
      // Detect manga items - AniList manga items have coverImage/bannerImage and title as object
      const isManga = (item.coverImage || item.bannerImage) && 
                      (typeof item.title === 'object' || (!item.poster_path && !item.backdrop_path));
      
      // Determine media type - explicitly set to 'manga' if detected
      // Logic matches the pattern used throughout the app:
      // 1. Trust media_type if present
      // 2. If title exists -> movie
      // 3. If name exists (without title) -> TV show
      let mediaType;
      if (isManga) {
        mediaType = 'manga';
      } else if (item.media_type) {
        mediaType = item.media_type;
      } else if (item.title && typeof item.title === 'string') {
        // Movie - has title property (string)
        mediaType = 'movie';
      } else if (item.name) {
        // TV show - has name but no title
        mediaType = 'tv';
      } else {
        // Final fallback
        mediaType = 'movie';
      }
      
      console.log('Saving bookmark - isManga:', isManga, 'mediaType:', mediaType, 'item.id:', item.id);
      
      // Check if already bookmarked
      const exists = bookmarks.find(
        (b) => b.id === item.id && b.media_type === mediaType
      );
      
      if (exists) {
        console.log('Bookmark already exists');
        return false;
      }
      
      const bookmark = isManga ? {
        id: item.id,
        title: item.title?.romaji || item.title?.english || (typeof item.title === 'string' ? item.title : item.name) || 'Unknown',
        poster_path: item.coverImage?.large || item.coverImage || item.bannerImage,
        backdrop_path: item.bannerImage || item.coverImage?.large || item.coverImage,
        media_type: 'manga',
        release_date: item.startDate ? `${item.startDate.year || ''}-${String(item.startDate.month || '').padStart(2, '0')}-${String(item.startDate.day || '').padStart(2, '0')}` : null,
        dateAdded: new Date().toISOString(),
      } : {
        id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        media_type: mediaType,
        release_date: item.release_date || item.first_air_date,
        dateAdded: new Date().toISOString(),
      };
      
      console.log('Created bookmark:', bookmark);
      bookmarks.unshift(bookmark);
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
      return true;
    } catch (error) {
      console.error('Error saving bookmark:', error);
      return false;
    }
  }

  static async removeBookmark(itemId, mediaType) {
    try {
      const bookmarks = await this.getBookmarks();
      const filtered = bookmarks.filter(
        (b) => !(b.id === itemId && b.media_type === mediaType)
      );
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      return false;
    }
  }

  static async isBookmarked(itemId, mediaType) {
    try {
      const bookmarks = await this.getBookmarks();
      return bookmarks.some(
        (b) => b.id === itemId && b.media_type === mediaType
      );
    } catch (error) {
      console.error('Error checking bookmark:', error);
      return false;
    }
  }

  // Collections
  static async getCollections() {
    try {
      const data = await AsyncStorage.getItem(COLLECTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting collections:', error);
      return [];
    }
  }

  static async createCollection(name) {
    try {
      const collections = await this.getCollections();
      const newCollection = {
        id: Date.now().toString(),
        name: name,
        items: [],
        dateCreated: new Date().toISOString(),
      };
      collections.push(newCollection);
      await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
      return newCollection;
    } catch (error) {
      console.error('Error creating collection:', error);
      return null;
    }
  }

  static async deleteCollection(collectionId) {
    try {
      const collections = await this.getCollections();
      const filtered = collections.filter((c) => c.id !== collectionId);
      await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Error deleting collection:', error);
      return false;
    }
  }

  static async addItemToCollection(collectionId, item) {
    try {
      const collections = await this.getCollections();
      const collectionIndex = collections.findIndex((c) => c.id === collectionId);
      if (collectionIndex === -1) return false;

      const collection = collections[collectionIndex];
      // Determine media type - manga items don't have media_type, they have id from AniList
      // Logic matches the pattern used throughout the app:
      // 1. Trust media_type if present
      // 2. If title exists -> movie
      // 3. If name exists (without title) -> TV show
      let mediaType;
      if (item.media_type) {
        mediaType = item.media_type;
      } else if (item.title) {
        // Movie - has title property
        mediaType = 'movie';
      } else if (item.name) {
        // TV show - has name but no title
        mediaType = 'tv';
      } else {
        // Final fallback - likely manga
        mediaType = 'manga';
      }
      
      // Check if item already exists
      const exists = collection.items.find(
        (i) => i.id === item.id && i.media_type === mediaType
      );
      if (!exists) {
        // Handle manga items (from AniList) differently
        const isManga = !item.poster_path && !item.backdrop_path && (item.coverImage || item.bannerImage);
        
        const collectionItem = isManga ? {
          id: item.id,
          title: item.title?.romaji || item.title?.english || item.title || item.name,
          poster_path: item.coverImage?.large || item.coverImage || item.bannerImage,
          backdrop_path: item.bannerImage || item.coverImage?.large || item.coverImage,
          media_type: 'manga',
          release_date: item.startDate ? `${item.startDate.year || ''}-${String(item.startDate.month || '').padStart(2, '0')}-${String(item.startDate.day || '').padStart(2, '0')}` : null,
          dateAdded: new Date().toISOString(),
        } : {
          id: item.id,
          title: item.title || item.name,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          media_type: mediaType,
          release_date: item.release_date || item.first_air_date,
          dateAdded: new Date().toISOString(),
        };
        collection.items.unshift(collectionItem);
        collections[collectionIndex] = collection;
        await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding item to collection:', error);
      return false;
    }
  }

  static async removeItemFromCollection(collectionId, itemId, mediaType) {
    try {
      const collections = await this.getCollections();
      const collectionIndex = collections.findIndex((c) => c.id === collectionId);
      if (collectionIndex === -1) return false;

      const collection = collections[collectionIndex];
      collection.items = collection.items.filter(
        (i) => !(i.id === itemId && i.media_type === mediaType)
      );
      collections[collectionIndex] = collection;
      await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
      return true;
    } catch (error) {
      console.error('Error removing item from collection:', error);
      return false;
    }
  }

  static async renameCollection(collectionId, newName) {
    try {
      const collections = await this.getCollections();
      const collectionIndex = collections.findIndex((c) => c.id === collectionId);
      if (collectionIndex === -1) return false;

      collections[collectionIndex].name = newName;
      await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
      return true;
    } catch (error) {
      console.error('Error renaming collection:', error);
      return false;
    }
  }

  // Reading Mode Preferences
  static async getReadingMode() {
    try {
      const mode = await AsyncStorage.getItem(READING_MODE_KEY);
      return mode || 'LTR'; // Default to Left to Right
    } catch (error) {
      console.error('Error getting reading mode:', error);
      return 'LTR';
    }
  }

  static async setReadingMode(mode) {
    try {
      await AsyncStorage.setItem(READING_MODE_KEY, mode);
      return true;
    } catch (error) {
      console.error('Error setting reading mode:', error);
      return false;
    }
  }

  // Video Source Preferences
  static async getVideoSource() {
    try {
      const source = await AsyncStorage.getItem(VIDEO_SOURCE_KEY);
      return source || 'vixsrc'; // Default to vixsrc
    } catch (error) {
      console.error('Error getting video source:', error);
      return 'vixsrc';
    }
  }

  static async setVideoSource(source) {
    try {
      await AsyncStorage.setItem(VIDEO_SOURCE_KEY, source);
      return true;
    } catch (error) {
      console.error('Error setting video source:', error);
      return false;
    }
  }

  // External Player Preferences
  static async getExternalPlayer() {
    try {
      const player = await AsyncStorage.getItem(EXTERNAL_PLAYER_KEY);
      return player || 'Default'; // Default to in-app player
    } catch (error) {
      console.error('Error getting external player:', error);
      return 'Default';
    }
  }

  static async setExternalPlayer(player) {
    try {
      await AsyncStorage.setItem(EXTERNAL_PLAYER_KEY, player);
      return true;
    } catch (error) {
      console.error('Error setting external player:', error);
      return false;
    }
  }

  // Letterboxd Integration
  static async getLetterboxdUsername() {
    try {
      const username = await AsyncStorage.getItem(LETTERBOXD_USERNAME_KEY);
      return username;
    } catch (error) {
      console.error('Error getting Letterboxd username:', error);
      return null;
    }
  }

  static async setLetterboxdUsername(username) {
    try {
      await AsyncStorage.setItem(LETTERBOXD_USERNAME_KEY, username);
      return true;
    } catch (error) {
      console.error('Error setting Letterboxd username:', error);
      return false;
    }
  }

  static async getLetterboxdProfile() {
    try {
      const profileJson = await AsyncStorage.getItem(LETTERBOXD_PROFILE_KEY);
      if (!profileJson) return null;
      
      const data = JSON.parse(profileJson);
      return {
        profile: data.profile || data, // Support old format
        timestamp: data.timestamp || Date.now(),
      };
    } catch (error) {
      console.error('Error getting Letterboxd profile:', error);
      return null;
    }
  }

  static async setLetterboxdProfile(profile) {
    try {
      const data = {
        profile,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(LETTERBOXD_PROFILE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error setting Letterboxd profile:', error);
      return false;
    }
  }

  static async getLetterboxdProfileTimestamp() {
    try {
      const cached = await this.getLetterboxdProfile();
      return cached ? cached.timestamp : null;
    } catch (error) {
      return null;
    }
  }

  static async isLetterboxdProfileStale(maxAge = 24 * 60 * 60 * 1000) {
    // Default: 24 hours
    try {
      const timestamp = await this.getLetterboxdProfileTimestamp();
      if (!timestamp) return true;
      return Date.now() - timestamp > maxAge;
    } catch (error) {
      return true;
    }
  }

  static async removeLetterboxdAccount() {
    try {
      await AsyncStorage.removeItem(LETTERBOXD_USERNAME_KEY);
      await AsyncStorage.removeItem(LETTERBOXD_PROFILE_KEY);
      await AsyncStorage.removeItem(LETTERBOXD_WATCHLIST_KEY);
      return true;
    } catch (error) {
      console.error('Error removing Letterboxd account:', error);
      return false;
    }
  }

  static async getLetterboxdWatchlist() {
    try {
      const watchlistJson = await AsyncStorage.getItem(LETTERBOXD_WATCHLIST_KEY);
      if (!watchlistJson) return [];
      
      const data = JSON.parse(watchlistJson);
      // Support old format (array) and new format (object with timestamp)
      if (Array.isArray(data)) {
        return {
          watchlist: data,
          timestamp: Date.now(),
        };
      }
      return {
        watchlist: data.watchlist || [],
        timestamp: data.timestamp || Date.now(),
      };
    } catch (error) {
      console.error('Error getting Letterboxd watchlist:', error);
      return { watchlist: [], timestamp: null };
    }
  }

  static async setLetterboxdWatchlist(watchlist) {
    try {
      const data = {
        watchlist,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(LETTERBOXD_WATCHLIST_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error setting Letterboxd watchlist:', error);
      return false;
    }
  }

  static async getLetterboxdWatchlistTimestamp() {
    try {
      const cached = await this.getLetterboxdWatchlist();
      return cached ? cached.timestamp : null;
    } catch (error) {
      return null;
    }
  }

  static async isLetterboxdWatchlistStale(maxAge = 6 * 60 * 60 * 1000) {
    // Default: 6 hours (watchlist updates more frequently)
    try {
      const timestamp = await this.getLetterboxdWatchlistTimestamp();
      if (!timestamp) return true;
      return Date.now() - timestamp > maxAge;
    } catch (error) {
      return true;
    }
  }

  // Download Quality Preference
  static async getDownloadQuality() {
    try {
      const quality = await AsyncStorage.getItem(DOWNLOAD_QUALITY_KEY);
      return quality || 'Best'; // Default to Best quality
    } catch (error) {
      console.error('Error getting download quality:', error);
      return 'Best';
    }
  }

  static async setDownloadQuality(quality) {
    try {
      await AsyncStorage.setItem(DOWNLOAD_QUALITY_KEY, quality);
      return true;
    } catch (error) {
      console.error('Error setting download quality:', error);
      return false;
    }
  }
}

