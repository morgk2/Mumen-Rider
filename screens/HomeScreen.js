import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TrendingSection } from '../components/TrendingSection';
import { FeaturedContent } from '../components/FeaturedContent';
import { ContinueWatchingSection } from '../components/ContinueWatchingSection';
import { ContinueReadingSection } from '../components/ContinueReadingSection';
import { TMDBService } from '../services/TMDBService';
import { WatchProgressService } from '../services/WatchProgressService';
import { ReadProgressService } from '../services/ReadProgressService';
import { AniListService } from '../services/AniListService';

export default function HomeScreen({ navigation }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [featuredItem, setFeaturedItem] = useState(null);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingShows, setTrendingShows] = useState([]);
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingShows, setLoadingShows] = useState(true);
  const [loadingAnime, setLoadingAnime] = useState(true);
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
    
    // Set featured item from first trending movie or show (if available)
    let featured = null;
    if (movies.length > 0 && movies[0].backdrop_path) {
      featured = { ...movies[0], media_type: 'movie' };
    } else if (shows.length > 0 && shows[0].backdrop_path) {
      featured = { ...shows[0], media_type: 'tv' };
    }
    if (featured) {
      setFeaturedItem(featured);
    }
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

  const handleContinueWatchingPress = (item, progress) => {
    if (progress.season !== null && progress.episodeNumber !== null) {
      // TV show episode - need to fetch episode data
      TMDBService.fetchTVEpisodes(item.id, progress.season)
        .then(episodes => {
          const episode = episodes.find(ep => ep.episode_number === progress.episodeNumber);
          if (episode) {
            navigation.navigate('VideoPlayer', {
              item,
              episode,
              season: progress.season,
              episodeNumber: progress.episodeNumber,
              resumePosition: progress.position,
            });
          }
        })
        .catch(error => {
          console.error('Error fetching episode:', error);
        });
    } else {
      // Movie
      navigation.navigate('VideoPlayer', {
        item,
        resumePosition: progress.position,
      });
    }
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
      <Animated.ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Featured Content */}
        <FeaturedContent item={featuredItem} navigation={navigation} scrollY={scrollY} />

        {/* Continue Watching Section */}
        {continueWatchingItems.length > 0 && (
          <ContinueWatchingSection
            items={continueWatchingItems}
            onItemPress={handleContinueWatchingPress}
          />
        )}

        {/* Continue Reading Section */}
        {continueReadingItems.length > 0 && (
          <ContinueReadingSection
            items={continueReadingItems}
            onItemPress={handleContinueReadingPress}
          />
        )}

        <TrendingSection
          title="Trending Movies"
          icon=""
          items={trendingMovies}
          onItemPress={handleItemPress}
          loading={loadingMovies}
        />

        <TrendingSection
          title="Trending Shows"
          icon=""
          items={trendingShows}
          onItemPress={handleItemPress}
          loading={loadingShows}
        />

        <TrendingSection
          title="Trending Anime"
          icon=""
          items={trendingAnime}
          onItemPress={handleItemPress}
          loading={loadingAnime}
        />
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

