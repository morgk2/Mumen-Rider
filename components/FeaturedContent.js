import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Animated, Easing, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Accelerometer } from 'expo-sensors';
import { BlurView } from 'expo-blur';
import { TMDBService } from '../services/TMDBService';
import { CachedImage } from './CachedImage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.6;
const STORY_DURATION = 10000; // 10 seconds per story
const SLIDE_DURATION = 800; // 800ms for backdrop slide animation
const CONTENT_SLIDE_DURATION = 1200; // 1200ms for content slide animation (slower)

export const FeaturedContent = ({ item, navigation, scrollY, currentIndex = 0, totalItems = 1, onNext, onPrevious, featuredItems = [], onMoviesFilterPress, onShowsFilterPress, onPopularNowFilterPress, filterMode = 'all' }) => {
  const insets = useSafeAreaInsets();
  const [logoUrl, setLogoUrl] = useState(null);
  const [prevLogoUrl, setPrevLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prevLoading, setPrevLoading] = useState(true);
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  const [prevItem, setPrevItem] = useState(null);
  const [displayItem, setDisplayItem] = useState(item);
  const [displayItemDetails, setDisplayItemDetails] = useState(null);
  const [nextItemReady, setNextItemReady] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevSlideAnim = useRef(new Animated.Value(0)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;
  const prevContentSlideAnim = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(1)).current;
  const prevBackdropOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const prevContentOpacity = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const nextItemBackdropRef = useRef(null);
  
  // Parallax effect animated values
  const parallaxX = useRef(new Animated.Value(0)).current;
  const parallaxY = useRef(new Animated.Value(0)).current;
  const prevParallaxX = useRef(new Animated.Value(0)).current;
  const prevParallaxY = useRef(new Animated.Value(0)).current;
  
  // Stretchy header animations
  const headerTranslateY = scrollY ? scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [150, 0],
    extrapolate: 'clamp',
  }) : 0;

  const headerScale = scrollY ? scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [1.3, 0.75],
    extrapolate: 'clamp',
  }) : 0.75;

  // Compensate for scale to keep center anchor point
  // When scaling from top-left, center moves down, so we translate up to compensate
  const containerHeight = FEATURED_HEIGHT + 150;
  const headerScaleCompensation = scrollY ? scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [
      -(containerHeight * (1.3 - 0.75)) / 2,
      0
    ],
    extrapolate: 'clamp',
  }) : 0;

  const preloadNextItem = async () => {
    if (totalItems <= 1 || !featuredItems || featuredItems.length === 0) {
      setNextItemReady(true);
      return;
    }
    
    const nextIndex = (currentIndex + 1) % featuredItems.length;
    const nextItem = featuredItems[nextIndex];
    
    if (nextItem && nextItem.backdrop_path) {
      const nextBackdropUrl = TMDBService.getBackdropURL(nextItem.backdrop_path, 'original');
      if (nextBackdropUrl) {
        // Preload the image using React Native's Image.prefetch
        try {
          await Image.prefetch(nextBackdropUrl);
          nextItemBackdropRef.current = nextBackdropUrl;
          setNextItemReady(true);
        } catch (error) {
          // If prefetch fails, still proceed
          setNextItemReady(true);
        }
      } else {
        setNextItemReady(true);
      }
    } else {
      setNextItemReady(true);
    }
  };

  // Initialize displayItem when item first loads
  useEffect(() => {
    if (item && !displayItem) {
      setDisplayItem(item);
    }
  }, [item, displayItem]);

  useEffect(() => {
    if (displayItem) {
      // Fetch logo and details for the display item
      fetchLogo();
      fetchItemDetails();
      // Preload next item's backdrop
      preloadNextItem();
    }
  }, [displayItem?.id]);

  // Setup accelerometer for parallax effect
  useEffect(() => {
    let subscription = null;
    
    const setupAccelerometer = async () => {
      try {
        // Set update interval (60fps for smooth animation)
        Accelerometer.setUpdateInterval(16);
        
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          // Calculate parallax offset based on device tilt
          // Reduced sensitivity for less movement
          const parallaxSensitivity = 10;
          
          // Dead zone threshold - ignore very small movements
          const deadZone = 0.05;
          
          // Apply dead zone filter
          const filteredX = Math.abs(x) > deadZone ? x : 0;
          const filteredY = Math.abs(y) > deadZone ? y : 0;
          
          // Use x and y for horizontal and vertical movement
          // Invert y to match natural movement direction
          // Clamp values to prevent excessive movement (increased range for larger backdrop)
          const offsetX = Math.max(-80, Math.min(80, filteredX * parallaxSensitivity));
          const offsetY = Math.max(-80, Math.min(80, -filteredY * parallaxSensitivity));
          
          // Update both current and previous parallax values
          parallaxX.setValue(offsetX);
          parallaxY.setValue(offsetY);
          prevParallaxX.setValue(offsetX);
          prevParallaxY.setValue(offsetY);
        });
      } catch (error) {
        console.error('Error setting up accelerometer:', error);
      }
    };
    
    setupAccelerometer();
    
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [parallaxX, parallaxY]);

  const fetchItemDetails = async () => {
    if (!displayItem || !displayItem.id) return;
    
    try {
      const mediaType = displayItem.media_type || (displayItem.title ? 'movie' : 'tv');
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${displayItem.id}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
      );
      const details = await response.json();
      if (details) {
        setDisplayItemDetails(details);
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
    }
  };

  // Fetch logo for previous item when it changes
  useEffect(() => {
    if (prevItem) {
      fetchPrevLogo();
    }
  }, [prevItem]);

  const fetchPrevLogo = async () => {
    if (!prevItem) return;
    
    try {
      const mediaType = prevItem.media_type || (prevItem.title ? 'movie' : 'tv');
      const itemId = prevItem.id;
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${itemId}/images?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
      );
      const data = await response.json();
      
      const logo = data.logos?.find(logo => logo.iso_639_1 === 'en') || data.logos?.[0];
      
      if (logo) {
        const logoPath = logo.file_path;
        setPrevLogoUrl(`https://image.tmdb.org/t/p/w500${logoPath}`);
      }
      setPrevLoading(false);
    } catch (error) {
      console.error('Error fetching prev logo:', error);
      setPrevLoading(false);
    }
  };

  // Handle crossfade animation when index changes
  useEffect(() => {
    if (totalItems <= 1) {
      backdropOpacity.setValue(1);
      prevBackdropOpacity.setValue(1);
      contentOpacity.setValue(1);
      prevContentOpacity.setValue(1);
      setDisplayItem(item);
      return;
    }
    
    if (currentIndex !== prevIndex && item) {
      const performTransition = async () => {
        // Store previous item (use displayItem which is the currently shown item)
        if (displayItem) {
          setPrevItem(displayItem);
          setPrevLogoUrl(logoUrl);
          setPrevLoading(false);
        }
        
        // Fetch the new logo BEFORE updating displayItem or starting animations
        setLoading(true);
        const newLogoUrl = await fetchLogoForItem(item);
        
        // Check if we're still on the same index (user might have navigated away quickly)
        if (currentIndex === prevIndex) return;
        
        // Now set the new logo
        setLogoUrl(newLogoUrl);
        setLoading(false);
        
        // Update display item to the new item
        setDisplayItem(item);
        setDisplayItemDetails(null); // Reset details
        setNextItemReady(false);
        
        // Start previous item with full opacity
        prevBackdropOpacity.setValue(1);
        prevContentOpacity.setValue(1);
        // Start new item with 0 opacity (will fade in)
        backdropOpacity.setValue(0);
        contentOpacity.setValue(0);
        
        // Small delay to ensure new backdrop is ready
        requestAnimationFrame(() => {
          // Animate previous backdrop fading out
          const prevBackdropFade = Animated.timing(prevBackdropOpacity, {
            toValue: 0,
            duration: SLIDE_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          });
          
          // Animate previous content fading out
          const prevContentFade = Animated.timing(prevContentOpacity, {
            toValue: 0,
            duration: SLIDE_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          });
          
          // Animate new backdrop fading in
          const newBackdropFade = Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: SLIDE_DURATION,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          });
          
          // Animate new content fading in
          const newContentFade = Animated.timing(contentOpacity, {
            toValue: 1,
            duration: SLIDE_DURATION,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          });
          
          // Run all animations in parallel
          Animated.parallel([
            prevBackdropFade,
            prevContentFade,
            newBackdropFade,
            newContentFade,
          ]).start(() => {
            // After animation completes, clear previous item and reset opacity
            setPrevItem(null);
            setPrevLogoUrl(null);
            prevBackdropOpacity.setValue(1);
            backdropOpacity.setValue(1);
            prevContentOpacity.setValue(1);
            contentOpacity.setValue(1);
            // Preload next item for smooth next transition
            preloadNextItem();
          });
        });
      };
      
      performTransition();
      setPrevIndex(currentIndex);
    }
  }, [currentIndex, prevIndex, totalItems, featuredItems, item, displayItem]);

  // Handle story progress and auto-advance
  useEffect(() => {
    if (totalItems <= 1) return; // No need for progress if only one item
    
    // Reset progress
    progressAnim.setValue(0);
    
    // Start progress animation
    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    
    progressAnimation.start();
    
    // Set timer to advance to next story
    timerRef.current = setTimeout(() => {
      if (onNext) {
        onNext();
      }
    }, STORY_DURATION);
    
    return () => {
      progressAnimation.stop();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, totalItems, progressAnim, onNext]);

  // Helper function to fetch logo for a specific item and return the URL
  const fetchLogoForItem = async (itemToFetch) => {
    if (!itemToFetch) return null;
    
    try {
      const mediaType = itemToFetch.media_type || (itemToFetch.title ? 'movie' : 'tv');
      const itemId = itemToFetch.id;
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${itemId}/images?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
      );
      const data = await response.json();
      
      // Find English logo, or use the first one
      const logo = data.logos?.find(logo => logo.iso_639_1 === 'en') || data.logos?.[0];
      
      if (logo) {
        const logoPath = logo.file_path;
        return `https://image.tmdb.org/t/p/w500${logoPath}`;
      }
      return null;
    } catch (error) {
      console.error('Error fetching logo:', error);
      return null;
    }
  };

  const fetchLogo = async () => {
    if (!displayItem) return;
    
    // Store the current item ID to ensure we're setting the logo for the correct item
    const currentItemId = displayItem.id;
    
    const logoUrl = await fetchLogoForItem(displayItem);
    
    // Only set logo if we're still on the same item (prevent race conditions)
    if (displayItem && displayItem.id === currentItemId) {
      setLogoUrl(logoUrl);
      setLoading(false);
    }
  };

  if (!item || !displayItem) return null;

  const backdropUrl = TMDBService.getBackdropURL(displayItem.backdrop_path, 'original');
  const displayTitle = displayItem.title || displayItem.name || '';
  const rating = displayItem.vote_average || displayItemDetails?.vote_average || 0;
  const runtime = displayItem.runtime || displayItemDetails?.runtime || null;

  const handleWatchNow = () => {
    if (navigation && displayItem) {
      navigation.navigate('MovieDetails', { item: displayItem });
    }
  };

  const handleLeftTap = () => {
    if (totalItems <= 1 || !onPrevious) return;
    // Go to previous item
    onPrevious();
  };

  const handleRightTap = () => {
    if (totalItems <= 1 || !onNext) return;
    // Go to next item
    onNext();
  };

  // Calculate progress bar widths
  const progressBarWidth = (SCREEN_WIDTH - 16 - (totalItems - 1) * 4) / totalItems;

  return (
    <View style={styles.container}>
      {/* Story Progress Bars */}
      {totalItems > 1 && (
        <View style={[styles.progressBarsContainer, { top: insets.top + 50 }]}>
          {Array.from({ length: totalItems }).map((_, index) => {
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            
            return (
              <View
                key={index}
                style={[
                  styles.progressBarBackground,
                  { width: progressBarWidth },
                  index > 0 && { marginLeft: 4 },
                ]}
              >
                {isActive && (
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                )}
                {isCompleted && (
                  <View style={[styles.progressBarFill, { width: '100%' }]} />
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Top Gradient Shadow for Logo Visibility */}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.4)', 'transparent']}
        style={[styles.topGradient, { top: -100 }]}
        pointerEvents="none"
      />

      {/* Logo and Filter Buttons */}
      <View style={[styles.logoButtonsContainer, { top: insets.top + 60 + 1 }]}>
        <Image 
          source={require('../assets/logo.png')} 
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.buttonsRow}>
          <TouchableOpacity 
            style={styles.pillButton} 
            activeOpacity={0.7}
            onPress={onMoviesFilterPress}
          >
            <BlurView 
              intensity={80} 
              tint="dark" 
              style={[
                styles.pillButtonBlur,
                filterMode === 'movies' && styles.pillButtonActive
              ]}
            >
              <Text style={[
                styles.pillButtonText,
                filterMode === 'movies' && styles.pillButtonTextActive
              ]}>Movies</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.pillButton} 
            activeOpacity={0.7}
            onPress={onShowsFilterPress}
          >
            <BlurView 
              intensity={80} 
              tint="dark" 
              style={[
                styles.pillButtonBlur,
                filterMode === 'shows' && styles.pillButtonActive
              ]}
            >
              <Text style={[
                styles.pillButtonText,
                filterMode === 'shows' && styles.pillButtonTextActive
              ]}>Shows</Text>
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.pillButton} 
            activeOpacity={0.7}
            onPress={onPopularNowFilterPress}
          >
            <BlurView 
              intensity={80} 
              tint="dark" 
              style={[
                styles.pillButtonBlur,
                filterMode === 'popular' && styles.pillButtonActive
              ]}
            >
              <Text style={[
                styles.pillButtonText,
                filterMode === 'popular' && styles.pillButtonTextActive
              ]}>Popular Now</Text>
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>

      {/* Touch Areas for Navigation - Left side for previous, Right side for next */}
      {totalItems > 1 && (
        <>
          <TouchableOpacity
            style={styles.leftTouchArea}
            onPress={handleLeftTap}
            activeOpacity={1}
          />
          <TouchableOpacity
            style={styles.rightTouchArea}
            onPress={handleRightTap}
            activeOpacity={1}
          />
        </>
      )}

      {/* Previous Item - slides out to left */}
      {prevItem && (
        <>
          <View
            style={[
              styles.backdropContainer,
              styles.prevItemLayer,
            ]}
          >
            {TMDBService.getBackdropURL(prevItem.backdrop_path, 'original') ? (
              <Animated.View
                style={[
                  styles.backdrop,
                  {
                    transform: [
                      { translateX: prevParallaxX },
                      { translateY: Animated.add(Animated.add(headerTranslateY, headerScaleCompensation), prevParallaxY) },
                      { scale: headerScale },
                    ],
                    opacity: prevBackdropOpacity,
                  },
                ]}
              >
                <CachedImage
                  source={{ uri: TMDBService.getBackdropURL(prevItem.backdrop_path, 'original') }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              </Animated.View>
            ) : (
              <Animated.View 
                style={[
                  styles.backdrop, 
                  styles.placeholder,
                  {
                    transform: [
                      { translateX: prevParallaxX },
                      { translateY: Animated.add(Animated.add(headerTranslateY, headerScaleCompensation), prevParallaxY) },
                      { scale: headerScale },
                    ],
                    opacity: prevBackdropOpacity,
                  },
                ]} 
              />
            )}
          </View>

          <Animated.View
            style={[
              styles.content,
              styles.prevItemLayer,
              {
                opacity: prevContentOpacity,
              },
            ]}
          >
            <View style={styles.titleContainer}>
              {prevLogoUrl ? (
                <CachedImage
                  source={{ uri: prevLogoUrl }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                !prevLoading && (
                  <Text style={styles.fallbackTitle}>{prevItem.title || prevItem.name || ''}</Text>
                )
              )}
            </View>
          </Animated.View>
        </>
      )}

      {/* Current Item - crossfades in */}
      <View
        style={[
          styles.backdropContainer,
          styles.currentItemLayer,
        ]}
      >
        {backdropUrl ? (
          <Animated.View
            style={[
              styles.backdrop,
              {
                transform: [
                  { translateX: parallaxX },
                  { translateY: Animated.add(Animated.add(headerTranslateY, headerScaleCompensation), parallaxY) },
                  { scale: headerScale },
                ],
                opacity: totalItems > 1 ? backdropOpacity : 1,
              },
            ]}
          >
            <CachedImage
              source={{ uri: backdropUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </Animated.View>
        ) : (
          <Animated.View 
            style={[
              styles.backdrop, 
              styles.placeholder,
              {
                transform: [
                  { translateX: parallaxX },
                  { translateY: Animated.add(Animated.add(headerTranslateY, headerScaleCompensation), parallaxY) },
                  { scale: headerScale },
                ],
                opacity: totalItems > 1 ? backdropOpacity : 1,
              },
            ]} 
          />
        )}
      </View>
      
      {/* Static Gradient fade to black at bottom - same for all movies */}
      <View style={styles.gradient}>
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', '#000']}
        locations={[0, 0.5, 0.8, 1]}
          style={StyleSheet.absoluteFill}
      />
      </View>

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          styles.contentLayer,
          {
            opacity: totalItems > 1 ? contentOpacity : 1,
          },
        ]}
      >
        {/* Title/Logo - Centered and Tappable */}
        <TouchableOpacity
          style={styles.titleContainer}
          onPress={handleWatchNow}
          activeOpacity={0.8}
        >
          {logoUrl ? (
            <CachedImage
              source={{ uri: logoUrl }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            !loading && (
              <Text style={styles.fallbackTitle}>{displayTitle}</Text>
            )
          )}
          
          {/* Rating and Runtime */}
          <View style={styles.movieInfoRow}>
            {rating > 0 && (
              <View style={styles.movieInfoItem}>
                <Ionicons name="star" size={14} color="#ffd700" style={{ marginRight: 4 }} />
                <Text style={styles.movieInfoText}>{rating.toFixed(1)}</Text>
        </View>
            )}
            {runtime && (
              <View style={styles.movieInfoItem}>
                <Ionicons name="time-outline" size={14} color="rgba(255, 255, 255, 0.8)" style={{ marginRight: 4 }} />
                <Text style={styles.movieInfoText}>{runtime} min</Text>
        </View>
            )}
      </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: FEATURED_HEIGHT,
    position: 'relative',
    overflow: 'hidden', // Keep hidden to prevent backdrop from showing outside bounds
    // Ensure container doesn't stretch - it's static with fixed dimensions
    flexShrink: 0,
    flexGrow: 0,
  },
  progressBarsContainer: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    zIndex: 10,
    height: 3,
  },
  leftTouchArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_WIDTH / 2,
    height: '100%',
    zIndex: 4,
  },
  rightTouchArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: SCREEN_WIDTH / 2,
    height: '100%',
    zIndex: 4,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  prevItemLayer: {
    zIndex: 1,
  },
  currentItemLayer: {
    zIndex: 2,
  },
  contentLayer: {
    zIndex: 10,
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
    height: '100%',
    zIndex: 3,
    pointerEvents: 'none',
    // Ensure gradient doesn't stretch - it's static
    flexShrink: 0,
  },
  content: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
    // Ensure content doesn't stretch - it's static
    flexShrink: 0,
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  logo: {
    width: '70%',
    height: 120,
    maxWidth: 400,
    alignSelf: 'center',
  },
  fallbackTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    textAlign: 'center',
  },
  movieInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  movieInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 4,
  },
  movieInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 350,
    zIndex: 10,
  },
  logoButtonsContainer: {
    position: 'absolute',
    right: 50,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    paddingVertical: 8,
  },
  headerLogo: {
    width: 200,
    height: 67,
    marginRight: -60,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  pillButtonBlur: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  pillButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  pillButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  pillButtonTextActive: {
    color: '#000',
  },
});

