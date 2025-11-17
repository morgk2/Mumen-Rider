import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useVideoPlayer } from 'expo-video';
import { Animated } from 'react-native';

const VideoPlayerContext = createContext(null);

export const VideoPlayerProvider = ({ children }) => {
  const [streamUrl, setStreamUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [item, setItem] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [season, setSeason] = useState(null);
  const [episodeNumber, setEpisodeNumber] = useState(null);
  const [resumePosition, setResumePosition] = useState(0);
  
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const hasSeekedToResumePosition = useRef(false);
  
  // Animation values for smooth transitions
  const transitionAnim = useRef(new Animated.Value(0)).current; // 0 = minimized, 1 = fullscreen
  
  // Create a single player instance that's shared
  const player = useVideoPlayer(null);
  
  // Update player source when streamUrl changes
  useEffect(() => {
    if (player && streamUrl) {
      const replaceSource = async () => {
        try {
          console.log('Replacing video source with:', streamUrl);
          
          // expo-video doesn't support custom headers in source config
          // Try without headers first (most HLS streams work without them)
          const sourceConfig = { uri: streamUrl };
          
          console.log('Using source config:', sourceConfig);
          
          
          // Reset player state before replacing
          try {
            if (player.status === 'error') {
              console.log('Player was in error state, attempting to reset...');
              // Try to clear any previous error by replacing with null first
              try {
                await player.replaceAsync({ uri: '' });
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (resetError) {
                console.warn('Error resetting player:', resetError);
              }
            }
          } catch (e) {
            console.warn('Could not check/reset player status:', e);
          }
          
          await player.replaceAsync(sourceConfig);
          
          // Wait for player to be ready
          let checkCount = 0;
          const maxChecks = 200; // Increased timeout for Android HLS streams
          const checkReady = setInterval(() => {
            checkCount++;
            const currentStatus = player.status;
            const currentDuration = player.duration;
            
            // Log status every 10 checks for debugging
            if (checkCount % 10 === 0) {
              console.log(`Player check ${checkCount}: status=${currentStatus}, duration=${currentDuration}`);
            }
            
            if (currentDuration > 0 && currentStatus !== 'error') {
              clearInterval(checkReady);
              console.log('Player ready, duration:', currentDuration, 'status:', currentStatus);
              
              // Seek to resume position if needed
              if (resumePosition && resumePosition > 0 && !hasSeekedToResumePosition.current) {
                player.currentTime = resumePosition / 1000;
                hasSeekedToResumePosition.current = true;
              }
              
              // Auto-play only if player is not already paused
              // This prevents autoplay when navigating between screens if video was paused
              setTimeout(() => {
                if (player && !player.paused) {
                  player.play();
                  setIsPlaying(true);
                } else if (player && player.paused) {
                  // Respect pause state
                  setIsPlaying(false);
                }
              }, 100);
            } else if (checkCount >= maxChecks || currentStatus === 'error') {
              clearInterval(checkReady);
              if (currentStatus === 'error') {
                console.error('Player error status:', currentStatus, 'after', checkCount, 'checks');
                console.error('Player duration:', currentDuration);
                // Try to get more error details if available
                try {
                  if (player.error) {
                    console.error('Player error object:', player.error);
                  }
                  // Check if there's an error message property
                  if (player.errorMessage) {
                    console.error('Player error message:', player.errorMessage);
                  }
                } catch (e) {
                  console.error('Could not access error details:', e);
                }
              }
              if (checkCount >= maxChecks) {
                console.warn('Player did not become ready after', maxChecks, 'checks. Status:', currentStatus, 'Duration:', currentDuration);
              }
            }
          }, 100);
        } catch (error) {
          console.error('Error replacing video source:', error);
          console.error('Error details:', error.message, error.stack);
        }
      };
      replaceSource();
    }
  }, [player, streamUrl, resumePosition]);
  
  // Configure player
  useEffect(() => {
    if (player) {
      player.loop = false;
      player.muted = false;
      player.volume = 1.0;
    }
  }, [player]);
  
  // Track playback progress
  useEffect(() => {
    if (!player) return;
    
    const interval = setInterval(() => {
      if (player.duration > 0) {
        const currentTime = player.currentTime * 1000;
        const totalDuration = player.duration * 1000;
        
        positionRef.current = currentTime;
        durationRef.current = totalDuration;
        setPosition(currentTime);
        setDuration(totalDuration);
      }
      
      // Update play state only if it actually changed
      const playerIsPlaying = !player.paused;
      setIsPlaying(prev => {
        if (prev !== playerIsPlaying) {
          return playerIsPlaying;
        }
        return prev;
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [player]);
  
  const play = useCallback(() => {
    if (player && player.paused) {
      player.play();
      setIsPlaying(true);
    }
  }, [player]);
  
  const pause = useCallback(() => {
    if (player && !player.paused) {
      player.pause();
      setIsPlaying(false);
    }
  }, [player]);
  
  const seek = (timeInSeconds) => {
    if (player && player.duration > 0) {
      player.currentTime = timeInSeconds;
      positionRef.current = timeInSeconds * 1000;
      setPosition(timeInSeconds * 1000);
    }
  };
  
  const initializePlayer = (params) => {
    setItem(params.item);
    setEpisode(params.episode || null);
    setSeason(params.season || null);
    setEpisodeNumber(params.episodeNumber || null);
    setResumePosition(params.resumePosition || 0);
    setStreamUrl(params.streamUrl);
    hasSeekedToResumePosition.current = false;
  };
  
  const animateToFullscreen = () => {
    Animated.timing(transitionAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false, // We need to animate layout properties
    }).start();
  };
  
  const animateToMinimized = () => {
    Animated.timing(transitionAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };
  
  const resetPlayerState = useCallback(async () => {
    try {
      if (player) {
        try {
          player.pause();
        } catch (pauseError) {
          console.warn('Error pausing player during reset:', pauseError);
        }
        try {
          await player.replaceAsync({ uri: '' });
        } catch (replaceError) {
          console.warn('Error clearing player source during reset:', replaceError);
        }
      }
    } catch (playerError) {
      console.warn('Unexpected error resetting player instance:', playerError);
    }

    setStreamUrl(null);
    setItem(null);
    setEpisode(null);
    setSeason(null);
    setEpisodeNumber(null);
    setResumePosition(0);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    positionRef.current = 0;
    durationRef.current = 0;
    hasSeekedToResumePosition.current = false;
  }, [player]);

  const value = {
    player,
    streamUrl,
    setStreamUrl,
    isPlaying,
    setIsPlaying,
    position,
    setPosition,
    duration,
    setDuration,
    item,
    episode,
    season,
    episodeNumber,
    resumePosition,
    positionRef,
    durationRef,
    play,
    pause,
    seek,
    initializePlayer,
    transitionAnim,
    animateToFullscreen,
    animateToMinimized,
    resetPlayerState,
  };
  
  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
};

export const useVideoPlayerContext = () => {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error('useVideoPlayerContext must be used within VideoPlayerProvider');
  }
  return context;
};


