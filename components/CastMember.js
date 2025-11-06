import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { TMDBService } from '../services/TMDBService';

export const CastMember = ({ castMember }) => {
  // Check if profile_path is already a full URL (starts with http)
  const isFullURL = castMember.profile_path && castMember.profile_path.startsWith('http');
  const profileUrl = isFullURL 
    ? castMember.profile_path 
    : TMDBService.getProfileURL(castMember.profile_path, 'w185');
  const characterName = castMember.character || '';
  const actorName = castMember.name || 'Unknown';

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {profileUrl ? (
          <Image
            source={{ uri: profileUrl }}
            style={styles.profileImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.profileImage, styles.placeholder]}>
            <Text style={styles.placeholderText}>No Photo</Text>
          </View>
        )}
      </View>
      <Text style={styles.actorName} numberOfLines={2} ellipsizeMode="tail">
        {actorName}
      </Text>
      {characterName ? (
        <Text style={styles.characterName} numberOfLines={1} ellipsizeMode="tail">
          {characterName}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 100,
    marginRight: 12,
    alignItems: 'center',
  },
  imageContainer: {
    width: 100,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
    fontSize: 11,
  },
  actorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 2,
    width: '100%',
  },
  characterName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    width: '100%',
  },
});

