import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebtorService } from '../services/WebtorService';

export default function TorrentStreamScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [magnetOrTorrentUrl, setMagnetOrTorrentUrl] = useState('');
  const [title, setTitle] = useState('');
  const [poster, setPoster] = useState('');
  const [imdbId, setImdbId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStream = async () => {
    // Validate input
    if (!magnetOrTorrentUrl.trim()) {
      Alert.alert('Error', 'Please enter a magnet link or torrent URL');
      return;
    }

    // Validate URL format
    if (!WebtorService.isValidTorrentUrl(magnetOrTorrentUrl.trim())) {
      Alert.alert(
        'Invalid URL',
        'Please enter a valid magnet link (starting with magnet:?) or torrent file URL'
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get streaming URL from Webtor
      const streamUrl = await WebtorService.getStreamingUrl(magnetOrTorrentUrl.trim(), {
        title: title.trim() || undefined,
        poster: poster.trim() || undefined,
        imdbId: imdbId.trim() || undefined,
      });

      if (streamUrl) {
        // Navigate to video player with the streaming URL
        navigation.navigate('VideoPlayer', {
          directStreamUrl: streamUrl,
          title: title.trim() || 'Torrent Stream',
        });
      } else {
        setError('Failed to get streaming URL. Please check your magnet link or torrent URL.');
        Alert.alert(
          'Streaming Failed',
          'Could not get streaming URL from the provided magnet link or torrent URL. Please try again or check if the torrent is valid.'
        );
      }
    } catch (err) {
      console.error('Error streaming torrent:', err);
      setError(err.message || 'An error occurred while trying to stream');
      Alert.alert('Error', err.message || 'Failed to start streaming');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    // Try to get clipboard content (if available)
    // Note: You might need to install @react-native-clipboard/clipboard for this
    Alert.alert('Paste', 'Paste your magnet link or torrent URL in the input field');
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
        <Text style={styles.navTitle}>Torrent Streaming</Text>
        <View style={styles.navButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Stream from Torrent</Text>
          <Text style={styles.pageSubtitle}>
            Enter a magnet link or torrent file URL to stream video content
          </Text>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#ff4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Magnet/Torrent URL Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              Magnet Link or Torrent URL <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="magnet:?xt=urn:btih:... or https://example.com/file.torrent"
              placeholderTextColor="#666"
              value={magnetOrTorrentUrl}
              onChangeText={(text) => {
                setMagnetOrTorrentUrl(text);
                setError(null);
              }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              Paste your magnet link (starting with magnet:?) or torrent file URL here
            </Text>
          </View>

          {/* Title Input (Optional) */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Title (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Video title"
              placeholderTextColor="#666"
              value={title}
              onChangeText={setTitle}
              autoCapitalize="words"
            />
          </View>

          {/* Poster URL Input (Optional) */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Poster Image URL (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com/poster.jpg"
              placeholderTextColor="#666"
              value={poster}
              onChangeText={setPoster}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* IMDB ID Input (Optional) */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>IMDB ID (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="tt0133093"
              placeholderTextColor="#666"
              value={imdbId}
              onChangeText={setImdbId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.inputHint}>
              Helps find subtitles and additional metadata
            </Text>
          </View>

          {/* Stream Button */}
          <TouchableOpacity
            style={[styles.streamButton, loading && styles.streamButtonDisabled]}
            onPress={handleStream}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#000" />
                <Text style={styles.streamButtonText}>Start Streaming</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Ionicons name="information-circle" size={20} color="#888" />
            <Text style={styles.infoText}>
              This feature uses Webtor.io to stream torrents. Make sure you have a valid magnet link or torrent file URL.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
    lineHeight: 22,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  required: {
    color: '#ff4444',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  inputHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
    fontStyle: 'italic',
  },
  streamButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  streamButtonDisabled: {
    opacity: 0.6,
  },
  streamButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  infoText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});

