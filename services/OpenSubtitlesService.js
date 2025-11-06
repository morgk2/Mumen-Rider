const API_KEY = 'foUmfQElFBpZllitM5zTaKFzX6TMWxum';
const BASE_URL = 'https://api.opensubtitles.com/api/v1';

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
          username: '',
          password: '',
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
  async searchSubtitles(title, language = 'eng') {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Failed to authenticate');
      }

      const url = `${BASE_URL}/subtitles?query=${encodeURIComponent(title)}&languages=${language}&type=movie,episode`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Api-Key': API_KEY,
          'Authorization': `Bearer ${token}`,
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
      
      // Parse results
      const results = [];
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((item) => {
          if (item.attributes) {
            const attrs = item.attributes;
            
            // Handle files array
            if (attrs.files && Array.isArray(attrs.files) && attrs.files.length > 0) {
              attrs.files.forEach((file) => {
                results.push({
                  id: `external-${item.id}-${file.file_id}`,
                  name: attrs.feature_details?.title || attrs.feature_details?.title || title,
                  language: attrs.language || language,
                  languageName: LANGUAGE_CODES[attrs.language] || attrs.language || language,
                  fileId: file.file_id,
                  release: attrs.release || '',
                  format: attrs.format || 'srt',
                  rating: attrs.ratings || 0,
                  downloads: attrs.download_count || 0,
                  rawData: item,
                });
              });
            } else {
              // If no files array, create entry from main attributes
              results.push({
                id: `external-${item.id}`,
                name: attrs.feature_details?.title || attrs.feature_details?.title || title,
                language: attrs.language || language,
                languageName: LANGUAGE_CODES[attrs.language] || attrs.language || language,
                fileId: attrs.files && attrs.files[0]?.file_id ? attrs.files[0].file_id : null,
                release: attrs.release || '',
                format: attrs.format || 'srt',
                rating: attrs.ratings || 0,
                downloads: attrs.download_count || 0,
                rawData: item,
              });
            }
          }
        });
      }

      return results;
    } catch (error) {
      console.error('Error searching OpenSubtitles:', error);
      return [];
    }
  },

  // Download subtitle file
  async downloadSubtitle(fileId) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Failed to authenticate');
      }

      // First get download link
      const linkResponse = await fetch(`${BASE_URL}/download`, {
        method: 'POST',
        headers: {
          'Api-Key': API_KEY,
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Mumen Rider 1.0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
        }),
      });

      if (!linkResponse.ok) {
        const errorText = await linkResponse.text();
        console.error('OpenSubtitles download link error:', errorText);
        throw new Error('Failed to get download link');
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

