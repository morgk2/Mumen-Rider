import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../services/StorageService';
import { BookmarkItem } from '../components/BookmarkItem';
import { TMDBService } from '../services/TMDBService';

export default function CollectionDetailsScreen({ route, navigation }) {
  const { collection } = route.params || {};
  const insets = useSafeAreaInsets();
  const [collectionData, setCollectionData] = useState(collection);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollectionData();
  }, []);

  const loadCollectionData = async () => {
    if (!collection) return;
    setLoading(true);
    try {
      const collections = await StorageService.getCollections();
      const updatedCollection = collections.find((c) => c.id === collection.id);
      if (updatedCollection) {
        setCollectionData(updatedCollection);
      }
    } catch (error) {
      console.error('Error loading collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = (item) => {
    if (item.media_type === 'manga') {
      // Navigate to manga details for manga items
      navigation.navigate('MangaDetails', { item });
    } else {
      // Navigate to movie details for movie/tv items
      navigation.navigate('MovieDetails', { item });
    }
  };

  const handleRemoveItem = async (item) => {
    if (!collectionData) return;
    const success = await StorageService.removeItemFromCollection(
      collectionData.id,
      item.id,
      item.media_type
    );
    if (success) {
      await loadCollectionData();
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!collectionData) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Collection not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {collectionData.name}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoSection}>
          <Text style={styles.itemCount}>
            {collectionData.items?.length || 0} {collectionData.items?.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {collectionData.items && collectionData.items.length > 0 ? (
          <View style={styles.itemsGrid}>
            {collectionData.items.map((item) => (
              <BookmarkItem
                key={`${item.id}-${item.media_type}`}
                item={item}
                onPress={handleItemPress}
                onRemove={handleRemoveItem}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>This collection is empty</Text>
            <Text style={styles.emptySubtext}>Add items to this collection to see them here</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  itemCount: {
    fontSize: 16,
    color: '#888',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 20,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
});

