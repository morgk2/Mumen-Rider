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
import { fetchLetterboxdProfile, fetchLetterboxdWatchlist } from '../services/LetterboxdService';
import { matchWatchlistWithTMDB } from '../services/LetterboxdWatchlistService';
import { CachedImage } from '../components/CachedImage';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [bookmarks, setBookmarks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [letterboxdUsername, setLetterboxdUsername] = useState(null);
  const [letterboxdProfile, setLetterboxdProfile] = useState(null);
  const [loadingLetterboxd, setLoadingLetterboxd] = useState(false);
  const [showLetterboxdDialog, setShowLetterboxdDialog] = useState(false);
  const [letterboxdInputUsername, setLetterboxdInputUsername] = useState('');
  const [letterboxdWatchlist, setLetterboxdWatchlist] = useState([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [watchlistProgress, setWatchlistProgress] = useState({ current: 0, total: 0 });
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingWatchlist, setUpdatingWatchlist] = useState(false);

  useEffect(() => {
    loadData();
    loadLetterboxdData();
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
    if (letterboxdUsername) {
      // Force refresh on pull-to-refresh
      fetchLetterboxdProfileData(letterboxdUsername, true);
      fetchWatchlist(letterboxdUsername, true);
    }
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

  const loadLetterboxdData = async () => {
    try {
      const username = await StorageService.getLetterboxdUsername();
      if (username) {
        setLetterboxdUsername(username);
        
        // Load cached profile first
        const cachedProfileData = await StorageService.getLetterboxdProfile();
        if (cachedProfileData && cachedProfileData.profile) {
          setLetterboxdProfile(cachedProfileData.profile);
        }
        
        // Check if profile needs updating (stale cache)
        const isProfileStale = await StorageService.isLetterboxdProfileStale();
        if (!cachedProfileData || isProfileStale) {
          // Fetch profile if not cached or stale (async, don't wait)
          setUpdatingProfile(true);
          fetchLetterboxdProfileData(username, false).finally(() => {
            setUpdatingProfile(false);
          });
        }
        
        // Load watchlist asynchronously
        loadWatchlist(username);
      }
    } catch (error) {
      console.error('Error loading Letterboxd data:', error);
    }
  };

  const loadWatchlist = async (username) => {
    try {
      // Load cached watchlist first
      const cachedWatchlistData = await StorageService.getLetterboxdWatchlist();
      if (cachedWatchlistData && cachedWatchlistData.watchlist && cachedWatchlistData.watchlist.length > 0) {
        setLetterboxdWatchlist(cachedWatchlistData.watchlist);
      }
      
      // Check if watchlist needs updating (stale cache)
      const isWatchlistStale = await StorageService.isLetterboxdWatchlistStale();
      if (!cachedWatchlistData || !cachedWatchlistData.watchlist || cachedWatchlistData.watchlist.length === 0 || isWatchlistStale) {
        // Fetch and update watchlist if not cached or stale (async, don't wait)
        setUpdatingWatchlist(true);
        fetchWatchlist(username, false).finally(() => {
          setUpdatingWatchlist(false);
        });
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
  };

  const fetchWatchlist = async (username, showLoading = true) => {
    if (showLoading) {
      setLoadingWatchlist(true);
    }
    try {
      // Fetch watchlist from Letterboxd
      const watchlistItems = await fetchLetterboxdWatchlist(username);
      
      if (watchlistItems.length === 0) {
        setLetterboxdWatchlist([]);
        await StorageService.setLetterboxdWatchlist([]);
        if (showLoading) {
          setLoadingWatchlist(false);
        }
        return;
      }
      
      // Match with TMDB
      const matchedItems = await matchWatchlistWithTMDB(
        watchlistItems,
        (current, total) => {
          setWatchlistProgress({ current, total });
        }
      );
      
      setLetterboxdWatchlist(matchedItems);
      await StorageService.setLetterboxdWatchlist(matchedItems);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      if (showLoading) {
        Alert.alert('Error', 'Failed to fetch watchlist. Please try again later.');
      }
    } finally {
      if (showLoading) {
        setLoadingWatchlist(false);
        setWatchlistProgress({ current: 0, total: 0 });
      } else {
        setWatchlistProgress({ current: 0, total: 0 });
      }
    }
  };

  const fetchLetterboxdProfileData = async (username, showLoading = true) => {
    if (showLoading) {
      setLoadingLetterboxd(true);
    }
    try {
      const profile = await fetchLetterboxdProfile(username);
      setLetterboxdProfile(profile);
      await StorageService.setLetterboxdProfile(profile);
    } catch (error) {
      console.error('Error fetching Letterboxd profile:', error);
      if (showLoading) {
        Alert.alert('Error', 'Failed to fetch Letterboxd profile. Please check the username and try again.');
      }
    } finally {
      if (showLoading) {
        setLoadingLetterboxd(false);
      }
    }
  };

  const handleLinkLetterboxd = () => {
    setShowLetterboxdDialog(true);
  };

  const handleSubmitLetterboxdUsername = async () => {
    if (!letterboxdInputUsername.trim()) {
      Alert.alert('Error', 'Please enter a Letterboxd username');
      return;
    }

    const username = letterboxdInputUsername.trim();
    setShowLetterboxdDialog(false);
    setLetterboxdInputUsername('');
    
    // Save username
    await StorageService.setLetterboxdUsername(username);
    setLetterboxdUsername(username);
    
    // Fetch profile
    await fetchLetterboxdProfileData(username);
    
    // Fetch watchlist asynchronously
    fetchWatchlist(username);
  };

  const handleUnlinkLetterboxd = () => {
    Alert.alert(
      'Unlink Letterboxd',
      'Are you sure you want to unlink your Letterboxd account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
          await StorageService.removeLetterboxdAccount();
          setLetterboxdUsername(null);
          setLetterboxdProfile(null);
          setLetterboxdWatchlist([]);
          },
        },
      ]
    );
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

        {/* Letterboxd Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Letterboxd</Text>
              {(updatingProfile || updatingWatchlist) && (
                <View style={styles.updatingIndicator}>
                  <ActivityIndicator size="small" color="#4CAF50" style={{ marginRight: 4 }} />
                  <Text style={styles.updatingText}>Updating...</Text>
                </View>
              )}
            </View>
            {letterboxdUsername && !loadingLetterboxd && !loadingWatchlist && (
              <TouchableOpacity
                onPress={() => {
                  // Force refresh (ignore cache)
                  fetchLetterboxdProfileData(letterboxdUsername, true);
                  fetchWatchlist(letterboxdUsername, true);
                }}
                style={styles.refreshButton}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          {letterboxdUsername ? (
            <>
              <View style={styles.letterboxdContainer}>
                {loadingLetterboxd ? (
                  <View style={styles.letterboxdLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.letterboxdLoadingText}>Loading profile...</Text>
                  </View>
                ) : letterboxdProfile ? (
                  <View style={styles.letterboxdProfile}>
                    <View style={styles.letterboxdProfileHeader}>
                      <View style={styles.letterboxdAvatarContainer}>
                        {letterboxdProfile.profilePicture ? (
                          <CachedImage
                            source={{ uri: letterboxdProfile.profilePicture }}
                            style={styles.letterboxdAvatar}
                          />
                        ) : (
                          <View style={styles.letterboxdAvatarPlaceholder}>
                            <Ionicons name="person" size={30} color="rgba(255, 255, 255, 0.6)" />
                          </View>
                        )}
                      </View>
                      <View style={styles.letterboxdProfileInfo}>
                        <Text style={styles.letterboxdDisplayName}>
                          {letterboxdProfile.displayName || letterboxdUsername}
                        </Text>
                        <Text style={styles.letterboxdUsername}>@{letterboxdUsername}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.unlinkButton}
                        onPress={handleUnlinkLetterboxd}
                      >
                        <Ionicons name="close-circle" size={24} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.letterboxdStats}>
                      {letterboxdProfile.filmsWatched !== null && (
                        <View style={styles.letterboxdStat}>
                          <Text style={styles.letterboxdStatValue}>
                            {letterboxdProfile.filmsWatched.toLocaleString()}
                          </Text>
                          <Text style={styles.letterboxdStatLabel}>Films Watched</Text>
                        </View>
                      )}
                      {letterboxdProfile.filmsWatchedThisYear !== null && (
                        <View style={styles.letterboxdStat}>
                          <Text style={styles.letterboxdStatValue}>
                            {letterboxdProfile.filmsWatchedThisYear.toLocaleString()}
                          </Text>
                          <Text style={styles.letterboxdStatLabel}>This Year</Text>
                        </View>
                      )}
                      {letterboxdProfile.following !== null && (
                        <View style={styles.letterboxdStat}>
                          <Text style={styles.letterboxdStatValue}>
                            {letterboxdProfile.following.toLocaleString()}
                          </Text>
                          <Text style={styles.letterboxdStatLabel}>Following</Text>
                        </View>
                      )}
                      {letterboxdProfile.followers !== null && (
                        <View style={styles.letterboxdStat}>
                          <Text style={styles.letterboxdStatValue}>
                            {letterboxdProfile.followers.toLocaleString()}
                          </Text>
                          <Text style={styles.letterboxdStatLabel}>Followers</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.letterboxdError}>
                    <Text style={styles.letterboxdErrorText}>Failed to load profile</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => fetchLetterboxdProfileData(letterboxdUsername)}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {/* Watchlist Section */}
              <View style={styles.watchlistSection}>
                <View style={styles.watchlistHeader}>
                  <Text style={styles.watchlistTitle}>Watchlist</Text>
                  {loadingWatchlist && (
                    <View style={styles.watchlistProgress}>
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.watchlistProgressText}>
                        {watchlistProgress.total > 0 
                          ? `${watchlistProgress.current}/${watchlistProgress.total}`
                          : 'Loading...'}
                      </Text>
                    </View>
                  )}
                </View>
                {loadingWatchlist && letterboxdWatchlist.length === 0 ? (
                  <View style={styles.watchlistLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.watchlistLoadingText}>Loading watchlist...</Text>
                  </View>
                ) : letterboxdWatchlist.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.watchlistScroll}
                  >
                    {letterboxdWatchlist.map((item, index) => (
                      <TouchableOpacity
                        key={item.id || index}
                        style={styles.watchlistItem}
                        onPress={() => {
                          const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
                          navigation.navigate('MovieDetails', {
                            item: {
                              id: item.id,
                              title: item.title || item.name,
                              name: item.name || item.title,
                              poster_path: item.poster_path,
                              backdrop_path: item.backdrop_path,
                              overview: item.overview,
                              release_date: item.release_date || item.first_air_date,
                              media_type: mediaType,
                              ...item,
                            },
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <CachedImage
                          source={{
                            uri: item.poster_path
                              ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                              : 'https://via.placeholder.com/150x225/1a1a1a/666?text=No+Image'
                          }}
                          style={styles.watchlistPoster}
                          resizeMode="cover"
                        />
                        <Text style={styles.watchlistItemTitle} numberOfLines={2}>
                          {item.title || item.name}
                        </Text>
                        {item.release_date && (
                          <Text style={styles.watchlistItemYear}>
                            {new Date(item.release_date || item.first_air_date).getFullYear()}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.watchlistEmpty}>
                    <Ionicons name="list-outline" size={48} color="#666" />
                    <Text style={styles.watchlistEmptyText}>No watchlist items</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.linkLetterboxdButton}
              onPress={handleLinkLetterboxd}
              activeOpacity={0.8}
            >
              <Ionicons name="link" size={20} color="#fff" />
              <Text style={styles.linkLetterboxdButtonText}>Link Letterboxd</Text>
            </TouchableOpacity>
          )}
        </View>

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

      {/* Letterboxd Username Dialog */}
      <Modal
        visible={showLetterboxdDialog}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLetterboxdDialog(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>Link Letterboxd Account</Text>
            <Text style={styles.dialogDescription}>
              Enter your Letterboxd username to link your account
            </Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="Username"
              placeholderTextColor="#666"
              value={letterboxdInputUsername}
              onChangeText={setLetterboxdInputUsername}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonCancel]}
                onPress={() => {
                  setShowLetterboxdDialog(false);
                  setLetterboxdInputUsername('');
                }}
              >
                <Text style={styles.dialogButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, styles.dialogButtonConfirm]}
                onPress={handleSubmitLetterboxdUsername}
              >
                <Text style={styles.dialogButtonConfirmText}>Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  updatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  updatingText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
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
  // Letterboxd Styles
  linkLetterboxdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  linkLetterboxdButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  letterboxdContainer: {
    marginHorizontal: 20,
  },
  letterboxdLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  letterboxdLoadingText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 14,
  },
  letterboxdProfile: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  letterboxdProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  letterboxdAvatarContainer: {
    marginRight: 12,
  },
  letterboxdAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a1a1a',
  },
  letterboxdAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterboxdProfileInfo: {
    flex: 1,
  },
  letterboxdDisplayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  letterboxdUsername: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  unlinkButton: {
    padding: 4,
  },
  letterboxdStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  letterboxdStat: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  letterboxdStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  letterboxdStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  refreshButton: {
    padding: 4,
  },
  letterboxdError: {
    alignItems: 'center',
    padding: 20,
  },
  letterboxdErrorText: {
    color: '#ff4444',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Dialog Styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  dialogDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
  },
  dialogInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dialogButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  dialogButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dialogButtonCancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  dialogButtonConfirm: {
    backgroundColor: '#fff',
  },
  dialogButtonConfirmText: {
    color: '#000',
    fontWeight: '600',
  },
  // Watchlist Styles
  watchlistSection: {
    marginTop: 24,
    marginHorizontal: 20,
  },
  watchlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  watchlistTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  watchlistProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchlistProgressText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  watchlistLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  watchlistLoadingText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 14,
  },
  watchlistScroll: {
    paddingRight: 20,
  },
  watchlistItem: {
    width: 120,
    marginRight: 12,
  },
  watchlistPoster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
  },
  watchlistItemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  watchlistItemYear: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  watchlistEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  watchlistEmptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 12,
  },
});


