import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DownloadService } from '../services/DownloadService';
import { VideoDownloadService } from '../services/VideoDownloadService';
import { DownloadedMangaItem } from '../components/DownloadedMangaItem';
import { DownloadedVideoItem } from '../components/DownloadedVideoItem';
import { DownloadingItem } from '../components/DownloadingItem';

export default function DownloadsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('downloading'); // 'downloading' or 'downloaded'
  const [downloadedManga, setDownloadedManga] = useState([]);
  const [downloadedMovies, setDownloadedMovies] = useState([]);
  const [downloadedTVShows, setDownloadedTVShows] = useState([]);
  const [activeDownloads, setActiveDownloads] = useState([]);
  const [activeVideoDownloads, setActiveVideoDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDownloads();
    loadActiveDownloads();
    
    // Poll for active downloads updates
    let previousMangaCount = 0;
    let previousVideoCount = 0;
    const interval = setInterval(() => {
      const currentMangaDownloads = DownloadService.getActiveDownloads();
      const currentVideoDownloads = VideoDownloadService.getActiveDownloads();
      const currentMangaCount = currentMangaDownloads.length;
      const currentVideoCount = currentVideoDownloads.length;
      
      setActiveDownloads(currentMangaDownloads);
      setActiveVideoDownloads(currentVideoDownloads);
      
      // If a download completed (count decreased), refresh downloaded list
      if (currentMangaCount < previousMangaCount || currentVideoCount < previousVideoCount) {
        loadDownloads();
      }
      
      previousMangaCount = currentMangaCount;
      previousVideoCount = currentVideoCount;
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadDownloads();
      loadActiveDownloads();
    }, [])
  );

  const loadDownloads = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const [manga, movies, tvShows] = await Promise.all([
        DownloadService.getDownloadedManga(),
        VideoDownloadService.getDownloadedMovies(),
        VideoDownloadService.getDownloadedTVShows(),
      ]);
      setDownloadedManga(manga);
      setDownloadedMovies(movies);
      setDownloadedTVShows(tvShows);
    } catch (error) {
      console.error('Error loading downloads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadActiveDownloads = () => {
    try {
      const mangaDownloads = DownloadService.getActiveDownloads();
      const videoDownloads = VideoDownloadService.getActiveDownloads();
      setActiveDownloads(mangaDownloads);
      setActiveVideoDownloads(videoDownloads);
    } catch (error) {
      console.error('Error loading active downloads:', error);
    }
  };

  const handleMangaPress = (manga) => {
    if (navigation && manga) {
      // Navigate to a screen showing downloaded chapters
      navigation.navigate('DownloadedMangaDetails', { manga });
    }
  };

  const handleDeleteManga = (manga) => {
    Alert.alert(
      'Delete Downloads',
      `Delete all downloaded chapters for "${manga.title || 'this manga'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await DownloadService.deleteManga(manga.id);
              await loadDownloads();
              Alert.alert('Success', 'Downloads deleted successfully');
            } catch (error) {
              console.error('Error deleting downloads:', error);
              Alert.alert('Error', 'Failed to delete downloads');
            }
          },
        },
      ]
    );
  };

  const handleCancelDownload = (download) => {
    Alert.alert(
      'Cancel Download',
      `Cancel downloading "${download.chapterTitle || `Chapter ${download.chapterNumber}`}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            DownloadService.cancelDownload(download.mangaId, download.chapterNumber);
            loadActiveDownloads();
          },
        },
      ]
    );
  };

  const renderDownloadingTab = () => {
    const allActiveDownloads = [...activeDownloads, ...activeVideoDownloads];
    
    if (loading && allActiveDownloads.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    if (allActiveDownloads.length === 0) {
      return (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.emptyContainer}>
            <Ionicons name="download-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
            <Text style={styles.emptyText}>No active downloads</Text>
            <Text style={styles.emptySubtext}>
              Downloads in progress will appear here
            </Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadActiveDownloads();
              loadDownloads(true);
            }}
            tintColor="#fff"
          />
        }
      >
        <Text style={styles.sectionTitle}>Active Downloads</Text>
        {activeDownloads.map((download) => (
          <DownloadingItem
            key={`manga_${download.mangaId}_${download.chapterNumber}`}
            download={download}
            onCancel={handleCancelDownload}
          />
        ))}
        {activeVideoDownloads.map((download) => (
          <DownloadingItem
            key={`video_${download.mediaId}_${download.mediaType}_${download.season || ''}_${download.episodeNumber || ''}`}
            download={download}
            onCancel={(download) => {
              VideoDownloadService.cancelDownload(
                download.mediaId,
                download.mediaType,
                download.season,
                download.episodeNumber
              );
              loadActiveDownloads();
            }}
          />
        ))}
      </ScrollView>
    );
  };

  const renderDownloadedTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      );
    }

    const hasDownloads = downloadedManga.length > 0 || downloadedMovies.length > 0 || downloadedTVShows.length > 0;

    if (!hasDownloads) {
      return (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
            <Text style={styles.emptyText}>No downloads yet</Text>
            <Text style={styles.emptySubtext}>
              Downloaded content will appear here
            </Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDownloads(true)}
            tintColor="#fff"
          />
        }
      >
        {downloadedMovies.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Downloaded Movies</Text>
            {downloadedMovies.map((movie) => (
              <DownloadedVideoItem
                key={`movie_${movie.mediaId}`}
                video={movie}
                onPress={(movie) => {
                  // Navigate to movie details
                  if (navigation) {
                    navigation.navigate('MovieDetails', { 
                      item: {
                        id: movie.mediaId,
                        title: movie.title,
                        poster_path: movie.posterPath,
                        backdrop_path: movie.backdropPath,
                        overview: movie.overview,
                        release_date: movie.releaseDate,
                        media_type: 'movie',
                      }
                    });
                  }
                }}
                onDelete={async (movie) => {
                  Alert.alert(
                    'Delete Download',
                    `Delete "${movie.title}"?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const mediaDir = `${FileSystem.documentDirectory}video_downloads/movie_${movie.mediaId}/`;
                            const dirInfo = await FileSystem.getInfoAsync(mediaDir);
                            if (dirInfo.exists) {
                              await FileSystem.deleteAsync(mediaDir, { idempotent: true });
                            }
                            // Clean up metadata
                            const downloads = await VideoDownloadService.getAllDownloads();
                            if (downloads.movies && downloads.movies[movie.mediaId]) {
                              delete downloads.movies[movie.mediaId];
                              await AsyncStorage.setItem('@video_downloads', JSON.stringify(downloads));
                            }
                            await loadDownloads();
                            Alert.alert('Success', 'Download deleted successfully');
                          } catch (error) {
                            console.error('Error deleting download:', error);
                            Alert.alert('Error', 'Failed to delete download');
                          }
                        },
                      },
                    ]
                  );
                }}
              />
            ))}
          </>
        )}

        {downloadedTVShows.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, downloadedMovies.length > 0 && styles.sectionTitleWithMargin]}>
              Downloaded TV Shows
            </Text>
            {downloadedTVShows.map((tvShow) => (
              <View key={`tv_${tvShow.id}`} style={styles.tvShowContainer}>
                <DownloadedVideoItem
                  video={tvShow}
                  onPress={() => {
                    // Navigate to TV show details
                    console.log('TV Show pressed:', tvShow);
                  }}
                  onDelete={async (tvShow) => {
                    Alert.alert(
                      'Delete Downloads',
                      `Delete all downloaded episodes for "${tvShow.name || tvShow.title}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              const mediaDir = `${FileSystem.documentDirectory}video_downloads/tv_${tvShow.id}/`;
                              const dirInfo = await FileSystem.getInfoAsync(mediaDir);
                              if (dirInfo.exists) {
                                await FileSystem.deleteAsync(mediaDir, { idempotent: true });
                              }
                              // Clean up metadata
                              const downloads = await VideoDownloadService.getAllDownloads();
                              if (downloads.tv && downloads.tv[tvShow.id]) {
                                delete downloads.tv[tvShow.id];
                                await AsyncStorage.setItem('@video_downloads', JSON.stringify(downloads));
                              }
                              await loadDownloads();
                              Alert.alert('Success', 'Downloads deleted successfully');
                            } catch (error) {
                              console.error('Error deleting downloads:', error);
                              Alert.alert('Error', 'Failed to delete downloads');
                            }
                          },
                        },
                      ]
                    );
                  }}
                />
                {tvShow.downloadedEpisodes && tvShow.downloadedEpisodes.length > 0 && (
                  <View style={styles.episodesList}>
                    {tvShow.downloadedEpisodes.map((episode) => (
                      <DownloadedVideoItem
                        key={`episode_${episode.mediaId}_s${episode.season}_e${episode.episodeNumber}`}
                        video={episode}
                        isEpisode={true}
                        onPress={() => {
                          // Navigate to episode player
                          console.log('Episode pressed:', episode);
                        }}
                        onDelete={async (episode) => {
                          Alert.alert(
                            'Delete Episode',
                            `Delete "${episode.episodeTitle || `S${episode.season}E${episode.episodeNumber}`}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    const episodeDir = `${FileSystem.documentDirectory}video_downloads/tv_${episode.mediaId}/season_${episode.season}_episode_${episode.episodeNumber}/`;
                                    const dirInfo = await FileSystem.getInfoAsync(episodeDir);
                                    if (dirInfo.exists) {
                                      await FileSystem.deleteAsync(episodeDir, { idempotent: true });
                                    }
                                    // Clean up metadata
                                    const downloads = await VideoDownloadService.getAllDownloads();
                                    if (downloads.tv && downloads.tv[episode.mediaId] && downloads.tv[episode.mediaId].episodes) {
                                      const episodeKey = `s${episode.season}_e${episode.episodeNumber}`;
                                      delete downloads.tv[episode.mediaId].episodes[episodeKey];
                                      // If no more episodes, delete TV show entry
                                      if (Object.keys(downloads.tv[episode.mediaId].episodes).length === 0) {
                                        delete downloads.tv[episode.mediaId];
                                      }
                                      await AsyncStorage.setItem('@video_downloads', JSON.stringify(downloads));
                                    }
                                    await loadDownloads();
                                    Alert.alert('Success', 'Episode deleted successfully');
                                  } catch (error) {
                                    console.error('Error deleting episode:', error);
                                    Alert.alert('Error', 'Failed to delete episode');
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {downloadedManga.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, (downloadedMovies.length > 0 || downloadedTVShows.length > 0) && styles.sectionTitleWithMargin]}>
              Downloaded Manga
            </Text>
            {downloadedManga.map((manga) => (
              <DownloadedMangaItem
                key={manga.id}
                manga={manga}
                onPress={handleMangaPress}
                onDelete={handleDeleteManga}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Downloads</Text>
      </View>
      
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloading' && styles.tabActive]}
          onPress={() => setActiveTab('downloading')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="download-outline" 
            size={20} 
            color={activeTab === 'downloading' ? '#fff' : 'rgba(255, 255, 255, 0.6)'} 
          />
          <Text style={[styles.tabText, activeTab === 'downloading' && styles.tabTextActive]}>
            Downloading
          </Text>
          {(activeDownloads.length + activeVideoDownloads.length) > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeDownloads.length + activeVideoDownloads.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloaded' && styles.tabActive]}
          onPress={() => setActiveTab('downloaded')}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="checkmark-circle-outline" 
            size={20} 
            color={activeTab === 'downloaded' ? '#fff' : 'rgba(255, 255, 255, 0.6)'} 
          />
          <Text style={[styles.tabText, activeTab === 'downloaded' && styles.tabTextActive]}>
            Downloaded
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'downloading' ? renderDownloadingTab() : renderDownloadedTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    gap: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tabTextActive: {
    color: '#fff',
  },
  badge: {
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  sectionTitleWithMargin: {
    marginTop: 24,
  },
  tvShowContainer: {
    marginBottom: 16,
  },
  episodesList: {
    marginTop: 8,
    marginLeft: 20,
  },
});

