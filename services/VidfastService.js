// Vidfast Service - Streaming source based on vidfast.pro
// Thanks ibro for the TMDB search!

import CryptoJS from 'crypto-js';

const BASE_URL = 'https://vidfast.pro';

// Helper function to fetch with fallback
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null, encoding: 'utf-8' }) {
  try {
    // Try fetchv2 if available (for Sora compatibility)
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
        console.log('fetchv2 failed, using standard fetch');
      }
    }
    
    // Fallback to standard fetch (React Native compatible)
    const fetchOptions = {
      method: options.method ?? 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
        'Referer': BASE_URL,
        'Accept': '*/*',
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

// Helper function for fetchv2 compatibility
async function fetchv2(url, headers = {}, method = 'GET', body = null) {
  const fetchOptions = {
    method: method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
      'Referer': BASE_URL,
      ...headers,
    },
  };
  
  if (body) {
    fetchOptions.body = body;
  }
  
  return await fetch(url, fetchOptions);
}

// Helper function to convert WordArray to Uint8Array
function wordArrayToUint8Array(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  
  return u8;
}

// Helper function to convert Uint8Array to Base64 URL
function uint8ArrayToBase64Url(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  return result
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Check for 4K availability in m3u8 playlist
async function check4KAvailability(m3u8Url) {
  try {
    const headers = {
      "Accept": "*/*",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
      "Referer": BASE_URL
    };
    
    const response = await fetchv2(m3u8Url, headers);
    const playlistContent = await response.text();
    
    const has4K = playlistContent.includes('RESOLUTION=3840x2160');
    
    if (!has4K) {
      console.log(`4K Check for ${m3u8Url}: NO`);
      return { available: false, url: null };
    }
    
    const lines = playlistContent.split('\n');
    let fourKPath = null;
    let fourKCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('RESOLUTION=3840x2160')) {
        fourKCount++;
        if (fourKCount === 2 && i + 1 < lines.length) {
          fourKPath = lines[i + 1].trim();
          break;
        }
      }
    }
    
    if (!fourKPath && fourKCount === 1) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('RESOLUTION=3840x2160')) {
          if (i + 1 < lines.length) {
            fourKPath = lines[i + 1].trim();
            break;
          }
        }
      }
    }
    
    if (!fourKPath) {
      console.log('4K resolution found but could not extract path');
      return { available: false, url: null };
    }
    
    let baseUrl = '';
    if (m3u8Url.startsWith('https://')) {
      const afterProtocol = m3u8Url.substring(8); 
      const hostEnd = afterProtocol.indexOf('/');
      const host = hostEnd !== -1 ? afterProtocol.substring(0, hostEnd) : afterProtocol;
      baseUrl = 'https://' + host;
    } else if (m3u8Url.startsWith('http://')) {
      const afterProtocol = m3u8Url.substring(7); 
      const hostEnd = afterProtocol.indexOf('/');
      const host = hostEnd !== -1 ? afterProtocol.substring(0, hostEnd) : afterProtocol;
      baseUrl = 'http://' + host;
    }
    
    const full4KUrl = fourKPath.startsWith('http') ? fourKPath : `${baseUrl}${fourKPath}`;
    
    return { available: true, url: full4KUrl };
  } catch (error) {
    console.log('Error checking 4K availability: ' + error);
    return { available: false, url: null };
  }
}

// Main function to extract stream from vidfast
async function ilovefeet(imdbId, isSeries = false, season = null, episode = null, preferredFormat = null, selectedServerName = null) {
  const configUrl = 'https://raw.githubusercontent.com/yogesh-hacker/MediaVanced/refs/heads/main/sites/vidfast.py';
  const configResponse = await fetchv2(configUrl);
  const configText = await configResponse.text();

  const keyHexMatch = configText.match(/key_hex\s*=\s*['"]([a-f0-9]+)['"]/);
  const ivHexMatch = configText.match(/iv_hex\s*=\s*['"]([a-f0-9]+)['"]/);
  const xorKeyMatch = configText.match(/xor_key\s*=\s*bytes\.fromhex\(['"]([a-f0-9]+)['"]\)/);
  const staticPathMatch = configText.match(/static_path\s*=\s*['"]([^'"]+)['"]/);
  const sourceCharsMatch = configText.match(/source_chars\s*=\s*['"]([^'"]+)['"]/);
  const targetCharsMatch = configText.match(/target_chars\s*=\s*['"]([^'"]+)['"]/);
  
  const apiServersMatch = configText.match(/api_servers\s*=\s*f?['"]([^'"]+)['"]/);
  const apiStreamMatch = configText.match(/api_stream\s*=\s*f?['"]([^'"]+)['"]/);
  
  const baseUrlMatch = configText.match(/base_url\s*=\s*['"]([^'"]+)['"]/);
  const userAgentMatch = configText.match(/user_agent\s*=\s*['"]([^'"]+)['"]/);
  const csrfTokenMatch = configText.match(/["']X-Csrf-Token["']:\s*["']([^'"]+)['"]/);
  const refererMatch = configText.match(/["']Referer["']:\s*["']([^'"]+)['"]/);

  if (!keyHexMatch || !ivHexMatch || !xorKeyMatch || !staticPathMatch || !sourceCharsMatch || !targetCharsMatch) {
    throw new Error('Failed to extract config values');
  }

  const convertPythonFString = (str) => {
    if (!str) return null;
    return str
      .replace(/\{static_path\}/g, '{STATIC_PATH}')
      .replace(/\{encoded_final\}/g, '{ENCODED_FINAL}')
      .replace(/\{server\}/g, '{SERVER}');
  };

  const config = {
    pageMovie: "https://vidfast.pro/movie/{IMDB_ID}",
    pageSeries: "https://vidfast.pro/tv/{IMDB_ID}/{SEASON}/{EPISODE}",
    apiServers: apiServersMatch ? convertPythonFString(apiServersMatch[1]) : "https://vidfast.pro/{STATIC_PATH}/wfPFjh__qQ/{ENCODED_FINAL}",
    apiStream: apiStreamMatch ? convertPythonFString(apiStreamMatch[1]) : "https://vidfast.pro/{STATIC_PATH}/AddlBFe5/{SERVER}",
    
    aesKeyHex: keyHexMatch[1],
    aesIvHex: ivHexMatch[1],
    xorKeyHex: xorKeyMatch[1],
    staticPath: staticPathMatch[1],
    encodeSrc: sourceCharsMatch[1],
    encodeDst: targetCharsMatch[1]
  };

  let baseUrl;
  if (isSeries) {
    baseUrl = config.pageSeries
      .replace('{IMDB_ID}', imdbId)
      .replace('{SEASON}', season)
      .replace('{EPISODE}', episode);
  } else {
    baseUrl = config.pageMovie.replace('{IMDB_ID}', imdbId);
  }

  let defaultDomain = "https://vidfast.pro/";
  if (baseUrlMatch && baseUrlMatch[1]) {
    const urlParts = baseUrlMatch[1].match(/^(https?:\/\/[^\/]+)/);
    if (urlParts && urlParts[1]) {
      defaultDomain = urlParts[1] + '/';
    }
  }

  const headers = {
    "Accept": "*/*",
    "User-Agent": userAgentMatch ? userAgentMatch[1] : "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    "Referer": refererMatch ? refererMatch[1] : defaultDomain,
    "X-Requested-With": "XMLHttpRequest"
  };
  
  if (csrfTokenMatch && csrfTokenMatch[1]) {
    headers["X-Csrf-Token"] = csrfTokenMatch[1];
  }

  const pageResponse = await fetchv2(baseUrl, headers);
  const pageText = await pageResponse.text();

  let match = pageText.match(/\\"en\\":\\"([^"]+)\\"/);
  if (!match) {
    match = pageText.match(/"en":"([^"]+)"/);
  }
  if (!match) {
    match = pageText.match(/'en':'([^']+)'/);
  }
  if (!match) {
    match = pageText.match(/["']en["']:\s*["']([^"']+)["']/);
  }
  if (!match) {
    throw new Error('Could not find data in page');
  }
  const rawData = match[1];

  const aesKey = CryptoJS.enc.Hex.parse(config.aesKeyHex);
  const aesIv = CryptoJS.enc.Hex.parse(config.aesIvHex);
  
  const encrypted = CryptoJS.AES.encrypt(rawData, aesKey, {
    iv: aesIv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  const encryptedBytes = encrypted.ciphertext;

  const xorKey = CryptoJS.enc.Hex.parse(config.xorKeyHex);
  
  const encryptedArray = wordArrayToUint8Array(encryptedBytes);
  const xorKeyArray = wordArrayToUint8Array(xorKey);
  
  const xorResult = new Uint8Array(encryptedArray.length);
  for (let i = 0; i < encryptedArray.length; i++) {
    xorResult[i] = encryptedArray[i] ^ xorKeyArray[i % xorKeyArray.length];
  }

  const base64Encoded = uint8ArrayToBase64Url(xorResult);

  let encodedFinal = '';
  for (let char of base64Encoded) {
    const index = config.encodeSrc.indexOf(char);
    encodedFinal += index !== -1 ? config.encodeDst[index] : char;
  }
  
  const apiServers = config.apiServers
    .replace('{STATIC_PATH}', config.staticPath)
    .replace('{ENCODED_FINAL}', encodedFinal);

  const serversResponse = await fetchv2(apiServers, headers);
  const serverList = await serversResponse.json();

  if (!serverList || serverList.length === 0) {
    throw new Error('No servers available');
  }

  const testServer = async (serverObj, index) => {
    const server = serverObj.data;
    const apiStream = config.apiStream
      .replace('{STATIC_PATH}', config.staticPath)
      .replace('{SERVER}', server);

    try {
      const streamResponse = await fetchv2(apiStream, headers);
      
      if (streamResponse.status !== 200) {
        throw new Error(`Server ${index} returned status ${streamResponse.status}`);
      }
      
      const streamText = await streamResponse.text();
      
      let data;
      try {
        data = JSON.parse(streamText);
      } catch (e) {
        throw new Error(`Server ${index} returned invalid JSON`);
      }

      if (!data.url) {
        throw new Error(`Server ${index} has no URL`);
      }

      const format = data.url.includes('.m3u8') ? 'm3u8' : data.url.includes('.mpd') ? 'mpd' : 'unknown';
      
      const hasEnglishSubs = data.tracks && Array.isArray(data.tracks) && 
        data.tracks.some(track => track.label && track.label.toLowerCase().includes('english') && track.file);
      

      if (preferredFormat === 'm3u8' && format === 'm3u8' && hasEnglishSubs) {
        return { index, server, success: true, format, data, preferred: true, hasSubtitles: true };
      }
      
      if (preferredFormat === 'm3u8' && format === 'm3u8') {
        return { index, server, success: true, format, data, preferred: true, hasSubtitles: false };
      }
      
      return { index, server, success: true, format, data, preferred: false, hasSubtitles: hasEnglishSubs };
      
    } catch (error) {
      throw new Error(`Server ${index} failed: ${error.message}`);
    }
  };

  let selectedServer = null;
  let vFastServer = null;
  
  // If a specific server is requested, try to use it
  if (selectedServerName) {
    const requestedServerObj = serverList.find(server => 
      server.name && server.name.toLowerCase() === selectedServerName.toLowerCase()
    );
    
    if (requestedServerObj) {
      const requestedIndex = serverList.indexOf(requestedServerObj);
      try {
        selectedServer = await testServer(requestedServerObj, requestedIndex);
        console.log(`Using requested server: ${selectedServerName}`);
      } catch (error) {
        console.log(`Requested server ${selectedServerName} failed: ${error.message}`);
        // Fall through to normal selection
      }
    } else {
      console.log(`Requested server ${selectedServerName} not found in server list`);
      // Fall through to normal selection
    }
  }
  
  // If no server was selected or requested server failed, use normal selection
  if (!selectedServer) {
    try {
      if (preferredFormat === 'm3u8') {
        const serverPromises = serverList.map((serverObj, index) => testServer(serverObj, index));
        
        const vFastServerObj = serverList.find(server => server.name === 'vFast');
        if (vFastServerObj) {
          const vFastIndex = serverList.indexOf(vFastServerObj);
          try {
            vFastServer = await testServer(vFastServerObj, vFastIndex);
          } catch (error) {
            console.log('vFast server failed: ' + error.message);
          }
        } else {
          console.log('vFast server not found in server list');
        }
        
        const raceForSubtitles = new Promise((resolve, reject) => {
          let completedCount = 0;
          let firstWorkingServer = null;
          
          serverPromises.forEach(promise => {
            promise.then(result => {
              completedCount++;
              
              if (result.hasSubtitles) {
                console.log(`Found server ${result.index} with subtitles, stopping other requests`);
                resolve(result);
                return;
              }
              
              if (!firstWorkingServer && result.format === 'm3u8') {
                firstWorkingServer = result;
              }
              
              if (completedCount === serverPromises.length) {
                if (firstWorkingServer) {
                  console.log(`No servers with subtitles found, using fallback server ${firstWorkingServer.index}`);
                  resolve(firstWorkingServer);
                } else {
                  reject(new Error('No working m3u8 servers found'));
                }
              }
            }).catch(() => {
              completedCount++;
              
              if (completedCount === serverPromises.length) {
                if (firstWorkingServer) {
                  console.log(`No servers with subtitles found, using fallback server ${firstWorkingServer.index}`);
                  resolve(firstWorkingServer);
                } else {
                  reject(new Error('No working m3u8 servers found'));
                }
              }
            });
          });
        });
        
        selectedServer = await raceForSubtitles;
        
      } else {
        const serverPromises = serverList.map((serverObj, index) => testServer(serverObj, index));
        
        // Use Promise.allSettled for better compatibility
        const results = await Promise.allSettled(serverPromises);
        const successful = results
          .map((result, index) => result.status === 'fulfilled' ? result.value : null)
          .filter(Boolean);
        
        if (successful.length > 0) {
          selectedServer = successful[0];
          console.log(`Found working server ${selectedServer.index} with format ${selectedServer.format}`);
        } else {
          throw new Error('No working servers found');
        }
      }
    } catch (error) {
      console.log('All servers failed:'+ error);
      throw new Error('No working servers found');
    }
  }

  if (preferredFormat === 'm3u8' && selectedServer.format === 'mpd') {
    selectedServer.data.url = selectedServer.data.url.replace('.mpd', '.m3u8');
    selectedServer.format = 'm3u8';
  }

  let finalUrl = selectedServer.data.url;

  let englishSubtitles = null;
  try {
    if (selectedServer.data.tracks && Array.isArray(selectedServer.data.tracks)) {
      const englishTrack = selectedServer.data.tracks.find(track => 
        track.label && track.label.toLowerCase().includes('english') && track.file
      );
      if (englishTrack) {
        englishSubtitles = englishTrack.file;
      } else {
        console.log('No English subtitle track found in tracks array');
      }
    } else {
      console.log('No tracks array found in server response');
    }
  } catch (error) {
    console.log('Error extracting subtitles:'+ error);
  }

  return {
    defaultUrl: selectedServer.data.url,
    vFastUrl: vFastServer ? vFastServer.data.url : null,
    referer: BASE_URL,
    format: selectedServer.format,
    subtitles: englishSubtitles,
    fullData: selectedServer.data,
    vFastData: vFastServer ? vFastServer.data : null,
    serverList: serverList.map(s => ({ name: s.name, data: s.data })),
    currentServer: serverList[selectedServer.index] ? serverList[selectedServer.index].name : null,
    serverStats: {
      total: serverList.length,
      working: vFastServer ? 2 : 1,
      failed: serverList.length - (vFastServer ? 2 : 1),
      selectedServerIndex: selectedServer.index,
      vFastServerIndex: vFastServer ? vFastServer.index : null
    }
  };
}

// Extract stream URL from vidfast
async function extractStreamUrl(ID, selectedServerName = null) {
  const startTime = Date.now();
  
  try {
    if (ID.includes('movie')) {
      const tmdbID = ID.replace('/movie/', '');
      const headersOne = {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NTQ0MWU0MTg4NjhhMWI0NDZiM2I0Mzg1MmE4OWQ2NyIsIm5iZiI6MTYzMDg4NDI0My40NzMsInN1YiI6IjYxMzU1MTkzZmQ0YTk2MDA0NDVkMTJjNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Hm0W-hUx-7ph-ASvk2TpMxZbMtwVa5DEXWcgNgcqXJM",
          "Referer": "https://player.smashystream.com/",
          "Origin": "https://player.smashystream.com",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/"
      };
      const tmdbResponse = await fetchv2(`https://api.themoviedb.org/3/movie/${tmdbID}?append_to_response=external_ids`, headersOne);
      const tmdbData = await tmdbResponse.json();
      const imdbID = tmdbData.imdb_id;

      if (!imdbID) {
        throw new Error('Could not get IMDB ID from TMDB');
      }

      const streamResponse = await ilovefeet(imdbID, false, null, null, 'm3u8', selectedServerName);

      const streams = [];

      if (streamResponse && streamResponse.defaultUrl) {
        streams.push({ quality: "1080p", url: streamResponse.defaultUrl });
      }
      
      if (streamResponse && streamResponse.vFastUrl) {
        const fourKResult = await check4KAvailability(streamResponse.vFastUrl);
        if (fourKResult.available && fourKResult.url) {
          streams.push({ quality: "4K", url: fourKResult.url });
        }
      }

      const endTime = Date.now();
      const elapsed = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`Stream fetched in ${elapsed}s`);
      
      return {
        streams: streams.map(s => s.url),
        subtitles: streamResponse.subtitles ? [{ 
          id: 'subtitle-0', 
          name: 'English', 
          language: 'en', 
          url: streamResponse.subtitles 
        }] : [],
        serverList: streamResponse.serverList || [],
        currentServer: streamResponse.currentServer || null
      };
    } else if (ID.includes('tv')) {
      const parts = ID.split('/'); 
      const tmdbID = parts[2];
      const seasonNumber = parts[3];
      const episodeNumber = parts[4];
      console.log(`TMDB ID: ${tmdbID}, Season: ${seasonNumber}, Episode: ${episodeNumber}`);
      const headersOne = {
          "Content-Type": "application/json",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NTQ0MWU0MTg4NjhhMWI0NDZiM2I0Mzg1MmE4OWQ2NyIsIm5iZiI6MTYzMDg4NDI0My40NzMsInN1YiI6IjYxMzU1MTkzZmQ0YTk2MDA0NDVkMTJjNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Hm0W-hUx-7ph-ASvk2TpMxZbMtwVa5DEXWcgNgcqXJM",
          "Referer": "https://player.smashystream.com/",
          "Origin": "https://player.smashystream.com",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/"
      };
      const tmdbResponse = await fetchv2(`https://api.themoviedb.org/3/tv/${tmdbID}?append_to_response=external_ids`, headersOne);
      const tmdbData = await tmdbResponse.json();
      const imdbID = tmdbData.external_ids.imdb_id;

      if (!imdbID) {
        throw new Error('Could not get IMDB ID from TMDB');
      }

      const streamResponse = await ilovefeet(imdbID, true, seasonNumber, episodeNumber, 'm3u8', selectedServerName);

      const streams = [];

      if (streamResponse && streamResponse.defaultUrl) {
        streams.push({ quality: "1080p", url: streamResponse.defaultUrl });
      }
      
      if (streamResponse && streamResponse.vFastUrl) {
        const fourKResult = await check4KAvailability(streamResponse.vFastUrl);
        if (fourKResult.available && fourKResult.url) {
          streams.push({ quality: "4K", url: fourKResult.url });
        }
      }

      const endTime = Date.now();
      const elapsed = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`Stream fetched in ${elapsed}s`);
      
      return {
        streams: streams.map(s => s.url),
        subtitles: streamResponse.subtitles ? [{ 
          id: 'subtitle-0', 
          name: 'English', 
          language: 'en', 
          url: streamResponse.subtitles 
        }] : [],
        serverList: streamResponse.serverList || [],
        currentServer: streamResponse.currentServer || null
      };
    }
  } catch (error) {
    console.error('Error extracting stream URL:', error);
    return {
      streams: [],
      subtitles: [],
      serverList: [],
      currentServer: null
    };
  }
}

export const VidfastService = {
  // Get watch URL for movie
  getMovieWatchUrl(tmdbId) {
    return `${BASE_URL}/movie/${tmdbId}`;
  },

  // Get watch URL for TV show episode
  getTVWatchUrl(tmdbId, season, episode) {
    return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
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
    const result = await extractStreamUrl(`/movie/${tmdbId}`);
    return result.streams && result.streams.length > 0 ? result.streams[0] : null;
  },

  // Fetch stream URL for TV episode
  async fetchEpisodeStream(tmdbId, season, episode) {
    const result = await extractStreamUrl(`/tv/${tmdbId}/${season}/${episode}`);
    return result.streams && result.streams.length > 0 ? result.streams[0] : null;
  },

  // Fetch movie with subtitles
  async fetchMovieWithSubtitles(tmdbId, selectedServerName = null) {
    const result = await extractStreamUrl(`/movie/${tmdbId}`, selectedServerName);
    
    // Get the first valid stream URL
    const streamUrl = result.streams && result.streams.length > 0 
      ? result.streams.find(url => url && url.startsWith('http') && (url.includes('.m3u8') || url.includes('.mp4'))) || result.streams[0]
      : null;
    
    return {
      streamUrl: streamUrl,
      subtitles: result.subtitles || [],
      serverList: result.serverList || [],
      currentServer: result.currentServer || null
    };
  },

  // Fetch episode with subtitles
  async fetchEpisodeWithSubtitles(tmdbId, season, episode, selectedServerName = null) {
    const result = await extractStreamUrl(`/tv/${tmdbId}/${season}/${episode}`, selectedServerName);
    
    // Get the first valid stream URL
    const streamUrl = result.streams && result.streams.length > 0 
      ? result.streams.find(url => url && url.startsWith('http') && (url.includes('.m3u8') || url.includes('.mp4'))) || result.streams[0]
      : null;
    
    return {
      streamUrl: streamUrl,
      subtitles: result.subtitles || [],
      serverList: result.serverList || [],
      currentServer: result.currentServer || null
    };
  },
};

