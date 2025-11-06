import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import ProfileScreen from './screens/ProfileScreen';
import MangaScreen from './screens/MangaScreen';
import MovieDetailsScreen from './screens/MovieDetailsScreen';
import MangaDetailsScreen from './screens/MangaDetailsScreen';
import MangaReaderScreen from './screens/MangaReaderScreen';
import VideoPlayerScreen from './screens/VideoPlayerScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="MovieDetails" component={MovieDetailsScreen} />
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
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
      <Stack.Screen 
        name="VideoPlayer" 
        component={VideoPlayerScreen}
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
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#FF3B30',
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
              <Ionicons name="home" size={size || 24} color={color || '#FF3B30'} />
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size || 24} color={color || '#FF3B30'} />
            ),
          }}
        />
        <Tab.Screen
          name="Manga"
          component={MangaStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book" size={size || 24} color={color || '#FF3B30'} />
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size || 24} color={color || '#FF3B30'} />
            ),
          }}
        />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
