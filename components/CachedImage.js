import React from 'react';
import { Image } from 'expo-image';
import { View, StyleSheet } from 'react-native';

export const CachedImage = ({ source, style, resizeMode = 'cover', ...props }) => {
  if (!source || !source.uri) {
    return <View style={[style, styles.placeholder]} />;
  }

  // Map resizeMode to expo-image's contentFit
  const contentFitMap = {
    'cover': 'cover',
    'contain': 'contain',
    'stretch': 'fill',
    'center': 'scaleDown',
  };
  
  return (
    <Image
      source={{ uri: source.uri }}
      style={style}
      contentFit={contentFitMap[resizeMode] || 'cover'}
      cachePolicy="memory-disk"
      transition={200}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#1a1a1a',
  },
});

