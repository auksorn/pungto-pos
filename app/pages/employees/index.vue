<script setup lang="ts">
definePageMeta({
  middleware: [() => {
    const { user } = useUserSession()
    if (user.value && user.value.role !== 'owner') {
      return navigateTo('/')
    }
  }]
})

type Role = 'owner' | 'manager' | 'staff'

interface Branch {
  id: number
  name: string
  isActive: boolean
}

interface Employee {
  id: number
  branchId: number | null
  name: string
  username: string
  role: Role
  isActive: boolean
  code: string | null
  branch: Branch | null
}

const roleLabels: Record<Role, string> = {
  owner: 'เจ้าของร้าน',
  manager: 'ผู้จัดการ',
  staff: 'พนักงาน'
}

const { user } = useUserSession()
const toast = useToast()

const { data: employees, refresh } = await useFetch<Employee[]>('/api/employees')
const { data: branches } = await useFetch<Branch[]>('/api/branches')

const branchOptions = computed(() => [
  { label: 'ไม่ระบุสาขา', value: null as number | null },
  ...(branches.value ?? []).filter(b => b.isActive).map(b => ({ label: b.name, value: b.id as number | null }))
])

const roleOptions = (Object.keys(roleLabels) as Role[]).map(value => ({ label: roleLabels[value], value }))

const modalOpen = ref(false)
const editingEmployee = ref<Employee | null>(null)
const form = reactive({
  name: '',
  username: '',
  password: '',
  role: 'staff' as Role,
  branchId: null as number | null,
  code: ''
})
const submitting = ref(false)

function openNewEmployee() {
  editingEmployee.value = null
  form.name = ''
  form.username = ''
  form.password = ''
  form.role = 'staff'
  form.branchId = null
  form.code = ''
  modalOpen.value = true
}

function openEditEmployee(employee: Employee) {
  editingEmployee.value = employee
  form.name = employee.name
  form.username = employee.username
  form.password = ''
  form.role = employee.role
  form.branchId = employee.branchId
  form.code = employee.code ?? ''
  modalOpen.value = true
}

async function submitEmployee() {
  submitting.value = true
  try {
    if (editingEmployee.value) {
      const body: Record<string, unknown> = { name: form.name, username: form.username, role: form.role, branchId: form.branchId, code: form.code }
      if (form.password) body.password = form.password
      await $fetch(`/api/employees/${editingEmployee.value.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/employees', { method: 'POST', body: form })
    }
    modalOpen.value = false
    await refresh()
    toast.add({ title: 'บันทึกข้อมูลพนักงานสำเร็จ', color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'บันทึกไม่สำเร็จ', color: 'error' })
  } finally {
    submitting.value = false
  }
}

async function setActive(employee: Employee, isActive: boolean) {
  try {
    await $fetch(`/api/employees/${employee.id}`, { method: 'PATCH', body: { isActive } })
    await refresh()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'ทำรายการไม่สำเร็จ', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-6">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h1 class="font-bold text-lg">
            จัดการพนักงาน
          </h1>
          <UButton
            icon="i-lucide-plus"
            size="lg"
            @click="openNewEmployee"
          >
            เพิ่มพนักงาน
          </UButton>
        </div>
      </template>

      <div class="flex flex-col divide-y divide-default">
        <div
          v-for="employee in employees"
          :key="employee.id"
          class="flex flex-wrap items-center justify-between py-4 gap-3"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p
                class="font-medium truncate"
                :class="{ 'text-muted line-through': !employee.isActive }"
              >
                {{ employee.name }}
              </p>
              <UBadge
                variant="subtle"
                color="neutral"
              >
                {{ roleLabels[employee.role] }}
              </UBadge>
              <UBadge
                :color="employee.isActive ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ employee.isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน' }}
              </UBadge>
            </div>
            <p class="text-sm text-muted">
              @{{ employee.username }} · {{ employee.branch?.name ?? 'ไม่มีสาขา' }}
              <template v-if="employee.code">
                · รหัสเข้างาน {{ employee.code }}
              </template>
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              icon="i-lucide-pencil"
              size="lg"
              color="neutral"
              variant="ghost"
              class="size-10"
              @click="openEditEmployee(employee)"
            />
            <UButton
              v-if="employee.isActive"
              icon="i-lucide-eye-off"
              size="lg"
              color="error"
              variant="ghost"
              class="size-10"
              :disabled="employee.id === user?.id"
              :title="employee.id === user?.id ? 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้' : 'ปิดใช้งาน'"
              @click="setActive(employee, false)"
            />
            <UButton
              v-else
              icon="i-lucide-eye"
              size="lg"
              color="success"
              variant="ghost"
              class="size-10"
              title="เปิดใช้งาน"
              @click="setActive(employee, true)"
            />
          </div>
        </div>
        <p
          v-if="!employees?.length"
          class="text-muted text-sm py-4"
        >
          ยังไม่มีพนักงาน
        </p>
      </div>
    </UCard>

    <UModal
      v-model:open="modalOpen"
      :title="editingEmployee ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงาน'"
    >
      <template #body>
        <form
          class="flex flex-col gap-4"
          @submit.prevent="submitEmployee"
        >
          <UFormField label="ชื่อพนักงาน">
            <UInput
              v-model="form.name"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ชื่อผู้ใช้ (username)">
            <UInput
              v-model="form.username"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="editingEmployee ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน'">
            <UInput
              v-model="form.password"
              type="password"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="ตำแหน่ง">
            <USelect
              v-model="form.role"
              :items="roleOptions"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField label="สาขาที่สังกัด">
            <USelect
              v-model="form.branchId"
              :items="branchOptions"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="รหัสเข้างาน (PIN 4-8 หลัก สำหรับปุ่มเข้า-ออกงาน)"
            hint="เว้นว่างได้"
          >
            <UInput
              v-model="form.code"
              inputmode="numeric"
              maxlength="8"
              size="lg"
              placeholder="เช่น 1234"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            size="lg"
            :loading="submitting"
          >
            บันทึก
          </UButton>
        </form>
      </template>
    </UModal>
  </UContainer>
</template>
