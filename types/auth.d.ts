declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    name: string
    role: 'owner' | 'manager' | 'staff'
    branchId: number | null
    branchName: string | null
    /** Branch the user is currently acting on. `null` means "all branches" (owner only — manager/staff always match `branchId`). */
    activeBranchId: number | null
  }
}

export {}
