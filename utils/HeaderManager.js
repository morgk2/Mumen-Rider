/**
 * Header Manager - Manages HTTP headers for streaming requests
 * Based on Sora's header management logic
 */

export class HeaderManager {
  /**
   * Standard headers needed for most streaming sites
   */
  static getStandardHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
  }

  /**
   * Ensure that necessary headers for streaming are present
   * @param {Object} headers - Original headers
   * @param {string} url - URL being requested
   * @returns {Object} Headers with necessary streaming headers added
   */
  static ensureStreamingHeaders(headers = {}, url) {
    const updatedHeaders = { ...headers };

    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      // Ensure Origin header
      if (!updatedHeaders['Origin'] && !updatedHeaders['origin']) {
        updatedHeaders['Origin'] = baseUrl;
      }

      // Ensure Referer header
      if (!updatedHeaders['Referer'] && !updatedHeaders['referer']) {
        updatedHeaders['Referer'] = baseUrl;
      }

      // Ensure User-Agent header
      if (!updatedHeaders['User-Agent'] && !updatedHeaders['user-agent']) {
        updatedHeaders['User-Agent'] = this.getStandardHeaders()['User-Agent'];
      }

      // Add additional common streaming headers
      const standardHeaders = this.getStandardHeaders();
      for (const [key, value] of Object.entries(standardHeaders)) {
        if (!updatedHeaders[key] && !updatedHeaders[key.toLowerCase()]) {
          updatedHeaders[key] = value;
        }
      }
    } catch (error) {
      console.error('Error ensuring streaming headers:', error);
    }

    return updatedHeaders;
  }

  /**
   * Combine headers from different sources
   * @param {Object} originalHeaders - Original headers
   * @param {Object} streamHeaders - Stream-specific headers
   * @param {string} url - URL being requested
   * @returns {Object} Combined headers
   */
  static combineHeaders(originalHeaders = {}, streamHeaders = {}, url) {
    const combinedHeaders = { ...streamHeaders };

    // Add original headers for keys not already present
    for (const [key, value] of Object.entries(originalHeaders)) {
      if (!combinedHeaders[key] && !combinedHeaders[key.toLowerCase()]) {
        combinedHeaders[key] = value;
      }
    }

    // Ensure all critical headers are present
    return this.ensureStreamingHeaders(combinedHeaders, url);
  }

  /**
   * Log headers for debugging
   * @param {Object} headers - Headers to log
   * @param {string} url - URL being requested
   * @param {string} operation - Operation being performed
   */
  static logHeaders(headers, url, operation = 'Request') {
    if (__DEV__) {
      console.log(`[HeaderManager] ${operation} ${url}`);
      console.log('[HeaderManager] Headers:', JSON.stringify(headers, null, 2));
    }
  }
}

export default HeaderManager;



