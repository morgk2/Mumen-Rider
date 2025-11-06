import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AllMangaService } from '../services/AllMangaService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MangaReaderScreen({ route, navigation }) {
  const { chapter } = route.params || {};
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [loadedImages, setLoadedImages] = useState({}); // Track which images have loaded
  const scrollViewRef = React.useRef(null);

  const handleImageLoad = (index) => {
    setLoadedImages(prev => ({ ...prev, [index]: true }));
  };

  useEffect(() => {
    if (chapter && chapter.url) {
      fetchChapterPages();
    }
  }, [chapter]);

  const fetchChapterPages = async () => {
    if (!chapter || !chapter.url) return;
    
    setLoading(true);
    try {
      const chapterPages = await AllMangaService.fetchChapterPages(chapter.url);
      setPages(chapterPages);
      console.log('[MangaReader] Found', chapterPages.length, 'pages');
    } catch (error) {
      console.error('[MangaReader] Error fetching chapter pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageScroll = (event) => {
    const contentOffsetY = event.nativeEvent.contentOffset.y;
    const pageHeight = SCREEN_HEIGHT;
    const page = Math.round(contentOffsetY / pageHeight);
    setCurrentPage(page);
  };

  const scrollToPage = (pageIndex) => {
    if (pageIndex >= 0 && pageIndex < pages.length && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: pageIndex * SCREEN_HEIGHT,
        animated: true,
      });
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      scrollToPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < pages.length - 1) {
      scrollToPage(currentPage + 1);
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={styles.loadingText}>Loading chapter...</Text>
        </View>
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No pages found</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchChapterPages}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden={!showControls} />
      
      {/* Controls Overlay */}
      {showControls && (
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.chapterTitle} numberOfLines={1}>
              {chapter.title || `Chapter ${chapter.number}`}
            </Text>
            <Text style={styles.pageInfo}>
              {currentPage + 1} / {pages.length}
            </Text>
          </View>
        </View>
      )}

          {/* Page ScrollView */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            pagingEnabled={true}
            showsVerticalScrollIndicator={false}
            onScroll={handlePageScroll}
            scrollEventThrottle={16}
            onTouchStart={toggleControls}
          >
            {pages.map((page, index) => (
              <View key={index} style={styles.pageContainer}>
                {!loadedImages[index] && (
                  <View style={styles.imageLoadingContainer}>
                    <ActivityIndicator size="large" color="#FF3B30" />
                    <Text style={styles.loadingText}>Loading page {index + 1}...</Text>
                  </View>
                )}
                <Image
                  source={{ uri: page.url }}
                  style={[styles.pageImage, !loadedImages[index] && styles.hiddenImage]}
                  resizeMode="contain"
                  onLoad={() => handleImageLoad(index)}
                  onError={(error) => {
                    console.error(`Error loading page ${index + 1}:`, error);
                  }}
                />
              </View>
            ))}
          </ScrollView>

      {/* Navigation Controls */}
      {showControls && (
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <TouchableOpacity
            style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
            onPress={handlePreviousPage}
            disabled={currentPage === 0}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentPage === 0 ? 'rgba(255,255,255,0.3)' : '#fff'}
            />
            <Text style={[styles.navButtonText, currentPage === 0 && styles.navButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>

          <View style={styles.pageIndicator}>
            <Text style={styles.pageIndicatorText}>
              {currentPage + 1} / {pages.length}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.navButton, currentPage === pages.length - 1 && styles.navButtonDisabled]}
            onPress={handleNextPage}
            disabled={currentPage === pages.length - 1}
            activeOpacity={0.8}
          >
            <Text style={[styles.navButtonText, currentPage === pages.length - 1 && styles.navButtonTextDisabled]}>
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={currentPage === pages.length - 1 ? 'rgba(255,255,255,0.3)' : '#fff'}
            />
          </TouchableOpacity>
        </View>
      )}
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
    flexGrow: 1,
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  pageImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  hiddenImage: {
    opacity: 0,
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  chapterTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pageInfo: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  navButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  navButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  pageIndicator: {
    alignItems: 'center',
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
