import AsyncStorage from '@react-native-async-storage/async-storage';

const READ_PROGRESS_KEY = '@read_progress';

export class ReadProgressService {
  /**
   * Get a unique key for a manga chapter
   */
  static getMangaKey(mangaId, chapterNumber) {
    return `manga_${mangaId}_ch${chapterNumber}`;
  }

  /**
   * Save reading progress for a manga chapter
   */
  static async saveProgress(mangaId, chapterNumber, currentPage, totalPages, chapterUrl = null, chapterTitle = null) {
    try {
      const allProgress = await this.getAllProgress();
      const mangaKey = this.getMangaKey(mangaId, chapterNumber);
      
      // Calculate progress percentage
      const progress = totalPages > 0 ? currentPage / totalPages : 0;
      
      // Don't save if read more than 90% (considered completed)
      if (progress >= 0.9) {
        await this.removeProgress(mangaId, chapterNumber);
        return;
      }

      const progressData = {
        mangaId,
        chapterNumber,
        currentPage, // current page index (0-based)
        totalPages, // total number of pages
        progress, // 0-1
        chapterUrl,
        chapterTitle,
        lastRead: new Date().toISOString(),
      };

      allProgress[mangaKey] = progressData;
      await AsyncStorage.setItem(READ_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error saving read progress:', error);
    }
  }

  /**
   * Get reading progress for a manga chapter
   */
  static async getProgress(mangaId, chapterNumber) {
    try {
      const allProgress = await this.getAllProgress();
      const mangaKey = this.getMangaKey(mangaId, chapterNumber);
      return allProgress[mangaKey] || null;
    } catch (error) {
      console.error('Error getting read progress:', error);
      return null;
    }
  }

  /**
   * Get all reading progress
   */
  static async getAllProgress() {
    try {
      const data = await AsyncStorage.getItem(READ_PROGRESS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting all read progress:', error);
      return {};
    }
  }

  /**
   * Remove reading progress for a manga chapter
   */
  static async removeProgress(mangaId, chapterNumber) {
    try {
      const allProgress = await this.getAllProgress();
      const mangaKey = this.getMangaKey(mangaId, chapterNumber);
      delete allProgress[mangaKey];
      await AsyncStorage.setItem(READ_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('Error removing read progress:', error);
    }
  }

  /**
   * Update progress position (called periodically while reading)
   */
  static async updatePosition(mangaId, chapterNumber, currentPage, totalPages) {
    try {
      const allProgress = await this.getAllProgress();
      const mangaKey = this.getMangaKey(mangaId, chapterNumber);
      
      if (allProgress[mangaKey]) {
        allProgress[mangaKey].currentPage = currentPage;
        allProgress[mangaKey].totalPages = totalPages;
        allProgress[mangaKey].progress = totalPages > 0 ? currentPage / totalPages : 0;
        allProgress[mangaKey].lastRead = new Date().toISOString();
        
        // Remove if read more than 90%
        if (allProgress[mangaKey].progress >= 0.9) {
          delete allProgress[mangaKey];
        }
        
        await AsyncStorage.setItem(READ_PROGRESS_KEY, JSON.stringify(allProgress));
      }
    } catch (error) {
      console.error('Error updating read progress position:', error);
    }
  }

  /**
   * Get all continue reading items (sorted by last read)
   */
  static async getContinueReadingItems() {
    try {
      const allProgress = await this.getAllProgress();
      const items = Object.values(allProgress);
      
      // Sort by last read (most recent first)
      items.sort((a, b) => {
        const dateA = new Date(a.lastRead);
        const dateB = new Date(b.lastRead);
        return dateB - dateA;
      });
      
      return items;
    } catch (error) {
      console.error('Error getting continue reading items:', error);
      return [];
    }
  }

  /**
   * Get latest chapter progress for a manga
   */
  static async getLatestChapterProgress(mangaId) {
    try {
      const allProgress = await this.getAllProgress();
      const mangaProgresses = Object.values(allProgress).filter(
        progress => progress.mangaId === mangaId
      );
      
      if (mangaProgresses.length === 0) {
        return null;
      }
      
      // Sort by last read (most recent first), then by chapter number
      mangaProgresses.sort((a, b) => {
        const dateA = new Date(a.lastRead);
        const dateB = new Date(b.lastRead);
        if (dateB - dateA !== 0) {
          return dateB - dateA;
        }
        return b.chapterNumber - a.chapterNumber;
      });
      
      return mangaProgresses[0];
    } catch (error) {
      console.error('Error getting latest chapter progress:', error);
      return null;
    }
  }
}

