/**
 * content/index.ts
 * Uygulama giriş noktası — tüm modülleri başlatır.
 */

import { removeStaleButtons, injectButtonsInScope } from "./button-injector";
import { startObserver } from "./observer";
import { setupRouteListener } from "./route-listener";

// ---------------------------------------------------------------------------
// Başlatma
// ---------------------------------------------------------------------------

function initialize(): void {
  // 1. Stale butonları temizle (extension reload senaryosu)
  removeStaleButtons();

  // 2. Mevcut DOM'u tara ve butonları ekle
  injectButtonsInScope(document);

  // 3. SPA route değişimi listener'ını kur
  setupRouteListener(() => {
    // Route değiştikten sonra DOM güncellenir; kısa gecikme ile yeniden tara
    setTimeout(() => injectButtonsInScope(document), 200);
  });

  // 4. MutationObserver'ı başlat (infinite scroll, lazy load vb.)
  startObserver();
}

// document_idle'da çalışır; ancak garanti için readyState'i de kontrol et
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
  initialize();
}
