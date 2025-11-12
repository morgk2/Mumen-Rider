const API_KEY = 'foUmfQElFBpZllitM5zTaKFzX6TMWxum';
const BASE_URL = 'https://api.opensubtitles.com/api/v1';
const USERNAME = 'morgk';
const PASSWORD = 'v?y#RH+Fvash77N';

// Language codes mapping (ISO 639-1 for API, display names)
export const LANGUAGE_CODES = {
  'eng': 'English',
  'spa': 'Spanish',
  'fre': 'French',
  'ger': 'German',
  'ita': 'Italian',
  'por': 'Portuguese',
  'jpn': 'Japanese',
  'kor': 'Korean',
  'chi': 'Chinese',
  'ara': 'Arabic',
  'rus': 'Russian',
  'hin': 'Hindi',
  'dut': 'Dutch',
  'pol': 'Polish',
  'tur': 'Turkish',
};

// Map 3-letter language codes to 2-letter ISO 639-1 codes for API
const LANGUAGE_CODE_MAP = {
  'eng': 'en',
  'spa': 'es',
  'fre': 'fr',
  'ger': 'de',
  'ita': 'it',
  'por': 'pt',
  'jpn': 'ja',
  'kor': 'ko',
  'chi': 'zh',
  'ara': 'ar',
  'rus': 'ru',
  'hin': 'hi',
  'dut': 'nl',
  'pol': 'pl',
  'tur': 'tr',
};

let authToken = null;
let tokenExpiry = null;

export const OpenSubtitlesService = {
  // Get authentication token
  async getAuthToken() {
    try {
      // Return cached token if still valid
      if (authToken && tokenExpiry && Date.now() < tokenExpiry) {
        return authToken;
      }

      const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': API_KEY,
          'User-Agent': 'Mumen Rider 1.0',
        },
        body: JSON.stringify({
          username: USERNAME,
          password: PASSWORD,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenSubtitles auth error:', errorText);
        throw new Error('Failed to authenticate');
      }

      const data = await response.json();
      
      if (data.token) {
        authToken = data.token;
        // Token expires in 24 hours, cache for 23 hours
        tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);
        return authToken;
      }

      throw new Error('No token in response');
    } catch (error) {
      console.error('Error getting auth token:', error);
      authToken = null;
      tokenExpiry = null;
      return null;
    }
  },

  // Search subtitles by title
  async searchSubtitles(title, language = 'eng', imdbId = null) {
    try {
      // Get authentication token (API v1 now requires auth for searches)
      const token = await this.getAuthToken();
      
      // Clean and prepare search query
      const cleanTitle = title.trim();
      
      // Convert 3-letter language code to 2-letter ISO 639-1 code for API
      const apiLanguage = LANGUAGE_CODE_MAP[language] || language.substring(0, 2);
      
      console.log('Searching with query:', cleanTitle, 'Language:', language, 'API Language:', apiLanguage, 'IMDb:', imdbId);
      
      // Prepare headers with authentication
      const headers = {
        'Api-Key': API_KEY,
        'User-Agent': 'Mumen Rider 1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Try multiple strategies
      let searchStrategies = [];
      
      // Strategy 1: If we have IMDb ID, try with it (with and without 'tt' prefix)
      if (imdbId) {
        const imdbIdClean = imdbId.replace(/^tt/, ''); // Remove 'tt' prefix if present
        // Try with IMDb ID and language
        searchStrategies.push({
          name: 'IMDb ID with language',
          url: `${BASE_URL}/subtitles?imdb_id=${imdbIdClean}&languages=${apiLanguage}`,
        });
        // Try with IMDb ID without language filter (in case language code is wrong)
        searchStrategies.push({
          name: 'IMDb ID without language',
          url: `${BASE_URL}/subtitles?imdb_id=${imdbIdClean}`,
        });
        // Try with IMDb ID and original language code
        if (language !== apiLanguage) {
          searchStrategies.push({
            name: 'IMDb ID with original language code',
            url: `${BASE_URL}/subtitles?imdb_id=${imdbIdClean}&languages=${language}`,
          });
        }
      }
      
      // Strategy 2: Search by title with language
      if (cleanTitle) {
        searchStrategies.push({
          name: 'Title with language',
          url: `${BASE_URL}/subtitles?query=${encodeURIComponent(cleanTitle)}&languages=${apiLanguage}`,
        });
        // Try with original language code
        if (language !== apiLanguage) {
          searchStrategies.push({
            name: 'Title with original language code',
            url: `${BASE_URL}/subtitles?query=${encodeURIComponent(cleanTitle)}&languages=${language}`,
          });
        }
        // Try without language filter
        searchStrategies.push({
          name: 'Title without language',
          url: `${BASE_URL}/subtitles?query=${encodeURIComponent(cleanTitle)}`,
        });
      }
      
      // Try each strategy until we get results
      for (const strategy of searchStrategies) {
        try {
          console.log(`Trying strategy: ${strategy.name}`);
          console.log('Search URL:', strategy.url);
          
          const response = await fetch(strategy.url, {
            method: 'GET',
            headers: headers,
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`OpenSubtitles search error (${strategy.name}):`, response.status, errorText);
            
            // If we get 401, try to refresh token and retry
            if (response.status === 401 && token) {
              console.log('Got 401, refreshing token and retrying...');
              authToken = null;
              tokenExpiry = null;
              const newToken = await this.getAuthToken();
              if (newToken) {
                headers['Authorization'] = `Bearer ${newToken}`;
                // Retry once with new token
                const retryResponse = await fetch(strategy.url, {
                  method: 'GET',
                  headers: headers,
                });
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  console.log(`Retry successful for ${strategy.name}, results:`, retryData.total_count);
                  if (retryData.total_count > 0) {
                    return this.parseSearchResults(retryData, cleanTitle, language);
                  }
                }
              }
            }
            continue; // Try next strategy
          }

          const data = await response.json();
          console.log(`OpenSubtitles API response (${strategy.name}):`, JSON.stringify(data, null, 2));
          console.log('Total results:', data.total_count);
          
          if (data.total_count > 0 && data.data && data.data.length > 0) {
            console.log(`Found results with strategy: ${strategy.name}`);
            return this.parseSearchResults(data, cleanTitle, language);
          }
        } catch (error) {
          console.error(`Error with strategy ${strategy.name}:`, error);
          continue; // Try next strategy
        }
      }
      
      // If all strategies failed, return empty array
      console.log('All search strategies returned no results');
      return [];
    } catch (error) {
      console.error('Error searching OpenSubtitles:', error);
      return [];
    }
  },

  // Parse search results from API response
  parseSearchResults(data, title, language) {
    const results = [];
    if (data.data && Array.isArray(data.data)) {
      console.log('Found', data.data.length, 'items in response');
      data.data.forEach((item) => {
        if (item.attributes) {
          const attrs = item.attributes;
          
          // Handle files array - check different possible structures
          let fileId = null;
          let files = attrs.files;
          
          // Check if files is an array
          if (files && Array.isArray(files) && files.length > 0) {
            fileId = files[0].file_id || files[0].id || null;
          } else if (attrs.file_id) {
            // Sometimes file_id is directly on attributes
            fileId = attrs.file_id;
          } else if (attrs.files && typeof attrs.files === 'object' && attrs.files.file_id) {
            // Sometimes files is a single object
            fileId = attrs.files.file_id;
          }
          
          // Get title from various possible locations
          const subtitleTitle = attrs.feature_details?.title || 
                               attrs.feature_details?.movie_name ||
                               attrs.movie_name ||
                               attrs.title ||
                               title;
          
          // Only add result if we have a fileId
          if (fileId) {
            results.push({
              id: `external-${item.id}-${fileId}`,
              name: subtitleTitle,
              language: attrs.language || language,
              languageName: LANGUAGE_CODES[attrs.language] || attrs.language || language,
              fileId: fileId,
              release: attrs.release || attrs.release_info || '',
              format: attrs.format || 'srt',
              rating: attrs.ratings || attrs.rating || 0,
              downloads: attrs.download_count || attrs.downloads || 0,
              rawData: item,
            });
          } else {
            console.log('Skipping item without fileId:', item.id, attrs);
          }
        }
      });
      console.log('Parsed', results.length, 'subtitle results');
    } else {
      console.log('No data array in response or data is not an array');
    }
    
    return results;
  },

  // Download subtitle file
  async downloadSubtitle(fileId) {
    try {
      // For downloads, we need authentication
      // Try to get token, but if it fails, we'll try without it (some endpoints might work)
      const token = await this.getAuthToken();
      
      const headers = {
        'Api-Key': API_KEY,
        'User-Agent': 'Mumen Rider 1.0',
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // First get download link
      const linkResponse = await fetch(`${BASE_URL}/download`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          file_id: fileId,
        }),
      });

      if (!linkResponse.ok) {
        // If we get 401 and didn't have a token, try alternative approach
        if (linkResponse.status === 401 && !token) {
          // Try using the file_id directly to construct a download URL
          // Some OpenSubtitles endpoints allow direct file access
          try {
            const directUrl = `https://api.opensubtitles.com/api/v1/download?file_id=${fileId}`;
            const directResponse = await fetch(directUrl, {
              headers: {
                'Api-Key': API_KEY,
                'User-Agent': 'Mumen Rider 1.0',
              },
            });
            
            if (directResponse.ok) {
              const directData = await directResponse.json();
              if (directData.link) {
                const fileResponse = await fetch(directData.link, {
                  headers: {
                    'User-Agent': 'Mumen Rider 1.0',
                  },
                });
                if (fileResponse.ok) {
                  return await fileResponse.text();
                }
              }
            }
          } catch (directError) {
            console.error('Direct download attempt failed:', directError);
          }
        }
        
        const errorText = await linkResponse.text();
        console.error('OpenSubtitles download link error:', errorText);
        throw new Error('Failed to get download link. Note: Downloads may require OpenSubtitles account credentials.');
      }

      const linkData = await linkResponse.json();
      
      if (linkData.link) {
        // Fetch the actual subtitle file
        const fileResponse = await fetch(linkData.link, {
          headers: {
            'User-Agent': 'Mumen Rider 1.0',
          },
        });

        if (!fileResponse.ok) {
          throw new Error('Failed to download subtitle file');
        }

        const fileText = await fileResponse.text();
        return fileText;
      }

      throw new Error('No download link received');
    } catch (error) {
      console.error('Error downloading subtitle:', error);
      return null;
    }
  },
};

