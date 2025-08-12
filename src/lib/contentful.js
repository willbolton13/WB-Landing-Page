// This file supports the new Campus → Course structure
import { createClient } from 'contentful';

export const contentfulClient = createClient({
  space: import.meta.env.CONTENTFUL_SPACE_ID,
  accessToken: import.meta.env.CONTENTFUL_ACCESS_TOKEN,
});

// ============= CAMPUS FUNCTIONS =============

// Get all campuses
export async function getCampuses() {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    order: 'fields.displayOrder',
    include: 1,
  });
  return entries.items;
}

// Get all campuses with their courses
export async function getCampusesWithCourses() {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    include: 2, // Include course references
    order: 'fields.displayOrder',
  });
  return entries.items;
}

// Get a single campus by slug
export async function getCampusBySlug(campusSlug) {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    'fields.campusSlug': campusSlug,
    include: 2,
  });
  return entries.items[0];
}

// Get campus with all its content (deep include for landing page)
export async function getCampusWithFullContent(campusSlug) {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    'fields.campusSlug': campusSlug,
    include: 10, // Deep include for all nested content
  });
  return entries;
}

// ============= COURSE FUNCTIONS =============

// Get all courses
export async function getCourses() {
  const entries = await contentfulClient.getEntries({
    content_type: 'location', // Using 'location' as the content type ID
    include: 1,
    order: 'fields.displayOrder',
  });
  return entries.items;
}

// Get courses for a specific campus
export async function getCoursesByCampus(campusSlug) {
  // Get the campus with its courses
  const campus = await getCampusBySlug(campusSlug);
  if (!campus || !campus.fields.courses) return [];
  
  // Resolve the course references
  const courses = await Promise.all(
    campus.fields.courses.map(courseRef => 
      contentfulClient.getEntry(courseRef.sys.id)
    )
  );
  
  // Sort by displayOrder if it exists
  return courses.sort((a, b) => 
    (a.fields.displayOrder || 0) - (b.fields.displayOrder || 0)
  );
}

// Get a specific course by campus and course slug
export async function getCourseBySlug(campusSlug, courseSlug) {
  // Get the campus with its courses
  const campus = await getCampusBySlug(campusSlug);
  if (!campus || !campus.fields.courses) return null;
  
  // Find the course reference with matching slug
  for (const courseRef of campus.fields.courses) {
    const course = await contentfulClient.getEntry(courseRef.sys.id, { include: 10 });
    if (course.fields.courseSlug === courseSlug) {
      return course;
    }
  }
  
  return null;
}

// Get course with all related content (for course page)
export async function getCourseWithFullContent(campusSlug, courseSlug) {
  // Get the campus to verify the relationship
  const campus = await getCampusBySlug(campusSlug);
  if (!campus || !campus.fields.courses) return null;
  
  // Find and get the course with full includes
  for (const courseRef of campus.fields.courses) {
    // First fetch the course to check its slug
    const course = await contentfulClient.getEntry(courseRef.sys.id);
    if (course.fields.courseSlug === courseSlug) {
      // Now get it with full includes using the proper content_type query
      const entries = await contentfulClient.getEntries({
        content_type: 'location', // Using 'location' as the content type ID
        'sys.id': courseRef.sys.id,
        include: 10, // Deep include for buttons, blocks, staff, etc.
      });
      
      if (entries.items.length > 0) {
        return entries;
      }
    }
  }
  
  return null;
}

// ============= UTILITY FUNCTIONS =============

// Get all campus-course combinations for static path generation
export async function getAllCampusCoursePaths() {
  const campuses = await getCampusesWithCourses();
  const paths = [];
  
  for (const campus of campuses) {
    // Add campus landing page path
    paths.push({
      campus: campus.fields.campusSlug,
      course: null,
    });
    
    // Add course paths for this campus
    if (campus.fields.courses) {
      for (const courseRef of campus.fields.courses) {
        // Fetch the full course data
        const course = await contentfulClient.getEntry(courseRef.sys.id);
        paths.push({
          campus: campus.fields.campusSlug,
          course: course.fields.courseSlug,
        });
      }
    }
  }
  
  return paths;
}

// Helper to find included entries in Contentful response
export function findIncludedEntry(includes, id) {
  return includes?.Entry?.find(entry => entry.sys.id === id);
}

// Helper to find included assets in Contentful response
export function findIncludedAsset(includes, id) {
  return includes?.Asset?.find(asset => asset.sys.id === id);
}

// ============= MIGRATION HELPERS (temporary) =============

// Get old location data (for migration purposes)
export async function getLocations() {
  const entries = await contentfulClient.getEntries({
    content_type: 'location',
  });
  return entries.items;
}

// Get old location by name (for migration purposes)
export async function getLocationByName(locationName) {
  const entries = await contentfulClient.getEntries({
    content_type: 'location',
    'fields.locationName': locationName,
    include: 10,
  });
  return entries.items[0];
}

// ============= IMAGE HELPER FUNCTIONS =============

/**
 * Get optimized Contentful image URL with transformations
 * @param {Object} asset - Contentful asset object
 * @param {Object} options - Transformation options
 * @returns {string} - Optimized image URL
 */
export function getOptimizedImageUrl(asset, options = {}) {
  if (!asset?.fields?.file?.url) return null;
  
  const baseUrl = asset.fields.file.url;
  const url = baseUrl.startsWith('//') ? `https:${baseUrl}` : baseUrl;
  
  // Default options for hero images
  const params = {
    w: options.width || 1920,  // Default width
    h: options.height,          // Optional height
    q: options.quality || 80,   // Quality (80 is good for heroes)
    fm: options.format || 'webp', // WebP for modern browsers
    fit: options.fit || 'fill',   // How to fit the image
    f: options.focus || 'center', // Focus point for cropping
  };
  
  // Build query string
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  return `${url}?${queryString}`;
}

/**
 * Generate srcset for responsive images
 * @param {Object} asset - Contentful asset object
 * @param {Array} widths - Array of widths to generate
 * @returns {string} - srcset attribute value
 */
export function generateSrcSet(asset, widths = [640, 768, 1024, 1366, 1920, 2560]) {
  if (!asset?.fields?.file?.url) return '';
  
  return widths
    .map(width => {
      const url = getOptimizedImageUrl(asset, { width });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Get a random image from an array of assets
 * @param {Array} images - Array of Contentful image assets
 * @param {number} seed - Optional seed for consistent randomization
 * @returns {Object} - Random image asset
 */
export function getRandomImage(images, seed = null) {
  if (!images || images.length === 0) return null;
  
  // If seed provided, use it for consistent randomization (useful for builds)
  if (seed !== null) {
    // Simple seeded random - not cryptographically secure but good enough
    const index = Math.abs(seed) % images.length;
    return images[index];
  }
  
  // Otherwise use Math.random()
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}

/**
 * Time-based image rotation
 * Changes daily/weekly but consistent for all users on the same day
 */
export function getRotatingImage(images, uniqueKey = '', rotation = 'daily') {
  if (!images || images.length === 0) return null;
  
  // Create a time-based seed
  const now = new Date();
  let timeSeed;
  
  switch(rotation) {
    case 'hourly':
      // Changes every hour
      timeSeed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
      break;
    case 'weekly':
      // Changes weekly (every Monday)
      const weekNumber = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 604800000);
      timeSeed = `${now.getFullYear()}-week-${weekNumber}`;
      break;
    case 'daily':
    default:
      // Changes daily
      timeSeed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      break;
  }
  
  // Combine with unique key for page-specific rotation
  const combinedSeed = `${timeSeed}-${uniqueKey}`;
  
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < combinedSeed.length; i++) {
    const char = combinedSeed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash to select image
  const index = Math.abs(hash) % images.length;
  return images[index];
}

/**
 * Session-based image selection (using sessionStorage)
 * This is for client-side use if you really want per-session randomization
 */
export function getSessionImage(images, storageKey) {
  if (!images || images.length === 0) return null;
  
  // Check if we're in browser
  if (typeof window === 'undefined') {
    // Server-side: use time-based rotation
    return getRotatingImage(images, storageKey, 'daily');
  }
  
  // Client-side: check sessionStorage
  const stored = sessionStorage.getItem(`hero-${storageKey}`);
  
  if (stored) {
    // We have a stored index, use it
    const index = parseInt(stored, 10);
    if (index >= 0 && index < images.length) {
      return images[index];
    }
  }
  
  // No stored index, generate one
  const randomIndex = Math.floor(Math.random() * images.length);
  sessionStorage.setItem(`hero-${storageKey}`, randomIndex.toString());
  return images[randomIndex];
}

/**
 * Intelligent image selection based on various factors
 * @param {Array} images - Array of image assets
 * @param {Object} options - Selection options
 * @returns {Object} - Selected image
 */
export function getSmartHeroImage(images, options = {}) {
  const {
    method = 'rotating', // 'rotating', 'random', 'first', 'session'
    uniqueKey = '',
    rotation = 'daily',
    preferredIndex = null
  } = options;
  
  if (!images || images.length === 0) return null;
  
  // If preferred index is specified (e.g., from a CMS field)
  if (preferredIndex !== null && images[preferredIndex]) {
    return images[preferredIndex];
  }
  
  switch(method) {
    case 'random':
      // True random (not recommended)
      return getRandomImage(images);
    
    case 'session':
      // Per-session (requires client-side handling)
      return getSessionImage(images, uniqueKey);
    
    case 'rotating':
      // Time-based rotation (recommended)
      return getRotatingImage(images, uniqueKey, rotation);
    
    case 'first':
    default:
      // Always use first image
      return images[0];
  }
}

/**
 * Get campus with resolved hero images
 * @param {string} campusSlug - Campus slug
 * @returns {Object} - Campus with resolved hero image pool
 */
export async function getCampusWithHeroImages(campusSlug) {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    'fields.campusSlug': campusSlug,
    include: 2, // Include asset references
  });
  
  const campus = entries.items[0];
  if (!campus) return null;
  
  // Resolve hero image references if they exist
  if (campus.fields.heroImagePool && campus.fields.heroImagePool.length > 0) {
    const resolvedImages = await Promise.all(
      campus.fields.heroImagePool.map(imageRef => 
        contentfulClient.getAsset(imageRef.sys.id)
      )
    );
    
    return {
      ...campus,
      fields: {
        ...campus.fields,
        heroImagePool: resolvedImages
      }
    };
  }
  
  return campus;
}

/**
 * Get all hero images from all campuses (for homepage)
 * @returns {Array} - Array of all hero images with campus info
 */
export async function getAllHeroImages() {
  const campuses = await getCampuses();
  const allImages = [];
  
  for (const campus of campuses) {
    if (campus.fields.heroImagePool && campus.fields.heroImagePool.length > 0) {
      // Resolve each image and add campus info
      for (const imageRef of campus.fields.heroImagePool) {
        try {
          const image = await contentfulClient.getAsset(imageRef.sys.id);
          allImages.push({
            asset: image,
            campusName: campus.fields.campusName,
            campusSlug: campus.fields.campusSlug
          });
        } catch (error) {
          console.error(`Error fetching image ${imageRef.sys.id}:`, error);
        }
      }
    }
  }
  
  return allImages;
}

/**
 * Preload critical images
 * Returns link tags for head to preload hero images
 */
export function getImagePreloadTags(asset, options = {}) {
  if (!asset) return '';
  
  // Preload WebP version for modern browsers
  const webpUrl = getOptimizedImageUrl(asset, { 
    ...options, 
    format: 'webp',
    width: options.width || 1920 
  });
  
  // Also prepare JPEG fallback
  const jpegUrl = getOptimizedImageUrl(asset, { 
    ...options, 
    format: 'jpg',
    width: options.width || 1920 
  });
  
  return `
    <link rel="preload" as="image" type="image/webp" href="${webpUrl}" media="(min-width: 1024px)">
    <link rel="preload" as="image" type="image/webp" href="${getOptimizedImageUrl(asset, { width: 768, format: 'webp' })}" media="(max-width: 1023px)">
  `.trim();
}

/**
 * Preconnect to Contentful's image CDN
 * Add this to your document head for faster image loading
 */
export function getContentfulPreconnectTags() {
  return `
    <link rel="preconnect" href="https://images.ctfassets.net">
    <link rel="dns-prefetch" href="https://images.ctfassets.net">
  `.trim();
}

/**
 * Generate a low-quality image placeholder URL for blur-up effect
 * @param {Object} asset - Contentful asset object
 * @returns {string} - Low quality placeholder URL
 */
export function getPlaceholderImageUrl(asset) {
  if (!asset?.fields?.file?.url) return null;
  
  const baseUrl = asset.fields.file.url;
  const url = baseUrl.startsWith('//') ? `https:${baseUrl}` : baseUrl;
  
  // Very low quality, small image for blur placeholder
  const params = {
    w: 50,  // Tiny width
    q: 30,  // Low quality
    fm: 'jpg',  // JPEG for smaller size
    fl: 'progressive',  // Progressive JPEG
    blur: 20  // Some CDNs support blur parameter
  };
  
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  return `${url}?${queryString}`;
}