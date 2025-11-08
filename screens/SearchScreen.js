import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TMDBService } from '../services/TMDBService';
import { AniListService } from '../services/AniListService';
import { SearchCard } from '../components/SearchCard';
import { TrendingItem } from '../components/TrendingItem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('movies'); // 'movies' or 'manga'
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingManga, setTrendingManga] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState({ movies: true, manga: true });
  const [searching, setSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    fetchTrendingMovies();
    fetchTrendingManga();
  }, []);

  useEffect(() => {
    // Reset search when tab changes
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
    setCurrentPage(1);
    setTotalPages(1);
  }, [activeTab]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setSearching(false);
      setCurrentPage(1);
      setTotalPages(1);
      return;
    }

    setSearching(true);
    setCurrentPage(1);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery, 1);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, activeTab]);

  const fetchTrendingMovies = async () => {
    setLoading(prev => ({ ...prev, movies: true }));
    try {
      const movies = await TMDBService.fetchTrendingMovies();
      setTrendingMovies(movies);
    } catch (error) {
      console.error('Error fetching trending movies:', error);
      setTrendingMovies([]);
    } finally {
      setLoading(prev => ({ ...prev, movies: false }));
    }
  };

  const fetchTrendingManga = async () => {
    setLoading(prev => ({ ...prev, manga: true }));
    try {
      const manga = await AniListService.fetchTrendingManga(1, 20);
      setTrendingManga(manga);
    } catch (error) {
      console.error('Error fetching trending manga:', error);
      setTrendingManga([]);
    } finally {
      setLoading(prev => ({ ...prev, manga: false }));
    }
  };

  const handleItemPress = (item) => {
    if (activeTab === 'manga') {
      // Navigate to manga details
      navigation.navigate('MangaDetails', { item });
    } else {
      // Navigate to movie/TV details
      const itemWithType = {
        ...item,
        media_type: item.media_type || (item.title ? 'movie' : 'tv'),
      };
      navigation.navigate('MovieDetails', { item: itemWithType });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
  };

  const performSearch = async (query, page = 1) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (page === 1) {
      setSearching(true);
    } else {
      setLoadingMore(true);
    }

    try {
      if (activeTab === 'manga') {
        // Search manga using AniList
        const response = await AniListService.searchManga(query, page, 20);
        
        if (page === 1) {
          setSearchResults(response.results);
        } else {
          setSearchResults(prev => [...prev, ...response.results]);
        }
        
        setTotalPages(response.totalPages);
        setCurrentPage(response.page);
      } else {
        // Search movies/TV shows using TMDB
        const response = await TMDBService.searchMulti(query, page);
        // Filter out people and only show movies/TV shows
        const filteredResults = response.results.filter(
          item => item.media_type === 'movie' || item.media_type === 'tv'
        );
        
        if (page === 1) {
          setSearchResults(filteredResults);
        } else {
          setSearchResults(prev => [...prev, ...filteredResults]);
        }
        
        setTotalPages(response.totalPages);
        setCurrentPage(response.page);
      }
    } catch (error) {
      console.error('Error performing search:', error);
      if (page === 1) {
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (searchQuery.trim() && currentPage < totalPages && !loadingMore) {
      performSearch(searchQuery, currentPage + 1);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'movies' && styles.tabActive]}
            onPress={() => setActiveTab('movies')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="film-outline" 
              size={18} 
              color={activeTab === 'movies' ? '#fff' : 'rgba(255, 255, 255, 0.6)'} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'movies' && styles.tabTextActive]}>
              Movies/Shows
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'manga' && styles.tabActive]}
            onPress={() => setActiveTab('manga')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="book-outline" 
              size={18} 
              color={activeTab === 'manga' ? '#fff' : 'rgba(255, 255, 255, 0.6)'} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'manga' && styles.tabTextActive]}>
              Manga
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="rgba(255, 255, 255, 0.6)" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'manga' ? "Search manga..." : "Search movies, TV shows..."}
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom;
          
          if (isCloseToBottom && !loadingMore && currentPage < totalPages && searchQuery.trim().length > 0) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {searchQuery.length === 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {activeTab === 'manga' ? 'Trending Manga' : 'Trending Movies'}
            </Text>
            {loading[activeTab] ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>
                  {activeTab === 'manga' ? 'Loading trending manga...' : 'Loading trending movies...'}
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {(activeTab === 'manga' ? trendingManga : trendingMovies).map((item) => (
                  <SearchCard
                    key={item.id}
                    item={item}
                    onPress={handleItemPress}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Search Results {searchResults.length > 0 && `(${searchResults.length})`}
            </Text>
            {searching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <>
                <View style={styles.grid}>
                  {searchResults.map((item, index) => (
                    <View
                      key={`${item.id}-${index}`}
                      style={styles.gridItem}
                    >
                      <View style={styles.gridItemWrapper}>
                        <TrendingItem
                          item={item}
                          onPress={handleItemPress}
                          variant="grid"
                        />
                      </View>
                    </View>
                  ))}
                </View>
                {loadingMore && (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.loadingMoreText}>Loading more...</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyText}>No results found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tabTextActive: {
    color: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  list: {
    marginTop: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  gridItem: {
    width: '49%',
    marginBottom: 12,
  },
  gridItemLeft: {
    marginRight: 0,
  },
  gridItemWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  loadingMoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    flexDirection: 'row',
  },
  loadingMoreText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
  },
});

