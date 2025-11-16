import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { TMDBService } from '../services/TMDBService';
import { VixsrcService } from '../services/VixsrcService';
import { N3tflixService } from '../services/N3tflixService';
import { WatchProgressService } from '../services/WatchProgressService';
import { StorageService } from '../services/StorageService';
import { CachedImage } from '../components/CachedImage';
import { EpisodeItem } from '../components/EpisodeItem';
import { useVideoPlayerContext } from '../contexts/VideoPlayerContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_WIDTH * 0.5625; // 16:9 aspect ratio

export default function EpisodePage({ route, navigation }) {
  const { item: routeItem, episode: routeEpisode, season: routeSeason, episodeNumber: routeEpisodeNumber, resumePosition: routeResumePosition } = route.params || {};
  const insets = useSafeAreaInsets();
  
  // Use shared player context
  const {
    player,
    streamUrl,
    setStreamUrl,
    isPlaying,
    setIsPlaying,
    position,
    duration,
    item: contextItem,
    episode: contextEpisode,
    initializePlayer,
    play,
    pause,
    positionRef,
    transitionAnim,
    animateToMinimized,
  } = useVideoPlayerContext();
  
  // Use route params or context values
  const item = routeItem || contextItem;
  const episode = routeEpisode || contextEpisode;
  const season = routeSeason;
  const episodeNumber = routeEpisodeNumber;
  const resumePosition = routeResumePosition || 0;
  
  // Local state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Episode/Movie data
  const [episodeDetails, setEpisodeDetails] = useState(episode);
  const [tvDetails, setTvDetails] = useState(null);
  const [movieDetails, setMovieDetails] = useState(null);
  const [nextEpisode, setNextEpisode] = useState(null);
  const [allEpisodes, setAllEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [watchProgress, setWatchProgress] = useState(null);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const isFocused = useIsFocused(); // Track if this screen is focused
  
  // UI state management
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimeoutRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const [uiIsPlaying, setUiIsPlaying] = useState(false);
  const lastPlayerStateRef = useRef(false);

  // Track actual player state
  useEffect(() => {
    if (!player) return;
    
    const interval = setInterval(() => {
      if (player) {
        // Use player.playing instead of player.paused (which might be undefined)
        const actuallyPlaying = player.playing === true;
        if (lastPlayerStateRef.current !== actuallyPlaying) {
          setUiIsPlaying(actuallyPlaying);
          lastPlayerStateRef.current = actuallyPlaying;
        }
      }
    }, 200);
    
    return () => clearInterval(interval);
  }, [player]);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (!streamUrl || !player) return;
    
    // Show controls when user interacts
    const showControlsWithTimeout = () => {
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // Clear existing timeout
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      // Hide after 3 seconds
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, 3000);
    };
    
    // Show controls initially
    showControlsWithTimeout();
    
    // Show controls when video is tapped
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [streamUrl, player, controlsOpacity]);

  // Determine if this is a movie or TV show
  const isMovie = !episode && (item?.title || item?.media_type === 'movie');
  const isTVShow = !isMovie;

  // Initialize player when route params change
  useEffect(() => {
    if (item && (streamUrl || routeItem)) {
      // Only initialize if we have new route params
      if (routeItem) {
        const fetchAndInitialize = async () => {
          setLoading(true);
          setError(null);
          
          try {
            const source = await StorageService.getVideoSource();
            const service = source === 'n3tflix' ? N3tflixService : VixsrcService;
            
            let result = null;
            if (isMovie) {
              result = await service.fetchMovieWithSubtitles(item.id);
            } else if (episode) {
              result = await service.fetchEpisodeWithSubtitles(item.id, season, episodeNumber);
            }
            
            if (result && result.streamUrl) {
              // Initialize the shared player
              initializePlayer({
                item,
                episode: episode || null,
                season: season || null,
                episodeNumber: episodeNumber || null,
                resumePosition: resumePosition || 0,
                streamUrl: result.streamUrl,
              });
              setStreamUrl(result.streamUrl);
            } else {
              setError('Failed to fetch stream URL');
            }
          } catch (err) {
            console.error('Error fetching stream:', err);
            setError('Failed to load video');
          } finally {
            setLoading(false);
          }
        };
        
        fetchAndInitialize();
      }
    }
  }, [routeItem?.id, routeEpisode?.id, routeSeason, routeEpisodeNumber]);

  // Update loading state based on player status
  useEffect(() => {
    if (player && streamUrl) {
      const checkStatus = setInterval(() => {
        if (player.duration > 0) {
          setLoading(false);
        } else if (player.status === 'error') {
          setError('Failed to load video');
          setLoading(false);
        }
      }, 100);
      
      return () => clearInterval(checkStatus);
    }
  }, [player, streamUrl]);

  // Player is configured in context, no need to configure here

  // Save progress periodically (progress is tracked in context)
  useEffect(() => {
    if (!player || !item) return;
    
    const interval = setInterval(() => {
      if (position > 0 && duration > 0 && Math.floor(position / 1000) % 5 === 0) {
        const progress = {
          position: position,
          duration: duration,
          progress: position / duration,
        };
        
        if (isMovie) {
          WatchProgressService.saveProgress(
            item.id,
            'movie',
            null,
            null,
            progress
          );
        } else if (episode) {
          WatchProgressService.saveProgress(
            item.id,
            'tv',
            season,
            episodeNumber,
            progress
          );
        }
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [player, item, episode, season, episodeNumber, isMovie, position, duration]);

  // Fetch TV show details and episodes (only for TV shows)
  useEffect(() => {
    const fetchData = async () => {
      if (!item || !item.id) return;
      
      if (isMovie) {
        // Fetch movie details
        try {
          const response = await fetch(
            `https://api.themoviedb.org/3/movie/${item.id}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
          );
          const movieData = await response.json();
          setMovieDetails(movieData);
        } catch (error) {
          console.error('Error fetching movie details:', error);
        }
      } else {
        // Fetch TV details
        try {
          const response = await fetch(
            `https://api.themoviedb.org/3/tv/${item.id}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
          );
          const tvData = await response.json();
          setTvDetails(tvData);
          
          // Only fetch episodes if we have a season and episode number
          if (season && episodeNumber) {
            // Fetch season episodes
            const seasonResponse = await fetch(
              `https://api.themoviedb.org/3/tv/${item.id}/season/${season}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
            );
            const seasonData = await seasonResponse.json();
            
            if (seasonData.episodes) {
              setAllEpisodes(seasonData.episodes);
              
              // Find current episode details
              const currentEp = seasonData.episodes.find(ep => ep.episode_number === episodeNumber);
              if (currentEp) {
                setEpisodeDetails(currentEp);
              }
              
              // Find next episode
              const nextEp = seasonData.episodes.find(ep => ep.episode_number === episodeNumber + 1);
              if (nextEp) {
                setNextEpisode(nextEp);
              } else {
                // Check next season
                if (seasonData.season_number < tvData.number_of_seasons) {
                  const nextSeasonResponse = await fetch(
                    `https://api.themoviedb.org/3/tv/${item.id}/season/${season + 1}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
                  );
                  const nextSeasonData = await nextSeasonResponse.json();
                  if (nextSeasonData.episodes && nextSeasonData.episodes.length > 0) {
                    setNextEpisode({ ...nextSeasonData.episodes[0], season_number: season + 1 });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching TV details:', error);
        }
      }
    };
    
    fetchData();
  }, [item, season, episodeNumber, isMovie]);

  // Fetch recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!item || !item.id) return;
      
      setLoadingRecommendations(true);
      try {
        const mediaType = isMovie ? 'movie' : 'tv';
        const response = await fetch(
          `https://api.themoviedb.org/3/${mediaType}/${item.id}/recommendations?api_key=738b4edd0a156cc126dc4a4b8aea4aca&page=1`
        );
        const data = await response.json();
        setRecommendations(data.results?.slice(0, 10) || []);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    
    fetchRecommendations();
  }, [item, isMovie]);

  // Load watch progress
  useEffect(() => {
    const loadProgress = async () => {
      if (!item) return;
      
      try {
        let progress = null;
        if (isMovie) {
          progress = await WatchProgressService.getProgress(
            item.id,
            'movie',
            null,
            null
          );
        } else if (episode) {
          progress = await WatchProgressService.getProgress(
            item.id,
            'tv',
            season,
            episodeNumber
          );
        }
        setWatchProgress(progress);
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    };
    
    loadProgress();
  }, [item, episode, season, episodeNumber, isMovie]);

  const handlePlayPause = async () => {
    if (!player) return;
    
    try {
      // Get current state - use player.playing instead of player.paused
      // player.paused might be undefined, but player.playing is reliable
      const currentlyPlaying = player.playing === true;
      
      // Toggle play/pause
      if (currentlyPlaying) {
        player.pause();
        setUiIsPlaying(false);
      } else {
        // Force play - clear any blocking states
        try {
          // Ensure player is not muted and has volume
          if (player.muted) {
            player.muted = false;
          }
          if (player.volume === 0) {
            player.volume = 1.0;
          }
          
          // Call play and wait for it
          const playPromise = player.play();
          
          if (playPromise !== undefined) {
            await playPromise;
          }
          
          // Give it a moment to start
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Check if it actually started playing
          if (player.playing === true) {
            setUiIsPlaying(true);
          } else {
            // Retry
            setTimeout(async () => {
              try {
                if (player) {
                  await player.play();
                  await new Promise(resolve => setTimeout(resolve, 100));
                  setUiIsPlaying(player.playing === true);
                }
              } catch (retryError) {
                setUiIsPlaying(player.playing === true);
              }
            }, 300);
          }
        } catch (playError) {
          // Try one more time with a delay
          setTimeout(async () => {
            try {
              if (player) {
                await player.play();
                await new Promise(resolve => setTimeout(resolve, 100));
                setUiIsPlaying(player.playing === true);
              }
            } catch (retryError) {
              setUiIsPlaying(player.playing === true);
            }
          }, 300);
        }
      }
      
      // Show controls
      resetControlsTimeout();
    } catch (error) {
      // Update UI based on actual state
      setTimeout(() => {
        if (player) {
          setUiIsPlaying(player.playing === true);
        }
      }, 200);
    }
  };
  
  const resetControlsTimeout = () => {
    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, 3000);
  };
  
  const handleVideoTap = () => {
    // Toggle controls visibility
    if (showControls) {
      setShowControls(false);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimeout();
    }
  };

  const handleFullScreen = () => {
    // Animate to fullscreen before navigating
    // The animation will continue in VideoPlayerScreen
    navigation.navigate('VideoPlayer', {
      item,
      episode: episode || undefined,
      season: season || undefined,
      episodeNumber: episodeNumber || undefined,
      fromEpisodePage: true,
    });
  };
  
  // Animate to minimized when screen comes into focus (coming back from fullscreen)
  useFocusEffect(
    React.useCallback(() => {
      if (isFocused && streamUrl) {
        animateToMinimized();
      }
    }, [isFocused, streamUrl])
  );

  const handleNextEpisode = async () => {
    if (!nextEpisode) return;
    
    const nextEpNumber = nextEpisode.episode_number || nextEpisode.episodeNumber;
    const nextSeason = nextEpisode.season_number || season;
    
    // Load progress for next episode
    let resumePos = null;
    try {
      const progress = await WatchProgressService.getProgress(
        item.id,
        'tv',
        nextSeason,
        nextEpNumber
      );
      if (progress) {
        resumePos = progress.position;
      }
    } catch (error) {
      console.error('Error loading next episode progress:', error);
    }
    
    navigation.replace('EpisodePage', {
      item,
      episode: nextEpisode,
      season: nextSeason,
      episodeNumber: nextEpNumber,
      resumePosition: resumePos,
    });
  };

  const handleRecommendationPress = (recommendedItem) => {
    navigation.navigate('MovieDetails', { item: recommendedItem });
  };

  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 && position > 0 ? (position / duration) * 100 : 0;

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No content data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Minimized Video Player */}
        <View style={styles.videoContainer}>
          {loading && !streamUrl ? (
            <View style={[styles.videoPlaceholder, { height: VIDEO_HEIGHT }]}>
              {item?.backdrop_path ? (
                <>
                  <CachedImage
                    source={{ uri: TMDBService.getBackdropURL(item.backdrop_path, 'w1280') }}
                    style={styles.backdropImage}
                  />
                  <View style={styles.backdropOverlay} />
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Loading video...</Text>
                  </View>
                </>
              ) : (
                <>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>Loading video...</Text>
                </>
              )}
            </View>
          ) : error ? (
            <View style={[styles.videoPlaceholder, { height: VIDEO_HEIGHT }]}>
              <Ionicons name="alert-circle" size={48} color="#ff3b30" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : streamUrl && player && isFocused ? (
            <Animated.View 
              style={[
                styles.videoWrapper,
                {
                  opacity: transitionAnim.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [1, 0.9, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      scale: transitionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.1],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      translateY: transitionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -20],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              <VideoView
                player={player}
                style={[styles.video, { height: VIDEO_HEIGHT }]}
                contentFit="contain"
                nativeControls={false}
                allowsFullscreen={false}
              />
              
              {/* Custom Controls Overlay */}
              <TouchableOpacity
                style={styles.videoOverlay}
                activeOpacity={1}
                onPress={handleVideoTap}
              >
                {/* Loading Indicator */}
                {loading && (
                  <View style={styles.loadingIndicator}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
                
                {/* Play/Pause Button - Always visible, fades with controls */}
                <Animated.View
                  style={[
                    styles.playButtonContainer,
                    {
                      opacity: controlsOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.9],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                  pointerEvents={showControls ? 'auto' : 'none'}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handlePlayPause}
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                  >
                    <BlurView intensity={80} tint="dark" style={styles.playButton}>
                      <Ionicons 
                        name={uiIsPlaying ? "pause" : "play"} 
                        size={32} 
                        color="#fff" 
                      />
                    </BlurView>
                  </TouchableOpacity>
                </Animated.View>
              </TouchableOpacity>
              
              {/* Progress Bar */}
              <Animated.View 
                style={[
                  styles.progressBarContainer,
                  {
                    opacity: controlsOpacity,
                  },
                ]}
              >
                <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
              </Animated.View>
              
              {/* Time and Fullscreen */}
              <Animated.View 
                style={[
                  styles.videoControls,
                  {
                    opacity: controlsOpacity,
                  },
                ]}
                pointerEvents={showControls ? 'auto' : 'none'}
              >
                <Text style={styles.timeText}>
                  {formatTime(position)} / {formatTime(duration)}
                </Text>
                <TouchableOpacity onPress={handleFullScreen} style={styles.fullscreenButton}>
                  <Ionicons name="expand" size={20} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>

        {/* Episode/Movie Info Section */}
        <View style={styles.contentContainer}>
          <View style={styles.episodeInfo}>
            {isMovie ? (
              <>
                <Text style={styles.episodeNumber}>Movie</Text>
                <Text style={styles.episodeTitle}>
                  {item.title || item.name}
                </Text>
                {(movieDetails?.overview || item.overview) ? (
                  <Text style={styles.episodeDescription}>
                    {movieDetails?.overview || item.overview}
                  </Text>
                ) : null}
                {(movieDetails?.release_date || item.release_date) ? (
                  <Text style={styles.airDate}>
                    Released {new Date(movieDetails?.release_date || item.release_date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.episodeNumber}>
                  Episode {episodeNumber} • Season {season}
                </Text>
                <Text style={styles.episodeTitle}>
                  {episodeDetails?.name || episode?.name || `Episode ${episodeNumber}`}
                </Text>
                {episodeDetails?.overview || episode?.overview ? (
                  <Text style={styles.episodeDescription}>
                    {episodeDetails?.overview || episode?.overview}
                  </Text>
                ) : null}
                {episodeDetails?.air_date || episode?.air_date ? (
                  <Text style={styles.airDate}>
                    Aired {new Date(episodeDetails?.air_date || episode?.air_date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          {/* Streaming Provider Section (Channel-like) */}
          <TouchableOpacity 
            style={styles.providerSection}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MovieDetails', { item })}
          >
            <View style={styles.providerHeader}>
              {item.poster_path ? (
                <CachedImage
                  source={{ uri: TMDBService.getPosterURL(item.poster_path, 'w154') }}
                  style={styles.providerAvatar}
                />
              ) : (
                <View style={[styles.providerAvatar, styles.providerAvatarPlaceholder]}>
                  <Ionicons name={isMovie ? "film" : "tv"} size={24} color="#666" />
                </View>
              )}
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{item.name || item.title}</Text>
                {isMovie ? (
                  <Text style={styles.providerSubscribers}>
                    {movieDetails?.release_date ? new Date(movieDetails.release_date).getFullYear() : item.release_date ? new Date(item.release_date).getFullYear() : ''}
                    {movieDetails?.runtime ? ` • ${movieDetails.runtime} min` : item.runtime ? ` • ${item.runtime} min` : ''}
                  </Text>
                ) : (
                  <Text style={styles.providerSubscribers}>
                    {tvDetails?.number_of_seasons || 0} Seasons • {tvDetails?.number_of_episodes || 0} Episodes
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.6)" />
            </View>
          </TouchableOpacity>

          {/* Next Episode Section (only for TV shows) */}
          {!isMovie && nextEpisode && (
            <View style={styles.nextEpisodeSection}>
              <Text style={styles.sectionTitle}>Next Episode</Text>
              <TouchableOpacity
                style={styles.nextEpisodeCard}
                activeOpacity={0.7}
                onPress={handleNextEpisode}
              >
                <View style={styles.nextEpisodeThumbnail}>
                  {nextEpisode.still_path ? (
                    <CachedImage
                      source={{ uri: TMDBService.getStillURL(nextEpisode.still_path) }}
                      style={styles.nextEpisodeImage}
                    />
                  ) : (
                    <View style={[styles.nextEpisodeImage, styles.placeholder]}>
                      <Ionicons name="play-circle" size={32} color="#666" />
                    </View>
                  )}
                  <View style={styles.playIconOverlay}>
                    <Ionicons name="play" size={24} color="#fff" />
                  </View>
                </View>
                <View style={styles.nextEpisodeInfo}>
                  <Text style={styles.nextEpisodeNumber}>
                    Episode {nextEpisode.episode_number || nextEpisode.episodeNumber}
                    {nextEpisode.season_number && nextEpisode.season_number !== season ? ` • Season ${nextEpisode.season_number}` : ''}
                  </Text>
                  <Text style={styles.nextEpisodeTitle} numberOfLines={2}>
                    {nextEpisode.name || `Episode ${nextEpisode.episode_number || nextEpisode.episodeNumber}`}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* You May Also Like Section */}
          {recommendations.length > 0 && (
            <View style={styles.recommendationsSection}>
              <Text style={styles.sectionTitle}>You May Also Like</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendationsList}
              >
                {recommendations.map((rec) => (
                  <TouchableOpacity
                    key={rec.id}
                    style={styles.recommendationCard}
                    activeOpacity={0.7}
                    onPress={() => handleRecommendationPress(rec)}
                  >
                    {rec.poster_path ? (
                      <CachedImage
                        source={{ uri: TMDBService.getPosterURL(rec.poster_path, 'w342') }}
                        style={styles.recommendationImage}
                      />
                    ) : (
                      <View style={[styles.recommendationImage, styles.placeholder]}>
                        <Ionicons name="image" size={24} color="#666" />
                      </View>
                    )}
                    <Text style={styles.recommendationTitle} numberOfLines={2}>
                      {rec.name || rec.title}
                    </Text>
                    {rec.vote_average > 0 && (
                      <View style={styles.ratingContainer}>
                        <Ionicons name="star" size={12} color="#ffd700" />
                        <Text style={styles.ratingText}>{rec.vote_average.toFixed(1)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Header with Back Button */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            opacity: scrollY.interpolate({
              inputRange: [0, 100],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}
        pointerEvents="box-none"
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },
  videoWrapper: {
    position: 'relative',
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },
  video: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    width: SCREEN_WIDTH,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  backdropImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  backdropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#ff3b30',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButtonContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  playButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  videoControls: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  fullscreenButton: {
    padding: 4,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  episodeInfo: {
    marginBottom: 24,
  },
  episodeNumber: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  episodeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  episodeDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
    marginBottom: 12,
  },
  airDate: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  providerSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  providerAvatarPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  providerSubscribers: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  nextEpisodeSection: {
    marginBottom: 32,
  },
  nextEpisodeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nextEpisodeThumbnail: {
    width: 160,
    height: 90,
    position: 'relative',
  },
  nextEpisodeImage: {
    width: '100%',
    height: '100%',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  nextEpisodeInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  nextEpisodeNumber: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 6,
  },
  nextEpisodeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  recommendationsSection: {
    marginBottom: 32,
  },
  recommendationsList: {
    paddingRight: 16,
  },
  recommendationCard: {
    width: 120,
    marginRight: 12,
  },
  recommendationImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 4,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  placeholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 8,
  },
});

