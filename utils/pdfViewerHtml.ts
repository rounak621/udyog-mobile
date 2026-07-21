/**
 * Generates an HTML string that uses PDF.js to render a PDF at fit-to-width scale.
 * Used by all PDF preview modals to replace Google Docs Viewer with a self-hosted,
 * controllable viewer that works consistently on both Android and iOS.
 */
export function getPdfViewerHtml(pdfUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      background: #F8FAFC;
      overflow-x: hidden;
    }
    #viewer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 8px 0 24px 0;
    }
    canvas {
      display: block;
      max-width: 100%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      background: #fff;
    }
    #error {
      display: none;
      text-align: center;
      padding: 40px 20px;
      color: #64748B;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    }
    #loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #94A3B8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="loading">Loading PDF...</div>
  <div id="viewer"></div>
  <div id="error">Could not load PDF preview.</div>

  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      var msg = "Global JS Error: " + message + " at " + source + ":" + lineno + ":" + colno;
      console.error(msg);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg }));
      }
      return false;
    };
    function reportScriptError(src) {
      var msg = "CDN Script Load Error: " + src;
      console.error(msg);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg }));
      }
    }
  </script>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" onerror="reportScriptError('pdf.min.js')"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    var pdfUrl = ${JSON.stringify(pdfUrl)};
    var viewer = document.getElementById('viewer');
    var loadingEl = document.getElementById('loading');
    var errorEl = document.getElementById('error');

    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdf) {
      loadingEl.style.display = 'none';
      var containerWidth = document.body.clientWidth - 16; // 8px padding each side

      var renderPage = function(pageNum) {
        return pdf.getPage(pageNum).then(function(page) {
          var unscaledViewport = page.getViewport({ scale: 1 });
          var scale = containerWidth / unscaledViewport.width;
          var viewport = page.getViewport({ scale: scale });

          var canvas = document.createElement('canvas');
          canvas.width = viewport.width * (window.devicePixelRatio || 1);
          canvas.height = viewport.height * (window.devicePixelRatio || 1);
          canvas.style.width = viewport.width + 'px';
          canvas.style.height = viewport.height + 'px';
          viewer.appendChild(canvas);

          var ctx = canvas.getContext('2d');
          ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

          return page.render({ canvasContext: ctx, viewport: viewport }).promise;
        });
      };

      var chain = Promise.resolve();
      for (var i = 1; i <= pdf.numPages; i++) {
        (function(pageNum) {
          chain = chain.then(function() { return renderPage(pageNum); });
        })(i);
      }
    }).catch(function(err) {
      console.error("PDF.js load error:", err);
      loadingEl.style.display = 'none';
      errorEl.style.display = 'block';
      // Signal error to React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: err.message || err.toString() }));
      }
    });
  </script>
</body>
</html>`;
}
