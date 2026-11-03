import type { MetadataRoute } from 'next';

// Keep crawlers off API routes and ticket pages. Admin paths are intentionally
// NOT listed here: robots.txt is public and must not advertise the committee
// portal — those routes are protected with `X-Robots-Tag: noindex` instead.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/ticket/'],  
    },
  };
}
