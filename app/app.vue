<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
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
const toast = useToast()

const { data: branches, execute: fetchBranches } = await useLazyFetch<Branch[]>(
  '/api/branches',
  {
    default: () => [],
    immediate: false
  }
)

watch(
  user,
  (u) => {
    if (u?.role === 'owner') fetchBranches()
  },
  { immediate: true }
)

const kioskOpen = ref(false)
const kioskCode = ref('')
const kioskLoading = ref(false)

function openKiosk() {
  kioskCode.value = ''
  kioskOpen.value = true
}

async function submitKiosk() {
  if (kioskCode.value.length < 4) return
  kioskLoading.value = true
  try {
    const result = await $fetch('/api/time-entries/kiosk', {
      method: 'POST',
      body: { code: kioskCode.value }
    })
    toast.add({
      title: `${result.employeeName} ${result.action === 'in' ? 'เข้างานแล้ว' : 'ออกงานแล้ว'}`,
      color: 'success'
    })
    kioskOpen.value = false
  } catch (err: any) {
    toast.add({
      title: err?.data?.statusMessage ?? 'ทำรายการไม่สำเร็จ',
      color: 'error'
    })
  } finally {
    kioskLoading.value = false
  }
}

const navItems = useNavItems()

const branchOptions = computed(() => [
  { label: 'ทุกสาขา', value: 'all' },
  ...branches.value
    .filter(b => b.isActive)
    .map(b => ({ label: b.name, value: String(b.id) }))
])

const activeBranchOption = computed({
  get: () =>
    user.value?.activeBranchId ? String(user.value.activeBranchId) : 'all',
  set: async (value: string) => {
    await $fetch('/api/auth/branch', {
      method: 'POST',
      body: { branchId: value === 'all' ? null : Number(value) }
    })
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
    <UHeader
      v-if="loggedIn"
      class="print:hidden"
      :toggle="{ size: 'lg', class: 'size-10' }"
      :ui="{ toggle: 'lg:flex', content: 'lg:flex', overlay: 'lg:block' }"
    >
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2"
        >
          <img
            src="~/assets/images/main-logo.jpg"
            alt="บังโต POS"
            class="h-9 w-9 rounded-md object-cover"
          >
          <span class="font-bold text-lg hidden sm:inline text-nowrap">บังโต POS</span>
        </NuxtLink>
      </template>

      <template #body>
        <UNavigationMenu
          v-if="user"
          orientation="vertical"
          :items="navItems"
          :ui="{
            list: 'flex flex-col gap-1',
            link: 'px-3 py-3.5 text-base rounded-lg',
            linkLeadingIcon: 'size-6'
          }"
        />
      </template>

      <template #right>
        <UColorModeButton
          size="lg"
          class="size-10"
        />

        <div
          v-if="user"
          class="flex items-center gap-3"
        >
          <UButton
            icon="i-lucide-clock"
            color="neutral"
            variant="soft"
            size="lg"
            class="text-nowrap"
            @click="openKiosk"
          >
            เข้า-ออกงาน
          </UButton>
          <USelect
            v-if="user.role === 'owner'"
            v-model="activeBranchOption"
            :items="branchOptions"
            icon="i-lucide-store"
            size="lg"
            class="w-40"
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
            size="lg"
            class="size-10"
            aria-label="ออกจากระบบ"
            @click="logout"
          />
        </div>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UModal
      v-model:open="kioskOpen"
      title="เข้า-ออกงาน"
      description="กรอกรหัสพนักงานของคุณ"
    >
      <template #body>
        <PinPad
          v-model="kioskCode"
          :loading="kioskLoading"
          @submit="submitKiosk"
        />
      </template>
    </UModal>
  </UApp>
</template>
