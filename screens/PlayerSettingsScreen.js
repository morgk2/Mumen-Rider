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
import { EXTERNAL_PLAYERS } from '../services/ExternalPlayerService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlayerSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [externalPlayer, setExternalPlayer] = useState('Default');

  useEffect(() => {
    loadExternalPlayer();
  }, []);

  const loadExternalPlayer = async () => {
    try {
      const player = await StorageService.getExternalPlayer();
      setExternalPlayer(player);
    } catch (error) {
      console.error('Error loading external player:', error);
    }
  };

  const handleExternalPlayerChange = async (player) => {
    setExternalPlayer(player);
    await StorageService.setExternalPlayer(player);
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
        <Text style={styles.navTitle}>Player Settings</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>External Player</Text>
          <Text style={styles.settingDescription}>
            Choose which player to use for streaming videos. Select "Default" to use the in-app player.
          </Text>
          
          <View style={styles.sourceOptions}>
            {EXTERNAL_PLAYERS.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.sourceOption,
                  externalPlayer === player.id && styles.sourceOptionActive
                ]}
                onPress={() => handleExternalPlayerChange(player.id)}
              >
                <View style={styles.sourceOptionContent}>
                  <Ionicons
                    name={externalPlayer === player.id ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={externalPlayer === player.id ? '#4CAF50' : 'rgba(255, 255, 255, 0.5)'}
                  />
                  <View style={styles.sourceOptionText}>
                    <Text style={[
                      styles.sourceOptionTitle,
                      externalPlayer === player.id && styles.sourceOptionTitleActive
                    ]}>
                      {player.name}
                    </Text>
                    <Text style={styles.sourceOptionDescription}>
                      {player.id === 'Default' 
                        ? 'Use the built-in video player' 
                        : `Stream videos in ${player.name}`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
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
});




