# OpenFit (SwiftUI port)

Native SwiftUI port of the OpenFit Expo app. See `/Users/devin/openfit-spec.md` for the feature spec.

Requires: Xcode 16+, XcodeGen (`brew install xcodegen`).

```sh
# 1. Regenerate the Xcode project (OpenFit.xcodeproj is gitignored)
xcodegen generate

# 2. Build for the iOS Simulator
xcodebuild -project OpenFit.xcodeproj -scheme OpenFit \
  -destination 'platform=iOS Simulator,name=iPhone 17' build

# 3. Install into the booted simulator
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/OpenFit.app

# 4. Launch
xcrun simctl launch booted com.francescooddo.openfit
```
