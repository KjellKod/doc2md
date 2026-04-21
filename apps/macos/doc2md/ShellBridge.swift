import Foundation
import WebKit

final class ShellBridge: NSObject, WKScriptMessageHandler {
    private enum HandlerName {
        static let openFile = "doc2mdOpenFile"
        static let saveFile = "doc2mdSaveFile"
        static let saveFileAs = "doc2mdSaveFileAs"
        static let revealInFinder = "doc2mdRevealInFinder"

        static let all = [
            openFile,
            saveFile,
            saveFileAs,
            revealInFinder
        ]
    }

    weak var webView: WKWebView?

    func install(on userContentController: WKUserContentController) {
        let script = WKUserScript(
            source: Self.scriptSource,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )

        userContentController.addUserScript(script)

        for name in HandlerName.all {
            userContentController.add(self, name: name)
        }
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard HandlerName.all.contains(message.name),
              let id = Self.messageID(from: message.body)
        else {
            return
        }

        resolve(id: id, result: .notImplemented)
    }

    private func resolve(id: String, result: ShellCallResult) {
        do {
            let encoder = JSONEncoder()
            let idData = try encoder.encode(id)
            let resultData = try encoder.encode(result)
            guard let idJSON = String(data: idData, encoding: .utf8),
                  let resultJSON = String(data: resultData, encoding: .utf8)
            else {
                return
            }

            #if DEBUG
            print("ShellBridge Phase 2 stub result: \(resultJSON)")
            #endif

            let script = "window.__doc2mdShellResolve(\(idJSON), \(resultJSON));"

            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(script)
            }
        } catch {
            #if DEBUG
            print("ShellBridge failed to encode stub result: \(error.localizedDescription)")
            #endif
        }
    }

    private static func messageID(from body: Any) -> String? {
        if let dictionary = body as? [String: Any],
           let id = dictionary["id"] as? String {
            return id
        }

        if let dictionary = body as? NSDictionary,
           let id = dictionary["id"] as? String {
            return id
        }

        return nil
    }

    private static let scriptSource = #"""
(() => {
  if (window.doc2mdShell && window.doc2mdShell.version === 1) {
    return;
  }

  const pending = new Map();

  const callShell = (handlerName, args) => {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pending.set(id, resolve);

      try {
        window.webkit.messageHandlers[handlerName].postMessage({
          id,
          args: args ?? null
        });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  };

  Object.defineProperty(window, "__doc2mdShellResolve", {
    configurable: true,
    value: (id, result) => {
      const resolve = pending.get(id);
      if (!resolve) {
        return;
      }

      pending.delete(id);
      resolve(result);
    }
  });

  Object.defineProperty(window, "doc2mdShell", {
    configurable: true,
    value: {
      version: 1,
      openFile: () => callShell("doc2mdOpenFile", null),
      saveFile: (args) => callShell("doc2mdSaveFile", args),
      saveFileAs: (args) => callShell("doc2mdSaveFileAs", args),
      revealInFinder: (args) => callShell("doc2mdRevealInFinder", args)
    }
  });
})();
"""#
}

private struct ShellCallResult: Encodable {
    let ok: Bool
    let code: String
    let message: String

    static let notImplemented = ShellCallResult(
        ok: false,
        code: "error",
        message: "Not implemented in Phase 2"
    )
}
