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
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SUBTITLE_SETTINGS_KEY = '@subtitle_settings';

export default function SubtitleSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  
  // Subtitle settings states
  const [subtitleColor, setSubtitleColor] = useState('#ffffff');
  const [subtitleSize, setSubtitleSize] = useState(18);
  const [subtitlePosition, setSubtitlePosition] = useState(80);
  const [subtitleFont, setSubtitleFont] = useState('System');
  const [subtitleShadow, setSubtitleShadow] = useState(false);
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [subtitleOutline, setSubtitleOutline] = useState(false);

  useEffect(() => {
    loadSubtitleSettings();
  }, []);

  const loadSubtitleSettings = async () => {
    try {
      const settingsJson = await AsyncStorage.getItem(SUBTITLE_SETTINGS_KEY);
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        setSubtitleColor(settings.color || '#ffffff');
        setSubtitleSize(settings.size || 18);
        if (typeof settings.position === 'string') {
          if (settings.position === 'top') setSubtitlePosition(0);
          else if (settings.position === 'center') setSubtitlePosition(50);
          else setSubtitlePosition(80);
        } else {
          setSubtitlePosition(settings.position !== undefined ? settings.position : 80);
        }
        setSubtitleFont(settings.font || 'System');
        setSubtitleShadow(settings.shadow || false);
        setSubtitleBackground(settings.background !== undefined ? settings.background : true);
        setSubtitleOutline(settings.outline || false);
      }
    } catch (error) {
      console.error('Error loading subtitle settings:', error);
    }
  };

  const saveSubtitleSettings = async () => {
    try {
      const settings = {
        color: subtitleColor,
        size: subtitleSize,
        position: subtitlePosition,
        font: subtitleFont,
        shadow: subtitleShadow,
        background: subtitleBackground,
        outline: subtitleOutline,
      };
      await AsyncStorage.setItem(SUBTITLE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving subtitle settings:', error);
    }
  };

  // Save settings whenever they change
  useEffect(() => {
    saveSubtitleSettings();
  }, [subtitleColor, subtitleSize, subtitlePosition, subtitleFont, subtitleShadow, subtitleBackground, subtitleOutline]);

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
        <Text style={styles.navTitle}>Subtitle Settings</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewContainer}>
            <View style={[
              styles.previewOverlay,
              {
                top: `${subtitlePosition}%`,
                marginTop: subtitlePosition === 50 ? -20 : 0,
              }
            ]}>
              <Text style={[
                styles.previewText,
                {
                  color: subtitleColor,
                  fontSize: subtitleSize,
                  fontFamily: subtitleFont === 'System' ? undefined : subtitleFont,
                  textShadowColor: subtitleShadow ? 'rgba(0, 0, 0, 0.8)' : 'transparent',
                  textShadowOffset: subtitleShadow ? { width: 2, height: 2 } : { width: 0, height: 0 },
                  textShadowRadius: subtitleShadow ? 4 : 0,
                  backgroundColor: subtitleBackground ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                  textStrokeWidth: subtitleOutline ? 2 : 0,
                  textStrokeColor: subtitleOutline ? '#000' : 'transparent',
                  WebkitTextStrokeWidth: subtitleOutline ? 2 : 0,
                  WebkitTextStrokeColor: subtitleOutline ? '#000' : 'transparent',
                }
              ]}>
                This is a subtitle preview
              </Text>
            </View>
          </View>
        </View>

        {/* Color Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subtitle Color</Text>
          <View style={styles.colorPickerContainer}>
            {['#ffffff', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#0000ff', '#ffa500'].map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  subtitleColor === color && styles.colorOptionActive,
                ]}
                onPress={() => setSubtitleColor(color)}
              />
            ))}
          </View>
        </View>

        {/* Size Slider */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Size: {subtitleSize}</Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>12</Text>
            <TouchableOpacity
              style={styles.sliderTrack}
              activeOpacity={1}
              onPress={(e) => {
                const { locationX } = e.nativeEvent;
                const trackWidth = e.nativeEvent.target?.offsetWidth || 200;
                const percentage = Math.max(0, Math.min(1, locationX / trackWidth));
                const newSize = Math.round(12 + (percentage * (32 - 12)));
                setSubtitleSize(newSize);
              }}
            >
              <View 
                style={[
                  styles.sliderFill,
                  { width: `${((subtitleSize - 12) / (32 - 12)) * 100}%` }
                ]} 
              />
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${((subtitleSize - 12) / (32 - 12)) * 100}%` }
                ]}
              />
            </TouchableOpacity>
            <Text style={styles.sliderValue}>32</Text>
          </View>
          <View style={styles.sliderButtons}>
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => setSubtitleSize(Math.max(12, subtitleSize - 1))}
            >
              <Ionicons name="remove" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => setSubtitleSize(Math.min(32, subtitleSize + 1))}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Position Slider */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Position: {subtitlePosition}%</Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>Top</Text>
            <TouchableOpacity
              style={styles.sliderTrack}
              activeOpacity={1}
              onPress={(e) => {
                const { locationX } = e.nativeEvent;
                const trackWidth = e.nativeEvent.target?.offsetWidth || 200;
                const percentage = Math.max(0, Math.min(100, (locationX / trackWidth) * 100));
                setSubtitlePosition(Math.round(percentage));
              }}
            >
              <View 
                style={[
                  styles.sliderFill,
                  { width: `${subtitlePosition}%` }
                ]} 
              />
              <View
                style={[
                  styles.sliderThumb,
                  { left: `${subtitlePosition}%` }
                ]}
              />
            </TouchableOpacity>
            <Text style={styles.sliderValue}>Bottom</Text>
          </View>
          <View style={styles.sliderButtons}>
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => setSubtitlePosition(Math.max(0, subtitlePosition - 5))}
            >
              <Ionicons name="remove" size={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => setSubtitlePosition(Math.min(100, subtitlePosition + 5))}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Font Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Font</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fontScrollView}>
            {['System', 'Arial', 'Helvetica', 'Times', 'Courier'].map((font) => (
              <TouchableOpacity
                key={font}
                style={[
                  styles.fontOption,
                  subtitleFont === font && styles.fontOptionActive,
                ]}
                onPress={() => setSubtitleFont(font)}
              >
                <Text style={[
                  styles.fontOptionText,
                  subtitleFont === font && styles.fontOptionTextActive,
                ]}>
                  {font}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Effects</Text>
          <TouchableOpacity
            style={styles.toggleOption}
            onPress={() => setSubtitleShadow(!subtitleShadow)}
          >
            <Text style={styles.toggleLabel}>Shadow</Text>
            <View style={[styles.toggleSwitch, subtitleShadow && styles.toggleSwitchActive]}>
              <View style={[styles.toggleThumb, subtitleShadow && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleOption}
            onPress={() => setSubtitleBackground(!subtitleBackground)}
          >
            <Text style={styles.toggleLabel}>Background</Text>
            <View style={[styles.toggleSwitch, subtitleBackground && styles.toggleSwitchActive]}>
              <View style={[styles.toggleThumb, subtitleBackground && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleOption}
            onPress={() => setSubtitleOutline(!subtitleOutline)}
          >
            <Text style={styles.toggleLabel}>Outline</Text>
            <View style={[styles.toggleSwitch, subtitleOutline && styles.toggleSwitchActive]}>
              <View style={[styles.toggleThumb, subtitleOutline && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
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
    marginBottom: 16,
  },
  previewContainer: {
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    minHeight: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  previewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  previewText: {
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '90%',
    lineHeight: 24,
  },
  colorPickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorOptionActive: {
    borderColor: '#fff',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderValue: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    width: 30,
    textAlign: 'center',
  },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginHorizontal: 8,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    top: -6,
    marginLeft: -8,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  sliderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontScrollView: {
    flexGrow: 0,
  },
  fontOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  fontOptionActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  fontOptionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  fontOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
});




