import { useUpdateStore } from "../stores/updateStore";

/** Corner notice shown when a background check finds a new version. */
export function UpdateBanner() {
  const { info, bannerOpen, modalOpen, update, openDetails, dismissBanner } = useUpdateStore();

  if (!bannerOpen || modalOpen || !info?.available) return null;

  const snap = info.managedBy === "snap";
  const primary = snap ? "Abrir App Center" : info.assetName ? "Atualizar agora" : "Ver detalhes";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-[110] w-[320px] rounded-lg border border-[#3a3f4b] bg-[#1c1f26] shadow-2xl shadow-black/50"
    >
      <div className="flex items-start gap-3 px-3.5 pt-3">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#a371f7]/20 text-[12px] font-bold text-[#a371f7]">
          ↑
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[#f0f1f4]">
            Gitorade {info.latestVersion} disponível
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#8b909a]">
            {snap
              ? `Você está na ${info.currentVersion}. Atualize pelo App Center do Ubuntu.`
              : `Você está na ${info.currentVersion}.`}
          </p>
        </div>
        <button
          type="button"
          className="rounded px-1.5 text-[16px] leading-none text-[#6b7280] hover:bg-[#252830] hover:text-[#e8eaed]"
          onClick={dismissBanner}
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
      <div className="flex justify-end gap-2 px-3.5 py-2.5">
        {(snap || info.assetName) && (
          <button
            type="button"
            className="h-7 rounded border border-[#2d3139] px-2.5 text-[11px] text-[#c8ccd4] hover:bg-[#252830]"
            onClick={openDetails}
          >
            Novidades
          </button>
        )}
        <button
          type="button"
          className="h-7 rounded border border-[#a371f7] bg-[#a371f7]/15 px-3 text-[11px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/25"
          onClick={() => void update()}
        >
          {primary}
        </button>
      </div>
    </div>
  );
}
