import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TMDBService } from '../services/TMDBService';
import { CachedImage } from './CachedImage';

export const CollectionCard = ({ collection, onPress, onDelete, onEdit }) => {
  // Get the first item for thumbnail
  const firstItem = collection.items && collection.items.length > 0 ? collection.items[0] : null;
  const posterURL = firstItem ? TMDBService.getPosterURL(firstItem.poster_path) : null;
  const itemCount = collection.items ? collection.items.length : 0;

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress && onPress(collection)}
      activeOpacity={0.8}
    >
      <View style={styles.posterContainer}>
        {posterURL ? (
          <CachedImage
            source={{ uri: posterURL }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="folder-outline" size={48} color="#666" />
          </View>
        )}
        <View style={styles.overlay}>
          <Text style={styles.itemCount}>{itemCount}</Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {collection.name}
        </Text>
        <Text style={styles.count}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
      </View>

      {(onDelete || onEdit) && (
        <View style={styles.actionsContainer}>
          {onEdit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEdit(collection)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[styles.actionButton, onEdit && styles.actionButtonSpacing]}
              onPress={() => onDelete(collection)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 160,
    marginRight: 12,
    position: 'relative',
  },
  posterContainer: {
    width: 160,
    height: 240,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  overlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  itemCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    width: 160,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  count: {
    fontSize: 12,
    color: '#888',
  },
  actionsContainer: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSpacing: {
    marginLeft: 4,
  },
});

