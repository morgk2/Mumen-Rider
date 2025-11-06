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
import { TMDBService } from '../services/TMDBService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EpisodeItem } from '../components/EpisodeItem';
import { CastMember } from '../components/CastMember';
import { ReviewItem } from '../components/ReviewItem';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.6;

export default function MovieDetailsScreen({ route, navigation }) {
  const { item } = route.params || {};
  const insets = useSafeAreaInsets();
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loadingLogo, setLoadingLogo] = useState(true);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [tvDetails, setTvDetails] = useState(null);
  const [cast, setCast] = useState([]);
  const [loadingCast, setLoadingCast] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item) {
      fetchLogo();
      fetchCastData();
      fetchReviewsData();
      const isTVShow = !item.title && (item.name || item.media_type === 'tv');
      if (isTVShow) {
        fetchTVDetails();
        fetchEpisodes(selectedSeason);
      }
    }
  }, [item]);

  useEffect(() => {
    if (item && (!item.title && (item.name || item.media_type === 'tv'))) {
      fetchEpisodes(selectedSeason);
    }
  }, [selectedSeason]);

  const fetchLogo = async () => {
    if (!item) return;
    
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const itemId = item.id;
      
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${itemId}/images?api_key=738b4edd0a156cc126dc4a4b8aea4aca`
      );
      const data = await response.json();
      
      const logo = data.logos?.find(logo => logo.iso_639_1 === 'en') || data.logos?.[0];
      
      if (logo) {
        const logoPath = logo.file_path;
        setLogoUrl(`https://image.tmdb.org/t/p/w500${logoPath}`);
      }
      setLoadingLogo(false);
    } catch (error) {
      console.error('Error fetching logo:', error);
      setLoadingLogo(false);
    }
  };

  const fetchTVDetails = async () => {
    if (!item || !item.id) return;
    
    try {
      const details = await TMDBService.fetchTVDetails(item.id);
      if (details) {
        setTvDetails(details);
        // Set initial season to first available season
        const availableSeasons = (details.seasons || []).filter(season => season.season_number > 0);
        if (availableSeasons.length > 0 && availableSeasons[0].season_number !== selectedSeason) {
          setSelectedSeason(availableSeasons[0].season_number);
        }
      }
    } catch (error) {
      console.error('Error fetching TV details:', error);
    }
  };

  const fetchEpisodes = async (seasonNumber) => {
    if (!item || !item.id) return;
    
    setLoadingEpisodes(true);
    try {
      const episodesData = await TMDBService.fetchTVEpisodes(item.id, seasonNumber);
      setEpisodes(episodesData);
    } catch (error) {
      console.error('Error fetching episodes:', error);
      setEpisodes([]);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleEpisodePress = (episode) => {
    if (navigation && item && episode) {
      navigation.navigate('VideoPlayer', {
        item,
        episode,
        season: selectedSeason,
        episodeNumber: episode.episode_number,
      });
    }
  };

  const fetchCastData = async () => {
    if (!item || !item.id) return;
    
    setLoadingCast(true);
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const castData = await TMDBService.fetchCast(mediaType, item.id);
      setCast(castData.slice(0, 20)); // Limit to first 20 cast members
    } catch (error) {
      console.error('Error fetching cast:', error);
      setCast([]);
    } finally {
      setLoadingCast(false);
    }
  };

  const fetchReviewsData = async () => {
    if (!item || !item.id) return;
    
    setLoadingReviews(true);
    try {
      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      const reviewsData = await TMDBService.fetchReviews(mediaType, item.id);
      setReviews(reviewsData.slice(0, 10)); // Limit to first 10 reviews
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const posterUrl = TMDBService.getPosterURL(item.poster_path, 'original');
  const backdropUrl = TMDBService.getBackdropURL(item.backdrop_path, 'original');
  const displayTitle = item.title || item.name || '';
  const overview = item.overview || '';
  const releaseDate = item.release_date || item.first_air_date || '';
  const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';
  
  const isTVShow = !item.title && (item.name || item.media_type === 'tv');
  const seasons = (tvDetails?.seasons || []).filter(season => season.season_number > 0);

  const handlePlay = () => {
    if (navigation && item) {
      navigation.navigate('VideoPlayer', { item });
    }
  };

  const handleBookmark = () => {
    console.log('Bookmark pressed:', item);
    // TODO: Add to bookmarks
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
            {backdropUrl || posterUrl ? (
              <Image
                source={{ uri: backdropUrl || posterUrl }}
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

          {/* Title Section */}
          <View style={styles.titleContainer}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.titleLogo}
                resizeMode="contain"
              />
            ) : (
              !loadingLogo && (
                <Text style={styles.title}>{displayTitle}</Text>
              )
            )}
          </View>

          {/* Date and Info Section */}
          <View style={styles.infoSection}>
            {/* Date */}
            {formattedDate && (
              <View style={styles.dateRow}>
                <Ionicons name="calendar" size={16} color="#FF3B30" style={{ marginRight: 4 }} />
                <Text style={styles.dateText}>{formattedDate}</Text>
              </View>
            )}

            {/* Synopsis */}
            {overview ? (
              <View style={styles.synopsisContainer}>
                <View style={styles.synopsisWrapper}>
                  <Text
                    style={styles.synopsis}
                    numberOfLines={showFullSynopsis ? undefined : 3}
                    ellipsizeMode="tail"
                  >
                    {overview}
                  </Text>
                  {!showFullSynopsis && (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
                      locations={[0.5, 0.85, 1]}
                      style={styles.synopsisFade}
                      pointerEvents="none"
                    />
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => setShowFullSynopsis(!showFullSynopsis)}
                  style={styles.moreButton}
                >
                  <Text style={styles.moreText}>
                    {showFullSynopsis ? 'LESS' : 'MORE'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          {/* Play and Bookmark Section */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlay}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={20} color="#000" />
              <Text style={styles.playButtonText}>Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bookmarkButton, { marginLeft: 12 }]}
              onPress={handleBookmark}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Episodes Section for TV Shows */}
          {isTVShow && (
            <View style={styles.episodesSection}>
              <View style={styles.episodesHeader}>
                <Text style={styles.episodesTitle}>Episodes</Text>
                {seasons.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.seasonSlider}
                    contentContainerStyle={styles.seasonSliderContent}
                  >
                    {seasons.map((season, index) => {
                      const seasonPosterUrl = TMDBService.getPosterURL(season.poster_path, 'w500');
                      const isSelected = selectedSeason === season.season_number;
                      return (
                        <TouchableOpacity
                          key={season.season_number}
                          style={[
                            styles.seasonCard,
                            isSelected && styles.seasonCardActive,
                            index > 0 && { marginLeft: 12 },
                          ]}
                          onPress={() => setSelectedSeason(season.season_number)}
                          activeOpacity={0.8}
                        >
                          <View style={[
                            styles.seasonPosterContainer,
                            isSelected && styles.seasonPosterContainerActive,
                          ]}>
                            {seasonPosterUrl ? (
                              <Image
                                source={{ uri: seasonPosterUrl }}
                                style={styles.seasonPoster}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={[styles.seasonPoster, styles.seasonPlaceholder]}>
                                <Text style={styles.seasonPlaceholderText}>No Image</Text>
                              </View>
                            )}
                            {isSelected && (
                              <View style={styles.seasonSelectedOverlay}>
                                <Ionicons name="checkmark-circle" size={24} color="#FF3B30" />
                              </View>
                            )}
                          </View>
                          <Text style={[styles.seasonCardText, isSelected && styles.seasonCardTextActive]}>
                            Season {season.season_number}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {loadingEpisodes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FF3B30" />
                  <Text style={styles.loadingText}>Loading episodes...</Text>
                </View>
              ) : episodes.length > 0 ? (
                <View style={styles.episodesList}>
                  {episodes.map((episode) => (
                    <EpisodeItem
                      key={episode.id}
                      episode={episode}
                      onPress={handleEpisodePress}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No episodes available</Text>
                </View>
              )}
            </View>
          )}

          {/* Cast Section */}
          <View style={styles.castSection}>
            <Text style={styles.castTitle}>Cast</Text>
            {loadingCast ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FF3B30" />
              </View>
            ) : cast.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.castSlider}
                contentContainerStyle={styles.castSliderContent}
              >
                {cast.map((castMember) => (
                  <CastMember
                    key={castMember.id}
                    castMember={castMember}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No cast information available</Text>
              </View>
            )}
          </View>

          {/* Reviews Section */}
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsTitle}>Reviews</Text>
            {loadingReviews ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FF3B30" />
                <Text style={styles.loadingText}>Loading reviews...</Text>
              </View>
            ) : reviews.length > 0 ? (
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No reviews available</Text>
              </View>
            )}
          </View>
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
  titleContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    textAlign: 'center',
  },
  titleLogo: {
    width: '70%',
    height: 120,
    maxWidth: 400,
    alignSelf: 'center',
  },
  infoSection: {
    position: 'absolute',
    bottom: -40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 12,
  },
  synopsisContainer: {
    width: '100%',
    marginTop: 8,
  },
  synopsisWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  synopsis: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  synopsisFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1,
  },
  moreButton: {
    alignSelf: 'center',
    marginTop: 4,
  },
  moreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  contentSection: {
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#000',
    position: 'relative',
    marginTop: -20,
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    justifyContent: 'center',
  },
  playButtonText: {
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
  episodesSection: {
    marginTop: 24,
  },
  episodesHeader: {
    marginBottom: 16,
  },
  episodesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  seasonSlider: {
    marginTop: 12,
    marginBottom: 4,
  },
  seasonSliderContent: {
    paddingRight: 16,
  },
  seasonCard: {
    width: 120,
    alignItems: 'center',
  },
  seasonCardActive: {
    opacity: 1,
  },
  seasonPosterContainer: {
    width: 120,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  seasonPosterContainerActive: {
    borderColor: '#FF3B30',
  },
  seasonPoster: {
    width: '100%',
    height: '100%',
  },
  seasonPlaceholder: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonPlaceholderText: {
    color: '#666',
    fontSize: 12,
  },
  seasonSelectedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  seasonCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  seasonCardTextActive: {
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  episodesList: {
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
  castSection: {
    marginTop: 32,
  },
  castTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  castSlider: {
    marginTop: 0,
  },
  castSliderContent: {
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

