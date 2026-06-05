"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { StatusBadge } from "@/components/ui/status-badge";

type Platform = "INSTAGRAM" | "X" | "WORDPRESS";

type ContentStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELED"
  | "MANUAL_CHECK_REQUIRED";

type MediaFile = {
  id: string;
  originalFileName: string;
};

type ContentCard = {
  id: string;
  platform: Platform;
  accountId: string;
  mediaFileId: string | null;
  mediaFile: MediaFile | null;
  text: string | null;
  status: ContentStatus;
  scheduledAt: string | null;
  createdAt: string;
  platformData: string;
  errorMessage: string | null;
  manualCheckReason: string | null;
};

type AccountOption = {
  id: string;
  label: string;
  platform: Platform;
};

type RequestState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

const platformMeta: Record<
  Platform,
  { icon: string; iconClass: string; label: string }
> = {
  INSTAGRAM: {
    icon: "photo_camera",
    iconClass: "text-pink-600",
    label: "INSTAGRAM"
  },
  X: {
    icon: "share",
    iconClass: "text-blue-500",
    label: "X / TWITTER"
  },
  WORDPRESS: {
    icon: "web",
    iconClass: "text-green-700",
    label: "BLOG"
  }
};

const statusMeta: Record<
  ContentStatus,
  { label: string; tone: "success" | "warning" | "error" | "info" | "neutral" }
> = {
  CANCELED: { label: "İptal Edildi", tone: "neutral" },
  DRAFT: { label: "Taslak", tone: "neutral" },
  FAILED: { label: "Hata Oluştu", tone: "error" },
  MANUAL_CHECK_REQUIRED: { label: "Manuel Kontrol", tone: "warning" },
  PUBLISHED: { label: "Yayınlandı", tone: "success" },
  PUBLISHING: { label: "Yayınlanıyor", tone: "warning" },
  SCHEDULED: { label: "Planlandı", tone: "info" }
};

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Planlanmadı";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(value));
}

function cardTitle(card: ContentCard) {
  const platformData = safeJsonParse(card.platformData);

  if (card.platform === "WORDPRESS" && typeof platformData.title === "string") {
    return platformData.title;
  }

  return card.text?.slice(0, 80) || "İçerik kartı";
}

function cardDescription(card: ContentCard) {
  const platformData = safeJsonParse(card.platformData);

  if (
    card.platform === "WORDPRESS" &&
    typeof platformData.excerpt === "string" &&
    platformData.excerpt
  ) {
    return platformData.excerpt;
  }

  if (card.errorMessage) {
    return card.errorMessage;
  }

  return card.text || "Metin içeriği yok.";
}

export default function ContentPage() {
  const [cards, setCards] = useState<ContentCard[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [platform, setPlatform] = useState("");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestState, setRequestState] = useState<RequestState>(null);
  const [editCard, setEditCard] = useState<ContentCard | null>(null);
  const [editText, setEditText] = useState("");
  const [scheduleCard, setScheduleCard] = useState<ContentCard | null>(null);
  const [scheduleValue, setScheduleValue] = useState("");

  const accountLabelById = useMemo(
    () =>
      Object.fromEntries(
        accounts.map((account) => [account.id, account.label])
      ) as Record<string, string>,
    [accounts]
  );
  const filteredAccountOptions = accounts.filter(
    (account) => !platform || account.platform === platform
  );

  useEffect(() => {
    async function loadAccounts() {
      const [instagram, x, wordpress] = await Promise.all([
        fetch("/api/accounts/instagram").then((response) => response.json()),
        fetch("/api/accounts/x").then((response) => response.json()),
        fetch("/api/accounts/wordpress").then((response) => response.json())
      ]);

      setAccounts([
        ...(
          (instagram.data ?? []) as Array<{ id: string; username: string }>
        ).map((account) => ({
          id: account.id,
          label: `Instagram @${account.username}`,
          platform: "INSTAGRAM" as const
        })),
        ...((x.data ?? []) as Array<{ id: string; username: string }>).map(
          (account) => ({
            id: account.id,
            label: `X @${account.username}`,
            platform: "X" as const
          })
        ),
        ...((wordpress.data ?? []) as Array<{ id: string; name: string }>).map(
          (site) => ({
            id: site.id,
            label: `Blog ${site.name}`,
            platform: "WORDPRESS" as const
          })
        )
      ]);
    }

    loadAccounts().catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCards() {
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (platform) params.set("platform", platform);
        if (accountId) params.set("accountId", accountId);
        if (status) params.set("status", status);
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        const response = await fetch(`/api/content?${params.toString()}`);
        if (!active) return;

        const payload = (await response.json()) as {
          data?: ContentCard[];
          error?: string;
        };
        if (!active) return;

        if (!response.ok) {
          throw new Error(payload.error ?? "İçerikler alınamadı.");
        }

        setCards(payload.data ?? []);
      } catch (error) {
        if (!active) return;
        setRequestState({
          tone: "error",
          message:
            error instanceof Error ? error.message : "İçerikler alınamadı."
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCards().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [accountId, from, platform, status, to]);

  async function refreshCards() {
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);
    if (accountId) params.set("accountId", accountId);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const response = await fetch(`/api/content?${params.toString()}`);
    const payload = (await response.json()) as { data?: ContentCard[] };
    setCards(payload.data ?? []);
  }

  async function postAction(
    cardId: string,
    body: Record<string, unknown>,
    successMessage: string
  ) {
    try {
      const response = await fetch(`/api/content/${cardId}`, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "İşlem başarısız.");
      }

      setRequestState({ tone: "success", message: successMessage });
      await refreshCards();
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "İşlem başarısız."
      });
    }
  }

  async function deleteCard(card: ContentCard) {
    if (!window.confirm("Bu içerik kartı silinsin mi?")) {
      return;
    }

    try {
      const response = await fetch(`/api/content/${card.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Kart silinemedi.");
      }

      setRequestState({ tone: "success", message: "Kart silindi." });
      await refreshCards();
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "Kart silinemedi."
      });
    }
  }

  async function saveEdit() {
    if (!editCard) return;

    try {
      const response = await fetch(`/api/content/${editCard.id}`, {
        body: JSON.stringify({ text: editText }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Kart güncellenemedi.");
      }

      setEditCard(null);
      setRequestState({ tone: "success", message: "Kart güncellendi." });
      await refreshCards();
    } catch (error) {
      setRequestState({
        tone: "error",
        message: error instanceof Error ? error.message : "Kart güncellenemedi."
      });
    }
  }

  async function saveSchedule() {
    if (!scheduleCard || !scheduleValue) return;

    await postAction(
      scheduleCard.id,
      { action: "schedule", scheduledAt: scheduleValue },
      "Kart planlandı."
    );
    setScheduleCard(null);
    setScheduleValue("");
  }

  return (
    <AppShell title="Ortak İçerik Deposu">
      <div className="space-y-xl">
        <section className="flex flex-col justify-between gap-md md:flex-row md:items-end">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">
              Ortak İçerik Deposu
            </h1>
            <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
              Tüm platformlardaki içeriklerinizi tek bir merkezden yönetin.
            </p>
          </div>
          <div className="flex flex-wrap gap-sm">
            <a
              className="primary-button rounded-lg px-md py-sm font-label-md text-label-md"
              href="/instagram"
            >
              <MaterialIcon name="add" />
              Yeni İçerik
            </a>
          </div>
        </section>

        {requestState ? (
          <section
            className={`rounded-xl border p-md ${
              requestState.tone === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : requestState.tone === "error"
                  ? "border-error/20 bg-error-container text-on-error-container"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            <p className="font-body-sm text-body-sm">{requestState.message}</p>
          </section>
        ) : null}

        <section className="panel-card flex flex-wrap items-center gap-md p-md">
          <label className="flex min-w-[160px] flex-1 flex-col gap-xs">
            <span className="px-1 font-label-sm text-label-sm text-on-surface-variant">
              Platform
            </span>
            <select
              className="input-surface rounded-lg px-3 py-2 font-body-sm text-body-sm"
              value={platform}
              onChange={(event) => {
                setPlatform(event.target.value);
                setAccountId("");
              }}
            >
              <option value="">Tüm Platformlar</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="X">X / Twitter</option>
              <option value="WORDPRESS">Blog</option>
            </select>
          </label>

          <label className="flex min-w-[180px] flex-1 flex-col gap-xs">
            <span className="px-1 font-label-sm text-label-sm text-on-surface-variant">
              Hesap
            </span>
            <select
              className="input-surface rounded-lg px-3 py-2 font-body-sm text-body-sm"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Tüm Hesaplar</option>
              {filteredAccountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[160px] flex-1 flex-col gap-xs">
            <span className="px-1 font-label-sm text-label-sm text-on-surface-variant">
              Durum
            </span>
            <select
              className="input-surface rounded-lg px-3 py-2 font-body-sm text-body-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Hepsi</option>
              {Object.entries(statusMeta).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[150px] flex-1 flex-col gap-xs">
            <span className="px-1 font-label-sm text-label-sm text-on-surface-variant">
              Başlangıç
            </span>
            <input
              className="input-surface rounded-lg px-3 py-2 font-body-sm text-body-sm"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>

          <label className="flex min-w-[150px] flex-1 flex-col gap-xs">
            <span className="px-1 font-label-sm text-label-sm text-on-surface-variant">
              Bitiş
            </span>
            <input
              className="input-surface rounded-lg px-3 py-2 font-body-sm text-body-sm"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </section>

        <section className="grid grid-cols-1 gap-md md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="panel-card col-span-full p-xl text-center font-body-md text-body-md text-on-surface-variant">
              İçerikler yükleniyor...
            </div>
          ) : null}

          {!loading && cards.length === 0 ? (
            <div className="panel-card col-span-full flex min-h-[280px] flex-col items-center justify-center gap-sm p-xl text-center">
              <MaterialIcon
                name="inventory_2"
                className="text-outline"
                size={44}
              />
              <p className="font-headline-sm text-headline-sm text-primary">
                İçerik bulunamadı
              </p>
              <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">
                Seçili filtrelerde kayıt yok. Yeni içerikleri platform
                panellerinden oluşturabilirsiniz.
              </p>
            </div>
          ) : null}

          {cards.map((card, index) => {
            const meta = platformMeta[card.platform];
            const statusInfo = statusMeta[card.status];
            const title = cardTitle(card);
            const description = cardDescription(card);
            const isMuted = card.status === "CANCELED";
            const hasError = card.status === "FAILED";

            return (
              <article
                key={card.id}
                className={`overflow-hidden rounded-xl border bg-surface transition-all hover:-translate-y-1 hover:shadow-panel-sm ${
                  hasError
                    ? "border-error/30 shadow-sm"
                    : "border-outline-variant"
                } ${isMuted ? "opacity-70 grayscale hover:grayscale-0" : ""}`}
              >
                <div className="relative h-48 overflow-hidden bg-surface-container-low">
                  {card.mediaFileId ? (
                    <Image
                      src={`/api/media/${card.mediaFileId}/file`}
                      alt={card.mediaFile?.originalFileName ?? title}
                      fill
                      unoptimized
                      loading={index === 0 ? "eager" : "lazy"}
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-base text-on-surface-variant">
                      <MaterialIcon name="article" size={48} />
                      <span className="font-label-md text-label-md">
                        Medya Yok
                      </span>
                    </div>
                  )}

                  <div className="absolute left-sm top-sm flex items-center gap-xs rounded-full bg-white/90 px-2 py-1 shadow-sm backdrop-blur-sm">
                    <MaterialIcon
                      name={meta.icon}
                      className={meta.iconClass}
                      fill
                      size={16}
                    />
                    <span className="text-[10px] font-bold text-on-surface">
                      {meta.label}
                    </span>
                  </div>
                  <div className="absolute bottom-sm right-sm">
                    <StatusBadge tone={statusInfo.tone}>
                      {statusInfo.label}
                    </StatusBadge>
                  </div>
                </div>

                <div className="p-md">
                  <div className="mb-base flex items-center gap-sm">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                      {meta.label[0]}
                    </div>
                    <span className="truncate font-label-md text-label-md">
                      {accountLabelById[card.accountId] ?? card.accountId}
                    </span>
                  </div>
                  <h2 className="mb-xs line-clamp-1 font-headline-sm text-headline-sm">
                    {title}
                  </h2>
                  <p
                    className={`mb-md line-clamp-2 font-body-sm text-body-sm ${
                      hasError ? "text-error" : "text-on-surface-variant"
                    }`}
                  >
                    {description}
                  </p>

                  <div className="border-t border-outline-variant pt-md">
                    <div className="mb-sm flex items-center gap-xs text-on-surface-variant">
                      <MaterialIcon name="schedule" size={16} />
                      <span className="text-[12px]">
                        {formatDateTime(card.scheduledAt)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-xs">
                      <button
                        className="secondary-button px-2.5 py-1.5 font-label-sm text-label-sm"
                        type="button"
                        onClick={() => {
                          setEditCard(card);
                          setEditText(card.text ?? "");
                        }}
                      >
                        <MaterialIcon name="edit" size={16} />
                        Düzenle
                      </button>
                      {card.status !== "PUBLISHED" &&
                      card.status !== "PUBLISHING" ? (
                        <button
                          className="secondary-button px-2.5 py-1.5 font-label-sm text-label-sm"
                          type="button"
                          onClick={() => {
                            setScheduleCard(card);
                            setScheduleValue("");
                          }}
                        >
                          <MaterialIcon name="schedule_send" size={16} />
                          Planla
                        </button>
                      ) : null}
                      {card.status !== "PUBLISHED" ? (
                        <button
                          className="secondary-button px-2.5 py-1.5 font-label-sm text-label-sm"
                          type="button"
                          onClick={() =>
                            postAction(
                              card.id,
                              { action: "cancel" },
                              "Kart iptal edildi."
                            )
                          }
                        >
                          <MaterialIcon name="cancel" size={16} />
                          İptal
                        </button>
                      ) : null}
                      {card.status === "FAILED" ||
                      card.status === "CANCELED" ? (
                        <button
                          className="secondary-button px-2.5 py-1.5 font-label-sm text-label-sm"
                          type="button"
                          onClick={() =>
                            postAction(
                              card.id,
                              { action: "retry" },
                              "Kart tekrar deneme kuyruğuna alındı."
                            )
                          }
                        >
                          <MaterialIcon name="refresh" size={16} />
                          Tekrar Dene
                        </button>
                      ) : null}
                      {card.status === "MANUAL_CHECK_REQUIRED" ? (
                        <button
                          className="secondary-button px-2.5 py-1.5 font-label-sm text-label-sm"
                          type="button"
                          onClick={() =>
                            postAction(
                              card.id,
                              { action: "manual_check", requeue: true },
                              "Manuel kontrol çözüldü ve kart kuyruğa alındı."
                            )
                          }
                        >
                          <MaterialIcon name="task_alt" size={16} />
                          Kuyruğa Al
                        </button>
                      ) : null}
                      <button
                        className="secondary-button px-2.5 py-1.5 font-label-sm text-label-sm text-error hover:bg-error-container/20"
                        type="button"
                        onClick={() => deleteCard(card)}
                      >
                        <MaterialIcon name="delete" size={16} />
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        {editCard ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-md">
            <section className="panel-card w-full max-w-lg space-y-md p-md shadow-panel">
              <h2 className="font-headline-sm text-headline-sm">
                Kartı Düzenle
              </h2>
              <textarea
                className="input-surface min-h-[180px] w-full resize-none rounded-lg p-md font-body-md text-body-md"
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
              />
              <div className="flex justify-end gap-sm">
                <button
                  className="secondary-button px-md py-sm font-label-md text-label-md"
                  type="button"
                  onClick={() => setEditCard(null)}
                >
                  Vazgeç
                </button>
                <button
                  className="primary-button px-md py-sm font-label-md text-label-md"
                  type="button"
                  onClick={saveEdit}
                >
                  Kaydet
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {scheduleCard ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-md">
            <section className="panel-card w-full max-w-md space-y-md p-md shadow-panel">
              <h2 className="font-headline-sm text-headline-sm">Planla</h2>
              <input
                className="input-surface w-full rounded-lg px-md py-sm font-body-md text-body-md"
                type="datetime-local"
                value={scheduleValue}
                onChange={(event) => setScheduleValue(event.target.value)}
              />
              <div className="flex justify-end gap-sm">
                <button
                  className="secondary-button px-md py-sm font-label-md text-label-md"
                  type="button"
                  onClick={() => setScheduleCard(null)}
                >
                  Vazgeç
                </button>
                <button
                  className="primary-button px-md py-sm font-label-md text-label-md disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!scheduleValue}
                  type="button"
                  onClick={saveSchedule}
                >
                  Planla
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
