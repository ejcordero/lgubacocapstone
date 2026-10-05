import HomeHero from '@/components/sections/HomeHero.vue'
import HomeStats from '@/components/sections/HomeStats.vue'
import HomeServices from '@/components/sections/HomeServices.vue'
import HomeMayor from '@/components/sections/HomeMayor.vue'
import HomeNews from '@/components/sections/HomeNews.vue'

// Import the actual page views
import OfficialsPage from '@/views/Officials.vue'
import NewsPage from '@/views/News.vue'
import HistoryPage from '@/views/History.vue'
import BarangaysPage from '@/views/Barangays.vue'
import MunicipalityPage from '@/views/Municipality.vue'

const components = {
  HomeHero, HomeStats, HomeServices, HomeMayor, HomeNews,
  OfficialsPage, NewsPage, HistoryPage, BarangaysPage, MunicipalityPage
}

export const sectionRegistry = {
  // Home sections (modular)
  HomeHero: {
    component: HomeHero,
    label: 'Hero Section',
    icon: 'fa-panorama',
    category: 'hero',
    fields: [
      { key: 'videoSrc', label: 'Video Source', type: 'text', default: '/videos/herosection_vid.mp4' },
      { key: 'posterImg', label: 'Poster Image', type: 'text', default: '/images/hero-imgs.jpg' }
    ]
  },
  HomeStats: {
    component: HomeStats,
    label: 'Statistics Band',
    icon: 'fa-chart-bar',
    category: 'content',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow Text', type: 'text', default: 'By the Numbers' },
      { key: 'title', label: 'Section Title', type: 'text', default: 'Baco at a Glance' }
    ]
  },
  HomeServices: {
    component: HomeServices,
    label: 'Public Services',
    icon: 'fa-building-columns',
    category: 'content',
    fields: [
      { key: 'subtitle', label: 'Eyebrow', type: 'text', default: 'Municipality of Baco' },
      { key: 'title', label: 'Section Title', type: 'text', default: 'Comprehensive Public Services' }
    ]
  },
  HomeMayor: {
    component: HomeMayor,
    label: "Mayor's Message",
    icon: 'fa-user-tie',
    category: 'content',
    fields: [
      { key: 'title', label: 'Section Title', type: 'text', default: 'Message from the Mayor' },
      { key: 'mayorName', label: 'Mayor Name', type: 'text', default: 'Hon. Allan A. Roldan' },
      { key: 'mayorTitle', label: 'Mayor Title', type: 'text', default: 'Municipal Mayor' },
      { key: 'image', label: 'Photo URL', type: 'text', default: '/images/mayor-imgs.jpg' },
      { key: 'message', label: 'Quote Message', type: 'textarea', default: 'Together, we are building a Baco that is socially just.' },
      { key: 'bodyText', label: 'Body Text', type: 'textarea', default: 'Our administration remains steadfast in its commitment to transparent governance.' }
    ]
  },
  HomeNews: {
    component: HomeNews,
    label: 'News & Announcements',
    icon: 'fa-newspaper',
    category: 'content',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text', default: 'Official Bulletins' },
      { key: 'title', label: 'Section Title', type: 'text', default: 'News & Announcements' }
    ]
  },

  // Full page blocks (atomic)
  OfficialsPage: {
    component: OfficialsPage,
    label: 'Officials Page',
    icon: 'fa-users',
    category: 'page',
    fields: []
  },
  NewsPage: {
    component: NewsPage,
    label: 'News Page',
    icon: 'fa-newspaper',
    category: 'page',
    fields: []
  },
  HistoryPage: {
    component: HistoryPage,
    label: 'History Page',
    icon: 'fa-clock-rotate-left',
    category: 'page',
    fields: []
  },
  BarangaysPage: {
    component: BarangaysPage,
    label: 'Barangays Page',
    icon: 'fa-map-location-dot',
    category: 'page',
    fields: []
  },
  MunicipalityPage: {
    component: MunicipalityPage,
    label: 'Municipality Page',
    icon: 'fa-landmark',
    category: 'page',
    fields: []
  }
}

export function getSectionDefaults(type) {
  const registry = sectionRegistry[type]
  if (!registry) return {}
  const defaults = {}
  registry.fields.forEach(field => {
    defaults[field.key] = field.default
  })
  return defaults
}

export const categoryLabels = {
  hero: 'Hero Sections',
  content: 'Content Sections',
  page: 'Full Pages'
}