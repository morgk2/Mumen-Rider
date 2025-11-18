import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CachedImage } from '../components/CachedImage';
import { TMDBService } from '../services/TMDBService';

const PROVIDER_IDS = {
  netflix: 8,
  'disney-plus': 337,
  'prime-video': 9,
  'apple-tv': 350,
  max: 1899,
};

export default function StreamingPlatformScreen({ route, navigation }) {
  const { platformId, platformName } = route.params;
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'movies', 'tv'

  useEffect(() => {
    fetchContent();
  }, [platformId, filterType]);

  const fetchContent = async (pageNum = 1) => {
    try {
      setLoading(true);
      const providerId = PROVIDER_IDS[platformId];
      
      let results = [];
      
      if (filterType === 'all' || filterType === 'movies') {
        const movies = await TMDBService.fetchContentByProvider(providerId, 'movie', pageNum);
        results = [...results, ...movies];
      }
      
      if (filterType === 'all' || filterType === 'tv') {
        const shows = await TMDBService.fetchContentByProvider(providerId, 'tv', pageNum);
        results = [...results, ...shows];
      }
      
      if (pageNum === 1) {
        setContent(results);
      } else {
        setContent(prev => [...prev, ...results]);
      }
      
      setHasMore(results.length > 0);
      setPage(pageNum);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching platform content:', error);
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchContent(page + 1);
    }
  };

  const handleItemPress = (item) => {
    navigation.navigate('MovieDetails', { item });
  };

  const renderItem = ({ item }) => {
    const posterPath = item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.8}
      >
        {posterPath ? (
          <CachedImage
            source={{ uri: posterPath }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.poster, styles.placeholderPoster]}>
            <Ionicons name="film-outline" size={40} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title || item.name}
          </Text>
          {item.vote_average > 0 && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#ffd700" />
              <Text style={styles.rating}>{item.vote_average.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{platformName}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
        onPress={() => setFilterType('all')}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
          All
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterButton, filterType === 'movies' && styles.filterButtonActive]}
        onPress={() => setFilterType('movies')}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterButtonText, filterType === 'movies' && styles.filterButtonTextActive]}>
          Movies
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterButton, filterType === 'tv' && styles.filterButtonActive]}
        onPress={() => setFilterType('tv')}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterButtonText, filterType === 'tv' && styles.filterButtonTextActive]}>
          TV Shows
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      {renderHeader()}
      {renderFilterButtons()}
      
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <FlatList
          data={content}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && page > 1 ? (
              <ActivityIndicator size="small" color="#fff" style={styles.loadingMore} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterButtonActive: {
    backgroundColor: '#fff',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  filterButtonTextActive: {
    color: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    flex: 1,
    margin: 4,
    maxWidth: '31%',
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 8,
  },
  placeholderPoster: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    marginTop: 8,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingMore: {
    marginVertical: 20,
  },
});
