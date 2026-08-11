const REPO = "htaraujo5/gitorade";
const RELEASES_LATEST = `https://github.com/${REPO}/releases/latest`;
const API_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;

const downloadBtn = document.getElementById("download-btn");
const downloadLabel = document.getElementById("download-label");
const downloadMeta = document.getElementById("download-meta");
const downloadHint = document.getElementById("download-hint");
const footerRelease = document.getElementById("footer-release");

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
  if (platform.includes("win") || ua.includes("windows")) return "windows";
  if (platform.includes("linux") || ua.includes("linux")) return "linux";
  if (platform.includes("mac") || ua.includes("mac")) return "mac";
  return "other";
}

function pickAsset(assets, platform) {
  if (!Array.isArray(assets)) return null;
  if (platform === "linux") {
    return assets.find((a) => /\.deb$/i.test(a.name)) || null;
  }
  if (platform === "windows") {
    const exes = assets.filter((a) => /\.exe$/i.test(a.name));
    return (
      exes.find((a) => /setup/i.test(a.name)) ||
      exes[0] ||
      assets.find((a) => /\.msi$/i.test(a.name)) ||
      null
    );
  }
  if (platform === "mac") {
    return assets.find((a) => /\.dmg$/i.test(a.name)) || null;
  }
  return null;
}

function labelFor(platform) {
  if (platform === "linux") return "Baixar para Linux";
  if (platform === "windows") return "Baixar para Windows";
  if (platform === "mac") return "Baixar para macOS";
  return "Ver releases";
}

async function wireLatestRelease() {
  const platform = detectPlatform();
  if (downloadLabel) downloadLabel.textContent = labelFor(platform);

  try {
    const res = await fetch(API_LATEST, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    const tag = data.tag_name || data.name || "latest";
    const asset = pickAsset(data.assets, platform);
    const href = asset?.browser_download_url || data.html_url || RELEASES_LATEST;

    if (downloadBtn) downloadBtn.href = href;
    if (downloadMeta) {
      const kind =
        platform === "linux" ? ".deb" : platform === "mac" ? ".dmg" : "instalador";
      downloadMeta.textContent = asset ? `${tag} · ${kind}` : `${tag} · releases`;
    }
    if (footerRelease) footerRelease.href = data.html_url || RELEASES_LATEST;
    if (downloadHint && asset) {
      downloadHint.hidden = false;
      downloadHint.textContent = asset.name;
    }
  } catch {
    if (downloadBtn) downloadBtn.href = RELEASES_LATEST;
    if (downloadMeta) downloadMeta.textContent = "release mais recente";
    if (footerRelease) footerRelease.href = RELEASES_LATEST;
  }
}

wireLatestRelease();
