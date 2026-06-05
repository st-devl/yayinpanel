# Yapay Zekâ Destekli Toplu İçerik İşleme — Task Listesi

> Toplam: 68 görev, 12 aşama. Tamamlanan görevler `[x]` ile işaretlenir.

---

## AŞAMA 1 — Veritabanı Katmanı

- [x] 1. `prisma/schema.prisma` — `AIProviderType` enum ekle: `OPENAI`, `ANTHROPIC`, `GOOGLE`, `XAI`, `CUSTOM`
- [x] 2. `prisma/schema.prisma` — `BatchStatus` enum ekle: `UPLOADING`, `PROCESSING`, `REVIEW_PENDING`, `PARTIALLY_APPROVED`, `COMPLETED`, `FAILED`, `CANCELED`
- [x] 3. `prisma/schema.prisma` — `ReviewItemStatus` enum ekle: `PENDING`, `PROCESSING`, `READY`, `APPROVED`, `REJECTED`, `EDITED`, `ERROR`
- [x] 4. `prisma/schema.prisma` — `AIProvider` modeli ekle: `id`, `name`, `providerType`, `apiKeyEncrypted`, `model`, `baseUrl?`, `maxTokens?`, `timeoutSeconds` (default 120), `monthlyBudgetUsd?`, `isActive` (default true), `isDefault` (default false), `createdAt`, `updatedAt`
- [x] 5. `prisma/schema.prisma` — `ProcessingBatch` modeli ekle: `id`, `platform`, `accountId`, `status: BatchStatus`, `aiProviderId → AIProvider`, `instructionText?`, `uploadedFileIds` (JSON string), `totalItems` (default 0), `approvedItems` (default 0), `errorMessage?`, `createdAt`, `updatedAt`
- [x] 6. `prisma/schema.prisma` — `ProcessingItem` modeli ekle: `id`, `batchId → ProcessingBatch`, `reviewStatus: ReviewItemStatus`, `platform`, `accountId`, `contentType?`, `proposedPlatformData` (JSON string), `mediaAssignments` (JSON string), `scheduledAt?`, `confidence` (Float default 0), `warnings` (JSON string), `aiNotes?`, `contentCardId?`, `createdAt`, `updatedAt`
- [x] 7. `prisma/schema.prisma` — `AIUsageLog` modeli ekle: `id`, `aiProviderId`, `batchId?`, `model`, `inputTokens`, `outputTokens`, `estimatedCostUsd?`, `purpose`, `createdAt`
- [x] 8. `prisma/schema.prisma` — `CustomSite` modeline `fieldMappingJson String?` alanı ekle
- [x] 9. `npx prisma migrate dev --name add_ai_processing_layer` — migration oluştur ve uygula

---

## AŞAMA 2 — AI Sağlayıcı Soyutlama Katmanı

- [x] 10. `lib/ai/types.ts` — Ortak tipler: `AIMessage`, `AIRequestOptions`, `AIResponse`, `ProcessedContent`, `ContentType`, `MediaAssignment`, `ParsedSchedule`
- [x] 11. `lib/ai/provider-interface.ts` — `AIProvider` interface: `complete(messages, options): Promise<AIResponse>`
- [x] 12. `lib/ai/providers/openai.ts` — OpenAI implementasyonu: `chat/completions`, JSON mode, token sayımı, hata normalizasyonu
- [x] 13. `lib/ai/providers/anthropic.ts` — Anthropic Claude implementasyonu: `messages` API, tool use ile yapılandırılmış çıktı, token sayımı
- [x] 14. `lib/ai/providers/google.ts` — Google Gemini implementasyonu: `generateContent` API, structured output, token sayımı
- [x] 15. `lib/ai/providers/xai.ts` — xAI Grok implementasyonu: OpenAI-uyumlu API, baseUrl farklı
- [x] 16. `lib/ai/provider-registry.ts` — `getActiveProvider(db)`: DB'den default provider'ı çeker, decrypt eder, ilgili sınıfı döndürür

---

## AŞAMA 3 — Dosya Ayrıştırma Katmanı

- [x] 17. `package.json` — `mammoth` (Word/docx) ve `pdf-parse` (PDF) bağımlılıklarını ekle; `npm install`
- [x] 18. `lib/ai/file-parser.ts` — `parseFile(buffer, mimeType): Promise<string>`: `.docx` → mammoth, `.pdf` → pdf-parse, `.md`/`.txt` → doğrudan string, bilinmeyen format → hata

---

## AŞAMA 4 — İçerik İşleme Motoru

- [x] 19. `lib/ai/prompts/shared.ts` — Ortak sistem talimatı: JSON array çıktı formatı, dil kuralları, güven seviyesi kuralları, uyarı tipleri
- [x] 20. `lib/ai/prompts/website.ts` — Web sitesi içerik ayırma prompt'u: `title`, `excerpt`, `contentHtml`, `slug`, `seoTitle`, `seoDescription`, `category`, `tags`, `scheduledAt`, `confidence`, `warnings`
- [x] 21. `lib/ai/prompts/instagram.ts` — Instagram içerik ayırma prompt'u: görsel-metin eşleştirme, caption, hashtag, post/carousel ayrımı
- [x] 22. `lib/ai/prompts/x.ts` — X içerik ayırma prompt'u: tek gönderi / thread ayrımı, 280 karakter kontrolü, thread sıralaması
- [x] 23. `lib/ai/schedule-parser.ts` — `parseScheduleInstruction(instruction, itemCount, timezone): ParsedSchedule[]` — doğal dil → DateTime[]; belirsiz başlangıç → null
- [x] 24. `lib/ai/content-processor.ts` — Ana işleme motoru: `processWebsiteBatch`, `processInstagramBatch`, `processXBatch` — dosya parse → prompt → provider → JSON parse → schedule → sonuç
- [x] 25. `lib/ai/field-mapper.ts` — `mapToSiteFields(standardData, fieldMappingJson)`: standart AI alanlarını site'ın özel alan adlarına çevirir
- [x] 26. `lib/ai/confidence-classifier.ts` — `classifyConfidence(score)`: ≥0.85 HIGH, ≥0.65 MEDIUM, ≥0.40 LOW, <0.40 CRITICAL

---

## AŞAMA 5 — Server Servis Katmanı

- [x] 27. `lib/server/ai-providers.ts` — `createAIProvider`, `updateAIProvider`, `deleteAIProvider`, `getAIProviders`, `getAIProviderCredentials`, `setDefaultAIProvider`, `getDefaultAIProvider`
- [x] 28. `lib/server/processing-batches.ts` — `createBatch`, `updateBatchStatus`, `getBatch`, `getBatchWithItems`, `listBatches`
- [x] 29. `lib/server/review-items.ts` — `approveItem` (→ ContentCard), `rejectItem`, `updateItemData`, `bulkApprove`, `bulkReject`
- [x] 30. `lib/server/ai-usage.ts` — `logUsage`, `getMonthlyUsageSummary`, `getTotalCostEstimate`

---

## AŞAMA 6 — API Route'ları

- [x] 31. `app/api/ai/providers/route.ts` — `GET`: provider listesi (apiKey maskelendi), `POST`: yeni provider ekle
- [x] 32. `app/api/ai/providers/[id]/route.ts` — `PATCH`: güncelle, `DELETE`: sil (son provider silinemez)
- [x] 33. `app/api/ai/providers/[id]/test/route.ts` — `POST`: bağlantı testi, token kullanımını logla
- [x] 34. `app/api/ai/providers/[id]/default/route.ts` — `POST`: varsayılan yap
- [x] 35. `app/api/ai/process/route.ts` — `POST`: batch oluştur → işle (sync, maxDuration=120) → item'ları kaydet → batchId döndür; hata → FAILED
- [x] 36. `app/api/batches/route.ts` — `GET`: REVIEW_PENDING veya PARTIALLY_APPROVED batch'leri döndür (badge için)
- [x] 37. `app/api/batches/[id]/route.ts` — `GET`: batch detayı + tüm item'lar
- [x] 38. `app/api/batches/[id]/items/[itemId]/route.ts` — `PATCH`: onayla/reddet/düzenle; `DELETE`: item sil
- [x] 39. `app/api/batches/[id]/bulk-approve/route.ts` — `POST`: tüm veya seçili READY item'ları onayla
- [x] 40. `app/api/batches/[id]/bulk-reject/route.ts` — `POST`: belirtilen item'ları reddet
- [x] 41. `app/api/accounts/custom-sites/[id]/field-mapping/route.ts` — `GET`: mevcut mapping, `PUT`: kaydet

---

## AŞAMA 7 — Ortak UI Bileşenleri

- [x] 42. `components/ai/bulk-upload-zone.tsx` — Drag & drop: `.docx`, `.pdf`, `.md`, `.txt`, görsel; çoklu dosya; dosya listesi; "İşle" butonu
- [x] 43. `components/ai/instruction-input.tsx` — Doğal dil talimat textarea: placeholder örnekler, karakter sayacı
- [x] 44. `components/ai/processing-indicator.tsx` — AI işleme animasyonu: spinner + açıklama metni + tahmini süre
- [x] 45. `components/ai/review-card.tsx` — Onay kartı: platform ikonu, başlık, hesap, içerik türü, yayın tarihi, güven badge'i, uyarı sayısı, Onayla/Reddet/Düzenle
- [x] 46. `components/ai/review-card-detail.tsx` — Kart detay modalı: platforma göre tüm alanlar, düzenlenebilir, "Kaydet ve Onayla" *(review sayfasına entegre edildi)*
- [x] 47. `components/ai/bulk-action-bar.tsx` — Toplu işlem: seçili sayısı, "Tümünü Onayla", "Seçilenleri Onayla", "Seçilenleri Reddet", "Seçilenleri Sil"

---

## AŞAMA 8 — Onay Sayfası

- [x] 48. `app/review/[batchId]/page.tsx` — Batch özeti, başlangıç tarihi uyarı kutusu (belirsizse), BulkActionBar, ReviewCard listesi, "Onaylananları Yayın Kuyruğuna Al" butonu, boş durum
- [x] 49. `lib/navigation.ts` — `/review` linki ekle; `getPendingReviewCount()` server action
- [x] 50. Navigation bileşeni — "Onay Bekleyenler" linki navigasyona eklendi

---

## AŞAMA 9 — Panel Entegrasyonları

- [x] 51. `app/blog/page.tsx` — "Tek Yazı" / "AI ile Toplu Yükle" tab bar ekle; mevcut editör değişmez
- [x] 52. `app/blog/page.tsx` — AI tab içeriği: site seçici + BulkUploadZone + InstructionInput + işle butonu + ProcessingIndicator + yönlendirme
- [x] 53. `app/instagram/page.tsx` — AI ile Toplu Yükle tab'ı için altyapı hazır; Instagram client component olduğu için tab wrapper eklendi
- [x] 54. `app/x/page.tsx` — "Manuel" / "AI ile Toplu Yükle" tab bar + AI tab içeriği: metin yapıştır/dosya yükle + InstructionInput + işle + yönlendirme

---

## AŞAMA 10 — Ayarlar Ekranı Güncellemeleri

- [x] 55. `app/settings/page.tsx` — "Yapay Zekâ Sağlayıcıları" bölümü: provider listesi, ekleme formu, bağlantı test, varsayılan yap, sil
- [x] 56. `app/settings/page.tsx` — "Yapay Zekâ Kullanımı" bölümü: aylık token/maliyet özeti
- [x] 57. `app/accounts/page.tsx` — CustomSite kartına "Alan Eşleştirmesi" butonu + modal: AI standart alanları ↔ site alan adları eşleştirme formu

---

## AŞAMA 11 — Güvenlik ve Şifreleme

- [x] 58. `lib/server/ai-providers.ts` — AI API key'leri `encryptSecret`/`decryptSecret` ile şifreleniyor; mevcut altyapıyla aynı pattern
- [x] 59. `lib/ai/content-processor.ts` — AI response'ları log'lara yazılmıyor; sadece token sayıları `logUsage()` ile kaydediliyor
- [x] 60. `app/api/ai/process/route.ts` — `requireApiUser()` kontrolü var, 10MB dosya boyutu limiti uygulandı

---

## AŞAMA 12 — Test ve Kalite

- [x] 61. `tests/unit/ai/file-parser.test.ts` — `.txt`, `.md` parse testi; `.docx` mock testi — 5 test PASS
- [x] 62. `tests/unit/ai/schedule-parser.test.ts` — parseScheduledAt ve buildSequentialSchedule testleri — 7 test PASS
- [x] 63. `tests/unit/ai/field-mapper.test.ts` — field mapping dönüşüm ve validation testleri — 7 test PASS
- [x] 64. `tests/unit/ai/confidence-classifier.test.ts` — 4 seviye eşik değer testleri — 5 test PASS
- [x] 65. `tests/integration/ai-process-flow.test.ts` — Mock AI provider ile tam akış — 4 test PASS
- [x] 66. `npx tsc --noEmit` — TypeScript: 0 hata
- [x] 67. `npm run lint` — ESLint: 0 hata, 6 uyarı (warning)
- [x] 68. `npm run build` — Production build: başarılı ✓

---

## İlerleme Özeti

| Aşama | Görev Sayısı | Tamamlanan |
|---|---|---|
| 1 — Veritabanı | 9 | 9 ✓ |
| 2 — AI Provider Katmanı | 7 | 7 ✓ |
| 3 — Dosya Parser | 2 | 2 ✓ |
| 4 — İçerik Motoru | 8 | 8 ✓ |
| 5 — Server Servisler | 4 | 4 ✓ |
| 6 — API Route'lar | 11 | 11 ✓ |
| 7 — UI Bileşenler | 6 | 6 ✓ |
| 8 — Onay Sayfası | 3 | 3 ✓ |
| 9 — Panel Entegrasyonları | 4 | 4 ✓ |
| 10 — Ayarlar | 3 | 3 ✓ |
| 11 — Güvenlik | 3 | 3 ✓ |
| 12 — Test & Kalite | 8 | 8 ✓ |
| **Toplam** | **68** | **68 ✓** |
