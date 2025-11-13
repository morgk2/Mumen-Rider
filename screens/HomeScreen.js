import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingSection } from '../components/TrendingSection';
import { FeaturedContent } from '../components/FeaturedContent';
import { FeaturedContentSkeleton } from '../components/FeaturedContentSkeleton';
import { ContinueWatchingSection } from '../components/ContinueWatchingSection';
import { ContinueReadingSection } from '../components/ContinueReadingSection';
import { TrendingSectionSkeleton } from '../components/TrendingSectionSkeleton';
import { TMDBService } from '../services/TMDBService';
import { WatchProgressService } from '../services/WatchProgressService';
import { ReadProgressService } from '../services/ReadProgressService';
import { AniListService } from '../services/AniListService';
import { StorageService } from '../services/StorageService';
import { openInExternalPlayer } from '../services/ExternalPlayerService';
import { VixsrcService } from '../services/VixsrcService';
import { N3tflixService } from '../services/N3tflixService';
import { Alert } from 'react-native';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [featuredItems, setFeaturedItems] = useState([]);
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState(0);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingShows, setTrendingShows] = useState([]);
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingShows, setLoadingShows] = useState(true);
  const [loadingAnime, setLoadingAnime] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [continueWatchingItems, setContinueWatchingItems] = useState([]);
  const [loadingContinueWatching, setLoadingContinueWatching] = useState(false);
  const [continueReadingItems, setContinueReadingItems] = useState([]);
  const [loadingContinueReading, setLoadingContinueReading] = useState(false);

  useEffect(() => {
    fetchTrendingContent();
  }, []);

  useEffect(() => {
    fetchContinueWatching();
    fetchContinueReading();
  }, []);

  // Reload continue watching and reading when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchContinueWatching();
      fetchContinueReading();
    }, [])
  );

  const fetchTrendingContent = async () => {
    setLoadingFeatured(true);
    // Fetch trending movies
    setLoadingMovies(true);
    const movies = await TMDBService.fetchTrendingMovies();
    setTrendingMovies(movies);
    setLoadingMovies(false);
    
    // Fetch trending TV shows
    setLoadingShows(true);
    const shows = await TMDBService.fetchTrendingTV();
    setTrendingShows(shows);
    setLoadingShows(false);
    
    // Fetch trending anime
    setLoadingAnime(true);
    const anime = await TMDBService.fetchTrendingAnime();
    setTrendingAnime(anime);
    setLoadingAnime(false);
    
    // Create featured items list from trending movies and shows with backdrops
    const featured = [];
    
    // Add movies with backdrops (up to 5)
    movies.slice(0, 5).forEach(movie => {
      if (movie.backdrop_path) {
        featured.push({ ...movie, media_type: 'movie' });
      }
    });
    
    // Add shows with backdrops (up to 5)
    shows.slice(0, 5).forEach(show => {
      if (show.backdrop_path) {
        featured.push({ ...show, media_type: 'tv' });
      }
    });
    
    if (featured.length > 0) {
      setFeaturedItems(featured);
      setCurrentFeaturedIndex(0);
    }
    setLoadingFeatured(false);
  };

  const fetchContinueWatching = async () => {
    try {
      setLoadingContinueWatching(true);
      const progressItems = await WatchProgressService.getContinueWatchingItems();
      
      if (progressItems.length === 0) {
        setContinueWatchingItems([]);
        setLoadingContinueWatching(false);
        return;
      }

      // Fetch full media details for each progress item
      const itemsWithDetails = await Promise.all(
        progressItems.map(async (progress) => {
          try {
            const mediaType = progress.mediaType;
            let mediaDetails = null;

            if (mediaType === 'movie') {
              // Fetch movie details
              const response = await fetch(
                `https://api.themoviedb.org/3/movie/${progress.itemId}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
              );
              const data = await response.json();
              mediaDetails = data;
            } else if (mediaType === 'tv') {
              // Fetch TV show details
              const response = await fetch(
                `https://api.themoviedb.org/3/tv/${progress.itemId}?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
              );
              const data = await response.json();
              mediaDetails = data;
            }

            return {
              item: mediaDetails,
              progress: progress,
            };
          } catch (error) {
            console.error('Error fetching media details:', error);
            return null;
          }
        })
      );

      // Filter out null items and limit to 10
      const validItems = itemsWithDetails.filter(item => item !== null && item.item).slice(0, 10);
      setContinueWatchingItems(validItems);
    } catch (error) {
      console.error('Error fetching continue watching:', error);
      setContinueWatchingItems([]);
    } finally {
      setLoadingContinueWatching(false);
    }
  };

  const handleItemPress = (item) => {
    navigation.navigate('MovieDetails', { item });
  };

  const fetchContinueReading = async () => {
    try {
      setLoadingContinueReading(true);
      const progressItems = await ReadProgressService.getContinueReadingItems();
      
      if (progressItems.length === 0) {
        setContinueReadingItems([]);
        setLoadingContinueReading(false);
        return;
      }

      // Fetch full manga details for each progress item
      const itemsWithDetails = await Promise.all(
        progressItems.map(async (progress) => {
          try {
            // Fetch manga details from AniList
            const mangaDetails = await AniListService.fetchMangaDetails(progress.mangaId);
            
            if (mangaDetails) {
              return {
                item: mangaDetails,
                progress: progress,
              };
            }
            return null;
          } catch (error) {
            console.error('Error fetching manga details:', error);
            return null;
          }
        })
      );

      // Filter out null items and limit to 10
      const validItems = itemsWithDetails.filter(item => item !== null && item.item).slice(0, 10);
      setContinueReadingItems(validItems);
    } catch (error) {
      console.error('Error fetching continue reading:', error);
      setContinueReadingItems([]);
    } finally {
      setLoadingContinueReading(false);
    }
  };

  const handleContinueWatchingPress = async (item, progress) => {
    try {
      const externalPlayer = await StorageService.getExternalPlayer();
      
      if (progress.season !== null && progress.episodeNumber !== null) {
        // TV show episode - need to fetch episode data
        try {
          const episodes = await TMDBService.fetchTVEpisodes(item.id, progress.season);
          const episode = episodes.find(ep => ep.episode_number === progress.episodeNumber);
          if (episode) {
            await playVideo(item, episode, progress.season, progress.episodeNumber, progress.position, externalPlayer);
          }
        } catch (error) {
          console.error('Error fetching episode:', error);
        }
      } else {
        // Movie
        await playVideo(item, null, null, null, progress.position, externalPlayer);
      }
    } catch (error) {
      console.error('Error in handleContinueWatchingPress:', error);
    }
  };

  const handleContinueWatchingDelete = async (item, progress) => {
    try {
      await WatchProgressService.removeProgress(
        item.id,
        progress.mediaType,
        progress.season,
        progress.episodeNumber
      );
      // Refresh the continue watching list
      fetchContinueWatching();
    } catch (error) {
      console.error('Error deleting continue watching item:', error);
    }
  };

  const handleContinueWatchingViewDetails = (item) => {
    navigation.navigate('MovieDetails', { item });
  };

  const playVideo = async (item, episode, season, episodeNumber, resumePosition, externalPlayer) => {
    // If external player is selected and not Default, fetch stream URL and open in external player
    if (externalPlayer && externalPlayer !== 'Default') {
      try {
        const source = await StorageService.getVideoSource();
        const service = source === 'n3tflix' ? N3tflixService : VixsrcService;
        
        let result = null;
        if (episode && season && episodeNumber) {
          result = await service.fetchEpisodeWithSubtitles(item.id, season, episodeNumber);
        } else {
          result = await service.fetchMovieWithSubtitles(item.id);
        }
        
        if (result && result.streamUrl) {
          // Try to open in external player
          const opened = await openInExternalPlayer(result.streamUrl, externalPlayer);
          
          // If failed to open external player, fall back to default player
          if (!opened) {
            if (episode) {
              navigation.navigate('VideoPlayer', {
                item,
                episode,
                season,
                episodeNumber,
                resumePosition,
              });
            } else {
              navigation.navigate('VideoPlayer', {
                item,
                resumePosition,
              });
            }
          }
        } else {
          Alert.alert('Error', 'Failed to fetch stream URL. Using default player.');
          if (episode) {
            navigation.navigate('VideoPlayer', {
              item,
              episode,
              season,
              episodeNumber,
              resumePosition,
            });
          } else {
            navigation.navigate('VideoPlayer', {
              item,
              resumePosition,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching stream for external player:', error);
        Alert.alert('Error', 'Failed to open external player. Using default player.');
        if (episode) {
          navigation.navigate('VideoPlayer', {
            item,
            episode,
            season,
            episodeNumber,
            resumePosition,
          });
        } else {
          navigation.navigate('VideoPlayer', {
            item,
            resumePosition,
          });
        }
      }
    } else {
      // Use default player
      if (episode) {
        navigation.navigate('VideoPlayer', {
          item,
          episode,
          season,
          episodeNumber,
          resumePosition,
        });
      } else {
        navigation.navigate('VideoPlayer', {
          item,
          resumePosition,
        });
      }
    }
  };

  const handleContinueReadingDelete = async (item, progress) => {
    try {
      await ReadProgressService.removeProgress(
        item.id,
        progress.chapterNumber
      );
      // Refresh the continue reading list
      fetchContinueReading();
    } catch (error) {
      console.error('Error deleting continue reading item:', error);
    }
  };

  const handleContinueReadingViewDetails = (item) => {
    navigation.navigate('MangaDetails', { item });
  };


  const handleContinueReadingPress = async (item, progress) => {
    if (!navigation || !item || !progress) return;
    
    // Navigate directly to the chapter with progress
    if (progress.chapterUrl && progress.chapterNumber !== undefined) {
      const chapter = {
        url: progress.chapterUrl,
        number: progress.chapterNumber,
        title: progress.chapterTitle || `Chapter ${progress.chapterNumber}`,
      };
      
      navigation.navigate('MangaReader', {
        chapter,
        manga: item,
        resumePage: progress.currentPage,
        allChapters: [], // Will be fetched by reader if needed
      });
    } else {
      // Fallback: navigate to manga details
      navigation.navigate('MangaDetails', { item });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />
      <Animated.ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Featured Content - Extends to top edge */}
        <View style={{ marginTop: -insets.top }}>
          {loadingFeatured || featuredItems.length === 0 ? (
            <FeaturedContentSkeleton />
          ) : (
            <FeaturedContent 
              item={featuredItems[currentFeaturedIndex]} 
              navigation={navigation} 
              scrollY={scrollY}
              currentIndex={currentFeaturedIndex}
              totalItems={featuredItems.length}
              featuredItems={featuredItems}
              onNext={() => {
                setCurrentFeaturedIndex((prev) => (prev + 1) % featuredItems.length);
              }}
              onPrevious={() => {
                setCurrentFeaturedIndex((prev) => (prev === 0 ? featuredItems.length - 1 : prev - 1));
              }}
            />
          )}
        </View>

        {/* Continue Watching Section */}
        {continueWatchingItems.length > 0 && (
          <ContinueWatchingSection
            items={continueWatchingItems}
            onItemPress={handleContinueWatchingPress}
            onDelete={handleContinueWatchingDelete}
            onViewDetails={handleContinueWatchingViewDetails}
            navigation={navigation}
          />
        )}

        {/* Continue Reading Section */}
        {continueReadingItems.length > 0 && (
          <ContinueReadingSection
            items={continueReadingItems}
            onItemPress={handleContinueReadingPress}
            onDelete={handleContinueReadingDelete}
            onViewDetails={handleContinueReadingViewDetails}
            navigation={navigation}
          />
        )}

        {loadingMovies ? (
          <TrendingSectionSkeleton title="Trending Movies" />
        ) : (
          <TrendingSection
            title="Trending Movies"
            icon=""
            items={trendingMovies}
            onItemPress={handleItemPress}
            loading={loadingMovies}
          />
        )}

        {loadingShows ? (
          <TrendingSectionSkeleton title="Trending Shows" />
        ) : (
          <TrendingSection
            title="Trending Shows"
            icon=""
            items={trendingShows}
            onItemPress={handleItemPress}
            loading={loadingShows}
          />
        )}

        {loadingAnime ? (
          <TrendingSectionSkeleton title="Trending Anime" />
        ) : (
          <TrendingSection
            title="Trending Anime"
            icon=""
            items={trendingAnime}
            onItemPress={handleItemPress}
            loading={loadingAnime}
          />
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
});

