import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AniListService } from '../services/AniListService';
import { DownloadService } from '../services/DownloadService';

export const DownloadedMangaItem = ({ manga, onPress, onDelete }) => {
  const [coverImagePath, setCoverImagePath] = React.useState(null);
  const displayTitle = AniListService.getMangaTitle(manga);
  const chaptersCount = manga.downloadedChapters?.length || 0;

  React.useEffect(() => {
    loadCoverImage();
  }, [manga.id]);

  const loadCoverImage = async () => {
    try {
      const path = await DownloadService.getMangaImagePath(manga.id, 'poster');
      setCoverImagePath(path);
    } catch (error) {
      console.error('Error loading cover image:', error);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(manga)}
      activeOpacity={0.8}
    >
      <View style={styles.posterContainer}>
        {coverImagePath ? (
          <Image
            source={{ uri: coverImagePath }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="book-outline" size={32} color="rgba(255, 255, 255, 0.5)" />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {displayTitle}
        </Text>
        <View style={styles.chaptersInfo}>
          <Ionicons name="bookmark" size={14} color="rgba(255, 255, 255, 0.6)" />
          <Text style={styles.chaptersText}>
            {chaptersCount} {chaptersCount === 1 ? 'Chapter' : 'Chapters'}
          </Text>
        </View>
      </View>

      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete && onDelete(manga);
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
    marginBottom: 8,
  },
  chaptersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chaptersText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});

