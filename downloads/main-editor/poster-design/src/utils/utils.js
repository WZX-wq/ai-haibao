import app_config from '@/config';
export const config = app_config;
// 判断是否在数组中并返回下标
export const isInArray = (arr, value) => {
    const index = arr.indexOf(value);
    if (index >= 0) {
        return index;
    }
    return false;
};
/** 删除多个对象元素 */
export const deleteSome = (obj, arr) => {
    arr.forEach((key) => {
        delete obj[key];
    });
    return obj;
};
/** 拾取对象元素 */
export const pickSome = (obj, arr) => {
    const newObj = {};
    arr.forEach((key) => {
        newObj[key] = obj[key];
    });
    return newObj;
};
/** 随机数 */
export const rndNum = (n, m) => {
    const random = Math.floor(Math.random() * (m - n + 1) + n);
    return random;
};
/** 计算差值 */
export const findClosestNumber = (target, numbers) => {
    if (!Array.isArray(numbers) || numbers.length === 0) {
        throw new Error('数组不能为空');
    }
    let closestNumber = numbers[0];
    let minDifference = Math.abs(target - closestNumber);
    for (let i = 1; i < numbers.length; i++) {
        const currentNumber = numbers[i];
        const currentDifference = Math.abs(target - currentNumber);
        if (currentDifference < minDifference) {
            closestNumber = currentNumber;
            minDifference = currentDifference;
        }
    }
    return closestNumber;
};
export default {};
//# sourceMappingURL=utils.js.map