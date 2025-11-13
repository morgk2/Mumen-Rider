const API_KEY = '738b4edd0a156cc126dc4a4b8aea4aca';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export const TMDBService = {
  // Fetch trending movies
  async fetchTrendingMovies() {
    try {
      const response = await fetch(
        `${BASE_URL}/trending/movie/day?api_key=${API_KEY}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching trending movies:', error);
      return [];
    }
  },

  // Fetch trending TV shows
  async fetchTrendingTV() {
    try {
      const response = await fetch(
        `${BASE_URL}/trending/tv/day?api_key=${API_KEY}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching trending TV:', error);
      return [];
    }
  },

  // Fetch trending anime (using discover with genre filter)
  async fetchTrendingAnime() {
    try {
      const response = await fetch(
        `${BASE_URL}/discover/tv?api_key=${API_KEY}&with_genres=16&sort_by=popularity.desc&with_original_language=ja`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching trending anime:', error);
      return [];
    }
  },

  // Get poster URL
  getPosterURL(posterPath, size = 'w500') {
    if (!posterPath) return null;
    return `${IMAGE_BASE_URL}/${size}${posterPath}`;
  },

  // Get backdrop URL
  getBackdropURL(backdropPath, size = 'w1280') {
    if (!backdropPath) return null;
    return `${IMAGE_BASE_URL}/${size}${backdropPath}`;
  },

  // Fetch TV show episodes for a season
  async fetchTVEpisodes(tvId, seasonNumber = 1) {
    try {
      const response = await fetch(
        `${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${API_KEY}`
      );
      const data = await response.json();
      return data.episodes || [];
    } catch (error) {
      console.error('Error fetching TV episodes:', error);
      return [];
    }
  },

  // Fetch TV show details including seasons
  async fetchTVDetails(tvId) {
    try {
      const response = await fetch(
        `${BASE_URL}/tv/${tvId}?api_key=${API_KEY}`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching TV details:', error);
      return null;
    }
  },

  // Get still image URL (for episode thumbnails)
  getStillURL(stillPath, size = 'w300') {
    if (!stillPath) return null;
    return `${IMAGE_BASE_URL}/${size}${stillPath}`;
  },

  // Fetch cast for movie or TV show
  async fetchCast(mediaType, mediaId) {
    try {
      const response = await fetch(
        `${BASE_URL}/${mediaType}/${mediaId}/credits?api_key=${API_KEY}`
      );
      const data = await response.json();
      return data.cast || [];
    } catch (error) {
      console.error('Error fetching cast:', error);
      return [];
    }
  },

  // Get profile image URL (for cast photos)
  getProfileURL(profilePath, size = 'w185') {
    if (!profilePath) return null;
    return `${IMAGE_BASE_URL}/${size}${profilePath}`;
  },

  // Fetch reviews for movie or TV show
  async fetchReviews(mediaType, mediaId) {
    try {
      const response = await fetch(
        `${BASE_URL}/${mediaType}/${mediaId}/reviews?api_key=${API_KEY}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching reviews:', error);
      return [];
    }
  },

  // Search for movies and TV shows
  async searchMulti(query, page = 1) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodedQuery}&page=${page}`
      );
      const data = await response.json();
      return {
        results: data.results || [],
        totalPages: data.total_pages || 1,
        page: data.page || 1,
      };
    } catch (error) {
      console.error('Error searching:', error);
      return { results: [], totalPages: 1, page: 1 };
    }
  },

  // Fetch videos (trailers) for movie or TV show
  async fetchVideos(mediaType, mediaId) {
    try {
      const response = await fetch(
        `${BASE_URL}/${mediaType}/${mediaId}/videos?api_key=${API_KEY}`
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching videos:', error);
      return [];
    }
  },

  // Get YouTube trailer URL from video key
  getYouTubeTrailerUrl(key) {
    if (!key) return null;
    return `https://www.youtube.com/watch?v=${key}`;
  },

  // Get YouTube embed URL from video key
  getYouTubeEmbedUrl(key) {
    if (!key) return null;
    return `https://www.youtube.com/embed/${key}`;
  },

  // Fetch top rated movies (up to 400)
  async fetchTopRatedMovies(maxResults = 400) {
    try {
      const allMovies = [];
      const pagesToFetch = Math.ceil(maxResults / 20); // 20 results per page
      
      for (let page = 1; page <= pagesToFetch && allMovies.length < maxResults; page++) {
        const response = await fetch(
          `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&page=${page}`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          allMovies.push(...data.results);
        } else {
          break; // No more pages
        }
      }
      
      return allMovies.slice(0, maxResults);
    } catch (error) {
      console.error('Error fetching top rated movies:', error);
      return [];
    }
  },

  // Fetch top rated TV shows (up to 400)
  async fetchTopRatedTV(maxResults = 400) {
    try {
      const allShows = [];
      const pagesToFetch = Math.ceil(maxResults / 20); // 20 results per page
      
      for (let page = 1; page <= pagesToFetch && allShows.length < maxResults; page++) {
        const response = await fetch(
          `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&page=${page}`
        );
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          allShows.push(...data.results);
        } else {
          break; // No more pages
        }
      }
      
      return allShows.slice(0, maxResults);
    } catch (error) {
      console.error('Error fetching top rated TV shows:', error);
      return [];
    }
  },
};

