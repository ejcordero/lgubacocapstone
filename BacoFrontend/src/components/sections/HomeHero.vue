<template>
  <section class="hero-section">
    <!-- Editor Badge (Only visible in admin canvas) -->
    <div v-if="isEditing" class="editor-mode-badge">🎬 Hero Section</div>

    <!-- Video Background Only — fully non-interactive -->
    <div class="video-wrapper" @contextmenu.prevent @dblclick.prevent>
      <video
        class="hero-video"
        autoplay
        muted
        loop
        playsinline
        disablepictureinpicture
        disableremoteplayback
        controlslist="nodownload nofullscreen noplaybackrate noremoteplayback"
        tabindex="-1"
        :poster="posterImg"
      >
        <source :src="videoSrc" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  </section>
</template>

<script setup>
defineProps({
  videoSrc: { type: String, default: '/videos/herosection_vid.mp4' },
  posterImg: { type: String, default: '/images/hero-imgs.jpg' },
  isEditing: { type: Boolean, default: false }
})
</script>

<style scoped>
/* Container: Full screen width and height */
.hero-section {
  position: relative;
  width: 100%;
  height: 100vh; /* Adjust height here (e.g., 80vh) if you don't want it full screen */
  overflow: hidden;
  background-color: #000; /* Fallback background color */
}

/* Ensure video fills the container perfectly */
.video-wrapper {
  width: 100%;
  height: 100%;
}

.hero-video {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Crops video edges to fill screen without stretching */
  pointer-events: none; /* Video ignores ALL mouse interaction — no hover overlays, no click, no right-click */
}

/* Editor Badge Styling */
.editor-mode-badge {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(15, 23, 42, 0.85);
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  z-index: 50;
  pointer-events: none;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(56, 189, 248, 0.3);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>