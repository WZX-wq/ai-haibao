<template>
  <div id="style-panel" :class="{ 'is-combined': combined }">
    <div class="style-tab">
      <span :class="['tab', { 'active-tab': activeTab === 0 }]" @click="activeTab = 0">设置</span>
      <span :class="['tab', { 'active-tab': activeTab === 1 }]" @click="activeTab = 1">图层</span>
    </div>
    <div v-show="activeTab === 0" class="style-wrap">
      <div v-show="showGroupCombined" style="padding: 2rem 0">
        <el-button plain type="primary" class="gounp__btn" @click="handleCombine">成组</el-button>
        <icon-item-select label="" :data="iconList" @finish="alignAction" />
      </div>
      <component :is="dActiveElement?.type + '-style'" v-show="!showGroupCombined" v-if="dActiveElement?.type" />
    </div>
    <div v-show="activeTab === 1" class="layer-wrap">
      <layer-list :data="dWidgets" @change="layerChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 样式设置面板
import alignIconList, { AlignListData } from '@/assets/data/AlignListData'
import iconItemSelect, { TIconItemSelectData } from '../settings/iconItemSelect.vue'
import { ref, watch } from 'vue'
import { useControlStore, useGroupStore, useHistoryStore, useWidgetStore } from '@/store'
import { storeToRefs } from 'pinia'
import { TdWidgetData } from '@/store/design/widget'
import type { TUpdateAlignData } from '@/store/design/widget/actions/align'

const { combined } = withDefaults(defineProps<{ combined?: boolean }>(), {
  combined: false,
})

const widgetStore = useWidgetStore()
const controlStore = useControlStore()
const groupStore = useGroupStore()
const historyStore = useHistoryStore()

const activeTab = ref(0)
const iconList = ref<AlignListData[]>(alignIconList)
const showGroupCombined = ref(false)

const { dActiveElement, dWidgets, dSelectWidgets } = storeToRefs(widgetStore)

watch(
  dSelectWidgets,
  (items) => {
    setTimeout(() => {
      showGroupCombined.value = items.length > 1
    }, 100)
  },
  {
    deep: true,
  },
)

watch(
  () => dActiveElement.value?.uuid,
  () => {
    // 选中画布元素（文字/图片/二维码等）时，优先展示对应“设置”面板
    activeTab.value = 0
  },
)

function handleCombine() {
  groupStore.realCombined()
}

function alignAction(item: TIconItemSelectData) {
  const sWidgets: TdWidgetData[] = JSON.parse(JSON.stringify(dSelectWidgets.value))
  groupStore.getCombined().then((group) => {
    sWidgets.forEach((element) => {
      widgetStore.updateAlign({
        align: item.value as TUpdateAlignData['align'],
        uuid: element.uuid,
        group,
      })
    })
  })
}

function layerChange(newLayer: TdWidgetData[]) {
  widgetStore.setDWidgets(newLayer.toReversed())
  controlStore.setShowMoveable(false)
}
</script>

<style lang="less" scoped>
@color0: #ffffff;
@color1: #999999;
@background-color-transparent: rgba(0, 0, 0, .08);

#style-panel ::-webkit-scrollbar {
  display: none;
}

#style-panel {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbfe 100%);
  border-left: 1px solid @background-color-transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  width: 400px;

  .style-tab {
    box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
    display: flex;
    flex-direction: row;
    text-align: center;
    width: 100%;
    z-index: 10;
    padding: 8px;
    background: rgba(255, 255, 255, 0.9);

    .tab {
      user-select: none;
      font-size: 14px;
      color: #64748b;
      cursor: pointer;
      flex: 1;
      padding: 12px 10px;
      border-radius: 12px;
      transition: all .18s ease;
    }

    .tab.active-tab {
      background: linear-gradient(180deg, rgba(37, 99, 235, 0.12), rgba(59, 130, 246, 0.08));
      font-size: 15px;
      color: #1e3a8a;
      font-weight: 600;
      box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
    }
  }

  .style-wrap {
    flex: 1;
    overflow: auto;
    width: 100%;
    padding: 10px 18px 22px;
  }

  .layer-wrap {
    flex: 1;
    overflow: auto;
    width: 100%;
  }
}

#style-panel.is-combined {
  width: 100%;
  border-left: none;
}

.gounp {
  &__btn {
    width: 100%;
    margin-bottom: 2.7rem;
  }
}
</style>
