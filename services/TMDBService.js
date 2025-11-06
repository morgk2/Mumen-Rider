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
};

