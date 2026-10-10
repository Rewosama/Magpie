import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — Magpie",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-8 transition-colors"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Ayarlara dön
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Gizlilik Politikası
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
        Son güncelleme: Ocak 2025
      </p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            1. Toplanan Veriler
          </h2>
          <p>Magpie aşağıdaki verileri toplar ve işler:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5 text-sm">
            <li>
              <strong>E-posta adresi</strong> — kimlik doğrulama ve hesap
              yönetimi amacıyla Supabase Auth tarafından saklanır.
            </li>
            <li>
              <strong>Kayıtlı postlar</strong> — tarayıcı eklentisi aracılığıyla
              kaydettiğiniz Instagram ve X (Twitter) içeriklerinin meta verileri
              (URL, açıklama, yazar bilgisi, kaydetme tarihi).
            </li>
            <li>
              <strong>Thumbnail dosyaları</strong> — kayıtlı içeriklere ait
              önizleme görselleri Supabase Storage&rsquo;da{" "}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                {"{kullaniciId}/{postId}"}
              </code>{" "}
              yolu altında barındırılır.
            </li>
            <li>
              <strong>Oturum token&rsquo;ı</strong> — güvenli bir HTTP-only
              çerez olarak saklanır; yalnızca aktif oturumunuzu doğrulamak için
              kullanılır.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            2. Saklama Yeri
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>
              Veritabanı ve dosya depolama: <strong>Supabase</strong> (AB
              bölgesi — Frankfurt, Almanya).
            </li>
            <li>
              Web uygulaması: <strong>Cloudflare</strong> edge ağı üzerinden
              sunulur; içerik kalıcı olarak Cloudflare&rsquo;de depolanmaz.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            3. Silme Hakkı
          </h2>
          <p className="text-sm">
            Hesabınızı{" "}
            <Link
              href="/settings"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Ayarlar
            </Link>{" "}
            sayfasından istediğiniz zaman silebilirsiniz. Hesabınızı
            sildiğinizde:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5 text-sm">
            <li>Tüm kayıtlı postlarınız veritabanından silinir.</li>
            <li>Oluşturduğunuz tüm koleksiyonlar silinir.</li>
            <li>
              Tüm thumbnail dosyalarınız Supabase Storage&rsquo;dan kaldırılır.
            </li>
            <li>
              Verileriniz Supabase altyapısından en fazla 24 saat içinde tamamen
              kaldırılır.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            4. Çerezler
          </h2>
          <p className="text-sm">
            Magpie yalnızca bir oturum çerezi kullanır. Bu çerez, giriş
            yaptığınızda oluşturulur ve çıkış yaptığınızda ya da hesabınızı
            sildiğinizde temizlenir. Reklam veya izleme amaçlı üçüncü taraf
            çerez kullanılmaz.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            5. Üçüncü Taraf Hizmetler
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>
              <strong>Supabase</strong> — kimlik doğrulama, veritabanı ve dosya
              depolama altyapısı. Supabase&rsquo;in gizlilik politikasına{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                supabase.com/privacy
              </a>{" "}
              adresinden ulaşabilirsiniz.
            </li>
            <li>
              <strong>Instagram / X (Twitter)</strong> — yalnızca tarayıcı
              eklentisi aracılığıyla ziyaret ettiğiniz sayfalardaki meta veriler
              okunur. Bu platformlarla herhangi bir API entegrasyonu yoktur ve
              herhangi bir veri aktarımı yapılmaz.
            </li>
          </ul>
        </section>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
          Bu belge hukuki danışmanlık yerine geçmez.
        </p>
      </div>
    </div>
  );
}
