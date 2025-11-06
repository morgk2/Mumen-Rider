import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DownloadService } from '../services/DownloadService';
import { AniListService } from '../services/AniListService';
import { ChapterItem } from '../components/ChapterItem';

export default function DownloadedMangaDetailsScreen({ route, navigation }) {
  const { manga } = route.params || {};
  const insets = useSafeAreaInsets();
  const [mangaInfo, setMangaInfo] = useState(null);
  const [downloadedChapters, setDownloadedChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coverImagePath, setCoverImagePath] = useState(null);

  useEffect(() => {
    if (manga) {
      loadMangaDetails();
    }
  }, [manga]);

  const loadMangaDetails = async () => {
    if (!manga || !manga.id) return;
    
    setLoading(true);
    try {
      // Load manga info
      const info = await DownloadService.getMangaInfo(manga.id);
      if (info) {
        setMangaInfo(info);
      } else {
        // Fallback to provided manga data
        setMangaInfo(manga);
      }
      
      // Load downloaded chapters
      const chapters = await DownloadService.getDownloadedChapters(manga.id);
      setDownloadedChapters(chapters);
      
      // Load cover image
      const coverPath = await DownloadService.getMangaImagePath(manga.id, 'poster');
      setCoverImagePath(coverPath);
    } catch (error) {
      console.error('Error loading manga details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChapterPress = async (chapter) => {
    if (!navigation || !chapter || !manga) return;
    
    // Get downloaded pages
    const pages = await DownloadService.getChapterPages(manga.id, chapter.chapterNumber);
    if (!pages || pages.length === 0) {
      Alert.alert('Error', 'Chapter files not found. The download may be corrupted.');
      return;
    }
    
    // Navigate to reader with offline pages
    // Get all chapters for navigation
    const allChapters = downloadedChapters.map(ch => ({
      number: ch.chapterNumber,
      title: ch.chapterTitle || `Chapter ${ch.chapterNumber}`,
      url: ch.chapterUrl,
    }));
    
    navigation.navigate('MangaReader', {
      chapter: {
        ...chapter,
        url: chapter.chapterUrl, // Keep original URL for reference
      },
      manga: mangaInfo || manga,
      pages: pages, // Pass downloaded pages
      isOffline: true,
      allChapters: allChapters,
    });
  };

  const handleDeleteChapter = (chapter) => {
    Alert.alert(
      'Delete Chapter',
      `Delete Chapter ${chapter.chapterNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DownloadService.deleteChapter(manga.id, chapter.chapterNumber);
              await loadMangaDetails();
              Alert.alert('Success', 'Chapter deleted successfully');
            } catch (error) {
              console.error('Error deleting chapter:', error);
              Alert.alert('Error', 'Failed to delete chapter');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  const displayTitle = AniListService.getMangaTitle(mangaInfo || manga);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Manga Info Section */}
        <View style={styles.mangaInfoSection}>
          {coverImagePath ? (
            <Image
              source={{ uri: coverImagePath }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.coverImage, styles.placeholder]}>
              <Ionicons name="book-outline" size={48} color="rgba(255, 255, 255, 0.5)" />
            </View>
          )}
          <View style={styles.mangaInfo}>
            <Text style={styles.mangaTitle}>{displayTitle}</Text>
            {mangaInfo?.description && (
              <Text style={styles.mangaDescription} numberOfLines={4}>
                {mangaInfo.description}
              </Text>
            )}
            <View style={styles.mangaStats}>
              {mangaInfo?.chapters && (
                <View style={styles.statItem}>
                  <Ionicons name="book" size={16} color="rgba(255, 255, 255, 0.6)" />
                  <Text style={styles.statText}>{mangaInfo.chapters} Chapters</Text>
                </View>
              )}
              {downloadedChapters.length > 0 && (
                <View style={styles.statItem}>
                  <Ionicons name="download" size={16} color="#4CAF50" />
                  <Text style={styles.statText}>
                    {downloadedChapters.length} Downloaded
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Downloaded Chapters Section */}
        <View style={styles.chaptersSection}>
          <Text style={styles.sectionTitle}>Downloaded Chapters</Text>
          {downloadedChapters.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No chapters downloaded</Text>
            </View>
          ) : (
            <View style={styles.chaptersList}>
              {downloadedChapters.map((chapter) => (
                <View key={chapter.chapterNumber} style={styles.chapterItemWrapper}>
                  <ChapterItem
                    chapter={chapter}
                    onPress={handleChapterPress}
                  />
                  <TouchableOpacity
                    style={styles.deleteChapterButton}
                    onPress={() => handleDeleteChapter(chapter)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mangaInfoSection: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  coverImage: {
    width: 120,
    height: 180,
    borderRadius: 12,
    marginRight: 16,
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mangaInfo: {
    flex: 1,
  },
  mangaTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  mangaDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
    marginBottom: 12,
  },
  mangaStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  chaptersSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  chaptersList: {
    gap: 8,
  },
  chapterItemWrapper: {
    position: 'relative',
  },
  deleteChapterButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -9 }],
    padding: 8,
    zIndex: 10,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});

