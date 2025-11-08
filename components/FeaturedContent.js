import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TMDBService } from '../services/TMDBService';
import { CachedImage } from './CachedImage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.6;

export const FeaturedContent = ({ item, navigation, scrollY }) => {
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  
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
  const containerHeight = FEATURED_HEIGHT + 150;
  const headerScaleCompensation = scrollY ? scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [
      -(containerHeight * (1.3 - 0.75)) / 2,
      0
    ],
    extrapolate: 'clamp',
  }) : 0;

  useEffect(() => {
    if (item) {
      fetchLogo();
    }
  }, [item]);

  const fetchLogo = async () => {
    if (!item) return;
    
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const itemId = item.id;
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${itemId}/images?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
      );
      const data = await response.json();
      
      // Find English logo, or use the first one
      const logo = data.logos?.find(logo => logo.iso_639_1 === 'en') || data.logos?.[0];
      
      if (logo) {
        const logoPath = logo.file_path;
        setLogoUrl(`https://image.tmdb.org/t/p/w500${logoPath}`);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching logo:', error);
      setLoading(false);
    }
  };

  if (!item) return null;

  const backdropUrl = TMDBService.getBackdropURL(item.backdrop_path, 'original');
  const displayTitle = item.title || item.name || '';

  const handleWatchNow = () => {
    if (navigation && item) {
      navigation.navigate('MovieDetails', { item });
    }
  };

  const handleAddToList = () => {
    console.log('Add to List pressed:', item);
    // TODO: Add to user's list
  };

  return (
    <View style={styles.container}>
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
        {backdropUrl ? (
          <CachedImage
            source={{ uri: backdropUrl }}
            style={styles.backdrop}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.backdrop, styles.placeholder]} />
        )}
      </Animated.View>
      
      {/* Gradient fade to black at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', '#000']}
        locations={[0, 0.5, 0.8, 1]}
        style={styles.gradient}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Title/Logo - Centered */}
        <View style={styles.titleContainer}>
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
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.watchNowButton}
            onPress={handleWatchNow}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={20} color="#000" style={styles.buttonIcon} />
            <Text style={styles.watchNowText}>Watch Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addToListButton, { marginLeft: 12 }]}
            onPress={handleAddToList}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    height: '100%',
    zIndex: 1,
  },
  content: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
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
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 140,
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  watchNowText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  addToListButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

