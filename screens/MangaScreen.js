import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { MangaSection } from '../components/MangaSection';
import { FeaturedManga } from '../components/FeaturedManga';
import { FeaturedMangaSkeleton } from '../components/FeaturedMangaSkeleton';
import { MangaSectionSkeleton } from '../components/MangaSectionSkeleton';
import { AniListService } from '../services/AniListService';

export default function MangaScreen({ navigation }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [featuredManga, setFeaturedManga] = useState(null);
  const [trendingManga, setTrendingManga] = useState([]);
  const [popularManga, setPopularManga] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [loadingNewReleases, setLoadingNewReleases] = useState(true);
  const [loadingTopRated, setLoadingTopRated] = useState(true);

  useEffect(() => {
    fetchMangaContent();
  }, []);

  const fetchMangaContent = async () => {
    setLoadingFeatured(true);
    // Fetch trending manga
    setLoadingTrending(true);
    const trending = await AniListService.fetchTrendingManga(1, 20);
    setTrendingManga(trending);
    setLoadingTrending(false);

    // Set featured manga from first trending manga (if available)
    if (trending.length > 0 && (trending[0].bannerImage || trending[0].coverImage)) {
      setFeaturedManga(trending[0]);
    }
    setLoadingFeatured(false);

    // Fetch popular manga
    setLoadingPopular(true);
    const popular = await AniListService.fetchPopularManga(1, 20);
    setPopularManga(popular);
    setLoadingPopular(false);

    // Fetch new releases
    setLoadingNewReleases(true);
    const newRelease = await AniListService.fetchNewReleases(1, 20);
    setNewReleases(newRelease);
    setLoadingNewReleases(false);

    // Fetch top rated
    setLoadingTopRated(true);
    const top = await AniListService.fetchTopRatedManga(1, 20);
    setTopRated(top);
    setLoadingTopRated(false);
  };

  const handleMangaPress = (manga) => {
    if (navigation && manga) {
      navigation.navigate('MangaDetails', { item: manga });
    }
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces={true}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Featured Manga */}
        {loadingFeatured ? (
          <FeaturedMangaSkeleton />
        ) : (
          <FeaturedManga item={featuredManga} navigation={navigation} scrollY={scrollY} />
        )}

        {loadingTrending ? (
          <MangaSectionSkeleton title="Trending Manga" />
        ) : (
          <MangaSection
            title="Trending Manga"
            data={trendingManga}
            loading={loadingTrending}
            onPress={handleMangaPress}
          />
        )}
        
        {loadingPopular ? (
          <MangaSectionSkeleton title="Popular Manga" />
        ) : (
          <MangaSection
            title="Popular Manga"
            data={popularManga}
            loading={loadingPopular}
            onPress={handleMangaPress}
          />
        )}
        
        {loadingNewReleases ? (
          <MangaSectionSkeleton title="New Releases" />
        ) : (
          <MangaSection
            title="New Releases"
            data={newReleases}
            loading={loadingNewReleases}
            onPress={handleMangaPress}
          />
        )}
        
        {loadingTopRated ? (
          <MangaSectionSkeleton title="Top Rated" />
        ) : (
          <MangaSection
            title="Top Rated"
            data={topRated}
            loading={loadingTopRated}
            onPress={handleMangaPress}
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
  contentContainer: {
    paddingTop: 20,
    paddingBottom: 100,
  },
});

