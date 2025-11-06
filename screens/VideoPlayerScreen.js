import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  Animated,
  PanResponder,
  ScrollView,
  Modal,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VixsrcService } from '../services/VixsrcService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VideoPlayerScreen({ route, navigation }) {
  const { item, episode, season, episodeNumber } = route.params || {};
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isControlsLocked, setIsControlsLocked] = useState(false);
  const [isDimmed, setIsDimmed] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeedExpanded, setIsSpeedExpanded] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(null);
  const [isSubtitleExpanded, setIsSubtitleExpanded] = useState(false);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const subtitleCuesRef = useRef([]);
  const controlsTimeoutRef = useRef(null);
  const dimOverlayOpacity = useRef(new Animated.Value(0)).current;
  const speedButtonWidth = useRef(new Animated.Value(42)).current;
  const isSpeedExpandedRef = useRef(false);
  const speedSwipeHandledRef = useRef(false);
  const [isSliderActive, setIsSliderActive] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderProgress = useRef(new Animated.Value(0)).current;
  const sliderHeight = useRef(new Animated.Value(13)).current;
  const [centerControlsWidth, setCenterControlsWidth] = useState(0);
  const [centerControlsHeight, setCenterControlsHeight] = useState(0);
  const [volumeBarWidth, setVolumeBarWidth] = useState(0);
  const volumeBarWidthRef = useRef(0);

  useEffect(() => {
    const lockOrientation = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (error) {
        console.error('Error locking orientation:', error);
      }
    };

    lockOrientation();
    fetchStreamUrl();

    // Auto-hide controls after 3 seconds
    startControlsTimer();

    return () => {
      ScreenOrientation.unlockAsync().catch(err => {
        console.error('Error unlocking orientation:', err);
      });
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Update slider progress when position changes
  useEffect(() => {
    if (!isSliderActive && duration > 0) {
      const progress = position / duration;
      Animated.spring(sliderProgress, {
        toValue: progress,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [position, duration, isSliderActive]);

  // Animate slider height when active
  useEffect(() => {
    Animated.spring(sliderHeight, {
      toValue: isSliderActive ? 18 : 13,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  }, [isSliderActive]);

  // Keep speed expanded ref updated
  useEffect(() => {
    isSpeedExpandedRef.current = isSpeedExpanded;
  }, [isSpeedExpanded]);

  // Collapse speed and subtitle options when controls are hidden
  useEffect(() => {
    if (!showControls) {
      if (isSpeedExpanded) {
        setIsSpeedExpanded(false);
        Animated.spring(speedButtonWidth, {
          toValue: 42,
          useNativeDriver: false,
          tension: 50,
          friction: 7,
        }).start();
      }
      if (isSubtitleExpanded) {
        setIsSubtitleExpanded(false);
      }
    }
  }, [showControls, isSpeedExpanded, isSubtitleExpanded]);

  const startControlsTimer = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (!isControlsLocked && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const resetControlsTimer = () => {
    if (!isControlsLocked) {
      setShowControls(true);
      startControlsTimer();
    }
  };

  const fetchStreamUrl = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!item || !item.id) {
        setError('Invalid item');
        setLoading(false);
        return;
      }

      const tmdbId = item.id;
      let result = null;

      if (episode && season && episodeNumber) {
        result = await VixsrcService.fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber);
      } else {
        result = await VixsrcService.fetchMovieWithSubtitles(tmdbId);
      }

      if (result && result.streamUrl) {
        setStreamUrl(result.streamUrl);
        
        // Set up subtitle tracks
        const tracks = [
          { id: 'none', name: 'Off', language: null, url: null },
          ...result.subtitles,
        ];
        setSubtitleTracks(tracks);
      } else {
        setError('Could not extract video stream URL.');
      }
    } catch (err) {
      console.error('Error fetching stream:', err);
      setError('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  // Load subtitle file and parse it
  const loadSubtitleFile = async (url) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      return parseSRT(text);
    } catch (error) {
      console.error('Error loading subtitle file:', error);
      return [];
    }
  };

  // Parse SRT subtitle format
  const parseSRT = (srtText) => {
    const cues = [];
    const blocks = srtText.trim().split(/\n\s*\n/);
    
    blocks.forEach((block) => {
      const lines = block.trim().split('\n');
      if (lines.length < 3) return;
      
      const timeLine = lines[1];
      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) return;
      
      const startTime = 
        parseInt(timeMatch[1]) * 3600000 +
        parseInt(timeMatch[2]) * 60000 +
        parseInt(timeMatch[3]) * 1000 +
        parseInt(timeMatch[4]);
      
      const endTime = 
        parseInt(timeMatch[5]) * 3600000 +
        parseInt(timeMatch[6]) * 60000 +
        parseInt(timeMatch[7]) * 1000 +
        parseInt(timeMatch[8]);
      
      const text = lines.slice(2).join(' ').replace(/<[^>]+>/g, ''); // Remove HTML tags
      
      cues.push({
        startTime,
        endTime,
        text,
      });
    });
    
    return cues;
  };

  // Update current subtitle text based on position
  useEffect(() => {
    if (selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none' && subtitleCuesRef.current.length > 0) {
      const currentCue = subtitleCuesRef.current.find(
        cue => position >= cue.startTime && position <= cue.endTime
      );
      setCurrentSubtitleText(currentCue ? currentCue.text : '');
    } else {
      setCurrentSubtitleText('');
    }
  }, [position, selectedSubtitleTrack]);

  const handlePlaybackStatus = async (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying || false);
    }
    if (status.isLoaded && status.didJustFinish) {
      navigation.goBack();
    }
  };

  const togglePlayPause = async () => {
    resetControlsTimer();
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
  };

  const seek = async (seconds) => {
    resetControlsTimer();
    if (videoRef.current) {
      const newPosition = Math.max(0, Math.min(position + seconds * 1000, duration));
      await videoRef.current.setPositionAsync(newPosition);
    }
  };

  const seekTo = async (milliseconds) => {
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(milliseconds);
    }
  };

  const sliderDataRef = useRef({ sliderWidth, duration, position });
  
  // Keep refs updated
  useEffect(() => {
    sliderDataRef.current = { sliderWidth, duration, position };
  }, [sliderWidth, duration, position]);

  const handleSliderTouch = (x) => {
    const { sliderWidth: width, duration: dur } = sliderDataRef.current;
    if (width > 0 && dur > 0) {
      const progress = Math.max(0, Math.min(1, x / width));
      const newPosition = progress * dur;
      
      // Update animated value immediately
      sliderProgress.setValue(progress);
      setPosition(newPosition);
      seekTo(newPosition);
    }
  };

  // Create PanResponder for custom slider
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        setIsSliderActive(true);
        handleSliderTouch(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleSliderTouch(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setIsSliderActive(false);
      },
    })
  ).current;

  const skip85 = () => {
    resetControlsTimer();
    seek(85);
  };

  const changePlaybackRate = async (rate, shouldCollapse = true) => {
    resetControlsTimer();
    setPlaybackRate(rate);
    if (videoRef.current) {
      await videoRef.current.setRateAsync(rate, true);
    }
    // Collapse after selection (unless it's a swipe)
    if (shouldCollapse) {
      setIsSpeedExpanded(false);
      Animated.spring(speedButtonWidth, {
        toValue: 42,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
    }
  };

  const toggleSpeedOptions = () => {
    resetControlsTimer();
    const newExpanded = !isSpeedExpanded;
    setIsSpeedExpanded(newExpanded);
    // Collapse subtitle if expanding speed
    if (newExpanded && isSubtitleExpanded) {
      setIsSubtitleExpanded(false);
      Animated.spring(subtitleButtonWidth, {
        toValue: 42,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
    }
    
    // Animate width expansion - calculated to fit all 5 speed options
    // Icon + current speed (60px) + 5 speed options (~32px each) + padding = ~220px
    Animated.spring(speedButtonWidth, {
      toValue: newExpanded ? 220 : 42,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  };

  const toggleSubtitleMenu = () => {
    resetControlsTimer();
    setIsSubtitleExpanded(!isSubtitleExpanded);
  };

  const selectSubtitleTrack = async (track) => {
    resetControlsTimer();
    setSelectedSubtitleTrack(track);
    
    // Load subtitle file if track has URL
    if (track.id === 'none' || !track.url) {
      subtitleCuesRef.current = [];
      setCurrentSubtitleText('');
    } else {
      try {
        const cues = await loadSubtitleFile(track.url);
        subtitleCuesRef.current = cues;
        console.log('Loaded subtitle cues:', cues.length);
      } catch (error) {
        console.error('Error loading subtitle track:', error);
        subtitleCuesRef.current = [];
      }
    }
    
    // Close menu after selection
    setIsSubtitleExpanded(false);
  };

  const handleSpeedSwipe = (dx) => {
    if (!isSpeedExpandedRef.current) return;
    
    resetControlsTimer();
    const currentIndex = playbackRates.indexOf(playbackRate);
    let newIndex = currentIndex;
    
    // Swipe right = increase speed, Swipe left = decrease speed
    if (dx > 30) {
      // Swipe right - next speed
      newIndex = (currentIndex + 1) % playbackRates.length;
    } else if (dx < -30) {
      // Swipe left - previous speed
      newIndex = (currentIndex - 1 + playbackRates.length) % playbackRates.length;
    }
    
    if (newIndex !== currentIndex) {
      changePlaybackRate(playbackRates[newIndex], false); // Don't collapse on swipe
    }
  };

  // Create PanResponder for speed swipe
  const speedPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isSpeedExpandedRef.current,
      onMoveShouldSetPanResponder: () => isSpeedExpandedRef.current,
      onPanResponderGrant: () => {
        speedSwipeHandledRef.current = false;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only trigger once per gesture on significant horizontal movement
        if (!speedSwipeHandledRef.current && Math.abs(gestureState.dx) > 30) {
          speedSwipeHandledRef.current = true;
          handleSpeedSwipe(gestureState.dx);
        }
      },
      onPanResponderRelease: () => {
        speedSwipeHandledRef.current = false;
      },
    })
  ).current;

  const toggleControls = () => {
    if (isControlsLocked) return;
    setShowControls(!showControls);
    if (!showControls) {
      startControlsTimer();
    }
  };

  const toggleLock = () => {
    setIsControlsLocked(!isControlsLocked);
    if (!isControlsLocked) {
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      setShowControls(true);
      startControlsTimer();
    }
  };

  const toggleDim = () => {
    resetControlsTimer();
    const newDimmed = !isDimmed;
    setIsDimmed(newDimmed);
    Animated.timing(dimOverlayOpacity, {
      toValue: newDimmed ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const toggleMute = async () => {
    resetControlsTimer();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(newMuted);
    }
  };

  const setVolumeLevel = async (newVolume) => {
    resetControlsTimer();
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (clampedVolume === 0) {
      setIsMuted(true);
    } else if (isMuted && clampedVolume > 0) {
      setIsMuted(false);
    }
    if (videoRef.current) {
      await videoRef.current.setVolumeAsync(clampedVolume);
      await videoRef.current.setIsMutedAsync(clampedVolume === 0);
    }
  };

  // Keep volume bar width ref updated
  useEffect(() => {
    volumeBarWidthRef.current = volumeBarWidth;
  }, [volumeBarWidth]);

  const handleVolumeSwipe = (x) => {
    const width = volumeBarWidthRef.current;
    if (width > 0) {
      const progress = Math.max(0, Math.min(1, x / width));
      setVolumeLevel(progress);
    }
  };

  // Create PanResponder for volume control
  const volumePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        resetControlsTimer();
        handleVolumeSwipe(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleVolumeSwipe(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        // Volume set on release
      },
    })
  ).current;

  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  // Check if content is anime (genre ID 16 = Animation, or original_language = 'ja')
  const isAnime = () => {
    if (!item) return false;
    const genreIds = item.genre_ids || [];
    const hasAnimationGenre = genreIds.includes(16); // 16 = Animation
    const isJapanese = item.original_language === 'ja' || item.original_language === 'jp';
    return hasAnimationGenre || isJapanese;
  };

  // Show skip 85s only for TV shows that are anime
  const showSkip85 = episode && isAnime();

  const displayTitle = episode 
    ? `S${season}E${episodeNumber}: ${episode.name || 'Episode'}`
    : item?.title || item?.name || 'Video';
  
  const episodeInfo = episode 
    ? (season === 1 ? `E${episodeNumber}` : `S${season}E${episodeNumber}`)
    : null;

  const playbackRates = [0.5, 1.0, 1.5, 1.75, 2.0];

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStreamUrl}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.errorBackButton} onPress={() => navigation.goBack()}>
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : streamUrl ? (
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            style={styles.video}
            source={{ uri: streamUrl }}
            useNativeControls={false}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            rate={playbackRate}
            volume={volume}
            isMuted={isMuted}
            onPlaybackStatusUpdate={handlePlaybackStatus}
            onError={(error) => {
              console.error('Video error:', error);
              setError('Video playback error');
            }}
          />

          {/* Dim Overlay */}
          <Animated.View 
            style={[
              styles.dimOverlay,
              { opacity: dimOverlayOpacity }
            ]}
            pointerEvents="none"
          />

          {/* Custom Controls Overlay */}
          <TouchableOpacity 
            style={styles.controlsOverlay}
            activeOpacity={1}
            onPress={toggleControls}
          >
            {showControls && !isControlsLocked && (
              <>
                {/* Top Bar */}
                <View style={[styles.topBar, { paddingTop: insets.top }]}>
                  <View style={styles.topLeft}>
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={() => navigation.goBack()}
                    >
                      <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </BlurView>
                    </TouchableOpacity>
                    
                    {episodeInfo && (
                      <View style={styles.titleContainer}>
                        <Text style={styles.episodeNumber}>{episodeInfo}</Text>
                        <Text style={styles.titleText} numberOfLines={1}>
                          {item?.title || item?.name || 'Video'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.topRight}>
                    <TouchableOpacity
                      style={styles.topButton}
                      onPress={toggleDim}
                    >
                      <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                        <Ionicons 
                          name={isDimmed ? "moon" : "moon-outline"} 
                          size={20} 
                          color="#fff" 
                        />
                      </BlurView>
                    </TouchableOpacity>
                    
                    {/* Volume Control Pill */}
                    <View style={styles.volumePill}>
                      <BlurView intensity={80} tint="dark" style={styles.volumePillBlur}>
                        <TouchableOpacity onPress={toggleMute} activeOpacity={0.7}>
                          <Ionicons 
                            name={isMuted || volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"} 
                            size={18} 
                            color="#fff" 
                          />
                        </TouchableOpacity>
                        <View 
                          style={styles.volumeBarContainer}
                          onLayout={(event) => {
                            const { width } = event.nativeEvent.layout;
                            setVolumeBarWidth(width);
                          }}
                          {...volumePanResponder.panHandlers}
                        >
                          <View style={[styles.volumeBar, { width: `${(isMuted ? 0 : volume) * 100}%` }]} />
                        </View>
                      </BlurView>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.topButton}
                      onPress={toggleLock}
                    >
                      <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                        <Ionicons 
                          name={isControlsLocked ? "lock-closed" : "lock-open"} 
                          size={20} 
                          color="#fff" 
                        />
                      </BlurView>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Center Controls */}
                <View 
                  style={[
                    styles.centerControls,
                    {
                      transform: [
                        { translateX: centerControlsWidth > 0 ? -centerControlsWidth / 2 : -100 },
                        { translateY: centerControlsHeight > 0 ? -centerControlsHeight / 2 : -40 }
                      ]
                    }
                  ]}
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    setCenterControlsWidth(width);
                    setCenterControlsHeight(height);
                  }}
                >
                  <TouchableOpacity
                    style={styles.seekButton}
                    onPress={() => seek(-10)}
                    onLongPress={() => seek(-30)}
                  >
                    <BlurView intensity={80} tint="dark" style={styles.seekButtonBlur}>
                      <Ionicons name="play-back" size={30} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playPauseButton, { marginHorizontal: 50 }]}
                    onPress={togglePlayPause}
                  >
                    <BlurView intensity={80} tint="dark" style={styles.playPauseBlur}>
                      <Ionicons 
                        name={isPlaying ? "pause" : "play"} 
                        size={56} 
                        color="#fff" 
                      />
                    </BlurView>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.seekButton}
                    onPress={() => seek(10)}
                    onLongPress={() => seek(30)}
                  >
                    <BlurView intensity={80} tint="dark" style={styles.seekButtonBlur}>
                      <Ionicons name="play-forward" size={30} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>
                </View>

                {/* Bottom Controls */}
                <View style={styles.bottomControls}>
                  {/* Skip 85s Button - Only for anime TV shows */}
                  {showSkip85 && (
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={skip85}
                    >
                      <BlurView intensity={80} tint="dark" style={styles.skipButtonBlur}>
                        <Ionicons name="play-forward" size={16} color="#fff" />
                        <Text style={styles.skipButtonText}>Skip 85s</Text>
                      </BlurView>
                    </TouchableOpacity>
                  )}

                  {/* Control Buttons Row - Above Slider */}
                  <View style={styles.controlButtonsRow}>
                    {/* Speed Button - Expandable */}
                    <Animated.View 
                      style={[styles.speedButtonContainer, { width: speedButtonWidth }]}
                      {...speedPanResponder.panHandlers}
                    >
                      <BlurView intensity={80} tint="dark" style={styles.speedButtonBlur}>
                        <TouchableOpacity
                          style={styles.speedButtonContent}
                          onPress={toggleSpeedOptions}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="speedometer" size={20} color="#fff" />
                          <Text style={styles.speedButtonText}>{playbackRate}x</Text>
                        </TouchableOpacity>
                        
                        {isSpeedExpanded && (
                          <View style={styles.speedOptionsContainer}>
                            {playbackRates.map((rate) => (
                              <TouchableOpacity
                                key={rate}
                                style={[
                                  styles.speedOption,
                                  playbackRate === rate && styles.speedOptionActive,
                                ]}
                                onPress={() => changePlaybackRate(rate)}
                              >
                                <Text
                                  style={[
                                    styles.speedOptionText,
                                    playbackRate === rate && styles.speedOptionTextActive,
                                  ]}
                                >
                                  {rate}x
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </BlurView>
                    </Animated.View>

                    {/* Subtitle Button - Context Menu */}
                    <View style={styles.subtitleButtonWrapper}>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={toggleSubtitleMenu}
                        activeOpacity={0.7}
                      >
                        <BlurView intensity={80} tint="dark" style={styles.controlButtonBlur}>
                          <Ionicons 
                            name={selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none' ? "text" : "text-outline"} 
                            size={20} 
                            color={selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none' ? "#FF3B30" : "#fff"} 
                          />
                        </BlurView>
                      </TouchableOpacity>
                      
                      {isSubtitleExpanded && (
                        <View style={styles.subtitleMenuContainer}>
                          <BlurView intensity={100} tint="dark" style={styles.subtitleMenuBlur}>
                            <ScrollView 
                              style={styles.subtitleMenuScroll}
                              nestedScrollEnabled={true}
                              showsVerticalScrollIndicator={false}
                            >
                              {subtitleTracks.map((track) => (
                                <TouchableOpacity
                                  key={track.id}
                                  style={[
                                    styles.subtitleMenuItem,
                                    selectedSubtitleTrack?.id === track.id && styles.subtitleMenuItemActive,
                                  ]}
                                  onPress={() => selectSubtitleTrack(track)}
                                >
                                  <Text
                                    style={[
                                      styles.subtitleMenuItemText,
                                      selectedSubtitleTrack?.id === track.id && styles.subtitleMenuItemTextActive,
                                    ]}
                                  >
                                    {track.name}
                                  </Text>
                                  {selectedSubtitleTrack?.id === track.id && (
                                    <Ionicons name="checkmark" size={16} color="#FF3B30" style={styles.subtitleMenuCheck} />
                                  )}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </BlurView>
                        </View>
                      )}
                    </View>

                    {/* Menu Button */}
                    <TouchableOpacity style={styles.controlButton}>
                      <BlurView intensity={80} tint="dark" style={styles.controlButtonBlur}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                      </BlurView>
                    </TouchableOpacity>
                  </View>

                  {/* Progress Slider - iOS Native Style */}
                  <View style={styles.progressContainer}>
                    <Text style={styles.timeText}>{formatTime(position)}</Text>
                    <View
                      style={styles.sliderWrapper}
                      onLayout={(event) => {
                        const { width } = event.nativeEvent.layout;
                        setSliderWidth(width);
                      }}
                      {...panResponder.panHandlers}
                    >
                      {/* Background Track */}
                      <Animated.View
                        style={[
                          styles.sliderTrack,
                          {
                            height: sliderHeight,
                            borderRadius: sliderHeight.interpolate({
                              inputRange: [13, 18],
                              outputRange: [6.5, 9],
                            }),
                          },
                        ]}
                      >
                        {/* Progress Fill */}
                        <Animated.View
                          style={[
                            styles.sliderFill,
                            {
                              width: sliderProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                              }),
                            },
                          ]}
                        />
                      </Animated.View>
                    </View>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>
                </View>
              </>
            )}

            {/* Locked Controls Indicator */}
            {isControlsLocked && !showControls && (
              <TouchableOpacity
                style={styles.unlockButton}
                onPress={toggleLock}
              >
                <BlurView intensity={80} tint="dark" style={styles.unlockButtonBlur}>
                  <Ionicons name="lock-closed" size={30} color="#fff" />
                </BlurView>
              </TouchableOpacity>
            )}

            {/* Subtitle Overlay */}
            {currentSubtitleText && (
              <View style={styles.subtitleOverlay}>
                <Text style={styles.subtitleText}>{currentSubtitleText}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBackButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  errorBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  dimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dismissButton: {
    marginRight: 12,
  },
  blurButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  titleContainer: {
    flex: 1,
  },
  episodeNumber: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  titleText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topButton: {
    marginLeft: 8,
  },
  volumePill: {
    marginLeft: 8,
    height: 42,
  },
  volumePillBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 21,
    height: '100%',
    overflow: 'hidden',
    minWidth: 140,
    width: 140,
  },
  volumeBarContainer: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2.5,
    marginLeft: 10,
    overflow: 'hidden',
  },
  volumeBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2.5,
  },
  centerControls: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekButton: {
    width: 60,
    height: 60,
  },
  seekButtonBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playPauseButton: {
    width: 80,
    height: 80,
  },
  playPauseBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  skipButton: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  skipButtonBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 21,
    overflow: 'hidden',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 50,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  sliderWrapper: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingVertical: 18, // Extra touch area
  },
  sliderTrack: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  controlButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    alignItems: 'center',
  },
  speedButtonContainer: {
    height: 42,
    marginLeft: 12,
    overflow: 'hidden',
  },
  speedButtonBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  speedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: '100%',
    minWidth: 42,
  },
  speedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  speedOptionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    flex: 1,
  },
  speedOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 2,
    borderRadius: 12,
  },
  speedOptionActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  speedOptionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  speedOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subtitleButtonWrapper: {
    marginLeft: 12,
    position: 'relative',
  },
  subtitleMenuContainer: {
    position: 'absolute',
    bottom: 50,
    right: 0,
    minWidth: 200,
    maxWidth: 280,
    maxHeight: 200,
    zIndex: 1000,
  },
  subtitleMenuBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  subtitleMenuScroll: {
    maxHeight: 200,
  },
  subtitleMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 150,
  },
  subtitleMenuItemActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  subtitleMenuItemText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  subtitleMenuItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  subtitleMenuCheck: {
    marginLeft: 8,
  },
  controlButton: {
    width: 42,
    height: 42,
    marginLeft: 12,
  },
  controlButtonBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  unlockButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 60,
    height: 60,
  },
  unlockButtonBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  subtitleOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  subtitleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '90%',
    lineHeight: 24,
  },
});
