import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AllMangaService } from './AllMangaService';
import { AniListService } from './AniListService';

const DOWNLOADS_KEY = '@downloads';
const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;

// Active downloads tracking
const activeDownloads = new Map(); // Map<downloadId, downloadInfo>

// Ensure downloads directory exists
const ensureDownloadsDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
};

// Get manga download directory
const getMangaDir = (mangaId) => {
  return `${DOWNLOADS_DIR}manga_${mangaId}/`;
};

// Get chapter download directory
const getChapterDir = (mangaId, chapterNumber) => {
  return `${getMangaDir(mangaId)}chapter_${chapterNumber}/`;
};

// Download a single image
const downloadImage = async (imageUrl, savePath) => {
  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      imageUrl,
      savePath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        return progress;
      }
    );
    
    const result = await downloadResumable.downloadAsync();
    return result?.uri || null;
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
};

// Download manga poster/backdrop
const downloadMangaImage = async (mangaId, imageUrl, type) => {
  try {
    await ensureDownloadsDir();
    const mangaDir = getMangaDir(mangaId);
    const dirInfo = await FileSystem.getInfoAsync(mangaDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(mangaDir, { intermediates: true });
    }
    
    const extension = imageUrl.split('.').pop().split('?')[0] || 'jpg';
    const filename = `${type}.${extension}`;
    const savePath = `${mangaDir}${filename}`;
    
    return await downloadImage(imageUrl, savePath);
  } catch (error) {
    console.error(`Error downloading manga ${type}:`, error);
    return null;
  }
};

// Generate download ID
const getDownloadId = (mangaId, chapterNumber) => {
  return `${mangaId}_${chapterNumber}`;
};

export const DownloadService = {
  // Download a chapter
  async downloadChapter(manga, chapter, onProgress) {
    const mangaId = manga.id;
    const chapterNumber = chapter.number;
    const downloadId = getDownloadId(mangaId, chapterNumber);
    
    // Check if already downloading
    if (activeDownloads.has(downloadId)) {
      return { success: false, alreadyDownloading: true };
    }
    
    // Initialize download tracking
    const downloadInfo = {
      mangaId,
      chapterNumber,
      mangaTitle: AniListService.getMangaTitle(manga) || 'Unknown',
      chapterTitle: chapter.title || `Chapter ${chapterNumber}`,
      progress: 0,
      status: 'downloading', // 'downloading', 'queued', 'error', 'completed'
      totalPages: 0,
      downloadedPages: 0,
      startedAt: new Date().toISOString(),
    };
    activeDownloads.set(downloadId, downloadInfo);
    
    try {
      await ensureDownloadsDir();
      const chapterDir = getChapterDir(mangaId, chapterNumber);
      
      // Check if already downloaded
      const existingDownload = await this.getChapterDownload(mangaId, chapterNumber);
      if (existingDownload && existingDownload.completed) {
        activeDownloads.delete(downloadId);
        return { success: true, alreadyDownloaded: true };
      }
      
      // Update status to downloading
      downloadInfo.status = 'downloading';
      
      // Create chapter directory
      const dirInfo = await FileSystem.getInfoAsync(chapterDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });
      }
      
      // Fetch chapter pages
      const pages = await AllMangaService.fetchChapterPages(chapter.url);
      if (pages.length === 0) {
        throw new Error('No pages found for this chapter');
      }
      
      downloadInfo.totalPages = pages.length;
      
      // Download all pages
      const downloadedPages = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const extension = page.url.split('.').pop().split('?')[0] || 'jpg';
        const filename = `page_${String(i + 1).padStart(3, '0')}.${extension}`;
        const savePath = `${chapterDir}${filename}`;
        
        try {
          const downloadedUri = await downloadImage(page.url, savePath);
          if (downloadedUri) {
            downloadedPages.push({
              index: i + 1,
              localUri: downloadedUri,
              originalUrl: page.url,
            });
            
            // Update progress
            downloadInfo.downloadedPages = i + 1;
            downloadInfo.progress = (i + 1) / pages.length;
            
            // Report progress
            if (onProgress) {
              onProgress(downloadInfo.progress);
            }
          }
        } catch (error) {
          console.error(`Error downloading page ${i + 1}:`, error);
        }
      }
      
      // Save chapter metadata
      const chapterData = {
        mangaId,
        chapterNumber,
        chapterTitle: chapter.title,
        chapterUrl: chapter.url,
        pages: downloadedPages,
        downloadedAt: new Date().toISOString(),
        completed: true,
      };
      
      await this.saveChapterDownload(chapterData);
      
      // Download manga info if not already downloaded
      await this.ensureMangaInfoDownloaded(manga);
      
      // Mark as completed and remove from active downloads
      downloadInfo.status = 'completed';
      downloadInfo.progress = 1;
      activeDownloads.delete(downloadId);
      
      return { success: true, pages: downloadedPages };
    } catch (error) {
      console.error('Error downloading chapter:', error);
      downloadInfo.status = 'error';
      downloadInfo.error = error.message;
      // Keep in active downloads for error display, remove after a delay
      setTimeout(() => {
        activeDownloads.delete(downloadId);
      }, 5000);
      throw error;
    }
  },
  
  // Get active downloads
  getActiveDownloads() {
    return Array.from(activeDownloads.values());
  },
  
  // Cancel a download
  cancelDownload(mangaId, chapterNumber) {
    const downloadId = getDownloadId(mangaId, chapterNumber);
    activeDownloads.delete(downloadId);
  },
  
  // Ensure manga info (poster, backdrop, details) is downloaded
  async ensureMangaInfoDownloaded(manga) {
    try {
      const mangaId = manga.id;
      const mangaDir = getMangaDir(mangaId);
      const dirInfo = await FileSystem.getInfoAsync(mangaDir);
      
      // Check if manga info already exists
      const mangaInfoPath = `${mangaDir}manga_info.json`;
      const mangaInfoExists = await FileSystem.getInfoAsync(mangaInfoPath);
      
      if (mangaInfoExists.exists) {
        return; // Already downloaded
      }
      
      // Create manga directory if needed
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mangaDir, { intermediates: true });
      }
      
      // Download poster
      const coverUrl = manga.coverImage?.large || manga.coverImage?.medium || manga.poster_path;
      if (coverUrl) {
        await downloadMangaImage(mangaId, coverUrl, 'poster');
      }
      
      // Download backdrop/banner
      const bannerUrl = manga.bannerImage || manga.backdrop_path;
      if (bannerUrl) {
        await downloadMangaImage(mangaId, bannerUrl, 'backdrop');
      }
      
      // Save manga info JSON
      const mangaInfo = {
        id: manga.id,
        title: manga.title,
        coverImage: manga.coverImage,
        bannerImage: manga.bannerImage,
        description: manga.description,
        genres: manga.genres,
        status: manga.status,
        format: manga.format,
        chapters: manga.chapters,
        volumes: manga.volumes,
        averageScore: manga.averageScore,
        startDate: manga.startDate,
        endDate: manga.endDate,
        downloadedAt: new Date().toISOString(),
      };
      
      await FileSystem.writeAsStringAsync(mangaInfoPath, JSON.stringify(mangaInfo, null, 2));
    } catch (error) {
      console.error('Error downloading manga info:', error);
    }
  },
  
  // Save chapter download metadata
  async saveChapterDownload(chapterData) {
    try {
      const downloads = await this.getAllDownloads();
      const mangaId = chapterData.mangaId;
      const chapterNumber = chapterData.chapterNumber;
      
      if (!downloads[mangaId]) {
        downloads[mangaId] = {
          manga: null, // Will be set when manga info is downloaded
          chapters: {},
        };
      }
      
      downloads[mangaId].chapters[chapterNumber] = chapterData;
      
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
    } catch (error) {
      console.error('Error saving chapter download:', error);
    }
  },
  
  // Get chapter download info
  async getChapterDownload(mangaId, chapterNumber) {
    try {
      const downloads = await this.getAllDownloads();
      return downloads[mangaId]?.chapters[chapterNumber] || null;
    } catch (error) {
      console.error('Error getting chapter download:', error);
      return null;
    }
  },
  
  // Get all downloads
  async getAllDownloads() {
    try {
      const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting all downloads:', error);
      return {};
    }
  },
  
  // Get downloaded chapters for a manga
  async getDownloadedChapters(mangaId) {
    try {
      const downloads = await this.getAllDownloads();
      const mangaDownloads = downloads[mangaId];
      if (!mangaDownloads || !mangaDownloads.chapters) {
        return [];
      }
      
      return Object.values(mangaDownloads.chapters)
        .filter(ch => ch.completed)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
    } catch (error) {
      console.error('Error getting downloaded chapters:', error);
      return [];
    }
  },
  
  // Get manga info from download
  async getMangaInfo(mangaId) {
    try {
      const mangaDir = getMangaDir(mangaId);
      const mangaInfoPath = `${mangaDir}manga_info.json`;
      const infoExists = await FileSystem.getInfoAsync(mangaInfoPath);
      
      if (infoExists.exists) {
        const infoJson = await FileSystem.readAsStringAsync(mangaInfoPath);
        return JSON.parse(infoJson);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting manga info:', error);
      return null;
    }
  },
  
  // Get local image path for manga
  async getMangaImagePath(mangaId, type) {
    try {
      const mangaDir = getMangaDir(mangaId);
      const dirInfo = await FileSystem.getInfoAsync(mangaDir);
      
      if (!dirInfo.exists) {
        return null;
      }
      
      // Check for common extensions
      const extensions = ['jpg', 'jpeg', 'png', 'webp'];
      for (const ext of extensions) {
        const imagePath = `${mangaDir}${type}.${ext}`;
        const imageInfo = await FileSystem.getInfoAsync(imagePath);
        if (imageInfo.exists) {
          return imagePath;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting manga image path:', error);
      return null;
    }
  },
  
  // Get chapter pages from download
  async getChapterPages(mangaId, chapterNumber) {
    try {
      const chapterData = await this.getChapterDownload(mangaId, chapterNumber);
      if (!chapterData || !chapterData.completed) {
        return null;
      }
      
      // Verify all pages still exist
      const validPages = [];
      for (const page of chapterData.pages) {
        const pageInfo = await FileSystem.getInfoAsync(page.localUri);
        if (pageInfo.exists) {
          validPages.push(page);
        }
      }
      
      if (validPages.length === 0) {
        return null;
      }
      
      return validPages.map(page => ({
        url: page.localUri,
        index: page.index,
      }));
    } catch (error) {
      console.error('Error getting chapter pages:', error);
      return null;
    }
  },
  
  // Delete a chapter download
  async deleteChapter(mangaId, chapterNumber) {
    try {
      const chapterDir = getChapterDir(mangaId, chapterNumber);
      const dirInfo = await FileSystem.getInfoAsync(chapterDir);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(chapterDir, { idempotent: true });
      }
      
      const downloads = await this.getAllDownloads();
      if (downloads[mangaId] && downloads[mangaId].chapters) {
        delete downloads[mangaId].chapters[chapterNumber];
        
        // If no more chapters, delete manga entry
        if (Object.keys(downloads[mangaId].chapters).length === 0) {
          delete downloads[mangaId];
        }
        
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
      }
    } catch (error) {
      console.error('Error deleting chapter:', error);
      throw error;
    }
  },
  
  // Delete all downloads for a manga
  async deleteManga(mangaId) {
    try {
      const mangaDir = getMangaDir(mangaId);
      const dirInfo = await FileSystem.getInfoAsync(mangaDir);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(mangaDir, { idempotent: true });
      }
      
      const downloads = await this.getAllDownloads();
      delete downloads[mangaId];
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
    } catch (error) {
      console.error('Error deleting manga:', error);
      throw error;
    }
  },
  
  // Get all downloaded manga (for downloads screen)
  async getDownloadedManga() {
    try {
      const downloads = await this.getAllDownloads();
      const mangaList = [];
      
      for (const [mangaId, mangaData] of Object.entries(downloads)) {
        const downloadedChapters = Object.values(mangaData.chapters || {})
          .filter(ch => ch.completed);
        
        if (downloadedChapters.length > 0) {
          // Get manga info
          const mangaInfo = await this.getMangaInfo(mangaId) || {};
          
          mangaList.push({
            id: mangaId,
            ...mangaInfo,
            downloadedChapters: downloadedChapters.sort((a, b) => a.chapterNumber - b.chapterNumber),
            downloadedAt: downloadedChapters[0]?.downloadedAt,
          });
        }
      }
      
      // Sort by most recently downloaded
      mangaList.sort((a, b) => {
        const dateA = new Date(a.downloadedAt || 0);
        const dateB = new Date(b.downloadedAt || 0);
        return dateB - dateA;
      });
      
      return mangaList;
    } catch (error) {
      console.error('Error getting downloaded manga:', error);
      return [];
    }
  },
  
  // Check if chapter is downloaded
  async isChapterDownloaded(mangaId, chapterNumber) {
    try {
      const chapterData = await this.getChapterDownload(mangaId, chapterNumber);
      return chapterData && chapterData.completed;
    } catch (error) {
      return false;
    }
  },
};

