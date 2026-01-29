import { PaintBrushIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "@remix-run/react";
import { Banner, BlockStack, Box, Button, Card, InlineStack, Layout, Page, Text } from "@shopify/polaris";

export default function Index() {
  const navigate = useNavigate();

  return (
    <Page title="VSBuilder Dashboard">
      <Layout>
        <Layout.Section>
          <Banner title="System Ready" tone="success">
            <p>Your Shopify App (2025-01 API) is connected and secure headers are active.</p>
          </Banner>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="500">
               <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <div className="flex items-center justify-center py-6">
                     <PaintBrushIcon className="w-16 h-16 text-blue-600" />
                  </div>
               </Box>
               <BlockStack gap="200 text-center">
                  <Text as="h2" variant="headingLg">Page Editor</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Open the high-performance visual editor to customize your theme sections.
                  </Text>
               </BlockStack>
               <Button
                 variant="primary"
                 size="large"
                 fullWidth
                 icon={() => <RocketLaunchIcon className="w-5 h-5 mr-1" />}
                 onClick={() => navigate("/app/editor?fullscreen=true")}
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
                    <Text as="p" fontWeight="bold" tone="info">vsbuilder.techifyboost.com</Text>
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
