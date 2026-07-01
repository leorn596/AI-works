/**
 * eventBus.js — 简单 pub/sub 事件总线
 * 用法：
 *   import { emit, on, off } from '../utils/eventBus'
 *   on('chart:filter', handler)
 *   emit('chart:filter', { type: 'SQLi', value: 'SQLi' })
 *   off('chart:filter', handler)
 */

const listeners = {}

/**
 * 订阅事件
 * @param {string} event - 事件名称
 * @param {Function} callback - 回调函数
 */
export function on(event, callback) {
  if (!listeners[event]) {
    listeners[event] = []
  }
  listeners[event].push(callback)
}

/**
 * 取消订阅
 * @param {string} event - 事件名称
 * @param {Function} callback - 要移除的回调函数
 */
export function off(event, callback) {
  if (!listeners[event]) return
  listeners[event] = listeners[event].filter((cb) => cb !== callback)
}

/**
 * 触发事件
 * @param {string} event - 事件名称
 * @param {*} data - 传递给回调的数据
 */
export function emit(event, data) {
  if (!listeners[event]) return
  for (const callback of listeners[event]) {
    try {
      callback(data)
    } catch (err) {
      console.error(`[eventBus] Error in listener for "${event}":`, err)
    }
  }
}

export default { on, off, emit }
