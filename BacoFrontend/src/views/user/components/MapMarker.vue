<template>
  <div class="map-marker" :style="markerStyle">
    <MapMarkerIcon size="24" />
    <div v-if="showTooltip" class="marker-tooltip">
      <h4>{{ location.name }}</h4>
      <p>{{ location.description }}</p>
    </div>
  </div>
</template>

<script setup>
import { defineProps, ref } from 'vue';
import { MapMarker as MapMarkerIcon } from 'lucide-vue-next';

const props = defineProps({
  location: {
    type: Object,
    required: true
  },
  position: {
    type: Object,
    required: true,
    default: () => ({ top: '30%', left: '20%' })
  }
});

const showTooltip = ref(false);
const markerStyle = computed(() => ({
  position: 'absolute',
  top: props.position.top,
  left: props.position.left,
  cursor: 'pointer',
  zIndex: 5
}));

const handleMouseEnter = () => {
  showTooltip.value = true;
};

const handleMouseLeave = () => {
  showTooltip.value = false;
};
</script>

<style scoped>
.map-marker {
  position: absolute;
  cursor: pointer;
  z-index: 5;
}

.map-marker:hover .marker-tooltip {
  display: block;
}

.marker-tooltip {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bb-surface);
  padding: 0.75rem;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--c-border);
  min-width: 150px;
  margin-bottom: 0.5rem;
  white-space: nowrap;
}

.marker-tooltip h4 {
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
  margin-bottom: 0.25rem;
  color: var(--c-primary);
}

.marker-tooltip p {
  font-size: var(--bb-text-xs);
  color: var(--c-muted);
}
</style>
