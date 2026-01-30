import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * API Route for fetching Shopify resources (Products, Collections, Pages, etc.)
 * Used by resource pickers in the editor
 */

interface ProductNode {
  id: string;
  title: string;
  handle: string;
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  featuredImage: {
    url: string;
    altText: string | null;
  } | null;
  status: string;
}

interface CollectionNode {
  id: string;
  title: string;
  handle: string;
  productsCount: { count: number };
  image: {
    url: string;
    altText: string | null;
  } | null;
}

interface PageNode {
  id: string;
  title: string;
  handle: string;
  bodySummary: string;
}

// GET: Fetch resources
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  const resourceType = url.searchParams.get("type") || "products";
  const search = url.searchParams.get("search") || "";
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  const cursor = url.searchParams.get("cursor") || null;

  try {
    switch (resourceType) {
      case "products":
        return await fetchProducts(admin, search, limit, cursor);
      case "collections":
        return await fetchCollections(admin, search, limit, cursor);
      case "pages":
        return await fetchPages(admin, search, limit, cursor);
      case "files":
        return await fetchFiles(admin, search, limit, cursor);
      default:
        return json({ error: "Invalid resource type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Resource fetch error:", error);
    return json({ error: "Failed to fetch resources" }, { status: 500 });
  }
};

// Fetch Products
async function fetchProducts(
  admin: any,
  search: string,
  limit: number,
  cursor: string | null
) {
  const query = search ? `title:*${search}*` : "";

  const response = await admin.graphql(`
    query getProducts($first: Int!, $query: String, $after: String) {
      products(first: $first, query: $query, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          handle
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          featuredImage {
            url
            altText
          }
          status
        }
      }
    }
  `, {
    variables: { first: limit, query, after: cursor }
  });

  const data = await response.json();
  const products = data.data?.products;

  return json({
    items: products?.nodes?.map((node: ProductNode) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      price: formatPrice(
        node.priceRangeV2?.minVariantPrice?.amount,
        node.priceRangeV2?.minVariantPrice?.currencyCode
      ),
      image: node.featuredImage?.url || null,
      imageAlt: node.featuredImage?.altText || node.title,
      status: node.status,
      type: "product",
    })) || [],
    pageInfo: products?.pageInfo || { hasNextPage: false, endCursor: null },
  });
}

// Fetch Collections
async function fetchCollections(
  admin: any,
  search: string,
  limit: number,
  cursor: string | null
) {
  const query = search ? `title:*${search}*` : "";

  const response = await admin.graphql(`
    query getCollections($first: Int!, $query: String, $after: String) {
      collections(first: $first, query: $query, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          handle
          productsCount {
            count
          }
          image {
            url
            altText
          }
        }
      }
    }
  `, {
    variables: { first: limit, query, after: cursor }
  });

  const data = await response.json();
  const collections = data.data?.collections;

  return json({
    items: collections?.nodes?.map((node: CollectionNode) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      meta: `${node.productsCount?.count || 0} products`,
      image: node.image?.url || null,
      imageAlt: node.image?.altText || node.title,
      type: "collection",
    })) || [],
    pageInfo: collections?.pageInfo || { hasNextPage: false, endCursor: null },
  });
}

// Fetch Pages
async function fetchPages(
  admin: any,
  search: string,
  limit: number,
  cursor: string | null
) {
  const query = search ? `title:*${search}*` : "";

  const response = await admin.graphql(`
    query getPages($first: Int!, $query: String, $after: String) {
      pages(first: $first, query: $query, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          handle
          bodySummary
        }
      }
    }
  `, {
    variables: { first: limit, query, after: cursor }
  });

  const data = await response.json();
  const pages = data.data?.pages;

  return json({
    items: pages?.nodes?.map((node: PageNode) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      meta: node.bodySummary?.substring(0, 50) || "",
      image: null,
      type: "page",
    })) || [],
    pageInfo: pages?.pageInfo || { hasNextPage: false, endCursor: null },
  });
}

// Fetch Files (Images)
async function fetchFiles(
  admin: any,
  search: string,
  limit: number,
  cursor: string | null
) {
  const query = search ? `filename:*${search}*` : "";

  const response = await admin.graphql(`
    query getFiles($first: Int!, $query: String, $after: String) {
      files(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ... on MediaImage {
            id
            alt
            image {
              url
              altText
              width
              height
            }
            createdAt
          }
        }
      }
    }
  `, {
    variables: { first: limit, query, after: cursor }
  });

  const data = await response.json();
  const files = data.data?.files;

  return json({
    items: files?.nodes?.filter((node: any) => node.image)?.map((node: any) => ({
      id: node.id,
      title: node.alt || "Image",
      url: node.image?.url,
      width: node.image?.width,
      height: node.image?.height,
      type: "file",
    })) || [],
    pageInfo: files?.pageInfo || { hasNextPage: false, endCursor: null },
  });
}

// Helper: Format price
function formatPrice(amount: string | undefined, currencyCode: string | undefined): string {
  if (!amount) return "";
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
  }).format(num);
}

// POST: Upload file
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const alt = formData.get("alt") as string || "";

  if (!file) {
    return json({ error: "No file provided" }, { status: 400 });
  }

  try {
    // Step 1: Stage the upload
    const stageResponse = await admin.graphql(`
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: [{
          filename: file.name,
          mimeType: file.type,
          resource: "FILE",
          httpMethod: "POST",
          fileSize: file.size.toString(),
        }]
      }
    });

    const stageData = await stageResponse.json();
    const target = stageData.data?.stagedUploadsCreate?.stagedTargets?.[0];

    if (!target) {
      return json({ error: "Failed to stage upload" }, { status: 500 });
    }

    // Step 2: Upload to staged URL
    const uploadFormData = new FormData();
    target.parameters.forEach((param: { name: string; value: string }) => {
      uploadFormData.append(param.name, param.value);
    });
    uploadFormData.append("file", file);

    await fetch(target.url, {
      method: "POST",
      body: uploadFormData,
    });

    // Step 3: Create the file in Shopify
    const createResponse = await admin.graphql(`
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on MediaImage {
              id
              alt
              image {
                url
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        files: [{
          alt,
          contentType: "IMAGE",
          originalSource: target.resourceUrl,
        }]
      }
    });

    const createData = await createResponse.json();
    const createdFile = createData.data?.fileCreate?.files?.[0];

    if (!createdFile) {
      return json({ error: "Failed to create file" }, { status: 500 });
    }

    return json({
      success: true,
      file: {
        id: createdFile.id,
        url: createdFile.image?.url,
        alt: createdFile.alt,
      }
    });
  } catch (error) {
    console.error("File upload error:", error);
    return json({ error: "Upload failed" }, { status: 500 });
  }
};
