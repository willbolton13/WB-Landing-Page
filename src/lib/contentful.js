// This file is COMPLETE and ready to use
import { createClient } from 'contentful';

export const contentfulClient = createClient({
  space: import.meta.env.CONTENTFUL_SPACE_ID,
  accessToken: import.meta.env.CONTENTFUL_ACCESS_TOKEN,
});

// Helper functions
export async function getLocations() {
  const entries = await contentfulClient.getEntries({
    content_type: 'location',
  });
  return entries.items;
}

export async function getLocationByName(locationName) {
  const entries = await contentfulClient.getEntries({
    content_type: 'location',
    'fields.locationName': locationName,
    include: 10,
  });
  return entries.items[0];
}

export async function getAllLocationData() {
  const entries = await contentfulClient.getEntries({
    content_type: 'location',
    include: 10,
  });
  return entries;
}