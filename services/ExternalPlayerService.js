import { Linking, Platform, Alert } from 'react-native';

/**
 * External Player Service
 * Handles opening streaming URLs in external video players
 */

// Player URL schemes based on Sora project implementation
// Note: Some players need URL encoding, others don't
const PLAYER_SCHEMES = {
  VLC: (url) => {
    // VLC accepts the URL directly without encoding in the scheme
    return `vlc://${encodeURI(url)}`;
  },
  OutPlayer: (url) => {
    // OutPlayer accepts the URL directly
    return `outplayer://${encodeURI(url)}`;
  },
  Infuse: (url) => {
    // Infuse needs the URL as a query parameter, so it needs encoding
    return `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`;
  },
  nPlayer: (url) => {
    // nPlayer uses a custom scheme format
    return `nplayer-${encodeURI(url)}`;
  },
  SenPlayer: (url) => {
    // SenPlayer needs the URL as a query parameter
    return `senplayer://x-callback-url/play?url=${encodeURIComponent(url)}`;
  },
  IINA: (url) => {
    // IINA needs the URL as a query parameter (macOS player)
    return `iina://weblink?url=${encodeURIComponent(url)}`;
  },
  TracyPlayer: (url) => {
    // TracyPlayer needs the URL as a query parameter
    return `tracy://open?url=${encodeURIComponent(url)}`;
  },
};

// Player names for display
export const EXTERNAL_PLAYERS = [
  { id: 'Default', name: 'Default (In-App Player)' },
  { id: 'VLC', name: 'VLC' },
  { id: 'OutPlayer', name: 'OutPlayer' },
  { id: 'Infuse', name: 'Infuse' },
  { id: 'nPlayer', name: 'nPlayer' },
  { id: 'SenPlayer', name: 'SenPlayer' },
  { id: 'IINA', name: 'IINA' },
  { id: 'TracyPlayer', name: 'TracyPlayer' },
];

/**
 * Check if an external player app is installed
 * @param {string} player - Player identifier (e.g., 'VLC', 'OutPlayer')
 * @returns {Promise<boolean>} - True if player app is available
 */
export const isPlayerAvailable = async (player) => {
  if (player === 'Default') {
    return true; // Default player is always available
  }

  if (!PLAYER_SCHEMES[player]) {
    return false;
  }

  try {
    // Create a test URL with a simple test stream
    // This is more reliable than checking just the base scheme
    const testUrl = PLAYER_SCHEMES[player]('http://test.com');
    
    // Try to check if the URL can be opened
    // Note: On iOS, this can be unreliable, so we return true optimistically
    // and let the actual open attempt handle the error
    try {
      const canOpen = await Linking.canOpenURL(testUrl);
      return canOpen;
    } catch (error) {
      // If the check fails, we'll assume it might be available
      // and let the actual open attempt determine if it works
      console.log(`Availability check failed for ${player}, assuming available:`, error);
      return true; // Optimistically return true
    }
  } catch (error) {
    console.error(`Error checking availability for ${player}:`, error);
    // Return true optimistically - let the actual open attempt handle errors
    return true;
  }
};

/**
 * Open a streaming URL in an external player
 * @param {string} streamUrl - The streaming URL to open
 * @param {string} player - Player identifier (e.g., 'VLC', 'OutPlayer')
 * @returns {Promise<boolean>} - True if successfully opened, false otherwise
 */
export const openInExternalPlayer = async (streamUrl, player) => {
  if (!streamUrl) {
    Alert.alert('Error', 'No stream URL available');
    return false;
  }

  if (player === 'Default') {
    // Return false to indicate we should use the default player
    return false;
  }

  const schemeBuilder = PLAYER_SCHEMES[player];
  if (!schemeBuilder) {
    Alert.alert('Error', `Unknown player: ${player}`);
    return false;
  }

  try {
    const playerUrl = schemeBuilder(streamUrl);
    
    // On iOS, canOpenURL can be unreliable, so we skip the check and try opening directly
    // On Android, we can check first to provide better error messages
    if (Platform.OS === 'android') {
      try {
        const canOpen = await Linking.canOpenURL(playerUrl);
        if (!canOpen) {
          Alert.alert(
            'Player Not Found',
            `${player} is not installed on your device. Please install it from the Play Store and try again.`,
            [{ text: 'OK' }]
          );
          return false;
        }
      } catch (checkError) {
        // If check fails, we'll still try to open
        console.log(`Availability check failed for ${player}, trying to open anyway...`, checkError);
      }
    }
    
    // Try to open the external player
    // On iOS, we skip the canOpenURL check since it's unreliable
    // and just try to open - if it fails, we'll catch the error
    try {
      const opened = await Linking.openURL(playerUrl);
      
      if (opened) {
        return true;
      }
    } catch (openError) {
      // If opening fails, check if it's because the app isn't installed
      console.error(`Error opening ${player}:`, openError);
      throw openError;
    }
    
    // If we get here, opening returned false (shouldn't happen, but handle it)
    Alert.alert(
      'Player Not Found',
      `${player} is not installed on your device. Please install it from the ${Platform.OS === 'ios' ? 'App Store' : 'Play Store'} and try again.`,
      [{ text: 'OK' }]
    );
    return false;
    
  } catch (error) {
    console.error(`Error opening ${player}:`, error);
    
    // Show user-friendly error message
    Alert.alert(
      'Player Not Found',
      `${player} is not installed on your device. Please install it from the ${Platform.OS === 'ios' ? 'App Store' : 'Play Store'} and try again.`,
      [{ text: 'OK' }]
    );
    return false;
  }
};

/**
 * Get the default external player
 * @returns {Promise<string>} - Player identifier
 */
export const getDefaultPlayer = async () => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const player = await AsyncStorage.getItem('@externalPlayer');
    return player || 'Default';
  } catch (error) {
    console.error('Error getting default player:', error);
    return 'Default';
  }
};

/**
 * Set the default external player
 * @param {string} player - Player identifier
 */
export const setDefaultPlayer = async (player) => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('@externalPlayer', player);
  } catch (error) {
    console.error('Error setting default player:', error);
  }
};

export default {
  openInExternalPlayer,
  isPlayerAvailable,
  getDefaultPlayer,
  setDefaultPlayer,
  EXTERNAL_PLAYERS,
};

