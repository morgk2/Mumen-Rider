import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Circle } from 'react-native-svg';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function CustomSplashScreen({ onFinish }) {
  useEffect(() => {
    // Hide splash screen after a short delay or when app is ready
    const timer = setTimeout(async () => {
      await SplashScreen.hideAsync();
      if (onFinish) {
        onFinish();
      }
    }, 1000); // Show for at least 1 second

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Svg width={200} height={200} style={styles.svg}>
        <Circle
          cx="100"
          cy="100"
          r="80"
          stroke="white"
          strokeWidth="4"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    alignSelf: 'center',
  },
});

