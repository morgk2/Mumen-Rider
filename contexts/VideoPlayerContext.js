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
          await player.replaceAsync({ uri: streamUrl });
          
          // Wait for player to be ready
          let checkCount = 0;
          const maxChecks = 100;
          const checkReady = setInterval(() => {
            checkCount++;
            if (player.duration > 0 && player.status !== 'error') {
              clearInterval(checkReady);
              
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
            } else if (checkCount >= maxChecks || player.status === 'error') {
              clearInterval(checkReady);
            }
          }, 100);
        } catch (error) {
          console.error('Error replacing video source:', error);
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


