import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const PopularListsSkeleton = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SkeletonLoader width={150} height={28} borderRadius={4} />
      </View>

      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {[...Array(5)].map((_, index) => (
          <View key={index} style={styles.cardContainer}>
            <SkeletonLoader
              width={SCREEN_WIDTH * 0.85}
              height={SCREEN_WIDTH * 0.85 * 0.6}
              borderRadius={12}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  cardContainer: {
    marginRight: 12,
  },
});

