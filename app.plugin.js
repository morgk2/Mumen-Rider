/**
 * Expo config plugin to fix Android AAPT icon compilation errors
 * by disabling PNG crunching which can cause issues with certain image files
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const withAndroidIconFix = (config) => {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    
    // Check if aaptOptions already exists in android block
    if (buildGradle.includes('aaptOptions')) {
      // Replace existing aaptOptions block
      config.modResults.contents = buildGradle.replace(
        /aaptOptions\s*\{[^}]*\}/s,
        `aaptOptions {
        cruncherEnabled = false
        useNewCruncher = false
    }`
      );
    } else if (buildGradle.includes('android {')) {
      // Add aaptOptions after android block opening, before defaultConfig or other blocks
      const androidBlockMatch = buildGradle.match(/(android\s*\{)/);
      if (androidBlockMatch) {
        const insertPosition = androidBlockMatch.index + androidBlockMatch[0].length;
        const beforeInsert = buildGradle.substring(0, insertPosition);
        const afterInsert = buildGradle.substring(insertPosition);
        
        // Find the first significant block after android {
        const nextBlockMatch = afterInsert.match(/^\s*\n\s*(defaultConfig|buildTypes|compileSdkVersion|namespace)/);
        if (nextBlockMatch) {
          // Insert before the next block
          const insertText = `
    aaptOptions {
        cruncherEnabled = false
        useNewCruncher = false
    }`;
          config.modResults.contents = beforeInsert + insertText + afterInsert;
        } else {
          // Insert right after android {
          config.modResults.contents = beforeInsert + `
    aaptOptions {
        cruncherEnabled = false
        useNewCruncher = false
    }` + afterInsert;
        }
      }
    }
    
    return config;
  });
};

module.exports = withAndroidIconFix;

