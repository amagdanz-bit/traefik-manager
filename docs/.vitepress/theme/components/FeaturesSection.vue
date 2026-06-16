<script setup>
import { withBase } from 'vitepress'

const features = [
  {
    iconLight: '/images/icons/route-light.svg',
    iconDark: '/images/icons/route-dark.svg',
    title: 'Route Management',
    desc: 'Add, edit, and toggle routes without touching YAML.',
    tags: ['HTTP', 'TCP', 'UDP', 'Clone', 'Bulk actions', 'TLS options', 'Raw YAML editor'],
  },
  {
    iconLight: '/images/icons/shield-light.svg',
    iconDark: '/images/icons/shield-dark.svg',
    title: 'Middleware Wizards',
    desc: '20+ guided forms for every common middleware type.',
    tags: ['Basic Auth', 'OIDC', 'Authentik', 'Authelia', 'Gatekeeper', 'Rate Limit', 'IP Allowlist', 'Secure Headers', 'CORS', 'Custom templates'],
  },
  {
    iconLight: '/images/icons/chart-light.svg',
    iconDark: '/images/icons/chart-dark.svg',
    title: 'Live Dashboard',
    desc: 'Real-time stats, health pinging with latency, and access log analytics.',
    tags: ['Route Map', 'Access logs', 'Docker', 'Kubernetes', 'Swarm', 'Nomad', 'ECS'],
  },
  {
    iconLight: '/images/icons/agent-light.svg',
    iconDark: '/images/icons/agent-dark.svg',
    title: 'Multi-Server Agent',
    desc: 'Manage unlimited remote Traefik servers from one UI.',
    tags: ['Server switcher', 'Remote editing', 'Live data', 'Per-server tabs', 'CrowdSec', 'Git backup'],
    badge: 'New in v1.5',
  },
  {
    iconLight: '/images/icons/git-light.svg',
    iconDark: '/images/icons/git-dark.svg',
    title: 'Git Backup & Restore',
    desc: 'Auto-push config to Git after every change. Roll back in one click.',
    tags: ['GitHub', 'Gitea', 'GitLab', 'Forgejo', 'Diff viewer', 'One-click restore'],
    badge: 'New in v1.5',
  },
  {
    iconLight: '/images/icons/lock-light.svg',
    iconDark: '/images/icons/lock-dark.svg',
    title: 'Security & Config',
    desc: 'Auth, 2FA, SSO, and API keys built in. Static config editor with Traefik restart.',
    tags: ['bcrypt', 'TOTP 2FA', 'OIDC SSO', 'Static config', 'CrowdSec', 'Webhooks'],
  },
]
</script>

<template>
  <section class="fs-wrap">
    <div class="fs-grid">
      <div v-for="f in features" :key="f.title" class="fs-card">
        <div class="fs-top">
          <div class="fs-icon-box">
            <img class="fs-icon fs-icon-light" :src="withBase(f.iconLight)" :alt="f.title" width="24" height="24" />
            <img class="fs-icon fs-icon-dark" :src="withBase(f.iconDark)" :alt="f.title" width="24" height="24" />
          </div>
          <span v-if="f.badge" class="fs-badge">{{ f.badge }}</span>
        </div>
        <h3 class="fs-title">{{ f.title }}</h3>
        <p class="fs-desc">{{ f.desc }}</p>
        <div class="fs-tags">
          <span v-for="tag in f.tags" :key="tag" class="fs-tag">{{ tag }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fs-wrap {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px 80px;
}

.fs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.fs-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s;
}

.fs-card:hover {
  border-color: var(--vp-c-brand-1);
}

.fs-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.fs-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--vp-c-brand-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.fs-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.fs-icon-dark { display: none; }
.dark .fs-icon-dark { display: block; }
.dark .fs-icon-light { display: none; }

.fs-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 20px;
  padding: 2px 8px;
  opacity: 0.9;
}

.fs-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0;
  line-height: 1.3;
}

.fs-desc {
  font-size: 13px;
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.5;
}

.fs-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 4px;
}

.fs-tag {
  font-size: 11px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 2px 7px;
  white-space: nowrap;
}

@media (max-width: 960px) {
  .fs-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .fs-grid {
    grid-template-columns: 1fr;
  }
}
</style>
