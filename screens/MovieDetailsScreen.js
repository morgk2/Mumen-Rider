import React, { useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  ScrollView,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TMDBService } from '../services/TMDBService';
import { StorageService } from '../services/StorageService';
import { CacheService } from '../services/CacheService';
import { WatchProgressService } from '../services/WatchProgressService';
import { openInExternalPlayer } from '../services/ExternalPlayerService';
import { VixsrcService } from '../services/VixsrcService';
import { N3tflixService } from '../services/N3tflixService';
import { VideoDownloadService } from '../services/VideoDownloadService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EpisodeItem } from '../components/EpisodeItem';
import { CastMember } from '../components/CastMember';
import { ReviewItem } from '../components/ReviewItem';
import CollectionPickerModal from '../components/CollectionPickerModal';
import { CachedImage } from '../components/CachedImage';
import { Alert, Linking } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.6;

// Genre ID to name mapping
const GENRE_MAP = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export default function MovieDetailsScreen({ route, navigation }) {
  const { item } = route.params || {};
  const insets = useSafeAreaInsets();
  const [logoUrl, setLogoUrl] = useState(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [tvDetails, setTvDetails] = useState(null);
  const [cast, setCast] = useState([]);
  const [loadingCast, setLoadingCast] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isInCollection, setIsInCollection] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [watchProgress, setWatchProgress] = useState(null);
  const [latestEpisodeProgress, setLatestEpisodeProgress] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [episodeProgress, setEpisodeProgress] = useState({});
  const [episodeDownloadStatus, setEpisodeDownloadStatus] = useState({}); // Track download status for each episode
  const [episodeDownloadProgress, setEpisodeDownloadProgress] = useState({}); // Track download progress for each episode
  const [movieDetails, setMovieDetails] = useState(null); // Store full movie details for runtime, certification, tagline
  const [isPlotExpanded, setIsPlotExpanded] = useState(false); // Track if plot is expanded
  const [dominantColor, setDominantColor] = useState('#000000'); // Dominant color from backdrop
  const [darkenedColor, setDarkenedColor] = useState('#000000'); // Darkened version of dominant color
  const scrollY = useRef(new Animated.Value(0)).current;

  // Function to darken a color
  const darkenColor = (color, amount = 0.5) => {
    // Remove # if present
    const hex = color.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Darken by multiplying by amount (0-1, where 0.5 = 50% darker)
    const darkenedR = Math.max(0, Math.floor(r * amount));
    const darkenedG = Math.max(0, Math.floor(g * amount));
    const darkenedB = Math.max(0, Math.floor(b * amount));
    
    // Convert back to hex
    return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`;
  };

  // Convert hex to rgba
  const hexToRgba = (hex, alpha = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0, 0, 0, ${alpha})`;
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Extract dominant color from backdrop using a hash-based approach
  const extractDominantColor = async (imageUrl) => {
    if (!imageUrl) {
      setDominantColor('#000000');
      setDarkenedColor('#000000');
      return;
    }
    
    try {
      // Generate a consistent color based on the image URL hash
      const hash = imageUrl.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
      }, 0);
      
      const r = Math.abs(hash % 180) + 30;
      const g = Math.abs((hash >> 8) % 180) + 30;
      const b = Math.abs((hash >> 16) % 180) + 30;
      
      const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      setDominantColor(color);
      // Darken the color (0.3 = 70% darker, making it quite dark)
      const darkened = darkenColor(color, 0.3);
      setDarkenedColor(darkened);
    } catch (error) {
      console.error('Error extracting color:', error);
      setDominantColor('#000000');
      setDarkenedColor('#000000');
    }
  };

  useEffect(() => {
    if (item) {
      fetchLogo();
      fetchCastData();
      fetchReviewsData();
      fetchTrailer();
      checkBookmarkStatus();
      loadWatchProgress();
      checkDownloadStatus();
      const isTVShow = !item.title && (item.name || item.media_type === 'tv');
      if (isTVShow) {
        fetchTVDetails();
        fetchEpisodes(selectedSeason);
      } else {
        fetchMovieDetails();
      }
      
      // Extract color from backdrop
      const backdropUrl = item.backdrop_path 
        ? TMDBService.getBackdropURL(item.backdrop_path, 'w780')
        : item.poster_path 
        ? TMDBService.getPosterURL(item.poster_path, 'w780')
        : null;
      
      if (backdropUrl) {
        extractDominantColor(backdropUrl);
      }
    }
  }, [item]);
  
  // Reload download status and episode progress when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (item) {
        checkDownloadStatus();
        const isTVShow = !item.title && (item.name || item.media_type === 'tv');
        if (isTVShow && episodes.length > 0) {
          loadEpisodeProgress(episodes, selectedSeason);
          checkEpisodeDownloadStatuses();
        }
      }
    }, [item, episodes, selectedSeason])
  );
  
  // Check download status periodically when downloading
  useEffect(() => {
    if (!isDownloading) return;
    
    const interval = setInterval(() => {
      checkDownloadStatus();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isDownloading]);

  // Check episode download status periodically
  useEffect(() => {
    const isTVShow = !item || (!item.title && (item.name || item.media_type === 'tv'));
    if (!isTVShow || episodes.length === 0) return;
    
    // Check for active episode downloads from VideoDownloadService
    const activeDownloads = VideoDownloadService.getActiveDownloads();
    const hasActiveDownloads = activeDownloads.some(
      d => d.mediaId === item.id && d.mediaType === 'tv' && d.season === selectedSeason
    );
    
    if (!hasActiveDownloads) return;
    
    const interval = setInterval(() => {
      checkEpisodeDownloadStatuses();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [episodes, selectedSeason, item]);

  // Reload episode download statuses when episodes or season changes
  useEffect(() => {
    const isTVShow = !item || (!item.title && (item.name || item.media_type === 'tv'));
    if (isTVShow && episodes.length > 0) {
      checkEpisodeDownloadStatuses();
    }
  }, [episodes, selectedSeason, item]);
  
  const checkBookmarkStatus = async () => {
    if (!item) return;
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    const bookmarked = await StorageService.isBookmarked(item.id, mediaType);
    setIsBookmarked(bookmarked);
    
    // Check if item is in any collection
    const collections = await StorageService.getCollections();
    const inCollection = collections.some(collection => 
      collection.items?.some(i => i.id === item.id && i.media_type === mediaType)
    );
    setIsInCollection(inCollection);
  };

  useEffect(() => {
    if (item && (!item.title && (item.name || item.media_type === 'tv'))) {
      fetchEpisodes(selectedSeason);
    }
  }, [selectedSeason]);


  const fetchLogo = async () => {
    if (!item) return;
    
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const itemId = item.id;
      
      // Check cache first
      const cachedLogo = await CacheService.getCachedLogoUrl(itemId, mediaType);
      if (cachedLogo) {
        setLogoUrl(cachedLogo);
        setLoadingLogo(false);
        return;
      }
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${itemId}/images?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
      );
      const data = await response.json();
      
      const logo = data.logos?.find(logo => logo.iso_639_1 === 'en') || data.logos?.[0];
      
      if (logo) {
        const logoPath = logo.file_path;
        const logoUrl = `https://image.tmdb.org/t/p/w500${logoPath}`;
        setLogoUrl(logoUrl);
        // Cache the logo URL
        await CacheService.cacheLogoUrl(itemId, mediaType, logoUrl);
      }
      setLoadingLogo(false);
    } catch (error) {
      console.error('Error fetching logo:', error);
      setLoadingLogo(false);
    }
  };

  const fetchTVDetails = async () => {
    if (!item || !item.id) return;
    
    try {
      // Check cache first
      const cachedDetails = await CacheService.getCachedMediaDetails(item.id, 'tv');
      if (cachedDetails) {
        setTvDetails(cachedDetails);
        const availableSeasons = (cachedDetails.seasons || []).filter(season => season.season_number > 0);
        if (availableSeasons.length > 0 && availableSeasons[0].season_number !== selectedSeason) {
          setSelectedSeason(availableSeasons[0].season_number);
        }
        return;
      }
      
      const details = await TMDBService.fetchTVDetails(item.id);
      if (details) {
        setTvDetails(details);
        // Cache the details
        await CacheService.cacheMediaDetails(item.id, 'tv', details);
        // Set initial season to first available season
        const availableSeasons = (details.seasons || []).filter(season => season.season_number > 0);
        if (availableSeasons.length > 0 && availableSeasons[0].season_number !== selectedSeason) {
          setSelectedSeason(availableSeasons[0].season_number);
        }
      }
    } catch (error) {
      console.error('Error fetching TV details:', error);
    }
  };

  const fetchMovieDetails = async () => {
    if (!item || !item.id) return;
    
    try {
      // Check cache first
      const cachedDetails = await CacheService.getCachedMediaDetails(item.id, 'movie');
      if (cachedDetails) {
        // If cached details don't have release_dates, fetch them separately
        if (cachedDetails.release_dates && cachedDetails.release_dates.results) {
          setMovieDetails(cachedDetails);
          return;
        } else {
          // Use cached details but fetch release dates
          try {
            const releaseDatesResponse = await fetch(
              `https://api.themoviedb.org/3/movie/${item.id}/release_dates?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
            );
            const releaseDates = await releaseDatesResponse.json();
            if (releaseDates && releaseDates.results) {
              cachedDetails.release_dates = releaseDates;
              await CacheService.cacheMediaDetails(item.id, 'movie', cachedDetails);
            }
            setMovieDetails(cachedDetails);
            return;
          } catch (error) {
            console.error('Error fetching release dates:', error);
            // Still use cached details without release dates
            setMovieDetails(cachedDetails);
            return;
          }
        }
      }
      
      // Fetch movie details and release dates in parallel
      const [detailsResponse, releaseDatesResponse] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`),
        fetch(`https://api.themoviedb.org/3/movie/${item.id}/release_dates?api_key=738b4edd0a156cc126dc4a4b8aea4aca`)
      ]);
      
      const details = await detailsResponse.json();
      const releaseDates = await releaseDatesResponse.json();
      
      if (details) {
        // Merge release dates into details
        if (releaseDates && releaseDates.results) {
          details.release_dates = releaseDates;
        }
        setMovieDetails(details);
        // Cache the details
        await CacheService.cacheMediaDetails(item.id, 'movie', details);
      }
    } catch (error) {
      console.error('Error fetching movie details:', error);
      // Still try to set basic details if available from item
      if (item.runtime || item.tagline) {
        setMovieDetails(item);
      }
    }
  };

  const fetchEpisodes = async (seasonNumber) => {
    if (!item || !item.id) return;
    
    setLoadingEpisodes(true);
    try {
      const episodesData = await TMDBService.fetchTVEpisodes(item.id, seasonNumber);
      setEpisodes(episodesData);
      
      // Load progress for all episodes
      await loadEpisodeProgress(episodesData, seasonNumber);
    } catch (error) {
      console.error('Error fetching episodes:', error);
      setEpisodes([]);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const loadEpisodeProgress = async (episodesData, seasonNumber) => {
    if (!item || !item.id || !episodesData || episodesData.length === 0) return;
    
    try {
      const mediaType = item.media_type || 'tv';
      const progressMap = {};
      
      // Load progress for each episode
      for (const episode of episodesData) {
        if (episode.episode_number) {
          const progress = await WatchProgressService.getProgress(
            item.id,
            mediaType,
            seasonNumber,
            episode.episode_number
          );
          if (progress) {
            progressMap[episode.episode_number] = progress;
          }
        }
      }
      
      setEpisodeProgress(progressMap);
    } catch (error) {
      console.error('Error loading episode progress:', error);
    }
  };

  const handleEpisodePress = async (episode) => {
    if (navigation && item && episode) {
      // Check for progress for this specific episode
      let resumePosition = null;
      try {
        const mediaType = item.media_type || 'tv';
        const progress = await WatchProgressService.getProgress(
          item.id,
          mediaType,
          selectedSeason,
          episode.episode_number
        );
        if (progress) {
          resumePosition = progress.position;
        }
      } catch (error) {
        console.error('Error loading episode progress:', error);
      }
      
      // Check if external player is selected
      const externalPlayer = await StorageService.getExternalPlayer();
      await playVideo(item, episode, selectedSeason, episode.episode_number, resumePosition, externalPlayer);
    }
  };

  const fetchCastData = async () => {
    if (!item || !item.id) return;
    
    setLoadingCast(true);
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const castData = await TMDBService.fetchCast(mediaType, item.id);
      setCast(castData.slice(0, 20)); // Limit to first 20 cast members
    } catch (error) {
      console.error('Error fetching cast:', error);
      setCast([]);
    } finally {
      setLoadingCast(false);
    }
  };

  const fetchReviewsData = async () => {
    if (!item || !item.id) return;
    
    setLoadingReviews(true);
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const reviewsData = await TMDBService.fetchReviews(mediaType, item.id);
      setReviews(reviewsData.slice(0, 10)); // Limit to first 10 reviews
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchTrailer = async () => {
    if (!item || !item.id) return;
    
    setLoadingTrailer(true);
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const videos = await TMDBService.fetchVideos(mediaType, item.id);
      
      // Find the first official trailer (prefer official, then teaser, then any trailer)
      const officialTrailer = videos.find(
        v => v.type === 'Trailer' && v.official === true && v.site === 'YouTube'
      ) || videos.find(
        v => v.type === 'Teaser' && v.official === true && v.site === 'YouTube'
      ) || videos.find(
        v => (v.type === 'Trailer' || v.type === 'Teaser') && v.site === 'YouTube'
      );
      
      if (officialTrailer && officialTrailer.key) {
        setTrailer(officialTrailer);
      } else {
        setTrailer(null);
      }
    } catch (error) {
      console.error('Error fetching trailer:', error);
      setTrailer(null);
    } finally {
      setLoadingTrailer(false);
    }
  };

  const handleTrailerPress = () => {
    if (!trailer || !trailer.key) return;
    
    const youtubeUrl = TMDBService.getYouTubeTrailerUrl(trailer.key);
    if (youtubeUrl) {
      // Open YouTube URL - will open in YouTube app if installed, otherwise in browser
      Linking.openURL(youtubeUrl).catch(err => {
        console.error('Error opening trailer:', err);
        Alert.alert('Error', 'Failed to open trailer');
      });
    }
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const posterUrl = TMDBService.getPosterURL(item.poster_path, 'original');
  const backdropUrl = TMDBService.getBackdropURL(item.backdrop_path, 'original');
  const displayTitle = item.title || item.name || '';
  const overview = item.overview || '';
  const releaseDate = item.release_date || item.first_air_date || '';
  const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';
  
  const isTVShow = !item.title && (item.name || item.media_type === 'tv');
  const isMovie = !isTVShow;
  const seasons = (tvDetails?.seasons || []).filter(season => season.season_number > 0);

  // Get genres - check item.genres, tvDetails.genres, or map from genre_ids
  const getGenres = () => {
    if (item.genres && item.genres.length > 0) {
      return item.genres.map(g => g.name || g);
    }
    if (tvDetails?.genres && tvDetails.genres.length > 0) {
      return tvDetails.genres.map(g => g.name || g);
    }
    if (item.genre_ids && item.genre_ids.length > 0) {
      return item.genre_ids
        .map(id => GENRE_MAP[id])
        .filter(Boolean)
        .slice(0, 3); // Limit to 3 genres
    }
    return [];
  };
  const genres = getGenres();
  const rating = item.vote_average || 0;

  // Get play button text and icon
  const getPlayButtonInfo = () => {
    const isTVShow = !item.title && (item.name || item.media_type === 'tv');
    
    if (isTVShow && latestEpisodeProgress) {
      const { season, episodeNumber } = latestEpisodeProgress;
      const episodeStr = String(episodeNumber).padStart(2, '0');
      const seasonStr = String(season).padStart(2, '0');
      return {
        icon: "play-forward",
        text: `Continue Watching E${episodeStr}S${seasonStr}`
      };
    } else if (watchProgress) {
      return {
        icon: "play-forward",
        text: 'Continue Watching'
      };
    } else {
      return {
        icon: "play",
        text: 'Play'
      };
    }
  };
  
  const playButtonInfo = getPlayButtonInfo();

  const loadWatchProgress = async () => {
    if (!item || !item.id) return;
    
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const isTVShow = !item.title && (item.name || item.media_type === 'tv');
      
      if (isTVShow) {
        // For TV shows, get all progress and find the latest episode
        const allProgress = await WatchProgressService.getAllProgress();
        
        // Find all episodes with progress for this show
        const episodeProgresses = Object.values(allProgress).filter(progress => {
          return progress.itemId === item.id && 
                 progress.mediaType === mediaType &&
                 progress.season !== null &&
                 progress.episodeNumber !== null;
        });
        
        if (episodeProgresses.length > 0) {
          // Sort by last watched (most recent first), then by season/episode
          episodeProgresses.sort((a, b) => {
            const dateA = new Date(a.lastWatched);
            const dateB = new Date(b.lastWatched);
            if (dateB - dateA !== 0) {
              return dateB - dateA;
            }
            // If same date, sort by season then episode
            if (b.season !== a.season) {
              return b.season - a.season;
            }
            return b.episodeNumber - a.episodeNumber;
          });
          
          setLatestEpisodeProgress(episodeProgresses[0]);
        } else {
          setLatestEpisodeProgress(null);
        }
        setWatchProgress(null); // Clear movie progress for TV shows
      } else {
        // For movies, get single progress
        const progress = await WatchProgressService.getProgress(item.id, mediaType);
        setWatchProgress(progress);
        setLatestEpisodeProgress(null);
      }
    } catch (error) {
      console.error('Error loading watch progress:', error);
    }
  };
  
  const checkDownloadStatus = async () => {
    if (!item || !item.id) return;
    
    const isTVShow = !item.title && (item.name || item.media_type === 'tv');
    
    if (isTVShow) {
      // For TV shows, check download status for each episode
      if (episodes.length > 0) {
        checkEpisodeDownloadStatuses();
      }
      return;
    }
    
    // For movies, check download status
    try {
      const downloaded = await VideoDownloadService.isMovieDownloaded(item.id);
      setIsDownloaded(downloaded);
      
      // Check if currently downloading
      const activeDownloads = VideoDownloadService.getActiveDownloads();
      const movieDownload = activeDownloads.find(
        d => d.mediaId === item.id && d.mediaType === 'movie'
      );
      
      if (movieDownload) {
        setIsDownloading(true);
        setDownloadProgress(movieDownload.progress || 0);
      } else {
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    } catch (error) {
      console.error('Error checking download status:', error);
    }
  };

  const checkEpisodeDownloadStatuses = async () => {
    if (!item || !item.id || episodes.length === 0) return;
    
    try {
      const activeDownloads = VideoDownloadService.getActiveDownloads();
      const newEpisodeDownloadStatus = {};
      const newEpisodeDownloadProgress = {};
      
      for (const episode of episodes) {
        const episodeNumber = episode.episode_number;
        const episodeKey = `s${selectedSeason}_e${episodeNumber}`;
        
        // Check if episode is downloaded
        const isDownloaded = await VideoDownloadService.isEpisodeDownloaded(
          item.id,
          selectedSeason,
          episodeNumber
        );
        
        // Check if episode is currently downloading
        const activeDownload = activeDownloads.find(
          d => d.mediaId === item.id &&
               d.mediaType === 'tv' &&
               d.season === selectedSeason &&
               d.episodeNumber === episodeNumber
        );
        
        newEpisodeDownloadStatus[episodeKey] = {
          isDownloaded,
          isDownloading: !!activeDownload,
          progress: activeDownload?.progress || 0,
        };
        
        if (activeDownload) {
          newEpisodeDownloadProgress[episodeKey] = activeDownload.progress || 0;
        }
      }
      
      setEpisodeDownloadStatus(newEpisodeDownloadStatus);
      setEpisodeDownloadProgress(newEpisodeDownloadProgress);
    } catch (error) {
      console.error('Error checking episode download statuses:', error);
    }
  };
  
  // Validate if URL is a video file
  const validateVideoUrl = async (url) => {
    if (!url) return { isValid: false, error: 'No URL provided' };
    
    try {
      // Check URL extension
      const urlLower = url.toLowerCase();
      const videoExtensions = ['.mp4', '.m3u8', '.mkv', '.avi', '.mov', '.webm', '.flv', '.m4v'];
      const hasVideoExtension = videoExtensions.some(ext => urlLower.includes(ext));
      
      // Check if it's an m3u8 playlist (HLS stream)
      if (urlLower.includes('.m3u8')) {
        return { isValid: true, type: 'm3u8', url };
      }
      
      // For direct video URLs, check content-type
      if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
        try {
          // Make a HEAD request to check content-type
          const response = await fetch(url, { 
            method: 'HEAD',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
          });
          
          const contentType = response.headers.get('content-type') || '';
          const contentTypeLower = contentType.toLowerCase();
          
          // Check if it's a video content type
          const isVideoContentType = contentTypeLower.includes('video/') || 
                                     contentTypeLower.includes('application/vnd.apple.mpegurl') ||
                                     contentTypeLower.includes('application/x-mpegurl');
          
          // Check if it's HTML or text (bad signs)
          const isHtmlOrText = contentTypeLower.includes('text/html') || 
                               contentTypeLower.includes('text/plain') ||
                               contentTypeLower.includes('application/json');
          
          if (isHtmlOrText) {
            return { 
              isValid: false, 
              error: 'URL appears to be HTML/text, not a video file',
              contentType 
            };
          }
          
          if (isVideoContentType || hasVideoExtension) {
            return { 
              isValid: true, 
              type: 'video', 
              url, 
              contentType: contentType || 'unknown' 
            };
          }
          
          // If we can't determine, but has video extension, allow it
          if (hasVideoExtension) {
            return { 
              isValid: true, 
              type: 'video', 
              url, 
              contentType: contentType || 'unknown',
              warning: 'Could not verify content type, but URL looks like a video'
            };
          }
          
          return { 
            isValid: false, 
            error: `Unknown content type: ${contentType || 'unknown'}. URL does not appear to be a video file.`,
            contentType 
          };
        } catch (fetchError) {
          // If HEAD request fails, check extension as fallback
          console.warn('Could not verify content-type, using extension check:', fetchError);
          if (hasVideoExtension) {
            return { 
              isValid: true, 
              type: 'video', 
              url, 
              warning: 'Could not verify content type, but URL extension suggests it\'s a video'
            };
          }
          return { 
            isValid: false, 
            error: 'Could not verify if URL is a video file',
            details: fetchError.message 
          };
        }
      }
      
      return { isValid: false, error: 'Invalid URL format' };
    } catch (error) {
      console.error('Error validating video URL:', error);
      return { isValid: false, error: error.message };
    }
  };

  const handleDownload = async () => {
    if (!item || !item.id) return;
    
    const isTVShow = !item.title && (item.name || item.media_type === 'tv');
    // Only allow downloads for movies
    if (isTVShow) {
      Alert.alert('Info', 'Episode downloads are available from the episode list.');
      return;
    }
    
    // Check if already downloaded
    if (isDownloaded) {
      Alert.alert(
        'Already Downloaded',
        'This movie is already downloaded. You can watch it offline.',
        [
          { text: 'OK' }
        ]
      );
      return;
    }
    
    // Check if already downloading
    if (isDownloading) {
      Alert.alert('Download in Progress', 'This movie is already being downloaded.');
      return;
    }
    
    try {
      // Show loading state
      setIsDownloading(true);
      setDownloadProgress(0.1);
      
      const source = await StorageService.getVideoSource();
      const service = source === 'n3tflix' ? N3tflixService : VixsrcService;
      
      const result = await service.fetchMovieWithSubtitles(item.id);
      
      setIsDownloading(false);
      setDownloadProgress(0);
      
      if (!result || !result.streamUrl) {
        Alert.alert(
          'Error',
          'Could not fetch video stream URL. Please try again later.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const streamUrl = result.streamUrl;
      
      // Validate the URL
      const validation = await validateVideoUrl(streamUrl);
      
      if (!validation.isValid) {
        Alert.alert(
          'Invalid Video URL',
          `The stream URL does not appear to be a valid video file:\n\n${validation.error}${validation.details ? '\n\nDetails: ' + validation.details : ''}\n\nURL: ${streamUrl.substring(0, 100)}${streamUrl.length > 100 ? '...' : ''}`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Show confirmation dialog with URL (truncated for display)
      const urlDisplay = streamUrl.length > 120 
        ? streamUrl.substring(0, 120) + '...' 
        : streamUrl;
      
      const contentTypeDisplay = validation.contentType || 'Not verified';
      const warningText = validation.warning ? `\n\n⚠️ Warning: ${validation.warning}` : '';
      
      Alert.alert(
        'Confirm Download',
        `Download video from this URL?${warningText}\n\nURL:\n${urlDisplay}\n\nContent Type: ${contentTypeDisplay}\n\nDo you want to proceed with the download?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Download',
            onPress: async () => {
              // Proceed with download
              try {
                setIsDownloading(true);
                setDownloadProgress(0);
                
                const downloadResult = await VideoDownloadService.downloadMovie(item, (progress) => {
                  setDownloadProgress(progress);
                });
                
                if (downloadResult.success) {
                  if (downloadResult.alreadyDownloaded) {
                    Alert.alert('Already Downloaded', 'This movie is already downloaded.');
                  } else {
                    Alert.alert(
                      'Download Complete', 
                      'Movie downloaded successfully! You can now watch it offline. You can find it in the Downloads section.',
                      [{ text: 'OK' }]
                    );
                  }
                  await checkDownloadStatus(); // Refresh download status
                } else if (downloadResult.alreadyDownloading) {
                  Alert.alert('Download in Progress', 'This movie is already being downloaded.');
                  await checkDownloadStatus(); // Refresh download status
                }
              } catch (error) {
                console.error('Error downloading movie:', error);
                Alert.alert(
                  'Download Failed',
                  error.message || 'Failed to download movie. Please try again.',
                  [{ text: 'OK' }]
                );
                await checkDownloadStatus(); // Refresh download status in case of error
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error fetching stream URL:', error);
      setIsDownloading(false);
      setDownloadProgress(0);
      Alert.alert(
        'Error',
        `Failed to fetch video stream URL: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handlePlay = async () => {
    if (!navigation || !item) return;
    
    // Check if external player is selected
    const externalPlayer = await StorageService.getExternalPlayer();
    
    const isTVShow = !item.title && (item.name || item.media_type === 'tv');
    
    if (isTVShow) {
      // For TV shows
      if (latestEpisodeProgress) {
        // Play the latest episode with progress
        const { season, episodeNumber, position } = latestEpisodeProgress;
        
        // Fetch episode data for this season/episode
        try {
          const episodesData = await TMDBService.fetchTVEpisodes(item.id, season);
          const episode = episodesData.find(ep => ep.episode_number === episodeNumber);
          
          if (episode) {
            await playVideo(item, episode, season, episodeNumber, position, externalPlayer);
          } else {
            // Fallback: play S01E01
            const season1Episodes = await TMDBService.fetchTVEpisodes(item.id, 1);
            const firstEpisode = season1Episodes.find(ep => ep.episode_number === 1);
            if (firstEpisode) {
              await playVideo(item, firstEpisode, 1, 1, null, externalPlayer);
            }
          }
        } catch (error) {
          console.error('Error fetching episode for play:', error);
          // Fallback: try to play S01E01
          try {
            const season1Episodes = await TMDBService.fetchTVEpisodes(item.id, 1);
            const firstEpisode = season1Episodes.find(ep => ep.episode_number === 1);
            if (firstEpisode) {
              await playVideo(item, firstEpisode, 1, 1, null, externalPlayer);
            }
          } catch (fallbackError) {
            console.error('Error fetching S01E01:', fallbackError);
          }
        }
      } else {
        // No progress - play S01E01
        try {
          const season1Episodes = await TMDBService.fetchTVEpisodes(item.id, 1);
          const firstEpisode = season1Episodes.find(ep => ep.episode_number === 1);
          if (firstEpisode) {
            await playVideo(item, firstEpisode, 1, 1, null, externalPlayer);
          }
        } catch (error) {
          console.error('Error fetching S01E01:', error);
        }
      }
    } else {
      // For movies
      const resumePosition = watchProgress ? watchProgress.position : null;
      await playVideo(item, null, null, null, resumePosition, externalPlayer);
    }
  };

  const playVideo = async (item, episode, season, episodeNumber, resumePosition, externalPlayer) => {
    // If external player is selected and not Default, fetch stream URL and open in external player
    if (externalPlayer && externalPlayer !== 'Default') {
      try {
        // Show loading indicator
        const source = await StorageService.getVideoSource();
        const service = source === 'n3tflix' ? N3tflixService : VixsrcService;
        
        let result = null;
        if (episode && season && episodeNumber) {
          result = await service.fetchEpisodeWithSubtitles(item.id, season, episodeNumber);
        } else {
          result = await service.fetchMovieWithSubtitles(item.id);
        }
        
        if (result && result.streamUrl) {
          // Try to open in external player
          const opened = await openInExternalPlayer(result.streamUrl, externalPlayer);
          
          // If failed to open external player, fall back to default player
          if (!opened) {
            // Fall back to default player
            if (episode) {
              navigation.navigate('VideoPlayer', {
                item,
                episode,
                season,
                episodeNumber,
                resumePosition,
              });
            } else {
              navigation.navigate('VideoPlayer', {
                item,
                resumePosition,
              });
            }
          }
        } else {
          Alert.alert('Error', 'Failed to fetch stream URL. Using default player.');
          // Fall back to default player
          if (episode) {
            navigation.navigate('VideoPlayer', {
              item,
              episode,
              season,
              episodeNumber,
              resumePosition,
            });
          } else {
            navigation.navigate('VideoPlayer', {
              item,
              resumePosition,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching stream for external player:', error);
        Alert.alert('Error', 'Failed to open external player. Using default player.');
        // Fall back to default player
        if (episode) {
          navigation.navigate('VideoPlayer', {
            item,
            episode,
            season,
            episodeNumber,
            resumePosition,
          });
        } else {
          navigation.navigate('VideoPlayer', {
            item,
            resumePosition,
          });
        }
      }
    } else {
      // Use default player
      if (episode) {
        navigation.navigate('VideoPlayer', {
          item,
          episode,
          season,
          episodeNumber,
          resumePosition,
        });
      } else {
        navigation.navigate('VideoPlayer', {
          item,
          resumePosition,
        });
      }
    }
  };

  const handleBookmark = async () => {
    if (!item) return;
    
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    
    if (isBookmarked) {
      // Remove bookmark
      const success = await StorageService.removeBookmark(item.id, mediaType);
      if (success) {
        setIsBookmarked(false);
      }
    } else {
      // Add to bookmarks
      const success = await StorageService.saveBookmark(item);
      if (success) {
        setIsBookmarked(true);
      }
    }
  };

  const handleAddToCollection = () => {
    if (!item) return;
    // Show collection picker to add to collection
    setShowCollectionPicker(true);
  };

  const handleItemAddedToCollection = (collection) => {
    // Update UI to show item is in collection
    setIsInCollection(true);
    console.log('Item added to collection:', collection.name);
  };

  const handleEpisodeDownload = async (episode) => {
    if (!item || !episode || !item.id) return;
    
    const episodeNumber = episode.episode_number;
    const episodeKey = `s${selectedSeason}_e${episodeNumber}`;
    
    // Check if already downloaded
    const isDownloaded = await VideoDownloadService.isEpisodeDownloaded(
      item.id,
      selectedSeason,
      episodeNumber
    );
    
    if (isDownloaded) {
      Alert.alert(
        'Already Downloaded',
        `Episode ${episodeNumber} is already downloaded. You can watch it offline.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Check if currently downloading
    const activeDownloads = VideoDownloadService.getActiveDownloads();
    const isDownloading = activeDownloads.some(
      d => d.mediaId === item.id &&
           d.mediaType === 'tv' &&
           d.season === selectedSeason &&
           d.episodeNumber === episodeNumber
    );
    
    if (isDownloading) {
      Alert.alert(
        'Already Downloading',
        `Episode ${episodeNumber} is currently being downloaded.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Confirm download
    Alert.alert(
      'Download Episode',
      `Download "${episode.name || `Episode ${episodeNumber}`}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            try {
              // Update download status
              const newStatus = { ...episodeDownloadStatus };
              newStatus[episodeKey] = {
                isDownloaded: false,
                isDownloading: true,
                progress: 0,
              };
              setEpisodeDownloadStatus(newStatus);
              
              // Start download - progress updates will be handled by polling activeDownloads
              // The progress callback is optional since we're polling activeDownloads every second
              await VideoDownloadService.downloadEpisode(
                item,
                episode,
                selectedSeason,
                (progress) => {
                  // Update progress in real-time (optional, polling also handles this)
                  const updatedStatus = { ...episodeDownloadStatus };
                  updatedStatus[episodeKey] = {
                    isDownloaded: false,
                    isDownloading: true,
                    progress: progress,
                  };
                  setEpisodeDownloadStatus(updatedStatus);
                }
              );
              
              // Download completed - refresh status
              await checkEpisodeDownloadStatuses();
              Alert.alert('Success', 'Episode downloaded successfully!');
            } catch (error) {
              console.error('Error downloading episode:', error);
              // Update status to not downloading
              await checkEpisodeDownloadStatuses();
              Alert.alert('Error', `Failed to download episode: ${error.message}`);
            }
          },
        },
      ]
    );
  };

  const headerTranslateY = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [150, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [1.3, 0.75],
    extrapolate: 'clamp',
  });

  // Compensate for scale to keep center anchor point
  // When scaling from top-left, center moves down, so we translate up to compensate
  const containerHeight = FEATURED_HEIGHT + 150;
  const headerScaleCompensation = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [
      -(containerHeight * (1.3 - 0.75)) / 2,
      0
    ],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: darkenedColor }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: darkenedColor }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Backdrop and Title Section */}
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.backdropContainer,
              {
                transform: [
                  { translateY: Animated.add(headerTranslateY, headerScaleCompensation) },
                  { scale: headerScale },
                ],
              },
            ]}
          >
            {backdropUrl || posterUrl ? (
              <CachedImage
                source={{ uri: backdropUrl || posterUrl }}
                style={styles.backdrop}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.backdrop, styles.placeholder]} />
            )}
          </Animated.View>
          
          {/* Gradient fade to darkened color at bottom */}
          <LinearGradient
            colors={[
              'transparent', 
              'transparent', 
              hexToRgba(darkenedColor, 0.25), 
              hexToRgba(darkenedColor, 0.8), 
              darkenedColor, 
              darkenedColor
            ]}
            locations={[0, 0.2, 0.5, 0.85, 0.95, 1]}
            style={styles.gradient}
          />

          {/* Title Section */}
          <View style={styles.titleContainer}>
            {logoUrl ? (
              <CachedImage
                source={{ uri: logoUrl }}
                style={styles.titleLogo}
                resizeMode="contain"
              />
            ) : (
              !loadingLogo && (
                <Text style={styles.title}>{displayTitle}</Text>
              )
            )}
          </View>

          {/* Date and Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              {/* Rating */}
              {rating > 0 && (
                <View style={styles.infoItem}>
                  <Ionicons name="star" size={16} color="#ffd700" style={{ marginRight: 4 }} />
                  <Text style={styles.infoText}>{rating.toFixed(1)}</Text>
                </View>
              )}
              
              {/* Date */}
              {formattedDate && (
                <View style={styles.infoItem}>
                  <Ionicons name="calendar" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.infoText}>{formattedDate}</Text>
                </View>
              )}
            </View>
            
            {/* Genres */}
            {genres.length > 0 && (
              <View style={styles.genresContainer}>
                {genres.map((genre, index) => (
                  <View key={index} style={styles.genreChip}>
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={[styles.contentSection, { backgroundColor: darkenedColor }]}>
          {/* Play and Bookmark Section */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlay}
              activeOpacity={0.8}
            >
              <Ionicons name={playButtonInfo.icon} size={20} color="#000" />
              <Text style={styles.playButtonText}>
                {playButtonInfo.text}
              </Text>
            </TouchableOpacity>

            {/* Download Button - Only show for movies */}
            {isMovie ? (
              <TouchableOpacity
                style={[
                  styles.downloadButton,
                  { marginLeft: 12 },
                  isDownloaded && styles.downloadButtonActive,
                  isDownloading && styles.downloadButtonDownloading,
                ]}
                onPress={handleDownload}
                activeOpacity={0.8}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <View style={styles.downloadButtonContent}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.downloadButtonText}>
                      {Math.round(downloadProgress * 100)}%
                    </Text>
                  </View>
                ) : (
                  <Ionicons
                    name={isDownloaded ? 'checkmark-circle' : 'download-outline'}
                    size={24}
                    color={isDownloaded ? '#000' : '#fff'}
                  />
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.bookmarkButton,
                { marginLeft: 12 },
                isBookmarked && styles.bookmarkButtonActive,
              ]}
              onPress={handleBookmark}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={isBookmarked ? '#000' : '#fff'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.collectionButton,
                { marginLeft: 12 },
                isInCollection && styles.collectionButtonActive,
              ]}
              onPress={handleAddToCollection}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isInCollection ? 'checkmark' : 'add'}
                size={24}
                color={isInCollection ? '#000' : '#fff'}
              />
            </TouchableOpacity>
          </View>

          {/* Plot/Story Section */}
          {overview && overview.trim().length > 0 && (
            <View style={styles.plotSection}>
              <Text style={styles.plotTitle}>Story</Text>
              <Text 
                style={styles.plotText}
                numberOfLines={isPlotExpanded ? undefined : 4}
              >
                {overview}
              </Text>
              {overview.length > 150 && (
                <TouchableOpacity
                  onPress={() => setIsPlotExpanded(!isPlotExpanded)}
                  style={styles.plotToggleButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.plotToggleText}>
                    {isPlotExpanded ? 'Show Less' : 'Show More'}
                  </Text>
                  <Ionicons 
                    name={isPlotExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color="rgba(255, 255, 255, 0.7)" 
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Movie Info Panel - Only for movies */}
          {isMovie && (
            <View style={styles.movieInfoPanel}>
              <View style={styles.movieInfoRow}>
                {/* Runtime */}
                {(() => {
                  const runtime = movieDetails?.runtime || item?.runtime;
                  return runtime ? (
                    <View style={styles.movieInfoItem}>
                      <Ionicons name="time-outline" size={18} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.movieInfoText}>
                        {runtime} min
                      </Text>
                    </View>
                  ) : null;
                })()}
                
                {/* Release Date */}
                {formattedDate && (
                  <View style={styles.movieInfoItem}>
                    <Ionicons name="calendar-outline" size={18} color="rgba(255, 255, 255, 0.7)" />
                    <Text style={styles.movieInfoText}>{formattedDate}</Text>
                  </View>
                )}
                
                {/* Age Rating */}
                {(() => {
                  let certification = null;
                  if (movieDetails?.release_dates?.results) {
                    // Try to get US certification first
                    const usRelease = movieDetails.release_dates.results.find(r => r.iso_3166_1 === 'US');
                    if (usRelease?.release_dates?.[0]?.certification) {
                      certification = usRelease.release_dates[0].certification;
                    } else if (movieDetails.release_dates.results[0]?.release_dates?.[0]?.certification) {
                      // Fallback to first available certification
                      certification = movieDetails.release_dates.results[0].release_dates[0].certification;
                    }
                  }
                  return certification ? (
                    <View style={styles.movieInfoItem}>
                      <Ionicons name="shield-outline" size={18} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.movieInfoText}>{certification}</Text>
                    </View>
                  ) : null;
                })()}
              </View>
              
              {/* Genres */}
              {genres.length > 0 && (
                <View style={styles.movieInfoGenres}>
                  <Ionicons name="film-outline" size={18} color="rgba(255, 255, 255, 0.7)" style={{ marginRight: 8 }} />
                  <View style={styles.movieInfoGenresList}>
                    {genres.map((genre, index) => (
                      <Text key={index} style={styles.movieInfoGenreText}>
                        {genre}{index < genres.length - 1 ? ' • ' : ''}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Tagline */}
              {(() => {
                const tagline = movieDetails?.tagline || item?.tagline;
                return tagline ? (
                  <View style={styles.movieInfoTagline}>
                    <Text style={styles.movieInfoTaglineText}>"{tagline}"</Text>
                  </View>
                ) : null;
              })()}
            </View>
          )}

          {/* Trailer Section */}
          {trailer && (
            <View style={styles.trailerSection}>
              <Text style={styles.trailerTitle}>Trailer</Text>
              <TouchableOpacity
                style={styles.trailerContainer}
                onPress={handleTrailerPress}
                activeOpacity={0.8}
              >
                <View style={styles.trailerThumbnailContainer}>
                  <CachedImage
                    source={{ 
                      uri: `https://img.youtube.com/vi/${trailer.key}/maxresdefault.jpg` 
                    }}
                    style={styles.trailerThumbnail}
                    resizeMode="cover"
                  />
                  <View style={styles.trailerPlayOverlay}>
                    <View style={styles.trailerPlayButton}>
                      <Ionicons name="play" size={32} color="#fff" />
                    </View>
                  </View>
                </View>
                <View style={styles.trailerInfo}>
                  <Text style={styles.trailerName}>
                    {trailer.name || 'Watch Trailer'}
                  </Text>
                  <Text style={styles.trailerType}>
                    {trailer.type}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Episodes Section for TV Shows */}
          {isTVShow && (
            <View style={styles.episodesSection}>
              <View style={styles.episodesHeader}>
                <Text style={styles.episodesTitle}>Episodes</Text>
                {seasons.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.seasonSlider}
                    contentContainerStyle={styles.seasonSliderContent}
                  >
                    {seasons.map((season, index) => {
                      const seasonPosterUrl = TMDBService.getPosterURL(season.poster_path, 'w500');
                      const isSelected = selectedSeason === season.season_number;
                      return (
                        <TouchableOpacity
                          key={season.season_number}
                          style={[
                            styles.seasonCard,
                            isSelected && styles.seasonCardActive,
                            index > 0 && { marginLeft: 12 },
                          ]}
                          onPress={() => setSelectedSeason(season.season_number)}
                          activeOpacity={0.8}
                        >
                          <View style={[
                            styles.seasonPosterContainer,
                            isSelected && styles.seasonPosterContainerActive,
                          ]}>
                            {seasonPosterUrl ? (
                              <CachedImage
                                source={{ uri: seasonPosterUrl }}
                                style={styles.seasonPoster}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={[styles.seasonPoster, styles.seasonPlaceholder]}>
                                <Text style={styles.seasonPlaceholderText}>No Image</Text>
                              </View>
                            )}
                            {isSelected && (
                              <View style={styles.seasonSelectedOverlay}>
                                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                              </View>
                            )}
                          </View>
                          <Text style={[styles.seasonCardText, isSelected && styles.seasonCardTextActive]}>
                            Season {season.season_number}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {loadingEpisodes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>Loading episodes...</Text>
                </View>
              ) : episodes.length > 0 ? (
                <View style={styles.episodesList}>
                  {episodes.map((episode) => {
                    const episodeNumber = episode.episode_number;
                    const episodeKey = `s${selectedSeason}_e${episodeNumber}`;
                    const downloadStatus = episodeDownloadStatus[episodeKey] || { isDownloaded: false, isDownloading: false, progress: 0 };
                    
                    return (
                      <EpisodeItem
                        key={episode.id}
                        episode={episode}
                        tvShow={item}
                        season={selectedSeason}
                        onPress={handleEpisodePress}
                        progress={episodeProgress[episodeNumber] || null}
                        isDownloaded={downloadStatus.isDownloaded}
                        isDownloading={downloadStatus.isDownloading}
                        downloadProgress={downloadStatus.progress}
                        onDownloadPress={handleEpisodeDownload}
                      />
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No episodes available</Text>
                </View>
              )}
            </View>
          )}

          {/* Cast Section */}
          <View style={styles.castSection}>
            <Text style={styles.castTitle}>Cast</Text>
            {loadingCast ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : cast.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.castSlider}
                contentContainerStyle={styles.castSliderContent}
              >
                {cast.map((castMember) => (
                  <CastMember
                    key={castMember.id}
                    castMember={castMember}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No cast information available</Text>
              </View>
            )}
          </View>

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsTitle}>Reviews</Text>
            {loadingReviews ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Loading reviews...</Text>
              </View>
            ) : reviews.length > 0 ? (
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No reviews available</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Navigation Overlay */}
      <View style={[styles.navOverlay, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Collection Picker Modal */}
      <CollectionPickerModal
        visible={showCollectionPicker}
        onClose={() => setShowCollectionPicker(false)}
        item={item}
        onItemAdded={handleItemAddedToCollection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Will be overridden dynamically
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    backgroundColor: '#000', // Will be overridden dynamically
  },
  heroSection: {
    width: SCREEN_WIDTH,
    height: FEATURED_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  backdropContainer: {
    width: SCREEN_WIDTH * 1.33,
    height: FEATURED_HEIGHT + 150,
    position: 'absolute',
    top: -75,
    left: -SCREEN_WIDTH * 0.165,
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FEATURED_HEIGHT,
    zIndex: 1,
    width: SCREEN_WIDTH,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    textAlign: 'center',
  },
  titleLogo: {
    width: '70%',
    height: 120,
    maxWidth: 400,
    alignSelf: 'center',
  },
  infoSection: {
    position: 'absolute',
    bottom: -10,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  genreChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  genreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  synopsisContainer: {
    width: '100%',
    marginTop: 8,
  },
  synopsisWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  synopsis: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  synopsisFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1,
  },
  moreButton: {
    alignSelf: 'center',
    marginTop: 4,
  },
  moreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  contentSection: {
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#000', // Will be overridden dynamically
    position: 'relative',
    marginTop: -20,
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    justifyContent: 'center',
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 6,
  },
  downloadButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  downloadButtonDownloading: {
    backgroundColor: 'rgba(0, 150, 255, 0.5)',
    borderColor: '#0096ff',
  },
  downloadButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    marginTop: 2,
  },
  bookmarkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  collectionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  navOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginTop: 8,
  },
  episodesSection: {
    marginTop: 24,
  },
  episodesHeader: {
    marginBottom: 16,
  },
  episodesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  seasonSlider: {
    marginTop: 12,
    marginBottom: 4,
  },
  seasonSliderContent: {
    paddingRight: 16,
  },
  seasonCard: {
    width: 120,
    alignItems: 'center',
  },
  seasonCardActive: {
    opacity: 1,
  },
  seasonPosterContainer: {
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  seasonPosterContainerActive: {
    borderColor: '#fff',
  },
  seasonPoster: {
    width: '100%',
    height: '100%',
  },
  seasonPlaceholder: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonPlaceholderText: {
    color: '#666',
    fontSize: 12,
  },
  seasonSelectedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  seasonCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  seasonCardTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  episodesList: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  castSection: {
    marginTop: 32,
  },
  castTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  castSlider: {
    marginTop: 0,
  },
  castSliderContent: {
    paddingRight: 16,
  },
  reviewsSection: {
    marginTop: 32,
  },
  reviewsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  reviewsList: {
    marginTop: 0,
  },
  plotSection: {
    marginTop: 32,
  },
  plotTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  plotText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
    textAlign: 'left',
  },
  plotToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  plotToggleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  trailerSection: {
    marginTop: 32,
  },
  trailerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  trailerContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  trailerThumbnailContainer: {
    width: 200,
    height: 112,
    position: 'relative',
  },
  trailerThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  trailerPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  trailerPlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  trailerInfo: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  trailerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  trailerType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  movieInfoPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 32,
    marginBottom: 0,
  },
  movieInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 12,
  },
  movieInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 8,
  },
  movieInfoText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
  },
  movieInfoGenres: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  movieInfoGenresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  movieInfoGenreText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  movieInfoTagline: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  movieInfoTaglineText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
});

