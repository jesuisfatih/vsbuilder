/**
 * Theme Utilities - GraphQL Version
 * All theme operations use Admin GraphQL API
 */

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
      // Extract numeric ID from GID
      return mainTheme.id.replace('gid://shopify/Theme/', '');
    }
    return null;
  } catch (error) {
    console.error("Error fetching active theme:", error);
    return null;
  }
}

export async function getThemeAsset(admin: any, themeId: string, key: string): Promise<any> {
  try {
    // Theme Asset query uses themeId as GID or numeric
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/Theme/${themeId}`;

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
      return JSON.parse(fileNode.body.content);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching asset ${key}:`, error);
    return null;
  }
}

export async function saveThemeAsset(admin: any, themeId: string, key: string, value: string): Promise<void> {
  try {
    const gid = themeId.includes('gid://') ? themeId : `gid://shopify/Theme/${themeId}`;

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
    console.error(`Error saving asset ${key}:`, error);
    throw error;
  }
}
