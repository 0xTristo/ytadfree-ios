import SwiftUI
import WebKit

struct WebViewContainer: UIViewRepresentable {
    static let startURL = URL(string: "https://m.youtube.com")!
    static let ruleListIdentifier = "YouTubeAdBlockRules"

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        addAdBlockUserScript(to: contentController)

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsPictureInPictureMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            + "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

        // Deliver the first tap straight to the page instead of holding it back
        // to detect a scroll gesture. Without this the scroll view swallows the
        // initial tap on controls like the search field, forcing a second tap.
        webView.scrollView.delaysContentTouches = false

        loadContentRules(into: webView)
        webView.load(URLRequest(url: Self.startURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func addAdBlockUserScript(to controller: WKUserContentController) {
        guard let url = Bundle.main.url(forResource: "adblock_userscript", withExtension: "js"),
              let source = try? String(contentsOf: url, encoding: .utf8) else {
            print("YTAdFree: adblock_userscript.js not found in bundle")
            return
        }
        let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        controller.addUserScript(script)
    }

    private func loadContentRules(into webView: WKWebView) {
        guard let url = Bundle.main.url(forResource: "content_rules", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let jsonString = String(data: data, encoding: .utf8) else {
            print("YTAdFree: content_rules.json not found in bundle")
            return
        }

        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: Self.ruleListIdentifier,
            encodedContentRuleList: jsonString
        ) { ruleList, error in
            if let error = error {
                print("YTAdFree: content rule compile error: \(error)")
                return
            }
            guard let ruleList = ruleList else { return }
            webView.configuration.userContentController.add(ruleList)
        }
    }
}
