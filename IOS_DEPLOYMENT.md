# iOS App Store Deployment Guide

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at https://developer.apple.com

2. **Xcode** (latest version from Mac App Store)

3. **CocoaPods** (if not installed):
   ```bash
   sudo gem install cocoapods
   ```

## Building for iOS

1. **Build the web app and sync to iOS:**
   ```bash
   npm run build:ios
   ```

2. **Open in Xcode:**
   ```bash
   npm run open:ios
   ```

3. **In Xcode:**
   - Select your Team in Signing & Capabilities
   - Set your Bundle Identifier (com.yourcompany.izdrummachine)
   - Select a real device or simulator to test

## App Icon

Replace the default icon at:
```
ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```

Requirements:
- Size: 1024x1024 pixels
- Format: PNG
- No transparency
- No rounded corners (iOS adds them automatically)

## App Store Submission Checklist

- [ ] Replace app icon with your drippy smiley logo (1024x1024)
- [ ] Create app screenshots for all required device sizes
- [ ] Write app description and keywords
- [ ] Set app category to "Music"
- [ ] Create privacy policy URL
- [ ] Set up App Store Connect listing

## Testing

1. Test on real iOS device (audio works better than simulator)
2. Test all drum pads and synth features
3. Test in both portrait and landscape orientations
4. Test background audio playback

## Audio Notes

- iOS audio session is configured for playback with mix option
- Background audio is enabled
- Silent switch behavior: Audio will still play when muted (expected for instrument apps)

## Commands Reference

```bash
# Build web and sync to iOS
npm run build:ios

# Open Xcode project
npm run open:ios

# Sync changes without full rebuild
npm run sync:ios
```
