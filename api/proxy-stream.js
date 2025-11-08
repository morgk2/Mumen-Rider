// Vercel serverless function to proxy streaming URL requests
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

  const { url, service } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Set appropriate headers based on service
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    if (service === 'vixsrc') {
      headers['Referer'] = 'https://vixsrc.to/';
    } else if (service === 'n3tflix' || service === 'net3lix') {
      headers['Referer'] = 'https://net3lix.world/';
    }

    // Fetch the URL server-side
    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `HTTP error! status: ${response.status}` 
      });
    }

    // Get the response text (HTML)
    const html = await response.text();

    // Return the HTML content
    res.status(200).json({ html });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch URL' });
  }
}

