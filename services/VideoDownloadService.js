import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VixsrcService } from './VixsrcService';
import { N3tflixService } from './N3tflixService';
import { VidfastService } from './VidfastService';
import { StorageService } from './StorageService';
import { OpenSubtitlesService } from './OpenSubtitlesService';

const DOWNLOADS_KEY = '@video_downloads';
const DOWNLOADS_DIR = `${FileSystem.documentDirectory}video_downloads/`;

// Active downloads tracking
const activeDownloads = new Map(); // Map<downloadId, downloadInfo>

// Ensure downloads directory exists
const ensureDownloadsDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
};

// Get media download directory
const getMediaDir = (mediaId, mediaType) => {
  return `${DOWNLOADS_DIR}${mediaType}_${mediaId}/`;
};

// Get episode download directory
const getEpisodeDir = (mediaId, season, episode) => {
  return `${getMediaDir(mediaId, 'tv')}season_${season}_episode_${episode}/`;
};

// Generate download ID
const getDownloadId = (mediaId, mediaType, season = null, episode = null) => {
  if (mediaType === 'movie') {
    return `movie_${mediaId}`;
  }
  return `tv_${mediaId}_s${season}_e${episode}`;
};

// Download subtitle file
const downloadSubtitle = async (subtitleUrl, savePath) => {
  try {
    if (!subtitleUrl) {
      throw new Error('Subtitle URL is empty');
    }
    
    // Ensure subtitle URL is complete
    let fullUrl = subtitleUrl;
    
    // Check if it's already a full URL
    if (!subtitleUrl.startsWith('http://') && !subtitleUrl.startsWith('https://')) {
      // If it's a relative URL or path, try different base URLs
      // sub.wyzie.ru subtitles might be relative paths
      if (subtitleUrl.startsWith('/')) {
        fullUrl = `https://sub.wyzie.ru${subtitleUrl}`;
      } else if (subtitleUrl.includes('subtitle_') || subtitleUrl.includes('.ru/')) {
        // Looks like it might be a path structure, try with base URL
        fullUrl = `https://sub.wyzie.ru/${subtitleUrl}`;
      } else {
        // Try as direct path
        fullUrl = `https://sub.wyzie.ru/${subtitleUrl}`;
      }
    }
    
    console.log('Downloading subtitle from:', fullUrl);
    console.log('Original URL was:', subtitleUrl);
    
    // Ensure directory exists before downloading
    const dirPath = savePath.substring(0, savePath.lastIndexOf('/'));
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://sub.wyzie.ru/',
      },
    });
    
    if (!response.ok) {
      // If first attempt fails, try alternative URL construction
      if (fullUrl.includes('sub.wyzie.ru') && !subtitleUrl.startsWith('http')) {
        const altUrl = subtitleUrl.startsWith('/') 
          ? `https://sub.wyzie.ru${subtitleUrl}`
          : `https://sub.wyzie.ru/${subtitleUrl}`;
        
        if (altUrl !== fullUrl) {
          console.log('Trying alternative URL:', altUrl);
          const altResponse = await fetch(altUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
            },
          });
          
          if (altResponse.ok) {
            const text = await altResponse.text();
            await FileSystem.writeAsStringAsync(savePath, text);
            return savePath;
          }
        }
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error('Subtitle file is empty');
    }
    
    await FileSystem.writeAsStringAsync(savePath, text);
    console.log('Subtitle saved successfully to:', savePath);
    return savePath;
  } catch (error) {
    console.error('Error downloading subtitle:', error);
    console.error('Subtitle URL was:', subtitleUrl);
    throw error;
  }
};

// Filter subtitles by language (English and Arabic only)
const filterSubtitles = (subtitles, languages = ['en', 'ar', 'eng', 'ara']) => {
  return subtitles.filter(sub => {
    const lang = sub.language?.toLowerCase() || '';
    return languages.some(l => lang.includes(l));
  });
};

export const VideoDownloadService = {
  // Download a movie
  async downloadMovie(movie, onProgress) {
    const mediaId = movie.id;
    const downloadId = getDownloadId(mediaId, 'movie');
    
    // Check if already downloading
    if (activeDownloads.has(downloadId)) {
      return { success: false, alreadyDownloading: true };
    }
    
    // Check if already downloaded
    const existingDownload = await this.getMovieDownload(mediaId);
    if (existingDownload && existingDownload.completed) {
      return { success: true, alreadyDownloaded: true };
    }
    
    // Initialize download tracking
    const downloadInfo = {
      mediaId,
      mediaType: 'movie',
      title: movie.title || movie.name || 'Unknown',
      progress: 0,
      status: 'downloading',
      startedAt: new Date().toISOString(),
    };
    activeDownloads.set(downloadId, downloadInfo);
    
    try {
      await ensureDownloadsDir();
      const mediaDir = getMediaDir(mediaId, 'movie');
      
      // Create directory
      const dirInfo = await FileSystem.getInfoAsync(mediaDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
      }
      
      // Fetch video stream and subtitles
      downloadInfo.status = 'fetching_stream';
      downloadInfo.progress = 0.1;
      if (onProgress) onProgress(0.1);
      
      // Get the selected video source
      const source = await StorageService.getVideoSource();
      const service = source === 'n3tflix' ? N3tflixService : source === 'vidfast' ? VidfastService : VixsrcService;
      
      const result = await service.fetchMovieWithSubtitles(mediaId);
      
      if (!result || !result.streamUrl) {
        throw new Error('Could not fetch video stream');
      }
      
      downloadInfo.progress = 0.3;
      if (onProgress) onProgress(0.3);
      
      // Download the video file
      downloadInfo.status = 'downloading_video';
      const videoFileName = result.streamUrl.includes('.m3u8') ? 'video.m3u8' : 'video.mp4';
      const videoSavePath = `${mediaDir}${videoFileName}`;
      
      console.log('Starting video download from:', result.streamUrl);
      console.log('Saving to:', videoSavePath);
      
      try {
        const downloadResumable = FileSystem.createDownloadResumable(
          result.streamUrl,
          videoSavePath,
          {},
          (downloadProgress) => {
            // Handle cases where totalBytesExpectedToWrite might be 0, undefined, or invalid
            let progress = 0;
            const totalBytes = downloadProgress.totalBytesExpectedToWrite || 0;
            const writtenBytes = downloadProgress.totalBytesWritten || 0;
            
            if (totalBytes > 0) {
              progress = Math.min(1, Math.max(0, writtenBytes / totalBytes));
            } else if (writtenBytes > 0) {
              // If we don't know the total size, we can't calculate exact progress
              // Just show that we're downloading (keep at 30-90% range)
              console.log(`Video download progress: ${writtenBytes} bytes downloaded (total size unknown)`);
              // Return current progress without updating to avoid invalid percentages
              return downloadInfo.progress || 0.3;
            }
            
            // Update progress: 30% (stream fetch) + 60% (video download)
            const totalProgress = 0.3 + (0.6 * progress);
            downloadInfo.progress = totalProgress;
            if (onProgress) {
              onProgress(totalProgress);
            }
            const progressPercent = totalBytes > 0 
              ? `${(progress * 100).toFixed(0)}% (${writtenBytes}/${totalBytes} bytes)`
              : `${writtenBytes} bytes downloaded`;
            console.log(`Video download progress: ${progressPercent}`);
            return progress;
          }
        );
        
        const downloadResult = await downloadResumable.downloadAsync();
        
        if (!downloadResult || !downloadResult.uri) {
          throw new Error('Video download failed - no file received');
        }
        
        console.log('Video downloaded successfully to:', downloadResult.uri);
        downloadInfo.progress = 0.85;
        if (onProgress) onProgress(0.85);
        
        // Validate downloaded file is actually a video file
        downloadInfo.status = 'validating_file';
        downloadInfo.progress = 0.9;
        if (onProgress) onProgress(0.9);
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
          if (!fileInfo.exists) {
            throw new Error('Downloaded file does not exist');
          }
          
          // Check file extension first
          const uriLower = downloadResult.uri.toLowerCase();
          const videoExtensions = ['.mp4', '.m3u8', '.mkv', '.avi', '.mov', '.webm', '.flv', '.m4v'];
          const hasVideoExtension = videoExtensions.some(ext => uriLower.includes(ext));
          
          // Check file size (video files should be reasonably large)
          // For m3u8 playlists, they can be small, so we only check for MP4 and other direct video files
          const isM3U8 = uriLower.includes('.m3u8') || videoSavePath.includes('.m3u8');
          
          if (!isM3U8 && fileInfo.size && fileInfo.size < 100 * 1024) {
            // File is very small (less than 100KB), likely not a video
            // This could be an error page or HTML
            console.warn('Downloaded file is very small:', fileInfo.size, 'bytes. Might not be a video file.');
            // For very small files, try to check if it's text/HTML
            try {
              // Try to read as string to check for HTML
              const fileContent = await FileSystem.readAsStringAsync(downloadResult.uri);
              
              // Check if fileContent is valid
              if (fileContent && typeof fileContent === 'string' && fileContent.length > 0) {
                const firstChunk = fileContent.substring(0, Math.min(500, fileContent.length)).toLowerCase();
                
                // Check if it's HTML or error message
                if (firstChunk.includes('<!doctype') || 
                    firstChunk.includes('<html') ||
                    firstChunk.includes('<!doctype html') ||
                    (firstChunk.includes('error') && (firstChunk.includes('not found') || firstChunk.includes('404')))) {
                  // Delete the invalid file
                  await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
                  throw new Error('Downloaded file appears to be HTML/text/error page, not a video file. The stream URL may be invalid.');
                }
              } else {
                // Couldn't read as text, which is good for binary video files
                console.log('File could not be read as text (likely binary/video file)');
              }
            } catch (readError) {
              // If we can't read it as text (likely binary), that's actually good for video files
              // But if file is very small and we can't read it, it might still be an issue
              if (fileInfo.size && fileInfo.size < 10 * 1024) {
                // File is extremely small, likely an error
                await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
                throw new Error('Downloaded file is too small to be a valid video file. The stream URL may be invalid.');
              }
              console.log('File appears to be binary (good sign for video file)');
            }
          } else if (isM3U8) {
            // For m3u8 playlists, they can be small text files, so we just verify they exist
            console.log('M3U8 playlist downloaded, size:', fileInfo.size, 'bytes');
          } else {
            console.log('Video file validation: File size looks reasonable:', fileInfo.size, 'bytes');
          }
          
          if (!hasVideoExtension && !uriLower.includes('video.m3u8') && !uriLower.includes('video.mp4')) {
            console.warn('Downloaded file does not have a video extension, but proceeding anyway');
          }
          
          console.log('File validation passed. File size:', fileInfo.size, 'bytes');
        } catch (validationError) {
          console.error('File validation error:', validationError);
          // Delete the invalid file
          try {
            await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
          } catch (deleteError) {
            console.error('Error deleting invalid file:', deleteError);
          }
          throw validationError;
        }
      } catch (error) {
        console.error('Error downloading video:', error);
        throw new Error(`Video download failed: ${error.message}`);
      }
      
      // Save movie metadata
      downloadInfo.status = 'saving_metadata';
      downloadInfo.progress = 0.95;
      if (onProgress) onProgress(0.95);
      
      const movieData = {
        mediaId,
        mediaType: 'movie',
        title: movie.title || movie.name,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        overview: movie.overview,
        releaseDate: movie.release_date,
        videoPath: videoSavePath, // Local path to downloaded video
        streamUrl: result.streamUrl, // Original stream URL
        subtitles: [], // Subtitles disabled for now
        downloadedAt: new Date().toISOString(),
        completed: true,
      };
      
      await this.saveMovieDownload(movieData);
      
      // Download poster if available
      if (movie.poster_path) {
        try {
          const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
          const posterPath = `${mediaDir}poster.jpg`;
          // Note: For images, we'd need to download them, but for now we'll just store the URL
        } catch (error) {
          console.error('Error downloading poster:', error);
        }
      }
      
      downloadInfo.status = 'completed';
      downloadInfo.progress = 1;
      activeDownloads.delete(downloadId);
      
      return { success: true, movieData };
    } catch (error) {
      console.error('Error downloading movie:', error);
      downloadInfo.status = 'error';
      downloadInfo.error = error.message;
      setTimeout(() => {
        activeDownloads.delete(downloadId);
      }, 5000);
      throw error;
    }
  },
  
  // Download a TV episode
  async downloadEpisode(tvShow, episode, season, onProgress) {
    const mediaId = tvShow.id;
    const episodeNumber = episode.episode_number;
    const downloadId = getDownloadId(mediaId, 'tv', season, episodeNumber);
    
    // Check if already downloading
    if (activeDownloads.has(downloadId)) {
      return { success: false, alreadyDownloading: true };
    }
    
    // Check if already downloaded
    const existingDownload = await this.getEpisodeDownload(mediaId, season, episodeNumber);
    if (existingDownload && existingDownload.completed) {
      return { success: true, alreadyDownloaded: true };
    }
    
    // Initialize download tracking
    const downloadInfo = {
      mediaId,
      mediaType: 'tv',
      season,
      episodeNumber,
      title: tvShow.name || tvShow.title || 'Unknown',
      episodeTitle: episode.name || `Episode ${episodeNumber}`,
      progress: 0,
      status: 'downloading',
      startedAt: new Date().toISOString(),
    };
    activeDownloads.set(downloadId, downloadInfo);
    
    try {
      await ensureDownloadsDir();
      const episodeDir = getEpisodeDir(mediaId, season, episodeNumber);
      
      // Create directory
      const dirInfo = await FileSystem.getInfoAsync(episodeDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(episodeDir, { intermediates: true });
      }
      
      // Fetch video stream and subtitles
      downloadInfo.status = 'fetching_stream';
      downloadInfo.progress = 0.1;
      if (onProgress) onProgress(0.1);
      
      // Get the selected video source
      const source = await StorageService.getVideoSource();
      const service = source === 'n3tflix' ? N3tflixService : source === 'vidfast' ? VidfastService : VixsrcService;
      
      const result = await service.fetchEpisodeWithSubtitles(mediaId, season, episodeNumber);
      
      if (!result || !result.streamUrl) {
        throw new Error('Could not fetch video stream');
      }
      
      downloadInfo.progress = 0.3;
      if (onProgress) onProgress(0.3);
      
      // Download the video file
      downloadInfo.status = 'downloading_video';
      const videoFileName = result.streamUrl.includes('.m3u8') ? 'video.m3u8' : 'video.mp4';
      const videoSavePath = `${episodeDir}${videoFileName}`;
      
      console.log('Starting video download from:', result.streamUrl);
      console.log('Saving to:', videoSavePath);
      
      try {
        const downloadResumable = FileSystem.createDownloadResumable(
          result.streamUrl,
          videoSavePath,
          {},
          (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            // Update progress: 30% (stream fetch) + 60% (video download)
            const totalProgress = 0.3 + (0.6 * progress);
            downloadInfo.progress = totalProgress;
            if (onProgress) {
              onProgress(totalProgress);
            }
            console.log(`Video download progress: ${(progress * 100).toFixed(0)}%`);
            return progress;
          }
        );
        
        const downloadResult = await downloadResumable.downloadAsync();
        
        if (!downloadResult || !downloadResult.uri) {
          throw new Error('Video download failed - no file received');
        }
        
        console.log('Video downloaded successfully to:', downloadResult.uri);
        downloadInfo.progress = 0.9;
        if (onProgress) onProgress(0.9);
      } catch (error) {
        console.error('Error downloading video:', error);
        throw new Error(`Video download failed: ${error.message}`);
      }
      
      // Save episode metadata
      downloadInfo.status = 'saving_metadata';
      downloadInfo.progress = 0.95;
      if (onProgress) onProgress(0.95);
      
      const episodeData = {
        mediaId,
        mediaType: 'tv',
        season,
        episodeNumber,
        title: tvShow.name || tvShow.title,
        episodeTitle: episode.name || `Episode ${episodeNumber}`,
        episodeOverview: episode.overview,
        airDate: episode.air_date,
        videoPath: videoSavePath, // Local path to downloaded video
        streamUrl: result.streamUrl, // Original stream URL
        subtitles: [], // Subtitles disabled for now
        downloadedAt: new Date().toISOString(),
        completed: true,
      };
      
      await this.saveEpisodeDownload(episodeData);
      
      // Ensure TV show info is saved
      await this.ensureTVShowInfoDownloaded(tvShow);
      
      downloadInfo.status = 'completed';
      downloadInfo.progress = 1;
      activeDownloads.delete(downloadId);
      
      return { success: true, episodeData };
    } catch (error) {
      console.error('Error downloading episode:', error);
      downloadInfo.status = 'error';
      downloadInfo.error = error.message;
      setTimeout(() => {
        activeDownloads.delete(downloadId);
      }, 5000);
      throw error;
    }
  },
  
  // Ensure TV show info is downloaded
  async ensureTVShowInfoDownloaded(tvShow) {
    try {
      const mediaId = tvShow.id;
      const mediaDir = getMediaDir(mediaId, 'tv');
      const dirInfo = await FileSystem.getInfoAsync(mediaDir);
      
      // Check if TV show info already exists
      const tvShowInfoPath = `${mediaDir}tv_show_info.json`;
      const tvShowInfoExists = await FileSystem.getInfoAsync(tvShowInfoPath);
      
      if (tvShowInfoExists.exists) {
        return; // Already downloaded
      }
      
      // Create directory if needed
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
      }
      
      // Save TV show info JSON
      const tvShowInfo = {
        id: tvShow.id,
        name: tvShow.name || tvShow.title,
        overview: tvShow.overview,
        posterPath: tvShow.poster_path,
        backdropPath: tvShow.backdrop_path,
        firstAirDate: tvShow.first_air_date,
        downloadedAt: new Date().toISOString(),
      };
      
      await FileSystem.writeAsStringAsync(tvShowInfoPath, JSON.stringify(tvShowInfo, null, 2));
    } catch (error) {
      console.error('Error downloading TV show info:', error);
    }
  },
  
  // Save movie download metadata
  async saveMovieDownload(movieData) {
    try {
      const downloads = await this.getAllDownloads();
      const mediaId = movieData.mediaId;
      
      if (!downloads.movies) {
        downloads.movies = {};
      }
      
      downloads.movies[mediaId] = movieData;
      
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
    } catch (error) {
      console.error('Error saving movie download:', error);
    }
  },
  
  // Save episode download metadata
  async saveEpisodeDownload(episodeData) {
    try {
      const downloads = await this.getAllDownloads();
      const mediaId = episodeData.mediaId;
      
      if (!downloads.tv) {
        downloads.tv = {};
      }
      if (!downloads.tv[mediaId]) {
        downloads.tv[mediaId] = {
          tvShow: null,
          episodes: {},
        };
      }
      
      const episodeKey = `s${episodeData.season}_e${episodeData.episodeNumber}`;
      downloads.tv[mediaId].episodes[episodeKey] = episodeData;
      
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
    } catch (error) {
      console.error('Error saving episode download:', error);
    }
  },
  
  // Get movie download
  async getMovieDownload(mediaId) {
    try {
      const downloads = await this.getAllDownloads();
      return downloads.movies?.[mediaId] || null;
    } catch (error) {
      console.error('Error getting movie download:', error);
      return null;
    }
  },
  
  // Get episode download
  async getEpisodeDownload(mediaId, season, episodeNumber) {
    try {
      const downloads = await this.getAllDownloads();
      const episodeKey = `s${season}_e${episodeNumber}`;
      return downloads.tv?.[mediaId]?.episodes?.[episodeKey] || null;
    } catch (error) {
      console.error('Error getting episode download:', error);
      return null;
    }
  },
  
  // Get all downloads
  async getAllDownloads() {
    try {
      const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
      return data ? JSON.parse(data) : { movies: {}, tv: {} };
    } catch (error) {
      console.error('Error getting all downloads:', error);
      return { movies: {}, tv: {} };
    }
  },
  
  // Get active downloads
  getActiveDownloads() {
    return Array.from(activeDownloads.values());
  },
  
  // Cancel a download
  cancelDownload(mediaId, mediaType, season = null, episode = null) {
    const downloadId = getDownloadId(mediaId, mediaType, season, episode);
    activeDownloads.delete(downloadId);
  },
  
  // Check if movie is downloaded
  async isMovieDownloaded(mediaId) {
    try {
      const download = await this.getMovieDownload(mediaId);
      return download && download.completed;
    } catch (error) {
      return false;
    }
  },
  
  // Check if episode is downloaded
  async isEpisodeDownloaded(mediaId, season, episodeNumber) {
    try {
      const download = await this.getEpisodeDownload(mediaId, season, episodeNumber);
      return download && download.completed;
    } catch (error) {
      return false;
    }
  },
  
  // Get all downloaded movies
  async getDownloadedMovies() {
    try {
      const downloads = await this.getAllDownloads();
      const movies = [];
      
      for (const [mediaId, movieData] of Object.entries(downloads.movies || {})) {
        if (movieData && movieData.completed) {
          movies.push(movieData);
        }
      }
      
      // Sort by most recently downloaded
      movies.sort((a, b) => {
        const dateA = new Date(a.downloadedAt || 0);
        const dateB = new Date(b.downloadedAt || 0);
        return dateB - dateA;
      });
      
      return movies;
    } catch (error) {
      console.error('Error getting downloaded movies:', error);
      return [];
    }
  },
  
  // Get all downloaded TV shows with episodes
  async getDownloadedTVShows() {
    try {
      const downloads = await this.getAllDownloads();
      const tvShows = [];
      
      for (const [mediaId, tvData] of Object.entries(downloads.tv || {})) {
        if (tvData && tvData.episodes) {
          const downloadedEpisodes = Object.values(tvData.episodes || {})
            .filter(ep => ep.completed);
          
          if (downloadedEpisodes.length > 0) {
            // Get TV show info
            const tvShowDir = getMediaDir(mediaId, 'tv');
            const tvShowInfoPath = `${tvShowDir}tv_show_info.json`;
            let tvShowInfo = null;
            
            try {
              const infoExists = await FileSystem.getInfoAsync(tvShowInfoPath);
              if (infoExists.exists) {
                const infoJson = await FileSystem.readAsStringAsync(tvShowInfoPath);
                tvShowInfo = JSON.parse(infoJson);
              }
            } catch (error) {
              console.error('Error loading TV show info:', error);
            }
            
            tvShows.push({
              id: mediaId,
              ...tvShowInfo,
              downloadedEpisodes: downloadedEpisodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episodeNumber - b.episodeNumber;
              }),
              downloadedAt: downloadedEpisodes[0]?.downloadedAt,
            });
          }
        }
      }
      
      // Sort by most recently downloaded
      tvShows.sort((a, b) => {
        const dateA = new Date(a.downloadedAt || 0);
        const dateB = new Date(b.downloadedAt || 0);
        return dateB - dateA;
      });
      
      return tvShows;
    } catch (error) {
      console.error('Error getting downloaded TV shows:', error);
      return [];
    }
  },
};

