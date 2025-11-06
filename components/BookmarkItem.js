import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TMDBService } from '../services/TMDBService';
import { CachedImage } from './CachedImage';

export const BookmarkItem = ({ item, onPress, onRemove }) => {
  // For manga items, poster_path is already a full URL from AniList
  // For movie/TV items, we need to use TMDBService to get the full URL
  const posterURL = item.media_type === 'manga' 
    ? item.poster_path 
    : TMDBService.getPosterURL(item.poster_path);
  const displayTitle = item.title || 'Unknown';
  const displayDate = item.release_date || '';
  const year = displayDate ? displayDate.substring(0, 4) : '';

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.posterContainer}>
        {posterURL ? (
          <CachedImage
            source={{ uri: posterURL }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={32} color="#666" />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        {year ? (
          <Text style={styles.year}>{year}</Text>
        ) : null}
      </View>

      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 140,
    marginRight: 12,
    position: 'relative',
  },
  posterContainer: {
    width: 140,
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
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
  infoContainer: {
    width: 140,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  year: {
    fontSize: 12,
    color: '#888',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 2,
  },
});

