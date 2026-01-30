import { PaintBrushIcon } from "@heroicons/react/24/outline";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Badge,
  Banner, BlockStack, Box, Button, Card, InlineStack, Layout,
  Modal,
  Page,
  ResourceItem,
  ResourceList,
  Spinner,
  Text
} from "@shopify/polaris";
import { useCallback, useState } from "react";
import { authenticate } from "../shopify.server";
import { getAllThemes, type ThemeInfo } from "../utils/theme.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    let themes: ThemeInfo[] = [];
    let error: string | null = null;

    try {
        themes = await getAllThemes(admin);
    } catch (e) {
        console.error("[Dashboard] Theme API Error:", e);
        error = "Failed to fetch themes. Please check API permissions.";
    }

    return json({
      themes,
      shop: session.shop,
      error
    });
  } catch (err) {
    if (err instanceof Response) {
      throw err;
    }
    console.error("[Dashboard] Loader Error:", err);
    return json({
       themes: [],
       shop: "",
       error: "Authentication failed or server error."
    });
  }
};

export default function Index() {
  const { themes, shop, error } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeInfo | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const toggleModal = useCallback(() => setActiveModal((active) => !active), []);

  const handleLaunchEditor = useCallback(() => {
    if (selectedTheme) {
      setIsNavigating(true);
      // Extract numeric ID from GID
      const numericId = selectedTheme.id
        .replace('gid://shopify/OnlineStoreTheme/', '')
        .replace('gid://shopify/Theme/', '');

      // Open App Proxy editor on store domain
      const editorUrl = `https://${shop}/apps/vsbuilder/editor?themeId=${numericId}`;
      window.open(editorUrl, '_blank');
      setIsNavigating(false);
      toggleModal();
    }
  }, [selectedTheme, toggleModal]);

  const renderThemeItem = useCallback((item: ThemeInfo) => {
    const numericId = item.id
      .replace('gid://shopify/OnlineStoreTheme/', '')
      .replace('gid://shopify/Theme/', '');
    const isSelected = selectedTheme?.id === item.id;

    return (
      <ResourceItem
        id={numericId}
        onClick={() => setSelectedTheme(item)}
        accessibilityLabel={`Select ${item.name}`}
        persistActions
      >
        <InlineStack align="space-between">
          <InlineStack gap="200">
            {isSelected && (
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#008060'
              }} />
            )}
            <Text variant="bodyMd" fontWeight={isSelected ? "bold" : "regular"} as="h3">
              {item.name}
            </Text>
          </InlineStack>
          <InlineStack gap="200">
            {item.role === 'main' && <Badge tone="success">Live</Badge>}
            {item.role === 'unpublished' && <Badge tone="info">Draft</Badge>}
          </InlineStack>
        </InlineStack>
      </ResourceItem>
    );
  }, [selectedTheme]);

  const liveThemes = themes.filter(t => t.role === 'main');
  const draftThemes = themes.filter(t => t.role === 'unpublished');
  const otherThemes = themes.filter(t => t.role !== 'main' && t.role !== 'unpublished');

  return (
    <Page title="VSBuilder Dashboard">
      <Modal
        open={activeModal}
        onClose={toggleModal}
        title="Select a Theme to Edit"
        primaryAction={{
          content: isNavigating ? 'Opening...' : 'Open Editor',
          onAction: handleLaunchEditor,
          disabled: !selectedTheme || isNavigating,
          loading: isNavigating,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: toggleModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd" tone="subdued">
              Choose a theme to customize with VSBuilder visual editor.
              Changes will be saved to a draft copy of your theme.
            </Text>

            {liveThemes.length > 0 && (
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Live Theme</Text>
                <Card>
                  <ResourceList
                    resourceName={{ singular: 'theme', plural: 'themes' }}
                    items={liveThemes}
                    renderItem={renderThemeItem}
                  />
                </Card>
              </BlockStack>
            )}

            {draftThemes.length > 0 && (
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Draft Themes</Text>
                <Card>
                  <ResourceList
                    resourceName={{ singular: 'theme', plural: 'themes' }}
                    items={draftThemes}
                    renderItem={renderThemeItem}
                  />
                </Card>
              </BlockStack>
            )}

            {otherThemes.length > 0 && (
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Other Themes</Text>
                <Card>
                  <ResourceList
                    resourceName={{ singular: 'theme', plural: 'themes' }}
                    items={otherThemes}
                    renderItem={renderThemeItem}
                  />
                </Card>
              </BlockStack>
            )}

            {themes.length === 0 && !error && (
              <Box padding="400">
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text as="p">Loading themes...</Text>
                </InlineStack>
              </Box>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Layout>
        <Layout.Section>
          {error ? (
            <Banner title="Dashboard Error" tone="critical">
              <p>{error}</p>
              <p>Please try reloading the page.</p>
            </Banner>
          ) : (
            <Banner title="System Ready" tone="success">
              <p>Connected to {shop}. Your visual editor is ready to use.</p>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="500">
               <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
                     <PaintBrushIcon style={{ width: 64, height: 64, color: '#5c6ac4' }} />
                  </div>
               </Box>
               <BlockStack gap="200">
                  <Text as="h2" variant="headingLg" alignment="center">Visual Page Editor</Text>
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    Open the visual editor to customize your theme sections, add widgets, and preview changes in real-time.
                  </Text>
               </BlockStack>
               <Button
                 variant="primary"
                 size="large"
                 fullWidth
                 onClick={toggleModal}
                 disabled={!!error}
               >
                 🚀 Launch Editor
               </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
           <Card>
              <BlockStack gap="400">
                 <Text as="h2" variant="headingMd">Quick Stats</Text>
                 <InlineStack align="space-between">
                    <Text as="p">Total Themes</Text>
                    <Text as="p" fontWeight="bold">{themes.length}</Text>
                 </InlineStack>
                 <InlineStack align="space-between">
                    <Text as="p">Draft Themes</Text>
                    <Text as="p" fontWeight="bold">{draftThemes.length}</Text>
                 </InlineStack>
                 <InlineStack align="space-between">
                    <Text as="p">Store</Text>
                    <Text as="p" fontWeight="bold" tone="subdued">{shop || 'Loading...'}</Text>
                 </InlineStack>
              </BlockStack>
           </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
