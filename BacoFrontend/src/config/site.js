// Central place for sitewide link data so Header, Footer and Sitemap all
// read from one source instead of each keeping its own copy of hrefs.

export const site = {
    name: 'Municipality of Baco',
    subtitle: 'Province of Oriental Mindoro, Philippines',
    contact: {
      phone: '',
      email: '',
      address: 'Poblacion, Baco, Or. Mindoro 5201',
      hours: 'Mon–Fri, 8:00 AM – 5:00 PM',
    },
    // Replace with the municipality's real social pages — the only
    // genuinely unknowable values in this file.
    socials: [
      { id: 'facebook', label: 'Facebook',   icon: 'fa-brands fa-facebook-f', href: 'https://www.facebook.com/share/1CdU3ftK62/' },
    ],
  }
  
  // Footer navigation — every entry points at a route NAME defined in
  // src/router/index.js. A wrong name warns in console instead of dying silently.
  export const footerNav = [
    { label: 'About the Municipality', to: { name: 'municipality' } },
    { label: 'History of Baco',        to: { name: 'history' } },
    { label: 'Our Barangays',          to: { name: 'barangays' } },
    { label: 'Elected Officials',      to: { name: 'officials' } },
    { label: 'News & Updates',         to: { name: 'news' } },
    { label: 'Tourism',                to: { name: 'tourism' } },
    { label: 'Citizens Charter',       to: { name: 'citizens-charter' } },
  ]
  
  export const footerLegal = [
  
  ]
  
  export const contactItems = [
    { icon: 'fa-solid fa-phone',        text: site.contact.phone,   href: `tel:${site.contact.phone.replace(/\s+/g, '')}` },
    { icon: 'fa-solid fa-envelope',     text: site.contact.email,   href: `mailto:${site.contact.email}` },
    { icon: 'fa-solid fa-location-dot', text: site.contact.address },
    { icon: 'fa-solid fa-clock',        text: site.contact.hours },
  ]