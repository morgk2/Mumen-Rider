/**
 * M3U8 Parser - Parses M3U8 playlists to extract quality options and segments
 * Based on Sora's M3U8 parsing logic
 */

export class M3U8Parser {
  /**
   * Parse M3U8 playlist content to extract audio tracks
   * @param {string} content - M3U8 playlist content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Array<AudioTrack>} Array of audio tracks
   */
  static parseAudioTracks(content, baseUrl) {
    const lines = content.split('\n');
    const audioTracks = [];

    // Default audio track (main audio)
    audioTracks.push({
      id: 'default',
      name: 'Default',
      language: 'unknown',
      groupId: null,
      uri: null,
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for #EXT-X-MEDIA tag with TYPE=AUDIO
      if (line.includes('#EXT-X-MEDIA') && line.includes('TYPE=AUDIO')) {
        // Extract NAME (e.g., NAME="English")
        const nameMatch = line.match(/NAME="([^"]+)"/) || line.match(/NAME=([^,]+)/);
        const name = nameMatch ? nameMatch[1] : 'Unknown';
        
        // Extract LANGUAGE (e.g., LANGUAGE="en")
        const languageMatch = line.match(/LANGUAGE="([^"]+)"/) || line.match(/LANGUAGE=([^,]+)/);
        const language = languageMatch ? languageMatch[1] : 'unknown';
        
        // Extract GROUP-ID (e.g., GROUP-ID="audio")
        const groupIdMatch = line.match(/GROUP-ID="([^"]+)"/) || line.match(/GROUP-ID=([^,]+)/);
        const groupId = groupIdMatch ? groupIdMatch[1] : null;
        
        // Extract URI (e.g., URI="audio.m3u8")
        const uriMatch = line.match(/URI="([^"]+)"/) || line.match(/URI=([^,]+)/);
        let uri = uriMatch ? uriMatch[1] : null;
        
        // Resolve relative URIs
        if (uri && !uri.startsWith('http')) {
          try {
            const base = new URL(baseUrl);
            if (uri.startsWith('/')) {
              uri = `${base.origin}${uri}`;
            } else {
              uri = new URL(uri, baseUrl).toString();
            }
          } catch (e) {
            // If URL parsing fails, construct manually
            const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
            uri = `${basePath}/${uri}`;
          }
        }

        // Create audio track
        audioTracks.push({
          id: `audio-${audioTracks.length}`,
          name: name,
          language: language,
          groupId: groupId,
          uri: uri,
        });
      }
    }

    // Remove duplicates based on name and language
    const uniqueTracks = [];
    const seen = new Set();
    for (const track of audioTracks) {
      const key = `${track.name}-${track.language}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTracks.push(track);
      }
    }

    return uniqueTracks;
  }

  /**
   * Parse M3U8 playlist content to extract quality options
   * @param {string} content - M3U8 playlist content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Array<QualityOption>} Array of quality options
   */
  static parseQualityOptions(content, baseUrl) {
    const lines = content.split('\n');
    const qualities = [];

    // Add "Auto" option (uses master playlist)
    qualities.push({
      name: 'Auto (Recommended)',
      url: baseUrl,
      height: null,
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for #EXT-X-STREAM-INF tag
      if (line.includes('#EXT-X-STREAM-INF') && i + 1 < lines.length) {
        // Extract resolution (e.g., RESOLUTION=1920x1080)
        const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
        if (resolutionMatch) {
          const width = parseInt(resolutionMatch[1], 10);
          const height = parseInt(resolutionMatch[2], 10);
          
          // Get URL from next line
          const nextLine = lines[i + 1].trim();
          
          // Resolve relative URLs
          let streamUrl = nextLine;
          if (!nextLine.startsWith('http')) {
            // Handle relative URLs
            try {
              const base = new URL(baseUrl);
              if (nextLine.startsWith('/')) {
                streamUrl = `${base.origin}${nextLine}`;
              } else {
                streamUrl = new URL(nextLine, baseUrl).toString();
              }
            } catch (e) {
              // If URL parsing fails, construct manually
              const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
              streamUrl = `${basePath}/${nextLine}`;
            }
          }

          // Create quality option
          qualities.push({
            name: this.getQualityName(height),
            url: streamUrl,
            height: height,
            width: width,
          });
        }
      }
    }

    return qualities;
  }

  /**
   * Get quality name based on resolution height
   * @param {number} height - Resolution height
   * @returns {string} Quality name
   */
  static getQualityName(height) {
    if (height >= 1080) {
      return `${height}p (FHD)`;
    } else if (height >= 720) {
      return `${height}p (HD)`;
    } else if (height >= 480) {
      return `${height}p (SD)`;
    }
    return `${height}p`;
  }

  /**
   * Select quality based on preference
   * @param {Array<QualityOption>} qualities - Available quality options
   * @param {string} preferredQuality - Preferred quality ("Best", "High", "Medium", "Low")
   * @returns {QualityOption} Selected quality option
   */
  static selectQuality(qualities, preferredQuality = 'Best') {
    if (qualities.length === 0) {
      return null;
    }

    if (qualities.length === 1) {
      return qualities[0];
    }

    // Sort qualities by height (descending)
    const sortedQualities = qualities
      .filter(q => q.height !== null)
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    const autoQuality = qualities.find(q => q.name.includes('Auto'));

    switch (preferredQuality) {
      case 'Best':
        return sortedQualities[0] || qualities[0];

      case 'High':
        // Find 720p or higher (prefer second highest if multiple)
        const highStreams = sortedQualities.filter(q => (q.height || 0) >= 720);
        if (highStreams.length > 1) {
          return highStreams[1];
        } else if (highStreams.length > 0) {
          return highStreams[0];
        }
        return sortedQualities[0] || qualities[0];

      case 'Medium':
        // Find 480p-720p
        const mediumStreams = sortedQualities.filter(
          q => (q.height || 0) >= 480 && (q.height || 0) < 720
        );
        if (mediumStreams.length > 0) {
          return mediumStreams[0];
        }
        // Fallback to median quality
        if (sortedQualities.length > 1) {
          return sortedQualities[Math.floor(sortedQualities.length / 2)];
        }
        return sortedQualities[0] || qualities[0];

      case 'Low':
        return sortedQualities[sortedQualities.length - 1] || qualities[0];

      default:
        return autoQuality || qualities[0];
    }
  }

  /**
   * Parse M3U8 playlist to extract segment URLs
   * @param {string} content - M3U8 playlist content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Array<string>} Array of segment URLs
   */
  static parseSegments(content, baseUrl) {
    const lines = content.split('\n');
    const segments = [];

    console.log('[M3U8Parser] Parsing segments from playlist, lines:', lines.length);
    console.log('[M3U8Parser] Base URL:', baseUrl);
    console.log('[M3U8Parser] First 500 chars of content:', content.substring(0, 500));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and tags
      if (!line || line.startsWith('#')) {
        continue;
      }

      // Check if line is a URL (segment or playlist)
      // Segment files typically have .ts extension, but can also be other formats
      // vixsrc might use different segment formats
      // Valid segment patterns:
      // - Full HTTP URLs
      // - Files with .ts, .m3u8, .m4s extensions
      // - Relative paths that look like filenames (no spaces, may contain dots/slashes)
      const isFullUrl = line.startsWith('http://') || line.startsWith('https://');
      const hasSegmentExtension = line.includes('.ts') || line.includes('.m3u8') || line.includes('.m4s');
      const looksLikeFilename = !line.includes(' ') && 
                                 (line.includes('/') || line.includes('.')) && 
                                 line.length > 3 && 
                                 !line.startsWith('#');
      
      if (isFullUrl || hasSegmentExtension || looksLikeFilename) {
        let segmentUrl = line;
        
        // Resolve relative URLs
        if (!segmentUrl.startsWith('http')) {
          try {
            const base = new URL(baseUrl);
            if (segmentUrl.startsWith('/')) {
              segmentUrl = `${base.origin}${segmentUrl}`;
            } else {
              // For relative URLs, try to resolve against base URL
              segmentUrl = new URL(segmentUrl, baseUrl).toString();
            }
          } catch (e) {
            console.warn('[M3U8Parser] Failed to parse URL:', segmentUrl, 'Error:', e);
            // If URL parsing fails, construct manually
            try {
              const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
              segmentUrl = `${basePath}/${segmentUrl}`;
            } catch (e2) {
              console.warn('[M3U8Parser] Failed to construct URL:', segmentUrl);
              continue;
            }
          }
        }

        // Only add if it looks like a valid URL
        if (segmentUrl.startsWith('http')) {
          segments.push(segmentUrl);
          console.log('[M3U8Parser] Found segment:', segmentUrl);
        }
      }
    }

    console.log('[M3U8Parser] Total segments found:', segments.length);
    return segments;
  }

  /**
   * Fetch and parse M3U8 playlist
   * @param {string} url - M3U8 playlist URL
   * @param {Object} headers - HTTP headers
   * @returns {Promise<{qualities: Array<QualityOption>, audioTracks: Array<AudioTrack>, content: string}>}
   */
  static async fetchAndParse(url, headers = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Referer': new URL(url).origin,
          'Origin': new URL(url).origin,
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      const qualities = this.parseQualityOptions(content, url);
      const audioTracks = this.parseAudioTracks(content, url);

      return {
        qualities,
        audioTracks,
        content,
      };
    } catch (error) {
      console.error('Error fetching M3U8 playlist:', error);
      throw error;
    }
  }
}

export default M3U8Parser;

