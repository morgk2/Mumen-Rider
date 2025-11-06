const BASE_URL = 'https://vixsrc.to';

export const VixsrcService = {
  // Get embed URL for movie
  getMovieEmbedUrl(tmdbId) {
    return `${BASE_URL}/movie/${tmdbId}`;
  },

  // Get embed URL for TV show episode
  getTVEmbedUrl(tmdbId, season, episode) {
    return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
  },

  // Fetch video stream URL from embed page
  // Uses the proven extraction logic from Sora project
  async fetchStreamUrl(embedUrl) {
    try {
      const response = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Referer': 'https://vixsrc.to/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      
      let stream = null;

      // Pattern 1: Check for window.masterPlaylist (most reliable)
      if (html.includes('window.masterPlaylist') || html.includes('masterPlaylist')) {
        // Try multiple regex patterns for url
        const urlPatterns = [
          /url\s*:\s*['"]([^'"]+)['"]/,
          /url:\s*['"]([^'"]+)['"]/,
          /['"]url['"]\s*:\s*['"]([^'"]+)['"]/,
          /url['"]?\s*:\s*['"]([^'"]+)['"]/,
        ];
        
        let baseUrl = null;
        for (const pattern of urlPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            baseUrl = match[1];
            break;
          }
        }
        
        // Try multiple regex patterns for token
        const tokenPatterns = [
          /token\s*:\s*['"]([^'"]+)['"]/,
          /['"]token['"]\s*:\s*['"]([^'"]+)['"]/,
          /token['"]?\s*:\s*['"]([^'"]+)['"]/,
        ];
        
        let token = null;
        for (const pattern of tokenPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            token = match[1];
            break;
          }
        }
        
        // Try multiple regex patterns for expires
        const expiresPatterns = [
          /expires\s*:\s*['"]([^'"]+)['"]/,
          /['"]expires['"]\s*:\s*['"]([^'"]+)['"]/,
          /expires['"]?\s*:\s*['"]([^'"]+)['"]/,
        ];
        
        let expires = null;
        for (const pattern of expiresPatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            expires = match[1];
            break;
          }
        }

        if (baseUrl && token && expires) {
          if (baseUrl.includes('?b=1')) {
            stream = `${baseUrl}&token=${token}&expires=${expires}&h=1&lang=en`;
          } else {
            stream = `${baseUrl}?token=${token}&expires=${expires}&h=1&lang=en`;
          }
          console.log('Extracted stream from masterPlaylist:', stream);
        } else {
          console.log('masterPlaylist found but missing params:', { baseUrl: !!baseUrl, token: !!token, expires: !!expires });
        }
      }

      // Pattern 2: Fallback to direct m3u8 match (more flexible patterns)
      if (!stream) {
        const m3u8Patterns = [
          /(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/gi,
          /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/gi,
          /(https?:\/\/[^;]+\.m3u8)/gi,
        ];
        
        for (const pattern of m3u8Patterns) {
          const matches = html.match(pattern);
          if (matches && matches.length > 0) {
            // Get the first match, prefer the one without quotes
            stream = matches.find(m => m.startsWith('http')) || matches[0].replace(/["']/g, '');
            if (stream) {
              console.log('Extracted m3u8 URL:', stream);
              break;
            }
          }
        }
      }

      // Pattern 3: Look in script tags (more comprehensive)
      if (!stream) {
        const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (scriptMatches) {
          for (const script of scriptMatches) {
            // Look for m3u8 in script
            const m3u8Match = script.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/i);
            if (m3u8Match) {
              stream = m3u8Match[1];
              console.log('Extracted stream from script tag:', stream);
              break;
            }
            
            // Look for playlist
            const playlistMatch = script.match(/(https?:\/\/[^\s"']+(?:playlist|master)[^\s"']*)/i);
            if (playlistMatch) {
              stream = playlistMatch[1];
              console.log('Extracted playlist from script tag:', stream);
              break;
            }
          }
        }
      }

      // Pattern 4: Look for video source patterns (more flexible)
      if (!stream) {
        const videoPatterns = [
          /(?:src|source|url)['"]?\s*[:=]\s*['"]?(https?:\/\/[^'"\s]+(?:\.mp4|\.m3u8|\.mpd)[^'"\s]*)/i,
          /(?:file|stream|video)['"]?\s*[:=]\s*['"]?(https?:\/\/[^'"\s]+(?:\.mp4|\.m3u8|\.mpd)[^'"\s]*)/i,
        ];
        
        for (const pattern of videoPatterns) {
          const match = html.match(pattern);
          if (match) {
            stream = match[2] || match[1];
            console.log('Extracted stream from video pattern:', stream);
            break;
          }
        }
      }

      if (stream) {
        // expo-av can handle m3u8 (HLS) playlists directly, so we return them as-is
        // The playlist URL works in browser/VLC, so it should work with expo-av too
        if (stream.includes('/playlist/') || stream.includes('.m3u8')) {
          console.log('HLS playlist URL found, using directly:', stream);
          return stream;
        }
        // If it's already a direct mp4 or stream URL, return it
        return stream;
      } else {
        console.warn('No stream URL found in embed page');
        console.log('HTML preview (first 2000 chars):', html.substring(0, 2000));
        return null;
      }
    } catch (error) {
      console.error('Error fetching stream URL:', error);
      return null;
    }
  },

  // Fetch subtitles from sub.wyzie.ru
  async fetchSubtitles(tmdbId, season = null, episode = null) {
    try {
      let url;
      if (season !== null && episode !== null) {
        url = `https://sub.wyzie.ru/search?id=${tmdbId}&season=${season}&episode=${episode}`;
      } else {
        url = `https://sub.wyzie.ru/search?id=${tmdbId}`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Failed to fetch subtitles:', response.status);
        return [];
      }

      const data = await response.json();
      
      // Parse subtitle tracks
      const tracks = [];
      if (Array.isArray(data)) {
        data.forEach((track, index) => {
          tracks.push({
            id: `subtitle-${index}`,
            name: track.display || `Subtitle ${index + 1}`,
            language: this.extractLanguage(track.display),
            url: track.url,
            encoding: track.encoding,
          });
        });
      }

      return tracks;
    } catch (error) {
      console.error('Error fetching subtitles:', error);
      return [];
    }
  },

  // Extract language from subtitle display name
  extractLanguage(display) {
    if (!display) return 'unknown';
    const lower = display.toLowerCase();
    if (lower.includes('english')) return 'en';
    if (lower.includes('spanish')) return 'es';
    if (lower.includes('french')) return 'fr';
    if (lower.includes('german')) return 'de';
    if (lower.includes('italian')) return 'it';
    if (lower.includes('portuguese')) return 'pt';
    if (lower.includes('japanese')) return 'ja';
    if (lower.includes('chinese')) return 'zh';
    if (lower.includes('korean')) return 'ko';
    if (lower.includes('arabic')) return 'ar';
    if (lower.includes('russian')) return 'ru';
    return 'unknown';
  },

  // Fetch stream and subtitles for movie
  async fetchMovieStream(tmdbId) {
    const embedUrl = this.getMovieEmbedUrl(tmdbId);
    const streamUrl = await this.fetchStreamUrl(embedUrl);
    return streamUrl;
  },

  // Fetch stream and subtitles for TV episode
  async fetchEpisodeStream(tmdbId, season, episode) {
    const embedUrl = this.getTVEmbedUrl(tmdbId, season, episode);
    const streamUrl = await this.fetchStreamUrl(embedUrl);
    return streamUrl;
  },

  // Fetch movie with subtitles
  async fetchMovieWithSubtitles(tmdbId) {
    const streamUrl = await this.fetchMovieStream(tmdbId);
    const subtitles = await this.fetchSubtitles(tmdbId);
    return { streamUrl, subtitles };
  },

  // Fetch episode with subtitles
  async fetchEpisodeWithSubtitles(tmdbId, season, episode) {
    const streamUrl = await this.fetchEpisodeStream(tmdbId, season, episode);
    const subtitles = await this.fetchSubtitles(tmdbId, season, episode);
    return { streamUrl, subtitles };
  },
};
