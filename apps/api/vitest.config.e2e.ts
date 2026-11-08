import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // e2e 用例共用同一个测试库，顺序执行避免门店配置/订单互相干扰。
    fileParallelism: false,
  },
});
