const GRAPHQL_URL = 'https://graphql.anilist.co';

export const AniListService = {
  // Fetch popular manga
  async fetchPopularManga(page = 1, perPage = 20) {
    try {
      const query = `
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(type: MANGA, sort: POPULARITY_DESC) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                medium
              }
              bannerImage
              description
              chapters
              volumes
              status
              format
              genres
              tags {
                name
              }
              averageScore
              popularity
              startDate {
                year
                month
                day
              }
              endDate {
                year
                month
                day
              }
            }
          }
        }
      `;

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { page, perPage },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('AniList GraphQL errors:', data.errors);
        return [];
      }

      return data.data?.Page?.media || [];
    } catch (error) {
      console.error('Error fetching popular manga:', error);
      return [];
    }
  },

  // Fetch trending manga
  async fetchTrendingManga(page = 1, perPage = 20) {
    try {
      const query = `
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(type: MANGA, sort: TRENDING_DESC) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                medium
              }
              bannerImage
              description
              chapters
              volumes
              status
              format
              genres
              tags {
                name
              }
              averageScore
              popularity
              startDate {
                year
                month
                day
              }
              endDate {
                year
                month
                day
              }
            }
          }
        }
      `;

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { page, perPage },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('AniList GraphQL errors:', data.errors);
        return [];
      }

      return data.data?.Page?.media || [];
    } catch (error) {
      console.error('Error fetching trending manga:', error);
      return [];
    }
  },

  // Fetch recently released manga
  async fetchNewReleases(page = 1, perPage = 20) {
    try {
      const query = `
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(type: MANGA, sort: START_DATE_DESC, status: RELEASING) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                medium
              }
              bannerImage
              description
              chapters
              volumes
              status
              format
              genres
              tags {
                name
              }
              averageScore
              popularity
              startDate {
                year
                month
                day
              }
              endDate {
                year
                month
                day
              }
            }
          }
        }
      `;

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { page, perPage },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('AniList GraphQL errors:', data.errors);
        return [];
      }

      return data.data?.Page?.media || [];
    } catch (error) {
      console.error('Error fetching new releases:', error);
      return [];
    }
  },

  // Fetch top rated manga
  async fetchTopRatedManga(page = 1, perPage = 20) {
    try {
      const query = `
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(type: MANGA, sort: SCORE_DESC) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                medium
              }
              bannerImage
              description
              chapters
              volumes
              status
              format
              genres
              tags {
                name
              }
              averageScore
              popularity
              startDate {
                year
                month
                day
              }
              endDate {
                year
                month
                day
              }
            }
          }
        }
      `;

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { page, perPage },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('AniList GraphQL errors:', data.errors);
        return [];
      }

      return data.data?.Page?.media || [];
    } catch (error) {
      console.error('Error fetching top rated manga:', error);
      return [];
    }
  },

  // Search manga
  async searchManga(query, page = 1, perPage = 20) {
    try {
      const searchQuery = `
        query ($page: Int, $perPage: Int, $search: String) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              total
              currentPage
              lastPage
              hasNextPage
              perPage
            }
            media(type: MANGA, search: $search, sort: SEARCH_MATCH) {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                medium
              }
              bannerImage
              description
              chapters
              volumes
              status
              format
              genres
              tags {
                name
              }
              averageScore
              popularity
              startDate {
                year
                month
                day
              }
              endDate {
                year
                month
                day
              }
            }
          }
        }
      `;

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          variables: { page, perPage, search: query },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('AniList GraphQL errors:', data.errors);
        return { results: [], totalPages: 1, page: 1 };
      }

      const pageInfo = data.data?.Page?.pageInfo || {};
      return {
        results: data.data?.Page?.media || [],
        totalPages: pageInfo.lastPage || 1,
        page: pageInfo.currentPage || 1,
      };
    } catch (error) {
      console.error('Error searching manga:', error);
      return { results: [], totalPages: 1, page: 1 };
    }
  },

  // Helper to get manga title
  getMangaTitle(manga) {
    return manga?.title?.english || manga?.title?.romaji || manga?.title?.native || 'Unknown';
  },

  // Helper to get cover image URL
  getCoverImage(manga) {
    return manga?.coverImage?.large || manga?.coverImage?.medium || null;
  },

  // Helper to get banner image URL
  getBannerImage(manga) {
    return manga?.bannerImage || null;
  },

  // Fetch detailed manga information
  async fetchMangaDetails(mangaId) {
    try {
      const query = `
        query ($id: Int) {
          Media(id: $id, type: MANGA) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
            }
            bannerImage
            description
            chapters
            volumes
            status
            format
            genres
            tags {
              name
            }
            averageScore
            popularity
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            characters(perPage: 20, sort: ROLE) {
              edges {
                node {
                  id
                  name {
                    full
                  }
                  image {
                    large
                    medium
                  }
                }
                role
              }
            }
            staff(perPage: 20) {
              edges {
                node {
                  id
                  name {
                    full
                  }
                  image {
                    large
                    medium
                  }
                }
                role
              }
            }
            reviews(perPage: 10, sort: RATING_DESC) {
              nodes {
                id
                summary
                rating
                ratingAmount
                user {
                  name
                  avatar {
                    large
                    medium
                  }
                }
                createdAt
              }
            }
          }
        }
      `;

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { id: mangaId },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('AniList GraphQL errors:', data.errors);
        return null;
      }

      return data.data?.Media || null;
    } catch (error) {
      console.error('Error fetching manga details:', error);
      return null;
    }
  },
};

