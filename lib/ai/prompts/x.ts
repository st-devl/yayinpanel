export function buildXPrompt(params: {
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

  return `GÖREV: Aşağıdaki metni analiz et, X (Twitter) gönderilerini birbirinden ayır ve her biri için yapılandırılmış JSON üret.

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
    "platform": "x",
    "contentType": "x_post",
    "targetAccountId": "${params.accountId}",
    "tweetText": "280 karakteri geçmeyen gönderi metni",
    "threadItems": [],
    "media": [],
    "scheduledAt": "2026-06-09T10:00:00+03:00",
    "scheduleIsInferred": true,
    "confidence": 0.91,
    "warnings": [],
    "aiNotes": ""
  }
]

ÖNEMLİ KURALLAR:
- contentType: Tek gönderi → "x_post", birden fazla sıralı gönderi → "x_thread".
- x_post için tweetText kullan, threadItems boş array olsun.
- x_thread için tweetText ilk tweeti içersin, threadItems dizisi geri kalan tweetleri içersin.
- Her tweet 280 karakteri geçmemelidir. Geçiyorsa "CONTENT_TOO_LONG" uyarısı ekle.
- URL'ler 23 karakter sayılır (Twitter URL shortener). Bunu hesaba kat.
- Birden fazla bağımsız gönderi varsa her biri ayrı item olarak döndür.
- scheduledAt: Talimat varsa hesapla. Yoksa null ve "AMBIGUOUS_SCHEDULE" uyarısı.
- Görsel varsa ve hangi gönderiye ait olduğu belirsizse "MEDIA_MATCH_UNCERTAIN" uyarısı ekle.`;
}
