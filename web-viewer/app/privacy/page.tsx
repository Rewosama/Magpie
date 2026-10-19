import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — Magpie Archive",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-8 transition-colors"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        GERİ
      </Link>

      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        Gizlilik Politikası
      </h1>
      <p className="mono text-zinc-400 mb-8">Son güncelleme: Ocak 2025</p>

      <div className="space-y-8 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-wide">
            1. Toplanan Veriler
          </h2>
          <p>Magpie aşağıdaki verileri toplar ve işler:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
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
              <code className="mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5">
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
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-wide">
            2. Saklama Yeri
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
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
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-wide">
            3. Silme Hakkı
          </h2>
          <p>
            Hesabınızı Ayarlar menüsünden istediğiniz zaman silebilirsiniz.
            Hesabınızı sildiğinizde:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5">
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
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-wide">
            4. Çerezler
          </h2>
          <p>
            Magpie yalnızca bir oturum çerezi kullanır. Bu çerez, giriş
            yaptığınızda oluşturulur ve çıkış yaptığınızda ya da hesabınızı
            sildiğinizde temizlenir. Reklam veya izleme amaçlı üçüncü taraf
            çerez kullanılmaz.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-wide">
            5. Üçüncü Taraf Hizmetler
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Supabase</strong> — kimlik doğrulama, veritabanı ve dosya
              depolama altyapısı. Supabase&rsquo;in gizlilik politikasına{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
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

        <p className="mono text-zinc-400 mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          Bu belge hukuki danışmanlık yerine geçmez.
        </p>
      </div>
    </div>
  );
}
