import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const ChapterItem = ({ chapter, onPress }) => {
  const chapterNumber = chapter.number || chapter.chapterNumber || 'N/A';
  const chapterTitle = chapter.title || chapter.chapterTitle || 'Untitled Chapter';
  const chapterDate = chapter.date || chapter.releaseDate || null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(chapter)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.chapterNumber}>Chapter {chapterNumber}</Text>
          {chapterDate && (
            <Text style={styles.chapterDate}>{chapterDate}</Text>
          )}
        </View>
        <Text style={styles.chapterTitle} numberOfLines={2}>
          {chapterTitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chapterNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  chapterDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  chapterTitle: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
});

