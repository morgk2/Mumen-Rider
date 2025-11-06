import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../services/StorageService';

export default function CollectionPickerModal({ visible, onClose, item, onItemAdded }) {
  const insets = useSafeAreaInsets();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateField, setShowCreateField] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    if (visible) {
      // Reset state and load collections when modal opens
      setShowCreateField(false);
      setNewCollectionName('');
      setCollections([]);
      setLoading(true);
      loadCollections();
    }
  }, [visible]);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const data = await StorageService.getCollections();
      console.log('Loaded collections:', data);
      setCollections(data || []);
    } catch (error) {
      console.error('Error loading collections:', error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollection = async (collection) => {
    if (!item) return;
    
    const success = await StorageService.addItemToCollection(collection.id, item);
    if (success) {
      if (onItemAdded) {
        onItemAdded(collection);
      }
      onClose();
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newCollectionName.trim() || !item) return;

    const newCollection = await StorageService.createCollection(newCollectionName.trim());
    if (newCollection) {
      const success = await StorageService.addItemToCollection(newCollection.id, item);
      if (success) {
        await loadCollections();
        if (onItemAdded) {
          onItemAdded(newCollection);
        }
        setShowCreateField(false);
        setNewCollectionName('');
        onClose();
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalContent, { paddingBottom: insets.bottom, maxHeight: '90%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add to Collection</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {showCreateField && (
            <View style={styles.createSection}>
              <TextInput
                style={styles.input}
                placeholder="Collection name"
                placeholderTextColor="#666"
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.cancelCreateButton, { marginRight: 12 }]}
                  onPress={() => {
                    setShowCreateField(false);
                    setNewCollectionName('');
                  }}
                >
                  <Text style={styles.cancelCreateText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createButton, !newCollectionName.trim() && styles.createButtonDisabled]}
                  onPress={handleCreateAndAdd}
                  disabled={!newCollectionName.trim()}
                >
                  <Text style={styles.createButtonText}>Create & Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : collections.length > 0 ? (
            <ScrollView
              style={styles.collectionsList}
              contentContainerStyle={styles.collectionsListContent}
              showsVerticalScrollIndicator={false}
            >
              {collections.map((collection) => (
                <TouchableOpacity
                  key={collection.id}
                  style={styles.collectionItem}
                  onPress={() => handleSelectCollection(collection)}
                  activeOpacity={0.8}
                >
                  <View style={styles.collectionItemContent}>
                    <Ionicons name="folder" size={24} color="#fff" />
                    <View style={styles.collectionItemInfo}>
                      <Text style={styles.collectionItemName}>{collection.name}</Text>
                      <Text style={styles.collectionItemCount}>
                        {collection.items?.length || 0} {collection.items?.length === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="folder-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No collections yet</Text>
              <Text style={styles.emptySubtext}>Create a collection to get started</Text>
            </View>
          )}

          {!showCreateField && (
            <TouchableOpacity
              style={styles.addCollectionButton}
              onPress={() => setShowCreateField(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={[styles.addCollectionText, { marginLeft: 8 }]}>Create New Collection</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 200,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
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
  createSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  createActions: {
    flexDirection: 'row',
  },
  cancelCreateButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
  },
  cancelCreateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionsList: {
    maxHeight: 400,
  },
  collectionsListContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  collectionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collectionItemInfo: {
    marginLeft: 16,
    flex: 1,
  },
  collectionItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  collectionItemCount: {
    fontSize: 14,
    color: '#888',
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
  addCollectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  addCollectionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

