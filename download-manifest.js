export function createCatalogDownloads(expectedDownloads, assets, version, publicBaseUrl) {
  const uploadedAssets = new Map(assets.map((asset) => [asset.id, asset]));
  return expectedDownloads.map((item) => {
    const asset = uploadedAssets.get(item.id);
    return {
      ...item,
      url: asset
        ? `${publicBaseUrl}/releases/v${version}/${asset.fileName.split("/").map(encodeURIComponent).join("/")}`
        : "",
      sizeBytes: asset?.sizeBytes ?? null,
      sha256: asset?.sha256 ?? ""
    };
  });
}
