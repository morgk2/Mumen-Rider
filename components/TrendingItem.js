import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { TMDBService } from '../services/TMDBService';
import { AniListService } from '../services/AniListService';
import { CachedImage } from './CachedImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_LARGE_SCREEN = SCREEN_WIDTH >= 768;
const IS_WEB = Platform.OS === 'web';
const CARD_WIDTH = IS_LARGE_SCREEN && IS_WEB ? 220 : 140;
const CARD_HEIGHT = IS_LARGE_SCREEN && IS_WEB ? 330 : 210;

export const TrendingItem = ({ item, onPress, variant = 'horizontal' }) => {
  // Check if it's a manga (AniList) or movie/TV (TMDB)
  const isManga = item.title && typeof item.title === 'object';
  
  const posterURL = isManga 
    ? AniListService.getCoverImage(item)
    : TMDBService.getPosterURL(item.poster_path);
  
  const displayTitle = isManga 
    ? AniListService.getMangaTitle(item)
    : (item.title || item.name || 'Unknown');
  
  const displayDate = isManga 
    ? (item.startDate ? `${item.startDate.year || ''}-${String(item.startDate.month || '').padStart(2, '0')}-${String(item.startDate.day || '').padStart(2, '0')}` : '')
    : (item.release_date || item.first_air_date || '');
  
  const year = isManga
    ? (item.startDate?.year?.toString() || '')
    : (displayDate ? displayDate.substring(0, 4) : '');
  
  const rating = isManga ? item.averageScore : item.vote_average;

  const isGrid = variant === 'grid';

  return (
    <TouchableOpacity 
      style={[styles.container, isGrid && styles.gridContainer]}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.posterContainer, isGrid && styles.gridPosterContainer]}>
        {posterURL ? (
          <CachedImage
            source={{ uri: posterURL }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        
        {rating > 0 && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>
              ★ {isManga ? (rating / 10).toFixed(1) : rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.infoContainer, isGrid && styles.gridInfoContainer]}>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        {year ? (
          <Text style={styles.year}>{year}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginRight: IS_LARGE_SCREEN ? 16 : 12,
  },
  gridContainer: {
    width: '100%',
    marginRight: 0,
  },
  posterContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: IS_LARGE_SCREEN ? 8 : 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: IS_LARGE_SCREEN ? 12 : 8,
    ...(IS_LARGE_SCREEN && {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    }),
  },
  gridPosterContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  placeholderText: {
    color: '#666',
    fontSize: IS_LARGE_SCREEN ? 14 : 12,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: IS_LARGE_SCREEN ? 12 : 8,
    right: IS_LARGE_SCREEN ? 12 : 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: IS_LARGE_SCREEN ? 8 : 6,
    paddingVertical: IS_LARGE_SCREEN ? 6 : 4,
    borderRadius: IS_LARGE_SCREEN ? 6 : 8,
  },
  ratingText: {
    color: '#fff',
    fontSize: IS_LARGE_SCREEN ? 13 : 11,
    fontWeight: '600',
  },
  infoContainer: {
    width: CARD_WIDTH,
  },
  gridInfoContainer: {
    width: '100%',
  },
  title: {
    fontSize: IS_LARGE_SCREEN ? 16 : 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: IS_LARGE_SCREEN ? 6 : 4,
  },
  year: {
    fontSize: IS_LARGE_SCREEN ? 14 : 12,
    color: '#888',
  },
});

