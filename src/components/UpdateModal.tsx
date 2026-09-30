import { openUrl } from "@tauri-apps/plugin-opener";
import { useUpdateStore } from "../stores/updateStore";

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Update prompt + download/install progress for GitHub Releases updates. */
export function UpdateModal() {
  const { info, phase, progress, error, modalOpen, install, openStore, skipVersion, closeModal } =
    useUpdateStore();

  if (!modalOpen) return null;

  const working = phase === "downloading" || phase === "installing";
  const available = Boolean(info?.available);
  const snap = info?.managedBy === "snap";
  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  let title = "Atualizações";
  if (phase === "checking") title = "Verificando atualizações…";
  else if (phase === "error") title = "Não foi possível atualizar";
  else if (working) title = `Atualizando para ${info?.latestVersion ?? "nova versão"}`;
  else if (phase === "manual") title = "Instalador aberto";
  else if (available) title = `Gitorade ${info?.latestVersion} disponível`;
  else if (info) title = "Você está na versão mais recente";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gitorade-update-title"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[#3a3f4b] bg-[#1c1f26] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#2d3139] px-4 py-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#a371f7]/20 text-[12px] font-bold text-[#a371f7]">
            ↑
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="gitorade-update-title" className="text-[14px] font-medium text-[#f0f1f4]">
              {title}
            </h2>
            {info && (
              <p className="mt-0.5 text-[11px] text-[#8b909a]">
                Versão atual {info.currentVersion}
                {available ? ` · nova ${info.latestVersion}` : ""}
                {info.publishedAt
                  ? ` · publicada em ${new Date(info.publishedAt).toLocaleDateString()}`
                  : ""}
              </p>
            )}
          </div>
          {!working && (
            <button
              type="button"
              className="rounded px-1.5 text-[16px] leading-none text-[#6b7280] hover:bg-[#252830] hover:text-[#e8eaed]"
              onClick={closeModal}
              aria-label="Fechar"
            >
              ×
            </button>
          )}
        </div>

        <div className="space-y-3 px-4 py-3 text-[13px] leading-relaxed text-[#c8ccd4]">
          {phase === "checking" && <p className="text-[#8b909a]">Procurando novas versões…</p>}

          {phase === "error" && <p className="whitespace-pre-line text-[#ffb4b0]">{error}</p>}

          {working && (
            <div>
              <div className="h-2 overflow-hidden rounded bg-[#12141a]">
                <div
                  className={`h-full bg-[#a371f7] transition-all ${percent === null ? "animate-pulse" : ""}`}
                  style={{ width: `${phase === "installing" ? 100 : (percent ?? 30)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[#8b909a]">
                {phase === "installing"
                  ? "Instalando… o sistema pode pedir sua senha de administrador. O app reinicia ao terminar."
                  : progress
                    ? `Baixando ${formatBytes(progress.downloaded)}${
                        progress.total ? ` de ${formatBytes(progress.total)}` : ""
                      }${percent !== null ? ` (${percent}%)` : ""}`
                    : "Iniciando download…"}
              </p>
            </div>
          )}

          {phase === "manual" && (
            <p>
              O instalador foi aberto. Arraste o Gitorade para Aplicativos, feche esta janela e abra
              a nova versão.
            </p>
          )}

          {phase === "idle" && available && info?.notes.trim() && (
            <div className="max-h-64 overflow-auto rounded border border-[#2d3139] bg-[#12141a] px-3 py-2 text-[12px] whitespace-pre-wrap text-[#c8ccd4]">
              {info.notes.trim()}
            </div>
          )}

          {phase === "idle" && available && !snap && !info?.assetName && (
            <p className="text-[12px] text-[#e3b341]">
              Esta release não tem instalador para o seu sistema — baixe manualmente pelo GitHub.
            </p>
          )}

          {phase === "idle" && snap && available && (
            <p className="text-[12px]">
              Clique em <strong>Atualizar</strong> no App Center. Se ele avisar que o Gitorade está
              aberto, feche o app para concluir — a nova versão abre no próximo início.
            </p>
          )}

          {phase === "idle" && snap && !available && (
            <p className="text-[#8b909a]">
              Instalado pela Snap Store — o sistema também aplica as atualizações automaticamente.
            </p>
          )}

          {phase === "idle" && info && !available && !snap && (
            <p className="text-[#8b909a]">Nenhuma atualização disponível.</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[#2d3139] px-4 py-2.5">
          {info && !working && !snap && (
            <button
              type="button"
              className="text-[11px] text-[#8b909a] hover:text-[#e8eaed] hover:underline"
              onClick={() => void openUrl(info.releaseUrl)}
            >
              Ver no GitHub
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {phase === "idle" && available && (
              <button
                type="button"
                className="h-8 rounded border border-[#2d3139] px-3 text-[12px] text-[#8b909a] hover:bg-[#252830]"
                onClick={skipVersion}
              >
                Pular esta versão
              </button>
            )}
            {!working && (
              <button
                type="button"
                className="h-8 rounded border border-[#2d3139] px-3 text-[12px] text-[#c8ccd4] hover:bg-[#252830]"
                onClick={closeModal}
              >
                {available && phase === "idle" ? "Depois" : "Fechar"}
              </button>
            )}
            {phase === "idle" && available && snap && (
              <button
                type="button"
                autoFocus
                className="h-8 min-w-[120px] rounded border border-[#a371f7] bg-[#a371f7]/15 px-4 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/25"
                onClick={() => {
                  closeModal();
                  void openStore();
                }}
              >
                Abrir App Center
              </button>
            )}
            {((phase === "idle" && available && info?.assetName) || phase === "error") &&
              available &&
              !snap && (
                <button
                  type="button"
                  autoFocus
                  className="h-8 min-w-[120px] rounded border border-[#a371f7] bg-[#a371f7]/15 px-4 text-[12px] font-medium text-[#e8eaed] hover:bg-[#a371f7]/25"
                  onClick={() => void install()}
                >
                  {phase === "error" ? "Tentar de novo" : "Atualizar agora"}
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
