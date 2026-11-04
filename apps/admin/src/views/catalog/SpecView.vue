<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
} from 'element-plus'
import { getErrorMessage } from '../../api/errors'
import {
  createSpecGroup,
  createSpecOption,
  deleteSpecGroup,
  deleteSpecOption,
  fetchSpecGroups,
  updateSpecGroup,
  updateSpecOption,
} from '../../api/specs'
import { centsToYuan, formatDelta, yuanToCents } from '../../utils/money'
import type { AdminSpecGroup, AdminSpecOption } from '../../types/catalog'

const groups = ref<AdminSpecGroup[]>([])
const loading = ref(false)
const saving = ref(false)
const groupDialog = ref(false)
const optionDialog = ref(false)
const editingGroupId = ref<string | null>(null)
const editingOptionId = ref<string | null>(null)
const optionGroupId = ref('')
const groupFormRef = ref<FormInstance>()
const optionFormRef = ref<FormInstance>()

const groupForm = reactive({
  name: '',
  required: true,
  multiSelect: false,
  minSelect: 1,
  maxSelect: 1,
  sort: 0,
})

const optionForm = reactive({
  name: '',
  priceDeltaYuan: 0,
  isDefault: false,
  isAvailable: true,
  sort: 0,
})

function asOption(row: unknown): AdminSpecOption {
  return row as AdminSpecOption
}

const groupRules: FormRules = {
  name: [
    { required: true, message: '请输入规格组名称', trigger: 'blur' },
    { max: 30, message: '规格组名称最多 30 个字', trigger: 'blur' },
  ],
}

const optionRules: FormRules = {
  name: [
    { required: true, message: '请输入选项名称', trigger: 'blur' },
    { max: 30, message: '选项名称最多 30 个字', trigger: 'blur' },
  ],
}

async function load() {
  loading.value = true
  try {
    groups.value = await fetchSpecGroups()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载规格失败'))
  } finally {
    loading.value = false
  }
}

function resetGroupForm() {
  editingGroupId.value = null
  groupForm.name = ''
  groupForm.required = true
  groupForm.multiSelect = false
  groupForm.minSelect = 1
  groupForm.maxSelect = 1
  groupForm.sort = 0
  groupFormRef.value?.clearValidate()
}

function openCreateGroup() {
  resetGroupForm()
  groupDialog.value = true
}

function openEditGroup(group: AdminSpecGroup) {
  editingGroupId.value = group.id
  groupForm.name = group.name
  groupForm.required = group.required
  groupForm.multiSelect = group.multiSelect
  groupForm.minSelect = group.minSelect
  groupForm.maxSelect = group.maxSelect
  groupForm.sort = group.sort
  groupDialog.value = true
}

function onMultiSelectChange(value: string | number | boolean) {
  if (value !== true) {
    groupForm.maxSelect = 1
    groupForm.minSelect = groupForm.required ? 1 : 0
  }
}

async function saveGroup() {
  const valid = groupFormRef.value
    ? await groupFormRef.value.validate().catch(() => false)
    : false
  if (!valid) {
    return
  }

  const maxSelect = groupForm.multiSelect ? Math.max(groupForm.maxSelect, 1) : 1
  const minSelect = groupForm.multiSelect
    ? Math.min(Math.max(groupForm.minSelect, 1), maxSelect)
    : groupForm.required
      ? 1
      : 0

  const payload = {
    name: groupForm.name.trim(),
    required: groupForm.required,
    multiSelect: groupForm.multiSelect,
    minSelect,
    maxSelect,
    sort: groupForm.sort,
  }

  saving.value = true
  try {
    if (editingGroupId.value) {
      await updateSpecGroup(editingGroupId.value, payload)
      ElMessage.success('规格组已更新')
    } else {
      await createSpecGroup(payload)
      ElMessage.success('规格组已创建')
    }
    groupDialog.value = false
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存规格组失败'))
  } finally {
    saving.value = false
  }
}

function resetOptionForm() {
  editingOptionId.value = null
  optionGroupId.value = ''
  optionForm.name = ''
  optionForm.priceDeltaYuan = 0
  optionForm.isDefault = false
  optionForm.isAvailable = true
  optionForm.sort = 0
  optionFormRef.value?.clearValidate()
}

function openCreateOption(group: AdminSpecGroup) {
  resetOptionForm()
  optionGroupId.value = group.id
  optionForm.isDefault = group.options.length === 0
  optionDialog.value = true
}

function openEditOption(group: AdminSpecGroup, option: AdminSpecOption) {
  editingOptionId.value = option.id
  optionGroupId.value = group.id
  optionForm.name = option.name
  optionForm.priceDeltaYuan = centsToYuan(option.priceDeltaCents)
  optionForm.isDefault = option.isDefault
  optionForm.isAvailable = option.isAvailable
  optionForm.sort = option.sort
  optionDialog.value = true
}

async function saveOption() {
  const valid = optionFormRef.value
    ? await optionFormRef.value.validate().catch(() => false)
    : false
  if (!valid) {
    return
  }

  const priceDeltaCents = yuanToCents(optionForm.priceDeltaYuan)
  if (!Number.isFinite(priceDeltaCents) || priceDeltaCents < 0) {
    ElMessage.error('加价不能小于 0')
    return
  }

  const payload = {
    name: optionForm.name.trim(),
    priceDeltaCents,
    isDefault: optionForm.isDefault,
    isAvailable: optionForm.isAvailable,
    sort: optionForm.sort,
  }

  saving.value = true
  try {
    if (editingOptionId.value) {
      await updateSpecOption(editingOptionId.value, payload)
      ElMessage.success('选项已更新')
    } else {
      await createSpecOption(optionGroupId.value, payload)
      ElMessage.success('选项已创建')
    }
    optionDialog.value = false
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存选项失败'))
  } finally {
    saving.value = false
  }
}

async function setDefault(option: AdminSpecOption) {
  try {
    await updateSpecOption(option.id, { isDefault: true })
    ElMessage.success('已设为默认选项')
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '设置默认选项失败'))
  }
}

async function toggleAvailable(option: AdminSpecOption, value: boolean) {
  try {
    await updateSpecOption(option.id, { isAvailable: value })
    ElMessage.success(value ? '选项已启用' : '选项已停用')
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '更新选项状态失败'))
    await load()
  }
}

async function removeGroup(group: AdminSpecGroup) {
  try {
    await ElMessageBox.confirm(
      `删除规格组「${group.name}」后不可恢复；被商品使用时不能删除。`,
      '删除规格组',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  try {
    await deleteSpecGroup(group.id)
    ElMessage.success('规格组已删除')
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '删除规格组失败'))
  }
}

async function removeOption(option: AdminSpecOption) {
  try {
    await ElMessageBox.confirm(`删除选项「${option.name}」？`, '删除选项', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await deleteSpecOption(option.id)
    ElMessage.success('选项已删除')
    await load()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '删除选项失败'))
  }
}

onMounted(load)
</script>

<template>
  <el-card shadow="never" class="page-card">
    <template #header>
      <div class="page-card-header">
        <div>
          <h2>规格管理</h2>
          <p class="muted">
            规格组挂在商品上，例如杯型、温度、糖度；每个商品可勾选多个规格组。
          </p>
        </div>
        <el-button type="primary" @click="openCreateGroup">新建规格组</el-button>
      </div>
    </template>

    <div v-loading="loading" class="spec-list">
      <el-empty v-if="!groups.length && !loading" description="还没有规格组" />

      <el-card v-for="group in groups" :key="group.id" shadow="never" class="spec-card">
        <template #header>
          <div class="spec-header">
            <div class="spec-title">
              <strong>{{ group.name }}</strong>
              <el-tag v-if="group.required" size="small" type="warning" effect="plain">
                必选
              </el-tag>
              <el-tag v-else size="small" type="info" effect="plain">可选</el-tag>
              <el-tag v-if="group.multiSelect" size="small" effect="plain">
                多选 {{ group.minSelect }}–{{ group.maxSelect }}
              </el-tag>
              <span class="muted">被 {{ group.productCount }} 个商品使用</span>
            </div>
            <div>
              <el-button link type="primary" @click="openEditGroup(group)">编辑</el-button>
              <el-button link type="primary" @click="openCreateOption(group)">新增选项</el-button>
              <el-button link type="danger" @click="removeGroup(group)">删除</el-button>
            </div>
          </div>
        </template>

        <el-table :data="group.options" size="small" row-key="id">
          <el-table-column prop="name" label="选项" min-width="160" />
          <el-table-column label="加价" width="110">
            <template #default="{ row }">{{ formatDelta(row.priceDeltaCents) }}</template>
          </el-table-column>
          <el-table-column label="默认" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.isDefault" size="small" type="success" effect="plain">
                默认
              </el-tag>
              <el-button v-else link type="primary" @click="setDefault(asOption(row))">
                设为默认
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="可用" width="90">
            <template #default="{ row }">
              <el-switch
                :model-value="row.isAvailable"
                size="small"
                @change="
                  (value: string | number | boolean) =>
                    toggleAvailable(asOption(row), value === true)
                "
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditOption(group, asOption(row))">
                编辑
              </el-button>
              <el-button link type="danger" @click="removeOption(asOption(row))">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <span class="muted">还没有选项，请先新增一个</span>
          </template>
        </el-table>
      </el-card>
    </div>

    <el-dialog
      v-model="groupDialog"
      :title="editingGroupId ? '编辑规格组' : '新建规格组'"
      width="520px"
      @closed="resetGroupForm"
    >
      <el-form ref="groupFormRef" :model="groupForm" :rules="groupRules" label-width="92px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="groupForm.name" maxlength="30" show-word-limit />
        </el-form-item>
        <el-form-item label="必选">
          <el-switch v-model="groupForm.required" />
        </el-form-item>
        <el-form-item label="多选">
          <el-switch v-model="groupForm.multiSelect" @change="onMultiSelectChange" />
        </el-form-item>
        <el-form-item v-if="groupForm.multiSelect" label="选择数量">
          <div class="select-range">
            <el-input-number
              v-model="groupForm.minSelect"
              :min="1"
              :max="groupForm.maxSelect"
              controls-position="right"
            />
            <span>至</span>
            <el-input-number
              v-model="groupForm.maxSelect"
              :min="groupForm.minSelect"
              :max="10"
              controls-position="right"
            />
          </div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="groupForm.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="groupDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveGroup">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="optionDialog"
      :title="editingOptionId ? '编辑选项' : '新增选项'"
      width="480px"
      @closed="resetOptionForm"
    >
      <el-form ref="optionFormRef" :model="optionForm" :rules="optionRules" label-width="92px">
        <el-form-item label="选项名称" prop="name">
          <el-input v-model="optionForm.name" maxlength="30" show-word-limit />
        </el-form-item>
        <el-form-item label="加价（元）">
          <el-input-number
            v-model="optionForm.priceDeltaYuan"
            :min="0"
            :max="999"
            :precision="2"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="默认">
          <el-switch v-model="optionForm.isDefault" />
        </el-form-item>
        <el-form-item label="可用">
          <el-switch v-model="optionForm.isAvailable" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="optionForm.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="optionDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveOption">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.spec-list {
  display: grid;
  gap: 16px;
}

.spec-card {
  border-radius: 10px;
}

.spec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.spec-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.spec-title .muted {
  font-size: 12px;
}

.select-range {
  display: flex;
  align-items: center;
  gap: 10px;
}

.select-range .el-input-number {
  width: 120px;
}
</style>
