<template>
  <div id="widget-panel">
    <div class="widget-classify">
      <div class="brand-block">
        <img :src="brandLogo" :alt="ui.brand" class="brand-block__logo" />
        <span class="brand-block__text">{{ ui.brand }}</span>
      </div>

      <ul class="classify-wrap">
        <li
          v-for="(item, index) in state.widgetClassifyList"
          :key="index"
          :class="['classify-item', { 'active-classify-item': state.activeWidgetClassify === index }]"
          @click="clickClassify(index)"
        >
          <div class="icon-box">
            <svg
              v-if="item.iconType === 'custom-home'"
              class="custom-nav-icon custom-nav-icon--home"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect x="4.25" y="4.25" width="15.5" height="15.5" rx="4.25" />
              <path d="M8.2 10.85 12 7.65l3.8 3.2" />
              <path d="M9.4 10.15v5.35h5.2v-5.35" />
            </svg>
            <i v-else :class="['iconfont', 'icon', item.icon]" :style="item.style" />
          </div>
          <p>{{ item.name }}</p>
        </li>
      </ul>

      <div class="utility-wrap">
        <button type="button" class="utility-item" @click="showLanguageTip">
          <span class="utility-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M3 12h18"></path>
              <path d="M12 3a13.5 13.5 0 0 1 0 18"></path>
              <path d="M12 3a13.5 13.5 0 0 0 0 18"></path>
            </svg>
          </span>
          <span class="utility-text">{{ ui.language }}</span>
        </button>

        <button type="button" class="utility-item" @click="goAccount">
          <span class="utility-icon">
            <img v-if="accountAvatarUrl" :src="accountAvatarUrl" :alt="accountLabel" class="utility-avatar" />
            <span v-else-if="accountAvatarFallback" class="utility-avatar utility-avatar--fallback">{{ accountAvatarFallback }}</span>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5"></circle>
              <path d="M5 20a7 7 0 0 1 14 0"></path>
            </svg>
          </span>
          <span v-if="!userStore.online" class="utility-text">{{ accountLabel }}</span>
        </button>
      </div>
    </div>

    <div v-show="showMaterialPanel" class="widget-wrap">
      <div class="panel-mode-tabs">
        <span :class="['mode-tab', { 'active-mode-tab': state.panelMode === 'material' }]" @click="setPanelMode('material')">
          {{ materialTabLabel }}
        </span>
        <span :class="['mode-tab', { 'active-mode-tab': state.panelMode === 'setting' }]" @click="setPanelMode('setting')">{{ ui.setting }}</span>
      </div>

      <div v-show="state.panelMode === 'material'" class="panel-mode-content">
        <keep-alive>
          <component :is="state.widgetClassifyList[state.activeWidgetClassify]?.component" />
        </keep-alive>
      </div>

      <div v-show="state.panelMode === 'setting'" class="panel-mode-content">
        <style-panel combined />
      </div>
    </div>

    <div v-show="showMaterialPanel" class="side-wrap">
      <el-tooltip :show-after="300" :hide-after="0" effect="dark" :content="ui.collapse" placement="right">
        <div class="pack__up" @click="state.active = false"></div>
      </el-tooltip>
    </div>
  </div>
</template>

<script lang="ts" setup>
import widgetClassifyListData from '@/assets/data/WidgetClassifyList'
import brandLogo from '@/assets/branding/design.png'
import { computed, nextTick, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useControlStore, useUserStore, useWidgetStore } from '@/store'

const route = useRoute()
const router = useRouter()
const widgetStore = useWidgetStore()
const controlStore = useControlStore()
const userStore = useUserStore()
const { dActiveElement } = storeToRefs(widgetStore)
const { leftPanelMode } = storeToRefs(controlStore)

const sectionToIndex: Record<string, number> = {
  welcome: 0,
  'ai-poster': 1,
  template: 2,
  material: 3,
  text: 4,
  photo: 5,
  toolbox: 6,
  mine: 7,
}

const indexToSection = ['welcome', 'ai-poster', 'template', 'material', 'text', 'photo', 'toolbox', 'mine']

const ui = {
  brand: '\u9cb2\u7a79\u6d77\u62a5',
  language: '\u7b80\u4f53\u4e2d\u6587',
  login: '\u767b\u5f55',
  mine: '\u6211\u7684',
  material: '\u7d20\u6750',
  setting: '\u8bbe\u7f6e',
  collapse: '\u5173\u95ed\u4fa7\u8fb9\u680f',
  languageTip: '\u5f53\u524d\u754c\u9762\u5df2\u4f7f\u7528\u7b80\u4f53\u4e2d\u6587',
} as const

const state = reactive({
  widgetClassifyList: widgetClassifyListData,
  activeWidgetClassify: 0,
  active: false,
  panelMode: 'material' as 'material' | 'setting',
})

const currentSection = computed(() => String(route.query.section || 'welcome'))
const showMaterialPanel = computed(() => currentSection.value !== 'welcome' && state.active)
const materialTabLabel = computed(() => state.widgetClassifyList[state.activeWidgetClassify]?.name || ui.material)
const accountLabel = computed(() => ui.login)
const accountAvatarUrl = computed(() => String(userStore.user?.avatar || '').trim())
const accountAvatarFallback = computed(() => {
  if (!userStore.online) return ''
  const name = String(userStore.user?.name || '').trim()
  return name ? name.slice(0, 1).toUpperCase() : '\u6211'
})

function normalizeSection(section: string) {
  return sectionToIndex[section] !== undefined ? section : 'welcome'
}

function applySection(section: string) {
  const normalized = normalizeSection(section)
  state.activeWidgetClassify = sectionToIndex[normalized]
  state.active = normalized !== 'welcome'
  state.panelMode = 'material'
  controlStore.setLeftPanelMode('material')
}

function setPanelMode(mode: 'material' | 'setting') {
  state.panelMode = mode
  controlStore.setLeftPanelMode(mode)
}

function clickClassify(index: number) {
  const section = indexToSection[index] || 'welcome'
  if (section === 'welcome') {
    void router.replace({
      path: '/home',
      query: {
        section: 'welcome',
      },
    })
    applySection(section)
    return
  }
  const nextQuery = { ...route.query, section } as Record<string, string>
  if (section !== 'ai-poster') {
    delete nextQuery.aiAutoGenerate
  }
  void router.replace({ path: '/home', query: nextQuery })
  applySection(section)
}

function showLanguageTip() {
  ElMessage.info(ui.languageTip)
}

function goAccount() {
  void router.push(userStore.online ? '/account' : '/login')
}

onMounted(async () => {
  await nextTick()
  if (route.query.koutu) {
    void router.replace({ path: '/home', query: { ...route.query, section: 'photo' } })
    applySection('photo')
    return
  }
  applySection(String(route.query.section || 'welcome'))
})

watch(
  () => route.query.section,
  (section) => {
    applySection(String(section || 'welcome'))
  },
)

watch(
  () => state.activeWidgetClassify,
  (index) => {
    if (index >= 0 && index < state.widgetClassifyList.length) {
      state.widgetClassifyList[index].show = true
    }
  },
)

watch(
  () => dActiveElement.value?.uuid,
  (uuid) => {
    if (currentSection.value === 'welcome') return
    if (!uuid || uuid === '-1') return
    state.panelMode = 'setting'
    state.active = true
    controlStore.setLeftPanelMode('setting')
  },
)

watch(
  () => leftPanelMode.value,
  (mode) => {
    if (mode !== state.panelMode) {
      state.panelMode = mode
    }
  },
)

defineExpose({
  clickClassify,
})
</script>

<style lang="less" scoped>
@color1: #3e4651;

#widget-panel {
  transition: all 0.3s ease;
  color: @color1;
  display: flex;
  flex-direction: row;
  font-weight: 600;
  height: 100%;
  min-height: 0;
  position: relative;

  .widget-classify {
    position: relative;
    border-right: 1px solid rgba(15, 23, 42, 0.08);
    background: linear-gradient(180deg, #f6f9fd 0%, #fbfcfe 100%);
    height: 100%;
    text-align: center;
    width: 104px;
    box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.88);
    display: flex;
    flex-direction: column;
    align-items: center;

    .brand-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 14px 0 12px;
    }

    .brand-block__logo {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      object-fit: contain;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
    }

    .brand-block__text {
      max-width: 84px;
      font-size: 13px;
      line-height: 1.25;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: #475569;
      text-align: center;
    }

    .icon {
      font-size: 21px;
      color: #334155;
    }

    .classify-wrap {
      padding-top: 12px;
      user-select: none;
      width: 100%;
      flex: 1;

      .classify-item {
        position: relative;
        align-items: center;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        font-size: 10px;
        font-weight: 500;
        min-height: 70px;
        justify-content: center;
        width: calc(100% - 14px);
        margin: 0 auto 8px;
        border-radius: 16px;
        transition: background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;

        p {
          color: #6b7280;
          font-weight: 600;
          margin-top: 6px;
          line-height: 1.15;
          transform: none;
        }

        .icon-box {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.76);
          box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.85);
        }

        .icon {
          color: #64748b;
        }

        .custom-nav-icon {
          width: 22px;
          height: 22px;
          stroke: #64748b;
          fill: none;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: stroke 0.18s ease;
        }
      }

      .classify-item:hover {
        background: rgba(255, 255, 255, 0.82);
        transform: translateY(-1px);
      }

      .classify-item:hover .icon-box {
        background: rgba(248, 250, 252, 0.98);
      }

      .active-classify-item {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 255, 0.98));
        box-shadow: 0 10px 22px rgba(59, 130, 246, 0.1);
      }

      .active-classify-item .icon,
      .active-classify-item .custom-nav-icon,
      .active-classify-item p {
        color: #2563eb;
        stroke: #2563eb;
      }

      .active-classify-item::after,
      .classify-item:hover::after {
        position: absolute;
        content: '';
        left: 3px;
        top: 16px;
        width: 3px;
        height: 36px;
        border-radius: 999px;
        background: #2563eb;
      }
    }

    .utility-wrap {
      width: 100%;
      padding: 12px 0 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-top: 1px solid rgba(148, 163, 184, 0.14);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.54) 100%);
    }

    .utility-item {
      width: calc(100% - 16px);
      margin: 0 auto;
      padding: 9px 4px;
      border: none;
      border-radius: 14px;
      background: transparent;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      transition: background-color 0.18s ease, color 0.18s ease;
    }

    .utility-item:hover {
      background: rgba(255, 255, 255, 0.82);
      color: #2563eb;
    }

    .utility-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
    }

    .utility-icon svg {
      width: 19px;
      height: 19px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .utility-avatar {
      width: 36px;
      height: 36px;
      border-radius: 999px;
      object-fit: cover;
      box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.2);
      background: #ffffff;
    }

    .utility-avatar--fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #2563eb;
      font-size: 12px;
      font-weight: 700;
      background: linear-gradient(180deg, #ffffff, #eff6ff);
    }

    .utility-text {
      font-size: 10px;
      line-height: 1.15;
      font-weight: 600;
      text-align: center;
      transform: none;
    }
  }

  .widget-wrap {
    width: 328px;
    transition: all 0.3s;
    background: linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%);
    flex: 1;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .panel-mode-tabs {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px 8px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 255, 255, 0.92);

      .mode-tab {
        user-select: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        border-radius: 10px;
        padding: 8px 14px;
        transition: all 0.18s ease;
      }

      .mode-tab:hover {
        background: rgba(59, 130, 246, 0.08);
      }

      .active-mode-tab {
        color: #1e3a8a;
        background: linear-gradient(180deg, rgba(37, 99, 235, 0.12), rgba(59, 130, 246, 0.08));
        box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
      }
    }

    .panel-mode-content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
  }

  .side-wrap {
    position: absolute;
    left: 401px;
    pointer-events: none;
    z-index: 99;
    width: 15px;
    height: 100%;
    display: flex;
    align-items: center;

    .pack__up {
      pointer-events: all;
      border-radius: 0 100% 100% 0;
      cursor: pointer;
      width: 20px;
      height: 64px;
      background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAACACAMAAABOb9vcAAAAhFBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAADHx8cODg50dHTx8fF2dnZ1dXWWlpZHR0c4ODhQpkZ5AAAAIXRSTlMA9t+/upkRAnPq5NXDfDEsKQjMeGlRThkMsquljTwzIWhBHpjgAAABJElEQVRYw+3YyW7CQBCEYbxig8ELGJyQkJRJyPb+75dj3zy/lD7kMH3+ZEuzSFO1mlZwhjOE2uwhVHJYMygNVwilhz2EUvNaMigledUFoE1anKYAtA9nVRuANpviOQBt0t2ZQSnZ9QxK6Qih9LSGUHkJobYlhGp6CPW4hlAVhckLhMop1InCjEK1FBYU1hSqo/BI4YXCjMIthTWFijDCCB3g7fuO4O1t/rkvQXPz/LUIzX0oAM0tQHOfCkBzC9DcuwLQXACao9Dv1yb9lsek2xaaxMcMH1x6Ff79dY0wwgj/DGv3p2tG4cX9wd55h4rCO/hk3uEs9w6QlXPIbXrfIJ6XrmVBOtJCA1YkXqVLkh1aUgyNk1fV1BxLxzpsuNLKzrME/AWr0ywwvyj83AAAAABJRU5ErkJggg==);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: 50%;
      filter: drop-shadow(5px 0px 4px rgba(0, 0, 0, 0.03));
    }

    .pack__up:hover {
      color: rgba(0, 0, 0, 0.9);
      opacity: 0.9;
    }
  }
}
</style>
