import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { TrendingSection } from '../components/TrendingSection';
import { FeaturedContent } from '../components/FeaturedContent';
import { TMDBService } from '../services/TMDBService';

export default function HomeScreen({ navigation }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [featuredItem, setFeaturedItem] = useState(null);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingShows, setTrendingShows] = useState([]);
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingShows, setLoadingShows] = useState(true);
  const [loadingAnime, setLoadingAnime] = useState(true);

  useEffect(() => {
    fetchTrendingContent();
  }, []);

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

  const handleItemPress = (item) => {
    navigation.navigate('MovieDetails', { item });
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

