import { useEffect, useState } from "react";
import { ExternalLink, HelpCircle, ScrollText, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Tab = "usage" | "terms";

type FontEntry = {
  key:
    | "GenYoMin2TW"
    | "IBMPlexSans"
    | "DelaGothicOne"
    | "Jersey10"
    | "ChenYuluoyanThin"
    | "BpmfZihiKaiStd";
  repo: string;
  license: string;
  /** i18n key for the license link text; defaults to OFL 1.1. */
  licenseLabel?: string;
  basedOn?: string;
  /** i18n key for the based-on link text; defaults to Source Han Serif. */
  basedOnLabel?: string;
};

const FONTS: FontEntry[] = [
  {
    key: "GenYoMin2TW",
    repo: "https://github.com/ButTaiwan/genyo-font",
    license: "https://github.com/ButTaiwan/genyo-font/blob/master/SIL_Open_Font_License_1.1.txt",
    basedOn: "https://github.com/adobe-fonts/source-han-serif",
  },
  {
    key: "IBMPlexSans",
    repo: "https://github.com/IBM/plex",
    license: "https://github.com/IBM/plex/blob/master/LICENSE.txt",
  },
  {
    key: "DelaGothicOne",
    repo: "https://fonts.google.com/specimen/Dela+Gothic+One",
    license: "https://fonts.google.com/specimen/Dela+Gothic+One/license",
  },
  {
    key: "Jersey10",
    repo: "https://github.com/scfried/soft-type-jersey",
    // Bundled next to the font file, same as BpmfZihiKaiStd: the OFL text
    // shipped in the release is the authoritative copy.
    license: `${import.meta.env.BASE_URL}fonts/Jersey10/OFL.txt`,
  },
  {
    key: "ChenYuluoyanThin",
    repo: "https://github.com/Chenyu-otf/chenyuluoyan_thin",
    license: "https://github.com/Chenyu-otf/chenyuluoyan_thin/blob/main/license.txt",
  },
  {
    key: "BpmfZihiKaiStd",
    repo: "https://github.com/ButTaiwan/bpmfvs",
    // Bundled alongside the font file — the release zip is the authoritative
    // license source (the repo has no standalone license page for this font).
    license: `${import.meta.env.BASE_URL}fonts/BpmfZihiKaiStd/LICENSE-ZihiKaiStd.txt`,
    licenseLabel: "help.terms.license.bpmfZihiKai",
    basedOn: "https://data.gov.tw/dataset/5961",
    basedOnLabel: "help.terms.twKai",
  },
];

type EmojiEntry = {
  key: "noto" | "twemoji" | "apple";
  repo?: string;
  license?: string;
  /** i18n key for the license link text; defaults to OFL 1.1. */
  licenseLabel?: string;
};

const EMOJI_CREDITS: EmojiEntry[] = [
  {
    key: "noto",
    repo: "https://github.com/googlefonts/noto-emoji",
    license: "https://fonts.google.com/noto/specimen/Noto+Color+Emoji/license",
  },
  {
    key: "twemoji",
    repo: "https://github.com/mozilla/twemoji-colr",
    license: "https://creativecommons.org/licenses/by/4.0/",
    licenseLabel: "help.terms.license.ccby",
  },
  // Apple carries no repo / license link on purpose: the artwork isn't offered
  // under an open license, and the card text says exactly that.
  { key: "apple" },
];

export function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("usage");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden border bg-card text-card-foreground shadow-xl sm:h-[min(640px,90vh)] sm:max-w-lg sm:rounded-xl"
      >
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <HelpCircle className="h-4 w-4 text-primary" />
          <div className="flex-1 truncate text-sm font-semibold">
            {t("help.button")}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("help.close")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex border-b px-3 py-2">
          <Tab
            label={t("help.tab.usage")}
            icon={<HelpCircle className="h-3.5 w-3.5" />}
            active={tab === "usage"}
            onClick={() => setTab("usage")}
          />
          <Tab
            label={t("help.tab.terms")}
            icon={<ScrollText className="h-3.5 w-3.5" />}
            active={tab === "terms"}
            onClick={() => setTab("terms")}
          />
        </div>

        <div className="flex-1 overflow-auto px-4 py-4 text-sm leading-relaxed">
          {tab === "usage" ? <UsagePage /> : <TermsPage />}
        </div>

        <footer className="border-t px-4 py-2 text-center text-[11px] text-muted-foreground pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          © {new Date().getFullYear()} @cppdesigns
        </footer>
      </div>
    </div>
  );
}

function Tab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function UsagePage() {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <Section title={t("help.usage.title")} />
      <Block
        title={t("help.usage.pure.title")}
        body={t("help.usage.pure.body")}
      />
      {/* <Block
        title={t("help.usage.image.title")}
        body={t("help.usage.image.body")}
      /> */}
      <ShareBlock />
      <Block
        title={t("help.usage.animation.title")}
        body={t("help.usage.animation.body")}
      />
      <Block
        title={t("help.usage.tips.title")}
        body={t("help.usage.tips.body")}
      />
    </div>
  );
}

const SHORTCUT_STEPS = ["s1", "s2", "s3", "s4", "s5"] as const;

/**
 * Share-target help, mostly platform caveats: the feature needs an installed
 * PWA, and iOS has no web share targets at all.
 */
function ShareBlock() {
  const { t } = useI18n();

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">
        {t("help.usage.share.title")}
      </h3>
      <p className="text-muted-foreground">{t("help.usage.share.body")}</p>

      <div className="mt-2 space-y-3 rounded-lg border bg-background/60 p-3">
        <div>
          <div className="text-xs font-semibold">
            {t("help.usage.share.android.title")}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("help.usage.share.android.body")}
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold">
            {t("help.usage.share.ios.title")}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("help.usage.share.ios.body")}
          </p>
          <div className="mt-2 text-xs font-medium">
            {t("help.usage.share.ios.shortcut.title")}
          </div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
            {SHORTCUT_STEPS.map((step) => (
              <li key={step} className="break-words">
                {t(`help.usage.share.ios.shortcut.${step}`)}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("help.usage.share.ios.alt")}
          </p>
        </div>
      </div>
    </div>
  );
}

function TermsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <Section title={t("help.terms.title")} />
      <p className="text-muted-foreground">{t("help.terms.intro")}</p>

      <div className="space-y-3">
        {FONTS.map((f) => (
          <div
            key={f.key}
            className="rounded-lg border bg-background/60 p-3 shadow-sm"
          >
            <div className="text-sm font-semibold">
              {t(`help.terms.font.${f.key}.title`)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`help.terms.font.${f.key}.desc`)}
            </p>
            <dl className="mt-2 space-y-1 text-[12px]">
              <Row
                label={t("help.terms.label.repo")}
                value={
                  <ExtLink href={f.repo}>
                    {f.repo.replace("https://", "")}
                  </ExtLink>
                }
              />
              <Row
                label={t("help.terms.label.license")}
                value={
                  <ExtLink href={f.license}>
                    {t(f.licenseLabel ?? "help.terms.license.ofl")}
                  </ExtLink>
                }
              />
              {f.basedOn && (
                <Row
                  label={t("help.terms.label.basedOn")}
                  value={
                    <ExtLink href={f.basedOn}>
                      {t(f.basedOnLabel ?? "help.terms.sourceHan")}
                    </ExtLink>
                  }
                />
              )}
            </dl>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">
            {t("help.terms.emoji.title")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("help.terms.emoji.intro")}
          </p>
        </div>
        {EMOJI_CREDITS.map((e) => (
          <div
            key={e.key}
            className="rounded-lg border bg-background/60 p-3 shadow-sm"
          >
            <div className="text-sm font-semibold">
              {t(`help.terms.emoji.${e.key}.title`)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`help.terms.emoji.${e.key}.desc`)}
            </p>
            {(e.repo || e.license) && (
              <dl className="mt-2 space-y-1 text-[12px]">
                {e.repo && (
                  <Row
                    label={t("help.terms.label.repo")}
                    value={
                      <ExtLink href={e.repo}>
                        {e.repo.replace("https://", "")}
                      </ExtLink>
                    }
                  />
                )}
                {e.license && (
                  <Row
                    label={t("help.terms.label.license")}
                    value={
                      <ExtLink href={e.license}>
                        {t(e.licenseLabel ?? "help.terms.license.ofl")}
                      </ExtLink>
                    }
                  />
                )}
              </dl>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-background/60 p-3 shadow-sm">
        <div className="text-sm font-semibold">
          {t("help.terms.custom.title")}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("help.terms.custom.body")}
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="text-xs font-semibold">
          {t("help.terms.disclaimer.title")}
        </div>
        <p className="mt-1 text-[12px] leading-relaxed">
          {t("help.terms.disclaimer.body")}
        </p>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <h2 className="text-base font-semibold tracking-tight">{title}</h2>;
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{value}</dd>
    </div>
  );
}

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}
