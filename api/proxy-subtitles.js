// Vercel serverless function to proxy subtitle API requests
// This bypasses CORS restrictions by fetching server-side

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Create abort controller for timeout (declared outside try for catch access)
  const controller = new AbortController();
  let timeoutId = null;
  
  try {
    // Decode URL to prevent double encoding
    const decodedUrl = decodeURIComponent(url);
    
    // Set timeout to abort request after 10 seconds
    timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Fetch the subtitle API endpoint server-side
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://sub.wyzie.ru/',
      },
      signal: controller.signal,
    });
    
    // Clear timeout if request succeeds
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (!response.ok) {
      // Return the error status but with proper CORS headers
      return res.status(response.status).json({ 
        error: `HTTP error! status: ${response.status}`,
        status: response.status
      });
    }

    // Get the JSON response
    const data = await response.json();

    // Return the data
    return res.status(200).json(data);
  } catch (error) {
    // Clear timeout in case of error
    if (timeoutId) clearTimeout(timeoutId);
    
    // Handle timeout or network errors
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.error('Subtitle proxy timeout:', error);
      return res.status(504).json({ 
        error: 'Request timeout',
        message: 'The subtitle API did not respond in time'
      });
    }
    
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch subtitles',
      message: 'An error occurred while fetching subtitles'
    });
  }
}

