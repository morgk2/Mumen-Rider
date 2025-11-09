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
  LayoutAnimation,
  UIManager,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VixsrcService } from '../services/VixsrcService';
import { N3tflixService } from '../services/N3tflixService';
import { OpenSubtitlesService, LANGUAGE_CODES } from '../services/OpenSubtitlesService';
import { WatchProgressService } from '../services/WatchProgressService';
import { StorageService } from '../services/StorageService';
import { VideoDownloadService } from '../services/VideoDownloadService';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUBTITLE_SETTINGS_KEY = '@subtitle_settings';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VideoPlayerScreen({ route, navigation }) {
  const { item, episode, season, episodeNumber, resumePosition } = route.params || {};
  const insets = useSafeAreaInsets();
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [position, setPosition] = useState(resumePosition || 0);
  const [duration, setDuration] = useState(0);
  const progressSaveIntervalRef = useRef(null);
  const hasSeekedToResumePosition = useRef(false);
  const positionRef = useRef(resumePosition || 0);
  const durationRef = useRef(0);
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
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [isSubtitleSearchMode, setIsSubtitleSearchMode] = useState(false);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [subtitleSearchQuery, setSubtitleSearchQuery] = useState('');
  const [subtitleSearchLanguage, setSubtitleSearchLanguage] = useState('eng');
  const [subtitleSearchResults, setSubtitleSearchResults] = useState([]);
  const [isSearchingSubtitles, setIsSearchingSubtitles] = useState(false);
  const subtitleCuesRef = useRef([]);
  
  // Subtitle customization states (loaded from settings)
  const [subtitleColor, setSubtitleColor] = useState('#ffffff');
  const [subtitleSize, setSubtitleSize] = useState(18);
  const [subtitlePosition, setSubtitlePosition] = useState(80); // 0 = top, 50 = center, 100 = bottom
  const [subtitleFont, setSubtitleFont] = useState('System');
  const [subtitleShadow, setSubtitleShadow] = useState(false);
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [subtitleOutline, setSubtitleOutline] = useState(false);
  
  // Video source state
  const [videoSource, setVideoSource] = useState('vixsrc');
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef(null);

  // Load subtitle settings and video source on mount
  useEffect(() => {
    loadSubtitleSettings();
    loadVideoSource();
    
    // Listen for fullscreen changes (web)
    if (Platform.OS === 'web') {
      const handleFullscreenChange = () => {
        const isCurrentlyFullscreen = !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        );
        setIsFullscreen(isCurrentlyFullscreen);
      };

      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);

      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      };
    }
  }, []);

  const loadVideoSource = async () => {
    try {
      const source = await StorageService.getVideoSource();
      setVideoSource(source);
    } catch (error) {
      console.error('Error loading video source:', error);
    }
  };

  const loadSubtitleSettings = async () => {
    try {
      const settingsJson = await AsyncStorage.getItem(SUBTITLE_SETTINGS_KEY);
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        setSubtitleColor(settings.color || '#ffffff');
        setSubtitleSize(settings.size || 18);
        // Convert old string position to numeric if needed
        if (typeof settings.position === 'string') {
          if (settings.position === 'top') setSubtitlePosition(0);
          else if (settings.position === 'center') setSubtitlePosition(50);
          else setSubtitlePosition(80);
        } else {
          setSubtitlePosition(settings.position !== undefined ? settings.position : 80);
        }
        setSubtitleFont(settings.font || 'System');
        setSubtitleShadow(settings.shadow || false);
        setSubtitleBackground(settings.background !== undefined ? settings.background : true);
        setSubtitleOutline(settings.outline || false);
      }
    } catch (error) {
      console.error('Error loading subtitle settings:', error);
    }
  };

  const controlsTimeoutRef = useRef(null);
  const dimOverlayOpacity = useRef(new Animated.Value(0)).current;
  const speedButtonWidth = useRef(new Animated.Value(42)).current;
  const isSpeedExpandedRef = useRef(false);
  const speedSwipeHandledRef = useRef(false);
  const [isSliderActive, setIsSliderActive] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderProgress = useRef(new Animated.Value(0)).current;
  const sliderHeight = useRef(new Animated.Value(40)).current;
  const [centerControlsWidth, setCenterControlsWidth] = useState(0);
  const [centerControlsHeight, setCenterControlsHeight] = useState(0);
  const [volumeBarWidth, setVolumeBarWidth] = useState(0);
  const volumeBarWidthRef = useRef(0);
  
  // Animation values for controls - initialized based on showControls initial state
  const topBarOpacity = useRef(new Animated.Value(showControls ? 1 : 0)).current;
  const topBarTranslateY = useRef(new Animated.Value(showControls ? 0 : -50)).current;
  const centerControlsOpacity = useRef(new Animated.Value(showControls ? 1 : 0)).current;
  const centerControlsScale = useRef(new Animated.Value(showControls ? 1 : 0.9)).current;
  const bottomControlsOpacity = useRef(new Animated.Value(showControls ? 1 : 0)).current;
  const bottomControlsTranslateY = useRef(new Animated.Value(showControls ? 0 : 50)).current;
  
  // Animation values for subtitle modal
  const subtitleModalOpacity = useRef(new Animated.Value(0)).current;
  const subtitleModalTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleButtonWidth = useRef(new Animated.Value(42)).current;
  
  // Animation values for menu modal
  const menuModalOpacity = useRef(new Animated.Value(0)).current;
  const menuModalTranslateY = useRef(new Animated.Value(20)).current;
  const menuModalDownwardTranslate = useRef(new Animated.Value(0)).current;

  // Lock orientation to landscape when screen mounts or comes into focus
  // Only on native platforms - web browsers don't support orientation locking
  useFocusEffect(
    React.useCallback(() => {
      // Skip orientation locking on web
      if (Platform.OS === 'web') {
        return;
      }

      let isLocked = false;
      
      const lockOrientation = async () => {
        try {
          // Lock to landscape - this will force rotation if device is in portrait
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          isLocked = true;
        } catch (error) {
          // Silently fail - orientation locking is not always available
          // Don't log error on web or unsupported platforms
          if (Platform.OS !== 'web') {
            console.error('Error locking orientation:', error);
          }
        }
      };

      // Lock immediately
      lockOrientation();

      // Also try locking again after a short delay to ensure it takes effect
      // This is especially important for native builds where orientation changes might be delayed
      const timeoutId = setTimeout(() => {
        if (!isLocked) {
          lockOrientation();
        }
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        // Unlock orientation when screen loses focus to allow other screens to rotate freely
        ScreenOrientation.unlockAsync().catch(err => {
          // Silently fail - orientation unlocking is not always available
          // Don't log error on web or unsupported platforms
          if (Platform.OS !== 'web') {
            console.error('Error unlocking orientation:', err);
          }
        });
      };
    }, [])
  );

  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Configure audio mode for video playback
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error setting audio mode:', error);
      }
    };

    setupAudio();
    fetchStreamUrl();

    // Auto-hide controls after 3 seconds
    startControlsTimer();

    // Save progress periodically (every 10 seconds)
    progressSaveIntervalRef.current = setInterval(() => {
      saveWatchProgress();
    }, 10000);

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      // Save progress on exit
      saveWatchProgress();
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
      toValue: isSliderActive ? 48 : 40,
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
      if (isMenuExpanded) {
        setIsMenuExpanded(false);
      }
      if (isSubtitleSearchMode) {
        setIsSubtitleSearchMode(false);
      }
    }
  }, [showControls, isSpeedExpanded, isSubtitleExpanded, isMenuExpanded, isSubtitleSearchMode]);

  // Disable controls auto-hide when any modal is active
  useEffect(() => {
    const hasActiveModal = isSubtitleExpanded || isMenuExpanded || isSubtitleSearchMode;
    
    if (hasActiveModal) {
      // Clear any existing timer when modal opens
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      // Ensure controls stay visible
      if (!showControls && !isControlsLocked) {
        setShowControls(true);
      }
    } else {
      // Restart timer when all modals are closed
      if (showControls && !isControlsLocked) {
        startControlsTimer();
      }
    }
  }, [isSubtitleExpanded, isMenuExpanded, isSubtitleSearchMode, showControls, isControlsLocked]);

  // Animate subtitle modal appearance/disappearance
  useEffect(() => {
    const duration = 200; // Fast but smooth
    
    if (isSubtitleExpanded) {
      // Slide up and fade in
      Animated.parallel([
        Animated.timing(subtitleModalOpacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleModalTranslateY, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down and fade out
      Animated.parallel([
        Animated.timing(subtitleModalOpacity, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleModalTranslateY, {
          toValue: 20,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isSubtitleExpanded]);

  // Animate menu modal appearance/disappearance and size changes
  useEffect(() => {
    const duration = 200; // Fast but smooth
    
    if (isMenuExpanded) {
      // Slide up and fade in
      Animated.parallel([
        Animated.timing(menuModalOpacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(menuModalTranslateY, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down and fade out
      Animated.parallel([
        Animated.timing(menuModalOpacity, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(menuModalTranslateY, {
          toValue: 20,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isMenuExpanded]);

  // Animate menu modal size and position when switching to subtitle search mode
  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    
    LayoutAnimation.configureNext({
      duration: 250,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    
    // Animate downward movement - move down when expanding (less downward movement)
    Animated.spring(menuModalDownwardTranslate, {
      toValue: isSubtitleSearchMode ? 150 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [isSubtitleSearchMode]);

  // Animate controls appearance/disappearance
  useEffect(() => {
    const duration = 200; // Fast but smooth
    
    if (showControls && !isControlsLocked) {
      // Slide up and fade in
      Animated.parallel([
        // Top bar - slide down from top
        Animated.parallel([
          Animated.timing(topBarOpacity, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(topBarTranslateY, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ]),
        // Center controls - fade in and scale
        Animated.parallel([
          Animated.timing(centerControlsOpacity, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(centerControlsScale, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
        ]),
        // Bottom controls - slide up from bottom
        Animated.parallel([
          Animated.timing(bottomControlsOpacity, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(bottomControlsTranslateY, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      // Slide down and fade out
      Animated.parallel([
        // Top bar - slide up and fade out
        Animated.parallel([
          Animated.timing(topBarOpacity, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(topBarTranslateY, {
            toValue: -50,
            duration,
            useNativeDriver: true,
          }),
        ]),
        // Center controls - fade out and scale down
        Animated.parallel([
          Animated.timing(centerControlsOpacity, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(centerControlsScale, {
            toValue: 0.9,
            duration,
            useNativeDriver: true,
          }),
        ]),
        // Bottom controls - slide down and fade out
        Animated.parallel([
          Animated.timing(bottomControlsOpacity, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(bottomControlsTranslateY, {
            toValue: 50,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [showControls, isControlsLocked]);

  const startControlsTimer = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Don't auto-hide controls if any modal is active
    const hasActiveModal = isSubtitleExpanded || isMenuExpanded || isSubtitleSearchMode;
    if (!isControlsLocked && showControls && !hasActiveModal) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const resetControlsTimer = () => {
    if (!isControlsLocked) {
      setShowControls(true);
      // Don't start timer if any modal is active
      const hasActiveModal = isSubtitleExpanded || isMenuExpanded || isSubtitleSearchMode;
      if (!hasActiveModal) {
      startControlsTimer();
      }
    }
  };

  // Save watch progress
  const saveWatchProgress = async () => {
    if (!item || !item.id || positionRef.current === 0 || durationRef.current === 0) return;
    
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      if (episode && season !== null && episodeNumber !== null) {
        await WatchProgressService.saveProgress(
          item.id,
          mediaType,
          positionRef.current,
          durationRef.current,
          season,
          episodeNumber
        );
      } else {
        await WatchProgressService.saveProgress(
          item.id,
          mediaType,
          positionRef.current,
          durationRef.current
        );
      }
    } catch (error) {
      console.error('Error saving watch progress:', error);
    }
  };

  // Handle back button - save progress before going back
  const handleBack = async () => {
    await saveWatchProgress();
    navigation.goBack();
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
      let localVideoPath = null;
      let downloadedData = null;

      // Check if video is downloaded
      if (episode && season && episodeNumber) {
        // Check for downloaded episode
        downloadedData = await VideoDownloadService.getEpisodeDownload(tmdbId, season, episodeNumber);
        if (downloadedData && downloadedData.completed && downloadedData.videoPath) {
          // Verify file exists
          const fileInfo = await FileSystem.getInfoAsync(downloadedData.videoPath);
          if (fileInfo.exists) {
            localVideoPath = downloadedData.videoPath;
          }
        }
      } else {
        // Check for downloaded movie
        downloadedData = await VideoDownloadService.getMovieDownload(tmdbId);
        if (downloadedData && downloadedData.completed && downloadedData.videoPath) {
          // Verify file exists
          const fileInfo = await FileSystem.getInfoAsync(downloadedData.videoPath);
          if (fileInfo.exists) {
            localVideoPath = downloadedData.videoPath;
          }
        }
      }

      if (localVideoPath) {
        // Use downloaded video
        console.log('Using downloaded video:', localVideoPath);
        setStreamUrl(localVideoPath);
        
        // Set up subtitle tracks from downloaded data if available
        const tracks = [
          { id: 'none', name: 'Off', language: null, url: null },
        ];
        if (downloadedData && downloadedData.subtitles && downloadedData.subtitles.length > 0) {
          tracks.push(...downloadedData.subtitles);
        }
        setSubtitleTracks(tracks);
      } else {
        // Fetch from streaming service
        // Get the selected video source
        const source = await StorageService.getVideoSource();
        setVideoSource(source);

        // Select the appropriate service
        const service = source === 'n3tflix' ? N3tflixService : VixsrcService;

        let result = null;

        if (episode && season && episodeNumber) {
          result = await service.fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber);
        } else {
          result = await service.fetchMovieWithSubtitles(tmdbId);
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
      const newPosition = status.positionMillis || 0;
      const newDuration = status.durationMillis || 0;
      
      positionRef.current = newPosition;
      durationRef.current = newDuration;
      setPosition(newPosition);
      setDuration(newDuration);
      setIsPlaying(status.isPlaying || false);

      // Seek to resume position when video first loads
      if (resumePosition && resumePosition > 0 && !hasSeekedToResumePosition.current && newDuration > 0) {
        hasSeekedToResumePosition.current = true;
        if (videoRef.current) {
          await videoRef.current.setPositionAsync(resumePosition);
          setPosition(resumePosition);
          positionRef.current = resumePosition;
        }
      }
    }
    if (status.isLoaded && status.didJustFinish) {
      // Remove progress when video finishes
      if (item && item.id) {
        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
        if (episode && season !== null && episodeNumber !== null) {
          await WatchProgressService.removeProgress(item.id, mediaType, season, episodeNumber);
        } else {
          await WatchProgressService.removeProgress(item.id, mediaType);
        }
      }
      navigation.goBack();
    }
  };

  const togglePlayPause = async () => {
    resetControlsTimer();
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        // Ensure volume and mute state are set before playing
        await videoRef.current.setVolumeAsync(volume);
        await videoRef.current.setIsMutedAsync(isMuted);
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
    // Collapse subtitle and menu if expanding speed
    if (newExpanded) {
      if (isSubtitleExpanded) {
      setIsSubtitleExpanded(false);
      Animated.spring(subtitleButtonWidth, {
        toValue: 42,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
      }
      if (isMenuExpanded) {
        setIsMenuExpanded(false);
      }
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
    if (isMenuExpanded) {
      setIsMenuExpanded(false);
    }
  };

  const toggleMenu = () => {
    resetControlsTimer();
    const newExpanded = !isMenuExpanded;
    setIsMenuExpanded(newExpanded);
    if (isSubtitleExpanded) {
      setIsSubtitleExpanded(false);
    }
    // Reset subtitle search mode when closing menu
    if (!newExpanded && isSubtitleSearchMode) {
      setIsSubtitleSearchMode(false);
    }
  };

  const handleLoadSRT = () => {
    resetControlsTimer();
    setIsMenuExpanded(false);
    // TODO: Implement SRT file picker
    console.log('Load SRT file');
    // This would typically open a file picker
    // For now, just log it
  };

  const handleLoadSubtitlesOnline = async () => {
    resetControlsTimer();
    setIsSubtitleSearchMode(true);
    // Initialize search query with current movie/episode title
    // For episodes, try just the show title first (episode names can be too specific)
    const searchTitle = episode 
      ? (item?.title || item?.name || '').trim()
      : (item?.title || item?.name || '').trim();
    setSubtitleSearchQuery(searchTitle);
    // Auto-search if we have a title
    if (searchTitle) {
      // Wait for state to update, then search
      setTimeout(() => {
        // Use the current language state
        const currentLanguage = subtitleSearchLanguage || 'eng';
        setIsSearchingSubtitles(true);
        setSubtitleSearchResults([]);

        // Get IMDb ID if available
        const imdbId = item?.imdb_id || item?.external_ids?.imdb_id || null;
        console.log('Using IMDb ID:', imdbId);
        
        OpenSubtitlesService.searchSubtitles(searchTitle.trim(), currentLanguage, imdbId)
          .then((results) => {
            console.log('Auto-search results:', results.length, results);
            setSubtitleSearchResults(results);
          })
          .catch((error) => {
            console.error('Error in auto-search:', error);
            setSubtitleSearchResults([]);
          })
          .finally(() => {
            setIsSearchingSubtitles(false);
          });
      }, 300);
    }
  };

  const closeSubtitleSearch = () => {
    setIsSubtitleSearchMode(false);
    setIsMenuExpanded(false);
    setSubtitleSearchResults([]);
    setSubtitleSearchQuery('');
  };

  const handleBackFromSearch = () => {
    setIsSubtitleSearchMode(false);
    setSubtitleSearchResults([]);
    setSubtitleSearchQuery('');
  };

  const searchSubtitles = async () => {
    if (!subtitleSearchQuery.trim()) {
      return;
    }

    setIsSearchingSubtitles(true);
    setSubtitleSearchResults([]);

    try {
      console.log('Searching subtitles:', subtitleSearchQuery.trim(), 'Language:', subtitleSearchLanguage);
      
      // Get IMDb ID if available
      const imdbId = item?.imdb_id || item?.external_ids?.imdb_id || null;
      console.log('Using IMDb ID:', imdbId);
      
      const results = await OpenSubtitlesService.searchSubtitles(
        subtitleSearchQuery.trim(),
        subtitleSearchLanguage,
        imdbId
      );
      console.log('Search results received:', results.length, results);
      setSubtitleSearchResults(results);
    } catch (error) {
      console.error('Error searching subtitles:', error);
      setSubtitleSearchResults([]);
    } finally {
      setIsSearchingSubtitles(false);
    }
  };

  const handleSelectOnlineSubtitle = async (subtitle) => {
    try {
      setIsSearchingSubtitles(true);
      const fileContent = await OpenSubtitlesService.downloadSubtitle(subtitle.fileId);
      
      if (fileContent) {
        // Clear current subtitle text immediately
        setCurrentSubtitleText('');
        
        // Parse the subtitle file
        const cues = parseSRT(fileContent);
        subtitleCuesRef.current = cues;
        console.log('Loaded', cues.length, 'subtitle cues from online source');
        
        // Create a track object for the selected subtitle
        const newTrack = {
          id: subtitle.id,
          name: `${subtitle.languageName || subtitle.language} - ${subtitle.release || 'Online'}`,
          language: subtitle.language,
          url: null, // No URL, content is already loaded
          content: fileContent, // Store the content
        };
        
        // Set the new track as selected (this replaces the previous one)
        setSelectedSubtitleTrack(newTrack);
        
        // Close the modals
        setIsSubtitleSearchMode(false);
        setIsMenuExpanded(false);
        setSubtitleSearchResults([]);
        
        // Reset controls timer to show the new subtitle is active
        resetControlsTimer();
      }
    } catch (error) {
      console.error('Error loading online subtitle:', error);
      // Show error feedback to user
      Alert.alert('Error', 'Failed to load subtitle. Please try another one.');
    } finally {
      setIsSearchingSubtitles(false);
    }
  };

  const selectSubtitleTrack = async (track) => {
    resetControlsTimer();
    setSelectedSubtitleTrack(track);
    
    // Load subtitle file if track has URL or content
    if (track.id === 'none') {
      subtitleCuesRef.current = [];
      setCurrentSubtitleText('');
    } else if (track.content) {
      // Online subtitle with content already loaded
      try {
        const cues = parseSRT(track.content);
        subtitleCuesRef.current = cues;
        console.log('Loaded subtitle cues from content:', cues.length);
      } catch (error) {
        console.error('Error parsing subtitle content:', error);
        subtitleCuesRef.current = [];
      }
    } else if (track.url) {
      // Subtitle with URL
      try {
        const cues = await loadSubtitleFile(track.url);
        subtitleCuesRef.current = cues;
        console.log('Loaded subtitle cues:', cues.length);
      } catch (error) {
        console.error('Error loading subtitle track:', error);
        subtitleCuesRef.current = [];
      }
    } else {
      subtitleCuesRef.current = [];
      setCurrentSubtitleText('');
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

  // Fullscreen toggle function
  const toggleFullscreen = async () => {
    if (Platform.OS === 'web') {
      try {
        if (!isFullscreen) {
          // Enter fullscreen - use the video element if available, otherwise use document
          const videoElement = videoRef.current?._nativeView?._video?.nativeEvent?.target;
          let element = videoElement || document.documentElement;

          if (element.requestFullscreen) {
            await element.requestFullscreen();
          } else if (element.webkitRequestFullscreen) {
            await element.webkitRequestFullscreen();
          } else if (element.mozRequestFullScreen) {
            await element.mozRequestFullScreen();
          } else if (element.msRequestFullscreen) {
            await element.msRequestFullscreen();
          } else {
            // Fallback: try to find video element in DOM
            const videoEl = document.querySelector('video');
            if (videoEl) {
              if (videoEl.requestFullscreen) {
                await videoEl.requestFullscreen();
              } else if (videoEl.webkitRequestFullscreen) {
                await videoEl.webkitRequestFullscreen();
              } else if (videoEl.mozRequestFullScreen) {
                await videoEl.mozRequestFullScreen();
              } else if (videoEl.msRequestFullscreen) {
                await videoEl.msRequestFullscreen();
              }
            } else {
              // Last resort: fullscreen the document
              if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
              }
            }
          }
        } else {
          // Exit fullscreen
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            await document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            await document.msExitFullscreen();
          }
        }
      } catch (error) {
        console.error('Error toggling fullscreen:', error);
      }
    } else {
      // On native, just toggle state (orientation handles fullscreen)
      setIsFullscreen(!isFullscreen);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStreamUrl}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.errorBackButton} onPress={handleBack}>
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : streamUrl ? (
        <View 
          ref={videoContainerRef}
          style={[styles.videoContainer, isFullscreen && styles.videoContainerFullscreen]}
        >
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
            onLoadStart={async () => {
              // Ensure audio is enabled when video loads
              if (videoRef.current) {
                try {
                  await videoRef.current.setVolumeAsync(volume);
                  await videoRef.current.setIsMutedAsync(isMuted);
                } catch (error) {
                  console.error('Error setting audio on load:', error);
                }
              }
            }}
            onError={(error) => {
              console.error('Video error:', error);
              
              // Handle different error formats
              let errorMessage = 'Unknown video playback error';
              
              if (error) {
                if (typeof error === 'string') {
                  errorMessage = error;
                } else if (error.message) {
                  errorMessage = error.message;
                } else if (error.error?.message) {
                  errorMessage = error.error.message;
                } else if (error.localizedDescription) {
                  errorMessage = error.localizedDescription;
                } else if (error.code) {
                  errorMessage = `Error code: ${error.code}`;
                }
              }
              
              // Don't show error for network issues that might recover
              // Don't show error for codec issues that are non-critical
              const isNonCriticalError = 
                error?.code === 'E_NETWORK' || 
                errorMessage.toLowerCase().includes('network') ||
                errorMessage.toLowerCase().includes('codec') ||
                errorMessage.toLowerCase().includes('format');
              
              if (isNonCriticalError) {
                console.warn('Non-critical video error (may recover):', errorMessage);
                // Don't set error state for non-critical issues
                return;
              }
              
              setError(`Video playback error: ${errorMessage}`);
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
            disabled={isMenuExpanded && isSubtitleSearchMode}
          >
            {!isControlsLocked && (
              <>
                {/* Top Bar */}
                <Animated.View 
                  style={[
                    styles.topBar, 
                    { 
                      paddingTop: insets.top,
                      opacity: topBarOpacity,
                      transform: [{ translateY: topBarTranslateY }],
                    }
                  ]}
                  pointerEvents={showControls ? 'auto' : 'none'}
                >
                  <View style={styles.topLeft}>
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={handleBack}
                    >
                      <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                        <Ionicons name="close" size={20} color="#fff" />
                      </BlurView>
                    </TouchableOpacity>
                    
                    <View style={styles.titleContainer}>
                      {episodeInfo && (
                        <Text style={styles.episodeNumber}>{episodeInfo}</Text>
                      )}
                      <Text style={styles.titleText} numberOfLines={1}>
                        {item?.title || item?.name || 'Video'}
                      </Text>
                    </View>
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
                </Animated.View>

                {/* Center Controls */}
                <Animated.View 
                  style={[
                    styles.centerControls,
                    {
                      opacity: centerControlsOpacity,
                      transform: [
                        { translateX: centerControlsWidth > 0 ? -centerControlsWidth / 2 : -100 },
                        { translateY: centerControlsHeight > 0 ? -centerControlsHeight / 2 : -40 },
                        { scale: centerControlsScale },
                      ]
                    }
                  ]}
                  onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    setCenterControlsWidth(width);
                    setCenterControlsHeight(height);
                  }}
                  pointerEvents={showControls ? 'auto' : 'none'}
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
                </Animated.View>

                {/* Bottom Controls */}
                <Animated.View 
                  style={[
                    styles.bottomControls,
                    {
                      opacity: bottomControlsOpacity,
                      transform: [{ translateY: bottomControlsTranslateY }],
                    }
                  ]}
                  pointerEvents={showControls ? 'auto' : 'none'}
                >
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
                            color={selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none' ? "#fff" : "#fff"} 
                          />
                        </BlurView>
                      </TouchableOpacity>
                      
                      <Animated.View 
                        style={[
                          styles.subtitleMenuContainer,
                          {
                            opacity: subtitleModalOpacity,
                            transform: [{ translateY: subtitleModalTranslateY }],
                          }
                        ]}
                        pointerEvents={isSubtitleExpanded ? 'auto' : 'none'}
                      >
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
                                    <Ionicons name="checkmark" size={16} color="#fff" style={styles.subtitleMenuCheck} />
                                  )}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </BlurView>
                      </Animated.View>
                    </View>

                    {/* Fullscreen Button - Web only */}
                    {Platform.OS === 'web' && (
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={toggleFullscreen}
                        activeOpacity={0.7}
                      >
                        <BlurView intensity={80} tint="dark" style={styles.controlButtonBlur}>
                          <Ionicons 
                            name={isFullscreen ? "contract" : "expand"} 
                            size={20} 
                            color="#fff" 
                          />
                        </BlurView>
                      </TouchableOpacity>
                    )}

                    {/* Menu Button */}
                    <View style={styles.menuButtonWrapper}>
                      <TouchableOpacity 
                        style={styles.controlButton}
                        onPress={toggleMenu}
                        activeOpacity={0.7}
                      >
                      <BlurView intensity={80} tint="dark" style={styles.controlButtonBlur}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                      </BlurView>
                      </TouchableOpacity>
                      
                      <Animated.View 
                        style={[
                          styles.menuContainer,
                          isSubtitleSearchMode && styles.menuContainerExpanded,
                          isSubtitleSearchMode && styles.menuContainerExpandedPosition,
                          {
                            opacity: menuModalOpacity,
                            transform: [
                              { translateY: Animated.add(menuModalTranslateY, menuModalDownwardTranslate) },
                            ],
                          }
                        ]}
                        pointerEvents={isMenuExpanded ? 'auto' : 'none'}
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                      >
                        <BlurView 
                          intensity={100} 
                          tint="dark" 
                          style={styles.menuBlur}
                          onStartShouldSetResponder={() => true}
                          onMoveShouldSetResponder={() => true}
                        >
                          {isSubtitleSearchMode ? (
                            <>
                              {/* Back Button */}
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleBackFromSearch}
                              >
                                <Ionicons name="arrow-back" size={18} color="#fff" style={styles.menuItemIcon} />
                                <Text style={styles.menuItemText}>Back</Text>
                              </TouchableOpacity>
                              
                              {/* Subtitle Search Content */}
                              <View 
                                style={styles.subtitleSearchContent}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                              >
                                {/* Search Input */}
                                <View style={styles.searchInputContainer}>
                                  <TextInput
                                    style={[styles.searchInput, { marginRight: 8 }]}
                                    placeholder="Search for subtitles..."
                                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                    value={subtitleSearchQuery}
                                    onChangeText={setSubtitleSearchQuery}
                                    onSubmitEditing={searchSubtitles}
                                    returnKeyType="search"
                                  />
                                  <TouchableOpacity
                                    style={styles.searchButton}
                                    onPress={searchSubtitles}
                                    disabled={isSearchingSubtitles || !subtitleSearchQuery.trim()}
                                  >
                                    {isSearchingSubtitles ? (
                                      <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                      <Ionicons name="search" size={20} color="#fff" />
                                    )}
                    </TouchableOpacity>
                                </View>

                                {/* Language Selector */}
                                <View style={styles.languageSelectorContainer}>
                                  <Text style={styles.languageLabel}>Language:</Text>
                                  <ScrollView 
                                    horizontal 
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.languageScrollView}
                                  >
                                    {Object.entries(LANGUAGE_CODES).map(([code, name]) => (
                                      <TouchableOpacity
                                        key={code}
                                        style={[
                                          styles.languageChip,
                                          subtitleSearchLanguage === code && styles.languageChipActive,
                                        ]}
                                        onPress={() => {
                                          setSubtitleSearchLanguage(code);
                                          if (subtitleSearchQuery.trim()) {
                                            searchSubtitles();
                                          }
                                        }}
                                      >
                                        <Text
                                          style={[
                                            styles.languageChipText,
                                            subtitleSearchLanguage === code && styles.languageChipTextActive,
                                          ]}
                                        >
                                          {name}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>

                                {/* Search Results */}
                                <ScrollView 
                                  style={styles.searchResultsContainer}
                                  nestedScrollEnabled={true}
                                  showsVerticalScrollIndicator={false}
                                  onStartShouldSetResponder={() => true}
                                  onMoveShouldSetResponder={() => true}
                                  onResponderTerminationRequest={() => false}
                                >
                                  {isSearchingSubtitles ? (
                                    <View style={styles.emptyState}>
                                      <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.5)" />
                                      <Text style={styles.emptyStateText}>Searching...</Text>
                                    </View>
                                  ) : subtitleSearchResults.length > 0 ? (
                                    subtitleSearchResults.map((result) => (
                                      <TouchableOpacity
                                        key={result.id}
                                        style={styles.subtitleResultItem}
                                        onPress={() => handleSelectOnlineSubtitle(result)}
                                      >
                                        <View style={styles.subtitleResultHeader}>
                                          <Text style={styles.subtitleResultName} numberOfLines={1}>
                                            {result.name}
                                          </Text>
                                          <Text style={styles.subtitleResultLanguage}>
                                            {result.languageName || result.language}
                                          </Text>
                                        </View>
                                        {result.release && (
                                          <Text style={styles.subtitleResultRelease} numberOfLines={1}>
                                            {result.release}
                                          </Text>
                                        )}
                                        <View style={styles.subtitleResultMeta}>
                                          {result.downloads > 0 && (
                                            <View style={styles.subtitleResultMetaItem}>
                                              <Ionicons name="download" size={12} color="rgba(255, 255, 255, 0.6)" />
                                              <Text style={styles.subtitleResultMetaText}>{result.downloads}</Text>
                                            </View>
                                          )}
                                          {result.rating > 0 && (
                                            <View style={styles.subtitleResultMetaItem}>
                                              <Ionicons name="star" size={12} color="rgba(255, 255, 255, 0.6)" />
                                              <Text style={styles.subtitleResultMetaText}>{result.rating.toFixed(1)}</Text>
                                            </View>
                                          )}
                                        </View>
                                      </TouchableOpacity>
                                    ))
                                  ) : subtitleSearchQuery.trim() && !isSearchingSubtitles ? (
                                    <View style={styles.emptyState}>
                                      <Ionicons name="document-text-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                                      <Text style={styles.emptyStateText}>No subtitles found</Text>
                                      <Text style={[styles.emptyStateText, { fontSize: 12, marginTop: 8, opacity: 0.7 }]}>
                                        Try searching with a different title or language
                                      </Text>
                                    </View>
                                  ) : null}
                                </ScrollView>
                              </View>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleLoadSRT}
                              >
                                <Ionicons name="document-text" size={18} color="#fff" style={styles.menuItemIcon} />
                                <Text style={styles.menuItemText}>Load SRT</Text>
                              </TouchableOpacity>
                              
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleLoadSubtitlesOnline}
                              >
                                <Ionicons name="cloud-download" size={18} color="#fff" style={styles.menuItemIcon} />
                                <Text style={styles.menuItemText}>Load Subtitles Online</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </BlurView>
                      </Animated.View>
                    </View>
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
                              inputRange: [40, 48],
                              outputRange: [20, 24],
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
                </Animated.View>
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
              <View style={[
                styles.subtitleOverlay,
                {
                  top: `${subtitlePosition}%`,
                  marginTop: subtitlePosition === 50 ? -20 : 0,
                }
              ]}>
                <Text style={[
                  styles.subtitleText,
                  {
                    color: subtitleColor,
                    fontSize: subtitleSize,
                    fontFamily: subtitleFont === 'System' ? undefined : subtitleFont,
                    textShadowColor: subtitleShadow ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
                    textShadowOffset: subtitleShadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
                    textShadowRadius: subtitleShadow ? 4 : 0,
                    backgroundColor: subtitleBackground ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                    textStrokeWidth: subtitleOutline ? 2 : 0,
                    textStrokeColor: subtitleOutline ? '#000' : 'transparent',
                    WebkitTextStrokeWidth: subtitleOutline ? 2 : 0,
                    WebkitTextStrokeColor: subtitleOutline ? '#000' : 'transparent',
                  }
                ]}>{currentSubtitleText}</Text>
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
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#000',
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
  videoContainerFullscreen: {
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999,
    }),
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
    height: 56,
    justifyContent: 'center',
    paddingVertical: 18, // Extra touch area
  },
  sliderTrack: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#ffffff',
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
  menuButtonWrapper: {
    marginLeft: 12,
    position: 'relative',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 50,
    right: 0,
    width: 220,
    minHeight: 120,
    zIndex: 1000,
    overflow: 'hidden',
  },
  menuContainerExpandedPosition: {
    bottom: 180,
  },
  menuContainerExpanded: {
    width: 400,
    minHeight: 350,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  menuBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 4,
    width: '100%',
    height: '100%',
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 200,
  },
  menuItemIcon: {
    marginRight: 12,
  },
  menuItemText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  subtitleSearchContent: {
    flex: 1,
    paddingTop: 8,
    // Empty for now
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
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  subtitleText: {
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '90%',
    lineHeight: 24,
  },
  subtitleSearchContent: {
    flex: 1,
    paddingTop: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageSelectorContainer: {
    marginBottom: 12,
  },
  languageLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  languageScrollView: {
    flexGrow: 0,
  },
  languageChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  languageChipActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  languageChipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  languageChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  searchResultsContainer: {
    flex: 1,
    maxHeight: 350,
  },
  subtitleResultItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  subtitleResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  subtitleResultName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  subtitleResultLanguage: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  subtitleResultRelease: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginBottom: 6,
  },
  subtitleResultMeta: {
    flexDirection: 'row',
  },
  subtitleResultMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  subtitleResultMetaText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    marginTop: 12,
  },
  subtitleCustomizeContent: {
    flex: 1,
    paddingTop: 8,
    minHeight: 0,
  },
  customizeScrollView: {
    flex: 1,
    minHeight: 0,
  },
  customizeScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  customizeSection: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  customizeLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  colorPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorOptionActive: {
    borderColor: '#fff',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderValue: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    width: 30,
    textAlign: 'center',
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginHorizontal: 8,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    top: -6,
    marginLeft: -8,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  positionOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  positionOptionActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  positionOptionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  positionOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  fontScrollView: {
    flexGrow: 0,
  },
  fontOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  fontOptionActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  fontOptionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  fontOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
});
