<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Shot {
  light: string
  dark: string
  label: string
  note?: string
}

interface Group {
  title: string
  shots: Shot[]
}

const props = defineProps<{ groups: Group[] }>()

const flat = computed(() => props.groups.flatMap(g => g.shots))
const open = ref(-1)

const shot = computed(() => (open.value >= 0 ? flat.value[open.value] : null))

function show(s: Shot) {
  open.value = flat.value.indexOf(s)
  document.body.style.overflow = 'hidden'
}

function close() {
  open.value = -1
  document.body.style.overflow = ''
}

function step(n: number) {
  if (open.value < 0) return
  open.value = (open.value + n + flat.value.length) % flat.value.length
}

function onKey(e: KeyboardEvent) {
  if (open.value < 0) return
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowRight') step(1)
  if (e.key === 'ArrowLeft') step(-1)
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="sg">
    <section v-for="g in groups" :key="g.title" class="sg-group">
      <h3 class="sg-group-title">{{ g.title }}</h3>
      <div class="sg-grid">
        <button v-for="s in g.shots" :key="s.label" type="button" class="sg-item" @click="show(s)">
          <span class="sg-thumb">
            <img class="sg-img light-img" :src="s.light" :alt="s.label" loading="lazy" />
            <img class="sg-img dark-img" :src="s.dark" :alt="s.label" loading="lazy" />
            <span class="sg-zoom">Click to enlarge</span>
          </span>
          <span class="sg-cap">
            <span class="sg-label">{{ s.label }}</span>
            <span v-if="s.note" class="sg-note">{{ s.note }}</span>
          </span>
        </button>
      </div>
    </section>

    <div v-if="shot" class="sg-lb" @click.self="close">
      <button class="sg-close" type="button" aria-label="Close" @click="close">&times;</button>
      <button class="sg-nav sg-prev" type="button" aria-label="Previous" @click="step(-1)">&lsaquo;</button>
      <figure class="sg-lb-fig">
        <img class="sg-lb-img light-img" :src="shot.light" :alt="shot.label" />
        <img class="sg-lb-img dark-img" :src="shot.dark" :alt="shot.label" />
        <figcaption class="sg-lb-cap">
          {{ shot.label }}
          <span class="sg-lb-count">{{ open + 1 }} / {{ flat.length }}</span>
        </figcaption>
      </figure>
      <button class="sg-nav sg-next" type="button" aria-label="Next" @click="step(1)">&rsaquo;</button>
    </div>
  </div>
</template>

<style scoped>
.sg-group { margin: 34px 0 0; }
.sg-group-title {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-divider);
  padding-bottom: 8px;
}
.sg-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
.sg-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  text-align: left;
  font: inherit;
  color: inherit;
}
.sg-thumb {
  position: relative;
  display: block;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.15s, transform 0.15s;
}
.sg-item:hover .sg-thumb { border-color: var(--vp-c-brand-1); transform: translateY(-2px); }
.sg-img { display: block; width: 100%; height: auto; }
.sg-zoom {
  position: absolute;
  inset: auto 0 0 0;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
  opacity: 0;
  transition: opacity 0.15s;
}
.sg-item:hover .sg-zoom { opacity: 1; }
.sg-cap { display: flex; flex-direction: column; gap: 2px; }
.sg-label { font-size: 14px; font-weight: 600; color: var(--vp-c-text-1); }
.sg-note { font-size: 12px; color: var(--vp-c-text-2); }

.sg-lb {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px;
  background: rgba(0, 0, 0, 0.86);
  backdrop-filter: blur(3px);
}
.sg-lb-fig { margin: 0; max-width: 100%; max-height: 100%; display: flex; flex-direction: column; gap: 10px; }
.sg-lb-img { max-width: 100%; max-height: calc(100vh - 110px); object-fit: contain; border-radius: 8px; }
.sg-lb-cap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}
.sg-lb-count { font-weight: 400; opacity: 0.65; }
.sg-close {
  position: absolute;
  top: 14px;
  right: 18px;
  width: 38px;
  height: 38px;
  font-size: 26px;
  line-height: 1;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.sg-nav {
  flex-shrink: 0;
  width: 42px;
  height: 62px;
  font-size: 30px;
  line-height: 1;
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.sg-close:hover, .sg-nav:hover { background: rgba(255, 255, 255, 0.24); }

html:not(.dark) .dark-img { display: none; }
html.dark .light-img { display: none; }

@media (max-width: 640px) {
  .sg-grid { grid-template-columns: 1fr; }
  .sg-lb { padding: 12px; }
  .sg-nav { width: 34px; height: 52px; font-size: 24px; }
}
</style>
