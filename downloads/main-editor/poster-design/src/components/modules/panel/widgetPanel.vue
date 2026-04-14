<template>
  <div id="widget-panel">
    <div class="widget-classify">
      <ul class="classify-wrap">
        <li v-for="(item, index) in state.widgetClassifyList" :key="index" :class="['classify-item', { 'active-classify-item': state.activeWidgetClassify === index && state.active }]" @click="clickClassify(index)">
          <div class="icon-box"><i :class="['iconfont', 'icon', item.icon]" :style="item.style" /></div>
          <p>{{ item.name }}</p>
        </li>
      </ul>
    </div>
    <div v-show="state.active" class="widget-wrap">
      <keep-alive>
        <component :is="state.widgetClassifyList[state.activeWidgetClassify].component" />
      </keep-alive>
    </div>
    <div v-show="state.active" class="side-wrap">
      <el-tooltip :show-after="300" :hide-after="0" effect="dark" content="关闭侧边栏" placement="right">
        <div class="pack__up" @click="state.active = false"></div>
      </el-tooltip>
    </div>
  </div>
</template>

<script lang="ts" setup>
// 缁勪欢闈㈡澘
import widgetClassifyListData from '@/assets/data/WidgetClassifyList'
import { reactive, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const state = reactive({
  widgetClassifyList: widgetClassifyListData,
  activeWidgetClassify: 0,
  active: true,
})

const clickClassify = (index: number) => {
  state.activeWidgetClassify = index
  state.active = true
}

onMounted(async () => {
  await nextTick()
  const { koutu } = route.query
  koutu && (state.activeWidgetClassify = 4)
})

watch(
  () => state.activeWidgetClassify,
  (index) => {
    if (index >= 0 && index < state.widgetClassifyList.length) {
      state.widgetClassifyList[index].show = true
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
  transition: all .3s ease;
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
    background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
    height: 100%;
    text-align: center;
    width: 72px;
    box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.85);

    .icon {
      font-size: 24px;
      color: #334155;
    }

    .classify-wrap {
      padding-top: 10px;
      user-select: none;
      width: 100%;

      .classify-item {
        position: relative;
        align-items: center;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        font-size: 12px;
        font-weight: 500;
        height: 74px;
        justify-content: center;
        width: calc(100% - 10px);
        margin: 0 auto 8px;
        border-radius: 16px;
        transition: background-color .18s ease, transform .18s ease, box-shadow .18s ease;

        p {
          color: #64748b;
          font-weight: 600;
          margin-top: 4px;
        }

        .icon-box {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(241, 245, 249, 0.95);
        }

        .icon {
          color: #334155;
        }
      }

      .classify-item:hover {
        background: rgba(59, 130, 246, 0.08);
        transform: translateY(-1px);
      }

      .classify-item:hover .icon-box {
        background: rgba(219, 234, 254, 0.95);
      }

      .active-classify-item {
        position: relative;
        background: linear-gradient(180deg, rgba(37, 99, 235, 0.12), rgba(59, 130, 246, 0.08));
        box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);

        .icon,
        p {
          color: #2563eb;
        }

        .icon-box {
          background: rgba(219, 234, 254, 0.98);
        }
      }

      .active-classify-item::after,
      .classify-item:hover::after {
        position: absolute;
        content: '';
        left: 6px;
        top: 18px;
        width: 4px;
        height: 38px;
        border-radius: 999px;
        background: @active-text-color;
      }
    }
  }

  .widget-wrap {
    width: 328px;
    transition: all .3s;
    background: linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%);
    flex: 1;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .side-wrap {
    position: absolute;
    left: 394px;
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

