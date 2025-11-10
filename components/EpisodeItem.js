import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { TMDBService } from '../services/TMDBService';

export const EpisodeItem = ({ episode, tvShow, season, onPress, progress }) => {
  const thumbnailUrl = TMDBService.getStillURL(episode.still_path);
  const episodeNumber = episode.episode_number || 0;
  const episodeName = episode.name || `Episode ${episodeNumber}`;
  const overview = episode.overview || '';
  const airDate = episode.air_date ? new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const progressPercentage = progress ? (progress.progress || 0) * 100 : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(episode)}
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
        {progress && progressPercentage > 0 && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.episodeNumber}>Episode {episodeNumber}</Text>
          {airDate ? (
            <Text style={styles.airDate}>{airDate}</Text>
          ) : null}
        </View>

        {episodeName ? (
          <Text style={styles.episodeTitle} numberOfLines={2} ellipsizeMode="tail">
            {episodeName}
          </Text>
        ) : null}

        {overview ? (
          <Text style={styles.episodeDescription} numberOfLines={2} ellipsizeMode="tail">
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
    height: 90,
  },
  thumbnailContainer: {
    width: 160,
    height: 90,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF3B30',
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
  infoContainer: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  episodeNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  airDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  episodeTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  episodeDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 16,
  },
});

