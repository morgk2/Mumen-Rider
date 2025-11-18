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
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { VideoView } from 'expo-video';
import { useVideoPlayerContext } from '../contexts/VideoPlayerContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path, G } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VixsrcService } from '../services/VixsrcService';
import { N3tflixService } from '../services/N3tflixService';
import { VidfastService } from '../services/VidfastService';
import { VideasyService } from '../services/VideasyService';
import { OpenSubtitlesService, LANGUAGE_CODES } from '../services/OpenSubtitlesService';
import { WatchProgressService } from '../services/WatchProgressService';
import { StorageService } from '../services/StorageService';
import { VideoDownloadService } from '../services/VideoDownloadService';
import { TMDBService } from '../services/TMDBService';
import { CachedImage } from '../components/CachedImage';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { M3U8Parser } from '../utils/M3U8Parser';

const SUBTITLE_SETTINGS_KEY = '@subtitle_settings';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Circular Arrow Icons for Seek Buttons (based on rewind.svg)
const RewindIcon = ({ size = 30, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Path
      d="M34.46,53.91A21.91,21.91,0,1,0,12.55,31.78"
      stroke={color}
      strokeWidth="5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M4.65 22.33L12.52 32.62L22.81 24.75"
      stroke={color}
      strokeWidth="5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const FastForwardIcon = ({ size = 30, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    {/* Mirrored version of rewind icon */}
    <G transform="translate(64, 0) scale(-1, 1)">
      <Path
        d="M34.46,53.91A21.91,21.91,0,1,0,12.55,31.78"
        stroke={color}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.65 22.33L12.52 32.62L22.81 24.75"
        stroke={color}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  </Svg>
);

export default function VideoPlayerScreen({ route, navigation }) {
  const { item: routeItem, episode: routeEpisode, season: routeSeason, episodeNumber: routeEpisodeNumber } = route.params || {};
  const insets = useSafeAreaInsets();
  
  // Use shared player context
  const {
    player,
    streamUrl,
    isPlaying,
    setIsPlaying,
    position,
    duration,
    item: contextItem,
    episode: contextEpisode,
    positionRef,
    play,
    pause,
    animateToFullscreen,
    animateToMinimized,
    transitionAnim,
  } = useVideoPlayerContext();
  
  // Use route params or context values
  const item = routeItem || contextItem;
  const episode = routeEpisode || contextEpisode;
  const season = routeSeason;
  const episodeNumber = routeEpisodeNumber;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const progressSaveIntervalRef = useRef(null);
  const hasAutoPlayed = useRef(false);
  const hasVideoFinished = useRef(false);
  
  // Track actual player state for UI
  const [uiIsPlaying, setUiIsPlaying] = useState(false);
  const lastPlayerStateRef = useRef(false);
  
  // Track if we came from EpisodePage to prevent loading overlay when video is already ready
  const fromEpisodePageRef = useRef(route.params?.fromEpisodePage || false);
  
  // Poll player state directly for reliable UI updates
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
  const isFocused = useIsFocused(); // Track if this screen is focused
  
  // Track if replace is in progress to prevent race conditions
  const isReplacingRef = useRef(false);
  
  // Player source is managed in context, no need to replace here
  
  // Configure player properties when they change
  useEffect(() => {
    if (player) {
      player.loop = false;
      player.muted = isMuted;
    }
  }, [player, isMuted]);
  
  useEffect(() => {
    if (player) {
      player.volume = volume;
    }
  }, [player, volume]);
  
  useEffect(() => {
    if (player) {
      player.playbackRate = playbackRate;
    }
  }, [player, playbackRate]);
  
  // Player is already initialized and synced in context, no need to seek here
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
  const [isSubtitleSearchMode, setIsSubtitleSearchMode] = useState(false);
  const [isAppearanceMode, setIsAppearanceMode] = useState(false);
  const [isDelayMode, setIsDelayMode] = useState(false);
  const [showSubtitleSettingsModal, setShowSubtitleSettingsModal] = useState(false);
  const [expandedLanguageGroup, setExpandedLanguageGroup] = useState(null);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
  const [showAudioSettingsModal, setShowAudioSettingsModal] = useState(false);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [showEpisodeListModal, setShowEpisodeListModal] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [episodesBySeason, setEpisodesBySeason] = useState({});
  const [videasyFailed, setVideasyFailed] = useState(false);
  const videasyRetryRef = useRef(false);
  const [selectedSeasonForList, setSelectedSeasonForList] = useState(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [subtitleSearchQuery, setSubtitleSearchQuery] = useState('');
  const [subtitleSearchLanguage, setSubtitleSearchLanguage] = useState('eng');
  const [subtitleSearchResults, setSubtitleSearchResults] = useState([]);
  const [isSearchingSubtitles, setIsSearchingSubtitles] = useState(false);
  const subtitleCuesRef = useRef([]);
  const autoSubtitleAttemptedRef = useRef(false); // Track if auto-selection has been attempted
  
  // Zoom states - using Animated.Value for smooth animations
  const zoomScale = useRef(new Animated.Value(1)).current;
  const panOffsetX = useRef(new Animated.Value(0)).current;
  const panOffsetY = useRef(new Animated.Value(0)).current;
  const zoomScaleState = useRef(1);
  const panOffsetXState = useRef(0);
  const panOffsetYState = useRef(0);
  
  // Pinch gesture state
  const lastPinchDistance = useRef(0);
  const lastPinchCenter = useRef({ x: 0, y: 0 });
  const pinchStartScale = useRef(1);
  const pinchStartPan = useRef({ x: 0, y: 0 });
  const isPinching = useRef(false);
  
  // Pan gesture state (single finger when zoomed)
  const isPanning = useRef(false);
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastPanPosition = useRef({ x: 0, y: 0 });
  
  // Double tap state
  const lastTapTime = useRef(0);
  const tapTimeout = useRef(null);
  
  // Subtitle customization states (loaded from settings)
  const [subtitleColor, setSubtitleColor] = useState('#ffffff');
  const [subtitleSize, setSubtitleSize] = useState(18);
  const [subtitlePosition, setSubtitlePosition] = useState(80); // 0 = top, 50 = center, 100 = bottom
  const [subtitleFont, setSubtitleFont] = useState('System');
  const [subtitleShadow, setSubtitleShadow] = useState(false);
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [subtitleOutline, setSubtitleOutline] = useState(false);
  const [subtitleDelay, setSubtitleDelay] = useState(0); // Delay in milliseconds (-3000 to +3000)
  const [preferredLanguage, setPreferredLanguage] = useState('eng'); // Preferred subtitle language code
  
  // Size slider width ref for calculations
  const sizeSliderWidthRef = useRef(200);
  // Delay slider width ref for calculations
  const delaySliderWidthRef = useRef(200);
  // Delay slider initial position when dragging starts
  const delaySliderInitialPositionRef = useRef(0);
  // Delay slider is dragging state
  const [isDelaySliderDragging, setIsDelaySliderDragging] = useState(false);
  
  // Delay slider pan responder
  const delaySliderPanResponder = useRef(null);
  
  // Initialize delay slider pan responder
  useEffect(() => {
    delaySliderPanResponder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal movement
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) < 10;
      },
      onPanResponderGrant: (evt) => {
        // When user starts dragging, capture the current delay value
        setIsDelaySliderDragging(true);
        delaySliderInitialPositionRef.current = subtitleDelay;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate new position based on drag delta
        const sliderWidth = delaySliderWidthRef.current;
        if (sliderWidth === 0) return;
        
        // Calculate the change in position as a percentage of slider width
        const deltaPercentage = gestureState.dx / sliderWidth;
        // Convert percentage to milliseconds (6000ms total range: -3000 to +3000)
        const deltaMs = deltaPercentage * 6000;
        
        // Calculate new delay based on initial position + delta
        const newDelay = Math.round(
          Math.max(-3000, Math.min(3000, delaySliderInitialPositionRef.current + deltaMs))
        );
        setSubtitleDelay(newDelay);
      },
      onPanResponderRelease: () => {
        // User released
        setIsDelaySliderDragging(false);
      },
      onPanResponderTerminate: () => {
        // Gesture was cancelled
        setIsDelaySliderDragging(false);
      },
    });
  }, [subtitleDelay]);
  
  // Video source state
  const [videoSource, setVideoSource] = useState('vixsrc');
  const [isRetryingWithVidfast, setIsRetryingWithVidfast] = useState(false);
  
  // Server selection state (for Vidfast)
  const [availableServers, setAvailableServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [isServerExpanded, setIsServerExpanded] = useState(false);
  
  // Orientation state
  const [isLandscape, setIsLandscape] = useState(true);
  
  // Battery state
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isCharging, setIsCharging] = useState(false);

  // Logo state (for movies)
  const [logoUrl, setLogoUrl] = useState(null);

  // Next episode state
  const [nextEpisode, setNextEpisode] = useState(null);
  const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);

  // Load subtitle settings and video source on mount
  useEffect(() => {
    loadSubtitleSettings();
    loadVideoSource();
    loadBatteryLevel();
    fetchLogo();
    if (episode && season && episodeNumber) {
      fetchNextEpisode();
    }
    
    // If coming from EpisodePage, immediately set transitionAnim to 1 for instant visibility
    if (fromEpisodePageRef.current) {
      transitionAnim.setValue(1);
    }
  }, []);

  // Fetch logo when item changes
  useEffect(() => {
    fetchLogo();
  }, [item]);

  // Fetch next episode information
  const fetchNextEpisode = async () => {
    if (!item || !item.id || !episode || season === null || episodeNumber === null) {
      return;
    }

    try {
      // Fetch all episodes for the current season
      const episodesData = await TMDBService.fetchTVEpisodes(item.id, season);
      
      // Find the current episode index
      const currentIndex = episodesData.findIndex(ep => ep.episode_number === episodeNumber);
      
      if (currentIndex !== -1 && currentIndex < episodesData.length - 1) {
        // Next episode in the same season
        const nextEp = episodesData[currentIndex + 1];
        setNextEpisode({
          episode: nextEp,
          season: season,
          episodeNumber: nextEp.episode_number,
        });
      } else {
        // Check if there's a next season
        try {
          const tvDetails = await TMDBService.fetchTVDetails(item.id);
          const seasons = (tvDetails?.seasons || []).filter(s => s.season_number > 0);
          const currentSeasonIndex = seasons.findIndex(s => s.season_number === season);
          
          if (currentSeasonIndex !== -1 && currentSeasonIndex < seasons.length - 1) {
            // Next season exists, fetch first episode of next season
            const nextSeason = seasons[currentSeasonIndex + 1];
            const nextSeasonEpisodes = await TMDBService.fetchTVEpisodes(item.id, nextSeason.season_number);
            if (nextSeasonEpisodes.length > 0) {
              const firstEpisode = nextSeasonEpisodes[0];
              setNextEpisode({
                episode: firstEpisode,
                season: nextSeason.season_number,
                episodeNumber: firstEpisode.episode_number,
              });
            }
          }
        } catch (error) {
          console.error('Error fetching next season:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching next episode:', error);
    }
  };

  // Play next episode
  const playNextEpisode = async () => {
    if (!nextEpisode || !item) return;

    try {
      const externalPlayer = await StorageService.getExternalPlayer();
      
      // Navigate to next episode
      navigation.replace('VideoPlayer', {
        item,
        episode: nextEpisode.episode,
        season: nextEpisode.season,
        episodeNumber: nextEpisode.episodeNumber,
        resumePosition: null, // Start from beginning
      });
    } catch (error) {
      console.error('Error playing next episode:', error);
    }
  };

  // Fetch TMDB logo for movies
  const fetchLogo = async () => {
    if (!item) {
      setLogoUrl(null);
      return;
    }
    
    // Only fetch logo for movies, not TV shows
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    if (mediaType !== 'movie') {
      setLogoUrl(null);
      return;
    }
    
    try {
      const itemId = item.id;
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${itemId}/images?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
      );
      const data = await response.json();
      
      // Find English logo, or use the first one
      const logo = data.logos?.find(logo => logo.iso_639_1 === 'en') || data.logos?.[0];
      
      if (logo) {
        const logoPath = logo.file_path;
        const logoUrl = `https://image.tmdb.org/t/p/w500${logoPath}`;
        console.log('Logo fetched successfully:', logoUrl);
        setLogoUrl(logoUrl);
      } else {
        console.log('No logo found for movie');
        setLogoUrl(null);
      }
    } catch (error) {
      console.error('Error fetching logo:', error);
      setLogoUrl(null);
    }
  };

  // Load battery level
  const loadBatteryLevel = async () => {
    try {
      if (Platform.OS === 'web') {
        // Use Web Battery API if available
        if ('getBattery' in navigator) {
          const battery = await navigator.getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(battery.charging);
          
          // Listen for battery level changes
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
          
          // Listen for charging changes
          battery.addEventListener('chargingchange', () => {
            setIsCharging(battery.charging);
          });
        }
      } else {
        // Try to use expo-battery if available (will fail gracefully if not installed)
        try {
          const Battery = require('expo-battery');
          const batteryLevel = await Battery.getBatteryLevelAsync();
          const batteryState = await Battery.getBatteryStateAsync();
          setBatteryLevel(Math.round(batteryLevel * 100));
          setIsCharging(batteryState === Battery.BatteryState.CHARGING);
          
          // Listen for battery level changes
          Battery.addBatteryLevelListener(({ batteryLevel: level }) => {
            setBatteryLevel(Math.round(level * 100));
          });
          
          // Listen for battery state changes
          Battery.addBatteryStateListener(({ batteryState: state }) => {
            setIsCharging(state === Battery.BatteryState.CHARGING);
          });
        } catch (error) {
          // expo-battery not available, battery will show as null
        }
      }
    } catch (error) {
      // Battery API not available, will show as null
    }
  };

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
        setSubtitleDelay(settings.delay !== undefined ? settings.delay : 0);
        setPreferredLanguage(settings.preferredLanguage || 'eng');
      }
    } catch (error) {
      console.error('Error loading subtitle settings:', error);
    }
  };

  // Save subtitle settings whenever they change
  useEffect(() => {
    const saveSubtitleSettings = async () => {
      try {
        const settings = {
          color: subtitleColor,
          size: subtitleSize,
          position: subtitlePosition,
          font: subtitleFont,
          shadow: subtitleShadow,
          background: subtitleBackground,
          outline: subtitleOutline,
          delay: subtitleDelay,
        };
        await AsyncStorage.setItem(SUBTITLE_SETTINGS_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving subtitle settings:', error);
      }
    };
    saveSubtitleSettings();
  }, [subtitleColor, subtitleSize, subtitlePosition, subtitleFont, subtitleShadow, subtitleBackground, subtitleOutline, subtitleDelay]);

  /**
   * Sort subtitle tracks by language priority: English first, then Arabic, then others
   * "Off" option always stays first
   * @param {Array} tracks - Array of subtitle tracks
   * @returns {Array} Sorted array of subtitle tracks
   */
  const sortSubtitleTracksByPriority = (tracks) => {
    if (!tracks || tracks.length === 0) return tracks;
    
    // Separate "Off" option from other tracks
    const offTrack = tracks.find(track => track.id === 'none');
    const otherTracks = tracks.filter(track => track.id !== 'none');
    
    // Sort other tracks by language priority
    const sortedTracks = otherTracks.sort((a, b) => {
      // Get language code/number from track - check both language and name fields
      const langA = ((a.language || '') + ' ' + (a.name || '')).toLowerCase().trim();
      const langB = ((b.language || '') + ' ' + (b.name || '')).toLowerCase().trim();
      
      // Priority: English (en, eng, english) > Arabic (ar, ara, arabic) > Others
      const getPriority = (lang) => {
        // Check for English - more specific patterns first
        if (lang.match(/\b(english|eng|en)\b/) || lang.startsWith('en') || lang.includes('english')) {
          return 1; // English - highest priority
        }
        // Check for Arabic - more specific patterns first
        if (lang.match(/\b(arabic|ara|ar)\b/) || lang.startsWith('ar') || lang.includes('arabic')) {
          return 2; // Arabic - second priority
        }
        return 3; // Others - lowest priority
      };
      
      const priorityA = getPriority(langA);
      const priorityB = getPriority(langB);
      
      // If priorities are different, sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort alphabetically by name (if available) or language
      const nameA = (a.name || a.language || '').toLowerCase();
      const nameB = (b.name || b.language || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Return "Off" first, then sorted tracks
    return offTrack ? [offTrack, ...sortedTracks] : sortedTracks;
  };

  /**
   * Group subtitle tracks by language
   * @param {Array} tracks - Array of subtitle tracks
   * @returns {Object} Object with language as key and array of tracks as value
   */
  const groupTracksByLanguage = (tracks) => {
    if (!tracks || tracks.length === 0) return {};
    
    const groups = {};
    
    tracks.forEach((track) => {
      // Skip "Off" option - it will be handled separately
      if (track.id === 'none') {
        return;
      }
      
      // Extract language from track
      const lang = track.language || '';
      const name = track.name || '';
      
      // Try to determine language from name or language field
      let languageKey = 'Unknown';
      const langLower = lang.toLowerCase();
      const nameLower = name.toLowerCase();
      
      // Check for common languages - prioritize exact matches in language field
      // First check language field (more reliable)
      if (lang) {
        const langClean = lang.toLowerCase().trim();
        // Check for exact language codes first
        if (langClean === 'en' || langClean === 'eng' || langClean === 'english') {
          languageKey = 'English';
        } else if (langClean === 'ar' || langClean === 'ara' || langClean === 'arabic') {
          languageKey = 'Arabic';
        } else if (langClean === 'es' || langClean === 'spa' || langClean === 'spanish') {
          languageKey = 'Spanish';
        } else if (langClean === 'fr' || langClean === 'fre' || langClean === 'french') {
          languageKey = 'French';
        } else if (langClean === 'de' || langClean === 'ger' || langClean === 'german') {
          languageKey = 'German';
        } else if (langClean === 'it' || langClean === 'ita' || langClean === 'italian') {
          languageKey = 'Italian';
        } else if (langClean === 'pt' || langClean === 'por' || langClean === 'portuguese') {
          languageKey = 'Portuguese';
        } else if (langClean === 'ja' || langClean === 'jpn' || langClean === 'japanese') {
          languageKey = 'Japanese';
        } else if (langClean === 'ko' || langClean === 'kor' || langClean === 'korean') {
          languageKey = 'Korean';
        } else if (langClean === 'zh' || langClean === 'chi' || langClean === 'chinese') {
          languageKey = 'Chinese';
        } else if (langClean === 'ru' || langClean === 'rus' || langClean === 'russian') {
          languageKey = 'Russian';
        } else if (langClean === 'hi' || langClean === 'hin' || langClean === 'hindi') {
          languageKey = 'Hindi';
        } else if (langClean.includes('en')) {
          languageKey = 'English';
        } else if (langClean.includes('ar')) {
          languageKey = 'Arabic';
        } else {
          // Use language code as-is if it's a known format
          languageKey = lang.length <= 3 ? lang.toUpperCase() : 'Unknown';
        }
      }
      
      // If language wasn't determined from language field, check name field
      if (languageKey === 'Unknown' && name) {
        if (nameLower.includes('english') || nameLower.includes('eng')) {
          languageKey = 'English';
        } else if (nameLower.includes('arabic') || nameLower.includes('ara')) {
          languageKey = 'Arabic';
        } else if (nameLower.includes('spanish') || nameLower.includes('spa')) {
          languageKey = 'Spanish';
        } else if (nameLower.includes('french') || nameLower.includes('fre')) {
          languageKey = 'French';
        } else if (nameLower.includes('german') || nameLower.includes('ger')) {
          languageKey = 'German';
        } else if (nameLower.includes('italian') || nameLower.includes('ita')) {
          languageKey = 'Italian';
        } else if (nameLower.includes('portuguese') || nameLower.includes('por')) {
          languageKey = 'Portuguese';
        } else if (nameLower.includes('japanese') || nameLower.includes('jpn')) {
          languageKey = 'Japanese';
        } else if (nameLower.includes('korean') || nameLower.includes('kor')) {
          languageKey = 'Korean';
        } else if (nameLower.includes('chinese') || nameLower.includes('chi')) {
          languageKey = 'Chinese';
        } else if (nameLower.includes('russian') || nameLower.includes('rus')) {
          languageKey = 'Russian';
        } else if (nameLower.includes('hindi') || nameLower.includes('hin')) {
          languageKey = 'Hindi';
        } else {
          // Try to extract language from name (first word before dash or space)
          const nameParts = name.split(/[- ]/);
          const firstPart = nameParts[0]?.trim();
          if (firstPart && firstPart.length > 0) {
            // Capitalize first letter
            languageKey = firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
          }
        }
      }
      
      if (!groups[languageKey]) {
        groups[languageKey] = [];
      }
      groups[languageKey].push(track);
    });
    
    return groups;
  };

  /**
   * Get language display name for a language group
   * @param {string} languageKey - Language key
   * @param {Array} tracks - Array of tracks in this language group
   * @returns {string} Display name for the language
   */
  const getLanguageDisplayName = (languageKey, tracks) => {
    // Always show language name with count
    return languageKey;
  };

  /**
   * Get sorted language groups by priority
   * @param {Object} languageGroups - Object with language as key and array of tracks as value
   * @returns {Array} Sorted array of [languageKey, tracks] pairs
   */
  const getSortedLanguageGroups = (languageGroups) => {
    const groups = Object.entries(languageGroups);
    
    // Sort by priority: English > Arabic > Others
    const getPriority = (langKey) => {
      const lang = langKey.toLowerCase();
      if (lang.includes('english') || lang.includes('en')) return 1;
      if (lang.includes('arabic') || lang.includes('ar')) return 2;
      return 3;
    };
    
    return groups.sort((a, b) => {
      const priorityA = getPriority(a[0]);
      const priorityB = getPriority(b[0]);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a[0].localeCompare(b[0]);
    });
  };

  const controlsTimeoutRef = useRef(null);
  const dimOverlayOpacity = useRef(new Animated.Value(0)).current;
  const speedButtonWidth = useRef(new Animated.Value(42)).current;
  const isSpeedExpandedRef = useRef(false);
  const speedSwipeHandledRef = useRef(false);
  const [isSliderActive, setIsSliderActive] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderProgress = useRef(new Animated.Value(0)).current;
  const sliderHeight = useRef(new Animated.Value(35)).current;
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
  
  // Animation value for subtitle position (moves up when controls appear)
  // Position above bottom controls: ~120px when controls visible, ~60px when hidden
  // Accounts for bottom controls height (~120px) + padding + safe area
  const subtitleBottomPosition = useRef(new Animated.Value(showControls ? 120 : 60)).current;
  
  // Animation values for subtitle modal
  const subtitleModalOpacity = useRef(new Animated.Value(0)).current;
  const subtitleModalTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleButtonWidth = useRef(new Animated.Value(42)).current;
  
  // Animation values for fullscreen subtitle settings modal (Netflix-style)
  const subtitleSettingsModalOpacity = useRef(new Animated.Value(0)).current;
  const subtitleSettingsModalScale = useRef(new Animated.Value(0.95)).current;
  
  // Animation values for fullscreen audio settings modal (Netflix-style)
  const audioSettingsModalOpacity = useRef(new Animated.Value(0)).current;
  const audioSettingsModalScale = useRef(new Animated.Value(0.95)).current;

  // Animation values for fullscreen server settings modal (Netflix-style)
  const serverSettingsModalOpacity = useRef(new Animated.Value(0)).current;
  const serverSettingsModalScale = useRef(new Animated.Value(0.95)).current;
  
  // Animation values for episode list modal
  const episodeListModalOpacity = useRef(new Animated.Value(0)).current;
  const episodeListModalScale = useRef(new Animated.Value(0.95)).current;
  
  
  // Animation values for server modal
  const serverModalOpacity = useRef(new Animated.Value(0)).current;
  const serverModalTranslateY = useRef(new Animated.Value(20)).current;
  

  // Lock orientation when screen mounts or comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // If coming from EpisodePage, immediately set transitionAnim to 1 for instant visibility
      // Otherwise animate smoothly
      if (fromEpisodePageRef.current) {
        transitionAnim.setValue(1);
        // Also ensure loading is false if video is already ready
        if (player && streamUrl && (player.status === 'readyToPlay' || player.playing || player.duration > 0)) {
          setLoading(false);
        }
      }
      // Animate to fullscreen when this screen is focused
      animateToFullscreen();
      
      // Skip orientation locking on web as it's not well supported
      if (Platform.OS === 'web') {
        return;
      }

      let isLocked = false;
      
      const lockOrientation = async () => {
        try {
          // Lock to current orientation preference
          const orientation = isLandscape 
            ? ScreenOrientation.OrientationLock.LANDSCAPE
            : ScreenOrientation.OrientationLock.PORTRAIT_UP;
          await ScreenOrientation.lockAsync(orientation);
          isLocked = true;
        } catch (error) {
          // Silently fail - some devices don't support all orientations
          // Fall back to landscape if portrait is not supported
          if (!isLandscape) {
            try {
              await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
              setIsLandscape(true);
              isLocked = true;
            } catch (fallbackError) {
              // Ignore fallback error
            }
          }
        }
      };

      // Hide navigation bar (iOS home indicator) when video player is active
      const hideNavigationBar = async () => {
        try {
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            await NavigationBar.setVisibilityAsync('hidden');
          }
        } catch (error) {
          // Silently fail if navigation bar API is not available
        }
      };

      // Lock immediately
      lockOrientation();
      hideNavigationBar();

      // Also try locking again after a short delay to ensure it takes effect
      // This is especially important for native builds where orientation changes might be delayed
      const timeoutId = setTimeout(() => {
        if (!isLocked) {
          lockOrientation();
        }
        hideNavigationBar();
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        // Unlock orientation when screen loses focus to allow other screens to rotate freely
        ScreenOrientation.unlockAsync().catch(err => {
          // Silently fail on unlock
        });
        // Show navigation bar again when leaving video player
        NavigationBar.setVisibilityAsync('visible').catch(err => {
          // Silently fail if navigation bar API is not available
        });
      };
    }, [isLandscape])
  );

  // Update current time every minute
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date());
    };
    
    // Update immediately
    updateTime();
    
    // Update every minute
    const interval = setInterval(updateTime, 60000);
    
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    // Player is already initialized in context, no need to fetch
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

  // Reset auto-play flag when streamUrl changes
  useEffect(() => {
    hasAutoPlayed.current = false;
  }, [streamUrl]);

  // Auto-play when streamUrl is set (wait for replaceAsync to complete)
  useEffect(() => {
    if (streamUrl && player) {
      const autoPlay = async () => {
        // Wait for replace to complete if it's in progress
        let waitCount = 0;
        while (isReplacingRef.current && waitCount < 100) {
          await new Promise(resolve => setTimeout(resolve, 50));
          waitCount++;
        }
        
        // If replace is still in progress after waiting, skip auto-play
        if (isReplacingRef.current) {
          console.log('Replace still in progress, skipping auto-play');
          return;
        }
        
        // Skip if already auto-played
        if (hasAutoPlayed.current) {
          console.log('Already auto-played, skipping');
          return;
        }
        
        // IMPORTANT: Check if video is currently paused - if so, don't autoplay
        // This prevents autoplay when navigating from EpisodePage where video was paused
        if (player.paused) {
          console.log('Video is paused, respecting pause state - not autoplaying');
          hasAutoPlayed.current = true; // Mark as handled so we don't try again
          return;
        }
        
        // Try multiple times with increasing delays to ensure video starts
        const attempts = [400, 800, 1500, 2500, 4000];
        
        for (const delay of attempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Check if replace started during wait
          if (isReplacingRef.current) {
            console.log('Replace started during auto-play, aborting');
            return;
          }
          
          // Check again if paused (user might have paused during wait)
          if (player.paused) {
            console.log('Video was paused during autoplay wait, aborting');
            hasAutoPlayed.current = true;
            return;
          }
          
          if (player) {
            try {
              const currentStatus = player.status;
              
              // Check if player is ready and not already playing and not paused
              if (currentStatus === 'readyToPlay' && !player.playing && !player.paused) {
                console.log(`Attempting to play video (${delay}ms delay, status: ${currentStatus})`);
                player.volume = volume;
                player.muted = isMuted;
                player.play();
                setIsPlaying(true);
                
                // Verify it started playing
                await new Promise(resolve => setTimeout(resolve, 500));
                if (player.playing) {
                  hasAutoPlayed.current = true;
                  console.log('Video auto-played successfully');
                  break; // Success, exit loop
                } else if (player.status === 'readyToPlay' && !player.paused) {
                  // Try one more time if still ready and not paused
                  console.log('Retrying play...');
                  player.play();
                  await new Promise(resolve => setTimeout(resolve, 400));
                  if (player.playing) {
                    hasAutoPlayed.current = true;
                    console.log('Video auto-played successfully (second attempt)');
                    break;
                  }
                }
              } else if (player.playing) {
                hasAutoPlayed.current = true;
                console.log('Video already playing');
                break;
              } else if (currentStatus === 'error') {
                console.error('Player status is error, cannot play');
                setError('Video player error. Please try again.');
                setLoading(false);
                break;
              } else if (currentStatus === 'loading') {
                // Still loading, continue waiting
                console.log(`Player still loading (${delay}ms delay)`);
                continue;
              }
            } catch (error) {
              console.error(`Error auto-playing video (attempt ${delay}ms):`, error);
              // Continue to next attempt unless it's a critical error
              if (error.message && error.message.includes('not ready')) {
                continue;
              }
            }
          }
        }
      };
      
      // Delay auto-play to ensure replaceAsync has time to start
      const timeoutId = setTimeout(() => {
      autoPlay();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [streamUrl, volume, isMuted, player]);

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
      toValue: isSliderActive ? 39 : 35,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  }, [isSliderActive]);

  // Keep speed expanded ref updated
  useEffect(() => {
    isSpeedExpandedRef.current = isSpeedExpanded;
  }, [isSpeedExpanded]);

  // Collapse speed and subtitle options when controls are hidden (but keep fullscreen modal open)
  useEffect(() => {
    if (!showControls && !showSubtitleSettingsModal && !showAudioSettingsModal && !showServerSettingsModal && !showEpisodeListModal) {
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
      if (isSubtitleSearchMode) {
        setIsSubtitleSearchMode(false);
      }
    }
  }, [showControls, isSpeedExpanded, isSubtitleExpanded, isSubtitleSearchMode, isAppearanceMode, isDelayMode, showSubtitleSettingsModal, showAudioSettingsModal, showServerSettingsModal, showEpisodeListModal]);

  // Disable controls auto-hide when any modal is active
  useEffect(() => {
    const hasActiveModal = isSubtitleExpanded || isSubtitleSearchMode || isAppearanceMode || isDelayMode || isServerExpanded || showSubtitleSettingsModal || showAudioSettingsModal || showServerSettingsModal || showEpisodeListModal;
    
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
  }, [isSubtitleExpanded, isSubtitleSearchMode, isAppearanceMode, isServerExpanded, showControls, isControlsLocked]);

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

  // Animate fullscreen subtitle settings modal (Netflix-style)
  useEffect(() => {
    const duration = 300;
    
    if (showSubtitleSettingsModal) {
      // Fade in and scale up
      Animated.parallel([
        Animated.timing(subtitleSettingsModalOpacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(subtitleSettingsModalScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade out and scale down
      Animated.parallel([
        Animated.timing(subtitleSettingsModalOpacity, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleSettingsModalScale, {
          toValue: 0.95,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSubtitleSettingsModal]);

  // Animate fullscreen audio settings modal (Netflix-style)
  useEffect(() => {
    const duration = 300;
    
    if (showAudioSettingsModal) {
      // Fade in and scale up
      Animated.parallel([
        Animated.timing(audioSettingsModalOpacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(audioSettingsModalScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade out and scale down
      Animated.parallel([
        Animated.timing(audioSettingsModalOpacity, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(audioSettingsModalScale, {
          toValue: 0.95,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showAudioSettingsModal]);

  // Animate episode list modal
  useEffect(() => {
    const duration = 300;
    
    if (showEpisodeListModal) {
      // Fade in and scale up
      Animated.parallel([
        Animated.timing(episodeListModalOpacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(episodeListModalScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade out and scale down
      Animated.parallel([
        Animated.timing(episodeListModalOpacity, {
          toValue: 0,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(episodeListModalScale, {
          toValue: 0.95,
          duration: duration * 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showEpisodeListModal]);

  // Animate server settings modal (Netflix-style)
  useEffect(() => {
    if (showServerSettingsModal) {
      // Animate in
      Animated.timing(serverSettingsModalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.spring(serverSettingsModalScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      // Animate out
      Animated.timing(serverSettingsModalOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      Animated.timing(serverSettingsModalScale, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showServerSettingsModal]);

  // Animate server modal appearance/disappearance
  useEffect(() => {
    const duration = 200; // Fast but smooth
    
    if (isServerExpanded) {
      // Slide up and fade in
      Animated.parallel([
        Animated.timing(serverModalOpacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(serverModalTranslateY, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down and fade out
      Animated.parallel([
        Animated.timing(serverModalOpacity, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(serverModalTranslateY, {
          toValue: 20,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isServerExpanded]);


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
        // Subtitles - move up when controls appear
        Animated.timing(subtitleBottomPosition, {
          toValue: 120, // Position above bottom controls (height: ~120px + padding: 20px + safe area)
          duration,
          useNativeDriver: false, // Cannot use native driver for bottom position
        }),
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
        // Subtitles - move down when controls hide
        Animated.timing(subtitleBottomPosition, {
          toValue: 60, // Lower position when controls are hidden (closer to bottom but still visible)
          duration,
          useNativeDriver: false, // Cannot use native driver for bottom position
        }),
      ]).start();
    }
  }, [showControls, isControlsLocked]);

  const startControlsTimer = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Don't auto-hide controls if any modal is active
    const hasActiveModal = isSubtitleExpanded || isSubtitleSearchMode || isAppearanceMode || isDelayMode || isServerExpanded || showSubtitleSettingsModal || showAudioSettingsModal || showServerSettingsModal || showEpisodeListModal;
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
      const hasActiveModal = isSubtitleExpanded || isSubtitleSearchMode || isAppearanceMode || isDelayMode || isServerExpanded || showSubtitleSettingsModal || showAudioSettingsModal || showServerSettingsModal || showEpisodeListModal;
      if (!hasActiveModal) {
      startControlsTimer();
      }
    }
  };

  // Save watch progress
  const saveWatchProgress = async () => {
    if (!item || !item.id || !position || !duration || position === 0 || duration === 0) return;
    
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      if (episode && season !== null && episodeNumber !== null) {
        await WatchProgressService.saveProgress(
          item.id,
          mediaType,
          position,
          duration,
          season,
          episodeNumber
        );
      } else {
        await WatchProgressService.saveProgress(
          item.id,
          mediaType,
          position,
          duration
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

  const fetchStreamUrl = async (selectedServerName = null) => {
    try {
      setLoading(true);
      setError(null);
      setIsRetryingWithVidfast(false);
      setVideasyFailed(false);
      videasyRetryRef.current = false;
      // Reset auto-subtitle selection for new video
      autoSubtitleAttemptedRef.current = false;
      setSelectedSubtitleTrack(null);

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
        
        // Verify the file still exists before using it
        try {
          const fileInfo = await FileSystem.getInfoAsync(localVideoPath);
          if (!fileInfo.exists) {
            console.error('Downloaded video file does not exist:', localVideoPath);
            setError('Downloaded video file not found. Please re-download.');
            setLoading(false);
            return;
          }
          
          console.log('Downloaded video file exists, size:', fileInfo.size, 'bytes');
          
          // Convert file path to proper file:// URI for expo-video
          // expo-video requires file:// URIs for local files (similar to Sora's implementation)
          // Sora uses asset.localURL.absoluteString which ensures proper file:// format
          let fileUri = localVideoPath;
          if (!fileUri.startsWith('file://')) {
            // If path doesn't start with file://, convert it
            // Normalize the path first
            if (fileUri.startsWith(FileSystem.documentDirectory)) {
              // Path already includes document directory
              fileUri = `file://${fileUri}`;
            } else if (fileUri.startsWith('/')) {
              // Absolute path starting with / - add file:// prefix
              fileUri = `file://${fileUri}`;
            } else {
              // Relative path - prepend document directory
              const normalizedPath = fileUri.replace(/^\/+/, ''); // Remove leading slashes
              fileUri = `file://${FileSystem.documentDirectory}${normalizedPath}`;
            }
          }
          
          // Ensure the URI doesn't have double slashes (except after file:)
          fileUri = fileUri.replace(/([^:]\/)\/+/g, '$1');
          
          console.log('Converted file path to URI:', fileUri);
          
          // For M3U8 files, ensure the file path is properly formatted
          // expo-video should support local file:// URIs
          if (localVideoPath.toLowerCase().endsWith('.m3u8')) {
            console.log('Playing local M3U8 playlist:', fileUri);
            // The playlist should contain absolute file:// URIs for segments
            // Verify playlist can be read
            try {
              const playlistContent = await FileSystem.readAsStringAsync(localVideoPath);
              console.log('M3U8 playlist content preview (first 500 chars):', playlistContent.substring(0, 500));
            } catch (readError) {
              console.error('Error reading M3U8 playlist:', readError);
            }
          }
          
        setStreamUrl(fileUri);
        
        // Set up subtitle tracks from downloaded data if available
        const tracks = [
          { id: 'none', name: 'Off', language: null, url: null },
        ];
        if (downloadedData && downloadedData.subtitles && downloadedData.subtitles.length > 0) {
          tracks.push(...downloadedData.subtitles);
        }
          // Sort tracks by priority: English first, then Arabic, then others
          const sortedTracks = sortSubtitleTracksByPriority(tracks);
          setSubtitleTracks(sortedTracks);
          // Auto-enable subtitles for downloaded videos
          autoEnableSubtitles(sortedTracks);
        } catch (fileError) {
          console.error('Error checking downloaded video file:', fileError);
          setError('Error accessing downloaded video. Please try re-downloading.');
          setLoading(false);
        }
      } else {
        // Fetch from streaming service
        // Get the selected video source
        const source = await StorageService.getVideoSource();
        const preferredSource = source;
        setVideoSource(source);

        const isMovie = !episode;
        const normalizedSeason = season ? String(season) : '1';
        const normalizedEpisodeNumber = episodeNumber ? String(episodeNumber) : '1';

        const isVideasyPreferred = source === 'videasy';
        
        // Select the appropriate service
        let service;
        let currentSource;
        if (isVideasyPreferred) {
          service = {
            async fetchEpisodeWithSubtitles(tmdbId, seasonValue, episodeValue, selectedServerName) {
              return await VideasyService.fetchEpisodeWithSubtitles(
                tmdbId,
                seasonValue,
                episodeValue,
                { forceSeasonOne: true },
                selectedServerName
              );
            },
            fetchMovieWithSubtitles: VideasyService.fetchMovieWithSubtitles,
          };
          currentSource = 'videasy';
        } else {
          service =
            source === 'n3tflix'
              ? N3tflixService
              : source === 'vidfast'
              ? VidfastService
              : source === 'videasy'
              ? VideasyService
              : VixsrcService;
          currentSource = source;
        }

        const attemptVideasyFallback = async () => {
          if (!isVideasyPreferred || currentSource === 'videasy' || videasyFailed) {
            return null;
          }
          try {
            let videasyResult;
            if (!isMovie && episode && season && episodeNumber) {
              videasyResult = await VideasyService.fetchEpisodeWithSubtitles(
                tmdbId,
                normalizedSeason,
                normalizedEpisodeNumber,
                { forceSeasonOne: true }
              );
            } else {
              videasyResult = await VideasyService.fetchMovieWithSubtitles(tmdbId);
            }
            if (videasyResult && videasyResult.streamUrl) {
              console.log('[VideoPlayer] Videasy fallback result:', videasyResult.streamUrl ? 'Success' : 'No stream URL');
              currentSource = 'videasy';
              setVideoSource('videasy');
              return videasyResult;
            }
          } catch (videasyError) {
            console.error('[VideoPlayer] Videasy fallback error:', videasyError);
            setVideasyFailed(true);
          }
          return null;
        };
        let result = null;

        try {
          if (episode && season && episodeNumber) {
            result = await service.fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber, selectedServerName);
          } else {
            result = await service.fetchMovieWithSubtitles(tmdbId, selectedServerName);
          }
        } catch (serviceError) {
          if (!result) {
            const videasyFallback = await attemptVideasyFallback();
            if (videasyFallback) {
              result = videasyFallback;
            }
          }

          if (!result && currentSource === 'videasy') {
            console.log('[VideoPlayer] Videasy failed, falling back to preferred source:', preferredSource);
            service =
              preferredSource === 'n3tflix'
                ? N3tflixService
                : preferredSource === 'vidfast'
                ? VidfastService
                : preferredSource === 'videasy'
                ? VixsrcService
                : VixsrcService;
            currentSource = preferredSource === 'videasy' ? 'vixsrc' : preferredSource;
            try {
              if (episode && season && episodeNumber) {
                result = await service.fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber, selectedServerName);
              } else {
                result = await service.fetchMovieWithSubtitles(tmdbId, selectedServerName);
              }
            } catch (preferredError) {
              console.error('[VideoPlayer] Preferred source fallback error:', preferredError);
            }
          }

          if (result) {
            // Already recovered, skip further fallback handling
            console.log('[VideoPlayer] Recovered from service error via fallback');
          } else {
          // Check if it's a 404 or 403 error from vixsrc
          const errorMessage = serviceError?.message || String(serviceError);
          const is404or403 = errorMessage.includes('404') || errorMessage.includes('403');
          const isVixsrc = currentSource === 'vixsrc' || (!currentSource || currentSource === 'vixsrc');
          
          if (is404or403 && isVixsrc) {
            console.log('Vixsrc returned 404/403, switching to vidfast...');
            setIsRetryingWithVidfast(true);
            service = VidfastService;
            currentSource = 'vidfast';
            setVideoSource('vidfast');
            
            // Retry with vidfast
            try {
              if (episode && season && episodeNumber) {
                result = await service.fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber, selectedServerName);
              } else {
                result = await service.fetchMovieWithSubtitles(tmdbId, selectedServerName);
              }
              console.log('[VideoPlayer] Vidfast fallback result:', result ? (result.streamUrl ? 'Success' : 'No stream URL') : 'Failed');
            } catch (vidfastError) {
              console.error('[VideoPlayer] Vidfast fallback failed:', vidfastError);
              // Set result to null so it can be handled below
              result = null;
            }
            
            // Third fallback: If Vidfast failed for episodes, try with season "01"
            if ((!result || !result.streamUrl) && episode && season && episodeNumber && currentSource === 'vidfast') {
              console.log(`[VideoPlayer] Vidfast failed, trying with season "01" (original: S${season}E${episodeNumber})...`);
              try {
                result = await service.fetchEpisodeWithSubtitles(tmdbId, '01', episodeNumber, selectedServerName);
                console.log('[VideoPlayer] Vidfast with S01 result:', result ? (result.streamUrl ? 'Success' : 'No stream URL') : 'Failed');
              } catch (s01Error) {
                console.error('[VideoPlayer] Vidfast with S01 also failed:', s01Error);
                result = null;
              }
            }
          } else {
            // Re-throw if it's not a vixsrc 404/403
            throw serviceError;
          }
          }
        }

        // Check if vixsrc returned null streamUrl (which happens on 404/403)
        // VixsrcService catches errors and returns null instead of throwing
        // Only check if we haven't already retried and the original source was vixsrc
        if ((!result || !result.streamUrl) && source === 'vixsrc' && currentSource === 'vixsrc') {
          console.log('[VideoPlayer] Vixsrc returned null streamUrl, switching to vidfast...');
          console.log('[VideoPlayer] Result:', result, 'Source:', source, 'CurrentSource:', currentSource);
          setIsRetryingWithVidfast(true);
          service = VidfastService;
          currentSource = 'vidfast';
          setVideoSource('vidfast');
          
          // Retry with vidfast
          try {
            if (episode && season && episodeNumber) {
              result = await service.fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber, selectedServerName);
            } else {
              result = await service.fetchMovieWithSubtitles(tmdbId, selectedServerName);
            }
            console.log('[VideoPlayer] Vidfast result:', result ? 'Success' : 'Failed');
          } catch (vidfastError) {
            console.error('[VideoPlayer] Vidfast also failed:', vidfastError);
            // Let it fall through to error handling
          }
          
          // Third fallback: If Vidfast failed for episodes, try with season "01"
          if ((!result || !result.streamUrl) && episode && season && episodeNumber && currentSource === 'vidfast') {
            console.log(`[VideoPlayer] Vidfast failed, trying with season "01" (original: S${season}E${episodeNumber})...`);
            try {
              result = await service.fetchEpisodeWithSubtitles(tmdbId, '01', episodeNumber, selectedServerName);
              console.log('[VideoPlayer] Vidfast with S01 result:', result ? (result.streamUrl ? 'Success' : 'No stream URL') : 'Failed');
            } catch (s01Error) {
              console.error('[VideoPlayer] Vidfast with S01 also failed:', s01Error);
              result = null;
            }
          }
        }

        // No additional final fallback to Videasy when not selected
        if (result && result.streamUrl) {
          setStreamUrl(result.streamUrl);
          
          // Set up subtitle tracks
          const tracks = [
            { id: 'none', name: 'Off', language: null, url: null },
            ...result.subtitles,
          ];
          // Sort tracks by priority: English first, then Arabic, then others
          const sortedTracks = sortSubtitleTracksByPriority(tracks);
          setSubtitleTracks(sortedTracks);
          
          // Auto-enable English embedded subtitle or fetch from OpenSubtitles
          autoEnableSubtitles(sortedTracks);
          
          // Handle audio tracks returned by source
          if (result.audioTracks && result.audioTracks.length > 0) {
            console.log('[VideoPlayerScreen] Found audio tracks from source:', result.audioTracks.length);
            setAudioTracks(result.audioTracks);
            // Set default audio track
            if (result.defaultAudioTrack) {
              setSelectedAudioTrack(result.defaultAudioTrack);
            } else if (result.audioTracks.length > 0) {
              setSelectedAudioTrack(result.audioTracks[0]);
            }
          } else if (result.streamUrl.includes('.m3u8') || result.streamUrl.includes('/playlist/')) {
            // Extract audio tracks from M3U8 playlist if it's an HLS stream
            try {
              console.log('[VideoPlayerScreen] Extracting audio tracks from M3U8 playlist:', result.streamUrl);
              const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Referer': new URL(result.streamUrl).origin,
                'Origin': new URL(result.streamUrl).origin,
              };
              const parsed = await M3U8Parser.fetchAndParse(result.streamUrl, headers);
              if (parsed.audioTracks && parsed.audioTracks.length > 0) {
                console.log('[VideoPlayerScreen] Found audio tracks:', parsed.audioTracks.length);
                setAudioTracks(parsed.audioTracks);
                // Set first audio track as default
                if (parsed.audioTracks.length > 0) {
                  setSelectedAudioTrack(parsed.audioTracks[0]);
                }
              } else {
                console.log('[VideoPlayerScreen] No audio tracks found in M3U8 playlist');
                // Set default audio track
                setAudioTracks([{ id: 'default', name: 'Default', language: 'unknown', groupId: null, uri: null }]);
                setSelectedAudioTrack({ id: 'default', name: 'Default', language: 'unknown', groupId: null, uri: null });
              }
            } catch (audioError) {
              console.error('[VideoPlayerScreen] Error extracting audio tracks:', audioError);
              // Set default audio track on error
              setAudioTracks([{ id: 'default', name: 'Default', language: 'unknown', groupId: null, uri: null }]);
              setSelectedAudioTrack({ id: 'default', name: 'Default', language: 'unknown', groupId: null, uri: null });
            }
          } else {
            // For non-HLS streams, set default audio track
            setAudioTracks([{ id: 'default', name: 'Default', language: 'unknown', groupId: null, uri: null }]);
            setSelectedAudioTrack({ id: 'default', name: 'Default', language: 'unknown', groupId: null, uri: null });
          }
          
          // Store server list and current server for Vidfast
          if (currentSource === 'vidfast' && result.serverList) {
            setAvailableServers(result.serverList);
            setCurrentServer(result.currentServer);
          }
          
          // Reset retry flag after successful fetch
          setIsRetryingWithVidfast(false);
        } else {
          setError('Could not extract video stream URL.');
        }
      }
    } catch (err) {
      console.error('Error fetching stream:', err);
      setIsRetryingWithVidfast(false);
      setError('Failed to load video');
      setLoading(false);
    }
    // Don't set loading to false here - wait until video reaches 00:00:01
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

  // Update current subtitle text based on position (with delay applied)
  useEffect(() => {
    if (selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none' && subtitleCuesRef.current.length > 0) {
      // Apply delay to position (delay can be negative to show earlier, positive to show later)
      const adjustedPosition = position + subtitleDelay;
      const currentCue = subtitleCuesRef.current.find(
        cue => adjustedPosition >= cue.startTime && adjustedPosition <= cue.endTime
      );
      setCurrentSubtitleText(currentCue ? currentCue.text : '');
    } else {
      setCurrentSubtitleText('');
    }
  }, [position, selectedSubtitleTrack, subtitleDelay]);


  // Handle playback progress updates using interval (expo-video doesn't have onProgressUpdate with detailed info)
  useEffect(() => {
    if (!player || !streamUrl) return;
    
    const interval = setInterval(() => {
      try {
        // Check if player is loaded and has valid properties
        // expo-video player.status can be 'idle', 'loading', 'readyToPlay', or 'error'
        if (player.status === 'readyToPlay' || player.playing) {
          // Progress is tracked in context, just update loading state
          const currentTimeSeconds = player.currentTime || 0;
          // If coming from EpisodePage, set loading to false immediately when video is ready
          // Otherwise wait for at least 1 second of playback
          if (fromEpisodePageRef.current) {
            if (loading && (player.duration > 0 || currentTimeSeconds > 0)) {
              setLoading(false);
            }
          } else if (loading && currentTimeSeconds >= 1) {
            setLoading(false);
          }

          // Check if episode is in the last 4 minutes and show next episode button
          if (episode && season !== null && episodeNumber !== null && duration > 0) {
            const timeRemaining = duration - position;
            const fourMinutesInMs = 4 * 60 * 1000; // 4 minutes in milliseconds
            if (timeRemaining <= fourMinutesInMs && nextEpisode) {
              setShowNextEpisodeButton(true);
            } else {
              setShowNextEpisodeButton(false);
            }
          }
            
          // Check if video finished (only check once)
          if (duration > 0 && position >= duration - 100 && !hasVideoFinished.current) {
            // Video finished (within 100ms of end) - use flag to prevent multiple triggers
            hasVideoFinished.current = true;
            setTimeout(async () => {
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
            }, 500);
          }
        }
      } catch (error) {
        // Silently handle errors in progress updates
        console.error('Error updating progress:', error);
      }
    }, 250); // Update every 250ms for better performance
    
    return () => clearInterval(interval);
  }, [player, loading, episode, season, episodeNumber, nextEpisode, streamUrl, item, navigation]);

  const togglePlayPause = async () => {
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
        // Ensure volume and mute state are set before playing
        player.volume = volume;
        player.muted = isMuted;
        
        // Force play - clear any blocking states
        try {
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
                  player.volume = volume;
                  player.muted = isMuted;
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
                player.volume = volume;
                player.muted = isMuted;
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
      
      resetControlsTimer();
    } catch (error) {
      // Update UI based on actual state
      setTimeout(() => {
        if (player) {
          setUiIsPlaying(player.playing === true);
        }
      }, 200);
    }
  };

  const seek = async (seconds) => {
    resetControlsTimer();
    if (player) {
      const newPosition = Math.max(0, Math.min((position + seconds * 1000) / 1000, duration / 1000));
      player.currentTime = newPosition;
    }
  };

  const seekTo = async (milliseconds) => {
    if (player) {
      player.currentTime = milliseconds / 1000; // Convert to seconds
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
      // Use context seek function
      if (player && player.duration > 0) {
        player.currentTime = newPosition / 1000;
      }
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


  const changePlaybackRate = async (rate, shouldCollapse = true) => {
    resetControlsTimer();
    setPlaybackRate(rate);
    if (player) {
      player.playbackRate = rate;
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
      if (isServerExpanded) {
        setIsServerExpanded(false);
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
    // Show fullscreen subtitle settings modal (Netflix-style)
    setShowSubtitleSettingsModal(true);
    // Hide other modals
    setIsSubtitleExpanded(false);
    if (isServerExpanded) {
      setIsServerExpanded(false);
    }
    if (showAudioSettingsModal) {
      setShowAudioSettingsModal(false);
    }
    // Hide controls when subtitle settings modal is shown
    setShowControls(false);
  };

  const toggleAudioSettingsModal = () => {
    resetControlsTimer();
    // Show fullscreen audio settings modal (Netflix-style)
    setShowAudioSettingsModal(true);
    // Hide other modals
    setIsSpeedExpanded(false);
    if (isSubtitleExpanded) {
      setIsSubtitleExpanded(false);
    }
    if (isServerExpanded) {
      setIsServerExpanded(false);
    }
    if (showSubtitleSettingsModal) {
      setShowSubtitleSettingsModal(false);
    }
    // Hide controls when audio settings modal is shown
    setShowControls(false);
  };

  const closeAudioSettingsModal = () => {
    setShowAudioSettingsModal(false);
    // Show controls again after closing
    resetControlsTimer();
  };

  const toggleEpisodeListModal = () => {
    resetControlsTimer();
    
    if (!showEpisodeListModal) {
      // Opening modal - show immediately, fetch data in background
      setShowEpisodeListModal(true);
      setSelectedSeasonForList(season || 1);
      
      // Fetch data after modal is shown
      fetchSeasonsAndEpisodes();
    } else {
      // Closing modal
      setShowEpisodeListModal(false);
    }
    
    // Hide other modals
    setIsSpeedExpanded(false);
    if (isSubtitleExpanded) {
      setIsSubtitleExpanded(false);
    }
    if (isServerExpanded) {
      setIsServerExpanded(false);
    }
    if (showSubtitleSettingsModal) {
      setShowSubtitleSettingsModal(false);
    }
    if (showAudioSettingsModal) {
      setShowAudioSettingsModal(false);
    }
    if (showServerSettingsModal) {
      setShowServerSettingsModal(false);
    }
    // Hide controls when episode list modal is shown
    setShowControls(false);
  };

  const closeEpisodeListModal = () => {
    setShowEpisodeListModal(false);
  };

  const fetchSeasonsAndEpisodes = async () => {
    if (!item || !item.id) return;
    
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    if (mediaType !== 'tv') return;
    
    setLoadingEpisodes(true);
    try {
      // Fetch TV details to get seasons
      const tvDetails = await TMDBService.fetchTVDetails(item.id);
      if (tvDetails && tvDetails.seasons) {
        const validSeasons = tvDetails.seasons.filter(s => s.season_number >= 0);
        setSeasons(validSeasons);
        
        // Fetch episodes for all seasons (or at least current season)
        const episodesData = {};
        const seasonsToFetch = validSeasons.map(s => s.season_number);
        
        for (const seasonNum of seasonsToFetch) {
          try {
            const episodes = await TMDBService.fetchTVEpisodes(item.id, seasonNum);
            episodesData[seasonNum] = episodes;
          } catch (error) {
            console.error(`Error fetching episodes for season ${seasonNum}:`, error);
            episodesData[seasonNum] = [];
          }
        }
        
        setEpisodesBySeason(episodesData);
      }
    } catch (error) {
      console.error('Error fetching seasons and episodes:', error);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleEpisodeSelect = async (selectedEpisode, selectedSeasonNum) => {
    if (!item) return;
    
    try {
      // Close modal first
      closeEpisodeListModal();
      
      // Navigate to selected episode
      navigation.replace('VideoPlayer', {
        item,
        episode: selectedEpisode,
        season: selectedSeasonNum,
        episodeNumber: selectedEpisode.episode_number,
        resumePosition: null, // Start from beginning
      });
    } catch (error) {
      console.error('Error switching episode:', error);
    }
  };

  const selectAudioTrack = async (track) => {
    resetControlsTimer();
    setSelectedAudioTrack(track);
    console.log('[VideoPlayerScreen] Selected audio track:', track);
  };

  const closeSubtitleSettingsModal = () => {
    setShowSubtitleSettingsModal(false);
    setIsSubtitleSearchMode(false);
    setIsAppearanceMode(false);
    setIsDelayMode(false);
    setExpandedLanguageGroup(null);
    setSubtitleSearchResults([]);
    setSubtitleSearchQuery('');
    // Show controls again after closing
    resetControlsTimer();
  };

  const toggleServerSettingsModal = () => {
    resetControlsTimer();
    // Show fullscreen server settings modal (Netflix-style)
    setShowServerSettingsModal(true);
    // Hide other modals
    setIsSpeedExpanded(false);
    if (isSubtitleExpanded) {
      setIsSubtitleExpanded(false);
    }
    if (isServerExpanded) {
      setIsServerExpanded(false);
    }
    if (showSubtitleSettingsModal) {
      setShowSubtitleSettingsModal(false);
    }
    if (showAudioSettingsModal) {
      setShowAudioSettingsModal(false);
    }
    // Hide controls when server settings modal is shown
    setShowControls(false);
  };

  const closeServerSettingsModal = () => {
    setShowServerSettingsModal(false);
    // Show controls again after closing
    resetControlsTimer();
  };

  const toggleServerMenu = () => {
    resetControlsTimer();
    setIsServerExpanded(!isServerExpanded);
    if (isSubtitleExpanded) {
      setIsSubtitleExpanded(false);
    }
  };


  const handleLoadSRT = () => {
    resetControlsTimer();
    // TODO: Implement SRT file picker
    console.log('Load SRT file');
    // This would typically open a file picker
    // For now, just log it
  };

  const handleLoadSubtitlesOnline = async () => {
    // Show search view within the same modal
    setIsSubtitleSearchMode(true);
    // Initialize search query with current movie/episode title
    // For episodes, try just the show title first (episode names can be too specific)
    let searchTitle = episode 
      ? (item?.title || item?.name || '').trim()
      : (item?.title || item?.name || '').trim();
    
    // Add season and episode format if available
    if (season !== null && season !== undefined && episodeNumber !== null && episodeNumber !== undefined) {
      const seasonStr = String(season).padStart(2, '0');
      const episodeStr = String(episodeNumber).padStart(2, '0');
      searchTitle = `${searchTitle} S${seasonStr}E${episodeStr}`;
    }
    
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
    setSubtitleSearchResults([]);
    setSubtitleSearchQuery('');
  };

  const handleBackFromSearch = () => {
    setIsSubtitleSearchMode(false);
    setSubtitleSearchResults([]);
    setSubtitleSearchQuery('');
  };

  const handleOpenAppearance = () => {
    setIsAppearanceMode(true);
  };

  const handleBackFromAppearance = () => {
    setIsAppearanceMode(false);
  };

  const handleOpenDelay = () => {
    setIsDelayMode(true);
  };

  const handleBackFromDelay = () => {
    setIsDelayMode(false);
  };

  // Auto-enable English embedded subtitle or fetch from OpenSubtitles
  const autoEnableSubtitles = async (tracks) => {
    try {
      console.log('[Auto-Subtitle] Starting auto-enable, tracks:', tracks?.length, 'selectedTrack:', selectedSubtitleTrack);
      
      // Skip if already attempted for this video
      if (autoSubtitleAttemptedRef.current) {
        console.log('[Auto-Subtitle] Already attempted, skipping');
        return;
      }

      // Check if there's already a selected subtitle track (user preference) - but only if it's not 'none'
      // Don't skip if it's null or 'none' - we want to auto-enable
      if (selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none') {
        console.log('[Auto-Subtitle] Subtitle already selected by user:', selectedSubtitleTrack.name, 'skipping auto-enable');
        autoSubtitleAttemptedRef.current = true;
        return;
      }

      // Mark as attempted immediately to prevent duplicate calls
      autoSubtitleAttemptedRef.current = true;

      if (!tracks || tracks.length === 0) {
        console.log('[Auto-Subtitle] No tracks available');
        return;
      }

      // Filter out 'none' option for checking
      const availableTracks = tracks.filter(track => track.id !== 'none');
      console.log('[Auto-Subtitle] Checking', availableTracks.length, `available tracks (excluding "Off") for ${preferredLanguage} subtitles`);

      // If no tracks except 'none', still try to fetch from OpenSubtitles
      if (availableTracks.length === 0) {
        console.log('[Auto-Subtitle] No embedded subtitle tracks found, will try OpenSubtitles');
      }

      // Helper function to check if track matches preferred language
      const matchesPreferredLanguage = (track) => {
        const lang = (track.language || '').toLowerCase().trim();
        const name = (track.name || '').toLowerCase().trim();
        
        // Get preferred language name from LANGUAGE_CODES if available
        const preferredLangName = LANGUAGE_CODES[preferredLanguage]?.toLowerCase() || preferredLanguage.toLowerCase();
        
        // Check for preferred language in various formats
        return lang === preferredLanguage.toLowerCase() ||
               lang === preferredLanguage.substring(0, 2).toLowerCase() ||
               lang === preferredLangName ||
               lang.startsWith(preferredLanguage.substring(0, 2).toLowerCase()) ||
               lang.match(new RegExp(`\\b(${preferredLangName}|${preferredLanguage})\\b`, 'i')) ||
               name.includes(preferredLangName) ||
               name.includes(preferredLanguage.toLowerCase()) ||
               name.match(new RegExp(`\\b(${preferredLangName}|${preferredLanguage})\\b`, 'i'));
      };

      // Find preferred language embedded subtitle (exclude 'none' and online subtitles)
      const preferredTrack = availableTracks.find(track => {
        // Check if it's an embedded subtitle (has URL) or has content
        const isEmbedded = track.url || track.content;
        if (!isEmbedded) {
          console.log('[Auto-Subtitle] Track', track.name, 'is not embedded (no URL or content)');
          return false;
        }
        
        // Check language field
        const lang = (track.language || '').toLowerCase().trim();
        const name = (track.name || '').toLowerCase().trim();
        
        console.log('[Auto-Subtitle] Checking track:', name, 'lang:', lang, 'against preferred:', preferredLanguage);
        
        return matchesPreferredLanguage(track);
      });

      if (preferredTrack) {
        // Auto-enable preferred language embedded subtitle
        console.log('[Auto-Subtitle] Auto-enabling', preferredLanguage, 'embedded subtitle:', preferredTrack.name);
        await selectSubtitleTrack(preferredTrack);
        return;
      }

      // No preferred language embedded subtitle found, fetch from OpenSubtitles
      console.log(`[Auto-Subtitle] No ${preferredLanguage} embedded subtitle found, fetching from OpenSubtitles...`);
      
      // Build search query
      let searchTitle = episode 
        ? (item?.title || item?.name || '').trim()
        : (item?.title || item?.name || '').trim();
      
      // Add season and episode format if available
      if (season !== null && season !== undefined && episodeNumber !== null && episodeNumber !== undefined) {
        const seasonStr = String(season).padStart(2, '0');
        const episodeStr = String(episodeNumber).padStart(2, '0');
        searchTitle = `${searchTitle} S${seasonStr}E${episodeStr}`;
      }

      console.log('[Auto-Subtitle] Search title:', searchTitle, 'item:', item?.title || item?.name);

      if (!searchTitle) {
        console.log('[Auto-Subtitle] No search title available, skipping auto-fetch');
        return;
      }

      // Get IMDb ID if available
      const imdbId = item?.imdb_id || item?.external_ids?.imdb_id || null;
      console.log('[Auto-Subtitle] Searching OpenSubtitles with:', { searchTitle: searchTitle.trim(), language: preferredLanguage, imdbId });
      
      // Search for preferred language subtitles
      const results = await OpenSubtitlesService.searchSubtitles(
        searchTitle.trim(),
        preferredLanguage, // Preferred language
        imdbId
      );

      console.log('[Auto-Subtitle] OpenSubtitles search results:', results?.length || 0, 'subtitles found');

              if (results && results.length > 0) {
                // Get the top result (first one)
                const topResult = results[0];
                console.log(`[Auto-Subtitle] Auto-fetching top ${preferredLanguage} subtitle:`, topResult.name || topResult.id);
        
        try {
          // Download and apply the subtitle
          const fileContent = await OpenSubtitlesService.downloadSubtitle(topResult.fileId);
          
          if (fileContent) {
            // Parse the subtitle file
            const cues = parseSRT(fileContent);
            subtitleCuesRef.current = cues;
            console.log('[Auto-Subtitle] Auto-loaded', cues.length, 'subtitle cues from OpenSubtitles');
            
            // Create a track object for the subtitle
            const newTrack = {
              id: topResult.id,
              name: `${topResult.languageName || topResult.language} - ${topResult.release || 'Auto-fetched'}`,
              language: topResult.language,
              url: null,
              content: fileContent,
            };
            
            // Add the new track to subtitle tracks list
            setSubtitleTracks((prevTracks) => {
              const existingIndex = prevTracks.findIndex(t => t.id === newTrack.id);
              if (existingIndex >= 0) {
                const updatedTracks = [...prevTracks];
                updatedTracks[existingIndex] = newTrack;
                return sortSubtitleTracksByPriority(updatedTracks);
              } else {
                return sortSubtitleTracksByPriority([...prevTracks, newTrack]);
              }
            });
            
            // Set the new track as selected
            setSelectedSubtitleTrack(newTrack);
            console.log('[Auto-Subtitle] Auto-enabled subtitle:', newTrack.name);
          } else {
            console.log('[Auto-Subtitle] Failed to download subtitle file content');
          }
        } catch (downloadError) {
          console.error('[Auto-Subtitle] Error downloading subtitle:', downloadError);
        }
      } else {
        console.log(`[Auto-Subtitle] No ${preferredLanguage} subtitles found on OpenSubtitles`);
      }
    } catch (error) {
      console.error('[Auto-Subtitle] Error in auto-enable subtitles:', error);
      // Reset attempt flag on error so it can retry if needed
      autoSubtitleAttemptedRef.current = false;
      // Silently fail - don't show error to user for auto-feature
    }
  };

  const searchSubtitles = async () => {
    if (!subtitleSearchQuery.trim()) {
      return;
    }

    setIsSearchingSubtitles(true);
    setSubtitleSearchResults([]);

    try {
      // Build search query with season and episode if available
      let searchQuery = subtitleSearchQuery.trim();
      if (season !== null && season !== undefined && episodeNumber !== null && episodeNumber !== undefined) {
        const seasonStr = String(season).padStart(2, '0');
        const episodeStr = String(episodeNumber).padStart(2, '0');
        searchQuery = `${searchQuery} S${seasonStr}E${episodeStr}`;
      }
      
      console.log('Searching subtitles:', searchQuery, 'Language:', subtitleSearchLanguage);
      
      // Get IMDb ID if available
      const imdbId = item?.imdb_id || item?.external_ids?.imdb_id || null;
      console.log('Using IMDb ID:', imdbId);
      
      const results = await OpenSubtitlesService.searchSubtitles(
        searchQuery,
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
        
        // Add the new track to subtitle tracks list and select it
        setSubtitleTracks((prevTracks) => {
          // Check if track already exists
          const existingIndex = prevTracks.findIndex(t => t.id === newTrack.id);
          if (existingIndex >= 0) {
            // Update existing track
            const updatedTracks = [...prevTracks];
            updatedTracks[existingIndex] = newTrack;
            return sortSubtitleTracksByPriority(updatedTracks);
          } else {
            // Add new track and sort by priority
            return sortSubtitleTracksByPriority([...prevTracks, newTrack]);
          }
        });
        
        // Set the new track as selected
        setSelectedSubtitleTrack(newTrack);
        
        // Go back to settings view
        setIsSubtitleSearchMode(false);
        setSubtitleSearchResults([]);
        setSubtitleSearchQuery('');
        
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
    
    // Don't close fullscreen modal - user might want to adjust settings
  };

  const toggleLanguageGroup = (languageKey) => {
    if (expandedLanguageGroup === languageKey) {
      setExpandedLanguageGroup(null);
    } else {
      setExpandedLanguageGroup(languageKey);
    }
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

  const toggleOrientation = async () => {
    // Skip on web as orientation locking is not well supported
    if (Platform.OS === 'web') {
      return;
    }

    resetControlsTimer();
    
    // If in landscape mode, navigate back to EpisodePage (minimize)
    if (isLandscape) {
      // If we came from EpisodePage, just go back (it's still in the stack)
      if (route.params?.fromEpisodePage) {
        // Unlock orientation first
        try {
          await ScreenOrientation.unlockAsync();
        } catch (error) {
          // Ignore unlock error
        }
        
        // Save progress before going back (progress is tracked in context)
        await saveWatchProgress();
        
        // Animate to minimized before going back
        animateToMinimized();
        
        // Small delay to let animation start, then navigate back
        setTimeout(() => {
          navigation.goBack();
        }, 100);
        return;
      }
    }
    
    // Otherwise, toggle orientation normally
    const newIsLandscape = !isLandscape;
    
    try {
      const orientation = newIsLandscape 
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP;
      await ScreenOrientation.lockAsync(orientation);
      setIsLandscape(newIsLandscape);
    } catch (error) {
      // If portrait is not supported, keep landscape mode
      if (!newIsLandscape) {
        // Portrait not supported, revert to landscape
        try {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          setIsLandscape(true);
        } catch (fallbackError) {
          // Ignore fallback error
        }
      }
    }
  };

  const toggleMute = async () => {
    resetControlsTimer();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (player) {
      player.muted = newMuted;
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
    if (player) {
      player.volume = clampedVolume;
      player.muted = clampedVolume === 0;
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

  // Calculate distance between two touches
  const getDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [touch1, touch2] = touches;
    const dx = touch2.pageX - touch1.pageX;
    const dy = touch2.pageY - touch1.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getPinchCenter = (touches) => {
    if (touches.length < 2) return { x: 0, y: 0 };
    const [touch1, touch2] = touches;
    return {
      x: (touch1.pageX + touch2.pageX) / 2,
      y: (touch1.pageY + touch2.pageY) / 2,
    };
  };

  // Constrain pan offsets to keep video within bounds
  const constrainPan = (scale, offsetX, offsetY) => {
    if (scale <= 1) return { x: 0, y: 0 };
    
    const maxOffsetX = (SCREEN_WIDTH * (scale - 1)) / 2;
    const maxOffsetY = (SCREEN_HEIGHT * (scale - 1)) / 2;
    
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY)),
    };
  };

  // Reset zoom function
  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(zoomScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }),
      Animated.spring(panOffsetX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }),
      Animated.spring(panOffsetY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }),
    ]).start();
    zoomScaleState.current = 1;
    panOffsetXState.current = 0;
    panOffsetYState.current = 0;
  };

  // Zoom to a specific point
  const zoomToPoint = (centerX, centerY, targetScale = 2) => {
    const currentScale = zoomScaleState.current;
    
    if (currentScale > 1) {
      // Already zoomed, reset
      resetZoom();
    } else {
      // Zoom to target scale centered on tap point
      // Calculate the offset needed to center the tap point
      const offsetX = (SCREEN_WIDTH / 2 - centerX) * (targetScale - 1);
      const offsetY = (SCREEN_HEIGHT / 2 - centerY) * (targetScale - 1);
      
      const constrained = constrainPan(targetScale, offsetX, offsetY);
      
      Animated.parallel([
        Animated.spring(zoomScale, {
          toValue: targetScale,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(panOffsetX, {
          toValue: constrained.x,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
        Animated.spring(panOffsetY, {
          toValue: constrained.y,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }),
      ]).start();
      
      zoomScaleState.current = targetScale;
      panOffsetXState.current = constrained.x;
      panOffsetYState.current = constrained.y;
    }
  };

  // Handle double tap to seek left/right
  const handleDoubleTap = (evt) => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // Double tap detected
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
      }
      
      // Get tap location
      const touch = evt?.nativeEvent?.touches?.[0] || evt?.nativeEvent;
      const tapX = touch?.pageX || SCREEN_WIDTH / 2;
      
      // Determine if tap was on left or right half of screen
      if (tapX < SCREEN_WIDTH / 2) {
        // Left half - seek backward 5 seconds
        seek(-5);
      } else {
        // Right half - seek forward 5 seconds
        seek(5);
      }
      
      lastTapTime.current = 0;
    } else {
      // Single tap - wait to see if it's a double tap
      lastTapTime.current = now;
      tapTimeout.current = setTimeout(() => {
        lastTapTime.current = 0;
      }, 300);
    }
  };

  // Create PanResponder for pinch-to-zoom and pan
  const pinchPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        const touchCount = evt.nativeEvent.touches.length;
        // Respond to 2 finger pinch or 1 finger pan when zoomed
        return touchCount === 2 || (touchCount === 1 && zoomScaleState.current > 1);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const touchCount = evt.nativeEvent.touches.length;
        const movementThreshold = 5;
        const hasMoved = Math.abs(gestureState.dx) > movementThreshold || Math.abs(gestureState.dy) > movementThreshold;
        return hasMoved && (touchCount === 2 || (touchCount === 1 && zoomScaleState.current > 1));
      },
      onPanResponderGrant: (evt, gestureState) => {
        const touchCount = evt.nativeEvent.touches.length;
        
        if (touchCount === 2) {
          // Start pinch
          isPinching.current = true;
          isPanning.current = false;
          lastPinchDistance.current = getDistance(evt.nativeEvent.touches);
          lastPinchCenter.current = getPinchCenter(evt.nativeEvent.touches);
          pinchStartScale.current = zoomScaleState.current;
          pinchStartPan.current = {
            x: panOffsetXState.current,
            y: panOffsetYState.current,
          };
        } else if (touchCount === 1 && zoomScaleState.current > 1) {
          // Start pan (when zoomed)
          isPanning.current = true;
          isPinching.current = false;
          const touch = evt.nativeEvent.touches[0];
          lastPanPosition.current = { x: touch.pageX, y: touch.pageY };
          panStartOffset.current = {
            x: panOffsetXState.current,
            y: panOffsetYState.current,
          };
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touchCount = evt.nativeEvent.touches.length;
        
        if (touchCount === 2 && isPinching.current) {
          // Handle pinch zoom
          const currentDistance = getDistance(evt.nativeEvent.touches);
          const currentCenter = getPinchCenter(evt.nativeEvent.touches);
          
          if (lastPinchDistance.current > 0) {
            // Calculate scale based on distance change
            const distanceRatio = currentDistance / lastPinchDistance.current;
            const newScale = Math.max(1, Math.min(4, pinchStartScale.current * distanceRatio));
            
            // Calculate pan offset to keep the pinch center point fixed
            const centerDeltaX = currentCenter.x - lastPinchCenter.current.x;
            const centerDeltaY = currentCenter.y - lastPinchCenter.current.y;
            
            // Adjust pan offset based on scale change and center movement
            const scaleChange = newScale / pinchStartScale.current;
            const newOffsetX = pinchStartPan.current.x * scaleChange + centerDeltaX;
            const newOffsetY = pinchStartPan.current.y * scaleChange + centerDeltaY;
            
            // Constrain pan to keep video within bounds
            const constrained = constrainPan(newScale, newOffsetX, newOffsetY);
            
            // Update animated values
            zoomScale.setValue(newScale);
            panOffsetX.setValue(constrained.x);
            panOffsetY.setValue(constrained.y);
            
            // Update state refs
            zoomScaleState.current = newScale;
            panOffsetXState.current = constrained.x;
            panOffsetYState.current = constrained.y;
          }
        } else if (touchCount === 1 && isPanning.current && zoomScaleState.current > 1) {
          // Handle single finger pan when zoomed
          const touch = evt.nativeEvent.touches[0];
          const deltaX = touch.pageX - lastPanPosition.current.x;
          const deltaY = touch.pageY - lastPanPosition.current.y;
          
          const newOffsetX = panStartOffset.current.x + deltaX;
          const newOffsetY = panStartOffset.current.y + deltaY;
          
          // Constrain pan to keep video within bounds
          const constrained = constrainPan(zoomScaleState.current, newOffsetX, newOffsetY);
          
          // Update animated values
          panOffsetX.setValue(constrained.x);
          panOffsetY.setValue(constrained.y);
          
          // Update state refs
          panOffsetXState.current = constrained.x;
          panOffsetYState.current = constrained.y;
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const currentScale = zoomScaleState.current;
        
        // If zoomed out to less than 1, snap back to 1
        if (currentScale < 1.1) {
          resetZoom();
        }
        
        isPinching.current = false;
        isPanning.current = false;
        lastPinchDistance.current = 0;
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

  // Calculate estimated time to finish (remaining time)
  const getEstimatedTimeToFinish = () => {
    if (duration > 0) {
      const remaining = Math.max(0, duration - position);
      return formatTime(remaining);
    }
    return '--:--';
  };

  // Get current phone time in HH:MM format
  const getCurrentTime = () => {
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Get finish time (current time + remaining movie time) in HH:MM format
  const getFinishTime = () => {
    if (duration > 0 && position > 0) {
      const remaining = duration - position; // in milliseconds
      const now = new Date(); // Use actual current time for accurate calculation
      const finishTime = new Date(now.getTime() + remaining);
      const hours = String(finishTime.getHours()).padStart(2, '0');
      const minutes = String(finishTime.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '--:--';
  };

  // Get battery icon name based on level and charging status
  const getBatteryIconName = () => {
    if (isCharging) {
      return 'battery-charging';
    }
    if (batteryLevel === null) {
      return 'battery-full';
    }
    if (batteryLevel >= 50) {
      return 'battery-full';
    } else if (batteryLevel >= 20) {
      return 'battery-half';
    } else {
      return 'battery-dead';
    }
  };

  // Check if content is anime (genre ID 16 = Animation, or original_language = 'ja')
  const isAnime = () => {
    if (!item) return false;
    const genreIds = item.genre_ids || [];
    const hasAnimationGenre = genreIds.includes(16); // 16 = Animation
    const isJapanese = item.original_language === 'ja' || item.original_language === 'jp';
    // Also check if name/title contains "anime" keyword
    const titleLower = (item.title || item.name || '').toLowerCase();
    const hasAnimeKeyword = titleLower.includes('anime');
    return hasAnimationGenre || isJapanese || hasAnimeKeyword;
  };

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
      
      {loading && !streamUrl ? (
        <View style={styles.loadingContainer}>
          {(() => {
            // Get backdrop URL from item or episode
            const backdropUrl = item?.backdrop_path 
              ? TMDBService.getBackdropURL(item.backdrop_path, 'original')
              : item?.poster_path 
              ? TMDBService.getPosterURL(item.poster_path, 'original')
              : episode?.still_path
              ? TMDBService.getBackdropURL(episode.still_path, 'original')
              : null;
            
            return (
              <>
                {backdropUrl ? (
                  <CachedImage
                    source={{ uri: backdropUrl }}
                    style={styles.loadingBackdrop}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.loadingBackdrop, { backgroundColor: '#000' }]} />
                )}
                <View style={styles.loadingOverlay}>
                  <TouchableOpacity
                    style={[styles.loadingBackButton, { top: insets.top + 16 }]}
                    onPress={handleBack}
                    activeOpacity={0.7}
                  >
                    <View style={styles.loadingBackButtonContainer}>
                      <Ionicons name="arrow-back" size={24} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>
                    {isRetryingWithVidfast 
                      ? "fuck, this is taking too long... hang in there twin"
                      : "Loading video..."}
                  </Text>
                </View>
              </>
            );
          })()}
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
        <View style={styles.videoContainer} {...pinchPanResponder.panHandlers}>
          <Animated.View
            style={[
              styles.videoWrapper,
              {
                transform: [
                  { scale: zoomScale },
                  { translateX: panOffsetX },
                  { translateY: panOffsetY },
                ],
              },
            ]}
          >
            {player && streamUrl && isFocused && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    opacity: transitionAnim.interpolate({
                      inputRange: [0, 0.3, 1],
                      outputRange: [0, 0.9, 1],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        scale: transitionAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.9, 1],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                <VideoView
                  player={player}
                  style={styles.video}
                  contentFit="contain"
                  nativeControls={false}
                  allowsFullscreen={false}
                  allowsPictureInPicture={true}
                onLoadStart={() => {
                // Ensure audio is enabled when video loads
                  if (player) {
                  try {
                      player.volume = volume;
                      player.muted = isMuted;
                  } catch (error) {
                    console.error('Error setting audio on load:', error);
                  }
                }
              }}
                onLoad={() => {
                  // Video loaded
                  console.log('Video loaded');
                }}
                onPlayingChange={(isPlaying) => {
                  setIsPlaying(isPlaying);
                }}
                onProgressUpdate={(event) => {
                  // Progress updates are handled by the interval in useEffect
                  // This callback can be used for more frequent updates if needed
                  if (event.currentTime !== undefined && event.duration !== undefined) {
                    const newPosition = event.currentTime * 1000; // Convert to milliseconds
                    const newDuration = event.duration * 1000; // Convert to milliseconds
                    // Progress is tracked in context, just update loading state
                    if (loading && newPosition >= 1000) {
                      setLoading(false);
                    }
                }
              }}
              onError={async (error) => {
                console.error('Video error:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                console.error('Player status:', player?.status);
                console.error('Player duration:', player?.duration);
                
                if (videoSource === 'videasy' && !videasyRetryRef.current) {
                  console.log('[VideoPlayer] Videasy stream failed, attempting preferred source fallback...');
                  videasyRetryRef.current = true;
                  setVideasyFailed(true);
                  
                  try {
                    const preferredSource = await StorageService.getVideoSource();
                    const fallbackService =
                      preferredSource === 'n3tflix'
                        ? N3tflixService
                        : preferredSource === 'vidfast'
                        ? VidfastService
                        : preferredSource === 'videasy'
                        ? VixsrcService
                        : VixsrcService;
                    
                    let fallbackResult = null;
                    if (episode && season && episodeNumber) {
                      fallbackResult = await fallbackService.fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber, selectedServerName);
                    } else {
                      fallbackResult = await fallbackService.fetchMovieWithSubtitles(tmdbId, selectedServerName);
                    }
                    
                    if (fallbackResult && fallbackResult.streamUrl) {
                      console.log('[VideoPlayer] Preferred source fallback succeeded, switching stream...');
                      setStreamUrl(fallbackResult.streamUrl);
                      setVideoSource(preferredSource === 'videasy' ? 'vixsrc' : preferredSource);
                      
                      const tracks = [
                        { id: 'none', name: 'Off', language: null, url: null },
                        ...(fallbackResult.subtitles || []),
                      ];
                      const sortedTracks = sortSubtitleTracksByPriority(tracks);
                      setSubtitleTracks(sortedTracks);
                      autoEnableSubtitles(sortedTracks);
                      return;
                    }
                  } catch (videasyFallbackError) {
                    console.error('[VideoPlayer] Preferred source fallback after Videasy error failed:', videasyFallbackError);
                  }
                }
                
                // Check if this is an Android-specific error
                if (Platform.OS === 'android') {
                  console.error('Android video loading error - this may be due to missing headers required by the streaming server');
                  console.error('expo-video does not support custom HTTP headers, which some streaming services require');
                }
                
                setError('Video playback error. The stream may require headers that are not supported on this platform.');
              }}
              />
              </Animated.View>
            )}
          </Animated.View>

          {/* Loading Overlay with Back Button (when video is loading after playing) */}
          {/* Don't show loading overlay if coming from EpisodePage and video is already ready */}
          {loading && streamUrl && !(fromEpisodePageRef.current && player && (player.status === 'readyToPlay' || player.playing || player.duration > 0)) && (
            <View style={styles.videoLoadingOverlay}>
              <TouchableOpacity
                style={[styles.videoLoadingBackButton, { top: insets.top + 16 }]}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <View style={styles.loadingBackButtonContainer}>
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
              <View style={styles.videoLoadingContent}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.videoLoadingText}>
                  {isRetryingWithVidfast 
                    ? "fuck, this is taking too long... hang in there twin"
                    : "Loading video..."}
                </Text>
              </View>
            </View>
          )}

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
            onPress={(evt) => {
              // Don't toggle controls if subtitle settings modal is open
              if (showSubtitleSettingsModal) {
                return;
              }
              
              const now = Date.now();
              const timeSinceLastTap = now - lastTapTime.current;
              
              if (timeSinceLastTap < 300) {
                // Double tap - seek left/right
                handleDoubleTap(evt);
              } else {
                // Single tap - toggle controls (unless zoomed and panning)
                if (!isPanning.current && !isPinching.current) {
                  toggleControls();
                }
              }
              
              lastTapTime.current = now;
            }}
            disabled={showSubtitleSettingsModal || showAudioSettingsModal || showServerSettingsModal || showEpisodeListModal}
          >
            {!isControlsLocked && !showSubtitleSettingsModal && !showAudioSettingsModal && !showServerSettingsModal && !showEpisodeListModal && (
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
                    
                    {(logoUrl && !episode) ? (
                        <CachedImage
                          source={{ uri: logoUrl }}
                          style={styles.titleLogo}
                          resizeMode="contain"
                        />
                      ) : (
                      <View style={styles.titleContainer}>
                        {episodeInfo && (
                          <Text style={styles.episodeNumber}>{episodeInfo}</Text>
                        )}
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
                </Animated.View>

                {/* Center Controls */}
                {!showSubtitleSettingsModal && !showAudioSettingsModal && !showServerSettingsModal && !showEpisodeListModal && (
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
                      <RewindIcon size={30} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playPauseButton, { marginHorizontal: 50 }]}
                    onPress={togglePlayPause}
                  >
                    <BlurView intensity={80} tint="dark" style={styles.playPauseBlur}>
                      <Ionicons 
                        name={uiIsPlaying ? "pause" : "play"} 
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
                      <FastForwardIcon size={30} color="#fff" />
                    </BlurView>
                  </TouchableOpacity>
                </Animated.View>
                )}


                {/* Bottom Controls */}
                {!showSubtitleSettingsModal && !showAudioSettingsModal && !showServerSettingsModal && !showEpisodeListModal && (
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

                  {/* Control Buttons Row - Above Slider */}
                  <View style={styles.controlButtonsRow}>
                    {showNextEpisodeButton ? (
                      /* Next Episode Button - Replaces other buttons when episode is nearly finished */
                      <TouchableOpacity
                        style={styles.nextEpisodeButton}
                        onPress={playNextEpisode}
                        activeOpacity={0.7}
                      >
                        <BlurView intensity={80} tint="dark" style={styles.nextEpisodeButtonBlur}>
                          <Ionicons name="play-forward" size={20} color="#fff" />
                          <Text style={styles.nextEpisodeButtonText}>Next Episode</Text>
                        </BlurView>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.controlPillContainer}>
                        <BlurView intensity={80} tint="dark" style={styles.controlPillBlur}>
                        {/* Server Button - Only for Vidfast */}
                        {videoSource === 'vidfast' && availableServers.length > 0 && (
                            <>
                          <View style={styles.serverButtonWrapper}>
                            <TouchableOpacity
                                  style={styles.controlPillButton}
                              onPress={toggleServerSettingsModal}
                              activeOpacity={0.7}
                            >
                                  <Ionicons name="server" size={18} color="#fff" />
                            </TouchableOpacity>
                            
                            <Animated.View 
                              style={[
                                styles.serverMenuContainer,
                                {
                                  opacity: serverModalOpacity,
                                  transform: [{ translateY: serverModalTranslateY }],
                                }
                              ]}
                              pointerEvents={isServerExpanded ? 'auto' : 'none'}
                            >
                              <BlurView intensity={100} tint="dark" style={styles.serverMenuBlur}>
                                <ScrollView 
                                  style={styles.serverMenuScroll}
                                  nestedScrollEnabled={true}
                                  showsVerticalScrollIndicator={false}
                                >
                                  {availableServers.map((server, index) => (
                                    <TouchableOpacity
                                      key={index}
                                      style={[
                                        styles.serverMenuItem,
                                        currentServer === server.name && styles.serverMenuItemActive,
                                      ]}
                                      onPress={async () => {
                                        setIsServerExpanded(false);
                                        setLoading(true);
                                        try {
                                          await fetchStreamUrl(server.name);
                                        } catch (error) {
                                          console.error('Error switching server:', error);
                                          setError('Failed to switch server');
                                          setLoading(false);
                                        }
                                      }}
                                    >
                                      <Text
                                        style={[
                                          styles.serverMenuItemText,
                                          currentServer === server.name && styles.serverMenuItemTextActive,
                                        ]}
                                      >
                                        {server.name || `Server ${index + 1}`}
                                      </Text>
                                      {currentServer === server.name && (
                                        <Ionicons name="checkmark" size={16} color="#fff" style={styles.serverMenuCheck} />
                                      )}
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </BlurView>
                            </Animated.View>
                          </View>
                              <View style={styles.controlPillDivider} />
                            </>
                          )}

                          {/* Audio Settings Button */}
                          <TouchableOpacity
                            style={styles.controlPillButton}
                            onPress={toggleAudioSettingsModal}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="musical-notes" size={18} color="#fff" />
                          </TouchableOpacity>
                          
                          <View style={styles.controlPillDivider} />
                          
                          {/* Episode List Button - Only for TV shows */}
                          {(() => {
                            const mediaType = item?.media_type || (item?.title ? 'movie' : 'tv');
                            if (mediaType === 'tv') {
                              return (
                                <>
                                  <TouchableOpacity
                                    style={styles.controlPillButton}
                                    onPress={toggleEpisodeListModal}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="tv" size={18} color="#fff" />
                                  </TouchableOpacity>
                                  
                                  <View style={styles.controlPillDivider} />
                                </>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* Subtitle Button */}
                            <TouchableOpacity
                            style={styles.controlPillButton}
                            onPress={toggleSubtitleMenu}
                              activeOpacity={0.7}
                            >
                            <Ionicons 
                              name={selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none' ? "text" : "text-outline"} 
                              size={18} 
                              color="#fff" 
                            />
                            </TouchableOpacity>
                            
                          {/* Orientation Toggle Button - Only on native platforms */}
                          {Platform.OS !== 'web' && (
                            <>
                              <View style={styles.controlPillDivider} />
                                  <TouchableOpacity
                                style={styles.controlPillButton}
                                onPress={toggleOrientation}
                                activeOpacity={0.7}
                              >
                                <Ionicons 
                                  name={isLandscape ? "contract" : "expand"} 
                                  size={18} 
                                  color="#fff" 
                                />
                              </TouchableOpacity>
                            </>
                          )}
                        </BlurView>
                      </View>
                    )}

                    {/* Next Episode Button - Circular, next to orientation button, outside pill */}
                    {(() => {
                      const mediaType = item?.media_type || (item?.title ? 'movie' : 'tv');
                      if (mediaType === 'tv' && nextEpisode && showControls && !showSubtitleSettingsModal && !showAudioSettingsModal && !showServerSettingsModal && !showEpisodeListModal) {
                        return (
                          <TouchableOpacity
                            style={styles.nextEpisodeCircularButton}
                            onPress={playNextEpisode}
                            activeOpacity={0.7}
                          >
                            <BlurView intensity={80} tint="dark" style={styles.nextEpisodeCircularButtonBlur}>
                              <Ionicons name="play-forward" size={20} color="#fff" />
                            </BlurView>
                          </TouchableOpacity>
                        );
                      }
                      return null;
                    })()}
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
                              inputRange: [35, 39],
                              outputRange: [17.5, 19.5],
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
                              borderRadius: sliderHeight.interpolate({
                                inputRange: [35, 39],
                                outputRange: [17.5, 19.5],
                              }),
                            },
                          ]}
                        />
                      </Animated.View>
                    </View>
                    <Text style={styles.timeText}>
                      {(() => {
                        const remaining = getEstimatedTimeToFinish();
                        return remaining === '--:--' ? '--:--' : `-${remaining}`;
                      })()}
                    </Text>
                  </View>

                  {/* Info Section */}
                  <View style={styles.infoSection}>
                    <Text style={styles.infoText}>
                      {formatTime(position)}
                                    </Text>
                    <Text style={styles.infoSeparator}>|</Text>
                    <Text style={styles.infoText}>
                      {getFinishTime()}
                    </Text>
                    {batteryLevel !== null && (
                      <>
                        <Text style={styles.infoSeparator}>|</Text>
                        <View style={styles.batteryContainer}>
                          <Ionicons 
                            name={getBatteryIconName()} 
                            size={14} 
                            color="#fff" 
                            style={styles.batteryIcon} 
                          />
                          <Text style={styles.infoText}>
                            {batteryLevel}%
                          </Text>
                              </View>
                      </>
                            )}
                  </View>
                        </Animated.View>
              )}
              </>
            )}

            {/* Locked Controls Indicator */}
            {isControlsLocked && !showControls && !showSubtitleSettingsModal && !showServerSettingsModal && (
                          <TouchableOpacity
                style={styles.unlockButton}
                onPress={toggleLock}
              >
                <BlurView intensity={80} tint="dark" style={styles.unlockButtonBlur}>
                  <Ionicons name="lock-closed" size={30} color="#fff" />
                            </BlurView>
                          </TouchableOpacity>
            )}
                      
            {/* Fullscreen Subtitle Settings Modal (Netflix-style) */}
            {showSubtitleSettingsModal && (
                      <Animated.View 
                        style={[
                  styles.subtitleSettingsModalOverlay,
                  {
                    opacity: subtitleSettingsModalOpacity,
                  }
                ]}
                pointerEvents="auto"
              >
                <TouchableOpacity
                  style={styles.subtitleSettingsModalBackdrop}
                  activeOpacity={1}
                  onPress={closeSubtitleSettingsModal}
                />
                <Animated.View
                  style={[
                    styles.subtitleSettingsModalContent,
                    {
                      transform: [{ scale: subtitleSettingsModalScale }],
                    }
                  ]}
                  pointerEvents="auto"
                >
                  {/* Close Button */}
                  <TouchableOpacity
                    style={styles.subtitleSettingsCloseButton}
                    onPress={closeSubtitleSettingsModal}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>

                  {/* Title and Back Button */}
                  <View style={styles.subtitleSettingsTitleContainer}>
                    {isSubtitleSearchMode ? (
                      <View style={styles.subtitleSettingsTitleRow}>
                        <TouchableOpacity
                          style={styles.subtitleSettingsBackButton}
                          onPress={handleBackFromSearch}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.subtitleSettingsTitle}>Find Subtitles</Text>
                      </View>
                    ) : isAppearanceMode ? (
                      <View style={styles.subtitleSettingsTitleRow}>
                        <TouchableOpacity
                          style={styles.subtitleSettingsBackButton}
                          onPress={handleBackFromAppearance}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.subtitleSettingsTitle}>Appearance</Text>
                      </View>
                    ) : isDelayMode ? (
                      <View style={styles.subtitleSettingsTitleRow}>
                        <TouchableOpacity
                          style={styles.subtitleSettingsBackButton}
                          onPress={handleBackFromDelay}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.subtitleSettingsTitle}>Delay</Text>
                      </View>
                    ) : (
                      <Text style={styles.subtitleSettingsTitle}>Subtitles & Audio</Text>
                    )}
                  </View>

                  {isDelayMode ? (
                            <ScrollView 
                      style={styles.subtitleSettingsScrollView}
                      contentContainerStyle={styles.subtitleSettingsScrollContent}
                              showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {/* Delay Section */}
                      <View style={styles.subtitleSettingsSection}>
                        <Text style={styles.subtitleSettingsSectionTitle}>Delay</Text>
                        <View style={styles.subtitleSettingsDelayContainer}>
                          {/* Custom Input Field */}
                          <View style={styles.subtitleSettingsDelayInputContainer}>
                            <Text style={styles.subtitleSettingsDelayInputLabel}>Delay (seconds)</Text>
                            <TextInput
                              style={styles.subtitleSettingsDelayInput}
                              value={subtitleDelay === 0 ? '0' : (subtitleDelay / 1000).toFixed(2)}
                              onChangeText={(text) => {
                                // Remove any non-numeric characters except decimal point and minus
                                const cleaned = text.replace(/[^0-9.-]/g, '');
                                if (cleaned === '' || cleaned === '-') {
                                  setSubtitleDelay(0);
                                  return;
                                }
                                const value = parseFloat(cleaned);
                                if (!isNaN(value)) {
                                  // Clamp between -3.0 and +3.0 seconds
                                  const clamped = Math.max(-3.0, Math.min(3.0, value));
                                  setSubtitleDelay(Math.round(clamped * 1000));
                                }
                              }}
                              keyboardType="numeric"
                              placeholder="0.00"
                              placeholderTextColor="rgba(255, 255, 255, 0.5)"
                              returnKeyType="done"
                            />
                            <Text style={styles.subtitleSettingsDelayInputUnit}>s</Text>
                          </View>

                          {/* Interactive Slider */}
                          <View style={styles.subtitleSettingsDelaySliderContainer}>
                            <Text style={styles.subtitleSettingsDelaySliderLabel}>-3.0s</Text>
                            <View 
                              style={styles.subtitleSettingsDelaySlider}
                            >
                                <TouchableOpacity
                                style={styles.subtitleSettingsDelaySliderTrackContainer}
                                activeOpacity={1}
                                onPress={(e) => {
                                  // Only handle press if not dragging
                                  if (isDelaySliderDragging) return;
                                  // Calculate position on slider using locationX
                                  const { locationX } = e.nativeEvent;
                                  const sliderWidth = delaySliderWidthRef.current;
                                  if (sliderWidth === 0) return;
                                  const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
                                  // Map from -3000ms to +3000ms
                                  const newDelay = Math.round(-3000 + (percentage * 6000));
                                  setSubtitleDelay(newDelay);
                                }}
                              >
                                <View 
                                  style={styles.subtitleSettingsDelaySliderTrack}
                                  onLayout={(e) => {
                                    // Store track width when layout is measured
                                    const { width } = e.nativeEvent.layout;
                                    if (width > 0) {
                                      delaySliderWidthRef.current = width;
                                    }
                                  }}
                                >
                                  {/* Zero marker */}
                                  <View 
                                  style={[
                                      styles.subtitleSettingsDelaySliderZeroMarker,
                                      { left: '50%' }
                                    ]} 
                                  />
                                  {/* Fill from center */}
                                  <View
                                    style={[
                                      styles.subtitleSettingsDelaySliderFill,
                                      subtitleDelay < 0 
                                        ? {
                                            right: '50%',
                                            width: `${Math.abs((subtitleDelay + 3000) / 6000) * 100}%`,
                                          }
                                        : {
                                            left: '50%',
                                            width: `${((subtitleDelay + 3000) / 6000) * 100}%`,
                                          },
                                    ]}
                                  />
                                  {/* Thumb - draggable */}
                                  {delaySliderPanResponder.current && (
                                    <View
                                      style={[
                                        styles.subtitleSettingsDelaySliderThumb,
                                        { 
                                          left: `${((subtitleDelay + 3000) / 6000) * 100}%`,
                                          opacity: isDelaySliderDragging ? 0.8 : 1,
                                        },
                                      ]}
                                      {...delaySliderPanResponder.current.panHandlers}
                                    />
                                  )}
                                </View>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.subtitleSettingsDelaySliderLabel}>+3.0s</Text>
                    </View>

                          {/* Display Current Value */}
                          <Text style={styles.subtitleSettingsDelayLabel}>
                            {subtitleDelay === 0 
                              ? 'No delay' 
                              : subtitleDelay > 0 
                                ? `+${(subtitleDelay / 1000).toFixed(2)}s` 
                                : `${(subtitleDelay / 1000).toFixed(2)}s`}
                          </Text>

                          <View style={styles.subtitleSettingsDelayControls}>
                      <TouchableOpacity
                              style={styles.subtitleSettingsDelayButton}
                              onPress={() => setSubtitleDelay(Math.max(-3000, subtitleDelay - 250))}
                              disabled={subtitleDelay <= -3000}
                        activeOpacity={0.7}
                      >
                          <Ionicons 
                                name="remove" 
                            size={20} 
                                color={subtitleDelay <= -3000 ? 'rgba(255, 255, 255, 0.3)' : '#fff'} 
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[
                                styles.subtitleSettingsDelayButtonText,
                                subtitleDelay <= -3000 && styles.subtitleSettingsDelayButtonTextDisabled
                              ]}>
                                0.25s
                              </Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                              style={styles.subtitleSettingsDelayButton}
                              onPress={() => setSubtitleDelay(Math.max(-3000, subtitleDelay - 500))}
                              disabled={subtitleDelay <= -3000}
                        activeOpacity={0.7}
                      >
                              <Ionicons 
                                name="remove-circle-outline" 
                                size={20} 
                                color={subtitleDelay <= -3000 ? 'rgba(255, 255, 255, 0.3)' : '#fff'} 
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[
                                styles.subtitleSettingsDelayButtonText,
                                subtitleDelay <= -3000 && styles.subtitleSettingsDelayButtonTextDisabled
                              ]}>
                                0.5s
                              </Text>
                      </TouchableOpacity>
                      
                            <TouchableOpacity
                        style={[
                                styles.subtitleSettingsDelayButton,
                                subtitleDelay === 0 && styles.subtitleSettingsDelayButtonActive
                              ]}
                              onPress={() => setSubtitleDelay(0)}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.subtitleSettingsDelayButtonText,
                                subtitleDelay === 0 && styles.subtitleSettingsDelayButtonTextActive
                              ]}>
                                Reset
                              </Text>
                            </TouchableOpacity>

                              <TouchableOpacity
                              style={styles.subtitleSettingsDelayButton}
                              onPress={() => setSubtitleDelay(Math.min(3000, subtitleDelay + 500))}
                              disabled={subtitleDelay >= 3000}
                              activeOpacity={0.7}
                            >
                              <Ionicons 
                                name="add-circle-outline" 
                                size={20} 
                                color={subtitleDelay >= 3000 ? 'rgba(255, 255, 255, 0.3)' : '#fff'} 
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[
                                styles.subtitleSettingsDelayButtonText,
                                subtitleDelay >= 3000 && styles.subtitleSettingsDelayButtonTextDisabled
                              ]}>
                                0.5s
                              </Text>
                              </TouchableOpacity>
                              
                            <TouchableOpacity
                              style={styles.subtitleSettingsDelayButton}
                              onPress={() => setSubtitleDelay(Math.min(3000, subtitleDelay + 250))}
                              disabled={subtitleDelay >= 3000}
                              activeOpacity={0.7}
                            >
                              <Ionicons 
                                name="add" 
                                size={20} 
                                color={subtitleDelay >= 3000 ? 'rgba(255, 255, 255, 0.3)' : '#fff'} 
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[
                                styles.subtitleSettingsDelayButtonText,
                                subtitleDelay >= 3000 && styles.subtitleSettingsDelayButtonTextDisabled
                              ]}>
                                0.25s
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </ScrollView>
                  ) : isSubtitleSearchMode ? (
                    <View style={styles.subtitleSearchContent}>
                                {/* Search Input */}
                                <View style={styles.searchInputContainer}>
                                  <TextInput
                          style={styles.searchInput}
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
                        contentContainerStyle={styles.searchResultsContent}
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
                                    </View>
                        ) : (
                          <View style={styles.emptyState}>
                            <Ionicons name="search-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                            <Text style={styles.emptyStateText}>Search for subtitles</Text>
                          </View>
                        )}
                                </ScrollView>
                              </View>
                  ) : isAppearanceMode ? (
                    <ScrollView
                      style={styles.subtitleSettingsScrollView}
                      contentContainerStyle={styles.subtitleSettingsScrollContent}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {/* Preview */}
                      <View style={styles.subtitleSettingsSection}>
                        <Text style={styles.subtitleSettingsSectionTitle}>Preview</Text>
                        <View style={styles.subtitleSettingsPreview}>
                          <View style={styles.subtitleSettingsPreviewVideo}>
                            <View style={styles.subtitleSettingsPreviewOverlay}>
                              <Text
                                style={[
                                  styles.subtitleSettingsPreviewText,
                                  {
                                    color: subtitleColor,
                                    fontSize: subtitleSize,
                                    textShadowColor: subtitleShadow ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
                                    textShadowOffset: subtitleShadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
                                    textShadowRadius: subtitleShadow ? 4 : 0,
                                    backgroundColor: subtitleBackground ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                                    paddingHorizontal: subtitleBackground ? 12 : 0,
                                    paddingVertical: subtitleBackground ? 6 : 0,
                                    borderRadius: subtitleBackground ? 4 : 0,
                                  }
                                ]}
                              >
                                Preview Text
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Color Selection */}
                      <View style={styles.subtitleSettingsSection}>
                        <Text style={styles.subtitleSettingsSectionTitle}>Color</Text>
                        <View style={styles.subtitleSettingsColorPicker}>
                          {['#ffffff', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#0000ff', '#ffa500'].map((color) => (
                              <TouchableOpacity
                              key={color}
                              style={[
                                styles.subtitleSettingsColorOption,
                                { backgroundColor: color },
                                subtitleColor === color && styles.subtitleSettingsColorOptionActive,
                              ]}
                              onPress={() => setSubtitleColor(color)}
                              activeOpacity={0.7}
                            >
                              {subtitleColor === color && (
                                <Ionicons name="checkmark" size={16} color={color === '#ffffff' ? '#000' : '#fff'} />
                              )}
                              </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Size Slider */}
                      <View style={styles.subtitleSettingsSection}>
                        <Text style={styles.subtitleSettingsSectionTitle}>Size</Text>
                        <View style={styles.subtitleSettingsSizeRow}>
                          <View style={styles.subtitleSettingsSizeContainer}>
                            <Text style={styles.subtitleSettingsSizeLabel}>Small</Text>
                            <View 
                              style={styles.subtitleSettingsSizeSlider}
                              onLayout={(e) => {
                                // Store slider width for calculations
                                if (e.nativeEvent.layout.width > 0) {
                                  sizeSliderWidthRef.current = e.nativeEvent.layout.width;
                                }
                              }}
                            >
                              <TouchableOpacity
                                style={styles.subtitleSettingsSizeSliderTrackContainer}
                                activeOpacity={1}
                                onPress={(e) => {
                                  // Calculate position on slider using locationX
                                  const { locationX } = e.nativeEvent;
                                  const sliderWidth = sizeSliderWidthRef.current;
                                  const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
                                  const newSize = Math.round(12 + (percentage * (24 - 12)));
                                  const roundedSize = Math.max(12, Math.min(24, Math.round(newSize / 2) * 2)); // Round to even numbers
                                  setSubtitleSize(roundedSize);
                                }}
                              >
                                <View style={styles.subtitleSettingsSizeSliderTrack}>
                                  <View
                                    style={[
                                      styles.subtitleSettingsSizeSliderFill,
                                      { width: `${((subtitleSize - 12) / (24 - 12)) * 100}%` },
                                    ]}
                                  />
                                  <View
                                    style={[
                                      styles.subtitleSettingsSizeSliderThumb,
                                      { left: `${((subtitleSize - 12) / (24 - 12)) * 100}%` },
                                    ]}
                                  />
                                </View>
                              </TouchableOpacity>
                    </View>
                            <Text style={styles.subtitleSettingsSizeLabel}>Large</Text>
                          </View>
                          <View style={styles.subtitleSettingsSizeControls}>
                            <TouchableOpacity
                              style={styles.subtitleSettingsSizeButton}
                              onPress={() => {
                                if (subtitleSize > 12) {
                                  setSubtitleSize(subtitleSize - 2);
                                }
                              }}
                              disabled={subtitleSize <= 12}
                            >
                              <Ionicons name="remove" size={20} color={subtitleSize > 12 ? '#fff' : 'rgba(255, 255, 255, 0.3)'} />
                            </TouchableOpacity>
                            <Text style={styles.subtitleSettingsSizeValue}>{subtitleSize}</Text>
                            <TouchableOpacity
                              style={styles.subtitleSettingsSizeButton}
                              onPress={() => {
                                if (subtitleSize < 24) {
                                  setSubtitleSize(subtitleSize + 2);
                                }
                              }}
                              disabled={subtitleSize >= 24}
                            >
                              <Ionicons name="add" size={20} color={subtitleSize < 24 ? '#fff' : 'rgba(255, 255, 255, 0.3)'} />
                            </TouchableOpacity>
                          </View>
                        </View>
                  </View>

                      {/* Background Toggle */}
                      <View style={styles.subtitleSettingsSection}>
                        <Text style={styles.subtitleSettingsSectionTitle}>Background</Text>
                        <TouchableOpacity
                          style={styles.subtitleSettingsToggle}
                          onPress={() => setSubtitleBackground(!subtitleBackground)}
                          activeOpacity={0.7}
                        >
                    <View
                            style={[
                              styles.subtitleSettingsToggleTrack,
                              subtitleBackground && styles.subtitleSettingsToggleTrackActive,
                            ]}
                          >
                      <Animated.View
                        style={[
                                styles.subtitleSettingsToggleThumb,
                                subtitleBackground && styles.subtitleSettingsToggleThumbActive,
                              ]}
                            />
                          </View>
                        </TouchableOpacity>
                      </View>

                      {/* Shadow Toggle */}
                      <View style={styles.subtitleSettingsSection}>
                        <Text style={styles.subtitleSettingsSectionTitle}>Shadow</Text>
                        <TouchableOpacity
                          style={styles.subtitleSettingsToggle}
                          onPress={() => setSubtitleShadow(!subtitleShadow)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.subtitleSettingsToggleTrack,
                              subtitleShadow && styles.subtitleSettingsToggleTrackActive,
                            ]}
                          >
                        <Animated.View
                          style={[
                                styles.subtitleSettingsToggleThumb,
                                subtitleShadow && styles.subtitleSettingsToggleThumbActive,
                              ]}
                            />
                    </View>
                        </TouchableOpacity>
                  </View>
                    </ScrollView>
                  ) : (
                    <ScrollView
                      style={styles.subtitleSettingsScrollView}
                      contentContainerStyle={styles.subtitleSettingsScrollContent}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {/* Subtitle Track Selection */}
                      <View style={styles.subtitleSettingsSection}>
                        <Text style={styles.subtitleSettingsSectionTitle}>Subtitles</Text>
                        <View style={styles.subtitleSettingsTracksList}>
                          {subtitleTracks.length > 0 ? (
                            <>
                              {/* "Off" option */}
                              {subtitleTracks.find(track => track.id === 'none') && (
                                <TouchableOpacity
                                  key="none"
                                  style={[
                                    styles.subtitleSettingsTrackItem,
                                    selectedSubtitleTrack?.id === 'none' && styles.subtitleSettingsTrackItemActive,
                                  ]}
                                  onPress={() => selectSubtitleTrack(subtitleTracks.find(track => track.id === 'none'))}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.subtitleSettingsTrackItemContent}>
                                    <Text
                                      style={[
                                        styles.subtitleSettingsTrackItemText,
                                        selectedSubtitleTrack?.id === 'none' && styles.subtitleSettingsTrackItemTextActive,
                                      ]}
                                    >
                                      Off
                                    </Text>
                                    {selectedSubtitleTrack?.id === 'none' && (
                                      <Ionicons name="checkmark" size={20} color="#fff" />
                                    )}
                                  </View>
                                </TouchableOpacity>
                              )}
                              
                              {/* Language groups */}
                              {(() => {
                                const offTrack = subtitleTracks.find(track => track.id === 'none');
                                const otherTracks = subtitleTracks.filter(track => track.id !== 'none');
                                const languageGroups = groupTracksByLanguage(otherTracks);
                                const sortedGroups = getSortedLanguageGroups(languageGroups);
                                
                                return sortedGroups.map(([languageKey, tracks]) => {
                                  // Sort tracks within the group by name to ensure consistent ordering
                                  const sortedTracks = [...tracks].sort((a, b) => {
                                    const nameA = (a.name || '').toLowerCase();
                                    const nameB = (b.name || '').toLowerCase();
                                    return nameA.localeCompare(nameB);
                                  });
                                  
                                  const isExpanded = expandedLanguageGroup === languageKey;
                                  const hasSelectedTrack = sortedTracks.some(track => track.id === selectedSubtitleTrack?.id);
                                  const displayName = getLanguageDisplayName(languageKey, sortedTracks);
                                  
                                  return (
                                    <View key={languageKey} style={styles.subtitleLanguageGroup}>
                                      <TouchableOpacity
                                        style={[
                                          styles.subtitleSettingsTrackItem,
                                          hasSelectedTrack && styles.subtitleSettingsTrackItemActive,
                                        ]}
                                        onPress={() => toggleLanguageGroup(languageKey)}
                                        activeOpacity={0.7}
                                      >
                                        <View style={styles.subtitleSettingsTrackItemContent}>
                                          <Text
                                            style={[
                                              styles.subtitleSettingsTrackItemText,
                                              hasSelectedTrack && styles.subtitleSettingsTrackItemTextActive,
                                            ]}
                                          >
                                            {displayName}
                    </Text>
                                          <View style={styles.subtitleLanguageGroupIcons}>
                                            {hasSelectedTrack && (
                                              <Ionicons name="checkmark" size={20} color="#fff" style={styles.subtitleLanguageGroupCheckmark} />
                                            )}
                          <Ionicons 
                                              name={isExpanded ? "chevron-up" : "chevron-down"} 
                                              size={20} 
                                              color="rgba(255, 255, 255, 0.5)" 
                                            />
                                          </View>
                                        </View>
                                      </TouchableOpacity>
                                      
                                      {/* Expanded track selection */}
                                      {isExpanded && (
                                        <View style={styles.subtitleLanguageGroupTracks}>
                                          <ScrollView 
                                            horizontal 
                                            showsHorizontalScrollIndicator={false}
                                            style={styles.subtitleLanguageGroupScroll}
                                            contentContainerStyle={styles.subtitleLanguageGroupScrollContent}
                                          >
                                            {sortedTracks.map((track, index) => {
                                              const isSelected = track.id === selectedSubtitleTrack?.id;
                                              return (
                                                <TouchableOpacity
                                                  key={track.id}
                                                  style={[
                                                    styles.subtitleLanguageGroupTrackItem,
                                                    isSelected && styles.subtitleLanguageGroupTrackItemActive,
                                                  ]}
                                                  onPress={() => {
                                                    selectSubtitleTrack(track);
                                                    // Optionally close the group after selection
                                                    // setExpandedLanguageGroup(null);
                                                  }}
                                                  activeOpacity={0.7}
                                                >
                                                  <Text
                                                    style={[
                                                      styles.subtitleLanguageGroupTrackItemText,
                                                      isSelected && styles.subtitleLanguageGroupTrackItemTextActive,
                                                    ]}
                                                    numberOfLines={1}
                                                  >
                                                    {index + 1}
                          </Text>
                                                  {isSelected && (
                                                    <Ionicons name="checkmark" size={16} color="#fff" style={{ marginLeft: 4 }} />
                                                  )}
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </ScrollView>
                        </View>
                                      )}
                                    </View>
                                  );
                                });
                              })()}
                      </>
                          ) : (
                            <View style={styles.subtitleSettingsEmptyState}>
                              <Text style={styles.subtitleSettingsEmptyText}>No subtitles available</Text>
                            </View>
                    )}
                  </View>
                        
                        {/* Load Subtitles Online Button */}
                        <TouchableOpacity
                          style={styles.subtitleSettingsButton}
                          onPress={handleLoadSubtitlesOnline}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="cloud-download-outline" size={20} color="#fff" style={styles.subtitleSettingsButtonIcon} />
                          <Text style={styles.subtitleSettingsButtonText}>Find Subtitles</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Appearance Settings Button */}
                      <View style={styles.subtitleSettingsSection}>
                        <TouchableOpacity
                          style={styles.subtitleSettingsButton}
                          onPress={handleOpenAppearance}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="color-palette-outline" size={20} color="#fff" style={styles.subtitleSettingsButtonIcon} />
                          <Text style={styles.subtitleSettingsButtonText}>Appearance</Text>
                          <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" style={styles.subtitleSettingsButtonArrow} />
                        </TouchableOpacity>
                      </View>

                      {/* Delay Settings Button */}
                      <View style={styles.subtitleSettingsSection}>
                        <TouchableOpacity
                          style={styles.subtitleSettingsButton}
                          onPress={handleOpenDelay}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="time-outline" size={20} color="#fff" style={styles.subtitleSettingsButtonIcon} />
                          <Text style={styles.subtitleSettingsButtonText}>Delay</Text>
                          <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" style={styles.subtitleSettingsButtonArrow} />
                        </TouchableOpacity>
                      </View>
                    </ScrollView>
                  )}
                </Animated.View>
              </Animated.View>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Audio Settings Modal (Netflix-style) */}
      {showAudioSettingsModal && (
        <Animated.View
          style={[
            styles.subtitleSettingsModalOverlay,
            {
              opacity: audioSettingsModalOpacity,
            }
          ]}
          pointerEvents="auto"
        >
              <TouchableOpacity
            style={styles.subtitleSettingsModalBackdrop}
            activeOpacity={1}
            onPress={closeAudioSettingsModal}
          />
          <Animated.View
            style={[
              styles.subtitleSettingsModalContent,
              {
                transform: [{ scale: audioSettingsModalScale }],
              }
            ]}
            pointerEvents="auto"
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.subtitleSettingsCloseButton}
              onPress={closeAudioSettingsModal}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>

            {/* Title */}
            <View style={styles.subtitleSettingsTitleContainer}>
              <Text style={styles.subtitleSettingsTitle}>Audio & Speed</Text>
            </View>

            {/* Audio Settings Content */}
            <ScrollView
              style={styles.subtitleSettingsScrollView}
              contentContainerStyle={styles.subtitleSettingsScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {/* Audio Track Selection */}
              <View style={styles.subtitleSettingsSection}>
                <Text style={styles.subtitleSettingsSectionTitle}>Audio</Text>
                <View style={styles.subtitleSettingsTracksList}>
                  {audioTracks.length > 0 ? (
                    audioTracks.map((track) => (
                      <TouchableOpacity
                        key={track.id}
                        style={[
                          styles.subtitleSettingsTrackItem,
                          selectedAudioTrack?.id === track.id && styles.subtitleSettingsTrackItemActive,
                        ]}
                        onPress={() => selectAudioTrack(track)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.subtitleSettingsTrackItemContent}>
                          <Text
                            style={[
                              styles.subtitleSettingsTrackItemText,
                              selectedAudioTrack?.id === track.id && styles.subtitleSettingsTrackItemTextActive,
                            ]}
                          >
                            {track.name || track.language || 'Default'}
                          </Text>
                          {selectedAudioTrack?.id === track.id && (
                            <Ionicons name="checkmark" size={20} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.subtitleSettingsEmptyState}>
                      <Text style={styles.subtitleSettingsEmptyText}>No audio tracks available</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Playback Speed Selection */}
              <View style={styles.subtitleSettingsSection}>
                <Text style={styles.subtitleSettingsSectionTitle}>Playback Speed</Text>
                <View style={styles.subtitleSettingsTracksList}>
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[
                        styles.subtitleSettingsTrackItem,
                        playbackRate === rate && styles.subtitleSettingsTrackItemActive,
                      ]}
                      onPress={() => changePlaybackRate(rate, false)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.subtitleSettingsTrackItemContent}>
                        <Text
                          style={[
                            styles.subtitleSettingsTrackItemText,
                            playbackRate === rate && styles.subtitleSettingsTrackItemTextActive,
                          ]}
                        >
                          {rate}x
                        </Text>
                        {playbackRate === rate && (
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* Server Settings Modal (Netflix-style) */}
      {showServerSettingsModal && (
        <Animated.View
          style={[
            styles.subtitleSettingsModalOverlay,
            {
              opacity: serverSettingsModalOpacity,
            }
          ]}
          pointerEvents="auto"
        >
          <TouchableOpacity
            style={styles.subtitleSettingsModalBackdrop}
            activeOpacity={1}
            onPress={closeServerSettingsModal}
          />
          <Animated.View
            style={[
              styles.subtitleSettingsModalContent,
              {
                transform: [{ scale: serverSettingsModalScale }],
              }
            ]}
            pointerEvents="auto"
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.subtitleSettingsCloseButton}
              onPress={closeServerSettingsModal}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.subtitleSettingsTitleContainer}>
              <Text style={styles.subtitleSettingsTitle}>Servers</Text>
            </View>

            {/* Server Selection Content */}
            <ScrollView
              style={styles.subtitleSettingsScrollView}
              contentContainerStyle={styles.subtitleSettingsScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {availableServers.length > 0 ? (
                <View style={styles.subtitleSettingsSection}>
                  <Text style={styles.subtitleSettingsSectionTitle}>Available Servers</Text>
                  <View style={styles.subtitleSettingsTracksList}>
                    {availableServers.map((server, index) => {
                      const isSelected = currentServer === server.name;
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.subtitleSettingsTrackItem,
                            isSelected && styles.subtitleSettingsTrackItemActive,
                          ]}
                          onPress={async () => {
                            closeServerSettingsModal();
                            setLoading(true);
                            try {
                              await fetchStreamUrl(server.name);
                            } catch (error) {
                              console.error('Error switching server:', error);
                              setError('Failed to switch server');
                              setLoading(false);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.subtitleSettingsTrackItemText,
                              isSelected && styles.subtitleSettingsTrackItemTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {server.name || `Server ${index + 1}`}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark" size={20} color="#fff" style={styles.subtitleSettingsTrackItemCheck} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <View style={styles.subtitleSettingsEmptyState}>
                  <Text style={styles.subtitleSettingsEmptyText}>No servers available</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* Episode List Modal */}
      {showEpisodeListModal && (
        <Animated.View
          style={[
            styles.subtitleSettingsModalOverlay,
            {
              opacity: episodeListModalOpacity,
            }
          ]}
          pointerEvents="auto"
        >
          <TouchableOpacity
            style={styles.subtitleSettingsModalBackdrop}
            activeOpacity={1}
            onPress={closeEpisodeListModal}
          />
          <Animated.View
            style={[
              styles.subtitleSettingsModalContent,
              {
                transform: [{ scale: episodeListModalScale }],
              }
            ]}
            pointerEvents="auto"
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.subtitleSettingsCloseButton}
              onPress={closeEpisodeListModal}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.subtitleSettingsTitleContainer}>
              <Text style={styles.subtitleSettingsTitle}>Episodes</Text>
            </View>

            {/* Season Selector */}
            {seasons.length > 0 && (
              <View style={styles.seasonSelectorContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.seasonSelectorScrollContent}
                >
                  {seasons.map((seasonItem) => (
                    <TouchableOpacity
                      key={seasonItem.season_number}
                      style={[
                        styles.seasonButton,
                        selectedSeasonForList === seasonItem.season_number && styles.seasonButtonActive,
                      ]}
                      onPress={() => setSelectedSeasonForList(seasonItem.season_number)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.seasonButtonText,
                          selectedSeasonForList === seasonItem.season_number && styles.seasonButtonTextActive,
                        ]}
                      >
                        {seasonItem.season_number === 0 ? 'Specials' : `Season ${seasonItem.season_number}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Episodes List */}
            <ScrollView
              style={styles.subtitleSettingsScrollView}
              contentContainerStyle={styles.subtitleSettingsScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {loadingEpisodes || (selectedSeasonForList !== null && !episodesBySeason[selectedSeasonForList]) ? (
                <View style={styles.episodeListLoadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.episodeListLoadingText}>Loading episodes...</Text>
                </View>
              ) : selectedSeasonForList !== null && episodesBySeason[selectedSeasonForList]?.length > 0 ? (
                <View style={styles.episodeListContainer}>
                  {episodesBySeason[selectedSeasonForList].map((episodeItem) => {
                    const isCurrentEpisode = episode?.id === episodeItem.id || 
                                           (season === selectedSeasonForList && episodeNumber === episodeItem.episode_number);
                    return (
                      <TouchableOpacity
                        key={`${selectedSeasonForList}-${episodeItem.episode_number}`}
                        style={[
                          styles.episodeItem,
                          isCurrentEpisode && styles.episodeItemActive,
                        ]}
                        onPress={() => handleEpisodeSelect(episodeItem, selectedSeasonForList)}
                        activeOpacity={0.7}
                      >
                        {/* Episode Thumbnail */}
                        <View style={styles.episodeThumbnailContainer}>
                          {(() => {
                            const thumbnailUri = episodeItem.still_path
                              ? TMDBService.getStillURL(episodeItem.still_path, 'w300')
                              : item?.backdrop_path
                              ? TMDBService.getBackdropURL(item.backdrop_path, 'w300')
                              : null;
                            
                            if (thumbnailUri) {
                              return (
                                <CachedImage
                                  source={{ uri: thumbnailUri }}
                                  style={styles.episodeThumbnail}
                                  resizeMode="cover"
                                />
                              );
                            } else {
                              return (
                                <View style={[styles.episodeThumbnail, styles.episodeThumbnailPlaceholder]}>
                                  <Ionicons name="tv-outline" size={40} color="rgba(255, 255, 255, 0.3)" />
                                </View>
                              );
                            }
                          })()}
                          {isCurrentEpisode && (
                            <View style={styles.episodeCurrentBadge}>
                              <Ionicons name="play-circle" size={20} color="#fff" />
                            </View>
                          )}
                        </View>

                        {/* Episode Info */}
                        <View style={styles.episodeInfoContainer}>
                          <View style={styles.episodeHeader}>
                            <Text style={styles.episodeNumber}>
                              Episode {episodeItem.episode_number}
                            </Text>
                            {episodeItem.air_date && (
                              <Text style={styles.episodeAirDate}>
                                {new Date(episodeItem.air_date).getFullYear()}
                              </Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.episodeTitle,
                              isCurrentEpisode && styles.episodeTitleActive,
                            ]}
                            numberOfLines={2}
                          >
                            {episodeItem.name || `Episode ${episodeItem.episode_number}`}
                          </Text>
                          {episodeItem.overview && (
                            <Text style={styles.episodeDescription} numberOfLines={3}>
                              {episodeItem.overview}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.subtitleSettingsEmptyState}>
                  <Text style={styles.subtitleSettingsEmptyText}>
                    {selectedSeasonForList === null ? 'Select a season' : 'No episodes available'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* Subtitle Overlay - Positioned above bottom controls, moves up when controls appear */}
      {/* Hide subtitles when subtitle settings modal is open */}
      {currentSubtitleText && selectedSubtitleTrack && selectedSubtitleTrack.id !== 'none' && !showSubtitleSettingsModal && !showAudioSettingsModal && !showServerSettingsModal && !showEpisodeListModal && (
        <Animated.View 
          style={[
                styles.subtitleOverlay,
                {
              bottom: subtitleBottomPosition,
                }
          ]}
          pointerEvents="none"
        >
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
        </Animated.View>
            )}
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
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  loadingBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  loadingBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10000,
  },
  loadingBackButtonContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLoadingBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10001,
  },
  videoLoadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLoadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    overflow: 'hidden',
  },
  videoWrapper: {
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
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginRight: 8,
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
  titleLogo: {
    height: 40,
    width: 250,
    maxWidth: 250,
    marginLeft: 0,
    marginRight: 8,
    backgroundColor: 'transparent',
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
  nextEpisodeCircularButton: {
    width: 42,
    height: 42,
    marginLeft: 8,
    alignSelf: 'center',
  },
  nextEpisodeCircularButtonBlur: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
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
    zIndex: 10, // Higher z-index than subtitles
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  serverButtonWrapper: {
    marginLeft: 12,
    position: 'relative',
  },
  serverMenuContainer: {
    position: 'absolute',
    bottom: 50,
    right: 0,
    minWidth: 200,
    maxWidth: 280,
    maxHeight: 300,
    zIndex: 1000,
  },
  serverMenuBlur: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  serverMenuScroll: {
    maxHeight: 300,
  },
  serverMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  serverMenuItemActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  serverMenuItemText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  serverMenuItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  serverMenuCheck: {
    marginLeft: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 50,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  infoText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginHorizontal: 6,
  },
  infoSeparator: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    marginHorizontal: 4,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  batteryIcon: {
    marginRight: 4,
  },
  sliderWrapper: {
    flex: 1,
    height: 50,
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
  },
  controlButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
    alignItems: 'center',
  },
  controlPillContainer: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  controlPillBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  controlPillButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlPillDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 2,
  },
  nextEpisodeButton: {
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  nextEpisodeButtonBlur: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  nextEpisodeButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  controlButtonBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
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
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 5, // Lower z-index than controls (controls are zIndex 10+)
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
  // Fullscreen Subtitle Settings Modal (Netflix-style)
  subtitleSettingsModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitleSettingsModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  subtitleSettingsModalContent: {
    width: '90%',
    maxWidth: 600,
    height: '80%',
    maxHeight: '80%',
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'column',
  },
  subtitleSettingsCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10001,
  },
  subtitleSettingsTitleContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  subtitleSettingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subtitleSettingsBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitleSettingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  subtitleSettingsScrollView: {
    flex: 1,
    minHeight: 0, // Important for ScrollView to work inside flex container
  },
  subtitleSettingsScrollContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  subtitleSettingsSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  subtitleSettingsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  subtitleSettingsTracksList: {
    marginBottom: 16,
    minHeight: 50,
  },
  subtitleSettingsEmptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  subtitleSettingsEmptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  // Episode List Modal Styles
  seasonSelectorContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  seasonSelectorScrollContent: {
    paddingRight: 20,
  },
  seasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  seasonButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#fff',
  },
  seasonButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  seasonButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  episodeListLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeListLoadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 12,
  },
  episodeListContainer: {
    paddingTop: 10,
  },
  episodeItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  episodeItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  episodeThumbnailContainer: {
    width: 120,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  episodeThumbnail: {
    width: '100%',
    height: '100%',
  },
  episodeThumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  episodeCurrentBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  episodeInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  episodeNumber: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  episodeAirDate: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  episodeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  episodeTitleActive: {
    color: '#4CAF50',
  },
  episodeDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  subtitleLanguageGroup: {
    marginBottom: 4,
  },
  subtitleSettingsTrackItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  subtitleSettingsTrackItemActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  subtitleSettingsTrackItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtitleSettingsTrackItemText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  subtitleSettingsTrackItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  subtitleLanguageGroupIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitleLanguageGroupCheckmark: {
    marginRight: 8,
  },
  subtitleLanguageGroupTracks: {
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 16,
    paddingRight: 16,
  },
  subtitleLanguageGroupScroll: {
    flexGrow: 0,
  },
  subtitleLanguageGroupScrollContent: {
    paddingRight: 0,
  },
  subtitleLanguageGroupTrackItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 8,
  },
  subtitleLanguageGroupTrackItemActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  subtitleLanguageGroupTrackItemText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  subtitleLanguageGroupTrackItemTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  subtitleSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 8,
  },
  subtitleSettingsButtonIcon: {
    marginRight: 8,
  },
  subtitleSettingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  subtitleSettingsButtonArrow: {
    marginLeft: 8,
  },
  subtitleSettingsPreview: {
    marginBottom: 24,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  subtitleSettingsPreviewVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitleSettingsPreviewOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  subtitleSettingsPreviewText: {
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleSettingsOption: {
    marginBottom: 24,
  },
  subtitleSettingsOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  subtitleSettingsColorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subtitleSettingsColorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitleSettingsColorOptionActive: {
    borderColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  subtitleSettingsSizeRow: {
    marginBottom: 12,
  },
  subtitleSettingsSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  subtitleSettingsSizeLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    minWidth: 50,
  },
  subtitleSettingsSizeSlider: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  subtitleSettingsSizeSliderTrackContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    paddingVertical: 18,
  },
  subtitleSettingsSizeSliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    position: 'relative',
    width: '100%',
  },
  subtitleSettingsSizeSliderFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  subtitleSettingsSizeSliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    top: -8,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  subtitleSettingsSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  subtitleSettingsSizeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    minWidth: 30,
    textAlign: 'center',
  },
  subtitleSettingsSizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitleSettingsToggle: {
    alignSelf: 'flex-start',
  },
  subtitleSettingsToggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  subtitleSettingsToggleTrackActive: {
    backgroundColor: '#FF3B30',
  },
  subtitleSettingsToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  subtitleSettingsToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  subtitleSettingsDelayContainer: {
    marginTop: 8,
  },
  subtitleSettingsDelayInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  subtitleSettingsDelayInputLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: 12,
    fontWeight: '500',
  },
  subtitleSettingsDelayInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 60,
  },
  subtitleSettingsDelayInputUnit: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
    fontWeight: '500',
  },
  subtitleSettingsDelaySliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  subtitleSettingsDelaySliderLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  subtitleSettingsDelaySlider: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingVertical: 18,
  },
  subtitleSettingsDelaySliderTrackContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  subtitleSettingsDelaySliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    position: 'relative',
    width: '100%',
  },
  subtitleSettingsDelaySliderZeroMarker: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    top: 0,
    marginLeft: -1,
  },
  subtitleSettingsDelaySliderFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 2,
    position: 'absolute',
    top: 0,
  },
  subtitleSettingsDelaySliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    top: -8,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  subtitleSettingsDelayLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  subtitleSettingsDelayControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  subtitleSettingsDelayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 80,
    marginRight: 8,
    marginBottom: 8,
  },
  subtitleSettingsDelayButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    borderColor: 'rgba(255, 59, 48, 0.5)',
  },
  subtitleSettingsDelayButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  subtitleSettingsDelayButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  subtitleSettingsDelayButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  // Subtitle Search Modal (when opened from subtitle settings)
  subtitleSearchModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10001,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitleSearchModalContent: {
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 20,
  },
  subtitleSearchBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  subtitleSearchBackText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  subtitleSearchContent: {
    flex: 1,
    paddingHorizontal: 24,
    minHeight: 0, // Important for ScrollView to work inside flex container
  },
  searchResultsContent: {
    paddingBottom: 24,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
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
    minHeight: 0, // Important for ScrollView to work inside flex container
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
    backgroundColor: '#ffffff',
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
