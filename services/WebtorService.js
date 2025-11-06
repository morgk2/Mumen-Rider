const WEBTOR_BASE_URL = 'https://webtor.io';

/**
 * WebtorService - Converts magnet links and torrent URLs to streaming URLs
 * Uses Webtor.io embed API to get playable video URLs
 */
export const WebtorService = {
  /**
   * Get streaming URL from magnet link or torrent URL
   * @param {string} magnetOrTorrentUrl - Magnet link (magnet:?xt=...) or torrent file URL
   * @param {object} options - Optional configuration
   * @returns {Promise<string|null>} - Streaming URL or null if failed
   */
  async getStreamingUrl(magnetOrTorrentUrl, options = {}) {
    try {
      const { poster, title, imdbId, path, pwd, file } = options;
      
      // Determine if it's a magnet link or torrent URL
      const isMagnet = magnetOrTorrentUrl.startsWith('magnet:');
      
      // Build embed URL
      let embedUrl;
      if (isMagnet) {
        // For magnet links, use the embed endpoint
        const params = new URLSearchParams();
        params.append('magnet', encodeURIComponent(magnetOrTorrentUrl));
        if (poster) params.append('poster', poster);
        if (title) params.append('title', title);
        if (imdbId) params.append('imdbId', imdbId);
        if (path) params.append('path', path);
        if (pwd) params.append('pwd', pwd);
        if (file) params.append('file', file);
        
        embedUrl = `${WEBTOR_BASE_URL}/embed?${params.toString()}`;
      } else {
        // For torrent URLs
        const params = new URLSearchParams();
        params.append('torrent', encodeURIComponent(magnetOrTorrentUrl));
        if (poster) params.append('poster', poster);
        if (title) params.append('title', title);
        if (imdbId) params.append('imdbId', imdbId);
        if (path) params.append('path', path);
        if (pwd) params.append('pwd', pwd);
        if (file) params.append('file', file);
        
        embedUrl = `${WEBTOR_BASE_URL}/embed?${params.toString()}`;
      }

      // Fetch the embed page
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Referer': WEBTOR_BASE_URL,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Extract streaming URL from the embed page
      // Webtor typically uses iframes or video elements with streaming URLs
      let streamUrl = null;

      // Pattern 1: Look for video source in iframe
      const iframeMatch = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
      if (iframeMatch && iframeMatch[1]) {
        const iframeSrc = iframeMatch[1];
        // If iframe points to another Webtor endpoint, we might need to fetch that
        if (iframeSrc.includes('webtor.io') || iframeSrc.includes('webtorrent')) {
          // Try to extract direct stream URL from iframe content
          streamUrl = await this.extractStreamFromIframe(iframeSrc);
        } else {
          streamUrl = iframeSrc;
        }
      }

      // Pattern 2: Look for video element with source
      if (!streamUrl) {
        const videoMatch = html.match(/<video[^>]+src=['"]([^'"]+)['"]/i);
        if (videoMatch && videoMatch[1]) {
          streamUrl = videoMatch[1];
        }
      }

      // Pattern 3: Look for m3u8 or mp4 URLs in script tags
      if (!streamUrl) {
        const m3u8Patterns = [
          /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/gi,
          /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi,
          /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/gi,
        ];

        for (const pattern of m3u8Patterns) {
          const matches = html.match(pattern);
          if (matches && matches.length > 0) {
            streamUrl = matches.find(m => m.startsWith('http')) || matches[0].replace(/["']/g, '');
            if (streamUrl) {
              break;
            }
          }
        }
      }

      // Pattern 4: Look for Webtor API response in script tags
      if (!streamUrl) {
        const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches) {
          for (const script of scriptMatches) {
            // Look for webtor.push configuration
            const webtorMatch = script.match(/webtor\.push\s*\(\s*\{[^}]*magnet[^}]*\}\s*\)/i);
            if (webtorMatch) {
              // Try to extract stream URL from webtor config
              const urlMatch = script.match(/url\s*:\s*['"]([^'"]+)['"]/i);
              if (urlMatch && urlMatch[1]) {
                streamUrl = urlMatch[1];
                break;
              }
            }

            // Look for streaming URLs in script
            const streamMatch = script.match(/(https?:\/\/[^\s"']+(?:stream|play|video)[^\s"']*)/i);
            if (streamMatch) {
              streamUrl = streamMatch[1];
              break;
            }
          }
        }
      }

      // Pattern 5: Try using Webtor's API directly
      if (!streamUrl) {
        streamUrl = await this.getStreamFromWebtorAPI(magnetOrTorrentUrl, options);
      }

      if (streamUrl) {
        console.log('Extracted streaming URL from Webtor:', streamUrl);
        return streamUrl;
      } else {
        console.warn('Could not extract streaming URL from Webtor embed');
        return null;
      }
    } catch (error) {
      console.error('Error getting streaming URL from Webtor:', error);
      return null;
    }
  },

  /**
   * Extract stream URL from iframe source
   */
  async extractStreamFromIframe(iframeSrc) {
    try {
      const response = await fetch(iframeSrc, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Referer': WEBTOR_BASE_URL,
        },
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      
      // Look for video source
      const videoMatch = html.match(/<video[^>]+src=['"]([^'"]+)['"]/i);
      if (videoMatch) {
        return videoMatch[1];
      }

      // Look for m3u8
      const m3u8Match = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i);
      if (m3u8Match) {
        return m3u8Match[1];
      }

      return null;
    } catch (error) {
      console.error('Error extracting stream from iframe:', error);
      return null;
    }
  },

  /**
   * Try to get stream URL from Webtor API
   */
  async getStreamFromWebtorAPI(magnetOrTorrentUrl, options) {
    try {
      // Webtor might have an API endpoint for getting stream URLs
      // This is a fallback method
      const isMagnet = magnetOrTorrentUrl.startsWith('magnet:');
      
      // Try API endpoint (if available)
      const apiUrl = isMagnet
        ? `${WEBTOR_BASE_URL}/api/stream?magnet=${encodeURIComponent(magnetOrTorrentUrl)}`
        : `${WEBTOR_BASE_URL}/api/stream?torrent=${encodeURIComponent(magnetOrTorrentUrl)}`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.streamUrl) {
          return data.streamUrl;
        }
      }
    } catch (error) {
      console.log('Webtor API not available or failed:', error.message);
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

