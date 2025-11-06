// N3tflix Service - Alternative streaming source
// Based on net3lix.world streaming extraction logic

const BASE_URL = 'https://net3lix.world';

// Helper function to fetch with fallback
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null, encoding: 'utf-8' }) {
  try {
    // Try fetchv2 if available (for Sora compatibility)
    // Note: fetchv2 is a global function that might be available in some environments
    if (typeof fetchv2 !== 'undefined') {
      try {
        return await fetchv2(
          url,
          options.headers ?? {},
          options.method ?? 'GET',
          options.body ?? null,
          true,
          options.encoding ?? 'utf-8'
        );
      } catch (e) {
        // If fetchv2 fails, fall through to standard fetch
        console.log('fetchv2 failed, using standard fetch');
      }
    }
    
    // Fallback to standard fetch (React Native compatible)
    const fetchOptions = {
      method: options.method ?? 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Referer': BASE_URL,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers,
      },
    };
    
    if (options.body) {
      fetchOptions.body = options.body;
    }
    
    const response = await fetch(url, fetchOptions);
    return response;
  } catch (error) {
    console.error('soraFetch error:', error);
    return null;
  }
}

export const N3tflixService = {
  // Get watch URL for movie
  getMovieWatchUrl(tmdbId) {
    return `${BASE_URL}/watch/movie/${tmdbId}`;
  },

  // Get watch URL for TV show episode
  getTVWatchUrl(tmdbId, season, episode) {
    return `${BASE_URL}/watch/tv/${tmdbId}/${season}/${episode}`;
  },

  // Extract stream URL from net3lix.world watch URL
  async extractStreamUrl(url) {
    try {
      const match = url.match(/net3lix\.world\/watch\/(movie|tv)\/(.+)/);
      if (!match) throw new Error('Invalid URL format');
      const [, type, path] = match;

      // Step 1: Get embed URL from cdn.moviesapi.club
      const embedUrl = type === 'movie'
        ? `https://cdn.moviesapi.club/embed/movie/${path}`
        : (() => {
            const [showId, season, episode] = path.split('/');
            return `https://cdn.moviesapi.club/embed/tv/${showId}/${season}/${episode}`;
          })();

      const html = await soraFetch(embedUrl);
      if (!html) throw new Error('Failed to fetch embed page');
      
      const htmlText = await html.text();

      // Extract iframe src from embed page
      const embedRegex = /<iframe[^>]*src="([^"]+)"[^>]*>/g;
      const embedMatches = Array.from(htmlText.matchAll(embedRegex));
      const embedSrc = embedMatches.find(m => m[1] && m[1].trim())?.[1]?.trim();
      
      if (!embedSrc) {
        throw new Error('Could not find embed iframe');
      }

      const completedUrl = embedSrc.startsWith('http') ? embedSrc : `https:${embedSrc}`;
      console.log('Embed URL:', completedUrl);

      // Step 2: Fetch the iframe content
      const html2 = await soraFetch(completedUrl);
      if (!html2) throw new Error('Failed to fetch iframe content');
      
      const html2Text = await html2.text();

      // Extract src from iframe content
      const match2 = html2Text.match(/src:\s*['"]([^'"]+)['"]/);
      if (!match2 || !match2[1]) {
        throw new Error('Could not find video src');
      }
      
      const src = `https://cloudnestra.com${match2[1]}`;
      console.log('Video src:', src);

      // Step 3: Fetch the video source page
      const html3 = await soraFetch(src);
      if (!html3) throw new Error('Failed to fetch video source');
      
      const html3Text = await html3.text();

      // Extract file URL
      const match3 = html3Text.match(/file:\s*['"]([^'"]+)['"]/);
      if (!match3 || !match3[1]) {
        throw new Error('Could not find video file URL');
      }

      // Clean the URL - it might contain multiple URLs separated by " or "
      let cloudStreamUrl = match3[1];
      // Split by " or " and take the first valid URL
      if (cloudStreamUrl.includes(' or ')) {
        const urls = cloudStreamUrl.split(' or ').map(url => url.trim());
        cloudStreamUrl = urls.find(url => url.startsWith('http')) || urls[0];
      }
      // Remove any trailing spaces or invalid characters
      cloudStreamUrl = cloudStreamUrl.trim();
      console.log('CloudStream URL:', cloudStreamUrl);

      // Step 4: Also try vidsrc.su as backup
      const vidsrcEmbedUrl = type === 'movie'
        ? `https://vidsrc.su/embed/movie/${path}`
        : (() => {
            const [showId, season, episode] = path.split('/');
            return `https://vidsrc.su/embed/tv/${showId}/${season}/${episode}`;
          })();

      const data2 = await soraFetch(vidsrcEmbedUrl);
      if (!data2) {
        // If vidsrc fails, return CloudStream URL only
        return {
          streams: [cloudStreamUrl],
          subtitles: []
        };
      }

      const data2Text = await data2.text();
      console.log('Vidsrc data fetched');

      // Extract stream URLs from vidsrc
      const urlRegex = /^(?!\s*\/\/).*url:\s*(['"])(.*?)\1/gm;
      const streamMatches = Array.from(data2Text.matchAll(urlRegex));
      const vidsrcStreams = streamMatches
        .map(m => {
          let url = m[2];
          // Clean URLs that might contain " or " separators
          if (url.includes(' or ')) {
            const urls = url.split(' or ').map(u => u.trim());
            url = urls.find(u => u.startsWith('http')) || urls[0];
          }
          return url.trim();
        })
        .filter(Boolean)
        .filter(url => url.startsWith('http'))
        .filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates

      // Combine streams: CloudStream first, then vidsrc streams
      // Remove duplicates and ensure all URLs are valid
      const allStreams = [cloudStreamUrl, ...vidsrcStreams]
        .filter(url => url && url.startsWith('http'))
        .filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates
      
      const streams = allStreams.length > 0 ? allStreams : [cloudStreamUrl];

      // Extract subtitles
      const subtitleRegex = /"url"\s*:\s*"([^"]+)"[^}]*"format"\s*:\s*"([^"]+)"[^}]*"encoding"\s*:\s*"([^"]+)"[^}]*"display"\s*:\s*"([^"]+)"[^}]*"language"\s*:\s*"([^"]+)"/g;
      
      const subtitleMatches = [];
      let subtitleMatch;
      while ((subtitleMatch = subtitleRegex.exec(data2Text)) !== null) {
        subtitleMatches.push({
          url: subtitleMatch[1],
          format: subtitleMatch[2],
          encoding: subtitleMatch[3],
          display: subtitleMatch[4],
          language: subtitleMatch[5]
        });
      }

      // Find best English subtitle (prefer UTF-8/ASCII)
      let bestSubtitle = subtitleMatches.find(subtitle => 
        subtitle.display.includes('English') && 
        (subtitle.encoding === 'ASCII' || subtitle.encoding === 'UTF-8')
      );

      if (!bestSubtitle) {
        bestSubtitle = subtitleMatches.find(subtitle => 
          subtitle.display.includes('English') && subtitle.encoding === 'CP1252'
        );
      }

      if (!bestSubtitle) {
        bestSubtitle = subtitleMatches.find(subtitle => 
          subtitle.display.includes('English') && subtitle.encoding === 'CP1250'
        );
      }

      if (!bestSubtitle) {
        bestSubtitle = subtitleMatches.find(subtitle => 
          subtitle.display.includes('English') && subtitle.encoding === 'CP850'
        );
      }

      // Format subtitles for the app
      const subtitles = subtitleMatches.map((sub, index) => ({
        id: `subtitle-${index}`,
        name: sub.display || `Subtitle ${index + 1}`,
        language: this.extractLanguage(sub.display),
        url: sub.url,
        encoding: sub.encoding,
      }));

      return {
        streams,
        subtitles: subtitles.length > 0 ? subtitles : (bestSubtitle ? [{
          id: 'subtitle-0',
          name: bestSubtitle.display || 'English',
          language: 'en',
          url: bestSubtitle.url,
          encoding: bestSubtitle.encoding,
        }] : [])
      };
    } catch (error) {
      console.error('Error extracting stream URL:', error);
      return {
        streams: [],
        subtitles: []
      };
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

  // Fetch stream URL for movie
  async fetchMovieStream(tmdbId) {
    const watchUrl = this.getMovieWatchUrl(tmdbId);
    const result = await this.extractStreamUrl(watchUrl);
    return result.streams && result.streams.length > 0 ? result.streams[0] : null;
  },

  // Fetch stream URL for TV episode
  async fetchEpisodeStream(tmdbId, season, episode) {
    const watchUrl = this.getTVWatchUrl(tmdbId, season, episode);
    const result = await this.extractStreamUrl(watchUrl);
    return result.streams && result.streams.length > 0 ? result.streams[0] : null;
  },

  // Fetch movie with subtitles
  async fetchMovieWithSubtitles(tmdbId) {
    const watchUrl = this.getMovieWatchUrl(tmdbId);
    const result = await this.extractStreamUrl(watchUrl);
    
    // Get the first valid stream URL
    const streamUrl = result.streams && result.streams.length > 0 
      ? result.streams.find(url => url && url.startsWith('http') && (url.includes('.m3u8') || url.includes('.mp4') || url.includes('/pl/'))) || result.streams[0]
      : null;
    
    return {
      streamUrl: streamUrl,
      subtitles: result.subtitles || []
    };
  },

  // Fetch episode with subtitles
  async fetchEpisodeWithSubtitles(tmdbId, season, episode) {
    const watchUrl = this.getTVWatchUrl(tmdbId, season, episode);
    const result = await this.extractStreamUrl(watchUrl);
    
    // Get the first valid stream URL
    const streamUrl = result.streams && result.streams.length > 0 
      ? result.streams.find(url => url && url.startsWith('http') && (url.includes('.m3u8') || url.includes('.mp4') || url.includes('/pl/'))) || result.streams[0]
      : null;
    
    return {
      streamUrl: streamUrl,
      subtitles: result.subtitles || []
    };
  },
};

