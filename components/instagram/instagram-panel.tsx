"use client";

import { useMemo, useRef, useState } from "react";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { readJsonResponse } from "@/lib/client/http";
import {
  matchCaptionsWithMedia,
  parseBulkCaptions
} from "@/lib/domain/instagram-caption";

export type InstagramAccountOption = {
  id: string;
  accountName: string;
  username: string;
};

type UploadedMedia = {
  id: string;
  originalFileName: string;
};

type FeedbackState = { tone: "success" | "error"; message: string } | null;

export function InstagramPanel({
  accounts
}: {
  accounts: InstagramAccountOption[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [captionText, setCaptionText] = useState("");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [frequency, setFrequency] = useState("daily");
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const captions = useMemo(() => parseBulkCaptions(captionText), [captionText]);
  const match = useMemo(
    () => matchCaptionsWithMedia(captions, media.length),
    [captions, media.length]
  );

  if (accounts.length === 0) {
    return (
      <section className="panel-card flex flex-col items-center gap-md p-xl text-center">
        <MaterialIcon name="link_off" size={40} className="text-error" />
        <h2 className="font-headline-sm text-headline-sm">
          Aktif Instagram hesabi yok
        </h2>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Icerik planlamak icin once bir Instagram hesabi baglamalisiniz.
        </p>
        <a
          className="primary-button rounded-lg px-md py-sm font-label-md text-label-md"
          href="/accounts"
        >
          Hesap Baglantilarina Git
        </a>
      </section>
    );
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setFeedback(null);

    const uploaded: UploadedMedia[] = [];
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/media", {
          method: "POST",
          body: formData
        });
        const body = await readJsonResponse<{
          data?: UploadedMedia;
          error?: string;
        }>(response);
        if (!response.ok || !body.data) {
          throw new Error(body.error ?? "Yukleme basarisiz");
        }
        uploaded.push({
          id: body.data.id,
          originalFileName: body.data.originalFileName
        });
      }
      setMedia((current) => [...current, ...uploaded]);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Yukleme basarisiz"
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function moveMedia(index: number, direction: -1 | 1) {
    setMedia((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeMedia(index: number) {
    setMedia((current) => current.filter((_, i) => i !== index));
  }

  async function submit(asDraft: boolean) {
    setFeedback(null);

    if (!accountId) {
      setFeedback({ tone: "error", message: "Lutfen bir hesap secin." });
      return;
    }
    if (captions.length === 0) {
      setFeedback({ tone: "error", message: "En az bir metin girin." });
      return;
    }
    if (!asDraft && !match.balanced) {
      setFeedback({
        tone: "error",
        message:
          "Planlamadan once her metin bir gorselle eslesmelidir (metin ve gorsel sayisi esit olmali)."
      });
      return;
    }
    if (!asDraft && (!startDate || !startTime)) {
      setFeedback({
        tone: "error",
        message: "Planlama icin baslangic tarihi ve saati gerekli."
      });
      return;
    }

    const items = captions.map((caption, index) => ({
      text: caption.caption,
      mediaFileId: media[index]?.id,
      platformData: { postType: "IMAGE", hashtags: caption.hashtags }
    }));

    setSubmitting(true);
    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "INSTAGRAM",
          accountId,
          items,
          saveAsDraft: asDraft,
          schedule: asDraft
            ? undefined
            : { startDate, startTime, frequency, skipWeekends }
        })
      });
      const body = await readJsonResponse<{
        count?: number;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(body.error ?? "Kart olusturulamadi");
      }
      setFeedback({
        tone: "success",
        message: asDraft
          ? `${body.count} taslak kart olusturuldu.`
          : `${body.count} gonderi planlandi.`
      });
      setCaptionText("");
      setMedia([]);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Islem basarisiz"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-md">
      {feedback ? (
        <section
          className={`flex items-start gap-sm rounded-xl border p-md ${
            feedback.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-error/20 bg-error-container text-on-error-container"
          }`}
        >
          <MaterialIcon
            name={feedback.tone === "success" ? "check_circle" : "warning"}
            className={
              feedback.tone === "success" ? "text-green-700" : "text-error"
            }
          />
          <p className="font-body-md text-body-md">{feedback.message}</p>
        </section>
      ) : null}

      <section className="panel-card flex flex-col justify-between gap-md p-md md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-sm">
          <div className="shrink-0 rounded-lg bg-surface-container-highest p-3">
            <MaterialIcon name="photo_camera" className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-label-sm text-label-sm uppercase text-on-surface-variant">
              Aktif Instagram Hesabi
            </p>
            <select
              className="mt-1 max-w-full border-none bg-transparent p-0 font-headline-sm text-headline-sm text-primary focus:ring-0"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} - @{account.username}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-12 gap-md">
        <div className="panel-card col-span-12 flex min-w-0 flex-col p-md lg:col-span-8">
          <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
            <h1 className="font-headline-sm text-headline-sm text-primary">
              Toplu Metin Girisi
            </h1>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Gonderileri &quot;---&quot; satiriyla ayirin
            </span>
          </div>
          <textarea
            className="input-surface min-h-[320px] w-full flex-1 resize-none rounded-lg p-md font-body-md text-body-md"
            placeholder={
              "Birinci gonderi metni #etiket\n---\nIkinci gonderi metni"
            }
            value={captionText}
            onChange={(event) => setCaptionText(event.target.value)}
          />
          <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
            {captions.length} metin algilandi · {media.length} gorsel
          </p>
        </div>

        <div className="col-span-12 space-y-md lg:col-span-4">
          <section className="panel-card p-md">
            <h2 className="mb-md font-headline-sm text-headline-sm text-primary">
              Planlama Alani
            </h2>
            <div className="space-y-md">
              <label className="block">
                <span className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">
                  Baslangic Tarihi
                </span>
                <input
                  className="input-surface w-full rounded-lg p-sm"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-sm">
                <label>
                  <span className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">
                    Saat
                  </span>
                  <input
                    className="input-surface w-full rounded-lg p-sm"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </label>
                <label>
                  <span className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">
                    Aralik
                  </span>
                  <select
                    className="input-surface w-full rounded-lg p-sm"
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value)}
                  >
                    <option value="daily">Her gun</option>
                    <option value="every_two_days">2 gunde bir</option>
                    <option value="weekly">Haftalik</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-sm font-body-sm text-body-sm">
                <input
                  type="checkbox"
                  checked={skipWeekends}
                  onChange={(event) => setSkipWeekends(event.target.checked)}
                />
                Hafta sonlarini atla
              </label>
              <button
                className="primary-button w-full rounded-lg py-md font-headline-sm text-headline-sm disabled:opacity-50"
                type="button"
                onClick={() => submit(false)}
                disabled={submitting}
              >
                <MaterialIcon name="schedule" />
                {submitting ? "Planlaniyor..." : "Planla"}
              </button>
              <button
                className="secondary-button w-full rounded-lg py-sm font-label-md text-label-md disabled:opacity-50"
                type="button"
                onClick={() => submit(true)}
                disabled={submitting}
              >
                Taslak Kaydet
              </button>
            </div>
          </section>
        </div>

        <section className="panel-card col-span-12 p-md lg:col-span-6">
          <h2 className="mb-md font-headline-sm text-headline-sm text-primary">
            Toplu Gorsel Yukleme
          </h2>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-48 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <MaterialIcon
              name={uploading ? "hourglass_top" : "cloud_upload"}
              className="mb-sm text-outline"
              size={40}
            />
            <p className="font-body-md text-body-md text-on-surface-variant">
              {uploading ? "Yukleniyor..." : "Gorsel secmek icin tiklayin"}
            </p>
            <p className="mt-xs font-label-sm text-label-sm text-outline">
              Maksimum 20MB · JPG, PNG, WEBP
            </p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => handleUpload(event.target.files)}
          />
        </section>

        <section className="panel-card col-span-12 p-md lg:col-span-6">
          <h2 className="mb-md font-headline-sm text-headline-sm text-primary">
            Gorsel Siralama
          </h2>
          {media.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Henuz gorsel yuklenmedi.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-sm sm:grid-cols-4">
              {media.map((item, index) => (
                <div
                  key={item.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-outline-variant bg-surface-container"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/media/${item.id}/file`}
                    alt={item.originalFileName}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => moveMedia(index, -1)}
                      className="text-white"
                      aria-label="Sola al"
                    >
                      <MaterialIcon name="chevron_left" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="text-white"
                      aria-label="Kaldir"
                    >
                      <MaterialIcon name="delete" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMedia(index, 1)}
                      className="text-white"
                      aria-label="Saga al"
                    >
                      <MaterialIcon name="chevron_right" size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel-card col-span-12 min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-sm border-b border-outline-variant p-md">
            <h2 className="font-headline-sm text-headline-sm text-primary">
              Eslestirme Onizlemesi
            </h2>
            {!match.balanced ? (
              <StatusBadge tone="warning">
                {match.missingMedia > 0
                  ? `${match.missingMedia} metne gorsel eksik`
                  : `${match.missingCaption} gorsele metin eksik`}
              </StatusBadge>
            ) : captions.length > 0 ? (
              <StatusBadge tone="success">Tum kartlar eslesti</StatusBadge>
            ) : null}
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[610px] text-left">
              <thead className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                <tr>
                  <th className="px-md py-sm">Sira #</th>
                  <th className="px-md py-sm">Metin Ozeti</th>
                  <th className="px-md py-sm">Gorsel</th>
                  <th className="px-md py-sm">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50 font-body-sm text-body-sm">
                {captions.map((caption, index) => {
                  const image = media[index];
                  return (
                    <tr key={caption.index}>
                      <td className="px-md py-sm font-bold">{index + 1}</td>
                      <td className="px-md py-sm">
                        <span className="line-clamp-1">{caption.caption}</span>
                      </td>
                      <td className="px-md py-sm">
                        {image ? (
                          <div className="relative h-12 w-12 overflow-hidden rounded bg-surface-container">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/media/${image.id}/file`}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-error/50 bg-surface-container">
                            <MaterialIcon
                              name="image_not_supported"
                              className="text-error"
                              size={18}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-md py-sm">
                        {image ? (
                          <StatusBadge tone="success">Hazir</StatusBadge>
                        ) : (
                          <StatusBadge tone="error">Gorsel Eksik</StatusBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
