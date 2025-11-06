import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = '@bookmarks';
const COLLECTIONS_KEY = '@collections';
const READING_MODE_KEY = '@reading_mode';

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
      const mediaType = isManga ? 'manga' : (item.media_type || (item.title && typeof item.title === 'string' ? 'movie' : item.name ? 'tv' : 'manga'));
      
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
      const mediaType = item.media_type || (item.title ? 'movie' : item.name ? 'tv' : 'manga');
      
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
}

