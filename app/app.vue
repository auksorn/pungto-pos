<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'th'
  }
})

useSeoMeta({
  title: 'บังโต POS'
})

interface Branch {
  id: number
  name: string
  isActive: boolean
}

const { loggedIn, user, clear, fetch: refreshSession } = useUserSession()

const { data: branches, execute: fetchBranches } = await useLazyFetch<Branch[]>('/api/branches', {
  default: () => [],
  immediate: false
})

watch(user, (u) => {
  if (u?.role === 'owner') fetchBranches()
}, { immediate: true })

const branchOptions = computed(() => [
  { label: 'ทุกสาขา', value: 'all' },
  ...branches.value.filter(b => b.isActive).map(b => ({ label: b.name, value: String(b.id) }))
])

const activeBranchOption = computed({
  get: () => user.value?.activeBranchId ? String(user.value.activeBranchId) : 'all',
  set: async (value: string) => {
    await $fetch('/api/auth/branch', { method: 'POST', body: { branchId: value === 'all' ? null : Number(value) } })
    await refreshSession()
    // Reload so every page's already-fetched data picks up the new branch context
    location.reload()
  }
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <UApp>
    <UHeader v-if="loggedIn">
      <template #left>
        <NuxtLink
          to="/"
          class="font-bold text-lg"
        >
          บังโต POS
        </NuxtLink>
      </template>

      <template #default>
        <UNavigationMenu
          v-if="user"
          :items="[
            { label: 'ขายหน้าร้าน', to: '/pos', icon: 'i-lucide-shopping-cart' },
            { label: 'สต๊อก', to: '/stock', icon: 'i-lucide-package' },
            ...(['owner', 'manager'].includes(user.role) ? [{ label: 'จัดการเมนู', to: '/menu', icon: 'i-lucide-coffee' }] : []),
            ...(['owner', 'manager'].includes(user.role) ? [{ label: 'รายงาน', to: '/reports', icon: 'i-lucide-bar-chart-3' }] : []),
            ...(user.role === 'owner' ? [{ label: 'จัดการสาขา', to: '/branches', icon: 'i-lucide-store' }] : []),
            ...(user.role === 'owner' ? [{ label: 'จัดการพนักงาน', to: '/employees', icon: 'i-lucide-users' }] : [])
          ]"
        />
      </template>

      <template #right>
        <UColorModeButton />

        <div
          v-if="user"
          class="flex items-center gap-3"
        >
          <USelect
            v-if="user.role === 'owner'"
            v-model="activeBranchOption"
            :items="branchOptions"
            icon="i-lucide-store"
            class="w-36"
          />
          <div
            v-else
            class="text-sm text-right"
          >
            <p class="font-medium">
              {{ user.name }}
            </p>
            <p class="text-muted">
              {{ user.branchName ?? 'ไม่มีสาขา' }}
            </p>
          </div>
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            aria-label="ออกจากระบบ"
            @click="logout"
          />
        </div>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
