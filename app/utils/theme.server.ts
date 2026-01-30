/**
 * Theme Utilities - GraphQL Version
 * All theme operations use Admin GraphQL API
 */

// Types
export interface ThemeInfo {
  id: string;
  name: string;
  role: string;
}

export interface ThemeFile {
  filename: string;
  contentType: string;
  body: string | null;
}

export interface ThemeData {
  theme: ThemeInfo;
  files: ThemeFile[];
  templates: Record<string, any>;
  sections: Record<string, string>;
  config: {
    settings_schema: any;
    settings_data: any;
  };
}

// ============================================
// THEME QUERIES
// ============================================

export async function getAllThemes(admin: any): Promise<ThemeInfo[]> {
  try {
    const response = await admin.graphql(`
      query {
        themes(first: 50) {
          nodes {
            id
            name
            role
          }
        }
      }
    `);
    const data = await response.json();
    return data.data?.themes?.nodes?.map((theme: any) => ({
      id: theme.id,
      name: theme.name,
      role: theme.role.toLowerCase()
    })) || [];
  } catch (error) {
    console.error("[Theme] Error fetching themes:", error);
    return [];
  }
}

export async function getActiveThemeId(admin: any): Promise<string | null> {
  try {
    const response = await admin.graphql(`
      query {
        themes(first: 10, roles: [MAIN]) {
          nodes {
            id
            name
            role
          }
        }
      }
    `);
    const data = await response.json();
    const mainTheme = data.data?.themes?.nodes?.[0];
    if (mainTheme) {
      return mainTheme.id.replace('gid://shopify/OnlineStoreTheme/', '').replace('gid://shopify/Theme/', '');
    }
    return null;
  } catch (error) {
    console.error("[Theme] Error fetching active theme:", error);
    return null;
  }
}

export async function getThemeById(admin: any, themeId: string): Promise<ThemeInfo | null> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/OnlineStoreTheme/${themeId}`;

    const response = await admin.graphql(`
      query GetTheme($id: ID!) {
        theme(id: $id) {
          id
          name
          role
        }
      }
    `, {
      variables: { id: gid }
    });

    const data = await response.json();
    const theme = data.data?.theme;

    if (theme) {
      return {
        id: theme.id,
        name: theme.name,
        role: theme.role.toLowerCase()
      };
    }
    return null;
  } catch (error) {
    console.error("[Theme] Error fetching theme by ID:", error);
    return null;
  }
}

// ============================================
// THEME FILE OPERATIONS
// ============================================

export async function getThemeAsset(admin: any, themeId: string, key: string): Promise<any> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/OnlineStoreTheme/${themeId}`;

    const response = await admin.graphql(`
      query GetThemeAsset($themeId: ID!, $files: [String!]!) {
        theme(id: $themeId) {
          id
          files(filenames: $files, first: 1) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
              }
            }
          }
        }
      }
    `, {
      variables: {
        themeId: gid,
        files: [key]
      }
    });

    const data = await response.json();
    const fileNode = data.data?.theme?.files?.nodes?.[0];

    if (fileNode?.body?.content) {
      try {
        return JSON.parse(fileNode.body.content);
      } catch {
        return fileNode.body.content;
      }
    }
    return null;
  } catch (error) {
    console.error(`[Theme] Error fetching asset ${key}:`, error);
    return null;
  }
}

export async function getThemeFiles(admin: any, themeId: string, filenames: string[]): Promise<ThemeFile[]> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/OnlineStoreTheme/${themeId}`;

    const response = await admin.graphql(`
      query GetThemeFiles($themeId: ID!, $files: [String!]!) {
        theme(id: $themeId) {
          id
          files(filenames: $files, first: 250) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
                ... on OnlineStoreThemeFileBodyBase64 {
                  contentBase64
                }
              }
            }
          }
        }
      }
    `, {
      variables: {
        themeId: gid,
        files: filenames
      }
    });

    const data = await response.json();
    const nodes = data.data?.theme?.files?.nodes || [];

    return nodes.map((node: any) => ({
      filename: node.filename,
      contentType: node.filename.endsWith('.json') ? 'application/json' : 'text/plain',
      body: node.body?.content || node.body?.contentBase64 || null
    }));
  } catch (error) {
    console.error("[Theme] Error fetching theme files:", error);
    return [];
  }
}

export async function listThemeFiles(admin: any, themeId: string): Promise<string[]> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/OnlineStoreTheme/${themeId}`;

    const response = await admin.graphql(`
      query ListThemeFiles($themeId: ID!) {
        theme(id: $themeId) {
          id
          files(first: 250) {
            nodes {
              filename
            }
          }
        }
      }
    `, {
      variables: { themeId: gid }
    });

    const data = await response.json();
    return data.data?.theme?.files?.nodes?.map((n: any) => n.filename) || [];
  } catch (error) {
    console.error("[Theme] Error listing theme files:", error);
    return [];
  }
}

// ============================================
// DOWNLOAD FULL THEME DATA
// ============================================

export async function downloadThemeData(admin: any, themeId: string): Promise<ThemeData | null> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/OnlineStoreTheme/${themeId}`;

    // Get theme info
    const themeInfo = await getThemeById(admin, themeId);
    if (!themeInfo) {
      throw new Error("Theme not found");
    }

    // List all files
    const allFiles = await listThemeFiles(admin, themeId);

    // Filter relevant files
    const templateFiles = allFiles.filter(f => f.startsWith('templates/') && f.endsWith('.json'));
    const sectionFiles = allFiles.filter(f => f.startsWith('sections/') && f.endsWith('.liquid'));
    const configFiles = ['config/settings_schema.json', 'config/settings_data.json'];

    // Fetch template JSONs
    const templates: Record<string, any> = {};
    if (templateFiles.length > 0) {
      const templateData = await getThemeFiles(admin, themeId, templateFiles);
      for (const file of templateData) {
        if (file.body) {
          try {
            templates[file.filename] = JSON.parse(file.body);
          } catch {
            templates[file.filename] = file.body;
          }
        }
      }
    }

    // Fetch section liquid files (we just need filenames for now)
    const sections: Record<string, string> = {};
    for (const filename of sectionFiles) {
      sections[filename] = filename;
    }

    // Fetch config files
    const configData = await getThemeFiles(admin, themeId, configFiles);
    const config = {
      settings_schema: null as any,
      settings_data: null as any
    };

    for (const file of configData) {
      if (file.body) {
        try {
          const parsed = JSON.parse(file.body);
          if (file.filename === 'config/settings_schema.json') {
            config.settings_schema = parsed;
          } else if (file.filename === 'config/settings_data.json') {
            config.settings_data = parsed;
          }
        } catch {
          console.error(`[Theme] Failed to parse ${file.filename}`);
        }
      }
    }

    // Get all theme files for full download
    const allFilesData = await getThemeFiles(admin, themeId, allFiles);

    return {
      theme: themeInfo,
      files: allFilesData,
      templates,
      sections,
      config
    };
  } catch (error) {
    console.error("[Theme] Error downloading theme data:", error);
    return null;
  }
}

// ============================================
// SAVE/UPDATE THEME FILES
// ============================================

export async function saveThemeAsset(admin: any, themeId: string, key: string, value: string): Promise<void> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/OnlineStoreTheme/${themeId}`;

    const response = await admin.graphql(`
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        themeId: gid,
        files: [{
          filename: key,
          body: {
            type: "TEXT",
            value: value
          }
        }]
      }
    });

    const data = await response.json();

    if (data.data?.themeFilesUpsert?.userErrors?.length > 0) {
      throw new Error(data.data.themeFilesUpsert.userErrors[0].message);
    }

    console.log(`[Theme] Saved asset: ${key} to theme ${themeId}`);
  } catch (error) {
    console.error(`[Theme] Error saving asset ${key}:`, error);
    throw error;
  }
}

export async function saveThemeAssets(admin: any, themeId: string, files: Array<{key: string, value: string}>): Promise<void> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/OnlineStoreTheme/${themeId}`;

    const fileInputs = files.map(f => ({
      filename: f.key,
      body: {
        type: "TEXT",
        value: f.value
      }
    }));

    const response = await admin.graphql(`
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        themeId: gid,
        files: fileInputs
      }
    });

    const data = await response.json();

    if (data.data?.themeFilesUpsert?.userErrors?.length > 0) {
      throw new Error(data.data.themeFilesUpsert.userErrors[0].message);
    }

    console.log(`[Theme] Saved ${files.length} assets to theme ${themeId}`);
  } catch (error) {
    console.error("[Theme] Error saving assets:", error);
    throw error;
  }
}

// ============================================
// DRAFT THEME OPERATIONS
// ============================================

export async function createDraftTheme(admin: any, sourceName: string): Promise<string | null> {
  try {
    const draftName = `${sourceName} - VSBuilder Draft (${new Date().toLocaleString()})`;

    const response = await admin.graphql(`
      mutation themeCreate($name: String!, $role: ThemeRole!) {
        themeCreate(name: $name, role: $role) {
          theme {
            id
            name
            role
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        name: draftName,
        role: "UNPUBLISHED"
      }
    });

    const data = await response.json();

    if (data.data?.themeCreate?.userErrors?.length > 0) {
      throw new Error(data.data.themeCreate.userErrors[0].message);
    }

    const newTheme = data.data?.themeCreate?.theme;
    if (newTheme) {
      console.log(`[Theme] Created draft theme: ${newTheme.name} (${newTheme.id})`);
      return newTheme.id;
    }

    return null;
  } catch (error) {
    console.error("[Theme] Error creating draft theme:", error);
    return null;
  }
}

export async function duplicateThemeAsDraft(admin: any, sourceThemeId: string): Promise<string | null> {
  try {
    const gid = sourceThemeId.includes('gid://') ? sourceThemeId : `gid://shopify/OnlineStoreTheme/${sourceThemeId}`;

    // Get source theme info
    const sourceTheme = await getThemeById(admin, sourceThemeId);
    if (!sourceTheme) {
      throw new Error("Source theme not found");
    }

    const draftName = `${sourceTheme.name} - VSBuilder Draft`;

    const response = await admin.graphql(`
      mutation themeCopy($id: ID!, $name: String!) {
        themeCopy(id: $id, name: $name) {
          theme {
            id
            name
            role
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        id: gid,
        name: draftName
      }
    });

    const data = await response.json();

    if (data.data?.themeCopy?.userErrors?.length > 0) {
      throw new Error(data.data.themeCopy.userErrors[0].message);
    }

    const newTheme = data.data?.themeCopy?.theme;
    if (newTheme) {
      console.log(`[Theme] Duplicated theme as draft: ${newTheme.name} (${newTheme.id})`);
      return newTheme.id;
    }

    return null;
  } catch (error) {
    console.error("[Theme] Error duplicating theme:", error);
    return null;
  }
}

export async function getOrCreateDraftTheme(admin: any, sourceThemeId: string): Promise<{draftId: string, isNew: boolean} | null> {
  try {
    const sourceTheme = await getThemeById(admin, sourceThemeId);
    if (!sourceTheme) {
      throw new Error("Source theme not found");
    }

    // Check if a draft already exists for this source
    const allThemes = await getAllThemes(admin);
    const existingDraft = allThemes.find(t =>
      t.name.includes(sourceTheme.name) &&
      t.name.includes('VSBuilder Draft') &&
      t.role === 'unpublished'
    );

    if (existingDraft) {
      console.log(`[Theme] Found existing draft: ${existingDraft.name}`);
      return { draftId: existingDraft.id, isNew: false };
    }

    // Create new draft
    const draftId = await duplicateThemeAsDraft(admin, sourceThemeId);
    if (draftId) {
      return { draftId, isNew: true };
    }

    return null;
  } catch (error) {
    console.error("[Theme] Error getting/creating draft:", error);
    return null;
  }
}

// ============================================
// TEMPLATE DATA HELPERS
// ============================================

export function parseTemplateData(templateJson: any): { sections: Record<string, any>, order: string[] } {
  if (!templateJson) {
    return { sections: {}, order: [] };
  }

  // Handle both old and new template formats
  if (templateJson.sections && templateJson.order) {
    return {
      sections: templateJson.sections,
      order: templateJson.order
    };
  }

  // Layout-based template format
  if (templateJson.layout) {
    return {
      sections: templateJson.sections || {},
      order: templateJson.order || Object.keys(templateJson.sections || {})
    };
  }

  return { sections: {}, order: [] };
}

export function serializeTemplateData(sections: Record<string, any>, order: string[]): object {
  return {
    sections,
    order
  };
}
