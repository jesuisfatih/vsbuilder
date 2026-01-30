/**
 * 🏛️ THEME UTILITIES - Production Ready
 * Complete theme download, parse, and save functionality
 * Using Shopify Admin GraphQL API
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ThemeInfo {
  id: string;
  numericId: string;
  name: string;
  role: string;
}

export interface ThemeFile {
  filename: string;
  content: string | null;
}

export interface SectionData {
  type: string;
  settings?: Record<string, unknown>;
  blocks?: Record<string, BlockData>;
  block_order?: string[];
  disabled?: boolean;
}

export interface BlockData {
  type: string;
  settings?: Record<string, unknown>;
  disabled?: boolean;
}

export interface SectionGroup {
  name?: string;
  type?: string;
  sections: Record<string, SectionData>;
  order: string[];
}

export interface TemplateData {
  layout?: string;
  sections: Record<string, SectionData>;
  order: string[];
}

export interface ThemeDownloadResult {
  theme: ThemeInfo;
  templates: Record<string, TemplateData>;
  sectionSchemas: Record<string, any>;
  settingsSchema: any[];
  settingsData: any;
}

// ============================================
// HELPER: Extract numeric ID from GID
// ============================================

function extractNumericId(gid: string): string {
  // Handle both formats: gid://shopify/OnlineStoreTheme/123 and gid://shopify/Theme/123
  const match = gid.match(/(\d+)$/);
  return match ? match[1] : gid;
}

function toGid(id: string): string {
  if (id.includes('gid://')) return id;
  return `gid://shopify/OnlineStoreTheme/${id}`;
}

// ============================================
// GET ALL THEMES
// ============================================

export async function getAllThemes(admin: any): Promise<ThemeInfo[]> {
  console.log('[Theme] Fetching all themes...');

  try {
    const response = await admin.graphql(`
      query GetAllThemes {
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
    console.log('[Theme] GraphQL response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error('[Theme] GraphQL errors:', data.errors);
      return [];
    }

    const themes = data.data?.themes?.nodes || [];

    return themes.map((theme: any) => ({
      id: theme.id,
      numericId: extractNumericId(theme.id),
      name: theme.name,
      role: theme.role?.toLowerCase() || 'unpublished'
    }));
  } catch (error) {
    console.error('[Theme] Error fetching themes:', error);
    return [];
  }
}

// ============================================
// GET THEME BY ID
// ============================================

export async function getThemeById(admin: any, themeId: string): Promise<ThemeInfo | null> {
  console.log('[Theme] Fetching theme by ID:', themeId);

  try {
    const gid = toGid(themeId);

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
    console.log('[Theme] GetTheme response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.error('[Theme] GraphQL errors:', data.errors);
      return null;
    }

    const theme = data.data?.theme;
    if (!theme) {
      console.log('[Theme] Theme not found');
      return null;
    }

    return {
      id: theme.id,
      numericId: extractNumericId(theme.id),
      name: theme.name,
      role: theme.role?.toLowerCase() || 'unpublished'
    };
  } catch (error) {
    console.error('[Theme] Error fetching theme:', error);
    return null;
  }
}

// ============================================
// GET THEME FILES
// ============================================

export async function getThemeFiles(admin: any, themeId: string, filenames: string[]): Promise<ThemeFile[]> {
  console.log('[Theme] Fetching files:', filenames);

  try {
    const gid = toGid(themeId);

    const response = await admin.graphql(`
      query GetThemeFiles($themeId: ID!, $filenames: [String!]!) {
        theme(id: $themeId) {
          id
          files(filenames: $filenames, first: 250) {
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
        filenames: filenames
      }
    });

    const data = await response.json();

    if (data.errors) {
      console.error('[Theme] GraphQL errors:', data.errors);
      return [];
    }

    const nodes = data.data?.theme?.files?.nodes || [];
    console.log('[Theme] Found', nodes.length, 'files');
    console.log('[Theme] Returned filenames:', nodes.map((n: any) => n.filename));

    return nodes.map((node: any) => ({
      filename: node.filename,
      content: node.body?.content || null
    }));
  } catch (error) {
    console.error('[Theme] Error fetching files:', error);
    return [];
  }
}

// ============================================
// LIST ALL THEME FILES
// ============================================

export async function listThemeFiles(admin: any, themeId: string): Promise<string[]> {
  console.log('[Theme] Listing all files for theme:', themeId);

  try {
    const gid = toGid(themeId);

    // Shopify GraphQL doesn't have a direct way to list all files
    // We need to query with patterns or use REST API
    // For now, we'll query common file patterns

    const commonFiles = [
      'templates/index.json',
      'templates/product.json',
      'templates/collection.json',
      'templates/page.json',
      'templates/blog.json',
      'templates/article.json',
      'templates/cart.json',
      'templates/search.json',
      'templates/404.json',
      'templates/list-collections.json',
      'templates/password.json',
      'templates/gift_card.liquid',
      'sections/header-group.json',
      'sections/footer-group.json',
      'config/settings_schema.json',
      'config/settings_data.json'
    ];

    return commonFiles;
  } catch (error) {
    console.error('[Theme] Error listing files:', error);
    return [];
  }
}

// ============================================
// DOWNLOAD TEMPLATE DATA
// ============================================

export async function downloadTemplateData(
  admin: any,
  themeId: string,
  templateName: string
): Promise<TemplateData | null> {
  console.log('[Theme] Downloading template:', templateName);

  const templatePath = `templates/${templateName}.json`;
  const files = await getThemeFiles(admin, themeId, [templatePath]);

  if (files.length === 0 || !files[0].content) {
    console.log('[Theme] Template not found or empty:', templatePath);
    return null;
  }

  try {
    // Debug: log first 200 chars of content to see what we're getting
    console.log('[Theme] Template content preview:', files[0].content.substring(0, 200));

    const parsed = JSON.parse(files[0].content);
    console.log('[Theme] Parsed template:', templateName, '- sections:', Object.keys(parsed.sections || {}).length);

    return {
      layout: parsed.layout,
      sections: parsed.sections || {},
      order: parsed.order || Object.keys(parsed.sections || {})
    };
  } catch (error) {
    console.error('[Theme] Error parsing template:', error);
    console.error('[Theme] Content that failed to parse:', files[0].content.substring(0, 500));
    return null;
  }
}

// ============================================
// DOWNLOAD SECTION GROUP (Header/Footer)
// ============================================

export async function downloadSectionGroup(
  admin: any,
  themeId: string,
  groupName: 'header' | 'footer'
): Promise<SectionGroup | null> {
  console.log('[Theme] Downloading section group:', groupName);

  const groupPath = `sections/${groupName}-group.json`;
  const files = await getThemeFiles(admin, themeId, [groupPath]);

  if (files.length === 0 || !files[0].content) {
    console.log('[Theme] Section group not found:', groupPath);
    // Return empty group instead of null
    return {
      name: groupName,
      sections: {},
      order: []
    };
  }

  try {
    const parsed = JSON.parse(files[0].content);
    console.log('[Theme] Parsed section group:', groupName, '- sections:', Object.keys(parsed.sections || {}).length);

    return {
      name: parsed.name || groupName,
      type: parsed.type,
      sections: parsed.sections || {},
      order: parsed.order || Object.keys(parsed.sections || {})
    };
  } catch (error) {
    console.error('[Theme] Error parsing section group:', error);
    return null;
  }
}

// ============================================
// DOWNLOAD SETTINGS DATA
// ============================================

export async function downloadSettingsData(admin: any, themeId: string): Promise<any> {
  console.log('[Theme] Downloading settings data');

  const files = await getThemeFiles(admin, themeId, ['config/settings_data.json']);

  if (files.length === 0 || !files[0].content) {
    console.log('[Theme] Settings data not found');
    return null;
  }

  try {
    return JSON.parse(files[0].content);
  } catch (error) {
    console.error('[Theme] Error parsing settings data:', error);
    return null;
  }
}

// ============================================
// DOWNLOAD SETTINGS SCHEMA
// ============================================

export async function downloadSettingsSchema(admin: any, themeId: string): Promise<any[]> {
  console.log('[Theme] Downloading settings schema');

  const files = await getThemeFiles(admin, themeId, ['config/settings_schema.json']);

  if (files.length === 0 || !files[0].content) {
    console.log('[Theme] Settings schema not found');
    return [];
  }

  try {
    return JSON.parse(files[0].content);
  } catch (error) {
    console.error('[Theme] Error parsing settings schema:', error);
    return [];
  }
}

// ============================================
// SAVE THEME FILES
// ============================================

export async function saveThemeFiles(
  admin: any,
  themeId: string,
  files: Array<{ filename: string; content: string }>
): Promise<boolean> {
  console.log('[Theme] Saving', files.length, 'files to theme:', themeId);

  try {
    const gid = toGid(themeId);

    const fileInputs = files.map(f => ({
      filename: f.filename,
      body: {
        type: "TEXT",
        value: f.content
      }
    }));

    const response = await admin.graphql(`
      mutation ThemeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
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

    if (data.errors) {
      console.error('[Theme] GraphQL errors:', data.errors);
      return false;
    }

    if (data.data?.themeFilesUpsert?.userErrors?.length > 0) {
      console.error('[Theme] User errors:', data.data.themeFilesUpsert.userErrors);
      return false;
    }

    console.log('[Theme] Successfully saved', data.data?.themeFilesUpsert?.upsertedThemeFiles?.length, 'files');
    return true;
  } catch (error) {
    console.error('[Theme] Error saving files:', error);
    return false;
  }
}

// ============================================
// DUPLICATE THEME AS DRAFT
// ============================================

export async function duplicateThemeAsDraft(admin: any, sourceThemeId: string): Promise<ThemeInfo | null> {
  console.log('[Theme] Duplicating theme as draft:', sourceThemeId);

  try {
    const sourceTheme = await getThemeById(admin, sourceThemeId);
    if (!sourceTheme) {
      console.error('[Theme] Source theme not found');
      return null;
    }

    const draftName = `${sourceTheme.name} - VSBuilder Draft`;
    const gid = toGid(sourceThemeId);

    const response = await admin.graphql(`
      mutation ThemeCopy($id: ID!, $name: String!) {
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

    if (data.errors) {
      console.error('[Theme] GraphQL errors:', data.errors);
      return null;
    }

    if (data.data?.themeCopy?.userErrors?.length > 0) {
      console.error('[Theme] User errors:', data.data.themeCopy.userErrors);
      return null;
    }

    const newTheme = data.data?.themeCopy?.theme;
    if (!newTheme) {
      console.error('[Theme] No theme returned from copy');
      return null;
    }

    console.log('[Theme] Created draft theme:', newTheme.name);

    return {
      id: newTheme.id,
      numericId: extractNumericId(newTheme.id),
      name: newTheme.name,
      role: newTheme.role?.toLowerCase() || 'unpublished'
    };
  } catch (error) {
    console.error('[Theme] Error duplicating theme:', error);
    return null;
  }
}

// ============================================
// GET OR CREATE DRAFT THEME
// ============================================

export async function getOrCreateDraftTheme(
  admin: any,
  sourceThemeId: string
): Promise<{ draft: ThemeInfo; isNew: boolean } | null> {
  console.log('[Theme] Getting or creating draft for:', sourceThemeId);

  try {
    const sourceTheme = await getThemeById(admin, sourceThemeId);
    if (!sourceTheme) {
      console.error('[Theme] Source theme not found');
      return null;
    }

    // Check for existing draft
    const allThemes = await getAllThemes(admin);
    const draftName = `${sourceTheme.name} - VSBuilder Draft`;

    const existingDraft = allThemes.find(t =>
      t.name === draftName && t.role === 'unpublished'
    );

    if (existingDraft) {
      console.log('[Theme] Found existing draft:', existingDraft.name);
      return { draft: existingDraft, isNew: false };
    }

    // Create new draft
    const newDraft = await duplicateThemeAsDraft(admin, sourceThemeId);
    if (!newDraft) {
      return null;
    }

    return { draft: newDraft, isNew: true };
  } catch (error) {
    console.error('[Theme] Error getting/creating draft:', error);
    return null;
  }
}

// ============================================
// COMPLETE THEME DOWNLOAD FOR EDITOR
// ============================================

export async function downloadThemeForEditor(
  admin: any,
  themeId: string,
  templateName: string = 'index'
): Promise<{
  theme: ThemeInfo;
  template: TemplateData;
  header: SectionGroup;
  footer: SectionGroup;
  settingsData: any;
} | null> {
  console.log('[Theme] === Starting full theme download ===');
  console.log('[Theme] Theme ID:', themeId);
  console.log('[Theme] Template:', templateName);

  try {
    // 1. Get theme info
    const theme = await getThemeById(admin, themeId);
    if (!theme) {
      console.error('[Theme] Theme not found');
      return null;
    }
    console.log('[Theme] Theme found:', theme.name);

    // 2. Download template
    const template = await downloadTemplateData(admin, themeId, templateName);
    if (!template) {
      console.log('[Theme] Template not found, using empty');
    }

    // 3. Download header group
    const header = await downloadSectionGroup(admin, themeId, 'header');

    // 4. Download footer group
    const footer = await downloadSectionGroup(admin, themeId, 'footer');

    // 5. Download settings data (for theme-level settings)
    const settingsData = await downloadSettingsData(admin, themeId);

    console.log('[Theme] === Download complete ===');
    console.log('[Theme] Template sections:', Object.keys(template?.sections || {}).length);
    console.log('[Theme] Header sections:', Object.keys(header?.sections || {}).length);
    console.log('[Theme] Footer sections:', Object.keys(footer?.sections || {}).length);

    return {
      theme,
      template: template || { sections: {}, order: [] },
      header: header || { sections: {}, order: [] },
      footer: footer || { sections: {}, order: [] },
      settingsData
    };
  } catch (error) {
    console.error('[Theme] Error in downloadThemeForEditor:', error);
    return null;
  }
}

// ============================================
// SAVE EDITOR CHANGES
// ============================================

export async function saveEditorChanges(
  admin: any,
  themeId: string,
  templateName: string,
  template: TemplateData,
  header: SectionGroup,
  footer: SectionGroup
): Promise<boolean> {
  console.log('[Theme] === Saving editor changes ===');
  console.log('[Theme] Theme ID:', themeId);
  console.log('[Theme] Template:', templateName);

  const files: Array<{ filename: string; content: string }> = [];

  // Template file
  files.push({
    filename: `templates/${templateName}.json`,
    content: JSON.stringify({
      sections: template.sections,
      order: template.order
    }, null, 2)
  });

  // Header group
  if (Object.keys(header.sections).length > 0) {
    files.push({
      filename: 'sections/header-group.json',
      content: JSON.stringify({
        type: 'header',
        name: 'Header group',
        sections: header.sections,
        order: header.order
      }, null, 2)
    });
  }

  // Footer group
  if (Object.keys(footer.sections).length > 0) {
    files.push({
      filename: 'sections/footer-group.json',
      content: JSON.stringify({
        type: 'footer',
        name: 'Footer group',
        sections: footer.sections,
        order: footer.order
      }, null, 2)
    });
  }

  return await saveThemeFiles(admin, themeId, files);
}
