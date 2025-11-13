import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { PopularListCard } from './PopularListCard';

export const PopularListsSection = ({ lists, onListPress, loading = false }) => {
  if (loading) {
    return null; // Skeleton will be shown by parent
  }

  // Always render the section, even if empty, so user knows it exists
  // But show a message if no lists
  if (!lists || lists.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Popular Lists</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No lists available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Popular Lists</Text>
      </View>

      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {lists.map((list) => (
          <PopularListCard
            key={list.id}
            list={list}
            onPress={onListPress}
          />
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
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
  },
});

