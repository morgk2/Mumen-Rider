const WEBTOR_BASE_URL = 'https://webtor.io';

/**
 * WebtorService - Converts magnet links and torrent URLs to streaming URLs
 * Based on the actual Webtor Embed SDK source code
 * SDK Source: https://github.com/webtor-io/embed-sdk-js
 * 
 * How the SDK works:
 * 1. Creates iframe pointing to: ${baseUrl}/show?id=${uuid}&mode=video
 * 2. Sends postMessage with config (magnet/torrentUrl, etc.) to iframe
 * 3. Iframe processes torrent and creates stream
 * 
 * This service attempts to extract the streaming URL directly without using iframe.
 */
export const WebtorService = {
  /**
   * Generate UUID (same as SDK uses)
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Parse path into pwd and file (same as SDK)
   */
  parsePath(path) {
    const chunks = path.replace(/^\//, '').split('/');
    const file = chunks.pop();
    const pwd = '/' + chunks.join('/');
    return { pwd, file };
  },

  /**
   * Get streaming URL from magnet link or torrent URL
   * This mimics how the Webtor Embed SDK works internally
   * @param {string} magnetOrTorrentUrl - Magnet link (magnet:?xt=...) or torrent file URL
   * @param {object} options - Optional configuration
   * @returns {Promise<string|null>} - Streaming URL or null if failed
   */
  async getStreamingUrl(magnetOrTorrentUrl, options = {}) {
    try {
      const { poster, title, imdbId, path, pwd, file, baseUrl = WEBTOR_BASE_URL } = options;
      
      // Determine if it's a magnet link or torrent URL
      const isMagnet = magnetOrTorrentUrl.startsWith('magnet:');
      
      // Parse path if provided
      let parsedPath = {};
      if (path) {
        parsedPath = this.parsePath(path);
      }

      // Generate UUID (same as SDK does)
      const id = this.generateUUID();
      
      // Build the /show URL (same as SDK does)
      // SDK creates: ${baseUrl}/show?id=${id}&mode=video
      const showUrl = `${baseUrl}/show?id=${id}&mode=video`;

      // Fetch the /show page
      const response = await fetch(showUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Referer': baseUrl,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // The /show page contains the player that processes the torrent
      // Try to extract streaming URL from the page
      let streamUrl = this.extractStreamFromHTML(html);

      // If not found, try to call Webtor's API with the config
      // The SDK sends the config via postMessage, but we can try API endpoints
      if (!streamUrl) {
        streamUrl = await this.getStreamFromWebtorAPI(magnetOrTorrentUrl, {
          ...options,
          ...parsedPath,
          id,
        });
      }

      // Alternative: Try to get stream URL by simulating the postMessage flow
      // This might require understanding Webtor's internal API better
      if (!streamUrl) {
        streamUrl = await this.getStreamFromShowPage(showUrl, {
          id,
          magnet: isMagnet ? magnetOrTorrentUrl : null,
          torrentUrl: isMagnet ? null : magnetOrTorrentUrl,
          poster,
          title,
          imdbId,
          pwd: pwd || parsedPath.pwd,
          file: file || parsedPath.file,
        });
      }

      // Validate the extracted URL before returning
      if (streamUrl && this.isValidVideoUrl(streamUrl)) {
        console.log('Extracted streaming URL from Webtor:', streamUrl);
        return streamUrl;
      } else {
        if (streamUrl) {
          console.warn('Extracted URL is not a valid video stream:', streamUrl);
        } else {
          console.warn('Could not extract streaming URL from Webtor');
        }
        return null;
      }
    } catch (error) {
      console.error('Error getting streaming URL from Webtor:', error);
      return null;
    }
  },

  /**
   * Try to get stream URL from the /show page by understanding its structure
   */
  async getStreamFromShowPage(showUrl, config) {
    try {
      // The /show page might have API endpoints or embedded data
      // Try to find API calls or streaming URLs in the page
      const response = await fetch(showUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Referer': WEBTOR_BASE_URL,
        },
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      
      // Look for API endpoints in the page
      const apiPatterns = [
        /['"]([^'"]*\/api\/[^'"]*)['"]/gi,
        /fetch\s*\(\s*['"]([^'"]*\/api\/[^'"]*)['"]/gi,
        /axios\.[a-z]+\s*\(\s*['"]([^'"]*\/api\/[^'"]*)['"]/gi,
      ];

      for (const pattern of apiPatterns) {
        const matches = html.match(pattern);
        if (matches) {
          for (const match of matches) {
            const url = match.replace(/['"]/g, '').replace(/^.*?(\/api\/[^'"]*).*$/, '$1');
            if (url.startsWith('/api/')) {
              const apiUrl = `${WEBTOR_BASE_URL}${url}`;
              const streamUrl = await this.tryAPIEndpoint(apiUrl, config);
              if (streamUrl) return streamUrl;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting stream from show page:', error);
      return null;
    }
  },

  /**
   * Try an API endpoint with the config
   */
  async tryAPIEndpoint(apiUrl, config) {
    try {
      // Try POST with config
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Referer': WEBTOR_BASE_URL,
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        const url = data?.streamUrl || data?.url || data?.src || data?.stream;
        if (url && this.isValidVideoUrl(url)) {
          return url;
        }
      }
    } catch (error) {
      // Ignore errors, try next endpoint
    }
    return null;
  },

  /**
   * Check if URL is a valid video streaming URL
   */
  isValidVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Must be HTTP/HTTPS
    if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
    
    // Exclude common non-video URLs
    const excludePatterns = [
      /\.js$/i,
      /\.css$/i,
      /\.json$/i,
      /\.html$/i,
      /\.xml$/i,
      /beacon/i,
      /analytics/i,
      /tracking/i,
      /ads/i,
      /advertisement/i,
      /cloudflare/i,
      /google-analytics/i,
      /facebook\.net/i,
      /doubleclick/i,
    ];
    
    for (const pattern of excludePatterns) {
      if (pattern.test(url)) return false;
    }
    
    // Must be a video format or streaming protocol
    const videoPatterns = [
      /\.(m3u8|mp4|m4v|mkv|avi|webm|mov|flv|wmv|mpd)$/i,
      /\/stream/i,
      /\/video/i,
      /\/play/i,
      /\/hls/i,
      /\/dash/i,
      /manifest/i,
      /playlist/i,
    ];
    
    for (const pattern of videoPatterns) {
      if (pattern.test(url)) return true;
    }
    
    return false;
  },

  /**
   * Extract streaming URL from HTML content
   */
  extractStreamFromHTML(html) {
    let streamUrl = null;

    // Pattern 1: Look for video element with source
    const videoMatch = html.match(/<video[^>]+src=['"]([^'"]+)['"]/i);
    if (videoMatch && videoMatch[1]) {
      streamUrl = videoMatch[1];
      if (!streamUrl.startsWith('http')) {
        streamUrl = `${WEBTOR_BASE_URL}${streamUrl.startsWith('/') ? '' : '/'}${streamUrl}`;
      }
      if (this.isValidVideoUrl(streamUrl)) {
        return streamUrl;
      }
    }

    // Pattern 2: Look for source element inside video
    const sourceMatch = html.match(/<source[^>]+src=['"]([^'"]+)['"]/i);
    if (sourceMatch && sourceMatch[1]) {
      streamUrl = sourceMatch[1];
      if (!streamUrl.startsWith('http')) {
        streamUrl = `${WEBTOR_BASE_URL}${streamUrl.startsWith('/') ? '' : '/'}${streamUrl}`;
      }
      if (this.isValidVideoUrl(streamUrl)) {
        return streamUrl;
      }
    }

    // Pattern 3: Look for m3u8 or mp4 URLs (HLS streams) - prioritize these
    const videoUrlPatterns = [
      /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/gi,
      /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi,
      /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/gi,
      /(https?:\/\/[^\s"']+\.mpd[^\s"']*)/gi,
      /(https?:\/\/[^\s"']+\.m4v[^\s"']*)/gi,
    ];

    for (const pattern of videoUrlPatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        // Filter to only valid video URLs
        const validUrls = matches
          .map(m => m.replace(/["']/g, ''))
          .filter(url => this.isValidVideoUrl(url));
        
        if (validUrls.length > 0) {
          // Prefer m3u8 (HLS) or mpd (DASH) streams
          const hlsUrl = validUrls.find(url => /\.m3u8/i.test(url));
          if (hlsUrl) return hlsUrl;
          const dashUrl = validUrls.find(url => /\.mpd/i.test(url));
          if (dashUrl) return dashUrl;
          return validUrls[0];
        }
      }
    }

    // Pattern 4: Look for Webtor API responses in script tags
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      for (const script of scriptMatches) {
        // Look for streaming URLs in JavaScript - be more specific
        const urlPatterns = [
          /(?:streamUrl|stream|videoUrl|videoSrc|src|url)\s*[:=]\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4|mpd|m4v))['"]/i,
          /(?:streamUrl|stream|videoUrl|videoSrc)\s*[:=]\s*['"](https?:\/\/[^'"]*\/stream[^'"]*)['"]/i,
          /(?:streamUrl|stream|videoUrl|videoSrc)\s*[:=]\s*['"](https?:\/\/[^'"]*\/video[^'"]*)['"]/i,
          /(?:streamUrl|stream|videoUrl|videoSrc)\s*[:=]\s*['"](https?:\/\/[^'"]*\/play[^'"]*)['"]/i,
        ];

        for (const pattern of urlPatterns) {
          const match = script.match(pattern);
          if (match && match[1]) {
            streamUrl = match[1];
            if (this.isValidVideoUrl(streamUrl)) {
              return streamUrl;
            }
          }
        }
      }
    }

    // Pattern 5: Look for WebSocket or WebRTC URLs (these won't work with expo-av, but log them)
    const wsPattern = /(wss?:\/\/[^\s"']+)/gi;
    const wsMatches = html.match(wsPattern);
    if (wsMatches) {
      console.warn('Found WebSocket/WebRTC URLs (not compatible with expo-av):', wsMatches[0]);
    }

    return null;
  },

  /**
   * Try to get stream URL from Webtor API endpoints
   * Based on SDK structure, tries various API endpoints
   */
  async getStreamFromWebtorAPI(magnetOrTorrentUrl, options) {
    try {
      const { id, baseUrl = WEBTOR_BASE_URL } = options;
      const isMagnet = magnetOrTorrentUrl.startsWith('magnet:');
      
      // Build config object (same structure SDK sends via postMessage)
      const config = {
        id: id || this.generateUUID(),
        mode: 'video',
        magnet: isMagnet ? magnetOrTorrentUrl : null,
        torrentUrl: isMagnet ? null : magnetOrTorrentUrl,
        baseUrl,
        ...options,
      };

      // Try different possible API endpoints
      const apiEndpoints = [
        // Try stream API with POST (simulating postMessage)
        `${baseUrl}/api/stream`,
        // Try player API
        `${baseUrl}/api/player`,
        // Try info API
        `${baseUrl}/api/info`,
        // Try with query params
        isMagnet
          ? `${baseUrl}/api/stream?magnet=${encodeURIComponent(magnetOrTorrentUrl)}`
          : `${baseUrl}/api/stream?torrent=${encodeURIComponent(magnetOrTorrentUrl)}`,
      ];

      for (const apiUrl of apiEndpoints) {
        // Try POST first (like SDK does with postMessage)
        let streamUrl = await this.tryAPIEndpoint(apiUrl, config);
        if (streamUrl) return streamUrl;

        // Try GET
        try {
          const response = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Referer': baseUrl,
            },
          });

          if (response.ok) {
            const data = await response.json();
            // Try different possible response formats
            const url = data?.streamUrl || data?.url || data?.src || data?.stream;
            if (url && this.isValidVideoUrl(url)) {
              return url;
            }
            // If response has files array, get the first video file
            if (data && data.files && Array.isArray(data.files)) {
              const videoFile = data.files.find(f => 
                f.name && /\.(mp4|m4v|mkv|avi|webm|m3u8|mpd)$/i.test(f.name)
              );
              if (videoFile) {
                const fileUrl = videoFile.url || (videoFile.path ? `${baseUrl}${videoFile.path}` : null);
                if (fileUrl && this.isValidVideoUrl(fileUrl)) {
                  return fileUrl;
                }
              }
            }
          }
        } catch (err) {
          // Continue to next endpoint
          continue;
        }
      }
    } catch (error) {
      console.log('Webtor API endpoints not available:', error.message);
    }
    return null;
  },

  /**
   * Validate if URL is a valid magnet link or torrent URL
   */
  isValidTorrentUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // Check if it's a magnet link
    if (url.startsWith('magnet:?')) {
      return url.includes('xt=urn:btih:');
    }
    
    // Check if it's a torrent file URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.includes('.torrent') || url.toLowerCase().includes('torrent');
    }
    
    return false;
  },
};

