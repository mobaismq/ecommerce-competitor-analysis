import electronLog from 'electron-log/main'

electronLog.initialize()

/** 主进程统一诊断日志：落盘到 Electron userData/logs，支持级别与自动轮转。 */
export const logger = electronLog.scope('desktop')