<script setup lang="ts">
definePageMeta({
  middleware: [() => {
    const { user } = useUserSession()
    if (user.value && user.value.role !== 'owner') {
      return navigateTo('/')
    }
  }]
})

interface Branch {
  id: number
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
}

const toast = useToast()

const { data: branches, refresh: refreshBranches } = await useFetch<Branch[]>('/api/branches')

const branchModalOpen = ref(false)
const editingBranch = ref<Branch | null>(null)
const branchForm = reactive({ name: '', address: '', phone: '' })

function openNewBranch() {
  editingBranch.value = null
  branchForm.name = ''
  branchForm.address = ''
  branchForm.phone = ''
  branchModalOpen.value = true
}

function openEditBranch(branch: Branch) {
  editingBranch.value = branch
  branchForm.name = branch.name
  branchForm.address = branch.address ?? ''
  branchForm.phone = branch.phone ?? ''
  branchModalOpen.value = true
}

async function submitBranch() {
  const body = {
    name: branchForm.name,
    address: branchForm.address,
    phone: branchForm.phone
  }
  try {
    if (editingBranch.value) {
      await $fetch(`/api/branches/${editingBranch.value.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/branches', { method: 'POST', body })
    }
    branchModalOpen.value = false
    await refreshBranches()
    toast.add({ title: 'บันทึกสาขาสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'บันทึกไม่สำเร็จ', color: 'error' })
  }
}

async function setBranchActive(branch: Branch, isActive: boolean) {
  try {
    await $fetch(`/api/branches/${branch.id}`, { method: 'PATCH', body: { isActive } })
    await refreshBranches()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ทำรายการไม่สำเร็จ', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-8 flex flex-col gap-8">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-lg">
            จัดการสาขา
          </h2>
          <UButton
            icon="i-lucide-plus"
            size="sm"
            @click="openNewBranch"
          >
            เพิ่มสาขา
          </UButton>
        </div>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="branch in branches"
          :key="branch.id"
          class="flex items-center justify-between py-2 gap-2"
        >
          <div class="min-w-0">
            <p :class="{ 'text-muted line-through': !branch.isActive }">
              {{ branch.name }}
            </p>
            <p class="text-sm text-muted">
              {{ branch.address || 'ไม่ระบุที่อยู่' }} <span v-if="branch.phone">· {{ branch.phone }}</span>
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UBadge
              :color="branch.isActive ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ branch.isActive ? 'เปิดใช้งาน' : 'ปิดสาขา' }}
            </UBadge>
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="openEditBranch(branch)"
            />
            <UButton
              v-if="branch.isActive"
              icon="i-lucide-eye-off"
              size="xs"
              color="error"
              variant="ghost"
              @click="setBranchActive(branch, false)"
            />
            <UButton
              v-else
              icon="i-lucide-eye"
              size="xs"
              color="success"
              variant="ghost"
              @click="setBranchActive(branch, true)"
            />
          </div>
        </div>
        <p
          v-if="!branches?.length"
          class="text-muted text-sm py-4"
        >
          ยังไม่มีสาขา
        </p>
      </div>
    </UCard>

    <UModal
      v-model:open="branchModalOpen"
      :title="editingBranch ? 'แก้ไขสาขา' : 'เพิ่มสาขา'"
    >
      <template #body>
        <form
          class="flex flex-col gap-4"
          @submit.prevent="submitBranch"
        >
          <UFormField label="ชื่อสาขา">
            <UInput
              v-model="branchForm.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ที่อยู่">
            <UInput
              v-model="branchForm.address"
              class="w-full"
            />
          </UFormField>
          <UFormField label="เบอร์โทร">
            <UInput
              v-model="branchForm.phone"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
          >
            บันทึก
          </UButton>
        </form>
      </template>
    </UModal>
  </UContainer>
</template>
