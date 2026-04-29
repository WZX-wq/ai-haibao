<template>
  <div class="search__wrap">
    <el-dropdown ref="dropdownRef" v-if="type !== 'none'" placement="bottom-start" @visible-change="handleDropdownVisibleChange">
      <div ref="triggerRef" class="search__type" @click="ensureCategoriesLoaded">
        <i class="iconfont icon-ego-caidan" />
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item in state.materialCates"
            :key="item.id"
            @click="action('change', item, item.id)"
          >
            <span :class="['cate__text', { 'cate--select': +state.currentIndex === +item.id }]">{{ item.name }}</span>
          </el-dropdown-item>
          <el-dropdown-item divided @click="reloadCategories">
            <span class="cate__reload">重新加载分类</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <span v-else style="width: 1rem"></span>

    <el-input
      v-model="state.searchValue"
      size="large"
      placeholder="搜索关键词"
      class="input-with-select"
    >
      <template #append>
        <el-button><i class="iconfont icon-search"></i></el-button>
      </template>
    </el-input>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { useRoute } from 'vue-router'
import api from '@/api'
import useNotification from '@/common/methods/notification'

type TProps = {
  type?: string
  modelValue?: string
}

type TMaterialCatesData = { id: string | number; name: string }

type TEmits = {
  (event: 'update:modelValue', data: string): void
  (event: 'change', data: TMaterialCatesData): void
}

type TState = {
  searchValue: string
  materialCates: TMaterialCatesData[]
  currentIndex: number | string
  loading: boolean
}

const props = defineProps<TProps>()
const emit = defineEmits<TEmits>()
const route = useRoute()
const dropdownRef = ref()
const triggerRef = ref<HTMLElement | null>(null)

const state = reactive<TState>({
  searchValue: '',
  materialCates: [],
  currentIndex: 0,
  loading: false,
})

let retryTimer: ReturnType<typeof setTimeout> | null = null
let categoryLoadNotified = false
let requestSeq = 0

function handleDropdownVisibleChange(visible: boolean) {
  if (visible || typeof document === 'undefined') return
  nextTick(() => {
    const active = document.activeElement as HTMLElement | null
    const triggerEl = triggerRef.value
    if (triggerEl && active && !triggerEl.contains(active)) {
      triggerEl.focus?.()
      return
    }
    if (!active) {
      triggerEl?.focus?.()
      return
    }
    const insideDropdown = active.closest('.el-dropdown-menu, .el-popper, .el-dropdown__popper')
    if (insideDropdown) {
      triggerEl?.focus?.()
    }
  })
}

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function applyInitialRouteCate() {
  const cate = route.query.cate
  if (typeof cate === 'undefined') return
  state.currentIndex = cate as string
  const current = state.materialCates.find((item) => String(item.id) === String(cate))
  if (current) {
    action('change', current, current.id)
  }
}

async function loadCategories(allowRetry = true, attempt = 0, showErrorToast = false) {
  if (props.type === 'none') return
  if (state.loading) return
  state.loading = true
  const seq = ++requestSeq
  try {
    const list = await api.home.getCategories({ type: 1 }) as any
    if (!Array.isArray(list)) {
      throw new Error('invalid category payload')
    }
    if (seq !== requestSeq) return
    state.materialCates = [{ id: 0, name: '全部' }].concat(list)
    categoryLoadNotified = false
    applyInitialRouteCate()
  } catch {
    if (seq !== requestSeq) return
    state.materialCates = [{ id: 0, name: '全部' }]
    if (allowRetry && attempt < 6) {
      clearRetryTimer()
      const delay = 500 * (attempt + 1)
      retryTimer = setTimeout(() => {
        loadCategories(true, attempt + 1, false)
      }, delay)
      return
    }
    if (showErrorToast && !categoryLoadNotified) {
      categoryLoadNotified = true
      useNotification(
        '分类暂不可用',
        '分类列表加载失败，可在菜单中点击「重新加载分类」后重试。',
        { type: 'warning' },
      )
    }
  } finally {
    if (seq === requestSeq) {
      state.loading = false
    }
  }
}

function ensureCategoriesLoaded() {
  if (!state.materialCates.length && !state.loading) {
    loadCategories(true, 0, false)
  }
}

function reloadCategories() {
  clearRetryTimer()
  loadCategories(false, 0, true)
}

watch(
  () => state.searchValue,
  () => emit('update:modelValue', state.searchValue),
)

watch(
  () => route.query.cate,
  () => {
    if (!state.materialCates.length) return
    const raw = route.query.cate
    if (typeof raw === 'undefined') return
    const cateVal = Array.isArray(raw) ? raw[0] : raw
    if (cateVal === undefined || cateVal === null || cateVal === '') return
    state.currentIndex = cateVal as string
    const current = state.materialCates.find((item) => String(item.id) === String(cateVal))
    if (current) {
      action('change', current, current.id)
    }
  },
)

function action(fn: 'change', type: TMaterialCatesData, currentIndex: number | string) {
  state.currentIndex = currentIndex
  emit(fn, type)
}

if (props.type !== 'none') {
  loadCategories(true, 0, false)
}

onBeforeUnmount(() => {
  clearRetryTimer()
})

defineExpose({
  action,
  reloadCategories,
})
</script>

<style lang="less" scoped>
:deep(.el-input__suffix) {
  padding-top: 9px;
}

.search__wrap {
  padding: 16px 1rem 0 0;
  display: flex;
  cursor: pointer;
}

.search {
  &__type {
    border: 1px solid #e8eaec;
    color: #666666;
    width: 44px;
    margin: 0 0.6rem 0 1rem;
    border-radius: 4px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 14px;

    .iconfont {
      font-size: 20px;
    }
  }

  &__type:hover {
    color: @active-text-color;
  }
}

.cate {
  &__text {
    font-weight: bold;
  }

  &--select {
    color: @main-color;
  }

  &__reload {
    color: #2563eb;
    font-weight: 600;
  }
}
</style>
