import { PaintBrushIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
    Badge,
    Banner, BlockStack, Box, Button, Card, InlineStack, Layout,
    Modal,
    Page,
    ResourceItem,
    ResourceList,
    Text
} from "@shopify/polaris";
import { useCallback, useState } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);

    let themes = [];
    let error = null;

    try {
        const response = await (admin as any).rest.resources.Theme.all({
          session: session,
        });
        themes = response.data;
    } catch (e) {
        console.error("Theme API Error:", e);
        error = "Failed to fetch themes. Please check API permissions.";
    }

    return json({
      themes,
      shop: session.shop,
      error
    });
  } catch (err) {
    console.error("Loader Error:", err);
    return json({
       themes: [],
       shop: "",
       error: "Authentication failed."
    });
  }
};

export default function Index() {
  const { themes, shop, error } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);

  const toggleModal = useCallback(() => setActiveModal((active) => !active), []);

  const handleLaunchEditor = () => {
    if (selectedTheme) {
      // PROXY URL: https://store.myshopify.com/apps/vsbuilder/editor?themeId=...
      // We open in a new tab for full screen experience
      const url = `https://${shop}/apps/vsbuilder/editor?themeId=${selectedTheme.id}`;
      window.open(url, '_blank');
      toggleModal();
    }
  };

  const renderItem = (item: any) => {
    const { id, name, role } = item;
    return (
      <ResourceItem
        id={id}
        onClick={() => setSelectedTheme(item)}
        accessibilityLabel={`View details for ${name}`}
        persistActions
      >
        <InlineStack align="space-between">
          <Text variant="bodyMd" fontWeight="bold" as="h3">
            {name}
          </Text>
          {role === 'main' && <Badge tone="success">Live</Badge>}
        </InlineStack>
      </ResourceItem>
    );
  };

  return (
    <Page title="VSBuilder Dashboard">
      <Modal
        open={activeModal}
        onClose={toggleModal}
        title="Select a Theme to Edit"
        primaryAction={{
          content: 'Open Editor',
          onAction: handleLaunchEditor,
          disabled: !selectedTheme,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: toggleModal,
          },
        ]}
      >
        <Modal.Section>
          <p className="mb-4">Choose a theme to customize with VSBuilder visual editor.</p>
          <Card>
            <ResourceList
              resourceName={{ singular: 'theme', plural: 'themes' }}
              items={themes}
              renderItem={renderItem}
              selectedItems={selectedTheme ? [selectedTheme.id] : []}
              onSelectionChange={(selected) => {
                const theme = themes.find((t: any) => t.id === selected[0]);
                setSelectedTheme(theme);
              }}
              selectable
            />
          </Card>
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
              <p>Your Shopify App (2025-01 API) is connected and secure headers are active.</p>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="500">
               <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <div className="flex items-center justify-center py-6">
                     <PaintBrushIcon className="w-16 h-16 text-blue-600" />
                  </div>
               </Box>
               <BlockStack gap="200">
                  <Text as="h2" variant="headingLg" alignment="center">Page Editor</Text>
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    Open the high-performance visual editor to customize your theme sections.
                  </Text>
               </BlockStack>
               <Button
                 variant="primary"
                 size="large"
                 fullWidth
                 icon={RocketLaunchIcon}
                 onClick={toggleModal}
                 disabled={!!error}
               >
                 Launch Editor
               </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
           <Card>
              <BlockStack gap="400">
                 <Text as="h2" variant="headingMd">Server Status</Text>
                 <InlineStack align="space-between">
                    <Text as="p">Environment</Text>
                    <Text as="p" fontWeight="bold">Production</Text>
                 </InlineStack>
                 <InlineStack align="space-between">
                    <Text as="p">Port</Text>
                    <Text as="p" fontWeight="bold">3000</Text>
                 </InlineStack>
                 <InlineStack align="space-between">
                    <Text as="p">Domain</Text>
                    <Text as="p" fontWeight="bold" tone="subdued">vsbuilder.techifyboost.com</Text>
                 </InlineStack>
              </BlockStack>
           </Card>
        </Layout.Section>
      </Layout>
      <style>{`
        .flex { display: flex; }
        .items-center { align-items: center; }
        .justify-center { justify-content: center; }
        .w-16 { width: 4rem; }
        .h-16 { height: 4rem; }
        .text-blue-600 { color: #2563eb; }
      `}</style>
    </Page>
  );
}
