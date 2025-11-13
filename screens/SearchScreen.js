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
  Modal,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedItem, setSuggestedItem] = useState(null);

  // Movie genres with TMDB genre IDs
  const movieGenres = [
    { id: 28, name: 'Action' },
    { id: 12, name: 'Adventure' },
    { id: 16, name: 'Animation' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
    { id: 99, name: 'Documentary' },
    { id: 18, name: 'Drama' },
    { id: 10751, name: 'Family' },
    { id: 14, name: 'Fantasy' },
    { id: 36, name: 'History' },
    { id: 27, name: 'Horror' },
    { id: 10402, name: 'Music' },
    { id: 9648, name: 'Mystery' },
    { id: 10749, name: 'Romance' },
    { id: 878, name: 'Science Fiction' },
    { id: 10770, name: 'TV Movie' },
    { id: 53, name: 'Thriller' },
    { id: 10752, name: 'War' },
    { id: 37, name: 'Western' },
  ];

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

  const handleSuggest = async () => {
    if (!selectedGenre) {
      // If no genre selected, pick a random one
      const randomGenre = movieGenres[Math.floor(Math.random() * movieGenres.length)];
      setSelectedGenre(randomGenre.id);
      await fetchAndShowSuggestion(randomGenre.id);
    } else {
      await fetchAndShowSuggestion(selectedGenre);
    }
  };

  const fetchAndShowSuggestion = async (genreId) => {
    setSuggesting(true);
    try {
      // Fetch top rated movies and TV shows (up to 400 each)
      const [topRatedMovies, topRatedTV] = await Promise.all([
        TMDBService.fetchTopRatedMovies(400),
        TMDBService.fetchTopRatedTV(400)
      ]);
      
      // Filter movies by genre
      const genreMovies = topRatedMovies
        .filter(movie => movie.genre_ids && movie.genre_ids.includes(genreId))
        .map(movie => ({ ...movie, media_type: 'movie' }));

      // Filter TV shows by genre
      const genreTV = topRatedTV
        .filter(show => show.genre_ids && show.genre_ids.includes(genreId))
        .map(show => ({ ...show, media_type: 'tv' }));

      // Combine movies and TV shows
      const suggestions = [...genreMovies, ...genreTV];

      if (suggestions.length > 0) {
        // Pick a random suggestion
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        
        // Show the suggestion in the modal
        setSuggestedItem(randomSuggestion);
      } else {
        // No results found for this genre
        Alert.alert('No Results', 'No top-rated content found for this genre. Try another genre!');
      }
    } catch (error) {
      console.error('Error fetching suggestion:', error);
      Alert.alert('Error', 'Failed to fetch suggestion. Please try again.');
    } finally {
      setSuggesting(false);
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
            {/* Suggest a Movie/Show Section - Apple Intelligence Style */}
            {activeTab === 'movies' && (
              <View style={styles.suggestSection}>
                <LinearGradient
                  colors={['#5E5CE6', '#7D7AFF', '#AF52DE', '#FF2D55', '#FF9500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.3, 0.5, 0.7, 1]}
                  style={styles.suggestGradient}
                >
                  <LinearGradient
                    colors={['rgba(94, 92, 230, 0.95)', 'rgba(125, 122, 255, 0.92)', 'rgba(175, 82, 222, 0.95)', 'rgba(255, 45, 85, 0.92)', 'rgba(255, 149, 0, 0.9)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.5, 0.7, 1]}
                    style={styles.suggestInnerGradient}
                  >
                    {/* Animated glow effect layers */}
                    <View style={styles.suggestGlowLayer1} />
                    <View style={styles.suggestGlowLayer2} />
                    
                    <View style={styles.suggestContent}>
                      <View style={styles.suggestIconContainer}>
                        <LinearGradient
                          colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.25)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.suggestIconGradient}
                        >
                          <Ionicons name="sparkles" size={40} color="#fff" />
                        </LinearGradient>
                      </View>
                      <View style={styles.suggestTextContainer}>
                        <Text style={styles.suggestTitle}>Suggest a Movie/Show</Text>
                        <TouchableOpacity
                          style={styles.suggestButton}
                          activeOpacity={0.8}
                        onPress={() => {
                          setShowSuggestionModal(true);
                        }}
                        >
                          <LinearGradient
                            colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.15)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.suggestButtonGradient}
                          >
                            <Ionicons name="arrow-forward" size={16} color="#fff" style={styles.suggestButtonIcon} />
                            <Text style={styles.suggestButtonText}>Suggest</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </LinearGradient>
                </LinearGradient>
              </View>
            )}

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

      {/* Suggestion Modal */}
      <Modal
        visible={showSuggestionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSuggestionModal(false);
          setSelectedGenre(null);
          setSuggestedItem(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowSuggestionModal(false);
            setSelectedGenre(null);
            setSuggestedItem(null);
          }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {!suggestedItem ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>What we feeling tonight?</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowSuggestionModal(false);
                      setSelectedGenre(null);
                      setSuggestedItem(null);
                    }}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.genreScrollContent}
                  style={styles.genreScroll}
                >
                  {movieGenres.map((genre) => (
                    <TouchableOpacity
                      key={genre.id}
                      onPress={() => setSelectedGenre(genre.id)}
                      style={[
                        styles.genreChip,
                        selectedGenre === genre.id && styles.genreChipSelected,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.genreChipText,
                          selectedGenre === genre.id && styles.genreChipTextSelected,
                        ]}
                      >
                        {genre.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => {
                      const randomGenre = movieGenres[Math.floor(Math.random() * movieGenres.length)];
                      setSelectedGenre(randomGenre.id);
                    }}
                    style={styles.randomChip}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="shuffle" size={18} color="#fff" style={styles.randomChipIcon} />
                    <Text style={styles.randomChipText}>Random Choice</Text>
                  </TouchableOpacity>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.suggestButton}
                    onPress={handleSuggest}
                    activeOpacity={0.8}
                    disabled={suggesting}
                  >
                    <LinearGradient
                      colors={['#5E5CE6', '#7D7AFF', '#AF52DE']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalSuggestButtonGradient}
                    >
                      {suggesting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalSuggestButtonText}>Suggest</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Your Suggestion</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowSuggestionModal(false);
                      setSelectedGenre(null);
                      setSuggestedItem(null);
                    }}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  style={styles.suggestionScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.suggestionContent}>
                    {suggestedItem.poster_path || suggestedItem.backdrop_path ? (
                      <Image
                        source={{ uri: TMDBService.getPosterURL(suggestedItem.poster_path) || TMDBService.getBackdropURL(suggestedItem.backdrop_path) }}
                        style={styles.suggestionPoster}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.suggestionPoster, styles.suggestionPlaceholder]}>
                        <Ionicons name="film-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
                      </View>
                    )}
                    
                    <Text style={styles.suggestionTitle}>
                      {suggestedItem.title || suggestedItem.name}
                    </Text>
                    
                    {suggestedItem.vote_average > 0 && (
                      <View style={styles.suggestionRating}>
                        <Ionicons name="star" size={16} color="#FFD700" />
                        <Text style={styles.suggestionRatingText}>
                          {suggestedItem.vote_average.toFixed(1)}
                        </Text>
                      </View>
                    )}

                    {suggestedItem.release_date || suggestedItem.first_air_date ? (
                      <Text style={styles.suggestionDate}>
                        {suggestedItem.release_date 
                          ? new Date(suggestedItem.release_date).getFullYear()
                          : new Date(suggestedItem.first_air_date).getFullYear()}
                      </Text>
                    ) : null}

                    {suggestedItem.overview ? (
                      <Text style={styles.suggestionOverview} numberOfLines={6}>
                        {suggestedItem.overview}
                      </Text>
                    ) : null}
                  </View>
                </ScrollView>

                <View style={styles.suggestionActions}>
                  <TouchableOpacity
                    style={styles.suggestionActionButton}
                    onPress={() => {
                      setShowSuggestionModal(false);
                      setSelectedGenre(null);
                      setSuggestedItem(null);
                      navigation.navigate('MovieDetails', { item: suggestedItem });
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#5E5CE6', '#7D7AFF', '#AF52DE']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.suggestionActionButtonGradient}
                    >
                      <Ionicons name="information-circle" size={20} color="#fff" style={styles.suggestionActionIcon} />
                      <Text style={styles.suggestionActionText}>Go to Details</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.suggestionActionButton, styles.suggestionActionButtonSecondary]}
                    onPress={async () => {
                      if (selectedGenre) {
                        await fetchAndShowSuggestion(selectedGenre);
                      } else {
                        const randomGenre = movieGenres[Math.floor(Math.random() * movieGenres.length)];
                        await fetchAndShowSuggestion(randomGenre.id);
                      }
                    }}
                    activeOpacity={0.8}
                    disabled={suggesting}
                  >
                    <View style={styles.suggestionActionButtonSecondaryGradient}>
                      {suggesting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={20} color="#fff" style={styles.suggestionActionIcon} />
                          <Text style={styles.suggestionActionText}>Suggest Another</Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.suggestionActionButton, styles.suggestionActionButtonTertiary]}
                    onPress={() => {
                      setSuggestedItem(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.suggestionActionButtonTertiaryGradient}>
                      <Ionicons name="arrow-back" size={20} color="#fff" style={styles.suggestionActionIcon} />
                      <Text style={styles.suggestionActionText}>Back</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
  suggestSection: {
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#AF52DE',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    height: 120,
  },
  suggestGradient: {
    borderRadius: 15,
    padding: 3,
    height: '100%',
    width: '100%',
  },
  suggestInnerGradient: {
    borderRadius: 12,
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
    height: '100%',
  },
  suggestGlowLayer1: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.6,
  },
  suggestGlowLayer2: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    opacity: 0.5,
  },
  suggestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
    position: 'relative',
    height: '100%',
    padding: 12,
  },
  suggestIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  suggestIconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  suggestTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  suggestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'left',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  suggestSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'left',
    marginBottom: 8,
    lineHeight: 18,
    fontWeight: '500',
  },
  suggestButton: {
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  suggestButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  suggestButtonIcon: {
    marginRight: 10,
  },
  suggestButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    paddingHorizontal: 16,
  },
  gridItem: {
    width: '47%', // 47% ensures 2 items per row with space between
    marginBottom: 20,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
    marginLeft: 12,
  },
  genreScroll: {
    marginBottom: 24,
  },
  genreScrollContent: {
    paddingRight: 8,
  },
  genreChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  genreChipSelected: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderColor: 'rgba(255, 59, 48, 1)',
  },
  genreChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  genreChipTextSelected: {
    color: '#fff',
  },
  randomChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(94, 92, 230, 0.3)',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(94, 92, 230, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  randomChipIcon: {
    marginRight: 6,
  },
  randomChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalActions: {
    alignItems: 'center',
  },
  suggestButton: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#AF52DE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  modalSuggestButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  modalSuggestButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  // Suggestion view styles
  suggestionScroll: {
    maxHeight: 400,
    marginBottom: 16,
  },
  suggestionContent: {
    alignItems: 'center',
  },
  suggestionPoster: {
    width: 200,
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
  },
  suggestionPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  suggestionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  suggestionRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionRatingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  suggestionDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
  },
  suggestionOverview: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  suggestionActions: {
    gap: 12,
  },
  suggestionActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#AF52DE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  suggestionActionButtonSecondary: {
    shadowColor: '#5E5CE6',
  },
  suggestionActionButtonTertiary: {
    shadowColor: '#666',
  },
  suggestionActionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  suggestionActionButtonSecondaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(94, 92, 230, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(94, 92, 230, 1)',
  },
  suggestionActionButtonTertiaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  suggestionActionIcon: {
    marginRight: 8,
  },
  suggestionActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
});

