<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value }
    })
    await refreshSession()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(redirect)
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'เข้าสู่ระบบไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex flex-col items-center gap-2">
          <img
            src="~/assets/images/main-logo.jpg"
            alt="บังโต POS"
            class="h-20 w-20 rounded-lg object-cover"
          >
          <p class="text-sm text-muted text-center">
            เข้าสู่ระบบสำหรับพนักงาน
          </p>
        </div>
      </template>

      <form
        class="flex flex-col gap-4"
        @submit.prevent="onSubmit"
      >
        <UFormField label="ชื่อผู้ใช้">
          <UInput
            v-model="username"
            autofocus
            size="xl"
            placeholder="username"
            class="w-full"
          />
        </UFormField>

        <UFormField label="รหัสผ่าน">
          <UInput
            v-model="password"
            type="password"
            size="xl"
            placeholder="••••••••"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          :title="error"
        />

        <UButton
          type="submit"
          block
          size="xl"
          :loading="loading"
        >
          เข้าสู่ระบบ
        </UButton>
      </form>
    </UCard>
  </div>
</template>
