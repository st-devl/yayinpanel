export function buildInstagramPrompt(params: {
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
      : "\nGÖRSEL YOK.";

  return `GÖREV: Aşağıdaki metni ve görselleri analiz et, Instagram gönderilerini birbirinden ayır ve her biri için yapılandırılmış JSON üret.

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
    "platform": "instagram",
    "contentType": "instagram_post",
    "targetAccountId": "${params.accountId}",
    "caption": "Gönderi açıklama metni (hashtagsiz)",
    "hashtags": ["#etiket1", "#etiket2"],
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
    "confidence": 0.88,
    "warnings": [],
    "aiNotes": ""
  }
]

ÖNEMLİ KURALLAR:
- contentType: Tek görsel → "instagram_post", birden fazla görsel aynı gönderide → "instagram_carousel".
- caption: Hashtagleri caption'a dahil etme, ayrı hashtags array'ine koy.
- Görseller ile metinler sıra veya dosya adı bazlı eşleştirilsin.
- Birden fazla gönderi varsa her biri ayrı item olarak döndür.
- scheduledAt: Talimat varsa hesapla. Yoksa null ve "AMBIGUOUS_SCHEDULE" uyarısı.
- Görsel yoksa "MISSING_MEDIA" uyarısı ekle (Instagram için görsel zorunludur).
- Carousel'de tüm görseller media array'inde order alanıyla sıralanmış olmalı.`;
}
