import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kullanım Koşulları — Magpie",
};

export default function TermsPage() {
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
        Kullanım Koşulları
      </h1>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
        Son güncelleme: Ocak 2025
      </p>

      <div className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            1. Kabul
          </h2>
          <p className="text-sm">
            Magpie uygulamasını kullanarak bu kullanım koşullarını okuduğunuzu
            ve kabul ettiğinizi beyan etmiş sayılırsınız. Koşulları kabul
            etmiyorsanız uygulamayı kullanmayı bırakınız.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            2. Kullanım Amacı
          </h2>
          <p className="text-sm">
            Magpie, Instagram ve X (Twitter) içeriklerini kişisel arşiv amacıyla
            kaydetmenize olanak tanıyan bir tarayıcı eklentisi ve web
            görüntüleyicisinden oluşmaktadır. Uygulama yalnızca kişisel, ticari
            olmayan kullanım için tasarlanmıştır.
          </p>
          <p className="text-sm mt-2">
            Kayıtlı içeriklerin telif hakları tamamen orijinal içerik
            sahiplerine aittir. Magpie, bu içeriklerin dağıtımını, yeniden
            yayınlanmasını ya da ticari amaçla kullanılmasını desteklemez.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            3. Sorumluluk Sınırlaması
          </h2>
          <p className="text-sm">
            Platform &ldquo;olduğu gibi&rdquo; (<em>as-is</em>) sunulmaktadır.
            Magpie; hizmet kesintileri, veri kaybı veya kayıtlı içeriklerin
            erişilemez hale gelmesi durumlarında herhangi bir sorumluluk kabul
            etmez.
          </p>
          <p className="text-sm mt-2">
            Verilerinizin yedeklenmesi tamamen sizin sorumluluğunuzdadır.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            4. Yasaklı Kullanımlar
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>
              Üçüncü tarafların telif hakkı ile korunan içeriklerini izinsiz
              dağıtmak veya kamuya açık hale getirmek.
            </li>
            <li>
              Uygulamayı başkalarını taciz etmek, spam göndermek ya da yasadışı
              faaliyetler için kullanmak.
            </li>
            <li>
              Uygulamanın güvenlik mekanizmalarını aşmaya veya bozguna uğratmaya
              çalışmak.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            5. Değişiklikler
          </h2>
          <p className="text-sm">
            Bu koşullar, önceden bildirim yapılmaksızın değiştirilebilir.
            Uygulamayı kullanmaya devam etmeniz, güncel koşulları kabul
            ettiğiniz anlamına gelir.
          </p>
        </section>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
          Bu belge hukuki danışmanlık yerine geçmez.
        </p>
      </div>
    </div>
  );
}
