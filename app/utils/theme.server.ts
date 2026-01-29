
export async function getActiveThemeId(admin: any) {
  const themes = await admin.rest.resources.Theme.all({
    session: admin.session,
  });
  const mainTheme = themes.data.find((theme: any) => theme.role === "main");
  return mainTheme?.id;
}

export async function getThemeAsset(admin: any, themeId: string, key: string) {
  try {
    const assets = await admin.rest.resources.Asset.all({
      session: admin.session,
      theme_id: themeId,
      asset: { key },
    });
    return JSON.parse(assets.data[0].value);
  } catch (error) {
    console.error(`Error fetching asset ${key}:`, error);
    return null;
  }
}

export async function saveThemeAsset(admin: any, themeId: string, key: string, value: string) {
  const asset = new admin.rest.resources.Asset({ session: admin.session });
  asset.theme_id = themeId;
  asset.key = key;
  asset.value = value;
  await asset.save({ update: true });
}
