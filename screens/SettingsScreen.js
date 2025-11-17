import React from 'react';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  
  const settingsSections = [
    {
      id: 'subtitle',
      title: 'Subtitle Settings',
      description: 'Customize subtitle appearance',
      icon: 'text',
      screen: 'SubtitleSettings',
    },
    {
      id: 'player',
      title: 'Player Settings',
      description: 'Configure video player options',
      icon: 'play-circle',
      screen: 'PlayerSettings',
    },
    {
      id: 'source',
      title: 'Video Sources',
      description: 'Manage streaming sources',
      icon: 'server',
      screen: 'VideoSourceSettings',
    },
  ];

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
        <Text style={styles.navTitle}>Settings</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.settingsList}>
          {settingsSections.map((section, index) => (
            <TouchableOpacity
              key={section.id}
              style={[
                styles.settingItem,
                index === settingsSections.length - 1 && styles.settingItemLast
              ]}
              onPress={() => navigation.navigate(section.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.settingIconContainer}>
                  <Ionicons name={section.icon} size={24} color="#fff" />
              </View>
                <View style={styles.settingItemContent}>
                  <Text style={styles.settingItemTitle}>{section.title}</Text>
                  <Text style={styles.settingItemDescription}>{section.description}</Text>
              </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
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
  settingsList: {
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingItemContent: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingItemDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  versionContainer: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
});

