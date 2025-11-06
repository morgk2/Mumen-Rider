import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../services/StorageService';
import { BookmarkItem } from '../components/BookmarkItem';
import { CollectionCard } from '../components/CollectionCard';
import { TMDBService } from '../services/TMDBService';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [bookmarks, setBookmarks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [bookmarksData, collectionsData] = await Promise.all([
        StorageService.getBookmarks(),
        StorageService.getCollections(),
      ]);
      setBookmarks(bookmarksData);
      setCollections(collectionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      Alert.alert('Error', 'Please enter a collection name');
      return;
    }

    const collection = await StorageService.createCollection(newCollectionName.trim());
    if (collection) {
      setCollections([...collections, collection]);
      setNewCollectionName('');
      setShowCreateCollection(false);
    } else {
      Alert.alert('Error', 'Failed to create collection');
    }
  };

  const handleDeleteCollection = (collection) => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await StorageService.deleteCollection(collection.id);
            if (success) {
              setCollections(collections.filter((c) => c.id !== collection.id));
            }
          },
        },
      ]
    );
  };

  const handleRenameCollection = (collection) => {
    Alert.prompt(
      'Rename Collection',
      'Enter new name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename',
          onPress: async (newName) => {
            if (newName && newName.trim()) {
              const success = await StorageService.renameCollection(collection.id, newName.trim());
              if (success) {
                await loadData();
              }
            }
          },
        },
      ],
      'plain-text',
      collection.name
    );
  };

  const handleRemoveBookmark = async (item) => {
    const success = await StorageService.removeBookmark(item.id, item.media_type);
    if (success) {
      setBookmarks(bookmarks.filter((b) => !(b.id === item.id && b.media_type === item.media_type)));
    }
  };

  const handleBookmarkPress = (item) => {
    if (item.media_type === 'manga') {
      navigation.navigate('MangaDetails', { item });
    } else {
      navigation.navigate('MovieDetails', { item });
    }
  };

  const handleCollectionPress = (collection) => {
    navigation.navigate('CollectionDetails', { collection });
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Nav Bar */}
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => {}}
        >
          <Ionicons name="person" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Account</Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
      >
        <Text style={styles.pageTitle}>Account</Text>

        {/* Bookmarks/Saves Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bookmarks & Saves</Text>
            <Text style={styles.sectionCount}>({bookmarks.length})</Text>
          </View>
          {bookmarks.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {bookmarks.map((bookmark) => (
                <BookmarkItem
                  key={`${bookmark.id}-${bookmark.media_type}`}
                  item={bookmark}
                  onPress={handleBookmarkPress}
                  onRemove={handleRemoveBookmark}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No bookmarks yet</Text>
              <Text style={styles.emptySubtext}>Save items to view them here</Text>
            </View>
          )}
        </View>

        {/* Collections Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collections</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateCollection(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={[styles.addButtonText, { marginLeft: 6 }]}>New Collection</Text>
            </TouchableOpacity>
          </View>
          {collections.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  onPress={handleCollectionPress}
                  onDelete={handleDeleteCollection}
                  onEdit={handleRenameCollection}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="folder-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No collections yet</Text>
              <Text style={styles.emptySubtext}>Create a collection to organize your favorites</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Collection Modal */}
      <Modal
        visible={showCreateCollection}
        animationType="slide"
        onRequestClose={() => setShowCreateCollection(false)}
      >
        <KeyboardAvoidingView
          style={[styles.fullScreenModal, { paddingTop: insets.top }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.fullScreenModalHeader}>
            <Text style={styles.fullScreenModalTitle}>Create Collection</Text>
            <TouchableOpacity
              onPress={() => setShowCreateCollection(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.fullScreenModalContent}>
            <TextInput
              style={styles.input}
              placeholder="Collection name"
              placeholderTextColor="#666"
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              autoFocus
            />
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateCollection}
              activeOpacity={0.8}
            >
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionCount: {
    fontSize: 16,
    color: '#888',
    marginLeft: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  horizontalScroll: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  collectionModalContent: {
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  collectionItemsScroll: {
    flex: 1,
  },
  collectionItemsContent: {
    paddingBottom: 20,
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreenModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  fullScreenModalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  fullScreenModalContent: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
    justifyContent: 'flex-start',
  },
});


