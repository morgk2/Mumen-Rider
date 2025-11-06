import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AniListService } from '../services/AniListService';
import { AllMangaService } from '../services/AllMangaService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChapterItem } from '../components/ChapterItem';
import { CastMember } from '../components/CastMember';
import { ReviewItem } from '../components/ReviewItem';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.6;

export default function MangaDetailsScreen({ route, navigation }) {
  const { item } = route.params || {};
  const insets = useSafeAreaInsets();
  const [mangaDetails, setMangaDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [characters, setCharacters] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [allmangaChapters, setAllmangaChapters] = useState([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [allmangaUrl, setAllmangaUrl] = useState(null);
  const [chapterOrderAscending, setChapterOrderAscending] = useState(false); // false = newest first, true = oldest first
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item && item.id) {
      fetchMangaDetails();
      fetchAllmangaChapters();
    }
  }, [item]);

  const fetchMangaDetails = async () => {
    if (!item || !item.id) return;
    
    setLoadingDetails(true);
    try {
      const details = await AniListService.fetchMangaDetails(item.id);
      if (details) {
        setMangaDetails(details);
        // Extract characters
        const chars = (details.characters?.edges || []).map(edge => ({
          id: edge.node.id,
          name: edge.node.name.full,
          character: edge.role,
          profile_path: edge.node.image.large || edge.node.image.medium,
        }));
        setCharacters(chars);

        // Extract reviews
        const mangaReviews = (details.reviews?.nodes || []).map(review => ({
          id: review.id,
          author: review.user.name,
          author_details: {
            avatar_path: review.user.avatar?.large || review.user.avatar?.medium,
          },
          content: review.summary,
          rating: review.rating,
          created_at: review.createdAt,
        }));
        setReviews(mangaReviews);
      }
    } catch (error) {
      console.error('Error fetching manga details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchAllmangaChapters = async () => {
    if (!item) return;
    
    setLoadingChapters(true);
    try {
      const mangaTitle = AniListService.getMangaTitle(item);
      const result = await AllMangaService.findMangaAndChapters(mangaTitle);
      
      if (result.url) {
        setAllmangaUrl(result.url);
        setAllmangaChapters(result.chapters || []);
      } else {
        setAllmangaChapters([]);
      }
    } catch (error) {
      console.error('Error fetching allmanga chapters:', error);
      setAllmangaChapters([]);
    } finally {
      setLoadingChapters(false);
    }
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const mangaData = mangaDetails || item;
  const bannerUrl = AniListService.getBannerImage(mangaData);
  const coverUrl = AniListService.getCoverImage(mangaData);
  const displayTitle = AniListService.getMangaTitle(mangaData);
  
  const startDate = mangaData.startDate;
  const endDate = mangaData.endDate;
  const formattedStartDate = startDate && startDate.year 
    ? `${startDate.year}${startDate.month ? `/${startDate.month}` : ''}${startDate.day ? `/${startDate.day}` : ''}`
    : '';
  const formattedEndDate = endDate && endDate.year
    ? `${endDate.year}${endDate.month ? `/${endDate.month}` : ''}${endDate.day ? `/${endDate.day}` : ''}`
    : '';
  
  const chapters = mangaData.chapters || 0;
  const volumes = mangaData.volumes || 0;
  const status = mangaData.status || '';
  const format = mangaData.format || '';
  const genres = mangaData.genres || [];
  const averageScore = mangaData.averageScore ? (mangaData.averageScore / 10).toFixed(1) : null;

  const handleRead = () => {
    // TODO: Navigate to manga reader
    console.log('Read pressed:', item);
  };

  const handleBookmark = () => {
    console.log('Bookmark pressed:', item);
    // TODO: Add to bookmarks
  };

  const handleChapterPress = (chapter) => {
    if (navigation && chapter) {
      navigation.navigate('MangaReader', { chapter });
    }
  };

  const headerTranslateY = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [150, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [2, 1],
    extrapolate: 'clamp',
  });

      // Use allmanga chapters if available, otherwise fall back to mock chapters
      const displayChapters = allmangaChapters.length > 0 ? allmangaChapters : [];
      
      // Generate mock chapters if no allmanga chapters and we have chapter count
      const mockChapters = [];
      if (displayChapters.length === 0 && chapters > 0) {
        for (let i = chapters; i >= Math.max(1, chapters - 20); i--) {
          mockChapters.push({
            id: i,
            number: i,
            title: `Chapter ${i}`,
            date: formattedStartDate,
          });
        }
      }
      
      // Sort chapters based on order preference
      let sortedChapters = displayChapters.length > 0 ? [...displayChapters] : [...mockChapters];
      if (chapterOrderAscending) {
        sortedChapters.sort((a, b) => (a.number || 0) - (b.number || 0));
      } else {
        sortedChapters.sort((a, b) => (b.number || 0) - (a.number || 0));
      }
      
      const finalChapters = sortedChapters;

  return (
    <View style={styles.container}>
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
        {/* Backdrop and Title Section */}
        <View style={styles.heroSection}>
          <Animated.View
            style={[
              styles.backdropContainer,
              {
                transform: [
                  { translateY: headerTranslateY },
                  { scale: headerScale },
                ],
              },
            ]}
          >
            {bannerUrl ? (
              <Image
                source={{ uri: bannerUrl }}
                style={styles.backdrop}
                resizeMode="cover"
              />
            ) : coverUrl ? (
              <Image
                source={{ uri: coverUrl }}
                style={styles.backdrop}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.backdrop, styles.placeholder]} />
            )}
          </Animated.View>
          
          {/* Gradient fade to black at bottom */}
          <LinearGradient
            colors={['transparent', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000', '#000']}
            locations={[0, 0.2, 0.5, 0.85, 0.95, 1]}
            style={styles.gradient}
          />
          
          {/* Info Section - Centered Layout */}
          <View style={styles.infoSection}>
            {/* Manga Poster */}
            <View style={styles.posterContainer}>
              <Image
                source={{ uri: coverUrl }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            </View>

            {/* Title Section */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{displayTitle}</Text>
            </View>

            {/* Date and Rating Row */}
            <View style={styles.infoRow}>
              {formattedStartDate && (
                <View style={styles.dateRow}>
                  <Ionicons name="calendar" size={14} color="#FF3B30" style={{ marginRight: 4 }} />
                  <Text style={styles.dateText}>{formattedStartDate}</Text>
                  {formattedEndDate && formattedEndDate !== formattedStartDate && (
                    <Text style={styles.dateText}> - {formattedEndDate}</Text>
                  )}
                </View>
              )}
              {averageScore && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#FF3B30" style={{ marginRight: 4 }} />
                  <Text style={styles.ratingText}>{averageScore}</Text>
                </View>
              )}
            </View>

            {/* Status and Format Row */}
            <View style={styles.statusRow}>
              {status && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Status</Text>
                  <Text style={styles.statusValue}>{status}</Text>
                </View>
              )}
              {format && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Format</Text>
                  <Text style={styles.statusValue}>{format}</Text>
                </View>
              )}
            </View>

            {/* Genres */}
            {genres.length > 0 && (
              <View style={styles.genresRow}>
                {genres.slice(0, 5).map((genre, index) => (
                  <View key={index} style={styles.genreTag}>
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Read and Bookmark Section */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.readButton}
              onPress={handleRead}
              activeOpacity={0.8}
            >
              <Ionicons name="book" size={20} color="#000" />
              <Text style={styles.readButtonText}>Read</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bookmarkButton, { marginLeft: 12 }]}
              onPress={handleBookmark}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Characters Section */}
          <View style={styles.charactersSection}>
            <Text style={styles.charactersTitle}>Characters</Text>
            {loadingDetails ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FF3B30" />
              </View>
            ) : characters.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.charactersSlider}
                contentContainerStyle={styles.charactersSliderContent}
              >
                {characters.map((character) => (
                  <CastMember
                    key={character.id}
                    castMember={character}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No character information available</Text>
              </View>
            )}
          </View>

          {/* Chapters Section */}
          <View style={styles.chaptersSection}>
            <View style={styles.chaptersHeader}>
              <View style={styles.chaptersTitleRow}>
                <Text style={styles.chaptersTitle}>Chapters</Text>
                    {allmangaUrl && (
                      <Text style={styles.chaptersSource}>from mangapark.net</Text>
                    )}
              </View>
              {(finalChapters.length > 0 || loadingChapters) && (
                <TouchableOpacity
                  style={styles.sortButton}
                  onPress={() => setChapterOrderAscending(!chapterOrderAscending)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={chapterOrderAscending ? "arrow-down" : "arrow-up"}
                    size={20}
                    color="#FF3B30"
                  />
                </TouchableOpacity>
              )}
            </View>

            {loadingChapters ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF3B30" />
                <Text style={styles.loadingText}>Loading chapters...</Text>
              </View>
            ) : finalChapters.length > 0 ? (
              <View style={styles.chaptersList}>
                {finalChapters.map((chapter) => (
                  <ChapterItem
                    key={chapter.id}
                    chapter={chapter}
                    onPress={handleChapterPress}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No chapters available</Text>
              </View>
            )}
          </View>

          {/* Reviews Section */}
          {reviews.length > 0 && (
            <View style={styles.reviewsSection}>
              <Text style={styles.reviewsTitle}>Reviews</Text>
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Navigation Overlay */}
      <View style={[styles.navOverlay, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#000',
  },
  heroSection: {
    width: SCREEN_WIDTH,
    height: FEATURED_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  backdropContainer: {
    width: SCREEN_WIDTH,
    height: FEATURED_HEIGHT + 150,
    position: 'absolute',
    top: -75,
    left: 0,
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
    width: SCREEN_WIDTH,
  },
  posterContainer: {
    width: 140,
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 16,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  titleContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statusItem: {
    alignItems: 'center',
    marginHorizontal: 12,
  },
  statusLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 8,
  },
  genreTag: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 16,
    marginHorizontal: 4,
    marginBottom: 4,
  },
  genreText: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
  },
  contentSection: {
    padding: 16,
    paddingTop: 24,
    backgroundColor: '#000',
    position: 'relative',
    marginTop: 0,
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    justifyContent: 'center',
  },
  readButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 6,
  },
  bookmarkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginTop: 8,
  },
      chaptersSection: {
        marginTop: 24,
      },
      chaptersHeader: {
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      chaptersTitleRow: {
        flex: 1,
      },
      chaptersTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
      },
      chaptersSource: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        marginTop: 4,
      },
      sortButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 59, 48, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FF3B30',
      },
  chaptersList: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  charactersSection: {
    marginTop: 32,
  },
  charactersTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  charactersSlider: {
    marginTop: 0,
  },
  charactersSliderContent: {
    paddingRight: 16,
  },
  reviewsSection: {
    marginTop: 32,
  },
  reviewsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  reviewsList: {
    marginTop: 0,
  },
});

