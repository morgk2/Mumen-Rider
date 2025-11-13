import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { CachedImage } from './CachedImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_HEIGHT = CARD_WIDTH * 0.6; // 16:9 aspect ratio

export const PopularListCard = ({ list, onPress }) => {
  if (!list) return null;

  // Create a grid of posters (2x3 or 3x2 depending on count)
  const renderPosterCollage = () => {
    if (!list.posters || list.posters.length === 0) {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No Images</Text>
        </View>
      );
    }

    // Show up to 6 posters in a 3x2 grid
    const postersToShow = list.posters.slice(0, 6);
    const gridCols = 3;
    const gridRows = Math.ceil(postersToShow.length / gridCols);
    const tileWidth = CARD_WIDTH / gridCols;
    const tileHeight = CARD_HEIGHT / gridRows;
    
    return (
      <View style={styles.collageContainer}>
        {postersToShow.map((posterUrl, index) => {
          return (
            <View
              key={index}
              style={[
                styles.posterTile,
                {
                  width: tileWidth,
                  height: tileHeight,
                },
              ]}
            >
              <CachedImage
                source={{ uri: posterUrl }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(list)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {renderPosterCollage()}
      </View>

      {/* Title Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.title} numberOfLines={2}>
          {list.title}
        </Text>
        {list.filmCount && (
          <Text style={styles.filmCount}>
            {list.filmCount} {list.filmCount === 1 ? 'film' : 'films'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  collageContainer: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  posterTile: {
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  filmCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

