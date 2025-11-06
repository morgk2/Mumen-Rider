import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { TMDBService } from '../services/TMDBService';

export const SearchCard = ({ item, onPress }) => {
  const thumbnailUrl = TMDBService.getPosterURL(item.poster_path, 'w500') || 
                       TMDBService.getBackdropURL(item.backdrop_path, 'w500');
  const displayTitle = item.title || item.name || 'Unknown';
  const displayDate = item.release_date || item.first_air_date || '';
  const year = displayDate ? displayDate.substring(0, 4) : '';
  const overview = item.overview || '';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholder]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        {item.vote_average > 0 && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {item.vote_average.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {displayTitle}
          </Text>
        </View>

        {year ? (
          <Text style={styles.year}>{year}</Text>
        ) : null}

        {overview ? (
          <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
            {overview}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 59, 48, 0.25)',
    height: 120,
  },
  thumbnailContainer: {
    width: 160,
    height: 120,
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
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  infoContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  headerRow: {
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  year: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 16,
  },
});


