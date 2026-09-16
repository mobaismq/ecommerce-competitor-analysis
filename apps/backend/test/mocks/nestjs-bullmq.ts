/**
 * `@nestjs/bullmq` 为纯 ESM 包，被 ts-jest 以 CommonJS require 时会报 ESM 语法错。
 * 测试不需要真实队列原型，此处用 stub 装饰器替代注入，避免在单测里加载该 ESM 模块。
 */
export const InjectFlowProducer = jest.fn(() => () => undefined)
export const InjectQueue = jest.fn(() => () => undefined)
export const BullModule = {
  registerQueue: jest.fn(() => () => undefined),
  registerQueueAsync: jest.fn(() => () => undefined),
  registerFlowProducer: jest.fn(() => () => undefined),
}