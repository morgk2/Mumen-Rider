import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_LARGE_SCREEN = SCREEN_WIDTH >= 768;
const IS_WEB = Platform.OS === 'web';

export const SideNavigation = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  
  // Only show side nav on web and large screens
  if (!IS_WEB || !IS_LARGE_SCREEN) {
    return null;
  }

  const navItems = [
    { name: 'Home', icon: 'home', route: 'Home' },
    { name: 'Search', icon: 'search', route: 'Search' },
    { name: 'Manga', icon: 'book', route: 'Manga' },
    { name: 'Downloads', icon: 'download', route: 'Downloads' },
    { name: 'Profile', icon: 'person', route: 'Profile' },
  ];

  // Get current route name from navigation state
  const getCurrentRoute = () => {
    const state = navigation.getState();
    if (state) {
      const route = state.routes[state.index];
      return route?.name || 'Home';
    }
    return 'Home';
  };

  const [currentRoute, setCurrentRoute] = React.useState(getCurrentRoute());
  
  // Update current route when navigation state changes
  React.useEffect(() => {
    // Initial route
    setCurrentRoute(getCurrentRoute());
    
    // Listen for focus events on each screen
    const unsubscribe = navigation.addListener('state', () => {
      setCurrentRoute(getCurrentRoute());
    });
    
    return unsubscribe;
  }, [navigation]);

  const handleNavPress = (routeName) => {
    if (navigation) {
      try {
        navigation.navigate(routeName);
      } catch (error) {
        console.error('Navigation error:', error);
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.navContent}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>Mumen Rider</Text>
        </View>
        
        <View style={styles.navItems}>
          {navItems.map((item) => {
            const isActive = currentRoute === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => handleNavPress(item.route)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={item.icon} 
                  size={24} 
                  color={isActive ? '#fff' : 'rgba(255, 255, 255, 0.7)'} 
                />
                <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
  },
  navContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  logoContainer: {
    marginBottom: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e50914',
    letterSpacing: 1,
  },
  navItems: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navItemText: {
    marginLeft: 12,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  navItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

