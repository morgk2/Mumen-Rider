const TMDB_API_KEY = '738b4edd0a156cc126dc4a4b8aea4aca';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const VIDEASY_API_URL = 'https://api.videasy.net/cdn/sources-with-title';
const VIDEASY_DECRYPT_URL = 'https://enc-dec.app/api/dec-videasy';

async function safeFetch(url, options = { headers: {}, method: 'GET', body: null, encoding: 'utf-8' }) {
  const { headers = {}, method = 'GET', body = null, encoding = 'utf-8' } = options;

  if (typeof fetchv2 === 'function') {
    try {
      return await fetchv2(url, headers, method, body, true, encoding);
    } catch (error) {
      console.log('[VideasyService] fetchv2 failed, falling back to fetch:', error?.message || error);
    }
  }

  const fetchOptions = {
    method,
    headers,
  };

  if (body) {
    fetchOptions.body = body;
  }

  try {
    return await fetch(url, fetchOptions);
  } catch (error) {
    console.log('[VideasyService] fetch failed:', error?.message || error);
    return null;
  }
}

async function fetchTmdbDetails(mediaType, tmdbId) {
  const endpoint =
    mediaType === 'movie'
      ? `${TMDB_BASE_URL}/movie/${tmdbId}?append_to_response=external_ids&language=en&api_key=${TMDB_API_KEY}`
      : `${TMDB_BASE_URL}/tv/${tmdbId}?append_to_response=external_ids&language=en&api_key=${TMDB_API_KEY}`;

  const response = await safeFetch(endpoint);
  if (!response) {
    throw new Error('Failed to reach TMDB for Videasy');
  }

  const data = await response.json();
  if (!data) {
    throw new Error('TMDB response empty for Videasy');
  }
  return data;
}

function buildVideasyUrl(params) {
  const query = new URLSearchParams(params);
  return `${VIDEASY_API_URL}?${query.toString()}`;
}

async function decryptVideasyPayload(encryptedText, tmdbId) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const body = JSON.stringify({
    text: encryptedText,
    id: String(tmdbId),
  });

  const response = await safeFetch(VIDEASY_DECRYPT_URL, {
    headers,
    method: 'POST',
    body,
  });
  if (!response) {
    throw new Error('Failed to decrypt Videasy payload');
  }

  const data = await response.json();
  if (!data?.result) {
    throw new Error('Videasy decrypt response missing result');
  }

  return data.result;
}

function pickBestSource(sources) {
  if (!sources || sources.length === 0) {
    return null;
  }

  const cleanSources = sources
    .filter((src) => src?.url)
    .filter((src) => !String(src.quality || '').toLowerCase().includes('hdr'));

  if (cleanSources.length === 0) {
    return null;
  }

  const parseQuality = (quality) => {
    const match = String(quality).match(/(\d{3,4})/);
    return match ? parseInt(match[1], 10) : 0;
  };

  cleanSources.sort((a, b) => parseQuality(b.quality) - parseQuality(a.quality));
  return cleanSources[0];
}

function buildSubtitles(subtitles) {
  if (!Array.isArray(subtitles)) {
    return [];
  }

  const englishSubtitle = subtitles.find((sub) =>
    String(sub?.language || '').toLowerCase().includes('english')
  );

  if (!englishSubtitle?.url) {
    return [];
  }

  return [
    {
      id: 'videasy-sub-en',
      name: englishSubtitle.language || 'English',
      language: 'en',
      url: englishSubtitle.url,
    },
  ];
}

async function fetchVideasyStream({ mediaType, tmdbId, season = '1', episode = '1', forceSeasonOne = false }) {
  const tmdbData = await fetchTmdbDetails(mediaType, tmdbId);

  const title =
    mediaType === 'movie'
      ? tmdbData.title || tmdbData.name || tmdbData.original_title
      : tmdbData.name || tmdbData.original_name || tmdbData.title;

  if (!title) {
    throw new Error('TMDB title missing for Videasy');
  }

  const dateString =
    mediaType === 'movie' ? tmdbData.release_date : tmdbData.first_air_date;

  const year = dateString ? new Date(dateString).getFullYear() : '';
  const imdbId = tmdbData?.external_ids?.imdb_id || '';

  const seasonId = forceSeasonOne ? '1' : season;

  const queryParams = {
    title,
    mediaType,
    year,
    tmdbId,
    imdbId,
    seasonId,
    episodeId: episode,
  };

  const videasyUrl = buildVideasyUrl(queryParams);
  const encryptedResponse = await safeFetch(videasyUrl);
  if (!encryptedResponse) {
    throw new Error('Failed to fetch Videasy encrypted payload');
  }
  const encryptedText = await encryptedResponse.text();

  const decrypted = await decryptVideasyPayload(encryptedText, tmdbId);
  const source = pickBestSource(decrypted?.sources || []);

  if (!source?.url) {
    throw new Error('No valid Videasy sources found');
  }

  const subtitles = buildSubtitles(decrypted?.subtitles);

  return {
    streamUrl: source.url,
    subtitles,
  };
}

export const VideasyService = {
  async fetchMovieWithSubtitles(tmdbId) {
    const result = await fetchVideasyStream({ mediaType: 'movie', tmdbId });
    return {
      streamUrl: result.streamUrl,
      subtitles: result.subtitles,
      serverList: [],
      currentServer: null,
      audioTracks: [],
      defaultAudioTrack: null,
    };
  },

  async fetchEpisodeWithSubtitles(tmdbId, season, episodeNumber, { forceSeasonOne = false } = {}) {
    const seasonId = season ? String(season) : '1';
    const episodeId = episodeNumber ? String(episodeNumber) : '1';

    const result = await fetchVideasyStream({
      mediaType: 'tv',
      tmdbId,
      season: seasonId,
      episode: episodeId,
      forceSeasonOne,
    });

    return {
      streamUrl: result.streamUrl,
      subtitles: result.subtitles,
      serverList: [],
      currentServer: null,
      audioTracks: [],
      defaultAudioTrack: null,
    };
  },
};




