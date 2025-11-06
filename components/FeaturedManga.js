import React from 'react';
import { View, Image, StyleSheet, Dimensions, Text, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AniListService } from '../services/AniListService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.6;

export const FeaturedManga = ({ item, navigation, scrollY }) => {
  // Stretchy header animations
  const headerTranslateY = scrollY ? scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [150, 0],
    extrapolate: 'clamp',
  }) : 0;

  const headerScale = scrollY ? scrollY.interpolate({
    inputRange: [-300, 0],
    outputRange: [2, 1],
    extrapolate: 'clamp',
  }) : 1;

  if (!item) return null;

  const bannerUrl = AniListService.getBannerImage(item);
  const coverUrl = AniListService.getCoverImage(item);
  const displayTitle = AniListService.getMangaTitle(item);

  const handleReadNow = () => {
    if (navigation && item) {
      navigation.navigate('MangaDetails', { item });
    }
  };

  const handleAddToList = () => {
    console.log('Add to List pressed:', item);
    // TODO: Add to user's list
  };

  return (
    <View style={styles.container}>
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
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', '#000']}
        locations={[0, 0.5, 0.8, 1]}
        style={styles.gradient}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Manga Poster */}
        {coverUrl && (
          <View style={styles.posterContainer}>
            <Image
              source={{ uri: coverUrl }}
              style={styles.posterImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Title - Centered */}
        <View style={styles.titleContainer}>
          <Text style={styles.fallbackTitle}>{displayTitle}</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.readNowButton}
            onPress={handleReadNow}
            activeOpacity={0.8}
          >
            <Ionicons name="book" size={20} color="#000" style={styles.buttonIcon} />
            <Text style={styles.readNowText}>Read</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addToListButton, { marginLeft: 12 }]}
            onPress={handleAddToList}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    height: '100%',
    zIndex: 1,
  },
  content: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
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
  titleContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  fallbackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 140,
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  readNowText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  addToListButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

