<!--
 * @Author: ShawnPhang
 * @Date: 2021-08-03 17:50:21
 * @Description: Legacy size control kept only for compatibility. Moveable handles resizing now.
 * @LastEditors: ShawnPhang
 * @LastEditTime: 2021-08-09 11:13:09
-->

<template>
  <div v-if="dActiveElement.record && dActiveElement.uuid !== '-1'" id="size-control">
    <div
      v-if="dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + 'px',
        top: top + 'px',
        cursor: 'nw-resize',
      }"
      @mousedown="handlemousedown($event, 'left-top')"
    ></div>
    <div
      v-if="dActiveElement.record.dir === 'vertical' || dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + width / 2 + 'px',
        top: top + 'px',
        cursor: 'n-resize',
      }"
      @mousedown="handlemousedown($event, 'top')"
    ></div>
    <div
      v-if="dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + width + 'px',
        top: top + 'px',
        cursor: 'ne-resize',
      }"
      @mousedown="handlemousedown($event, 'right-top')"
    ></div>
    <div
      v-if="dActiveElement.record.dir === 'horizontal' || dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + 'px',
        top: top + height / 2 + 'px',
        cursor: 'w-resize',
      }"
      @mousedown="handlemousedown($event, 'left')"
    ></div>
    <div
      v-if="dActiveElement.record.dir === 'horizontal' || dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + width + 'px',
        top: top + height / 2 + 'px',
        cursor: 'e-resize',
      }"
      @mousedown="handlemousedown($event, 'right')"
    ></div>
    <div
      v-if="dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + 'px',
        top: top + height + 'px',
        cursor: 'sw-resize',
      }"
      @mousedown="handlemousedown($event, 'left-bottom')"
    ></div>
    <div
      v-if="dActiveElement.record.dir === 'vertical' || dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + width / 2 + 'px',
        top: top + height + 'px',
        cursor: 's-resize',
      }"
      @mousedown="handlemousedown($event, 'bottom')"
    ></div>
    <div
      v-if="dActiveElement.record.dir === 'all'"
      class="square"
      :style="{
        left: left + width + 'px',
        top: top + height + 'px',
        cursor: 'se-resize',
      }"
      @mousedown="handlemousedown($event, 'right-bottom')"
    ></div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'LegacySizeControl',
}
</script>

<style lang="less" scoped>
/*
#size-control {
  position: absolute;
  .square {
    background-color: #ffffff;
    height: 10px;
    outline: 1px solid #3b74f1;
    position: absolute;
    transform: translateX(-50%) translateY(-50%);
    width: 10px;
    z-index: 999;
  }
}
*/
</style>
