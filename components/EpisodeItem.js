import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TMDBService } from '../services/TMDBService';

export const EpisodeItem = ({ 
  episode, 
  tvShow, 
  season, 
  onPress, 
  progress,
  isDownloaded = false,
  isDownloading = false,
  downloadProgress = 0,
  onDownloadPress = null,
}) => {
  const thumbnailUrl = TMDBService.getStillURL(episode.still_path);
  const episodeNumber = episode.episode_number || 0;
  const episodeName = episode.name || `Episode ${episodeNumber}`;
  const overview = episode.overview || '';
  const airDate = episode.air_date ? new Date(episode.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const progressPercentage = progress ? (progress.progress || 0) * 100 : 0;

  const handleDownloadPress = (e) => {
    e.stopPropagation(); // Prevent triggering onPress for the episode
    if (onDownloadPress) {
      onDownloadPress(episode);
    }
  };

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

      {/* Download Button */}
      {onDownloadPress && (
        <TouchableOpacity
          style={[
            styles.downloadButton,
            isDownloaded && styles.downloadButtonActive,
            isDownloading && styles.downloadButtonDownloading,
          ]}
          onPress={handleDownloadPress}
          activeOpacity={0.7}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <View style={styles.downloadButtonContent}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.downloadButtonText}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
          ) : (
            <Ionicons
              name={isDownloaded ? 'checkmark-circle' : 'download-outline'}
              size={20}
              color={isDownloaded ? '#000' : '#fff'}
            />
          )}
        </TouchableOpacity>
      )}
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
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginLeft: 8,
  },
  downloadButtonActive: {
    backgroundColor: '#4CAF50',
  },
  downloadButtonDownloading: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
  },
  downloadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

