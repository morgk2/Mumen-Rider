import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TMDBService } from '../services/TMDBService';

export const DownloadedVideoItem = ({ video, onPress, onDelete, isEpisode = false }) => {
  const posterUrl = video.posterPath 
    ? TMDBService.getPosterURL(video.posterPath, 'w500')
    : null;
  
  const displayTitle = video.title || video.name || 'Unknown';
  const subtitle = isEpisode 
    ? `S${video.season}E${video.episodeNumber} - ${video.episodeTitle || `Episode ${video.episodeNumber}`}`
    : video.releaseDate 
      ? new Date(video.releaseDate).getFullYear()
      : '';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(video)}
      activeOpacity={0.8}
    >
      <View style={styles.posterContainer}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons 
              name={isEpisode ? "tv-outline" : "film-outline"} 
              size={32} 
              color="rgba(255, 255, 255, 0.5)" 
            />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {isEpisode && video.episodeOverview ? (
          <Text style={styles.description} numberOfLines={2}>
            {video.episodeOverview}
          </Text>
        ) : null}
      </View>

      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete && onDelete(video);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  posterContainer: {
    width: 80,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#2a2a2a',
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
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});

