import SwiftUI

@main
struct YTAdFreeApp: App {
    var body: some Scene {
        WindowGroup {
            WebViewContainer()
                .statusBar(hidden: false)
        }
    }
}
