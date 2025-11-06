import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { AniListService } from '../services/AniListService';

export function MangaSection({ title, data, loading, onPress }) {
  if (loading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {data.map((manga) => {
          const mangaTitle = AniListService.getMangaTitle(manga);
          const coverImage = AniListService.getCoverImage(manga);
          
          return (
            <TouchableOpacity
              key={manga.id}
              style={styles.mangaItem}
              onPress={() => onPress && onPress(manga)}
              activeOpacity={0.7}
            >
              <View style={styles.mangaImageContainer}>
                <Image
                  source={coverImage ? { uri: coverImage } : require('../assets/icon.png')}
                  style={styles.mangaImage}
                  resizeMode="cover"
                />
                {manga.averageScore && manga.averageScore > 0 && (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>★ {(manga.averageScore / 10).toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.mangaInfo}>
                <Text style={styles.mangaTitle} numberOfLines={2}>
                  {mangaTitle}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scrollView: {
    paddingLeft: 16,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  mangaItem: {
    width: 120,
    marginRight: 12,
  },
  mangaImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
  },
  mangaImage: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  mangaInfo: {
    width: '100%',
  },
  mangaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

