import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AniListService } from '../services/AniListService';
import { DownloadService } from '../services/DownloadService';
import { TMDBService } from '../services/TMDBService';

export const DownloadingItem = ({ download, onCancel }) => {
  const [coverImagePath, setCoverImagePath] = React.useState(null);
  const isVideoDownload = download.mediaType === 'movie' || download.mediaType === 'tv';
  
  const displayTitle = isVideoDownload 
    ? (download.title || download.mangaTitle || 'Unknown')
    : AniListService.getMangaTitle({ title: download.mangaTitle });

  React.useEffect(() => {
    loadCoverImage();
  }, [isVideoDownload ? download.mediaId : download.mangaId]);

  const loadCoverImage = async () => {
    try {
      if (isVideoDownload) {
        // For videos, we don't have a local poster yet, so we'll use a placeholder
        // In the future, we could download the poster
        setCoverImagePath(null);
      } else {
        const path = await DownloadService.getMangaImagePath(download.mangaId, 'poster');
        setCoverImagePath(path);
      }
    } catch (error) {
      console.error('Error loading cover image:', error);
    }
  };

  const getStatusIcon = () => {
    switch (download.status) {
      case 'downloading':
        return <Ionicons name="download" size={16} color="#4CAF50" />;
      case 'queued':
        return <Ionicons name="time-outline" size={16} color="#FFA726" />;
      case 'error':
        return <Ionicons name="alert-circle" size={16} color="#ff4444" />;
      default:
        return <Ionicons name="download-outline" size={16} color="#fff" />;
    }
  };

  const getStatusText = () => {
    switch (download.status) {
      case 'downloading':
        return 'Downloading...';
      case 'queued':
        return 'Queued';
      case 'error':
        return 'Error';
      default:
        return 'Processing...';
    }
  };

  const progressPercent = Math.round(download.progress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.posterContainer}>
        {coverImagePath ? (
          <Image
            source={{ uri: coverImagePath }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons 
              name={isVideoDownload ? (download.mediaType === 'tv' ? "tv-outline" : "film-outline") : "book-outline"} 
              size={32} 
              color="rgba(255, 255, 255, 0.5)" 
            />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {displayTitle}
        </Text>
        <Text style={styles.chapterTitle} numberOfLines={1}>
          {isVideoDownload 
            ? (download.episodeTitle || (download.mediaType === 'tv' ? `S${download.season}E${download.episodeNumber}` : 'Movie'))
            : (download.chapterTitle || `Chapter ${download.chapterNumber}`)
          }
        </Text>
        
        <View style={styles.statusContainer}>
          {getStatusIcon()}
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {(download.status === 'downloading' || download.status === 'queued') && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressPercent}>{Math.min(100, Math.max(0, progressPercent))}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(100, Math.max(0, progressPercent))}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {isVideoDownload 
                ? (download.downloadStatus === 'fetching_stream' 
                    ? 'Fetching stream...' 
                    : download.downloadStatus === 'downloading_hls'
                    ? 'Downloading HLS segments...'
                    : download.downloadStatus === 'downloading_video'
                    ? 'Downloading video...'
                    : download.downloadStatus === 'validating_file'
                    ? 'Validating file...'
                    : download.downloadStatus === 'saving_metadata'
                    ? 'Saving metadata...'
                    : download.status === 'queued'
                    ? 'Queued for download...'
                    : 'Downloading...')
                : `${download.downloadedPages || 0} / ${download.totalPages || 0} pages`
              }
            </Text>
          </View>
        )}

        {download.status === 'error' && download.error && (
          <Text style={styles.errorText} numberOfLines={1}>
            {download.error}
          </Text>
        )}
      </View>

      {onCancel && download.status !== 'error' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => onCancel && onCancel(download)}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={24} color="#ff4444" />
        </TouchableOpacity>
      )}
    </View>
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
  chapterTitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 4,
  },
  cancelButton: {
    padding: 8,
    marginLeft: 8,
  },
});

