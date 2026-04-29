<!--
 * @Author: ShawnPhang
 * @Date: 2023-10-04 02:04:04
 * @Description: 列表分类头部
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @Date: 2024-03-06 21:16:00
-->
<template>
  <div v-if="!isBack" class="content__wrap">
    <div v-for="(t, ti) in types" :key="ti + 't'">
      <div class="types__header" @click="select(t)">
        <span style="flex: 1">{{ t.name }}</span>
        <span class="types__header-more">全部<i class="iconfont icon-right"></i></span>
      </div>
      <slot :index="ti" />
    </div>
  </div>
  <span v-else class="types__header-back" @click="back">
    <i class="iconfont icon-right"></i>
    <slot />
  </span>
</template>

<script lang="ts" setup>
export type TClassHeaderTypeData = {
  name: string
}

type TProps = {
  types?: TClassHeaderTypeData[]
  isBack?: boolean
}

type TEmits = {
  (event: 'select', data: string[]): void
  (event: 'back'): void
}

const { types, isBack } = defineProps<TProps>()
const emit = defineEmits<TEmits>()

const select = (item: any) => {
  emit('select', item)
}
const back = () => {
  emit('back')
}

defineExpose({ select, back })
</script>

<style lang="less" scoped>
.content {
  &__wrap {
    padding: 0.85rem 1rem 6rem;
    height: 100%;
    overflow: auto;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE 10+ */
  }
  &__wrap::-webkit-scrollbar {
    display: none; /* Chrome Safari */
  }
}
.types {
  display: flex;
  flex-wrap: wrap;
  padding: 10px 0 0 6px;
  &__item {
    position: relative;
    width: 64px;
    // height: 44px;
    height: 64px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #fff;
    font-weight: 600;
    font-size: 13px;
    border-radius: 4px;
    cursor: pointer;
    margin: 8px 4px 0 4px;
    background-size: cover;
    background-repeat: no-repeat;
    text-shadow: 0 1px 0 rgb(0 0 0 / 25%);
    opacity: 0.5;
  }
  &--select {
    opacity: 1;
  }
  &__header {
    user-select: none;
    cursor: pointer;
    margin-bottom: 14px;
    padding: 0.95rem 1rem;
    font-size: 13px;
    color: #1e293b;
    display: flex;
    align-items: center;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 249, 252, 0.9));
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }
  &__header:hover {
    transform: translateY(-1px);
    border-color: rgba(240, 113, 54, 0.32);
    box-shadow: 0 14px 30px rgba(240, 113, 54, 0.12);
  }
  &__header .icon-right {
    font-size: 12px;
    margin-left: 6px;
  }
  &__header > span:first-child {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  &__header {
    &-more {
      display: flex;
      align-items: center;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
    }
    &-back {
      cursor: pointer;
      padding: 0 1rem;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1e293b;
      font-size: 15px;
      font-weight: 700;
      height: 3.25rem;
      position: absolute;
      z-index: 2;
      top: 0;
      left: 0;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 252, 0.94));
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      width: 440px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      .icon-right {
        transform: rotate(180deg);
        font-size: 12px;
      }
    }
  }
}
</style>
