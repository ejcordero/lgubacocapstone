<template>
  <div class="hotel-card" :class="{ 'booked': !hotel.available }">
    <div v-if="!hotel.available" class="booked-overlay">
      <span class="badge badge-red lg">Fully Booked</span>
    </div>
    
    <div class="hotel-img-wrapper">
      <img :src="hotel.image" :alt="hotel.name" />
      <div v-if="hotel.avgRating" class="rating-badge">
        <Star size="14" class="star-icon" />
        {{ hotel.avgRating }}
        <span class="rating-count">{{ hotel.reviewCount }}</span>
      </div>
      <div v-if="hotel.available" class="availability-badge">Available</div>
    </div>
    
    <div class="hotel-info">
      <h3>{{ hotel.name }}</h3>
      <p class="location">
        <MapPin size="14" />
        {{ hotel.location }}
      </p>
      
      <div class="amenities-list mb-md">
        <span v-for="(amenity, i) in hotel.amenities.slice(0, 3)" :key="i" class="amenity-chip">
          {{ amenity }}
        </span>
        <span v-if="hotel.amenities.length > 3">
          +{{ hotel.amenities.length - 3 }}
        </span>
      </div>
      
      <div class="hotel-footer">
        <div>
          <span class="price-label">Starts at</span>
          <span class="price-val">₱{{ hotel.basePrice }}</span>
        </div>
        <button 
          @click="handleViewHotel"
          :disabled="!hotel.available"
          class="clay-btn blue sm"
        >
          View Details
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { 
  Star, MapPin, 
  ChevronRight, Loader2 
} from 'lucide-vue-next';

const props = defineProps({
  hotel: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['view-hotel']);

const handleViewHotel = () => {
  emit('view-hotel', props.hotel);
};
</script>

<style scoped>
.hotel-card {
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--bb-shadow-sm); border: 1px solid var(--border);
  overflow: hidden;
  position: relative;
  transition: transform 0.2s;
  cursor: pointer;
}

.hotel-card:hover {
  transform: translateY(-2px);
}

.hotel-card.booked {
  opacity: 0.7;
  cursor: not-allowed;
}

.booked-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(2px);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hotel-img-wrapper {
  height: 12rem;
  width: 100%;
  background: var(--border);
  position: relative;
  overflow: hidden;
}

.hotel-img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.hotel-card:hover .hotel-img-wrapper img {
  transform: scale(1.05);
}

.rating-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
}

.star-icon {
  color: var(--bb-sun);
  fill: var(--bb-sun);
}

.rating-count {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-semibold);
  color: var(--c-muted);
  margin-left: 2px;
}

.availability-badge {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(34, 197, 94, 0.9);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
}

.hotel-info {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.location {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--bb-text-base);
  color: var(--c-muted);
  margin-bottom: 0.75rem;
}

.amenity-chip {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--sand-2);
  color: var(--c-muted);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  display: inline-block;
}

.hotel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--c-border);
}

.price-label {
  font-size: var(--bb-text-xs);
  color: var(--c-muted);
  display: block;
  margin-bottom: -2px;
}

.price-val {
  font-size: var(--bb-text-xl);
  font-weight: var(--bb-weight-bold);
  color: var(--c-danger);
}

/* Clay Button */
.clay-btn {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-weight: var(--bb-weight-bold);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  box-shadow: var(--bb-shadow-sm);
}

.clay-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--bb-shadow-md); transform: translateY(-1px);
}

.clay-btn.sm {
  padding: 0.5rem 1rem;
  font-size: var(--bb-text-base);
  border-radius: var(--radius-sm);
}

.clay-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none !important;
  transform: none !important;
}

/* Badges */
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
}

.badge.lg {
  padding: 0.5rem 1rem;
  font-size: var(--bb-text-base);
}

.badge-red {
  background: var(--bb-danger-soft);
  color: var(--bb-danger);
}
</style>
