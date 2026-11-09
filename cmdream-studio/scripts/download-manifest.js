const GITHUB_REPOSITORY = "official-mano/cmdream-studio";

export function createCatalogDownloads(expectedDownloads, assets, version) {
  const uploadedAssets = new Map(assets.map((asset) => [asset.id, asset]));
  return expectedDownloads.map((item) => {
    const asset = uploadedAssets.get(item.id);
    return {
      ...item,
      url: asset
        ? `https://github.com/${GITHUB_REPOSITORY}/releases/download/v${version}/${encodeURIComponent(asset.fileName)}`
        : "",
      sizeBytes: asset?.sizeBytes ?? null,
      sha256: asset?.sha256 ?? ""
    };
  });
}
