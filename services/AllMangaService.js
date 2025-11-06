export const AllMangaService = {
  BASE_URL: 'https://mangapark.net',
  
  // Get headers for mangapark.net
  getHeaders(referer = null) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    };
    
    if (referer) {
      headers['Referer'] = referer;
    }
    
    return headers;
  },
  
  // Search for manga on mangapark.net
  async searchManga(query) {
    try {
      // Format: https://mangapark.net/search?word=chainsaw%20man
      const searchUrl = `${this.BASE_URL}/search?word=${encodeURIComponent(query)}`;
      console.log('[AllManga] Searching for:', query, 'URL:', searchUrl);
      
      const response = await fetch(searchUrl, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        console.error('[AllManga] HTTP error! status:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      console.log('[AllManga] Search HTML length:', html.length);
      
      // Parse HTML to find manga results
      const results = [];
      
      // Look for manga links in mangapark format: /title/74763-en-chainsaw-man
      const titleLinkRegex = /href=["'](\/title\/[^"']+)["']/gi;
      const mangaLinks = [];
      let linkMatch;
      
      while ((linkMatch = titleLinkRegex.exec(html)) !== null) {
        const href = linkMatch[1];
        // Extract manga ID from URL (e.g., /title/74763-en-chainsaw-man -> 74763)
        const idMatch = href.match(/\/title\/(\d+)/);
        if (idMatch) {
          const mangaId = idMatch[1];
          if (!mangaLinks.find(l => l.id === mangaId)) {
            const fullUrl = `${this.BASE_URL}${href}`;
            mangaLinks.push({ href: fullUrl, id: mangaId, index: linkMatch.index });
          }
        }
      }
      
      console.log('[AllManga] Found', mangaLinks.length, 'potential manga links');
      
      // For each manga link, extract title and image from context
      for (const link of mangaLinks.slice(0, 10)) {
        const contextStart = Math.max(0, link.index - 1000);
        const contextEnd = Math.min(html.length, link.index + 2000);
        const context = html.substring(contextStart, contextEnd);
        
        // Extract title - look for text near the link
        let title = null;
        
        // Method 1: Look for title in link text or nearby
        const titleMatch = context.match(/<a[^>]+href=["']\/title\/[^"']+["'][^>]*>([^<]+)<\/a>/i) ||
                          context.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) ||
                          context.match(/title=["']([^"']+)["']/i);
        
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
        
        // Method 2: Look for alt text in images
        if (!title) {
          const altMatch = context.match(/alt=["']([^"']+)["']/i);
          if (altMatch && altMatch[1].length > 3) {
            title = altMatch[1].trim();
          }
        }
        
        // Extract image URL
        let imageUrl = null;
        const imgMatch = context.match(/<img[^>]+src=["']([^"']+)["']/i) || 
                        context.match(/<img[^>]+data-src=["']([^"']+)["']/i);
        if (imgMatch && !imgMatch[1].includes('base64') && !imgMatch[1].startsWith('data:')) {
          imageUrl = imgMatch[1];
          if (!imageUrl.startsWith('http')) {
            imageUrl = imageUrl.startsWith('/') ? `${this.BASE_URL}${imageUrl}` : `${this.BASE_URL}/${imageUrl}`;
          }
        }
        
        // Use ID as fallback title
        if (!title || title.length < 2) {
          title = link.id;
        }
        
        // Skip if title looks like navigation
        if (title.toLowerCase().includes('home') || title.toLowerCase().includes('search') || 
            title.toLowerCase().includes('mangapark')) {
          continue;
        }
        
        results.push({
          id: link.id,
          url: link.href,
          title: title.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim(),
          imageUrl: imageUrl,
        });
        
        console.log('[AllManga] Found result:', title, link.href);
      }
      
      console.log('[AllManga] Total results found:', results.length);
      return results;
    } catch (error) {
      console.error('[AllManga] Error searching mangapark.net:', error);
      return [];
    }
  },

  // Fetch chapters from a manga page
  async fetchChapters(mangaUrl) {
    try {
      console.log('[AllManga] Fetching chapters from:', mangaUrl);
      
      const response = await fetch(mangaUrl, {
        headers: this.getHeaders(this.BASE_URL),
      });
      
      if (!response.ok) {
        console.error('[AllManga] HTTP error! status:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      console.log('[AllManga] HTML length:', html.length);
      
      // Parse chapters from HTML
      const chapters = [];
      const seenChapters = new Set();
      
      // Extract manga ID from URL (e.g., /title/74763-en-chainsaw-man -> 74763)
      const mangaIdMatch = mangaUrl.match(/\/title\/(\d+)/);
      const mangaId = mangaIdMatch ? mangaIdMatch[1] : null;
      console.log('[AllManga] Manga ID from URL:', mangaId);
      
      // Pattern 1: Look for chapter links in mangapark format: /title/74763-en-chainsaw-man/9916818-chapter-219
      console.log('[AllManga] Trying pattern 1: chapter links');
      const chapterLinkRegex = /href=["'](\/title\/[^"']+\/(\d+)-chapter[_-]?(\d+))["']/gi;
      let chapterMatch;
      
      while ((chapterMatch = chapterLinkRegex.exec(html)) !== null) {
        const href = chapterMatch[1];
        const chapterId = chapterMatch[2];
        const chapterNum = parseInt(chapterMatch[3]) || 0;
        
        if (chapterNum > 0 && !seenChapters.has(chapterNum)) {
          seenChapters.add(chapterNum);
          
          // Extract chapter title from surrounding text
          const contextStart = Math.max(0, chapterMatch.index - 300);
          const contextEnd = Math.min(html.length, chapterMatch.index + 500);
          const context = html.substring(contextStart, contextEnd);
          
          let title = `Chapter ${chapterNum}`;
          const titleMatch = context.match(/Ch\.(\d+):\s*([^<]+)/i) ||
                            context.match(/>([^<]*chapter[^<]*\d+[^<]*)</i) ||
                            context.match(/title=["']([^"']+)["']/i);
          if (titleMatch && titleMatch[2]) {
            title = titleMatch[2].trim();
          } else if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
          }
          
          const fullUrl = `${this.BASE_URL}${href}`;
          
          chapters.push({
            id: chapterId,
            number: chapterNum,
            title: title,
            url: fullUrl,
            date: null,
          });
          
          console.log('[AllManga] Found chapter:', chapterNum, title);
        }
      }
      
      // Pattern 2: Alternative pattern for chapter links
      if (chapters.length === 0) {
        console.log('[AllManga] Trying pattern 2: alternative chapter links');
        const altChapterRegex = /href=["'](\/title\/[^"']+\/\d+-chapter[_-]?(\d+))["']/gi;
        let altMatch;
        
        while ((altMatch = altChapterRegex.exec(html)) !== null) {
          const href = altMatch[1];
          const chapterNum = parseInt(altMatch[2]) || 0;
          
          if (chapterNum > 0 && !seenChapters.has(chapterNum)) {
            seenChapters.add(chapterNum);
            
            const fullUrl = `${this.BASE_URL}${href}`;
            
            chapters.push({
              id: href.split('/').pop(),
              number: chapterNum,
              title: `Chapter ${chapterNum}`,
              url: fullUrl,
              date: null,
            });
          }
        }
      }
      
      console.log('[AllManga] Total chapters found:', chapters.length);
      
      // Sort chapters by number (descending - newest first)
      chapters.sort((a, b) => b.number - a.number);
      
      console.log('[AllManga] Chapters range:', chapters.length > 0 ? `${chapters[chapters.length - 1].number} to ${chapters[0].number}` : 'none');
      
      return chapters;
    } catch (error) {
      console.error('[AllManga] Error fetching chapters from mangapark.net:', error);
      return [];
    }
  },

  // Fetch chapter pages (images) from a chapter URL
  async fetchChapterPages(chapterUrl) {
    try {
      console.log('[AllManga] Fetching chapter pages from:', chapterUrl);
      
      const response = await fetch(chapterUrl, {
        headers: this.getHeaders(this.BASE_URL),
      });
      
      if (!response.ok) {
        console.error('[AllManga] HTTP error! status:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      console.log('[AllManga] Chapter HTML length:', html.length);
      
      // Parse page images from HTML
      const pages = [];
      
      // Mangapark uses Qwik framework with SSR - look for JSON data embedded in the page
      console.log('[AllManga] Looking for embedded JSON data...');
      
      // Pattern 1: Look for image URLs directly in the HTML (any format)
      const urlPattern = /https?:\/\/s\d+\.mp[a-z]+\.org\/media\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi;
      let urlMatch;
      const foundUrls = new Set();
      
      while ((urlMatch = urlPattern.exec(html)) !== null) {
        const imageUrl = urlMatch[0];
        
        if (!foundUrls.has(imageUrl)) {
          foundUrls.add(imageUrl);
          
          // Try to find page number near this URL
          const contextStart = Math.max(0, urlMatch.index - 500);
          const contextEnd = Math.min(html.length, urlMatch.index + 500);
          const context = html.substring(contextStart, contextEnd);
          
          // Look for id="p-X" or "X / Y" pattern
          const pageNumMatch = context.match(/id=["']p-(\d+)["']/i) ||
                              context.match(/(\d+)\s*\/\s*\d+/);
          const pageNum = pageNumMatch ? parseInt(pageNumMatch[1]) : pages.length + 1;
          
          pages.push({
            url: imageUrl,
            index: pageNum,
          });
          
          console.log('[AllManga] Found image URL:', pageNum, imageUrl.substring(0, 70) + '...');
        }
      }
      
      console.log('[AllManga] Total unique image URLs found:', foundUrls.size);
      
      console.log('[AllManga] Total pages found:', pages.length);
      
      // Sort pages by index to maintain order
      pages.sort((a, b) => a.index - b.index);
      
      return pages;
    } catch (error) {
      console.error('[AllManga] Error fetching chapter pages:', error);
      return [];
    }
  },

  // Find manga URL from search and fetch chapters
  async findMangaAndChapters(mangaTitle) {
    try {
      console.log('[AllManga] Finding manga and chapters for:', mangaTitle);
      
      // Search for the manga
      const searchResults = await this.searchManga(mangaTitle);
      
      if (searchResults.length === 0) {
        console.log('[AllManga] No search results found');
        return { url: null, chapters: [] };
      }
      
      console.log('[AllManga] Found', searchResults.length, 'search results');
      console.log('[AllManga] Top result:', searchResults[0]);
      
      // Use the top result
      const topResult = searchResults[0];
      
      // Fetch chapters from the manga page
      const chapters = await this.fetchChapters(topResult.url);
      
      console.log('[AllManga] Final result - URL:', topResult.url, 'Chapters:', chapters.length);
      
      return {
        url: topResult.url,
        chapters: chapters,
      };
    } catch (error) {
      console.error('[AllManga] Error finding manga and chapters:', error);
      return { url: null, chapters: [] };
    }
  },
};