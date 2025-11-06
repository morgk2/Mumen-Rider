import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SkeletonLoader } from './SkeletonLoader';

export const TrendingSectionSkeleton = ({ title }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {title ? (
            <Text style={styles.title}>{title}</Text>
          ) : (
            <SkeletonLoader width={150} height={24} borderRadius={4} />
          )}
        </View>
      </View>

      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {[...Array(10)].map((_, index) => (
          <View key={index} style={styles.itemContainer}>
            <SkeletonLoader
              width={120}
              height={180}
              borderRadius={8}
              style={styles.posterSkeleton}
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
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  itemContainer: {
    marginRight: 12,
    width: 120,
  },
  posterSkeleton: {
    marginBottom: 8,
  },
  titleSkeleton: {
    marginTop: 4,
  },
});

