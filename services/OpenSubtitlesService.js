const API_KEY = 'foUmfQElFBpZllitM5zTaKFzX6TMWxum';
const BASE_URL = 'https://api.opensubtitles.com/api/v1';
const USERNAME = 'morgk';
const PASSWORD = 'v?y#RH+Fvash77N';

// Language codes mapping
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
      // Clean and prepare search query
      const cleanTitle = title.trim();
      console.log('Searching with query:', cleanTitle, 'Language:', language, 'IMDb:', imdbId);
      
      // If we have an IMDb ID, use it (more accurate)
      let url;
      if (imdbId) {
        const imdbIdClean = imdbId.replace('tt', ''); // Remove 'tt' prefix if present
        url = `${BASE_URL}/subtitles?imdb_id=${imdbIdClean}&languages=${language}`;
        console.log('Searching by IMDb ID:', imdbIdClean);
      } else {
        // Otherwise search by query
        url = `${BASE_URL}/subtitles?query=${encodeURIComponent(cleanTitle)}&languages=${language}`;
      }
      console.log('Search URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Api-Key': API_KEY,
          'User-Agent': 'Mumen Rider 1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenSubtitles search error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('OpenSubtitles API response:', JSON.stringify(data, null, 2));
      console.log('Total results:', data.total_count);
      
      // If no results and we're not using IMDb ID, try different strategies
      if (data.total_count === 0 && !imdbId) {
        console.log('No results found, trying alternative searches...');
        
        // Strategy 1: Try without type filter
        console.log('Trying without type filter...');
        let fallbackUrl = `${BASE_URL}/subtitles?query=${encodeURIComponent(cleanTitle)}&languages=${language}`;
        let fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Api-Key': API_KEY,
            'User-Agent': 'Mumen Rider 1.0',
            'Accept': 'application/json',
          },
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('Without type filter results:', fallbackData.total_count);
          if (fallbackData.total_count > 0) {
            return this.parseSearchResults(fallbackData, cleanTitle, language);
          }
        }
        
        // Strategy 2: Try simplified query
        if (cleanTitle.includes(' ')) {
          const words = cleanTitle.split(' ');
          if (words.length > 1) {
            const simplifiedQuery = words.slice(0, Math.min(2, words.length)).join(' ');
            console.log('Trying simplified query:', simplifiedQuery);
            
            fallbackUrl = `${BASE_URL}/subtitles?query=${encodeURIComponent(simplifiedQuery)}&languages=${language}`;
            fallbackResponse = await fetch(fallbackUrl, {
              method: 'GET',
              headers: {
                'Api-Key': API_KEY,
                'User-Agent': 'Mumen Rider 1.0',
                'Accept': 'application/json',
              },
            });
            
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              console.log('Simplified query results:', fallbackData.total_count);
              if (fallbackData.total_count > 0) {
                return this.parseSearchResults(fallbackData, simplifiedQuery, language);
              }
            }
          }
        }
        
        // Strategy 3: Try with 'all' language to see if language filter is the issue
        console.log('Trying with all languages...');
        fallbackUrl = `${BASE_URL}/subtitles?query=${encodeURIComponent(cleanTitle)}`;
        fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Api-Key': API_KEY,
            'User-Agent': 'Mumen Rider 1.0',
            'Accept': 'application/json',
          },
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('All languages results:', fallbackData.total_count);
          if (fallbackData.total_count > 0) {
            return this.parseSearchResults(fallbackData, cleanTitle, language);
          }
        }
      }
      
      // Parse results
      return this.parseSearchResults(data, cleanTitle, language);
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

