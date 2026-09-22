import SwiftUI

@main
struct YTAdFreeApp: App {
    var body: some Scene {
        WindowGroup {
            WebViewContainer()
                .ignoresSafeArea()
                .statusBar(hidden: false)
        }
    }
}
