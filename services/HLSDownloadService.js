/**
 * HLS Download Service - Downloads HLS/M3U8 streams
 * Based on Sora's HLS download logic
 */

import * as FileSystem from 'expo-file-system/legacy';
import M3U8Parser from '../utils/M3U8Parser';
import HeaderManager from '../utils/HeaderManager';
import { StorageService } from './StorageService';

export class HLSDownloadService {
  /**
   * Download HLS stream
   * @param {string} streamUrl - M3U8 stream URL
   * @param {string} savePath - Path to save downloaded files
   * @param {Object} headers - HTTP headers
   * @param {Function} onProgress - Progress callback (progress: number)
   * @param {string} preferredQuality - Preferred quality ("Best", "High", "Medium", "Low")
   * @returns {Promise<{success: boolean, localPlaylistPath: string, segments: Array<string>}>}
   */
  static async downloadHLSStream(
    streamUrl,
    savePath,
    headers = {},
    onProgress = null,
    preferredQuality = 'Best',
    onSegmentProgress = null // New callback for segment-based progress
  ) {
    try {
      console.log('[HLSDownloadService] Starting HLS download:', streamUrl);
      console.log('[HLSDownloadService] Save path:', savePath);
      console.log('[HLSDownloadService] Preferred quality:', preferredQuality);

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(savePath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(savePath, { intermediates: true });
      }

      // Step 1: Fetch and parse master playlist (10% progress)
      if (onProgress) onProgress(0.1);
      
      const headersWithDefaults = HeaderManager.ensureStreamingHeaders(headers, streamUrl);
      HeaderManager.logHeaders(headersWithDefaults, streamUrl, 'Fetching M3U8 playlist');

      const { qualities, content: masterContent } = await M3U8Parser.fetchAndParse(
        streamUrl,
        headersWithDefaults
      );

      console.log('[HLSDownloadService] Found qualities:', qualities.map(q => q.name));

      // Step 2: Select quality (15% progress)
      if (onProgress) onProgress(0.15);

      let selectedQuality = M3U8Parser.selectQuality(qualities, preferredQuality);
      
      if (!selectedQuality) {
        // Fallback to master playlist if no quality found
        selectedQuality = { name: 'Auto', url: streamUrl, height: null };
      }

      console.log('[HLSDownloadService] Selected quality:', selectedQuality.name);
      console.log('[HLSDownloadService] Selected URL:', selectedQuality.url);

      // Step 3: Fetch quality-specific playlist (20% progress)
      if (onProgress) onProgress(0.2);

      const qualityHeaders = HeaderManager.ensureStreamingHeaders(headersWithDefaults, selectedQuality.url);
      HeaderManager.logHeaders(qualityHeaders, selectedQuality.url, 'Fetching quality playlist');

      const qualityResponse = await fetch(selectedQuality.url, {
        headers: qualityHeaders,
      });

      if (!qualityResponse.ok) {
        throw new Error(`Failed to fetch quality playlist: ${qualityResponse.status}`);
      }

      const qualityContent = await qualityResponse.text();
      console.log('[HLSDownloadService] Quality playlist content length:', qualityContent.length);

      // Step 4: Parse encryption keys and download them (25% progress)
      if (onProgress) onProgress(0.25);
      
      // Extract encryption key information from playlist
      const encryptionKeyInfo = this.extractEncryptionKey(qualityContent, selectedQuality.url);
      let localKeyPath = null;
      
      if (encryptionKeyInfo) {
        console.log('[HLSDownloadService] Found encryption key:', encryptionKeyInfo.uri);
        try {
          // Download encryption key
          localKeyPath = await this.downloadEncryptionKey(encryptionKeyInfo, savePath, qualityHeaders);
          console.log('[HLSDownloadService] Encryption key downloaded to:', localKeyPath);
        } catch (keyError) {
          console.error('[HLSDownloadService] Failed to download encryption key:', keyError);
          // Continue without encryption key - some streams might work without it
        }
      }

      // Step 5: Parse segments from quality playlist
      const segments = M3U8Parser.parseSegments(qualityContent, selectedQuality.url);
      console.log('[HLSDownloadService] Found segments:', segments.length);

      if (segments.length === 0) {
        // If no segments found, this might be a master playlist with nested playlists
        // In that case, we'll download the playlist as-is and let expo-video handle it
        console.log('[HLSDownloadService] No segments found, saving playlist as-is');
        
        const playlistPath = `${savePath}playlist.m3u8`;
        await FileSystem.writeAsStringAsync(playlistPath, qualityContent);
        
        if (onProgress) onProgress(1.0);
        
        return {
          success: true,
          localPlaylistPath: playlistPath,
          segments: [],
          isMasterPlaylist: true,
        };
      }

      // Step 6: Download all segments (0% - 100% progress based on segments)
      const segmentsDir = `${savePath}segments/`;
      
      // Ensure segments directory exists
      const segmentsDirInfo = await FileSystem.getInfoAsync(segmentsDir);
      if (!segmentsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(segmentsDir, { intermediates: true });
      }

      const downloadedSegments = [];
      const segmentHeaders = HeaderManager.ensureStreamingHeaders(headersWithDefaults, selectedQuality.url);

      // Download segments in parallel batches for much better performance
      const CONCURRENT_DOWNLOADS = 10; // Download 10 segments concurrently
      const totalSegments = segments.length;

      console.log(`[HLSDownloadService] Starting parallel download of ${totalSegments} segments (${CONCURRENT_DOWNLOADS} concurrent)`);
      
      // Report initial progress: 0 segments = 0%
      if (onSegmentProgress) {
        onSegmentProgress({
          segmentsDownloaded: 0,
          totalSegments: totalSegments,
          progress: 0, // 0% when starting
        });
      }

      // Create a function to download a single segment
      const downloadSegment = async (segmentUrl, segmentIndex) => {
        const segmentFileName = `segment_${segmentIndex.toString().padStart(6, '0')}.ts`;
        const segmentPath = `${segmentsDir}${segmentFileName}`;

        try {
          // Download segment using fetch (for custom headers support)
          if (segmentIndex <= 5 || segmentIndex % 100 === 0) {
            // Log first 5 segments and every 100th segment to reduce log spam
            HeaderManager.logHeaders(segmentHeaders, segmentUrl, `Downloading segment ${segmentIndex}/${totalSegments}`);
          }

          const segmentResponse = await fetch(segmentUrl, {
            headers: segmentHeaders,
          });

          if (!segmentResponse.ok) {
            console.warn(`[HLSDownloadService] Failed to download segment ${segmentIndex}: ${segmentResponse.status}`);
            return null;
          }

          // Get segment data as array buffer
          const segmentArrayBuffer = await segmentResponse.arrayBuffer();
          
          // Convert array buffer to base64 for saving
          const segmentBase64 = this.arrayBufferToBase64(segmentArrayBuffer);
          
          // Save segment using FileSystem
          await FileSystem.writeAsStringAsync(segmentPath, segmentBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Verify segment was saved
          const segmentInfo = await FileSystem.getInfoAsync(segmentPath);
          if (!segmentInfo.exists) {
            console.warn(`[HLSDownloadService] Segment ${segmentIndex} was not saved correctly`);
            return null;
          }

          return {
            index: segmentIndex,
            url: segmentUrl,
            path: segmentPath,
            fileName: segmentFileName,
          };
        } catch (error) {
          console.error(`[HLSDownloadService] Error downloading segment ${segmentIndex}:`, error);
          return null;
        }
      };

      // Download segments in batches
      for (let i = 0; i < segments.length; i += CONCURRENT_DOWNLOADS) {
        const batch = segments.slice(i, i + CONCURRENT_DOWNLOADS);
        const batchPromises = batch.map((segmentUrl, batchIndex) => {
          const segmentIndex = i + batchIndex + 1;
          return downloadSegment(segmentUrl, segmentIndex);
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Add successfully downloaded segments
        for (const result of batchResults) {
          if (result) {
            downloadedSegments.push(result);
          }
        }

        // Calculate segment progress: 0 to 1 (0% to 100%)
        const segmentProgress = downloadedSegments.length / totalSegments;
        
        // Report segment-based progress (0-1 range, 0% when 0 segments, 100% when all segments)
        if (onSegmentProgress) {
          onSegmentProgress({
            segmentsDownloaded: downloadedSegments.length,
            totalSegments: totalSegments,
            progress: segmentProgress, // 0 to 1 (0% to 100%) based on segments downloaded
          });
        }
        
        // Also call the legacy onProgress callback if provided (for backward compatibility)
        if (onProgress) {
          // Map segment progress to the old range if needed, but we'll use onSegmentProgress primarily
          const totalProgress = 0.25 + (0.65 * segmentProgress);
          onProgress(totalProgress);
        }
        
        // Log progress every 50 segments or for first batches
        if (downloadedSegments.length % 50 === 0 || downloadedSegments.length <= 10) {
          console.log(`[HLSDownloadService] Progress: ${downloadedSegments.length}/${totalSegments} segments (${(segmentProgress * 100).toFixed(1)}%)`);
        }
      }

      if (downloadedSegments.length === 0) {
        throw new Error('No segments were downloaded successfully');
      }

      // Sort segments by index to ensure correct order
      downloadedSegments.sort((a, b) => a.index - b.index);

      console.log('[HLSDownloadService] Downloaded segments:', downloadedSegments.length, '/', segments.length);
      
      if (downloadedSegments.length < segments.length) {
        console.warn(`[HLSDownloadService] Warning: Only downloaded ${downloadedSegments.length} out of ${segments.length} segments`);
      }

      // Step 7: Create local M3U8 playlist
      // All segments downloaded (100% progress)
      if (onSegmentProgress) {
        onSegmentProgress({
          segmentsDownloaded: downloadedSegments.length,
          totalSegments: totalSegments,
          progress: 1.0, // 100% - all segments downloaded
        });
      }

      const localPlaylistContent = this.createLocalPlaylist(qualityContent, downloadedSegments, savePath, localKeyPath);
      const playlistPath = `${savePath}playlist.m3u8`;
      await FileSystem.writeAsStringAsync(playlistPath, localPlaylistContent);

      console.log('[HLSDownloadService] Created local playlist:', playlistPath);

      // Step 8: Save master playlist info
      // Still at 100% - segments are done, just saving metadata

      const playlistInfo = {
        originalUrl: streamUrl,
        selectedQuality: selectedQuality.name,
        selectedQualityUrl: selectedQuality.url,
        segmentsCount: downloadedSegments.length,
        totalSegments: segments.length,
        downloadedAt: new Date().toISOString(),
      };

      const infoPath = `${savePath}playlist_info.json`;
      await FileSystem.writeAsStringAsync(infoPath, JSON.stringify(playlistInfo, null, 2));

      if (onProgress) onProgress(1.0);

      return {
        success: true,
        localPlaylistPath: playlistPath,
        segments: downloadedSegments.map(s => s.path),
        playlistInfo,
      };
    } catch (error) {
      console.error('[HLSDownloadService] Error downloading HLS stream:', error);
      throw error;
    }
  }

  /**
   * Extract encryption key information from M3U8 playlist
   * @param {string} content - M3U8 playlist content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Object|null} Encryption key information or null
   */
  static extractEncryptionKey(content, baseUrl) {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for #EXT-X-KEY tag
      if (line.includes('#EXT-X-KEY')) {
        // Extract METHOD (e.g., METHOD=AES-128)
        const methodMatch = line.match(/METHOD=([^,]+)/);
        // Extract URI (e.g., URI="https://example.com/key.key" or URI="/storage/enc.key")
        const uriMatch = line.match(/URI="([^"]+)"/) || line.match(/URI=([^,]+)/);
        // Extract IV if present
        const ivMatch = line.match(/IV=([^,]+)/);
        
        if (uriMatch && methodMatch) {
          let keyUri = uriMatch[1];
          
          // Resolve relative URLs
          if (!keyUri.startsWith('http')) {
            try {
              const base = new URL(baseUrl);
              if (keyUri.startsWith('/')) {
                keyUri = `${base.origin}${keyUri}`;
              } else {
                keyUri = new URL(keyUri, baseUrl).toString();
              }
            } catch (e) {
              // If URL parsing fails, construct manually
              const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
              keyUri = `${basePath}/${keyUri}`;
            }
          }
          
          return {
            method: methodMatch[1],
            uri: keyUri,
            iv: ivMatch ? ivMatch[1] : null,
            line: line,
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Download encryption key
   * @param {Object} keyInfo - Encryption key information
   * @param {string} savePath - Path to save the key
   * @param {Object} headers - HTTP headers
   * @returns {Promise<string>} Local key file path
   */
  static async downloadEncryptionKey(keyInfo, savePath, headers) {
    try {
      console.log('[HLSDownloadService] Downloading encryption key from:', keyInfo.uri);
      
      const keyResponse = await fetch(keyInfo.uri, {
        headers: headers,
      });
      
      if (!keyResponse.ok) {
        throw new Error(`Failed to download encryption key: ${keyResponse.status}`);
      }
      
      // Get key data as array buffer
      const keyArrayBuffer = await keyResponse.arrayBuffer();
      
      // Save key file
      const keyPath = `${savePath}encryption.key`;
      const keyBase64 = this.arrayBufferToBase64(keyArrayBuffer);
      
      await FileSystem.writeAsStringAsync(keyPath, keyBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('[HLSDownloadService] Encryption key saved to:', keyPath);
      
      return keyPath;
    } catch (error) {
      console.error('[HLSDownloadService] Error downloading encryption key:', error);
      throw error;
    }
  }

  /**
   * Create local M3U8 playlist with local segment paths
   * @param {string} originalContent - Original playlist content
   * @param {Array<Object>} downloadedSegments - Downloaded segments info
   * @param {string} savePath - Base save path (where playlist will be saved)
   * @param {string|null} localKeyPath - Local encryption key path (if exists)
   * @returns {string} Local playlist content
   */
  static createLocalPlaylist(originalContent, downloadedSegments, savePath, localKeyPath = null) {
    const lines = originalContent.split('\n');
    const localLines = [];
    let segmentIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Handle encryption key line
      if (line.includes('#EXT-X-KEY')) {
        if (localKeyPath) {
          // Replace encryption key URI with absolute file:// URI
          // Keep the rest of the line (METHOD, IV, etc.)
          // expo-video requires absolute file:// URIs for local files
          const keyUriMatch = line.match(/URI="([^"]+)"/) || line.match(/URI=([^,]+)/);
          if (keyUriMatch) {
            // Replace URI with absolute file:// URI for local key file
            // Use the absolute path from FileSystem
            const newLine = line.replace(/URI="[^"]+"/, `URI="${localKeyPath}"`).replace(/URI=[^,]+/, `URI="${localKeyPath}"`);
            localLines.push(newLine);
            console.log('[HLSDownloadService] Updated encryption key URI to:', localKeyPath);
          } else {
            localLines.push(line);
          }
        } else {
          // No local key - remove encryption line or keep original (might fail during playback)
          // For encrypted streams, we need the key, so remove the line if key is missing
          console.warn('[HLSDownloadService] Encryption key not found, removing #EXT-X-KEY line');
          // Keep the line but it will likely fail - better to remove it
          // localLines.push(line); // Commented out - will cause playback failure
        }
      }
      // Keep all other tags and metadata
      else if (line.startsWith('#')) {
        localLines.push(line);
      } else if (line.trim() && !line.startsWith('#')) {
        // Replace segment URL with absolute file:// URI
        if (segmentIndex < downloadedSegments.length) {
          const segment = downloadedSegments[segmentIndex];
          // Use absolute file:// URI for segments
          // expo-video requires absolute file:// URIs for local M3U8 playlists
          const absolutePath = segment.path; // Already a file:// URI from FileSystem
          localLines.push(absolutePath);
          segmentIndex++;
        }
      } else {
        localLines.push(line);
      }
    }

    return localLines.join('\n');
  }

  /**
   * Convert ArrayBuffer to Base64
   * @param {ArrayBuffer} buffer - ArrayBuffer to convert
   * @returns {string} Base64 string
   */
  static arrayBufferToBase64(buffer) {
    // For React Native, we need to use a different approach
    // Convert Uint8Array to base64 string
    const bytes = new Uint8Array(buffer);
    const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
    // Use btoa if available (in some React Native environments), otherwise use a polyfill
    if (typeof btoa !== 'undefined') {
      return btoa(binary);
    } else {
      // Base64 polyfill for React Native
      const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      while (i < binary.length) {
        const a = binary.charCodeAt(i++);
        const b = i < binary.length ? binary.charCodeAt(i++) : 0;
        const c = i < binary.length ? binary.charCodeAt(i++) : 0;
        const bitmap = (a << 16) | (b << 8) | c;
        result += base64Chars.charAt((bitmap >> 18) & 63);
        result += base64Chars.charAt((bitmap >> 12) & 63);
        result += i - 2 < binary.length ? base64Chars.charAt((bitmap >> 6) & 63) : '=';
        result += i - 1 < binary.length ? base64Chars.charAt(bitmap & 63) : '=';
      }
      return result;
    }
  }
  
  /**
   * Get download quality preference from storage
   * @returns {Promise<string>} Quality preference ("Best", "High", "Medium", "Low")
   */
  static async getQualityPreference() {
    try {
      const quality = await StorageService.getDownloadQuality();
      return quality || 'Best';
    } catch (error) {
      console.error('Error getting quality preference:', error);
      return 'Best';
    }
  }
}

export default HLSDownloadService;

