import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CachedImage } from '../components/CachedImage';
import { TrendingItem } from '../components/TrendingItem';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { fetchListDetails } from '../services/LetterboxdListsService';
import { TMDBService } from '../services/TMDBService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.5;

export default function CollectionDetailScreen({ route, navigation }) {
  const { list } = route.params || {};
  const insets = useSafeAreaInsets();
  const [listDetails, setListDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [films, setFilms] = useState([]);
  const [loadingFilms, setLoadingFilms] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (list && list.url) {
      fetchCollectionDetails();
    }
  }, [list]);

  const fetchCollectionDetails = async () => {
    try {
      setLoading(true);
      const details = await fetchListDetails(list.url);
      setListDetails(details);
      
      // Match films with TMDB
      if (details.films && details.films.length > 0) {
        setLoadingFilms(true);
        await matchFilmsWithTMDB(details.films);
        setLoadingFilms(false);
      }
    } catch (error) {
      console.error('Error fetching collection details:', error);
    } finally {
      setLoading(false);
    }
  };

  const matchFilmsWithTMDB = async (letterboxdFilms) => {
    try {
      const matchedFilms = await Promise.all(
        letterboxdFilms.map(async (film) => {
          try {
            // Search TMDB for the film
            const searchQuery = `${film.title}${film.year ? ` ${film.year}` : ''}`;
            const response = await fetch(
              `https://api.themoviedb.org/3/search/multi?api_key=738b4edd0a156cc126dc4a4b8aea4aca&query=${encodeURIComponent(searchQuery)}&page=1`
            );
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
              // Find best match (prefer movies, match by year if available)
              let bestMatch = data.results[0];
              
              if (film.year) {
                const yearMatch = data.results.find(
                  (result) =>
                    (result.release_date || result.first_air_date || '').substring(0, 4) === film.year.toString()
                );
                if (yearMatch) {
                  bestMatch = yearMatch;
                }
              }
              
              return {
                ...bestMatch,
                letterboxdTitle: film.title,
                letterboxdYear: film.year,
              };
            }
            
            return null;
          } catch (error) {
            console.error('Error matching film:', error);
            return null;
          }
        })
      );
      
      // Filter out null results
      const validFilms = matchedFilms.filter(film => film !== null);
      setFilms(validFilms);
    } catch (error) {
      console.error('Error matching films with TMDB:', error);
      setFilms([]);
    }
  };

  const handleItemPress = (item) => {
    navigation.navigate('MovieDetails', { item });
  };

  const headerTranslateY = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [150, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [1.3, 0.75],
    extrapolate: 'clamp',
  });

  const containerHeight = FEATURED_HEIGHT + 150;
  const headerScaleCompensation = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [
      -(containerHeight * (1.3 - 0.75)) / 2,
      0
    ],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Skeleton for backdrop */}
          <View style={styles.heroSkeleton}>
            <SkeletonLoader width={SCREEN_WIDTH} height={FEATURED_HEIGHT} />
          </View>
          
          {/* Skeleton for content */}
          <View style={styles.contentSkeleton}>
            <SkeletonLoader width={200} height={32} borderRadius={4} style={{ marginBottom: 16 }} />
            <SkeletonLoader width="100%" height={100} borderRadius={8} style={{ marginBottom: 16 }} />
            <SkeletonLoader width={150} height={24} borderRadius={4} style={{ marginBottom: 12 }} />
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[...Array(5)].map((_, i) => (
                <View key={i} style={{ marginRight: 12 }}>
                  <SkeletonLoader width={120} height={180} borderRadius={8} />
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    );
  }

  const displayTitle = listDetails?.title || list?.title || 'Collection';
  const description = listDetails?.description || list?.description || '';
  const backdropUrl = listDetails?.backdropUrl || list?.backdropUrl || null;

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <View style={[styles.header, { top: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Backdrop Section */}
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.backdropContainer,
              {
                transform: [
                  { translateY: Animated.add(headerTranslateY, headerScaleCompensation) },
                  { scale: headerScale },
                ],
              },
            ]}
          >
            {backdropUrl ? (
              <CachedImage
                source={{ uri: backdropUrl }}
                style={styles.backdrop}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.backdrop, styles.placeholder]} />
            )}
          </Animated.View>
          
          {/* Gradient fade */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000', '#000']}
            locations={[0, 0.2, 0.5, 0.85, 0.95, 1]}
            style={styles.gradient}
          />

          {/* Title Section */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{displayTitle}</Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Description */}
          {description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.description}>{description}</Text>
            </View>
          )}

          {/* Films Section */}
          <View style={styles.filmsSection}>
            <Text style={styles.filmsTitle}>
              Films ({films.length})
            </Text>
            
            {loadingFilms ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Matching films...</Text>
              </View>
            ) : films.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filmsScroll}
                contentContainerStyle={styles.filmsScrollContent}
              >
                {films.map((film) => (
                  <TrendingItem
                    key={film.id}
                    item={film}
                    onPress={handleItemPress}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No films found</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    left: 20,
    zIndex: 100,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    backgroundColor: '#000',
  },
  heroSection: {
    width: SCREEN_WIDTH,
    height: FEATURED_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  backdropContainer: {
    width: SCREEN_WIDTH * 1.33,
    height: FEATURED_HEIGHT + 150,
    position: 'absolute',
    top: -75,
    left: -SCREEN_WIDTH * 0.165,
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#1a1a1a',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FEATURED_HEIGHT,
    zIndex: 1,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    zIndex: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  contentSection: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#000',
    marginTop: -20,
  },
  descriptionSection: {
    marginBottom: 32,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 24,
  },
  filmsSection: {
    marginTop: 8,
  },
  filmsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  filmsScroll: {
    marginHorizontal: -20,
  },
  filmsScrollContent: {
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
  heroSkeleton: {
    width: SCREEN_WIDTH,
    height: FEATURED_HEIGHT,
  },
  contentSkeleton: {
    padding: 20,
    paddingTop: 40,
  },
});

