import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@cache_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export class CacheService {
  // Cache movie/TV details
  static async cacheMediaDetails(mediaId, mediaType, data) {
    try {
      const key = `${CACHE_PREFIX}media_${mediaType}_${mediaId}`;
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching media details:', error);
    }
  }

  static async getCachedMediaDetails(mediaId, mediaType) {
    try {
      const key = `${CACHE_PREFIX}media_${mediaType}_${mediaId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - cacheData.timestamp > CACHE_EXPIRY) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Error getting cached media details:', error);
      return null;
    }
  }

  // Cache logo/title images
  static async cacheLogoUrl(mediaId, mediaType, logoUrl) {
    try {
      const key = `${CACHE_PREFIX}logo_${mediaType}_${mediaId}`;
      const cacheData = {
        url: logoUrl,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching logo URL:', error);
    }
  }

  static async getCachedLogoUrl(mediaId, mediaType) {
    try {
      const key = `${CACHE_PREFIX}logo_${mediaType}_${mediaId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - cacheData.timestamp > CACHE_EXPIRY) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return cacheData.url;
    } catch (error) {
      console.error('Error getting cached logo URL:', error);
      return null;
    }
  }

  // Cache manga details
  static async cacheMangaDetails(mangaId, data) {
    try {
      const key = `${CACHE_PREFIX}manga_${mangaId}`;
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching manga details:', error);
    }
  }

  static async getCachedMangaDetails(mangaId) {
    try {
      const key = `${CACHE_PREFIX}manga_${mangaId}`;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - cacheData.timestamp > CACHE_EXPIRY) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Error getting cached manga details:', error);
      return null;
    }
  }

  // Clear all cache
  static async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

