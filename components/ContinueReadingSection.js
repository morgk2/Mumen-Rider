import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ContinueReadingItem } from './ContinueReadingItem';

export const ContinueReadingSection = ({ items, onItemPress, onDelete, onViewDetails, navigation }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Continue Reading</Text>
      </View>

      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((itemData, index) => (
          <ContinueReadingItem
            key={`${itemData.item.id}_${itemData.progress.chapterNumber}_${index}`}
            item={itemData.item}
            progress={itemData.progress}
            onPress={onItemPress}
            onDelete={onDelete}
            onViewDetails={onViewDetails}
            navigation={navigation}
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
});

