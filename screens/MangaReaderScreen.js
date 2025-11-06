import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Modal,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';
import { AllMangaService } from '../services/AllMangaService';
import { ReadProgressService } from '../services/ReadProgressService';
import { StorageService } from '../services/StorageService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTROLS_AUTO_HIDE_DELAY = 4000; // 4 seconds

export default function MangaReaderScreen({ route, navigation }) {
  const { chapter, manga, resumePage, pages: offlinePages, isOffline, allChapters } = route.params || {};
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(resumePage || 0);
  const [showControls, setShowControls] = useState(true);
  const [loadedImages, setLoadedImages] = useState({});
  const [chapters, setChapters] = useState(allChapters || []);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [readingMode, setReadingMode] = useState('LTR'); // UTD, LTR, RTL
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = React.useRef(null);
  const progressSaveIntervalRef = React.useRef(null);
  const currentPageRef = React.useRef(resumePage || 0);
  const controlsHideTimerRef = React.useRef(null);
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const footerOpacity = useRef(new Animated.Value(1)).current;
  const pinchRef = useRef(null);
  const baseScale = useRef(1);
  const lastScale = useRef(new Animated.Value(1));
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const lastTapRef = useRef(null);

  // Load reading mode preference
  useEffect(() => {
    const loadReadingMode = async () => {
      const mode = await StorageService.getReadingMode();
      setReadingMode(mode);
    };
    loadReadingMode();
  }, []);

  // Update scroll position when reading mode changes
  useEffect(() => {
    if (pages.length > 0 && scrollViewRef.current) {
      const currentPageIndex = currentPageRef.current;
      setTimeout(() => {
        if (scrollViewRef.current) {
          if (readingMode === 'UTD') {
            scrollViewRef.current.scrollTo({
              y: currentPageIndex * SCREEN_HEIGHT,
              animated: false,
            });
          } else {
            scrollViewRef.current.scrollTo({
              x: currentPageIndex * SCREEN_WIDTH,
              animated: false,
            });
          }
        }
      }, 100);
    }
  }, [readingMode, pages.length]);

  // Find current chapter index
  useEffect(() => {
    if (chapter && chapters.length > 0) {
      const index = chapters.findIndex(ch => 
        ch.number === chapter.number || ch.url === chapter.url
      );
      if (index !== -1) {
        setCurrentChapterIndex(index);
      }
    }
  }, [chapter, chapters]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      // Clear existing timer
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
      }
      
      // Set new timer
      controlsHideTimerRef.current = setTimeout(() => {
        hideControls();
      }, CONTROLS_AUTO_HIDE_DELAY);
    }

    return () => {
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
      }
    };
  }, [showControls, currentPage]);

  const showControlsWithAnimation = () => {
    setShowControls(true);
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideControls = () => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowControls(false);
    });
  };

  const toggleControls = () => {
    if (showControls) {
      hideControls();
    } else {
      showControlsWithAnimation();
    }
  };

  const handleImageLoad = (index) => {
    setLoadedImages(prev => ({ ...prev, [index]: true }));
  };

  // Save read progress
  const saveReadProgress = React.useCallback(async () => {
    if (!manga || !manga.id || !chapter || chapter.number === undefined || pages.length === 0) return;
    
    try {
      await ReadProgressService.saveProgress(
        manga.id,
        chapter.number,
        currentPageRef.current,
        pages.length,
        chapter.url,
        chapter.title
      );
    } catch (error) {
      console.error('Error saving read progress:', error);
    }
  }, [manga, chapter, pages.length]);

  // Fetch chapters if not provided
  useEffect(() => {
    const fetchChapters = async () => {
      if (chapters.length === 0 && manga && manga.url) {
        try {
          const fetchedChapters = await AllMangaService.fetchChapters(manga.url);
          setChapters(fetchedChapters);
        } catch (error) {
          console.error('Error fetching chapters:', error);
        }
      }
    };
    fetchChapters();
  }, [manga, chapters.length]);

  useEffect(() => {
    // If offline pages are provided, use them directly
    if (isOffline && offlinePages && offlinePages.length > 0) {
      setPages(offlinePages);
      setLoading(false);
      
      // Scroll to resume page if available
      if (resumePage !== undefined && resumePage < offlinePages.length) {
        setCurrentPage(resumePage);
        currentPageRef.current = resumePage;
        setTimeout(() => {
          if (scrollViewRef.current) {
            const scrollParams = readingMode === 'UTD' 
              ? { y: resumePage * SCREEN_HEIGHT, animated: false }
              : { x: resumePage * SCREEN_WIDTH, animated: false };
            scrollViewRef.current.scrollTo(scrollParams);
          }
        }, 100);
      }
    } else if (chapter && chapter.url) {
      fetchChapterPages();
    }

    // Save progress periodically (every 10 seconds)
    progressSaveIntervalRef.current = setInterval(() => {
      saveReadProgress();
    }, 10000);

    return () => {
      if (progressSaveIntervalRef.current) {
        clearInterval(progressSaveIntervalRef.current);
      }
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
      }
      // Save progress on exit
      saveReadProgress();
    };
  }, [chapter, pages.length, saveReadProgress, isOffline, offlinePages, resumePage]);

  // Handle back button - save progress before going back
  const handleBack = async () => {
    await saveReadProgress();
    navigation.goBack();
  };

  const fetchChapterPages = async () => {
    if (!chapter || !chapter.url) return;
    
    setLoading(true);
    try {
      const chapterPages = await AllMangaService.fetchChapterPages(chapter.url);
      setPages(chapterPages);
      console.log('[MangaReader] Found', chapterPages.length, 'pages');
      
      // Load saved progress if available
      if (manga && manga.id && chapter.number !== undefined) {
        const savedProgress = await ReadProgressService.getProgress(manga.id, chapter.number);
        if (savedProgress && savedProgress.currentPage < chapterPages.length) {
          setCurrentPage(savedProgress.currentPage);
          currentPageRef.current = savedProgress.currentPage;
          // Scroll to saved page after a short delay
          setTimeout(() => {
            if (scrollViewRef.current) {
              const scrollParams = readingMode === 'UTD'
                ? { y: savedProgress.currentPage * SCREEN_HEIGHT, animated: false }
                : { x: savedProgress.currentPage * SCREEN_WIDTH, animated: false };
              scrollViewRef.current.scrollTo(scrollParams);
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('[MangaReader] Error fetching chapter pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageScroll = (event) => {
    if (readingMode === 'UTD') {
      const contentOffsetY = event.nativeEvent.contentOffset.y;
      const pageHeight = SCREEN_HEIGHT;
      const page = Math.round(contentOffsetY / pageHeight);
      currentPageRef.current = page;
      setCurrentPage(page);
    } else {
      // LTR or RTL - horizontal scrolling
      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const pageWidth = SCREEN_WIDTH;
      const page = Math.round(contentOffsetX / pageWidth);
      currentPageRef.current = page;
      setCurrentPage(page);
    }
  };

  const scrollToPage = React.useCallback((pageIndex) => {
    if (pageIndex >= 0 && pageIndex < pages.length && scrollViewRef.current) {
      if (readingMode === 'UTD') {
        scrollViewRef.current.scrollTo({
          y: pageIndex * SCREEN_HEIGHT,
          animated: true,
        });
      } else {
        // LTR or RTL - horizontal scrolling
        scrollViewRef.current.scrollTo({
          x: pageIndex * SCREEN_WIDTH,
          animated: true,
        });
      }
    }
  }, [readingMode, pages.length]);

  const handlePreviousPage = React.useCallback(() => {
    if (currentPage > 0) {
      scrollToPage(currentPage - 1);
      showControlsWithAnimation();
    }
  }, [currentPage, scrollToPage]);

  const handleNextPage = React.useCallback(() => {
    if (currentPage < pages.length - 1) {
      scrollToPage(currentPage + 1);
      showControlsWithAnimation();
    }
  }, [currentPage, pages.length, scrollToPage]);

  // Tap zone handlers (Tachiyomi-style) - adapt based on reading mode
  const handleLeftTap = () => {
    if (readingMode === 'RTL') {
      handleNextPage();
    } else {
      handlePreviousPage();
    }
  };

  const handleCenterTap = () => {
    toggleControls();
  };

  const handleRightTap = () => {
    if (readingMode === 'RTL') {
      handlePreviousPage();
    } else {
      handleNextPage();
    }
  };

  // Pinch gesture handler for zoom
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: lastScale.current } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      baseScale.current *= event.nativeEvent.scale;
      lastScale.current.setValue(1);
      
      const newScale = Math.max(1, Math.min(baseScale.current, 3));
      baseScale.current = newScale;
      setZoomScale(newScale);
      setZoomEnabled(newScale > 1);
      Animated.spring(zoomAnim, {
        toValue: newScale,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }).start();
    } else if (event.nativeEvent.oldState === State.BEGAN) {
      baseScale.current = zoomScale;
    }
  };

  // Swipe gesture handler for navigation
  const panResponder = useRef(null);
  
  useEffect(() => {
    panResponder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Check current state
        const currentZoom = zoomScale;
        const currentMode = readingMode;
        
        if (currentZoom <= 1 && currentMode !== 'UTD') {
          const dx = Math.abs(gestureState.dx);
          const dy = Math.abs(gestureState.dy);
          // Only respond to horizontal swipes that are significant
          return dx > 30 && dx > dy * 2;
        }
        return false;
      },
      onPanResponderGrant: () => {
        // Disable ScrollView scrolling when we start handling the gesture
        if (scrollViewRef.current) {
          scrollViewRef.current.setNativeProps({ scrollEnabled: false });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Re-enable ScrollView scrolling
        if (scrollViewRef.current) {
          scrollViewRef.current.setNativeProps({ scrollEnabled: true });
        }
        
        const currentZoom = zoomScale;
        const currentMode = readingMode;
        
        if (currentZoom <= 1 && currentMode !== 'UTD') {
          const swipeThreshold = 80;
          const dx = gestureState.dx;
          
          if (Math.abs(dx) > swipeThreshold) {
            if (currentMode === 'RTL') {
              // RTL: swipe right = next, swipe left = previous
              if (dx > 0) {
                handleNextPage();
              } else {
                handlePreviousPage();
              }
            } else {
              // LTR: swipe left = next, swipe right = previous
              if (dx < 0) {
                handleNextPage();
              } else {
                handlePreviousPage();
              }
            }
          }
        }
      },
      onPanResponderTerminate: () => {
        // Re-enable ScrollView scrolling if gesture is cancelled
        if (scrollViewRef.current) {
          scrollViewRef.current.setNativeProps({ scrollEnabled: true });
        }
      },
    });
  }, [zoomScale, readingMode, handleNextPage, handlePreviousPage]);

  // Double tap to zoom
  const handleDoubleTap = (index) => {
    if (zoomScale === 1) {
      const newScale = 2;
      setZoomScale(newScale);
      setZoomEnabled(true);
      baseScale.current = newScale;
      Animated.spring(zoomAnim, {
        toValue: newScale,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }).start();
    } else {
      setZoomScale(1);
      setZoomEnabled(false);
      baseScale.current = 1;
      Animated.spring(zoomAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }).start();
    }
  };

  // Settings handlers
  const handleSettingsPress = () => {
    setShowSettingsModal(true);
    showControlsWithAnimation();
  };

  const handleReadingModeChange = async (mode) => {
    const previousMode = readingMode;
    setReadingMode(mode);
    await StorageService.setReadingMode(mode);
    setShowSettingsModal(false);
    
    // Reset zoom when changing modes
    setZoomScale(1);
    setZoomEnabled(false);
    baseScale.current = 1;
    zoomAnim.setValue(1);
    
    // Reset scroll position when changing modes
    setTimeout(() => {
      if (scrollViewRef.current) {
        const currentPageIndex = currentPageRef.current;
        if (previousMode !== mode) {
          // If mode changed, scroll to current page in new orientation
          if (mode === 'UTD') {
            scrollViewRef.current.scrollTo({
              y: currentPageIndex * SCREEN_HEIGHT,
              animated: false,
            });
          } else {
            scrollViewRef.current.scrollTo({
              x: currentPageIndex * SCREEN_WIDTH,
              animated: false,
            });
          }
        }
      }
    }, 150);
  };

  // Chapter navigation
  const handlePreviousChapter = async () => {
    if (currentChapterIndex > 0 && chapters.length > 0) {
      const prevChapter = chapters[currentChapterIndex - 1];
      await saveReadProgress();
      
      navigation.replace('MangaReader', {
        chapter: prevChapter,
        manga: manga,
        allChapters: chapters,
        isOffline: isOffline,
      });
    }
  };

  const handleNextChapter = async () => {
    if (currentChapterIndex < chapters.length - 1 && chapters.length > 0) {
      const nextChapter = chapters[currentChapterIndex + 1];
      await saveReadProgress();
      
      navigation.replace('MangaReader', {
        chapter: nextChapter,
        manga: manga,
        allChapters: chapters,
        isOffline: isOffline,
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
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
            onPress={handleBack}
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

  const currentChapter = chapter || (chapters.length > 0 ? chapters[currentChapterIndex] : null);
  const canGoToPreviousChapter = currentChapterIndex > 0;
  const canGoToNextChapter = currentChapterIndex < chapters.length - 1;

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" hidden={!showControls} />
      
      {/* Tap Zones Overlay - Tachiyomi style (left/center/right) */}
      {!zoomEnabled && (
        <View style={styles.tapZonesContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.tapZoneLeft}
            activeOpacity={1}
            onPress={handleLeftTap}
          />
          <TouchableOpacity
            style={styles.tapZoneCenter}
            activeOpacity={1}
            onPress={handleCenterTap}
          />
          <TouchableOpacity
            style={styles.tapZoneRight}
            activeOpacity={1}
            onPress={handleRightTap}
          />
        </View>
      )}

      {/* Header Overlay */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top, opacity: headerOpacity },
          !showControls && styles.hidden,
        ]}
        pointerEvents={showControls ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.chapterTitle} numberOfLines={1}>
            {currentChapter?.title || `Chapter ${currentChapter?.number || ''}`}
          </Text>
          <Text style={styles.pageInfo}>
            {currentPage + 1} / {pages.length}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSettingsPress}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Page ScrollView */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          readingMode !== 'UTD' && styles.scrollContentHorizontal
        ]}
        pagingEnabled={!zoomEnabled}
        horizontal={readingMode !== 'UTD'}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onScroll={handlePageScroll}
        scrollEventThrottle={16}
        scrollEnabled={!zoomEnabled || readingMode === 'UTD'}
        bounces={false}
        decelerationRate="fast"
      >
        {pages.map((page, index) => (
          <View 
            key={index} 
            style={[
              styles.pageContainer,
              readingMode !== 'UTD' && styles.pageContainerHorizontal
            ]}
            {...(readingMode !== 'UTD' && !zoomEnabled && panResponder.current ? panResponder.current.panHandlers : {})}
          >
            {!loadedImages[index] && (
              <View style={styles.imageLoadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            <PinchGestureHandler
              ref={(ref) => {
                if (index === 0) pinchRef.current = ref;
              }}
              onGestureEvent={onPinchGestureEvent}
              onHandlerStateChange={onPinchHandlerStateChange}
              simultaneousHandlers={scrollViewRef}
            >
              <Animated.View
                style={[
                  styles.imageWrapper,
                  {
                    transform: [
                      { scale: zoomAnim },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => {
                    // Double tap detection
                    const now = Date.now();
                    if (lastTapRef.current && (now - lastTapRef.current) < 300) {
                      handleDoubleTap(index);
                      lastTapRef.current = null;
                    } else {
                      lastTapRef.current = now;
                      setTimeout(() => {
                        lastTapRef.current = null;
                      }, 300);
                    }
                  }}
                >
                  <Image
                    source={{ uri: page.url }}
                    style={[styles.pageImage, !loadedImages[index] && styles.hiddenImage]}
                    resizeMode="contain"
                    onLoad={() => handleImageLoad(index)}
                    onError={(error) => {
                      console.error(`Error loading page ${index + 1}:`, error);
                    }}
                  />
                </TouchableOpacity>
              </Animated.View>
            </PinchGestureHandler>
          </View>
        ))}
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSettingsModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reading Mode</Text>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  readingMode === 'UTD' && styles.modalOptionSelected
                ]}
                onPress={() => handleReadingModeChange('UTD')}
              >
                <Ionicons
                  name={readingMode === 'UTD' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={readingMode === 'UTD' ? '#4CAF50' : '#fff'}
                />
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Up to Down (UTD)</Text>
                  <Text style={styles.modalOptionDescription}>Vertical scrolling</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalOption,
                  readingMode === 'LTR' && styles.modalOptionSelected
                ]}
                onPress={() => handleReadingModeChange('LTR')}
              >
                <Ionicons
                  name={readingMode === 'LTR' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={readingMode === 'LTR' ? '#4CAF50' : '#fff'}
                />
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Left to Right (LTR)</Text>
                  <Text style={styles.modalOptionDescription}>Horizontal scrolling</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalOption,
                  readingMode === 'RTL' && styles.modalOptionSelected
                ]}
                onPress={() => handleReadingModeChange('RTL')}
              >
                <Ionicons
                  name={readingMode === 'RTL' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={readingMode === 'RTL' ? '#4CAF50' : '#fff'}
                />
                <View style={styles.modalOptionText}>
                  <Text style={styles.modalOptionTitle}>Right to Left (RTL)</Text>
                  <Text style={styles.modalOptionDescription}>Horizontal scrolling (manga style)</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Footer Overlay - Tachiyomi style */}
      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom, opacity: footerOpacity },
          !showControls && styles.hidden,
        ]}
        pointerEvents={showControls ? 'auto' : 'none'}
      >
        {/* Previous Chapter Button */}
        <TouchableOpacity
          style={[styles.chapterNavButton, !canGoToPreviousChapter && styles.chapterNavButtonDisabled]}
          onPress={handlePreviousChapter}
          disabled={!canGoToPreviousChapter}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={canGoToPreviousChapter ? '#fff' : 'rgba(255,255,255,0.3)'}
          />
          <Text style={[styles.chapterNavText, !canGoToPreviousChapter && styles.chapterNavTextDisabled]}>
            Prev
          </Text>
        </TouchableOpacity>

        {/* Page Navigation */}
        <View style={styles.pageNavContainer}>
          <TouchableOpacity
            style={[styles.pageNavButton, currentPage === 0 && styles.pageNavButtonDisabled]}
            onPress={handlePreviousPage}
            disabled={currentPage === 0}
            activeOpacity={0.8}
          >
            <Ionicons
              name={readingMode === 'UTD' ? 'chevron-up' : (readingMode === 'RTL' ? 'chevron-forward' : 'chevron-back')}
              size={20}
              color={currentPage === 0 ? 'rgba(255,255,255,0.3)' : '#fff'}
            />
          </TouchableOpacity>
          
          <View style={styles.pageIndicator}>
            <Text style={styles.pageIndicatorText}>
              {currentPage + 1} / {pages.length}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.pageNavButton, currentPage === pages.length - 1 && styles.pageNavButtonDisabled]}
            onPress={handleNextPage}
            disabled={currentPage === pages.length - 1}
            activeOpacity={0.8}
          >
            <Ionicons
              name={readingMode === 'UTD' ? 'chevron-down' : (readingMode === 'RTL' ? 'chevron-back' : 'chevron-forward')}
              size={20}
              color={currentPage === pages.length - 1 ? 'rgba(255,255,255,0.3)' : '#fff'}
            />
          </TouchableOpacity>
        </View>

        {/* Next Chapter Button */}
        <TouchableOpacity
          style={[styles.chapterNavButton, !canGoToNextChapter && styles.chapterNavButtonDisabled]}
          onPress={handleNextChapter}
          disabled={!canGoToNextChapter}
          activeOpacity={0.8}
        >
          <Text style={[styles.chapterNavText, !canGoToNextChapter && styles.chapterNavTextDisabled]}>
            Next
          </Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={canGoToNextChapter ? '#fff' : 'rgba(255,255,255,0.3)'}
          />
        </TouchableOpacity>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  tapZonesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    flexDirection: 'row',
  },
  tapZoneLeft: {
    flex: 1,
  },
  tapZoneCenter: {
    flex: 1,
  },
  tapZoneRight: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentHorizontal: {
    flexDirection: 'row',
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  pageContainerHorizontal: {
    width: SCREEN_WIDTH,
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000',
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  hidden: {
    opacity: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  chapterTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  pageInfo: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  chapterNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    justifyContent: 'center',
  },
  chapterNavButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  chapterNavText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 4,
  },
  chapterNavTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  pageNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pageNavButton: {
    padding: 8,
  },
  pageNavButtonDisabled: {
    opacity: 0.3,
  },
  pageIndicator: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  // Settings Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptions: {
    gap: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
  },
  modalOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  modalOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalOptionDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
});
