// This file supports the new Campus → Course structure
import { createClient } from 'contentful';

export const contentfulClient = createClient({
  space: import.meta.env.CONTENTFUL_SPACE_ID,
  accessToken: import.meta.env.CONTENTFUL_ACCESS_TOKEN,
});

// ============= OPTIMIZED CAMPUS FUNCTIONS =============

/**
 * Get all campuses with fully resolved courses in a single API call
 * Used in: Header.astro, [...course].astro
 */
export async function getCampusesWithCourses() {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    include: 2, // Include courses and their basic fields
    order: 'fields.displayOrder',
  });
  
  // Courses are already resolved via includes
  return entries.items;
}

/**
 * Get all campuses (lightweight version)
 * Used in: [...course].astro for static paths
 */
export async function getCampuses() {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    order: 'fields.displayOrder',
    include: 1,
  });
  return entries.items;
}

/**
 * Get a single campus by slug
 * Used in: [...course].astro
 */
export async function getCampusBySlug(campusSlug) {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    'fields.campusSlug': campusSlug,
    include: 2,
  });
  return entries.items[0];
}

/**
 * Get campus with resolved hero images and custom buttons
 * Optimized version that includes everything needed for rendering
 * Used in: [...course].astro
 */
export async function getCampusWithHeroImages(campusSlug) {
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    'fields.campusSlug': campusSlug,
    include: 3, // Include hero images and custom buttons
  });
  
  const campus = entries.items[0];
  if (!campus) return null;
  
  // Hero images and custom buttons are already resolved via includes
  return campus;
}

// ============= OPTIMIZED COURSE FUNCTIONS =============

/**
 * Get courses for a specific campus
 * Used in: [...course].astro
 */
export async function getCoursesByCampus(campusSlug) {
  // Get the campus with its courses in one call
  const campus = await getCampusBySlug(campusSlug);
  if (!campus || !campus.fields.courses) return [];
  
  // If courses are already resolved objects (from include), return them
  if (campus.fields.courses[0]?.fields) {
    return campus.fields.courses.sort((a, b) => 
      (a.fields.displayOrder || 0) - (b.fields.displayOrder || 0)
    );
  }
  
  // Otherwise batch fetch all courses at once
  const courseIds = campus.fields.courses.map(c => c.sys.id).join(',');
  const coursesResponse = await contentfulClient.getEntries({
    'sys.id[in]': courseIds,
    content_type: 'location',
    include: 1
  });
  
  return coursesResponse.items.sort((a, b) => 
    (a.fields.displayOrder || 0) - (b.fields.displayOrder || 0)
  );
}

/**
 * Get a specific course by campus and course slug
 * Used in: [...course].astro (though not directly in current implementation)
 */
export async function getCourseBySlug(campusSlug, courseSlug) {
  const campus = await getCampusBySlug(campusSlug);
  if (!campus || !campus.fields.courses) return null;
  
  // Check if courses are already resolved
  if (campus.fields.courses[0]?.fields) {
    return campus.fields.courses.find(c => c.fields.courseSlug === courseSlug) || null;
  }
  
  // Otherwise fetch the specific course
  for (const courseRef of campus.fields.courses) {
    const course = await contentfulClient.getEntry(courseRef.sys.id, { include: 10 });
    if (course.fields.courseSlug === courseSlug) {
      return course;
    }
  }
  
  return null;
}

/**
 * Get course with all related content
 * Used in: [...course].astro for course pages
 */
export async function getCourseWithFullContent(campusSlug, courseSlug) {
  // First, get the campus to verify the relationship
  const campus = await getCampusBySlug(campusSlug);
  if (!campus || !campus.fields.courses) return null;
  
  // Find the course and get it with full includes
  let courseId = null;
  
  // Check if courses are already resolved
  if (campus.fields.courses[0]?.fields) {
    const course = campus.fields.courses.find(c => c.fields.courseSlug === courseSlug);
    if (course) courseId = course.sys.id;
  } else {
    // Find the course ID by checking each reference
    for (const courseRef of campus.fields.courses) {
      const course = await contentfulClient.getEntry(courseRef.sys.id);
      if (course.fields.courseSlug === courseSlug) {
        courseId = course.sys.id;
        break;
      }
    }
  }
  
  if (!courseId) return null;
  
  // Get the course with full includes
  const entries = await contentfulClient.getEntries({
    content_type: 'location',
    'sys.id': courseId,
    include: 10, // Deep include for buttons, blocks, staff, etc.
  });
  
  return entries.items.length > 0 ? entries : null;
}

// ============= UTILITY FUNCTIONS =============

/**
 * Helper to find included entries in Contentful response
 * Used in: [...course].astro
 */
export function findIncludedEntry(includes, id) {
  return includes?.Entry?.find(entry => entry.sys.id === id);
}

/**
 * Helper to find included assets in Contentful response
 * Used in: [...course].astro
 */
export function findIncludedAsset(includes, id) {
  return includes?.Asset?.find(asset => asset.sys.id === id);
}

// ============= IMAGE HELPER FUNCTIONS =============

/**
 * Get optimized Contentful image URL with transformations
 * Used in: [...course].astro, index.astro
 */
export function getOptimizedImageUrl(asset, options = {}) {
  if (!asset?.fields?.file?.url) return null;
  
  const baseUrl = asset.fields.file.url;
  const url = baseUrl.startsWith('//') ? `https:${baseUrl}` : baseUrl;
  
  const params = {
    w: options.width || 1920,
    h: options.height,
    q: options.quality || 80,
    fm: options.format || 'webp',
    fit: options.fit || 'fill',
    f: options.focus || 'center',
  };
  
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  return `${url}?${queryString}`;
}

/**
 * Generate srcset for responsive images
 * Used in: [...course].astro, index.astro
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
 * Time-based image rotation
 * Used in: [...course].astro, index.astro
 */
export function getRotatingImage(images, uniqueKey = '', rotation = 'daily') {
  if (!images || images.length === 0) return null;
  
  const now = new Date();
  let timeSeed;
  
  switch(rotation) {
    case 'hourly':
      timeSeed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
      break;
    case 'weekly':
      const weekNumber = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 604800000);
      timeSeed = `${now.getFullYear()}-week-${weekNumber}`;
      break;
    case 'daily':
    default:
      timeSeed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      break;
  }
  
  const combinedSeed = `${timeSeed}-${uniqueKey}`;
  
  let hash = 0;
  for (let i = 0; i < combinedSeed.length; i++) {
    const char = combinedSeed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const index = Math.abs(hash) % images.length;
  return images[index];
}

/**
 * Generate a low-quality image placeholder URL
 * Used in: [...course].astro, index.astro
 */
export function getPlaceholderImageUrl(asset) {
  if (!asset?.fields?.file?.url) return null;
  
  const baseUrl = asset.fields.file.url;
  const url = baseUrl.startsWith('//') ? `https:${baseUrl}` : baseUrl;
  
  // Contentful's valid parameters only
  const params = {
    w: 30,      // Tiny width for fast load
    q: 20,      // Low quality
    fm: 'jpg',  // JPEG for smaller size
    fl: 'progressive'  // Progressive JPEG
    // REMOVED: blur (not supported by Contentful)
  };
  
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  return `${url}?${queryString}`;
}


/**
 * Get all hero images from all campuses
 * Optimized to use a single API call
 * Used in: index.astro
 */
export async function getAllHeroImages() {
  // Single API call with minimal fields
  const entries = await contentfulClient.getEntries({
    content_type: 'campus',
    select: 'fields.campusName,fields.campusSlug,fields.heroImagePool',
    include: 1 // Only include the image assets
  });
  
  const allImages = [];
  
  for (const campus of entries.items) {
    if (campus.fields.heroImagePool && campus.fields.heroImagePool.length > 0) {
      for (const image of campus.fields.heroImagePool) {
        allImages.push({
          asset: image,
          campusName: campus.fields.campusName,
          campusSlug: campus.fields.campusSlug
        });
      }
    }
  }
  
  return allImages;
}

// ============= RESOURCE FUNCTIONS =============

/**
 * Get all resources
 */
export async function getResources() {
  const entries = await contentfulClient.getEntries({
    content_type: 'resource',
    order: 'fields.displayOrder',
    include: 1,
  });
  return entries.items;
}

/**
 * Get a specific resource by slug with full content
 */
export async function getResourceWithFullContent(resourceSlug) {
  const entries = await contentfulClient.getEntries({
    content_type: 'resource',
    'fields.resourceSlug': resourceSlug,
    include: 10,
  });
  
  return entries.items.length > 0 ? entries : null;
}

// ============= EVENT FUNCTIONS =============

/**
 * Get upcoming events with filters
 */
export async function getUpcomingEvents(options = {}) {
  const now = new Date().toISOString();
  
  const query = {
    content_type: 'event',
    'fields.eventDate[gte]': now,
    order: 'fields.eventDate',
    limit: options.limit || 10,
    include: 2,
  };
  
  if (options.category) {
    query['fields.eventCategory'] = options.category;
  }
  
  if (options.featuredOnly) {
    query['fields.featured'] = true;
  }
  
  const entries = await contentfulClient.getEntries(query);
  return entries.items;
}

/**
 * Get past events
 */
export async function getPastEvents(options = {}) {
  const now = new Date().toISOString();
  
  const query = {
    content_type: 'event',
    'fields.eventDate[lt]': now,
    order: '-fields.eventDate',
    limit: options.limit || 20,
    include: 2,
  };
  
  if (options.category) {
    query['fields.eventCategory'] = options.category;
  }
  
  const entries = await contentfulClient.getEntries(query);
  return entries.items;
}

/**
 * Get featured events
 */
export async function getFeaturedEvents(limit = 3) {
  const now = new Date().toISOString();
  
  const entries = await contentfulClient.getEntries({
    content_type: 'event',
    'fields.featured': true,
    'fields.eventDate[gte]': now,
    order: 'fields.eventDate',
    limit: limit,
    include: 2,
  });
  
  return entries.items;
}

/**
 * Get event categories
 */
export async function getEventCategories() {
  const entries = await contentfulClient.getEntries({
    content_type: 'event',
    select: 'fields.eventCategory',
    limit: 1000,
  });
  
  const categories = new Set();
  entries.items.forEach(event => {
    if (event.fields.eventCategory) {
      categories.add(event.fields.eventCategory);
    }
  });
  
  return Array.from(categories).sort();
}

/**
 * Process an Event List content item
 */
export async function processEventList(eventList) {
  const filters = {
    limit: eventList.fields.maxEvents || 6
  };
  
  // Add category filter if specified
  if (eventList.fields.eventCategory && eventList.fields.eventCategory !== 'All Events') {
    filters.category = eventList.fields.eventCategory.toLowerCase().replace(' ', '-');
  }
  
  // Add featured filter if checked
  if (eventList.fields.showOnlyFeatured) {
    filters.featuredOnly = true;
  }
  
  // Get events using existing function
  const events = await getUpcomingEvents(filters);
  
  return events;
}

// ============= NAVIGATION HELPER =============

/**
 * Get all navigation content (campuses and resources)
 */
export async function getNavigationContent() {
  const [campusesResponse, resourcesResponse] = await Promise.all([
    contentfulClient.getEntries({
      content_type: 'campus',
      include: 2,
      order: 'fields.displayOrder',
    }),
    contentfulClient.getEntries({
      content_type: 'resource',
      order: 'fields.displayOrder',
      include: 1,
    })
  ]);
  
  return {
    campuses: campusesResponse.items,
    resources: resourcesResponse.items
  };
}

// ============= MENTOR FUNCTIONS =============

/**
 * Get all mentors
 */
export async function getMentors(options = {}) {
  const query = {
    content_type: 'mentor',
    include: 2,
    limit: options.limit || 100,
  };
  // UPDATED: Filter by campus (supports single string or array of strings)
  if (options.campus) {
    // 1. Check if "All" is selected (either as string or inside array)
    const isAll = options.campus === 'All' || 
                 (Array.isArray(options.campus) && options.campus.includes('All'));

    // 2. If not "All", apply specific filters
    if (!isAll) {
      if (Array.isArray(options.campus)) {
        // If multiple campuses, use the 'in' operator with a comma-joined string
        query['fields.campus[in]'] = options.campus;
      } else {
        // Legacy support: Single string exact match
        query['fields.campus'] = options.campus;
      }
    }
  }
  
  // Filter by categories if specified
  if (options.categories && options.categories.length > 0) {
    query['fields.mentorCategories[in]'] = options.categories;
  }
  
  const entries = await contentfulClient.getEntries(query);
  
  // Sort alphabetically by name
  return entries.items.sort((a, b) => {
    const nameA = a.fields.mentorName.toLowerCase();
    const nameB = b.fields.mentorName.toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

/**
 * Get unique mentor categories from all mentors
 */
export async function getMentorCategories() {
  const entries = await contentfulClient.getEntries({
    content_type: 'mentor',
    select: 'fields.mentorCategories',
    limit: 1000,
  });
  
  const categories = new Set();
  entries.items.forEach(mentor => {
    if (mentor.fields.mentorCategories) {
      mentor.fields.mentorCategories.forEach(cat => categories.add(cat));
    }
  });
  
  return Array.from(categories).sort();
}

/**
 * Process a Mentor List content item
 */
export async function processMentorList(mentorList) {
  const filters = {};
  
  // This will now accept either a string ('Brighton') 
  // or an array (['Brighton', 'Sheffield']) depending on your Contentful setup
  if (mentorList.fields.filterCampus) {
    filters.campus = mentorList.fields.filterCampus;
  }
  
  // ... existing category logic ...
  if (mentorList.fields.filterCategories && mentorList.fields.filterCategories.length > 0) {
    filters.categories = mentorList.fields.filterCategories;
  }
  
  const mentors = await getMentors(filters);
  
  return mentors;
}

/**
 * Get mentor by slug (for potential individual mentor pages)
 */
export async function getMentorBySlug(mentorSlug) {
  const entries = await contentfulClient.getEntries({
    content_type: 'mentor',
    'fields.mentorSlug': mentorSlug,
    include: 2,
    limit: 1
  });
  
  return entries.items[0] || null;
}