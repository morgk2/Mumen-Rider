import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService } from '../services/StorageService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VideoSourceSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [videoSource, setVideoSource] = useState('vixsrc');

  useEffect(() => {
    loadVideoSource();
  }, []);

  const loadVideoSource = async () => {
    try {
      const source = await StorageService.getVideoSource();
      setVideoSource(source);
    } catch (error) {
      console.error('Error loading video source:', error);
    }
  };

  const handleVideoSourceChange = async (source) => {
    setVideoSource(source);
    await StorageService.setVideoSource(source);
  };

  return (
    <View style={styles.container}>
      {/* Nav Bar */}
      <View style={[styles.navBar, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Video Sources</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video Streaming Source</Text>
          <Text style={styles.settingDescription}>
            Choose which service to use for streaming videos
          </Text>
          
          <View style={styles.sourceOptions}>
            <TouchableOpacity
              style={[
                styles.sourceOption,
                videoSource === 'vixsrc' && styles.sourceOptionActive
              ]}
              onPress={() => handleVideoSourceChange('vixsrc')}
            >
              <View style={styles.sourceOptionContent}>
                <Ionicons
                  name={videoSource === 'vixsrc' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={videoSource === 'vixsrc' ? '#4CAF50' : 'rgba(255, 255, 255, 0.5)'}
                />
                <View style={styles.sourceOptionText}>
                  <Text style={[
                    styles.sourceOptionTitle,
                    videoSource === 'vixsrc' && styles.sourceOptionTitleActive
                  ]}>
                    Vixsrc
                  </Text>
                  <Text style={styles.sourceOptionDescription}>
                    Default streaming source
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sourceOption,
                videoSource === 'n3tflix' && styles.sourceOptionActive
              ]}
              onPress={() => handleVideoSourceChange('n3tflix')}
            >
              <View style={styles.sourceOptionContent}>
                <Ionicons
                  name={videoSource === 'n3tflix' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={videoSource === 'n3tflix' ? '#4CAF50' : 'rgba(255, 255, 255, 0.5)'}
                />
                <View style={styles.sourceOptionText}>
                  <Text style={[
                    styles.sourceOptionTitle,
                    videoSource === 'n3tflix' && styles.sourceOptionTitleActive
                  ]}>
                    N3tflix
                  </Text>
                  <Text style={styles.sourceOptionDescription}>
                    Alternative streaming source
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  settingDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginBottom: 16,
  },
  sourceOptions: {
    gap: 12,
  },
  sourceOption: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 16,
  },
  sourceOptionActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: '#4CAF50',
  },
  sourceOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  sourceOptionTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sourceOptionTitleActive: {
    color: '#fff',
  },
  sourceOptionDescription: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
});


