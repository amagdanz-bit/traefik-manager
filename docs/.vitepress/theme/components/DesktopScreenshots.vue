<script setup lang="ts">
import ScreenshotGrid from './ScreenshotGrid.vue'

const s = (n: string, label: string, note?: string) => ({
  light: `/images/light-${n}.png`,
  dark: `/images/dark-${n}.png`,
  label,
  note,
})

const groups = [
  {
    title: 'Management',
    shots: [
      s('routes-cards', 'Routes', 'Card view'),
      s('routes-list', 'Routes', 'List view'),
      s('routes-add-http', 'Add HTTP route'),
      s('routes-add-tcp', 'Add TCP route'),
      s('routes-add-udp', 'Add UDP route'),
      s('middlewares-cards', 'Middlewares', 'Card view'),
      s('middlewares-list', 'Middlewares', 'List view'),
      s('middlewares-add', 'Add middleware'),
      s('services-cards', 'Services', 'Card view'),
      s('services-list', 'Services', 'List view'),
      s('static-config', 'Static Config', 'traefik.yml editor'),
    ],
  },
  {
    title: 'Visualizations',
    shots: [
      s('dashboard', 'Dashboard'),
      s('dashboard-hover', 'Dashboard', 'App launcher'),
      s('route-map', 'Route Map'),
      s('tls-options', 'TLS Options'),
      s('crowdsec', 'CrowdSec', 'Attack surface'),
    ],
  },
  {
    title: 'Monitoring',
    shots: [
      s('certs', 'Certificates'),
      s('logs', 'Access Logs'),
      s('plugins', 'Plugins'),
      s('plugins-add', 'Install a plugin'),
    ],
  },
  {
    title: 'Settings',
    shots: [
      s('settings-interface', 'Interface'),
      s('settings-auth-password', 'Authentication'),
      s('settings-auth-apikeys', 'API keys'),
      s('settings-auth-oidc', 'OIDC / SSO'),
      s('settings-backups', 'Backups'),
      s('settings-system', 'System monitoring'),
      s('settings-routes', 'Route monitoring'),
      s('settings-connection', 'Connection'),
      s('settings-about', 'About'),
    ],
  },
  {
    title: 'First run',
    shots: [
      s('login', 'Login'),
      s('setup-welcome', 'Setup', 'Welcome'),
      s('setup-connection', 'Setup', 'Connection and domains'),
      s('setup-self-route', 'Setup', 'Self route'),
      s('setup-monitoring', 'Setup', 'Optional tabs'),
      s('setup-password', 'Setup', 'Set a password'),
    ],
  },
]
</script>

<template>
  <ScreenshotGrid :groups="groups" />
</template>
