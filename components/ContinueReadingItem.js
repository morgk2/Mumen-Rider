import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CachedImage } from './CachedImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH * 0.85;
const ITEM_HEIGHT = ITEM_WIDTH * 0.56; // 16:9 aspect ratio

export const ContinueReadingItem = ({ item, progress, onPress }) => {
  if (!item || !progress) return null;

  const { currentPage, totalPages, progress: progressPercent, chapterNumber } = progress;
  const pagesLeft = totalPages - currentPage;
  
  const formatPagesLeft = () => {
    if (pagesLeft === 1) {
      return '1 page left';
    }
    return `${pagesLeft} pages left`;
  };

  // Get thumbnail URL - use cover image or banner
  const getThumbnailUrl = () => {
    if (item.coverImage?.large) {
      return item.coverImage.large;
    }
    if (item.coverImage?.medium) {
      return item.coverImage.medium;
    }
    if (item.bannerImage) {
      return item.bannerImage;
    }
    return null;
  };

  const thumbnailUrl = getThumbnailUrl();
  const progressPercentage = Math.round(progressPercent * 100);

  // Get display title
  const getDisplayTitle = () => {
    const title = item.title?.romaji || item.title?.english || item.title || 'Unknown';
    return title;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(item, progress)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {thumbnailUrl ? (
          <CachedImage
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
        </View>
      </View>

      {/* Info Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.5, 1]}
        style={styles.infoOverlay}
      >
        <Text style={styles.title} numberOfLines={1}>
          {getDisplayTitle()}
        </Text>
        <Text style={styles.chapterInfo}>
          Chapter {chapterNumber}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.percentage}>{progressPercentage}%</Text>
          <Text style={styles.pagesLeft}>{formatPagesLeft()}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  chapterInfo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pagesLeft: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

