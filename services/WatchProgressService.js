import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCH_PROGRESS_KEY = '@watch_progress';

export class WatchProgressService {
  /**
   * Get a unique key for a media item
   */
  static getMediaKey(itemId, mediaType, season = null, episodeNumber = null) {
    if (season !== null && episodeNumber !== null) {
      return `${mediaType}_${itemId}_s${season}_e${episodeNumber}`;
    }
    return `${mediaType}_${itemId}`;
  }

  /**
   * Save watch progress for a media item
   */
  static async saveProgress(itemId, mediaType, position, duration, season = null, episodeNumber = null) {
    try {
      const allProgress = await this.getAllProgress();
      const mediaKey = this.getMediaKey(itemId, mediaType, season, episodeNumber);
      
      // Calculate progress percentage
      const progress = duration > 0 ? position / duration : 0;
      
      // Don't save if watched more than 90% (considered completed)
      if (progress >= 0.9) {
        await this.removeProgress(itemId, mediaType, season, episodeNumber);
        return;
      }

      const progressData = {
        itemId,
        mediaType,
        position, // in milliseconds
        duration, // in milliseconds
        progress, // 0-1
        season,
        episodeNumber,
        lastWatched: new Date().toISOString(),
      };

      allProgress[mediaKey] = progressData;
      await AsyncStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error saving watch progress:', error);
    }
  }

  /**
   * Get watch progress for a media item
   */
  static async getProgress(itemId, mediaType, season = null, episodeNumber = null) {
    try {
      const allProgress = await this.getAllProgress();
      const mediaKey = this.getMediaKey(itemId, mediaType, season, episodeNumber);
      return allProgress[mediaKey] || null;
    } catch (error) {
      console.error('Error getting watch progress:', error);
      return null;
    }
  }

  /**
   * Get all watch progress
   */
  static async getAllProgress() {
    try {
      const data = await AsyncStorage.getItem(WATCH_PROGRESS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting all watch progress:', error);
      return {};
    }
  }

  /**
   * Remove watch progress for a media item
   */
  static async removeProgress(itemId, mediaType, season = null, episodeNumber = null) {
    try {
      const allProgress = await this.getAllProgress();
      const mediaKey = this.getMediaKey(itemId, mediaType, season, episodeNumber);
      delete allProgress[mediaKey];
      await AsyncStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error removing watch progress:', error);
    }
  }

  /**
   * Update progress position (called periodically while watching)
   */
  static async updatePosition(itemId, mediaType, position, duration, season = null, episodeNumber = null) {
    try {
      const allProgress = await this.getAllProgress();
      const mediaKey = this.getMediaKey(itemId, mediaType, season, episodeNumber);
      
      if (allProgress[mediaKey]) {
        allProgress[mediaKey].position = position;
        allProgress[mediaKey].duration = duration;
        allProgress[mediaKey].progress = duration > 0 ? position / duration : 0;
        allProgress[mediaKey].lastWatched = new Date().toISOString();
        
        // Remove if watched more than 90%
        if (allProgress[mediaKey].progress >= 0.9) {
          delete allProgress[mediaKey];
        }
        
        await AsyncStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(allProgress));
      }
    } catch (error) {
      console.error('Error updating watch progress position:', error);
    }
  }

  /**
   * Get all continue watching items (sorted by last watched)
   */
  static async getContinueWatchingItems() {
    try {
      const allProgress = await this.getAllProgress();
      const items = Object.values(allProgress);
      
      // Sort by last watched (most recent first)
      items.sort((a, b) => {
        const dateA = new Date(a.lastWatched);
        const dateB = new Date(b.lastWatched);
        return dateB - dateA;
      });
      
      return items;
    } catch (error) {
      console.error('Error getting continue watching items:', error);
      return [];
    }
  }
}

