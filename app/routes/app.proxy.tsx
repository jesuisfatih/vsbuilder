import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  return json({
    message: "Proxy Works!",
    shop: session.shop
  });
};

export default function AppProxy() {
  // Simple check
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'white',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>VSBuilder Editor</h1>
      <p>Loading App Proxy Mode...</p>
      <p style={{ color: '#666', marginTop: '1rem' }}>If you see this, the proxy connection is successful.</p>
    </div>
  );
}
