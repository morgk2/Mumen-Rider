import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SvgUri } from 'react-native-svg';

const STREAMING_PROVIDERS = [
  {
    id: 'netflix',
    name: 'Netflix',
    logoFile: require('../assets/netflix.png'),
    type: 'png',
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    logoFile: require('../assets/disney-plus.png'),
    type: 'png',
  },
  {
    id: 'prime-video',
    name: 'Prime Video',
    logoUrl: 'https://images.justwatch.com/icon/52449539/s100/amazon-prime-video.png',
    type: 'url',
  },
  {
    id: 'apple-tv',
    name: 'Apple TV+',
    logoFile: require('../assets/apple-tv.png'),
    type: 'png',
  },
  {
    id: 'max',
    name: 'Max',
    logoFile: require('../assets/max.png'),
    type: 'png',
  },
];

export const StreamingProvidersSection = ({ navigation }) => {
  const handleProviderPress = (provider) => {
    navigation.navigate('StreamingPlatform', {
      platformId: provider.id,
      platformName: provider.name,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Streaming Platforms</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {STREAMING_PROVIDERS.map((provider) => (
          <TouchableOpacity
            key={provider.id}
            style={styles.providerCard}
            onPress={() => handleProviderPress(provider)}
            activeOpacity={0.8}
          >
            <View style={[
              styles.logoContainer,
              (provider.id === 'disney-plus' || provider.id === 'prime-video') && styles.whiteBackground
            ]}>
              <Image
                source={provider.type === 'url' ? { uri: provider.logoUrl } : provider.logoFile}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  headerContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  providerCard: {
    width: 220,
    height: 120,
    marginRight: 20,
  },
  logoContainer: {
    width: 220,
    height: 120,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  logo: {
    width: 180,
    height: 80,
  },
  whiteBackground: {
    backgroundColor: '#fff',
  },
});
