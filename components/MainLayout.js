import React from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { SideNavigation } from './SideNavigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_LARGE_SCREEN = SCREEN_WIDTH >= 768;
const IS_WEB = Platform.OS === 'web';

export const MainLayout = ({ children }) => {
  if (IS_WEB && IS_LARGE_SCREEN) {
    return (
      <View style={styles.container}>
        <SideNavigation />
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }
  
  return <View style={styles.fullContainer}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    marginLeft: 200,
  },
  fullContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
});


