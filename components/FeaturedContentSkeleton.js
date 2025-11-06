import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FEATURED_HEIGHT = SCREEN_HEIGHT * 0.6;

export const FeaturedContentSkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Backdrop skeleton */}
      <SkeletonLoader
        width={SCREEN_WIDTH * 1.33}
        height={FEATURED_HEIGHT + 150}
        style={styles.backdrop}
      />

      {/* Content skeleton */}
      <View style={styles.content}>
        {/* Logo/Title skeleton */}
        <SkeletonLoader
          width={SCREEN_WIDTH * 0.6}
          height={80}
          borderRadius={8}
          style={styles.logoSkeleton}
        />

        {/* Buttons skeleton */}
        <View style={styles.buttonContainer}>
          <SkeletonLoader
            width={140}
            height={44}
            borderRadius={25}
            style={styles.buttonSkeleton}
          />
          <SkeletonLoader
            width={44}
            height={44}
            borderRadius={22}
            style={[styles.buttonSkeleton, { marginLeft: 12 }]}
          />
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
  backdrop: {
    position: 'absolute',
    top: -75,
    left: -SCREEN_WIDTH * 0.165,
  },
  content: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2,
  },
  logoSkeleton: {
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonSkeleton: {
    backgroundColor: '#1a1a1a',
  },
});

