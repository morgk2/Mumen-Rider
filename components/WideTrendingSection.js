import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { WidePosterItem } from './WidePosterItem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_LARGE_SCREEN = SCREEN_WIDTH >= 768;
const IS_WEB = Platform.OS === 'web';

export const WideTrendingSection = ({ title, icon, items, onItemPress, loading = false, showRankings = false }) => {
  const isLoading = Boolean(loading);
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {icon ? <Text style={styles.icon}>{icon} </Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items available</Text>
        </View>
      ) : (
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {items.slice(0, 20).map((item, index) => (
            <WidePosterItem
              key={item.id}
              item={item}
              onPress={onItemPress}
              rank={showRankings ? index + 1 : null}
              showLogo={true}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: IS_LARGE_SCREEN ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IS_LARGE_SCREEN ? 60 : 20,
    marginBottom: IS_LARGE_SCREEN ? 16 : 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: IS_LARGE_SCREEN ? 20 : 16,
  },
  title: {
    fontSize: IS_LARGE_SCREEN ? 28 : 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: IS_LARGE_SCREEN ? 0.5 : 0,
  },
  scrollContent: {
    paddingHorizontal: IS_LARGE_SCREEN ? 60 : 20,
    paddingRight: IS_LARGE_SCREEN ? 60 : 20,
  },
  loadingContainer: {
    padding: IS_LARGE_SCREEN ? 40 : 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: IS_LARGE_SCREEN ? 14 : 12,
    color: '#888',
  },
  emptyContainer: {
    padding: IS_LARGE_SCREEN ? 40 : 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: IS_LARGE_SCREEN ? 16 : 14,
    color: '#666',
  },
});

