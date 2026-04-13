internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  private func simulatorSafeBundleURL(_ url: URL?) -> URL? {
#if targetEnvironment(simulator)
    guard let url else {
      return fallbackBundleURL()
    }

    guard let scheme = url.scheme?.lowercased(), scheme == "http" else {
      return url
    }

    guard let host = url.host?.lowercased(), host == "192.0.0.2" || host == "127.0.0.1" else {
      return url
    }

    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    components?.host = "localhost"
    return components?.url ?? url
#else
    return url
#endif
  }

  private func fallbackBundleURL() -> URL? {
#if targetEnvironment(simulator)
    var components = URLComponents()
    components.scheme = "http"
    components.host = "localhost"
    components.port = 8081
    components.path = "/.expo/.virtual-metro-entry.bundle"
    components.queryItems = [
      URLQueryItem(name: "platform", value: "ios"),
      URLQueryItem(name: "dev", value: "true"),
      URLQueryItem(name: "minify", value: "false")
    ]
    return components.url
#else
    return nil
#endif
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    simulatorSafeBundleURL(bridge.bundleURL) ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    let bundleURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
    return simulatorSafeBundleURL(bundleURL) ?? fallbackBundleURL()
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
