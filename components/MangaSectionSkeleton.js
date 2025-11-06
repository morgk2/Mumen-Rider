import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';

export const MangaSectionSkeleton = ({ title }) => {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {title ? (
          <Text style={styles.sectionTitle}>{title}</Text>
        ) : (
          <SkeletonLoader width={150} height={24} borderRadius={4} />
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {[...Array(10)].map((_, index) => (
          <View key={index} style={styles.mangaItem}>
            <SkeletonLoader
              width={120}
              height={180}
              borderRadius={8}
              style={styles.mangaImageSkeleton}
            />
            <SkeletonLoader
              width={100}
              height={16}
              borderRadius={4}
              style={styles.titleSkeleton}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  header: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    paddingLeft: 16,
  },
  mangaItem: {
    width: 120,
    marginRight: 12,
  },
  mangaImageSkeleton: {
    marginBottom: 8,
  },
  titleSkeleton: {
    marginTop: 4,
  },
});

