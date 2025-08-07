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