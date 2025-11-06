import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TMDBService } from '../services/TMDBService';

export const ReviewItem = ({ review }) => {
  const [expanded, setExpanded] = useState(false);
  const author = review.author || 'Anonymous';
  const content = review.content || '';
  const rating = review.author_details?.rating;
  const createdDate = review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }) : '';

  // Check if content is long enough to need expansion
  const isLongReview = content.length > 300;
  const displayContent = expanded || !isLongReview ? content : content.substring(0, 300) + '...';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.authorInfo}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={32} color="rgba(255, 255, 255, 0.6)" />
          </View>
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{author}</Text>
            {createdDate ? (
              <Text style={styles.date}>{createdDate}</Text>
            ) : null}
          </View>
        </View>
        {rating ? (
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.rating}>{rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.content}>{displayContent}</Text>

      {isLongReview && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.expandButtonText}>
            {expanded ? 'Show Less' : 'Read More'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatarContainer: {
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
    marginLeft: 4,
  },
  content: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  expandButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
});

