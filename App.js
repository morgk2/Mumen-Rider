import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { SideNavigation } from './components/SideNavigation';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import ProfileScreen from './screens/ProfileScreen';
import CollectionDetailsScreen from './screens/CollectionDetailsScreen';
import MangaScreen from './screens/MangaScreen';
import MovieDetailsScreen from './screens/MovieDetailsScreen';
import MangaDetailsScreen from './screens/MangaDetailsScreen';
import MangaReaderScreen from './screens/MangaReaderScreen';
import VideoPlayerScreen from './screens/VideoPlayerScreen';
import SettingsScreen from './screens/SettingsScreen';
import SubtitleSettingsScreen from './screens/SubtitleSettingsScreen';
import PlayerSettingsScreen from './screens/PlayerSettingsScreen';
import VideoSourceSettingsScreen from './screens/VideoSourceSettingsScreen';
import DownloadsScreen from './screens/DownloadsScreen';
import DownloadedMangaDetailsScreen from './screens/DownloadedMangaDetailsScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_LARGE_SCREEN = SCREEN_WIDTH >= 768;
const IS_WEB = Platform.OS === 'web';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="MangaDetails" component={MangaDetailsScreen} />
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="MangaReader" 
        component={MangaReaderScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="MangaDetails" component={MangaDetailsScreen} />
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="MangaReader" 
        component={MangaReaderScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}

function MangaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MangaMain" component={MangaScreen} />
      <Stack.Screen name="MangaDetails" component={MangaDetailsScreen} />
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="MangaReader" 
        component={MangaReaderScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}

function DownloadsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DownloadsMain" component={DownloadsScreen} />
      <Stack.Screen name="DownloadedMangaDetails" component={DownloadedMangaDetailsScreen} />
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="MangaDetails" component={MangaDetailsScreen} />
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="MangaReader" 
        component={MangaReaderScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SubtitleSettings" component={SubtitleSettingsScreen} />
      <Stack.Screen name="PlayerSettings" component={PlayerSettingsScreen} />
      <Stack.Screen name="VideoSourceSettings" component={VideoSourceSettingsScreen} />
      <Stack.Screen name="CollectionDetails" component={CollectionDetailsScreen} />
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen name="MangaDetails" component={MangaDetailsScreen} />
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="MangaReader" 
        component={MangaReaderScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  // Use side navigation for web on large screens, bottom tabs otherwise
  if (IS_WEB && IS_LARGE_SCREEN) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <View style={{ flexDirection: 'row', flex: 1, backgroundColor: '#000', position: 'relative' }}>
            <SideNavigation />
            <View style={{ flex: 1, marginLeft: 200 }}>
              <RootStack.Navigator screenOptions={{ headerShown: false }}>
                <RootStack.Screen name="Home" component={HomeScreen} />
                <RootStack.Screen name="Search" component={SearchScreen} />
                <RootStack.Screen name="Manga" component={MangaScreen} />
                <RootStack.Screen name="Downloads" component={DownloadsScreen} />
                <RootStack.Screen name="Profile" component={ProfileScreen} />
                <RootStack.Screen name="MovieDetails" component={MovieDetailsScreen} />
                <RootStack.Screen name="MangaDetails" component={MangaDetailsScreen} />
                <RootStack.Screen 
                  name="VideoPlayer" 
                  component={VideoPlayerScreen}
                  options={{
                    presentation: 'fullScreenModal',
                    animation: 'fade',
                  }}
                />
                <RootStack.Screen 
                  name="MangaReader" 
                  component={MangaReaderScreen}
                  options={{
                    presentation: 'fullScreenModal',
                    animation: 'fade',
                  }}
                />
                <RootStack.Screen name="Settings" component={SettingsScreen} />
                <RootStack.Screen name="SubtitleSettings" component={SubtitleSettingsScreen} />
                <RootStack.Screen name="PlayerSettings" component={PlayerSettingsScreen} />
                <RootStack.Screen name="VideoSourceSettings" component={VideoSourceSettingsScreen} />
                <RootStack.Screen name="CollectionDetails" component={CollectionDetailsScreen} />
                <RootStack.Screen name="DownloadedMangaDetails" component={DownloadedMangaDetailsScreen} />
              </RootStack.Navigator>
            </View>
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  // Bottom tabs for mobile and small screens
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#fff',
            tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
            tabBarBackground: () => {
              if (Platform.OS === 'ios') {
                return (
                  <BlurView
                    intensity={100}
                    tint="dark"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    }}
                  />
                );
              }
              return (
                <BlurView
                  intensity={80}
                  tint="dark"
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  }}
                />
              );
            },
            tabBarStyle: {
              borderTopWidth: 0,
              backgroundColor: 'transparent',
              position: 'absolute',
              ...(Platform.OS === 'ios' ? {
                height: 88,
                paddingBottom: 20,
              } : {
                height: 60,
                paddingBottom: 8,
              }),
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 12,
            },
          }}
        >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size || 24} color={color || '#fff'} />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size || 24} color={color || '#fff'} />
            ),
          }}
        />
        <Tab.Screen
          name="Manga"
          component={MangaStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book" size={size || 24} color={color || '#fff'} />
            ),
          }}
        />
        <Tab.Screen
          name="Downloads"
          component={DownloadsStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="download" size={size || 24} color={color || '#fff'} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size || 24} color={color || '#fff'} />
            ),
          }}
        />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
