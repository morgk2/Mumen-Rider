# Mumen Rider 🎬📚

A modern, feature-rich streaming application built with React Native and Expo that provides seamless access to movies, TV shows, anime, and manga content. Inspired by popular streaming platforms with a sleek, Netflix-style interface.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB.svg)
![Expo](https://img.shields.io/badge/Expo-~54.0.22-000020.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 📋 Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [API Services](#api-services)
- [Components](#components)
- [Screens](#screens)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

### 🎬 Movies & TV Shows
- **Trending Content**: Browse trending movies, TV shows, and anime
- **Detailed Information**: View comprehensive details including cast, reviews, ratings, and synopsis
- **Video Playback**: Built-in video player with subtitle support
- **Episode Management**: Track and watch TV show episodes with season selection
- **Search Functionality**: Search across movies, TV shows, and anime

### 📚 Manga
- **Extensive Library**: Access to a vast collection of manga titles
- **Multiple Categories**: Browse trending, popular, new releases, and top-rated manga
- **Detailed Manga Info**: View chapters, volumes, status, format, genres, and ratings
- **Chapter Reading**: Built-in manga reader for seamless reading experience
- **Character Information**: View detailed character profiles and roles
- **Reviews**: Read community reviews and ratings

### 🎨 User Interface
- **Netflix-Style Design**: Modern, sleek interface with smooth animations
- **Featured Content**: Eye-catching featured items with backdrop images and posters
- **Responsive Layout**: Optimized for different screen sizes
- **Dark Theme**: Easy-on-the-eyes dark interface
- **Smooth Scrolling**: Parallax effects and stretchy headers
- **Tab Navigation**: Easy navigation between Home, Manga, Search, and Profile

### 🔧 Technical Features
- **Cross-Platform**: Works on iOS, Android, and Web
- **Animated UI**: Smooth transitions and animations using React Native Animated API
- **Safe Area Support**: Proper handling of notches and device-specific layouts
- **Gesture Support**: Intuitive touch gestures and interactions
- **Video Streaming**: Support for multiple video sources with subtitle integration
- **Chapter Sorting**: Ascending/descending chapter order toggle

## 📱 Screenshots

> Add your app screenshots here

## 🛠 Tech Stack

### Core Technologies
- **React Native** (0.81.5) - Cross-platform mobile framework
- **Expo** (~54.0.22) - Development platform and tooling
- **React** (19.1.0) - UI library
- **React Navigation** (7.x) - Navigation library

### UI & Styling
- **@expo/vector-icons** - Icon library (Ionicons)
- **expo-linear-gradient** - Gradient backgrounds
- **expo-blur** - Blur effects for tab bars
- **react-native-safe-area-context** - Safe area handling

### Media & Video
- **expo-video** - Video playback (modern replacement for expo-av)
- **expo-screen-orientation** - Screen rotation control
- **@react-native-community/slider** - Video progress slider

### Animation & Gestures
- **react-native-reanimated** - Advanced animations
- **react-native-gesture-handler** - Touch gesture handling

### Navigation
- **@react-navigation/native** - Core navigation
- **@react-navigation/native-stack** - Stack navigation
- **@react-navigation/bottom-tabs** - Tab navigation

## 🏗 Architecture

### Design Pattern
The app follows a **component-based architecture** with clear separation of concerns:

```
├── screens/          # Screen components (pages)
├── components/       # Reusable UI components
├── services/         # API services and data fetching
└── assets/          # Static assets (images, icons)
```

### Data Flow
1. **Screens** manage state and orchestrate data fetching
2. **Services** handle all API communications
3. **Components** receive data via props and render UI
4. **Navigation** manages screen transitions and routing

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android development)

### Setup Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd mumen-rider
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Start the development server**
```bash
npm start
# or
expo start
```

4. **Run on specific platform**
```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## ⚙️ Configuration

### API Keys

The app uses the following external APIs:

1. **TMDB (The Movie Database)**
   - Used for movies, TV shows, and anime data
   - API Key is included in `services/TMDBService.js`
   - Get your own key at: https://www.themoviedb.org/settings/api

2. **AniList**
   - Used for manga data
   - GraphQL API (no key required)
   - Endpoint: https://graphql.anilist.co

3. **AllManga/MangaPark**
   - Used for manga chapter data
   - Scraping-based service in `services/AllMangaService.js`

4. **Vixsrc**
   - Video streaming source
   - Configured in `services/VixsrcService.js`

5. **OpenSubtitles**
   - Subtitle service
   - Configured in `services/OpenSubtitlesService.js`

### App Configuration

Edit `app.json` to customize:
- App name and slug
- App icon and splash screen
- Orientation settings
- Platform-specific configurations

## 📁 Project Structure

```
mumen-rider/
├── App.js                      # Root component with navigation setup
├── index.js                    # Entry point
├── app.json                    # Expo configuration
├── package.json                # Dependencies
│
├── screens/                    # Screen components
│   ├── HomeScreen.js          # Home screen with movies/TV shows
│   ├── MangaScreen.js         # Manga browsing screen
│   ├── SearchScreen.js        # Search functionality
│   ├── ProfileScreen.js       # User profile
│   ├── MovieDetailsScreen.js  # Movie/TV show details
│   ├── MangaDetailsScreen.js  # Manga details
│   ├── VideoPlayerScreen.js   # Video player
│   └── MangaReaderScreen.js   # Manga reader
│
├── components/                 # Reusable components
│   ├── FeaturedContent.js     # Featured movie/TV show banner
│   ├── FeaturedManga.js       # Featured manga banner
│   ├── TrendingSection.js     # Horizontal scrolling section
│   ├── TrendingItem.js        # Movie/TV show card
│   ├── MangaSection.js        # Manga horizontal section
│   ├── EpisodeItem.js         # TV episode card
│   ├── ChapterItem.js         # Manga chapter card
│   ├── CastMember.js          # Cast/character card
│   ├── ReviewItem.js          # Review card
│   └── SearchCard.js          # Search result card
│
├── services/                   # API services
│   ├── TMDBService.js         # TMDB API integration
│   ├── AniListService.js      # AniList GraphQL API
│   ├── AllMangaService.js     # Manga chapter scraping
│   ├── VixsrcService.js       # Video streaming
│   └── OpenSubtitlesService.js # Subtitle service
│
└── assets/                     # Static assets
    ├── icon.png               # App icon
    ├── splash-icon.png        # Splash screen
    ├── adaptive-icon.png      # Android adaptive icon
    └── favicon.png            # Web favicon
```

## 🔌 API Services

### TMDBService.js
Handles all movie, TV show, and anime data from The Movie Database.

**Key Methods:**
- `fetchTrendingMovies()` - Get trending movies
- `fetchTrendingTV()` - Get trending TV shows
- `fetchTrendingAnime()` - Get trending anime
- `searchMulti(query)` - Search across all media types
- `fetchTVDetails(tvId)` - Get TV show details
- `fetchSeasonDetails(tvId, seasonNumber)` - Get season episodes
- `getPosterURL(path, size)` - Get poster image URL
- `getBackdropURL(path, size)` - Get backdrop image URL

### AniListService.js
Handles manga data using AniList's GraphQL API.

**Key Methods:**
- `fetchPopularManga(page, perPage)` - Get popular manga
- `fetchTrendingManga(page, perPage)` - Get trending manga
- `fetchNewReleases(page, perPage)` - Get new manga releases
- `fetchTopRatedManga(page, perPage)` - Get top-rated manga
- `fetchMangaDetails(mangaId)` - Get detailed manga information
- `searchManga(query, page, perPage)` - Search manga
- `getMangaTitle(manga)` - Extract manga title (English/Romaji/Native)
- `getCoverImage(manga)` - Get cover image URL
- `getBannerImage(manga)` - Get banner image URL

### AllMangaService.js
Scrapes manga chapter data from MangaPark.

**Key Methods:**
- `findMangaAndChapters(mangaTitle)` - Search and get chapters
- `searchManga(query)` - Search manga on MangaPark
- `fetchChapters(mangaUrl)` - Get chapter list

### VixsrcService.js
Handles video streaming sources.

**Key Methods:**
- `getStreamingUrl(mediaId)` - Get video streaming URL
- `extractVideoSource(url)` - Extract video source from page

### OpenSubtitlesService.js
Manages subtitle fetching and integration.

**Key Methods:**
- `searchSubtitles(query, language)` - Search for subtitles
- `downloadSubtitle(subtitleId)` - Download subtitle file

## 🧩 Components

### Featured Components

#### FeaturedContent
Large banner displaying featured movie/TV show with backdrop, title/logo, and action buttons.
- Parallax scrolling effect
- Animated stretchy header
- Logo fetching from TMDB
- Watch Now and Add to List buttons

#### FeaturedManga
Large banner displaying featured manga with backdrop, poster, title, and action buttons.
- Centered poster on backdrop
- Smaller title text
- Read and Add to List buttons
- Parallax scrolling effect

### Section Components

#### TrendingSection
Horizontal scrolling section for movies/TV shows.
- Loading states
- Empty states
- Smooth horizontal scrolling
- Item press handling

#### MangaSection
Horizontal scrolling section for manga.
- Vertical poster layout
- Loading indicators
- Empty state handling

### Item Components

#### TrendingItem
Card component for movies/TV shows.
- Poster image
- Title overlay
- Gradient background
- Press animation

#### EpisodeItem
Card for TV show episodes.
- Episode thumbnail
- Episode number and title
- Air date
- Synopsis preview

#### ChapterItem
Card for manga chapters.
- Chapter number and title
- Release date
- Press handling

#### CastMember
Card for cast members or characters.
- Profile image
- Name
- Role/Character name

#### ReviewItem
Card displaying user reviews.
- User avatar
- Username
- Rating
- Review content
- Timestamp

#### SearchCard
Search result card with flexible layout.
- Poster/backdrop image
- Title
- Media type indicator
- Release year
- Rating

## 📺 Screens

### HomeScreen
Main landing page displaying trending content.
- Featured movie/TV show banner
- Trending Movies section
- Trending Shows section
- Trending Anime section
- Parallax scrolling effects

### MangaScreen
Manga browsing page.
- Featured manga banner
- Trending Manga section
- Popular Manga section
- New Releases section
- Top Rated section

### SearchScreen
Search functionality for all content types.
- Search input with debouncing
- Combined results (movies, TV, anime, manga)
- Filter by media type
- Empty and loading states

### MovieDetailsScreen
Detailed view for movies and TV shows.
- Large backdrop with title/logo
- Synopsis with expand/collapse
- Release date and rating
- Cast members
- Episodes (for TV shows)
- Season selection
- Reviews
- Play and Add to List buttons

### MangaDetailsScreen
Detailed view for manga.
- Backdrop with centered poster
- Smaller title text
- Date and rating
- Status and format
- Genre tags
- Character list
- Chapter list with sorting
- Reviews
- Read and Bookmark buttons

### VideoPlayerScreen
Full-screen video player.
- Custom controls
- Play/pause
- Seek bar with preview
- Volume control
- Subtitle support
- Full-screen toggle
- Screen orientation control
- Back button

### MangaReaderScreen
Manga reading interface.
- Page-by-page reading
- Swipe navigation
- Chapter navigation
- Zoom support
- Reading progress

### ProfileScreen
User profile and settings.
- User information
- Watchlist/Reading list
- Settings and preferences
- About section

## 🎯 Usage

### Browsing Content

1. **Home Tab**: Browse movies, TV shows, and anime
   - Scroll through trending content
   - Tap on any item to view details
   - Tap featured banner to view featured content details

2. **Manga Tab**: Browse manga
   - Scroll through different manga categories
   - Tap on manga to view details
   - Tap featured banner for featured manga

3. **Search Tab**: Search for content
   - Enter search query
   - Results include movies, TV shows, anime, and manga
   - Tap any result to view details

### Watching Content

1. Navigate to movie/TV show details
2. Tap "Watch Now" button
3. Select episode (for TV shows)
4. Video player opens in full screen
5. Use controls to play/pause, seek, adjust volume
6. Enable subtitles if available
7. Tap back button to exit

### Reading Manga

1. Navigate to manga details
2. Tap "Read" button or select a chapter
3. Manga reader opens
4. Swipe left/right to navigate pages
5. Tap to show/hide controls
6. Use chapter navigation to switch chapters

### Managing Lists

1. Tap "Add to List" (+) button on any content
2. Content is added to your watchlist/reading list
3. Access lists from Profile tab

## 🔧 Development

### Running in Development

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in web browser
npm run web
```

### Debugging

- **React Native Debugger**: Use React Native Debugger for advanced debugging
- **Console Logs**: Check terminal for console.log outputs
- **Expo DevTools**: Access via browser when running `npm start`

### Building for Production

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android

# Build for Web
expo build:web
```

### Code Style

The project follows standard React Native conventions:
- Functional components with hooks
- StyleSheet for styling
- Async/await for asynchronous operations
- Error handling with try/catch
- PropTypes or TypeScript (optional)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow existing code style
- Add comments for complex logic
- Test on both iOS and Android
- Update documentation as needed
- Keep commits atomic and well-described

## 📝 TODO / Future Enhancements

- [ ] User authentication and profiles
- [ ] Persistent watchlist/reading list
- [ ] Download for offline viewing/reading
- [ ] Multiple language support
- [ ] Recommendation engine
- [ ] Social features (share, rate, review)
- [ ] Advanced search filters
- [ ] Continue watching/reading feature
- [ ] Notification system
- [ ] Dark/Light theme toggle
- [ ] Parental controls
- [ ] Multiple profiles per account
- [ ] Chromecast/AirPlay support
- [ ] Picture-in-Picture mode

## 🐛 Known Issues

- Subtitle synchronization may vary by source
- Some manga chapters may fail to load from external sources
- Video buffering depends on internet connection
- Search results limited to API constraints

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **TMDB** - Movie and TV show data
- **AniList** - Manga and anime data
- **MangaPark** - Manga chapter sources
- **Expo** - Development platform
- **React Native Community** - Amazing libraries and tools

## 📧 Contact

For questions, suggestions, or issues, please open an issue on GitHub.

---

**Note**: This app is for educational purposes. Please respect copyright laws and content creators. Consider supporting official streaming services and purchasing manga from legitimate sources.

## 🔒 Disclaimer

This application aggregates content from various public APIs and sources. The developers do not host any content and are not responsible for the availability, legality, or quality of the content accessed through third-party services. Users are responsible for ensuring their use complies with local laws and regulations.

---

Made with ❤️ using React Native and Expo


