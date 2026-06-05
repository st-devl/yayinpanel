export function buildWebsitePrompt(params: {
  rawText: string;
  mediaFiles: Array<{ fileId: string; fileName: string }>;
  instructionText: string;
  accountId: string;
  timezone: string;
  currentDateIso: string;
}): string {
  const mediaInfo =
    params.mediaFiles.length > 0
      ? `\nYÜKLENEN GÖRSELLER:\n${params.mediaFiles
          .map((f, i) => `  ${i + 1}. ID: ${f.fileId} | Dosya Adı: ${f.fileName}`)
          .join("\n")}`
      : "\nGÖRSEL YOK: Bu içerikler için görsel yüklenmedi.";

  return `GÖREV: Aşağıdaki metni analiz et ve içindeki blog yazılarını/içerikleri birbirinden ayırarak her biri için yapılandırılmış JSON üret.

HEDEF HESAP: ${params.accountId}
SAAT DİLİMİ: ${params.timezone}
BUGÜNÜN TARİHİ: ${params.currentDateIso}
${mediaInfo}

YAYINLAMA TALİMATI:
${params.instructionText || "Yayınlama tarihi belirtilmemiş."}

HAM METİN:
---
${params.rawText}
---

ÇIKTI FORMATI (JSON array):
[
  {
    "platform": "website",
    "contentType": "blog_post",
    "targetAccountId": "${params.accountId}",
    "title": "Yazı başlığı",
    "summary": "Kısa özet (2-3 cümle)",
    "slug": "url-slug-kucuk-harf-tire-ile",
    "contentHtml": "<p>Ana içerik HTML formatında</p>",
    "seoTitle": "SEO başlığı (max 60 karakter)",
    "seoDescription": "Meta açıklama (max 160 karakter)",
    "category": "Kategori adı",
    "tags": ["etiket1", "etiket2"],
    "media": [
      {
        "fileId": "media_id_buraya",
        "role": "featured_image",
        "altText": "Görsel açıklaması",
        "order": 0
      }
    ],
    "scheduledAt": "2026-06-09T10:00:00+03:00",
    "scheduleIsInferred": true,
    "confidence": 0.92,
    "warnings": [],
    "aiNotes": "Varsa notlar"
  }
]

ÖNEMLİ KURALLAR:
- Eğer metinde birden fazla yazı varsa hepsini ayrı item olarak döndür.
- scheduledAt: Talimat varsa hesapla. Yoksa null döndür ve "AMBIGUOUS_SCHEDULE" uyarısı ekle.
- scheduleIsInferred: Tarihi talimatı yorumlayarak belirlediğinde true, kullanıcı açıkça yazdıysa false.
- slug: Türkçe karakterleri İngilizce karşılıklarıyla değiştir (ş→s, ğ→g, ü→u, ö→o, ı→i, ç→c).
- contentHtml: İçeriği uygun HTML etiketleriyle formatla (h2, h3, p, ul, li, strong, em).
- Görsel yoksa media array'i boş bırak ve "MISSING_MEDIA" uyarısı ekleme (opsiyonel görsel).
- Görsel dosya adı yazı sırasıyla örtüşüyorsa (1.jpg → birinci yazı) eşleştir.
- Eşleştirme belirsizse media array'i boş bırak ve "MEDIA_MATCH_UNCERTAIN" uyarısı ekle.`;
}
