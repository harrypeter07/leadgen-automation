// backend/providers/googleMaps/parser.js

class GoogleMapsParser {
  normalize(raw, city) {
    let cleanPhone = null;
    if (raw.phone) {
      cleanPhone = raw.phone.replace(/[^\d+]/g, '');
    }

    let reviewCount = null;
    if (raw.reviews) {
      reviewCount = parseInt(raw.reviews, 10) || null;
    }

    let rating = null;
    if (raw.rating) {
      const f = parseFloat(raw.rating);
      if (!isNaN(f) && f >= 1.0 && f <= 5.0) {
        rating = f;
      }
    }

    let cleanWebsite = null;
    if (raw.website && raw.website.trim().startsWith('http')) {
      cleanWebsite = raw.website.trim();
    }

    return {
      name: raw.name ? raw.name.trim() : 'Unknown Business',
      phone: cleanPhone,
      email: null,
      address: raw.address ? raw.address.trim() : null,
      city: city ? city.trim() : null,
      category: raw.category ? raw.category.trim() : null,
      website: cleanWebsite,
      rating: rating,
      review_count: reviewCount,
      source: 'google_maps',
      status: 'new',
      notes: raw.description ? raw.description.trim() : null,
    };
  }
}

module.exports = new GoogleMapsParser();
