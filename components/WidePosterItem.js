import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { TMDBService } from '../services/TMDBService';
import { CachedImage } from './CachedImage';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_LARGE_SCREEN = SCREEN_WIDTH >= 768;
const IS_WEB = Platform.OS === 'web';
const WIDE_POSTER_WIDTH = IS_LARGE_SCREEN && IS_WEB ? 280 : 200;
const WIDE_POSTER_HEIGHT = IS_LARGE_SCREEN && IS_WEB ? 160 : 120;

export const WidePosterItem = ({ item, onPress, rank = null, showLogo = true }) => {
  const [logoUrl, setLogoUrl] = useState(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  
  const backdropUrl = item.backdrop_path 
    ? TMDBService.getBackdropURL(item.backdrop_path, 'w780') 
    : (item.poster_path ? TMDBService.getPosterURL(item.poster_path, 'w500') : null);
  const displayTitle = item.title || item.name || 'Unknown';

  useEffect(() => {
    if (item && showLogo) {
      fetchLogo();
    }
  }, [item, showLogo]);

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
      setLoadingLogo(false);
    } catch (error) {
      console.error('Error fetching logo:', error);
      setLoadingLogo(false);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.8}
    >
      {/* Rank Badge - Only show for top 3 */}
      {rank !== null && rank <= 3 && (
        <View style={[styles.rankBadge, rank === 1 && styles.rankBadgeGold, rank === 2 && styles.rankBadgeSilver, rank === 3 && styles.rankBadgeBronze]}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      )}
      
      {/* Wide Poster */}
      <View style={styles.posterContainer}>
        {backdropUrl ? (
          <>
            <CachedImage
              source={{ uri: backdropUrl }}
              style={styles.poster}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.8)']}
              style={styles.gradient}
            />
          </>
        ) : (
          <View style={[styles.poster, styles.placeholder]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        
        {/* Title Logo or Text */}
        <View style={styles.titleContainer}>
          {logoUrl && !loadingLogo ? (
            <CachedImage
              source={{ uri: logoUrl }}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            !loadingLogo && (
              <Text style={styles.titleText} numberOfLines={2}>
                {displayTitle}
              </Text>
            )
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: WIDE_POSTER_WIDTH,
    marginRight: IS_LARGE_SCREEN ? 12 : 8,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(229, 9, 20, 0.95)',
    width: IS_LARGE_SCREEN ? 44 : 36,
    height: IS_LARGE_SCREEN ? 44 : 36,
    borderRadius: IS_LARGE_SCREEN ? 22 : 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  rankBadgeGold: {
    backgroundColor: 'rgba(255, 215, 0, 0.95)',
  },
  rankBadgeSilver: {
    backgroundColor: 'rgba(192, 192, 192, 0.95)',
  },
  rankBadgeBronze: {
    backgroundColor: 'rgba(205, 127, 50, 0.95)',
  },
  rankText: {
    color: '#fff',
    fontSize: IS_LARGE_SCREEN ? 20 : 16,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  posterContainer: {
    width: WIDE_POSTER_WIDTH,
    height: WIDE_POSTER_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  placeholder: {
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: IS_LARGE_SCREEN ? 12 : 8,
    paddingBottom: IS_LARGE_SCREEN ? 16 : 12,
  },
  logo: {
    width: '100%',
    height: IS_LARGE_SCREEN ? 50 : 40,
    maxHeight: 50,
  },
  titleText: {
    color: '#fff',
    fontSize: IS_LARGE_SCREEN ? 16 : 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

